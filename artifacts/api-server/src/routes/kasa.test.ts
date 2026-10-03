import { randomBytes } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, kasaBranchesTable as branches, kasaUsersTable as users, kasaRequestsTable as requests, kasaAuditTable as audits } from "@workspace/db";

// Auth/Clerk substitution exists ONLY inside tests, never in a runtime route.
vi.mock("@clerk/express", () => ({
  getAuth: (req: express.Request) => ({ userId: req.get("test-verified-identity") ?? null }),
  clerkClient: { users: { getUserList: vi.fn().mockResolvedValue({ data: [] }) } },
}));
import router from "./kasa";

const app = express();
app.use(express.json());
app.use("/api", router);
const suffix = randomBytes(8).toString("hex");
const identities = [`TEST_KASA_ADMIN_${suffix}`, `TEST_KASA_CASHIER_${suffix}`, `TEST_KASA_OTHER_${suffix}`];
let branchIds: number[] = [], memberIds: number[] = [], adminId = 0, cashierId = 0, requestId = 0, reference = "";
const authenticated = (method: "get" | "post" | "patch", path: string, who = 0) =>
  request(app)[method](path).set("test-verified-identity", identities[who]!).set("Origin", "http://127.0.0.1").set("Host", "127.0.0.1");

beforeAll(async () => {
  branchIds = (await db.insert(branches).values([{ name: `TEST_KASA_A_${suffix}` }, { name: `TEST_KASA_B_${suffix}` }]).returning()).map(b => b.id);
  const rows = await db.insert(users).values([
    { name: "TEST administrator", clerkUserId: identities[0]!, role: "admin" },
    { name: "TEST cashier", clerkUserId: identities[1]!, role: "cashier", branchId: branchIds[0]! },
    { name: "TEST other", clerkUserId: identities[2]!, role: "cashier", branchId: branchIds[1]! },
  ]).returning();
  memberIds = rows.map(u => u.id); adminId = rows[0]!.id; cashierId = rows[1]!.id;
});
afterAll(async () => {
  if (memberIds.length) {
    await db.delete(audits).where(inArray(audits.actorId, memberIds));
    await db.delete(requests).where(inArray(requests.cashierId, memberIds));
    await db.delete(users).where(inArray(users.id, memberIds));
  }
  if (branchIds.length) await db.delete(branches).where(inArray(branches.id, branchIds));
});

