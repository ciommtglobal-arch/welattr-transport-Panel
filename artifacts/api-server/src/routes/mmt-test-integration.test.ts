import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { gzipSync } from "node:zlib";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

// No Clerk calls, real PostgreSQL connection, environment changes or real data.
const state = vi.hoisted(() => ({
  userId: "TEST-ops" as string | null,
  role: "operations",
  active: 1,
  records: [] as Array<Record<string, any>>,
  shipments: [] as Array<Record<string, any>>,
  messages: [] as Array<Record<string, any>>,
  selects: 0,
  transactions: 0,
  locks: [] as string[],
  storageFailure: false,
}));
const tables = vi.hoisted(() => {
  const table = (name: string, fields: string[]) => Object.fromEntries([
    ["name", name], ...fields.map((field) => [field, { field }]),
  ]) as { name: string; [key: string]: any };
  return {
    requests: table("requests", ["referenceCode", "isTest"]),
    shipments: table("shipments", ["requestId"]),
    communications: table("communications", ["isTest", "message"]),
    staff: table("staff", ["clerkUserId", "active"]),
  };
});
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: state.userId }) }));
vi.mock("drizzle-orm", () => ({
  eq: (column: { field: string }, value: unknown) => (row: any) => row[column.field] === value,
  and: (...predicates: Array<(row: any) => boolean>) => (row: any) => predicates.every((test) => test(row)),
  like: (column: { field: string }, pattern: string) => (row: any) =>
    String(row[column.field]).startsWith(pattern.slice(0, -1).replace(/\\([\\%_])/g, "$1")),
  sql: (_strings: TemplateStringsArray, ...values: unknown[]) => ({ values }),
}));
function query(table: { name: string }) {
  let predicate = (_row: any) => true;
  let limit = Infinity;
  const chain: any = {
    where: (value: typeof predicate) => { predicate = value; return chain; },
    limit: (value: number) => { limit = value; return chain; },
    for: () => chain,
    then: (resolve: (rows: any[]) => unknown) => {
      const rows = table.name === "requests" ? state.records
        : table.name === "shipments" ? state.shipments
        : table.name === "communications" ? state.messages
        : [{ clerkUserId: state.userId, active: state.active, role: state.role }];
      return Promise.resolve(rows.filter(predicate).slice(0, limit)).then(resolve);
    },
  };
  return chain;
}
let previousTransaction: Promise<void> = Promise.resolve();
vi.mock("@workspace/db", () => {
  const connection = {
    select: () => { state.selects++; return { from: query }; },
    execute: async (value: { values: string[] }) => { state.locks.push(value.values[0]); },
    insert: () => ({
      values: (value: any) => ({
        returning: async () => {
          if (state.storageFailure) throw new Error("TEST storage unavailable");
          const row = { id: state.messages.length + 1, ...value, createdAt: new Date() };
          state.messages.push(row);
          return [row];
        },
      }),
    }),
  };
  return {
    db: {
      ...connection,
      transaction: async (callback: (tx: typeof connection) => Promise<unknown>) => {
        state.transactions++;
        const prior = previousTransaction;
        let release!: () => void;
        previousTransaction = new Promise<void>((resolve) => { release = resolve; });
        await prior;
        const before = [...state.messages];
        try { return await callback(connection); }
        catch (error) { state.messages = before; throw error; }
        finally { release(); }
      },
    },
    logisticsRequestsTable: tables.requests,
    logisticsShipmentsTable: tables.shipments,
    logisticsCommunicationsTable: tables.communications,
    staffUsersTable: tables.staff,
    logisticsListingGrantsTable: {},
  };
});
import router from "./mmt-test-integration";
import { createMmtTestRawParser, requireMmtTestEnvironment } from "../lib/mmtTestIntegration";

const app = express();
app.use("/api/mmt/test-integration", requireMmtTestEnvironment, createMmtTestRawParser());
app.use(express.json());
app.use("/api/mmt/test-integration", router);
const reference = "UKR-MERSİN-NARENCİYE-001";
const secret = "TEST-ONLY-not-a-real-key-000000000000000000";
const payload = JSON.stringify({ docRef: reference, kind: "compliance_check" });

