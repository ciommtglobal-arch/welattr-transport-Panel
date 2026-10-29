import express from "express";
import request from "supertest";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn(), ingest: vi.fn() }));
vi.mock("@workspace/db", () => ({
  db: { select: mocks.select }, logisticsPoolSourcesTable: { id: "id" },
}));
vi.mock("../lib/logisticsPool", () => ({ ingestTelegramMarketItem: mocks.ingest }));
import router from "./market-ingestion";
const id = "11111111-1111-4111-8111-111111111111";
const key = `MMT_MARKET_TELEGRAM_SECRET_${id.replaceAll("-", "_")}`;
const secret = "test-only-secret-not-production-value";
const app = express();
app.use(express.json(), (_req, res, next) => { next(); }, router);
const path = `/logistics/market/telegram/${id}`;
const update = () => ({ update_id: 1, message: {
  message_id: 7, date: Math.floor(Date.now()/1000),
  chat: { id: -100123, type: "supergroup" },
  text: JSON.stringify({ role: "carrier", name: "Consented carrier", origin: "Mersin",
    destination: "Adana", transportMode: "road", capacityKg: 24000, availableDate: "2026-12-01" }),
} });
describe("market webhook", () => {
  beforeEach(() => {
    vi.stubEnv(key, secret);
    mocks.select.mockReturnValue({ from: () => ({ where: async () => [{
      id, url: "telegram://group/-100123", enabled: true, consentBy: "founder", consentAt: new Date(),
    }] }) });
    mocks.ingest.mockReset().mockResolvedValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects unauthenticated requests without writing", async () => {
    expect((await request(app).post(path).send(update())).status).toBe(401);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("rejects another group", async () => {
    const body = update(); body.message.chat.id = -999;
    expect((await request(app).post(path).set("X-Telegram-Bot-Api-Secret-Token", secret).send(body)).status).toBe(403);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("ignores free text without claiming ingestion", async () => {
    const body = update(); body.message.text = "Find me a truck";
    const res = await request(app).post(path).set("X-Telegram-Bot-Api-Secret-Token", secret).send(body);
    expect(res.body.reason).toBe("structured_json_required");
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("passes validated data and reports duplicates distinctly", async () => {
    const post = () => request(app).post(path).set("X-Telegram-Bot-Api-Secret-Token", secret).send(update());
    expect((await post()).body).toEqual({ status: "accepted", messagesSent: false });
    expect(mocks.ingest.mock.calls[0][2]).toMatchObject({ role: "carrier", id: "7", isTest: false });
    mocks.ingest.mockResolvedValue(false);
    expect((await post()).body.status).toBe("duplicate");
  });
});
