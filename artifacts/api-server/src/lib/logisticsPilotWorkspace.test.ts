import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql, eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import type { db as Db } from "@workspace/db";

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];
const state = vi.hoisted(() => ({
  tx: null as Tx | null, userId: "test-founder" as string | null,
  release: null as (() => void) | null,
}));
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: state.userId }),
  clerkClient: { users: { getUser: async (id: string) => ({
    privateMetadata: { logisticsPilotTest: id.startsWith("test-") }, emailAddresses: [],
  }) } },
}));
vi.mock("./logisticsListingAuth", () => ({
  isLogisticsFounder: (id: string) => id === "test-founder",
}));
vi.mock("@workspace/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(target, property, receiver) {
        if (property === "transaction") return (fn: Parameters<typeof actual.db.transaction>[0]) => {
          if (!state.tx) throw new Error("TEST transaction not initialized");
          return state.tx.transaction(fn);
        };
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

import {
  assertInviteUsable, assertTaskTransition, getPilotWorkspace, mutatePilotWorkspace,
  pilotEnvironmentEnabled,
} from "./logisticsPilotWorkspace";
import { logisticsPilotInvitesTable as invites } from "@workspace/db";
import router from "../routes/logistics-pilot-workspace";

const owner = { userId: "test-founder", isFounder: true };
const worker = { userId: "test-worker", isFounder: false };
const outsider = { userId: "test-outsider", isFounder: false };
const future = () => new Date(Date.now() + 86400000);
const action = (actor: typeof owner, input: Parameters<typeof mutatePilotWorkspace>[1]) =>
  mutatePilotWorkspace(actor, input, actor.isFounder);
const app = express();
app.use(express.json());
app.use("/api", router);
const url = "/api/logistics/test-pilot/workspace";

describe("TEST pilot guards (no database writes)", () => {
  it("preserves exact Unicode reference at the input boundary", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REPLIT_DEPLOYMENT", "");
    const r = await request(app).post(url).send({ action: "create_file", reference: "UKR-MERSIN-NARENCIYE-001" });
    expect(r.status).toBe(400);
  });
  it("denies expired, revoked, reused and wrong-recipient invitations", () => {
    const valid = { targetUserId: worker.userId, acceptedAt: null, revokedAt: null, expiresAt: future() };
    expect(() => assertInviteUsable(valid, worker.userId)).not.toThrow();
    for (const i of [undefined, { ...valid, expiresAt: new Date(0) }, { ...valid, acceptedAt: new Date() }, { ...valid, revokedAt: new Date() }]) {
      expect(() => assertInviteUsable(i, worker.userId)).toThrow();
    }
    expect(() => assertInviteUsable(valid, outsider.userId)).toThrow();
  });
  it("cannot self-accept, review an undelivered task or submit someone else's output", () => {
    expect(() => assertTaskTransition("submitted", "accept_task", worker.userId, worker.userId, true)).toThrow();
    expect(() => assertTaskTransition("assigned", "accept_task", worker.userId, owner.userId, true)).toThrow();
    expect(() => assertTaskTransition("assigned", "submit_task", worker.userId, outsider.userId, false)).toThrow();
    expect(() => assertTaskTransition("accepted", "submit_task", worker.userId, worker.userId, false)).toThrow();
  });
  it("production and deployed processes fail closed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(pilotEnvironmentEnabled()).toBe(false);
    expect((await request(app).post(url).send({ action: "create_file" })).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    expect((await request(app).get(url)).status).toBe(404);
    vi.unstubAllEnvs();
  });
  it("HMAC headers do not supply a Clerk identity", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REPLIT_DEPLOYMENT", "");
    state.userId = null;
    expect((await request(app).get(url).set("X-MMT-Signature", "test-not-a-clerk-session")).status).toBe(401);
    state.userId = owner.userId;
    vi.unstubAllEnvs();
  });
});