function signed(path = "events", body: string | Buffer = payload, id = "TEST-event_001", timestamp = Date.now()) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${id}.`).update(body).digest("hex");
  return request(app).post(`/api/mmt/test-integration/${path}`)
    .set("Content-Type", "application/json")
    .set("X-MMT-Event-Id", id)
    .set("X-MMT-Timestamp", String(timestamp))
    .set("X-MMT-Signature", signature)
    .send(body);
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("REPLIT_DEPLOYMENT", "");
  vi.stubEnv("MMT_TEST_INTEGRATION_ENABLED", "true");
  vi.stubEnv("MMT_TEST_INTEGRATION_HMAC_SECRET", secret);
  vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "TEST-founder");
  state.userId = "TEST-ops"; state.role = "operations"; state.active = 1;
  state.records = [{ id: 7, referenceCode: reference, isTest: true, requesterClerkUserId: "TEST-ops" }];
  state.shipments = []; state.messages = []; state.locks = [];
  state.selects = 0; state.transactions = 0; state.storageFailure = false;
  previousTransaction = Promise.resolve();
});
afterEach(() => vi.unstubAllEnvs());

describe("MMT private TEST integration", () => {
  it.each(["production", "staging", ""])("blocks NODE_ENV=%s before reading or writing DB", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    await signed().expect(404);
    await signed("approve", "{}").expect(404);
    expect(state.selects).toBe(0); expect(state.transactions).toBe(0);
  });
  it("blocks published deployment even when NODE_ENV says development", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    await signed().expect(404); expect(state.selects).toBe(0);
  });
  it("requires explicit TEST enablement", async () => {
    vi.stubEnv("MMT_TEST_INTEGRATION_ENABLED", "");
    await signed().expect(404); expect(state.selects).toBe(0);
  });
  it("requires a Clerk session even with a valid service HMAC", async () => {
    state.userId = null;
    await signed().expect(401); expect(state.selects).toBe(0);
  });
  it.each(["admin", "finance", "reviewer", "leader", "assistant"])("does not promote %s to operations", async (role) => {
    state.role = role; await signed().expect(403); expect(state.messages).toHaveLength(0);
  });
  it("denies inactive staff", async () => {
    state.active = 0; await signed().expect(403);
  });
  it("denies a different unassigned user", async () => {
    state.userId = "TEST-other"; await signed().expect(403);
    expect(state.messages).toHaveLength(0);
  });
  it("permits an assigned operator, retaining the Clerk identity in activity", async () => {
    state.records[0].requesterClerkUserId = "TEST-other";
    state.shipments = [{ requestId: 7, assignedStaffClerkUserId: "TEST-ops" }];
    const response = await signed().expect(200);
    expect(response.body).toMatchObject({ testOnly: true, activityRecorded: true, queuedForReview: false, shipmentApproved: false });
    expect(state.messages[0].createdByClerkUserId).toBe("TEST-ops");
    expect(state.messages[0].isTest).toBe(true);
  });
  it("preserves Turkish İ and the exact pilot reference", async () => {
    await signed().expect(200);
    expect(JSON.parse(state.messages[0].message).docRef).toBe(reference);
  });
  it("allows the existing founder on TEST records without granting a role", async () => {
    state.userId = "TEST-founder"; state.role = "";
    await signed().expect(200);
    expect(state.messages[0].createdByClerkUserId).toBe("TEST-founder");
  });
  it("rejects a real record even for the founder", async () => {
    state.userId = "TEST-founder"; state.records[0].isTest = false;
    await signed().expect(404); expect(state.messages).toHaveLength(0);
  });
  it("does not manufacture a missing pilot record", async () => {
    state.records = []; await signed().expect(404); expect(state.messages).toHaveLength(0);
  });
  it("fails closed for a missing TEST key", async () => {
    vi.stubEnv("MMT_TEST_INTEGRATION_HMAC_SECRET", "");
    await signed().expect(503); expect(state.selects).toBe(0);
  });
  it("rejects changed raw bytes rather than reconstructing JSON", async () => {
    await signed().set("X-MMT-Signature", "0".repeat(64)).expect(401);
    expect(state.selects).toBe(0);
  });
  it("accepts the exact signed whitespace-bearing raw JSON", async () => {
    await signed("events", ` { "kind": "compliance_check", "docRef": "${reference}" } `).expect(200);
  });
  it.each([-360_000, 360_000])("rejects out-of-window timestamp %s", async (offset) => {
    await signed("events", payload, "TEST-time", Date.now() + offset).expect(401);
    expect(state.selects).toBe(0);
  });
  it("never accepts Shopify or WhatsApp headers as MMT signatures", async () => {
    await request(app).post("/api/mmt/test-integration/events")
      .set("X-Shopify-Hmac-Sha256", "TEST-invalid")
      .set("X-Hub-Signature-256", "TEST-invalid").send({ docRef: reference, kind: "compliance_check" })
      .expect(401);
  });
  it.each(["{", JSON.stringify({ docRef: "../other", kind: "compliance_check" }),
    JSON.stringify({ docRef: reference, kind: "shipment_approved" }),
    JSON.stringify({ docRef: reference, kind: "compliance_check", userId: "TEST-founder" })])(
    "rejects invalid JSON, references, kinds or body identity overrides", async (body) => {
      await signed("events", body).expect(400); expect(state.messages).toHaveLength(0);
    },
  );
  it("rejects oversized and compressed bodies without persistence", async () => {
    await signed("events", " ".repeat(17 * 1024)).expect(413);
    await signed("events", gzipSync(payload)).set("Content-Encoding", "gzip").expect(415);
    expect(state.messages).toHaveLength(0);
  });
  it("deduplicates concurrent identical events with an advisory transaction lock", async () => {
    const replies = await Promise.all([signed(), signed()]);
    expect(replies.map((reply) => reply.status)).toEqual([200, 200]);
    expect(replies.filter((reply) => reply.body.alreadyReceived)).toHaveLength(1);
    expect(state.messages).toHaveLength(1);
    expect(state.locks).toEqual(["mmt-test-v1:TEST-event_001", "mmt-test-v1:TEST-event_001"]);
  });
  it("conflicts on changed content without replacing the original activity", async () => {
    await signed().expect(200);
    const original = state.messages[0].message;
    await signed("events", JSON.stringify({ docRef: reference, kind: "contract_review" })).expect(409);
    expect(state.messages).toHaveLength(1); expect(state.messages[0].message).toBe(original);
  });
  it("does not merge independent event IDs containing underscores", async () => {
    await signed("events", payload, "TEST_a").expect(200);
    await signed("events", payload, "TESTxa").expect(200);
    expect(state.messages).toHaveLength(2);
  });
  it("does not attribute another user's replay to the original actor", async () => {
    await signed().expect(200);
    state.userId = "TEST-founder";
    await signed().expect(409);
    expect(state.messages[0].createdByClerkUserId).toBe("TEST-ops");
  });
  it("does not treat a forged generic note as a previously signed event", async () => {
    state.messages = [{
      id: 1, requestId: 7, createdByClerkUserId: "TEST-ops",
      isTest: true, channel: "note", direction: "internal",
      message: JSON.stringify({
        integration: "mmt-test-v1", eventId: "TEST-event_001",
        docRef: reference, kind: "compliance_check", sourceTimestamp: Date.now(),
      }),
    }];
    await signed().expect(409);
    expect(state.messages).toHaveLength(1);
  });
  it("reports storage failure without fake persistence", async () => {
    state.storageFailure = true;
    const response = await signed().expect(503);
    expect(response.body).not.toHaveProperty("persisted");
    expect(state.messages).toHaveLength(0);
  });
  it("keeps founder approval at 501 with no DB activity", async () => {
    state.userId = "TEST-founder";
    await signed("approve", "{}").expect(501);
    expect(state.selects).toBe(0); expect(state.messages).toHaveLength(0);
  });
  it("does not let operations or an HMAC-only caller approve", async () => {
    await signed("approve", "{}").expect(403);
    state.userId = null; await signed("approve", "{}").expect(401);
    expect(state.messages).toHaveLength(0);
  });
});
