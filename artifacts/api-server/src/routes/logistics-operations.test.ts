import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const state = vi.hoisted(() => ({
  userId: "owner", role: "" as string,
  approve: vi.fn(), review: vi.fn(), decide: vi.fn(), sent: vi.fn(), save: vi.fn(), shipment: vi.fn(),
}));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: state.userId || null }) }));
vi.mock("../lib/staffAuth", () => ({
  requireUser: (_req: unknown, res: express.Response) => {
    if (!state.userId) { res.status(401).json({ error: "Sign in required" }); return null; }
    return state.userId;
  },
  requireStaff: async (_req: unknown, res: express.Response) => {
    if (!state.role) { res.status(403).json({ error: "Staff required" }); return null; }
    return { userId: state.userId, staff: { role: state.role } };
  },
}));
vi.mock("@workspace/db", () => ({
  db: { select: () => ({ from: () => ({
    where: () => ({ orderBy: async () => [], limit: async () => [] }),
    orderBy: async () => [],
  }) }) },
  staffUsersTable: {}, logisticsListingGrantsTable: {},
  logisticsRequestsTable: {}, logisticsCarriersTable: {}, logisticsOffersTable: {},
  logisticsShipmentsTable: {}, logisticsCommunicationsTable: {},
}));
vi.mock("../lib/logisticsWorkflow", () => ({
  LogisticsWorkflowError: class extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  approveLogisticsOffer: state.approve, reviewLogisticsCarrier: state.review,
  decideLogisticsOffer: state.decide, markLogisticsOfferSent: state.sent,
  saveLogisticsOffer: state.save, updateLogisticsShipment: state.shipment,
}));
import router from "./logistics-operations";
import { LogisticsWorkflowError } from "../lib/logisticsWorkflow";
const app = express(); app.use(express.json()); app.use("/api", router);
const version = { expectedUpdatedAt: "2026-10-01T12:00:00.000Z" };
function offer() {
  return { id: 1, requestId: 1, carrierId: 1, carrierCostAmount: 2700, customerPriceAmount: 3000, currency: "USD",
    includedServices: "Transport", validUntil: new Date(Date.now() + 3600000), status: "approved",
    createdByClerkUserId: "owner", approvedByClerkUserId: "owner", approvedAt: new Date(), sentAt: null,
    isTest: false, createdAt: new Date(), updatedAt: new Date() };
}
beforeEach(() => {
  vi.clearAllMocks(); state.userId = "owner"; state.role = "";
  vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "owner");
  state.approve.mockResolvedValue(offer());
});
afterEach(() => vi.unstubAllEnvs());
describe("Logistics HTTP permissions and contracts", () => {
  it("lets the existing founder operate without creating a staff grant", async () => {
    const response = await request(app).get("/api/logistics/operations");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ canApprove: true, requests: [], carriers: [], offers: [] });
    expect((await request(app).post("/api/logistics/offers/1/approve").send(version)).status).toBe(200);
    expect(state.approve).toHaveBeenCalledWith(1, { userId: "owner", isFounder: true }, new Date(version.expectedUpdatedAt));
  });
  it.each(["admin", "operations", "finance", "leader", "assistant"])("never treats %s as founder approval", async role => {
    state.userId = `${role}-user`; state.role = role;
    expect((await request(app).post("/api/logistics/offers/1/approve")).status).toBe(403);
    expect((await request(app).post("/api/logistics/carriers/1/review").send({ status: "approved", note: "Reviewed" })).status).toBe(403);
    expect((await request(app).post("/api/logistics/offers/1/decision").send({ decision: "accept_customer", note: "Confirmed" })).status).toBe(403);
    expect(state.approve).not.toHaveBeenCalled(); expect(state.review).not.toHaveBeenCalled(); expect(state.decide).not.toHaveBeenCalled();
  });
  it("preserves explicit operations staff read access, without approval capability", async () => {
    state.userId = "existing-staff"; state.role = "operations";
    const response = await request(app).get("/api/logistics/operations");
    expect(response.status).toBe(200); expect(response.body.canApprove).toBe(false);
  });
  it.each(["admin", "finance", "reviewer", "sales", "media", "leader", "assistant"])(
    "denies %s private logistics reads and coordination mutations", async role => {
      state.userId = `${role}-user`; state.role = role;
      expect((await request(app).get("/api/logistics/operations")).status).toBe(403);
      expect((await request(app).get("/api/logistics/staff")).status).toBe(403);
      expect((await request(app).post("/api/logistics/offers").send({})).status).toBe(403);
      expect((await request(app).patch("/api/logistics/offers/1").send({})).status).toBe(403);
      expect((await request(app).post("/api/logistics/offers/1/mark-sent").send({})).status).toBe(403);
      expect((await request(app).patch("/api/logistics/requests/1/status").send({})).status).toBe(403);
      expect((await request(app).post("/api/logistics/communications").send({})).status).toBe(403);
      expect(state.save).not.toHaveBeenCalled(); expect(state.sent).not.toHaveBeenCalled();
      expect(state.shipment).not.toHaveBeenCalled();
    },
  );
  it("requires sign-in and denies unassigned users", async () => {
    state.userId = "";
    expect((await request(app).get("/api/logistics/operations")).status).toBe(401);
    expect((await request(app).post("/api/logistics/offers/1/approve")).status).toBe(401);
    state.userId = "customer";
    expect((await request(app).get("/api/logistics/operations")).status).toBe(403);
  });
  it("fails closed when the founder allowlist is absent", async () => {
    vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "");
    state.role = "admin";
    expect((await request(app).post("/api/logistics/offers/1/approve")).status).toBe(403);
  });
  it("requires a real dispatch-record body, not merely a clicked button", async () => {
    expect((await request(app).post("/api/logistics/offers/1/mark-sent").send({})).status).toBe(400);
    expect(state.sent).not.toHaveBeenCalled();
    state.sent.mockResolvedValue({ ...offer(), status: "sent", sentAt: new Date() });
    expect((await request(app).post("/api/logistics/offers/1/mark-sent").send({ channel: "email", note: "Manually sent", ...version })).status).toBe(200);
    expect(state.sent).toHaveBeenCalledWith(1, { userId: "owner", isFounder: true }, { channel: "email", note: "Manually sent", expectedUpdatedAt: new Date(version.expectedUpdatedAt) });
  });
  it("returns conflict and storage failures honestly", async () => {
    state.approve.mockRejectedValueOnce(new LogisticsWorkflowError(409, "Already reviewed"));
    expect((await request(app).post("/api/logistics/offers/1/approve").send(version)).status).toBe(409);
    state.approve.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await request(app).post("/api/logistics/offers/1/approve").send(version);
    expect(response.status).toBe(503);
    expect(response.body.error).not.toContain("Database unavailable");
  });
  it("validates IDs and rejects incomplete load/carrier requests", async () => {
    expect((await request(app).post("/api/logistics/offers/not-an-id/approve")).status).toBe(400);
    expect((await request(app).post("/api/logistics/requests").send({})).status).toBe(400);
    expect((await request(app).post("/api/logistics/carriers").send({})).status).toBe(400);
  });
});