// Explicit opt-in, after development target fingerprint verification. Each table
// is pg_temp, shadows the public table, and is dropped by rollback. This suite
// never truncates or alters any public record, staff role or Clerk account.
describe.skipIf(process.env.LOGISTICS_PILOT_DB_TEST !== "1")("persistent TEST workflow / PostgreSQL rollback sandbox", () => {
  let rollback: Promise<unknown>;
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
    let ready!: () => void;
    const initialized = new Promise<void>(r => { ready = r; });
    rollback = actual.db.transaction(async tx => {
      state.tx = tx;
      for (const name of ["files", "invites", "tasks", "submissions", "events"]) {
        // Identifier chosen exclusively from the fixed list above.
        await tx.execute(sql.raw(`CREATE TEMP TABLE logistics_pilot_${name} (LIKE public.logistics_pilot_${name} INCLUDING ALL) ON COMMIT DROP`));
      }
      ready();
      await new Promise<void>(r => { state.release = r; });
      throw new Error("PILOT_SANDBOX_ROLLBACK");
    }).catch(error => {
      if (error.message !== "PILOT_SANDBOX_ROLLBACK") throw error;
    });
    await Promise.race([initialized, rollback]);
  });
  beforeEach(async () => {
    await state.tx!.execute(sql`TRUNCATE pg_temp.logistics_pilot_submissions, pg_temp.logistics_pilot_tasks, pg_temp.logistics_pilot_invites, pg_temp.logistics_pilot_events, pg_temp.logistics_pilot_files`);
  });
  afterAll(async () => { state.release?.(); await rollback; state.tx = null; });

  it("persists invite, responsibility, due date, two immutable revisions, review and real-actor history", async () => {
    expect((await getPilotWorkspace(owner, true)).file).toBeNull();
    await action(owner, { action: "create_file" });
    await expect(action(owner, { action: "create_file" })).rejects.toMatchObject({ status: 409 });
    const invited = await action(owner, { action: "invite", targetUserId: worker.userId, role: "worker", expiresAt: future() });
    expect(invited.inviteToken).toHaveLength(64);
    expect(JSON.stringify(invited.invitations)).not.toContain("tokenHash");
    await expect(action(outsider, { action: "accept_invite", token: invited.inviteToken })).rejects.toMatchObject({ status: 409 });
    const accepted = await action(worker, { action: "accept_invite", token: invited.inviteToken });
    expect(accepted.role).toBe("worker");
    await expect(action(worker, { action: "accept_invite", token: invited.inviteToken })).rejects.toMatchObject({ status: 409 });
    await expect(getPilotWorkspace(outsider, false)).rejects.toMatchObject({ status: 403 });
    await expect(action(worker, { action: "create_task", title: "Forbidden", assignedTo: worker.userId, dueAt: future() })).rejects.toMatchObject({ status: 403 });
    let ws = await action(owner, { action: "create_task", title: "TEST yük planı", assignedTo: worker.userId, dueAt: new Date(Date.now() - 60000) });
    const taskId = ws.tasks[0].id;
    expect(ws.summary).toMatchObject({ missing: 1, overdue: 1, awaitingDecision: 0 });
    await expect(action(owner, { action: "submit_task", taskId, content: "Impersonation" })).rejects.toMatchObject({ status: 403 });
    ws = await action(worker, { action: "submit_task", taskId, content: "TEST çıktı ilk sürüm" });
    expect(ws.summary.awaitingDecision).toBe(1);
    ws = await action(owner, { action: "request_revision", taskId, note: "TEST rota bilgisini düzelt" });
    expect(ws.tasks[0].submissions[0].content).toBe("TEST çıktı ilk sürüm");
    ws = await action(worker, { action: "submit_task", taskId, content: "TEST çıktı düzeltilmiş sürüm" });
    expect(ws.tasks[0].submissions.map(s => s.revision)).toEqual([1, 2]);
    await expect(action(worker, { action: "accept_task", taskId })).rejects.toMatchObject({ status: 403 });
    await action(owner, { action: "accept_task", taskId });
    await action(owner, { action: "request_review" });
    await expect(action(worker, { action: "decide_review", decision: "approved_test", note: "Forbidden" })).rejects.toMatchObject({ status: 403 });
    ws = await action(owner, { action: "decide_review", decision: "approved_test", note: "Yalnız TEST incelemesi" });
    expect(ws.file?.reviewState).toBe("approved_test");
    expect(ws.commercialApproval).toBe(false);
    expect(ws.summary).toEqual({ missing: 0, overdue: 0, awaitingDecision: 0 });
    expect(ws.history.every(h => [owner.userId, worker.userId].includes(h.actorUserId) && h.createdAt instanceof Date)).toBe(true);
    expect(ws.history.some(h => h.detail.includes("TEST rota bilgisini düzelt"))).toBe(true);
    expect(ws.history.filter(h => h.action === "submit_task")).toHaveLength(2);
    expect(JSON.stringify(ws)).not.toContain(invited.inviteToken);
    await expect(action(worker, { action: "submit_task", taskId, content: "Late change" })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects expired/revoked tokens and non-TEST recipients; revocation removes access", async () => {
    await action(owner, { action: "create_file" });
    await expect(action(owner, { action: "invite", targetUserId: "real-user", role: "worker", expiresAt: future() })).rejects.toMatchObject({ status: 400 });
    let ws = await action(owner, { action: "invite", targetUserId: worker.userId, role: "worker", expiresAt: future() });
    const expiredToken = ws.inviteToken;
    await state.tx!.update(invites).set({ expiresAt: new Date(0) }).where(eq(invites.id, ws.invitations[0].id));
    await expect(action(worker, { action: "accept_invite", token: expiredToken })).rejects.toMatchObject({ status: 409 });
    ws = await action(owner, { action: "invite", targetUserId: worker.userId, role: "worker", expiresAt: future() });
    const token = ws.inviteToken;
    await action(worker, { action: "accept_invite", token });
    const current = ws.invitations.find(i => i.expiresAt > new Date())!;
    await action(owner, { action: "revoke_invite", inviteId: current.id });
    await expect(action(worker, { action: "accept_invite", token })).rejects.toMatchObject({ status: 409 });
    await expect(getPilotWorkspace(worker, false)).rejects.toMatchObject({ status: 403 });
  });

  it("rolls back invalid actions and never allows review with incomplete tasks", async () => {
    await action(owner, { action: "create_file" });
    await expect(action(owner, { action: "request_review" })).rejects.toMatchObject({ status: 409 });
    await expect(action(owner, { action: "create_task", title: "TEST", assignedTo: outsider.userId, dueAt: future() })).rejects.toMatchObject({ status: 400 });
    const ws = await getPilotWorkspace(owner, true);
    expect(ws.tasks).toHaveLength(0);
    expect(ws.history.map(h => h.action)).toEqual(["create_file"]);
    await expect(action(owner, { action: "decide_review", decision: "approved_test", note: "TEST" })).rejects.toMatchObject({ status: 409 });
  });
});
