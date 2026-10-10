import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Table = { name: string };
  type Filter = (row: Row) => boolean;
  const state = { data: {} as Record<string, Row[]>, auditFail: false, locks: [] as string[] };
  const table = (name: string) => new Proxy({ name }, {
    get: (value, key) => key === "name" ? value.name : { field: key },
  });
  const tables = {
    requests: table("requests"), carriers: table("carriers"), shipments: table("shipments"),
    offers: table("offers"), communications: table("communications"), staff: table("staff"),
  };
  const client = {
    select: () => ({ from: (t: Table) => {
      let filter: Filter = () => true; let count = Infinity;
      const query = {
        where: (f: Filter) => { filter = f; return query; },
        limit: (n: number) => { count = n; return query; },
        for: (_mode: string) => { state.locks.push(t.name); return query; },
        then: (resolve: (rows: Row[]) => unknown, reject?: (error: unknown) => unknown) =>
          Promise.resolve(structuredClone((state.data[t.name] ?? []).filter(filter).slice(0, count))).then(resolve, reject),
      };
      return query;
    } }),
    insert: (t: Table) => ({ values: (values: Row) => {
      if (t.name === "communications" && state.auditFail) throw new Error("audit unavailable");
      const row = { id: (state.data[t.name]?.length ?? 0) + 1, approvedAt: null, approvedByClerkUserId: null,
        sentAt: null, createdAt: new Date(), updatedAt: new Date(), ...values };
      state.data[t.name] ??= []; state.data[t.name].push(row);
      return { returning: async () => structuredClone([row]) };
    } }),
    update: (t: Table) => ({ set: (values: Row) => ({ where: (filter: Filter) => {
      const run = () => {
        const rows = state.data[t.name].filter(filter);
        rows.forEach(row => Object.assign(row, values));
        return structuredClone(rows);
      };
      return {
        returning: async () => run(),
        then: (resolve: (rows: Row[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      };
    } }) }),
  };
  const db = { ...client, transaction: async (run: (tx: typeof client) => Promise<unknown>) => {
    const before = structuredClone(state.data);
    try { return await run(client); } catch (error) { state.data = before; throw error; }
  } };
  return { state, tables, db };
});
vi.mock("@workspace/db", () => ({
  db: fixture.db, logisticsRequestsTable: fixture.tables.requests, logisticsCarriersTable: fixture.tables.carriers,
  logisticsShipmentsTable: fixture.tables.shipments, logisticsOffersTable: fixture.tables.offers,
  logisticsCommunicationsTable: fixture.tables.communications, staffUsersTable: fixture.tables.staff,
}));
vi.mock("drizzle-orm", () => ({
  eq: (column: { field: string }, value: unknown) => (row: Record<string, unknown>) => row[column.field] === value,
  and: (...filters: ((row: Record<string, unknown>) => boolean)[]) => (row: Record<string, unknown>) => filters.every(fn => fn(row)),
}));
vi.mock("./logisticsListingAuth", () => ({ isLogisticsFounder: (id: string) => id === "owner" }));
import {
  approveLogisticsOffer as actualApprove, decideLogisticsOffer as actualDecide, isLogisticsTransitionAllowed, markLogisticsOfferSent as actualSend,
  reviewLogisticsCarrier, saveLogisticsOffer as actualSave, updateLogisticsShipment as actualUpdate, validateLogisticsOffer,
} from "./logisticsWorkflow";
const offerVersion = (id: number) => fixture.state.data.offers.find(row => row.id === id)?.updatedAt as Date;
const shipmentVersion = () => fixture.state.data.shipments[0].updatedAt as Date;
const approveLogisticsOffer = (id: number, actor: Parameters<typeof actualApprove>[1]) => actualApprove(id, actor, offerVersion(id));
const markLogisticsOfferSent = (id: number, actor: Parameters<typeof actualSend>[1], input: Omit<Parameters<typeof actualSend>[2], "expectedUpdatedAt">) =>
  actualSend(id, actor, { ...input, expectedUpdatedAt: offerVersion(id) });
const decideLogisticsOffer = (id: number, actor: Parameters<typeof actualDecide>[1], input: Omit<Parameters<typeof actualDecide>[2], "expectedUpdatedAt">) =>
  actualDecide(id, actor, { ...input, expectedUpdatedAt: offerVersion(id) });
const updateLogisticsShipment = (id: number, input: Omit<Parameters<typeof actualUpdate>[1], "expectedUpdatedAt">, actor: Parameters<typeof actualUpdate>[2]) =>
  actualUpdate(id, { ...input, expectedUpdatedAt: shipmentVersion() }, actor);
const saveLogisticsOffer = (input: ReturnType<typeof draft> | Omit<Extract<Parameters<typeof actualSave>[0], { expectedUpdatedAt: Date }>, "expectedUpdatedAt">,
  actor: Parameters<typeof actualSave>[1], id?: number) =>
  actualSave(id === undefined ? input as ReturnType<typeof draft> : { ...input, expectedUpdatedAt: offerVersion(id) }, actor, id);
const owner = { userId: "owner", isFounder: true };
const operator = { userId: "operator", isFounder: false };
const draft = () => ({
  requestId: 1, carrierId: 1, carrierCostAmount: 2700, customerPriceAmount: 3000, currency: "USD",
  includedServices: "Transport", validUntil: new Date(Date.now() + 3600000),
});
beforeEach(() => {
  fixture.state.auditFail = false; fixture.state.locks = [];
  fixture.state.data = {
    requests: [{ id: 1, isTest: false }],
    carriers: [{ id: 1, status: "approved", isTest: false, notes: "Original applicant note" }],
    shipments: [{ id: 1, requestId: 1, status: "new_request", assignedStaffClerkUserId: null,
      plannedLoadingAt: null, plannedDeliveryAt: null, actualLoadingAt: null, actualDeliveryAt: null, internalNote: null, updatedAt: new Date() }],
    offers: [], communications: [], staff: [],
  };
});
async function pendingOffer() {
  await updateLogisticsShipment(1, { status: "planning" }, owner);
  return saveLogisticsOffer(draft(), owner);
}
async function sentOffer() {
  const offer = await pendingOffer();
  await approveLogisticsOffer(offer.id, owner);
  await markLogisticsOfferSent(offer.id, owner, { channel: "email", note: "Manually sent after review" });
  return offer;
}
describe("Founder-controlled logistics workflow", () => {
  it("runs planning through founder offer, confirmed customer acceptance and delivery", async () => {
    const offer = await sentOffer();
    await decideLogisticsOffer(offer.id, owner, { decision: "accept_customer", note: "Customer confirmed by email" });
    for (const status of ["loading", "in_transit", "delivered"] as const) {
      await updateLogisticsShipment(1, { status }, owner);
    }
    const shipment = fixture.state.data.shipments[0];
    expect(shipment.status).toBe("delivered");
    expect(shipment.actualLoadingAt).toBeInstanceOf(Date);
    expect(shipment.actualDeliveryAt).toBeInstanceOf(Date);
    expect(fixture.state.data.offers[0]).toMatchObject({ status: "accepted", approvedByClerkUserId: "owner" });
    expect(fixture.state.data.communications.length).toBeGreaterThanOrEqual(7);
  });
  it.each(["admin", "leader", "assistant"])("never accepts %s instead of the founder", async userId => {
    const offer = await pendingOffer();
    await expect(approveLogisticsOffer(offer.id, { userId, isFounder: true })).rejects.toMatchObject({ status: 403 });
    await expect(reviewLogisticsCarrier(1, "approved", "Reviewed", { userId, isFounder: true })).rejects.toMatchObject({ status: 403 });
    expect(fixture.state.data.offers[0].status).toBe("pending_approval");
  });
  it("requires pending carrier review, retaining original notes", async () => {
    fixture.state.data.carriers[0].status = "pending";
    await reviewLogisticsCarrier(1, "approved", "Documents checked", owner);
    expect(fixture.state.data.carriers[0]).toMatchObject({ status: "approved", reviewedByClerkUserId: "owner" });
    expect(fixture.state.data.carriers[0].notes).toContain("Original applicant note");
    await expect(reviewLogisticsCarrier(1, "rejected", "Second action", owner)).rejects.toMatchObject({ status: 409 });
  });
  it("rejects skipped and backward stages", async () => {
    await expect(updateLogisticsShipment(1, { status: "delivered" }, owner)).rejects.toMatchObject({ status: 409 });
    expect(isLogisticsTransitionAllowed("loading", "planning")).toBe(false);
    expect(isLogisticsTransitionAllowed("loading", "in_transit")).toBe(true);
    expect(isLogisticsTransitionAllowed("delivered", "delivered")).toBe(true);
  });
  it("prevents loading without actual founder approval and customer acceptance", async () => {
    await pendingOffer();
    fixture.state.data.shipments[0].status = "customer_approval";
    fixture.state.data.offers[0] = { ...fixture.state.data.offers[0], status: "accepted", approvedByClerkUserId: "admin", approvedAt: new Date() };
    await expect(updateLogisticsShipment(1, { status: "loading" }, owner)).rejects.toMatchObject({ status: 409 });
    fixture.state.data.offers[0].approvedByClerkUserId = "owner"; fixture.state.data.offers[0].status = "approved";
    await expect(updateLogisticsShipment(1, { status: "loading" }, owner)).rejects.toMatchObject({ status: 409 });
  });
  it("blocks expired approvals/dispatch and customer acceptance", async () => {
    const offer = await pendingOffer();
    fixture.state.data.offers[0].validUntil = new Date(0);
    await expect(approveLogisticsOffer(offer.id, owner)).rejects.toMatchObject({ status: 409 });
    fixture.state.data.offers[0] = { ...fixture.state.data.offers[0], status: "approved", approvedByClerkUserId: "owner", approvedAt: new Date() };
    await expect(markLogisticsOfferSent(offer.id, owner, { channel: "email", note: "Sent manually" })).rejects.toMatchObject({ status: 409 });
    fixture.state.data.offers[0].status = "sent";
    await expect(decideLogisticsOffer(offer.id, owner, { decision: "accept_customer", note: "Confirmed" })).rejects.toMatchObject({ status: 409 });
  });
  it("allows draft revision but does not let a stale editor alter approved terms", async () => {
    const offer = await pendingOffer();
    const { requestId: _id, ...revision } = draft();
    await saveLogisticsOffer({ ...revision, customerPriceAmount: 3100 }, owner, offer.id);
    expect(fixture.state.data.offers[0].customerPriceAmount).toBe(3100);
    await approveLogisticsOffer(offer.id, owner);
    await expect(saveLogisticsOffer({ ...revision, customerPriceAmount: 3200 }, owner, offer.id)).rejects.toMatchObject({ status: 409 });
    expect(fixture.state.data.offers[0].customerPriceAmount).toBe(3100);
  });
  it("rejects stale founder approval after draft amounts have changed", async () => {
    const offer = await pendingOffer();
    const oldVersion = offer.updatedAt;
    const { requestId: _id, ...revision } = draft();
    await saveLogisticsOffer({ ...revision, customerPriceAmount: 3100 }, owner, offer.id);
    await expect(actualApprove(offer.id, owner, oldVersion)).rejects.toMatchObject({ status: 409 });
    expect(fixture.state.data.offers[0]).toMatchObject({ status: "pending_approval", customerPriceAmount: 3100 });
  });
  it("rejects stale plan updates without losing newer notes", async () => {
    const previous = shipmentVersion();
    await updateLogisticsShipment(1, { status: "planning", internalNote: "New plan" }, owner);
    await expect(actualUpdate(1, { status: "planning", internalNote: "Old screen", expectedUpdatedAt: previous }, owner)).rejects.toMatchObject({ status: 409 });
    expect(fixture.state.data.shipments[0].internalNote).toBe("New plan");
  });
  it("blocks revising another person's draft for a nonfounder", async () => {
    const offer = await pendingOffer();
    const { requestId: _id, ...revision } = draft();
    await expect(saveLogisticsOffer(revision, operator, offer.id)).rejects.toMatchObject({ status: 403 });
  });
  it("rejects real/TEST mixing and an unapproved carrier", async () => {
    await updateLogisticsShipment(1, { status: "planning" }, owner);
    fixture.state.data.carriers[0].status = "pending";
    await expect(saveLogisticsOffer(draft(), owner)).rejects.toMatchObject({ status: 400 });
    fixture.state.data.carriers[0].status = "approved"; fixture.state.data.carriers[0].isTest = true;
    await expect(saveLogisticsOffer(draft(), owner)).rejects.toMatchObject({ status: 400 });
    expect(fixture.state.data.offers).toHaveLength(0);
  });
  it("permits only one accepted offer and records shipment-first locks", async () => {
    const offer = await sentOffer();
    await decideLogisticsOffer(offer.id, owner, { decision: "accept_customer", note: "Customer confirmed" });
    fixture.state.data.offers.push({ ...fixture.state.data.offers[0], id: 2, status: "sent" });
    await expect(decideLogisticsOffer(2, owner, { decision: "accept_customer", note: "Second confirmation" })).rejects.toMatchObject({ status: 409 });
    expect(fixture.state.data.offers.filter(row => row.status === "accepted")).toHaveLength(1);
    expect(fixture.state.locks).toContain("shipments");
    expect(fixture.state.locks).toContain("offers");
  });
  it("rolls back approval and shipment changes if the audit cannot be saved", async () => {
    const offer = await pendingOffer();
    fixture.state.auditFail = true;
    await expect(approveLogisticsOffer(offer.id, owner)).rejects.toThrow("audit unavailable");
    expect(fixture.state.data.offers[0].status).toBe("pending_approval");
    expect(fixture.state.data.shipments[0].status).toBe("quote_approval");
  });
  it("returns to quoting after the founder rejects the last approved offer", async () => {
    const offer = await sentOffer();
    await decideLogisticsOffer(offer.id, owner, { decision: "reject", note: "Terms changed" });
    expect(fixture.state.data.shipments[0].status).toBe("quote_approval");
    expect(fixture.state.data.offers[0].status).toBe("rejected");
  });
  it("allows clearing optional plan fields and refuses impossible dates", async () => {
    await updateLogisticsShipment(1, { status: "planning", plannedLoadingAt: new Date("2026-10-15"), plannedDeliveryAt: new Date("2026-10-16") }, owner);
    await expect(updateLogisticsShipment(1, { status: "planning", plannedDeliveryAt: new Date("2026-10-14") }, owner)).rejects.toMatchObject({ status: 400 });
    await updateLogisticsShipment(1, { status: "planning", plannedLoadingAt: null, plannedDeliveryAt: null, internalNote: "" }, owner);
    expect(fixture.state.data.shipments[0]).toMatchObject({ plannedLoadingAt: null, plannedDeliveryAt: null, internalNote: null });
  });
  it.each([0, -1, 12.001, Infinity, NaN])("rejects invalid offer amount %s", carrierCostAmount => {
    expect(() => validateLogisticsOffer({ ...draft(), carrierCostAmount })).toThrow();
  });
});
