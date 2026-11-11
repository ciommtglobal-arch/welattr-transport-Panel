import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import express from "express";
import request from "supertest";
import type { db as Db, LogisticsRequest } from "@workspace/db";
type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];
const state = vi.hoisted(() => ({
  tx: null as Tx | null, release: null as (() => void) | null,
  actor: { userId: "automation-test-founder", isFounder: true }, files: new Map<string, any>(),
}));
vi.mock("./logisticsListingAuth", () => ({ isLogisticsFounder: (id: string) => id === "automation-test-founder" }));
vi.mock("./logisticsWorkflowAuth", () => ({
  requireLogisticsOperator: async (_req: unknown, res: express.Response) => {
    if (!state.actor.userId) { res.status(401).json({ error: "Sign in" }); return null; }
    if (state.actor.userId === "outsider") { res.status(403).json({ error: "No operations grant" }); return null; }
    return state.actor;
  },
}));
vi.mock("@workspace/db", async original => {
  const actual = await original<typeof import("@workspace/db")>();
  return { ...actual, db: new Proxy(actual.db, {
    get(target, property, receiver) {
      if (property === "transaction") return (fn: Parameters<typeof actual.db.transaction>[0]) => {
        if (!state.tx) throw Error("Isolated TEST transaction required");
        return state.tx.transaction(fn);
      };
      if (state.tx && ["select", "update", "insert", "execute"].includes(String(property))) {
        return (state.tx as any)[property].bind(state.tx);
      }
      return Reflect.get(target, property, receiver);
    },
  }) };
});
vi.mock("./objectStorage", async () => {
  const { randomUUID } = await import("node:crypto");
  class FakeFile {
    bucket = { name: "test-bucket", file: (name: string) => new FakeFile(name) };
    meta = { generation: "1", md5Hash: "TEST_CHECKSUM", size: 13, contentType: "application/pdf" };
    constructor(public name: string) { state.files.set(name.split("/").at(-1)!, this); }
    async getMetadata() { return [this.meta]; }
    async download() { return [Buffer.from("%PDF-1.4\nTEST\n")]; }
    async copy(target: FakeFile) { target.meta = { ...this.meta, generation: "2" }; return [target]; }
  }
  return { ObjectStorageService: class {
    async getObjectEntityUploadURL() {
      const f = new FakeFile(`private/uploads/${randomUUID()}`);
      return `https://upload.example/${f.name}`;
    }
    normalizeObjectEntityPath(url: string) { return `/objects/uploads/${url.split("/").at(-1)}`; }
    async getObjectEntityFile(path: string) {
      const f = state.files.get(path.split("/").at(-1)!);
      if (!f) throw Error("Missing TEST blob");
      return f;
    }
    async getObjectEntityDownloadURL() { return { downloadURL: "https://private-download.example/test", expiresAt: new Date().toISOString() }; }
  } };
});
import { logisticsRequestsTable as requests, logisticsShipmentsTable as shipments, logisticsAutomationJobsTable as jobs } from "@workspace/db";
import {
  actLogisticsAutomation, getLogisticsAutomation, ensureLogisticsAutomation,
  buildPublicLoadMessage, publicMessageSafe, automationDispatchBlockers,
} from "./logisticsAutomation";
import { dispatchOneLogisticsJob, prepareUntrackedLogisticsRequests, productionAutomationEnabled } from "./logisticsAutomationWorker";
import automationRouter from "../routes/logistics-automation";
const app = express(); app.use(express.json()); app.use("/api", automationRouter);
const founder = { userId: "automation-test-founder", isFounder: true };
const operator = { userId: "automation-test-operator", isFounder: false };
const futureDay = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
function fixture() {
  return {
    id: 101, referenceCode: "AUTOMATION-TEST-101", requesterName: "TEST Requester",
    requesterClerkUserId: null, capturedByClerkUserId: null, contactUseConfirmed: false,
    organization: "TEST ONLY", email: "example@example.com",
    phone: "+900000000000", origin: "Mersin", destination: "TEST Liman",
    cargoType: "TEST Narenciye", weightKg: 1000, volumeM3: 10,
    transportMode: "road" as const, loadingDate: futureDay(), notes: "PRIVATE TEST NOTE",
    isTest: true, createdAt: new Date(), updatedAt: new Date(),
  } satisfies LogisticsRequest;
}
afterEach(() => vi.unstubAllEnvs());
describe("Automation boundaries without database writes", () => {
  it("does not leak known private source fields into its public draft", () => {
    const text = buildPublicLoadMessage(fixture());
    for (const value of ["TEST Requester", "example@example.com", "+900000000000", "PRIVATE TEST NOTE"]) expect(text).not.toContain(value);
    expect(text).toContain("TEST YÜK TASLAĞI"); expect(publicMessageSafe(text)).toBe(true);
  });
  it("blocks public contacts, bank information and signed document links", () => {
    for (const text of ["email person@example.com", "call +90 555 555 55 55", "https://x/?X-Goog-Signature=private", "/objects/uploads/private"]) {
      expect(publicMessageSafe(text)).toBe(false);
    }
  });
  it("does not mistake a genuine numeric request reference for a private phone number", () => {
    expect(publicMessageSafe(buildPublicLoadMessage({ ...fixture(), referenceCode: "LOAD-2026-12345678" }))).toBe(true);
    expect(publicMessageSafe("Referans: +90 555 555 55 55")).toBe(false);
  });
  it("never attempts external delivery in preview/test, even with credentials", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "TEST_ONLY"); vi.stubEnv("TELEGRAM_GROUP_ID", "-1001234567890");
    const send = vi.fn(); expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(send).not.toHaveBeenCalled();
    expect(productionAutomationEnabled()).toBe(false); expect(automationDispatchBlockers(true)).toHaveLength(2);
  });
  it("rejects unauthenticated, unrelated and HMAC-only requests before any database access", async () => {
    state.actor = { userId: "", isFounder: false };
    expect((await request(app).get("/api/logistics/requests/101/automation").set("X-MMT-Signature", "TEST")).status).toBe(401);
    state.actor = { userId: "outsider", isFounder: false };
    expect((await request(app).get("/api/logistics/requests/101/automation")).status).toBe(403);
    state.actor = founder;
    expect((await request(app).post("/api/logistics/requests/101/automation").send({ action: "prepare", invented: true })).status).toBe(400);
  });
});