describe.sequential("Standalone Kasa boundaries and persistence", () => {
  it("rejects unauthenticated and spoofed Telegram/header identities", async () => {
    for (const path of ["/api/kasa/me", "/api/kasa/branches", "/api/kasa/users", "/api/kasa/requests", "/api/kasa/summary"]) {
      const response = await request(app).get(path).set("X-Telegram-ID", identities[0]!).set("X-Role", "admin");
      expect(response.status).toBe(401);
    }
    expect((await request(app).post("/api/kasa/setup").set("X-Telegram-ID", identities[0]!)).status).toBe(401);
  });
  it("never grants access to the first arbitrary logged-in account", async () => {
    const response = await request(app).get("/api/kasa/me").set("test-verified-identity", `TEST_UNKNOWN_${suffix}`);
    expect(response.body).toEqual({
      user: null,
      canSetup: false,
      canManageInvoices: false,
      liveEnabled: false,
    });
    expect((await authenticated("post", "/api/kasa/setup", 1)).status).toBe(403);
  });
  it("denies cashier reports, user/branch administration and cross-origin writes", async () => {
    expect((await authenticated("get", "/api/kasa/summary", 1)).status).toBe(403);
    expect((await authenticated("get", "/api/kasa/users", 1)).status).toBe(403);
    expect((await authenticated("post", "/api/kasa/branches", 1).send({ name: "INVALID" })).status).toBe(403);
    expect((await authenticated("post", "/api/kasa/requests", 1).set("Origin", "https://malicious.invalid").send({ amount: "1", currency: "EUR", branchId: branchIds[0] })).status).toBe(403);
  });
  it("rejects zero, decimal overflow, extra paid/identity fields and foreign branch", async () => {
    for (const amount of ["0.00", "1.234", "100000000", 1.25]) {
      expect((await authenticated("post", "/api/kasa/requests", 1).send({ amount, currency: "EUR", branchId: branchIds[0] })).status).toBe(400);
    }
    expect((await authenticated("post", "/api/kasa/requests", 1).send({ amount: "1.00", currency: "EUR", branchId: branchIds[0], status: "COMPLETED", cashierId: adminId })).status).toBe(400);
    expect((await authenticated("post", "/api/kasa/requests", 1).send({ amount: "1.00", currency: "EUR", branchId: branchIds[1] })).status).toBe(403);
  });
  it("creates a persistent pending request with server-owned identity and exact decimal", async () => {
    const response = await authenticated("post", "/api/kasa/requests", 1).send({ amount: "12.30", currency: "EUR", branchId: branchIds[0], note: "TEST private note" });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ amount: "12.30", currency: "EUR", cashierId, status: "PENDING" });
    requestId = response.body.id; reference = response.body.reference;
    const [row] = await db.select().from(requests).where(eq(requests.id, requestId));
    expect(row?.amount).toBe("12.30");
    expect(row?.verifiedAt).toBeNull();
    expect((await authenticated("get", `/api/kasa/requests/${requestId}`, 1)).body.amount).toBe("12.30");
  });
  it("hides other cashiers records while QR only exposes minimal read-only data", async () => {
    expect((await authenticated("get", `/api/kasa/requests/${requestId}`, 2)).status).toBe(404);
    const otherList = await authenticated("get", "/api/kasa/requests", 2);
    expect(otherList.body.some((r: { id: number }) => r.id === requestId)).toBe(false);
    const publicView = await request(app).get(`/api/kasa/public/${reference}`);
    expect(publicView.body).toEqual({ amount: "12.30", currency: "EUR", status: "PENDING", liveEnabled: false });
    expect((await request(app).post(`/api/kasa/public/${reference}`).send({ status: "COMPLETED" })).status).toBe(401);
    expect((await authenticated("patch", `/api/kasa/requests/${requestId}`).send({ status: "COMPLETED" })).status).toBe(404);
  });
  it("separates currencies and counts only provider-verified completed revenue", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await db.insert(requests).values([
      { reference: randomBytes(24).toString("hex"), cashierId, branchId: branchIds[0]!, amount: "4.50", currency: "USD" },
      { reference: randomBytes(24).toString("hex"), cashierId, branchId: branchIds[0]!, amount: "3.10", currency: "EUR", status: "COMPLETED", providerReference: `TEST_VERIFIED_${suffix}`, verifiedAt: new Date(), completedAt: new Date() },
    ]);
    const summary = await authenticated("get", `/api/kasa/summary?branchId=${branchIds[0]}&date=${today}`);
    expect(summary.status).toBe(200);
    expect(summary.body.totals.find((t: { currency: string }) => t.currency === "EUR")).toEqual({ currency: "EUR", revenue: "3.10", pendingAmount: "12.30", pendingCount: 1, completedCount: 1 });
    expect(summary.body.totals.find((t: { currency: string }) => t.currency === "USD").revenue).toBe("0.00");
    expect(summary.body.totals.find((t: { currency: string }) => t.currency === "USD").pendingAmount).toBe("4.50");
    expect(summary.body.fiscalReport).toBe(false);
    expect((await authenticated("get", "/api/kasa/summary?date=2026-02-29")).status).toBe(400);
    await expect(db.insert(requests).values({ reference: randomBytes(24).toString("hex"), cashierId, branchId: branchIds[0]!, amount: "1.00", currency: "EUR", status: "COMPLETED" })).rejects.toThrow();
  });
  it("supports branch edit/deactivation, preserves history and blocks new requests", async () => {
    const edit = await authenticated("patch", `/api/kasa/branches/${branchIds[0]}`).send({ name: `TEST_KASA_EDIT_${suffix}`, active: false });
    expect(edit.status).toBe(200);
    expect(edit.body.active).toBe(false);
    expect((await authenticated("get", `/api/kasa/requests/${requestId}`, 1)).status).toBe(200);
    expect((await authenticated("post", "/api/kasa/requests", 1).send({ amount: "1", currency: "EUR", branchId: branchIds[0] })).status).toBe(409);
  });
  it("supports admin user assignment edits, blocks self-demotion and unverified grants", async () => {
    expect((await authenticated("post", "/api/kasa/users").send({ email: "not-verified@example.invalid", role: "cashier", branchId: branchIds[1] })).status).toBe(400);
    expect((await authenticated("patch", `/api/kasa/users/${adminId}`).send({ role: "cashier", branchId: branchIds[1], active: true })).status).toBe(403);
    const update = await authenticated("patch", `/api/kasa/users/${cashierId}`).send({ role: "cashier", branchId: branchIds[0], active: false });
    expect(update.status).toBe(200);
    expect(update.body.active).toBe(false);
    expect((await authenticated("get", "/api/kasa/requests", 1)).status).toBe(403);
    const [history] = await db.select().from(requests).where(and(eq(requests.id, requestId), eq(requests.cashierId, cashierId)));
    expect(history).toBeDefined();
  });
});