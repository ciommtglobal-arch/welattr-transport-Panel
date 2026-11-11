import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "test-founder" as string | null,
  role: "operations",
  active: true,
  record: { id: 101, requesterClerkUserId: "test-requester" } as {
    id: number; requesterClerkUserId: string;
  } | null,
  assigned: false,
  failure: false,
  filters: [] as { table: string; params: unknown[] }[],
  writes: {
    insert: vi.fn(), update: vi.fn(), delete: vi.fn(),
    transaction: vi.fn(), execute: vi.fn(),
  },
}));

vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: state.userId }) }));
vi.mock("@workspace/db", async () => {
  const { pgTable, text, integer, boolean } = await import("drizzle-orm/pg-core");
  const { getTableName } = await import("drizzle-orm");
  const { PgDialect: Dialect } = await import("drizzle-orm/pg-core");
  const requests = pgTable("test_requests", {
    id: integer("id"), referenceCode: text("reference_code"), isTest: boolean("is_test"),
    requesterClerkUserId: text("requester_clerk_user_id"),
  });
  const shipments = pgTable("test_shipments", {
    id: integer("id"), requestId: integer("request_id"),
    assignedStaffClerkUserId: text("assigned_staff_clerk_user_id"),
  });
  const staff = pgTable("test_staff", {
    clerkUserId: text("clerk_user_id"), active: integer("active"),
  });
  return {
    logisticsRequestsTable: requests,
    logisticsShipmentsTable: shipments,
    staffUsersTable: staff,
    logisticsListingGrantsTable: pgTable("test_grants", { clerkUserId: text("user_id"), active: integer("active") }),
    db: {
      ...state.writes,
      select: () => ({
        from: (table: typeof requests | typeof staff | typeof shipments) => ({
          where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
            const name = getTableName(table);
            state.filters.push({ table: name, params: new Dialect().sqlToQuery(condition).params });
            return {
              limit: async () => {
                if (state.failure) throw new Error("TEST-only private database failure");
                if (name === "test_staff") return state.active ? [{ role: state.role }] : [];
                if (name === "test_requests") return state.record ? [state.record] : [];
                if (name === "test_shipments") return state.assigned ? [{ id: 202 }] : [];
                return [];
              },
            };
          },
        }),
      }),
    },
  };
});

import router from "./logistics-test-pilot";

const app = express();
app.use("/api", router);
const url = "/api/logistics/test-pilot/readiness";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("REPLIT_DEPLOYMENT", "");
  vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "test-founder");
  state.userId = "test-founder";
  state.role = "operations";
  state.active = true;
  state.record = { id: 101, requesterClerkUserId: "test-requester" };
  state.assigned = false;
  state.failure = false;
  state.filters = [];
  vi.clearAllMocks();
});
afterEach(() => {
  for (const mutation of Object.values(state.writes)) expect(mutation).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});

describe("read-only logistics TEST pilot workspace", () => {
  it.each(["production", "", "staging"])("is closed in %s before auth/database access", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    expect((await request(app).get(url)).status).toBe(404);
    expect(state.filters).toHaveLength(0);
  });
  it("is closed on a published runtime even if NODE_ENV says development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REPLIT_DEPLOYMENT", "1");
    expect((await request(app).get(url)).status).toBe(404);
    expect(state.filters).toHaveLength(0);
  });
  it("requires a Clerk session; an X-MMT header cannot impersonate a user", async () => {
    state.userId = null;
    const result = await request(app).get(url).set("X-MMT-Signature", "0".repeat(64));
    expect(result.status).toBe(401);
    expect(state.filters).toHaveLength(0);
  });
  it.each(["admin", "leader", "finance", "assistant"])("does not elevate the %s role", async (role) => {
    state.userId = "test-staff"; state.role = role;
    expect((await request(app).get(url)).status).toBe(403);
    expect(state.filters.map((item) => item.table)).toEqual(["test_staff"]);
  });
  it("rejects inactive staff", async () => {
    state.userId = "test-staff"; state.active = false;
    expect((await request(app).get(url)).status).toBe(403);
  });
  it("uses the exact Turkish reference and a TEST-only database predicate", async () => {
    const result = await request(app).get(url);
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body).toMatchObject({
      fileCode: "UKR-MERSİN-NARENCİYE-001", testOnly: true,
      readOnly: true, readyForLive: false, shipmentApproved: false, recordFound: true,
    });
    expect(state.filters).toEqual([{
      table: "test_requests", params: ["UKR-MERSİN-NARENCİYE-001", true],
    }]);
    expect(JSON.stringify(result.body)).not.toContain("test-requester");
    expect(Number.isNaN(Date.parse(result.body.checkedAt))).toBe(false);
  });
  it("reports missing records for the founder without creating a replacement", async () => {
    state.record = null;
    const result = await request(app).get(url);
    expect(result.status).toBe(200);
    expect(result.body.recordFound).toBe(false);
    expect(result.body.checks.find((item: { key: string }) => item.key === "test_record").status).toBe("FAIL");
  });
  it("does not reveal missing records to unassigned staff", async () => {
    state.userId = "test-staff"; state.record = null;
    expect((await request(app).get(url)).status).toBe(404);
  });
  it("rejects an operations user assigned to neither this request nor its shipment", async () => {
    state.userId = "test-other-operator";
    expect((await request(app).get(url)).status).toBe(403);
    expect(state.filters.at(-1)?.params).toEqual([101, "test-other-operator"]);
  });
  it.each(["requester", "shipment"])("permits an existing operations %s assignment", async (assignment) => {
    state.userId = "test-operator";
    if (assignment === "requester") state.record!.requesterClerkUserId = state.userId;
    else state.assigned = true;
    expect((await request(app).get(url)).status).toBe(200);
  });
  it("cannot choose another file or enable fake geofence completion through input", async () => {
    const result = await request(app).get(`${url}?fileCode=OTHER&autoAssigned=true&status=COMPLETED`);
    expect(result.status).toBe(200);
    expect(result.body.fileCode).toBe("UKR-MERSİN-NARENCİYE-001");
    expect(result.body.shipmentApproved).toBe(false);
    expect(result.body.checks.find((item: { key: string }) => item.key === "geofence").status).toBe("NOT_TESTED");
    expect((await request(app).post(url).send({ status: "COMPLETED" })).status).toBe(404);
  });
  it("shows incomplete work honestly and never declares readiness from a successful read", async () => {
    const result = await request(app).get(url);
    expect(result.body.readyForLive).toBe(false);
    expect(result.body.checks.filter((item: { status: string }) => item.status === "FAIL")).toHaveLength(0);
    expect(result.body.checks.filter((item: { status: string }) => item.status === "NOT_TESTED")).toHaveLength(9);
    expect(result.body.nextActions.length).toBeGreaterThan(0);
  });
  it("returns 503 without private failure details when reads fail", async () => {
    state.failure = true;
    const result = await request(app).get(url);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain("private database failure");
    expect(result.body).not.toHaveProperty("checks");
  });
});
