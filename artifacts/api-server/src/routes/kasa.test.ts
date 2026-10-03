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
    for (const path of ["/api/kasa/me", "/api/kasa/branches", "/api/kasa/users", "/api/kasa/requests", "/api/kasa/summary", "/api/kasa/summary/export?format=csv", "/api/kasa/summary/export?format=html"]) {
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
    for (const format of ["csv", "html"]) {
      expect((await authenticated("get", `/api/kasa/summary/export?format=${format}`, 1)).status).toBe(403);
    }
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
  it("exports the same exact summary using Istanbul midnight and the selected branch", async () => {
    const date = "2031-05-04";
    const insert = (values: Partial<typeof requests.$inferInsert>) => ({
      reference: randomBytes(24).toString("hex"), cashierId, branchId: branchIds[0]!,
      amount: "99999999.99", currency: "TRY" as const, ...values,
    });
    const verified = { status: "COMPLETED" as const, providerReference: `TEST_EXPORT_${suffix}`, verifiedAt: new Date("2031-05-03T21:00:00Z") };
    await db.insert(requests).values([
      insert({ ...verified, createdAt: new Date("2031-05-01T10:00:00Z"), completedAt: new Date("2031-05-03T21:00:00Z") }),
      insert({ ...verified, completedAt: new Date("2031-05-04T20:59:59.999Z") }),
      insert({ ...verified, amount: "55.55", completedAt: new Date("2031-05-03T20:59:59.999Z") }),
      insert({ ...verified, amount: "66.66", completedAt: new Date("2031-05-04T21:00:00Z") }),
      insert({ amount: "0.10", currency: "EUR", createdAt: new Date("2031-05-03T21:00:00Z") }),
      insert({ amount: "0.20", currency: "EUR", createdAt: new Date("2031-05-04T20:59:59.999Z") }),
      insert({ amount: "77.77", currency: "EUR", createdAt: new Date("2031-05-04T21:00:00Z") }),
      insert({ ...verified, amount: "88.88", branchId: branchIds[1]!, completedAt: new Date("2031-05-03T21:00:00Z") }),
    ]);
    const filters = `branchId=${branchIds[0]}&date=${date}`;
    const summary = await authenticated("get", `/api/kasa/summary?${filters}`);
    expect(summary.status).toBe(200);
    expect(summary.body.totals).toEqual([
      { currency: "TRY", revenue: "199999999.98", pendingAmount: "0.00", completedCount: 2, pendingCount: 0 },
      { currency: "EUR", revenue: "0.00", pendingAmount: "0.30", completedCount: 0, pendingCount: 2 },
      { currency: "USD", revenue: "0.00", pendingAmount: "0.00", completedCount: 0, pendingCount: 0 },
    ]);
    for (const format of ["csv", "html"]) {
      const exported = await authenticated("get", `/api/kasa/summary/export?${filters}&format=${format}`);
      expect(exported.status).toBe(200);
      expect(exported.headers["content-type"]).toContain(format === "csv" ? "text/csv" : "text/html");
      expect(exported.headers["content-disposition"]).toMatch(new RegExp(`attachment; filename="mmt-kasa-sube-${branchIds[0]}-${date}-.*\\.${format}"`));
      expect(exported.headers["cache-control"]).toBe("no-store");
      expect(exported.headers["x-content-type-options"]).toBe("nosniff");
      for (const value of ["199999999.98", "0.30", "Europe/Istanbul", date, "Mali Z raporu değildir", "Kasa bakiyesi değildir"]) {
        expect(exported.text).toContain(value);
      }
      expect(exported.text).not.toContain("TEST private note");
      if (format === "csv") {
        for (const total of summary.body.totals) {
          expect(exported.text).toContain(`"${total.currency}","${total.revenue}","${total.completedCount}","${total.pendingAmount}","${total.pendingCount}"`);
        }
      }
    }
    const allBranches = await authenticated("get", `/api/kasa/summary/export?date=${date}&format=csv`);
    expect(allBranches.text).toContain('"TRY","200000088.86","3"');
    expect(allBranches.text).toContain('"Şube","Tüm şubeler"');
    const empty = await authenticated("get", `/api/kasa/summary/export?branchId=${branchIds[0]}&date=2000-01-01&format=csv`);
    expect(empty.status).toBe(200);
    for (const currency of ["TRY", "EUR", "USD"]) expect(empty.text).toContain(`"${currency}","0.00","0","0.00","0"`);
  });
  it("rejects invalid export parameters, nonexistent branches and inactive admins", async () => {
    for (const filters of ["", "format=pdf", "format=csv&date=2026-02-29", "format=html&branchId=0", "format=csv&branchId=1.5", "format=csv&branchId=2147483648", "format=csv&date=1999-12-31", "format=csv&date=2031-05-04&date=2031-05-05", "format=csv&role=admin"]) {
      expect((await authenticated("get", `/api/kasa/summary/export?${filters}`)).status).toBe(400);
    }
    expect((await authenticated("get", "/api/kasa/summary/export?format=csv&branchId=2147483647")).status).toBe(404);
    await db.update(users).set({ active: false }).where(eq(users.id, adminId));
    try {
      for (const format of ["csv", "html"]) expect((await authenticated("get", `/api/kasa/summary/export?format=${format}`)).status).toBe(403);
    } finally {
      await db.update(users).set({ active: true }).where(eq(users.id, adminId));
    }
  });
  it("neutralizes a stored branch formula and escapes HTML in actual downloads", async () => {
    const name = ` \t=HYPERLINK("TEST_${suffix}") <script>alert(1)</script>`;
    await db.update(branches).set({ name }).where(eq(branches.id, branchIds[0]!));
    try {
      const csv = await authenticated("get", `/api/kasa/summary/export?format=csv&branchId=${branchIds[0]}`);
      expect(csv.status).toBe(200);
      expect(csv.text).toContain(`"' \t=HYPERLINK(""TEST_${suffix}"") <script>alert(1)</script>"`);
      expect(csv.text).toContain('"Gün","Tüm günler"');
      const html = await authenticated("get", `/api/kasa/summary/export?format=html&branchId=${branchIds[0]}`);
      expect(html.status).toBe(200);
      expect(html.text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html.text).not.toContain("<script>");
    } finally {
      await db.update(branches).set({ name: `TEST_KASA_A_${suffix}` }).where(eq(branches.id, branchIds[0]!));
    }
  });
  it("supports branch edit/deactivation, preserves history and blocks new requests", async () => {
    const edit = await authenticated("patch", `/api/kasa/branches/${branchIds[0]}`).send({ name: `TEST_KASA_EDIT_${suffix}`, active: false });
    expect(edit.status).toBe(200);
    expect(edit.body.active).toBe(false);
    expect((await authenticated("get", `/api/kasa/requests/${requestId}`, 1)).status).toBe(200);
    expect((await authenticated("post", "/api/kasa/requests", 1).send({ amount: "1", currency: "EUR", branchId: branchIds[0] })).status).toBe(409);
    expect((await authenticated("get", `/api/kasa/summary/export?format=csv&branchId=${branchIds[0]}`)).status).toBe(200);
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