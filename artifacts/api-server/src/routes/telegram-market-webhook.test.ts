import express from "express";
import request from "supertest";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), enroll: vi.fn(), process: vi.fn() }));
vi.mock("../lib/telegramMarketListener", () => ({ verifyTelegramMarketAdmin: mocks.verify }));
vi.mock("../lib/logisticsPool", () => ({ enrollTelegramMarketSource: mocks.enroll }));
vi.mock("../lib/marketFeedService", () => ({ processMarketFeedText: mocks.process }));
import router from "./telegram-market-webhook";
const app = express();
app.use(express.json(), (req, _res, next) => { req.log = { warn: vi.fn() } as any; next(); }, router);
const secret = "synthetic-test-secret-not-a-live-token";
const message = () => ({ update_id: 1, message: { message_id: 5, date: Math.floor(Date.now()/1000),
  chat: { id: -100123, type: "supergroup" }, text: "Yük var" } });
const post = (body = message()) => request(app).post("/telegram/webhook")
  .set("X-Telegram-Bot-Api-Secret-Token", secret).send(body);
describe("auto Telegram market intake", () => {
  beforeEach(() => {
    vi.stubEnv("MMT_TELEGRAM_WEBHOOK_SECRET", secret);
    vi.clearAllMocks();
    mocks.verify.mockResolvedValue(true);
    mocks.enroll.mockResolvedValue({ id: "source-1", enabled: true });
    mocks.process.mockResolvedValue({ status: "needs_review", messagesSent: false });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requires secret before API calls or writes", async () => {
    expect((await request(app).post("/telegram/webhook").send(message())).status).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("ignores private chats and old messages", async () => {
    const privateMessage = message(); privateMessage.message.chat.type = "private";
    expect((await post(privateMessage)).body.reason).toBe("group_text_required");
    const old = message(); old.message.date = 1;
    expect((await post(old)).body.reason).toBe("invalid_or_stale_message");
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("requires live admin proof and never enrolls a non-admin group", async () => {
    mocks.verify.mockResolvedValue(false);
    expect((await post()).body.reason).toBe("bot_admin_required");
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("discovers group ID and calls shared ingestion internally", async () => {
    expect((await post()).body.status).toBe("needs_review");
    expect(mocks.verify).toHaveBeenCalledWith(-100123);
    expect(mocks.enroll).toHaveBeenCalledWith(-100123);
    expect(mocks.process).toHaveBeenCalledWith({ id: "source-1", enabled: true }, "5", "Yük var", expect.any(Date));
  });
  it("does not reactivate a disabled source", async () => {
    mocks.enroll.mockResolvedValue({ id: "source-1", enabled: false });
    expect((await post()).body.reason).toBe("source_disabled");
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("returns retriable failure without pretending to accept data", async () => {
    mocks.verify.mockRejectedValue(new Error("provider unavailable"));
    expect((await post()).status).toBe(503);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
});