describe.skipIf(process.env.LOGISTICS_AUTOMATION_DB_TEST !== "1")("Automation on rollback-only PostgreSQL temporary tables", () => {
  let rollback: Promise<unknown>;
  beforeAll(async () => {
    if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") throw Error("Development database only");
    const actual = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
    let ready!: () => void;
    const initialized = new Promise<void>(r => { ready = r; });
    rollback = actual.db.transaction(async tx => {
      const fingerprint = await tx.execute(sql`SELECT current_database() AS name, (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid`);
      if (fingerprint.rows[0]?.name !== "heliumdb" || fingerprint.rows[0]?.oid !== 16384) throw Error("Unverified development database");
      state.tx = tx;
      for (const table of ["logistics_requests", "logistics_shipments", "logistics_automation_jobs", "logistics_automation_documents"]) {
        await tx.execute(sql.raw(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`));
        if (table !== "logistics_automation_documents") {
          await tx.execute(sql.raw(`CREATE TEMP SEQUENCE ${table}_test_seq`));
          await tx.execute(sql.raw(`ALTER TABLE pg_temp.${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_test_seq')`));
        }
      }
      ready();
      await new Promise<void>(r => { state.release = r; });
      throw Error("AUTOMATION_TEST_ROLLBACK");
    }).catch(e => { if (e.message !== "AUTOMATION_TEST_ROLLBACK") throw e; });
    await Promise.race([initialized, rollback]);
  });
  beforeEach(async () => {
    state.files.clear(); state.actor = founder;
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REPLIT_DEPLOYMENT", "");
    vi.stubEnv("TELEGRAM_GROUP_ID", "-1001234567890");
    vi.stubEnv("LOADS_TOPIC_ID", "");
    await state.tx!.execute(sql`TRUNCATE pg_temp.logistics_automation_documents, pg_temp.logistics_automation_jobs, pg_temp.logistics_shipments, pg_temp.logistics_requests`);
    await state.tx!.insert(requests).values(fixture());
    await state.tx!.insert(shipments).values({ id: 101, requestId: 101, referenceCode: fixture().referenceCode, status: "new_request" });
  });
  afterAll(async () => { state.release?.(); await rollback; state.tx = null; });
  const action = (input: Parameters<typeof actLogisticsAutomation>[1], actor = founder) => actLogisticsAutomation(101, input, actor);
  async function prepareAndUpload() {
    let response = await action({ action: "prepare" });
    for (const kind of ["request_confirmation", "cargo_details", "company_authority"] as const) {
      response = await action({ action: "request_upload", expectedVersion: response.job!.version,
        kind, fileName: "TEST.pdf", contentType: "application/pdf", size: 13 });
      response = await action({ action: "confirm_upload", expectedVersion: response.job!.version,
        documentId: (response as { uploadDocumentId?: string }).uploadDocumentId });
    }
    return response;
  }
  async function approved(isTest = true) {
    if (!isTest) await state.tx!.update(requests).set({ isTest: false }).where(eq(requests.id, 101));
    let response = await prepareAndUpload();
    response = await action({ action: "verify", expectedVersion: response.job!.version, informationConfirmed: true, note: "TEST documentary review" });
    return action({ action: "approve", expectedVersion: response.job!.version, publicContentConfirmed: true, note: "TEST public listing review" });
  }
  function liveFixture() {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("REPLIT_DEPLOYMENT", "TEST_FIXTURE");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "TEST_ONLY"); vi.stubEnv("TELEGRAM_GROUP_ID", "-1001234567890");
  }
  it("GET creates no records; explicit preparation is idempotent and creates truthful work/history", async () => {
    expect((await getLogisticsAutomation(101, founder)).job).toBeNull();
    const first = await action({ action: "prepare" });
    expect(first.tasks).toHaveLength(5); expect(first.job?.events[0]).toMatchObject({ actorKind: "user", actorUserId: founder.userId });
    expect((await action({ action: "prepare" })).job!.id).toBe(first.job!.id);
    expect((await state.tx!.select().from(jobs))).toHaveLength(1);
  });
  it("new-source preparation is automatic with system attribution, not an invented Clerk user", async () => {
    await state.tx!.update(requests).set({ isTest: false }).where(eq(requests.id, 101));
    expect(await prepareUntrackedLogisticsRequests()).toBe(1); expect(await prepareUntrackedLogisticsRequests()).toBe(0);
    const result = await getLogisticsAutomation(101, founder);
    expect(result.job!.events[0]).toMatchObject({ actorKind: "system", actorUserId: null });
  });
  it("rejects role escalation, stale approvals and missing actual documents", async () => {
    const prepared = await action({ action: "prepare" }); const v = prepared.job!.version;
    await expect(action({ action: "verify", expectedVersion: v, informationConfirmed: true, note: "TEST" }, operator)).rejects.toMatchObject({ status: 403 });
    await expect(action({ action: "verify", expectedVersion: v, informationConfirmed: true, note: "TEST" })).rejects.toMatchObject({ status: 409 });
    await expect(action({ action: "approve", expectedVersion: v, publicContentConfirmed: true, note: "TEST" })).rejects.toMatchObject({ status: 409 });
    await expect(action({ action: "edit", expectedVersion: v - 1, publicMessage: "TEST current draft" })).rejects.toMatchObject({ status: 409 });
    await expect(action({ action: "edit", expectedVersion: v, requiredDocuments: ["cargo_details"] }, operator)).rejects.toMatchObject({ status: 403 });
  });
  it("preserves documents, requires manual truth attestation and separately binds the final founder decision", async () => {
    const response = await prepareAndUpload(); const v = response.job!.version;
    expect(response.documents).toHaveLength(3); expect(response.documents.every(d => d.confirmed)).toBe(true);
    expect(JSON.stringify(response.documents)).not.toContain("objectPath");
    await expect(action({ action: "verify", expectedVersion: v, note: "TEST" })).rejects.toMatchObject({ status: 400 });
    let next = await action({ action: "verify", expectedVersion: v, informationConfirmed: true, note: "TEST checked documents" });
    expect(next.job!.status).toBe("verified");
    await expect(action({ action: "approve", expectedVersion: next.job!.version, note: "TEST" })).rejects.toMatchObject({ status: 400 });
    next = await action({ action: "approve", expectedVersion: next.job!.version, publicContentConfirmed: true, note: "TEST reviewed message" });
    expect(next.job!.status).toBe("approved"); expect(next.job!.providerMessageId).toBeNull();
    const oldUploads = [...state.files.values()].filter(f => f.meta.generation === "1");
    oldUploads.forEach(f => { f.meta.generation = "changed"; });
    expect((await action({ action: "download", documentId: next.documents[0].id })).documents).toHaveLength(3);
    next = await action({ action: "edit", expectedVersion: next.job!.version, publicMessage: "MMT Global TEST revised public draft" }, operator);
    expect(next.job).toMatchObject({ status: "draft", verifiedBy: null, approvedBy: null });
    expect(next.documents).toHaveLength(3);
  });
  it("detects changed source and never dispatches TEST records, even after approval", async () => {
    const result = await approved(); liveFixture();
    const send = vi.fn(); expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(send).not.toHaveBeenCalled();
    await state.tx!.update(requests).set({ weightKg: 1200 }).where(eq(requests.id, 101));
    expect((await getLogisticsAutomation(101, founder)).job!.sourceCurrent).toBe(false);
    await expect(action({ action: "verify", expectedVersion: result.job!.version, informationConfirmed: true, note: "TEST" })).rejects.toMatchObject({ status: 409 });
  });
  it("a pending replacement cannot reuse an older document to bypass review", async () => {
    const response = await prepareAndUpload();
    const pending = await action({ action: "request_upload", expectedVersion: response.job!.version,
      kind: "cargo_details", fileName: "TEST-replacement.pdf", contentType: "application/pdf", size: 13 });
    expect(pending.tasks.find(t => t.key === "documents")!.done).toBe(false);
    await expect(action({ action: "verify", expectedVersion: pending.job!.version,
      informationConfirmed: true, note: "TEST documents review" })).rejects.toMatchObject({ status: 409 });
    const next = await action({ action: "confirm_upload", expectedVersion: pending.job!.version,
      documentId: (pending as { uploadDocumentId?: string }).uploadDocumentId });
    expect(next.documents).toHaveLength(4); expect(next.tasks.find(t => t.key === "documents")!.done).toBe(true);
  });
  it("keeps an explicit provider rejection failed and requires a fresh founder review before retry", async () => {
    await approved(false); liveFixture();
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 403 }));
    expect(await dispatchOneLogisticsJob(send)).toBe(false);
    const result = await getLogisticsAutomation(101, founder);
    expect(result.job!.status).toBe("failed");
    const retry = await action({ action: "retry", expectedVersion: result.job!.version, note: "TEST rejected request reviewed" });
    expect(retry.job).toMatchObject({ status: "draft", approvedBy: null, verifiedBy: null });
    expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(send).toHaveBeenCalledTimes(1);
  });
  it("requires provider receipt, dispatches once and keeps audit actors distinct", async () => {
    await approved(false); liveFixture();
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 987, chat: { id: -1001234567890 } } }), { status: 200 }));
    expect(await dispatchOneLogisticsJob(send)).toBe(true); expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(send).toHaveBeenCalledTimes(1);
    const result = await getLogisticsAutomation(101, founder);
    expect(result.job).toMatchObject({ status: "sent", providerMessageId: "987" });
    expect(result.job!.events.at(-1)).toMatchObject({ actorKind: "system", actorUserId: null, action: "sent" });
  });
  it("preview HTTP approval persists the decision without relying on or contacting Telegram", async () => {
    const prepared = await prepareAndUpload();
    const verified = await action({ action: "verify", expectedVersion: prepared.job!.version,
      informationConfirmed: true, note: "TEST manual review" });
    const send = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("External request forbidden in this test"));
    try {
      const response = await request(app).post("/api/logistics/requests/101/automation").send({
        action: "approve", expectedVersion: verified.job!.version,
        publicContentConfirmed: true, note: "TEST final review",
      });
      expect(response.status).toBe(200);
      expect(response.body.job).toMatchObject({ status: "approved", providerMessageId: null });
      expect(send).not.toHaveBeenCalled();
    } finally { send.mockRestore(); }
  });
  it("does not retry ambiguous provider delivery or permit an operator to reapprove it", async () => {
    await approved(false); liveFixture();
    const send = vi.fn().mockRejectedValue(Error("TEST timeout"));
    expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(send).toHaveBeenCalledTimes(1);
    const result = await getLogisticsAutomation(101, founder);
    expect(result.job!.status).toBe("uncertain");
    await expect(action({ action: "retry", expectedVersion: result.job!.version, note: "TEST retry" })).rejects.toMatchObject({ status: 409 });
  });
  it("blocks changed source or changed confirmed document generation before delivery", async () => {
    await approved(false);
    for (const f of state.files.values()) if (f.meta.generation === "2") f.meta.generation = "changed";
    liveFixture(); const send = vi.fn();
    expect(await dispatchOneLogisticsJob(send)).toBe(false); expect(send).not.toHaveBeenCalled();
    const result = await getLogisticsAutomation(101, founder);
    expect(result.job!.status).toBe("draft"); expect(result.job!.approvedBy).toBeNull();
  });
  it("a changed publication destination invalidates the founder's previous review", async () => {
    await approved(false); liveFixture();
    vi.stubEnv("TELEGRAM_GROUP_ID", "-1001234567891");
    const send = vi.fn();
    expect((await getLogisticsAutomation(101, founder)).job!.sourceCurrent).toBe(false);
    expect(await dispatchOneLogisticsJob(send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
