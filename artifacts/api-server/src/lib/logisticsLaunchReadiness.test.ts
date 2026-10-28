import { describe, expect, it, vi } from "vitest";
import { probeLogisticsTelegram } from "./logisticsLaunchReadiness";

const env = { TELEGRAM_BOT_TOKEN: "123:TEST-PLACEHOLDER" };
const reply = (result: object) => new Response(JSON.stringify({ ok: true, result }));
describe("Telegram readiness is strictly read-only", () => {
  it("does not call Telegram without configuration", async () => {
    const send = vi.fn();
    expect((await probeLogisticsTelegram(send, {})).bot).toBe("not_configured");
    expect(send).not.toHaveBeenCalled();
  });
  it("checks bot identity, never sends a message", async () => {
    const send = vi.fn().mockResolvedValue(reply({ id: 123, username: "MMTGlobalLogistics_Bot" }));
    const result = await probeLogisticsTelegram(send, env);
    expect(result).toMatchObject({ bot: "verified_bot", privateChat: "not_configured", sendingEnabled: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(String(send.mock.calls[0]![0])).toMatch(/\/getMe$/);
  });
  it("does not probe a recipient through the wrong bot", async () => {
    const send = vi.fn().mockResolvedValue(reply({ id: 123, username: "DifferentTESTBot" }));
    expect((await probeLogisticsTelegram(send, { ...env, FOUNDER_CHAT_ID: "456" })).bot).toBe("wrong_bot");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not confuse private-chat reachability with founder ownership", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(reply({ id: 123, username: "MMTGlobalLogistics_Bot" }))
      .mockResolvedValueOnce(reply({ id: 456, type: "private", first_name: "NOT-TO-BE-RETURNED" }));
    const result = await probeLogisticsTelegram(send, { ...env, FOUNDER_CHAT_ID: "456" });
    expect(result.privateChat).toBe("reachable_unbound");
    expect(send.mock.calls.map((call) => new URL(String(call[0])).pathname.split("/").at(-1)))
      .toEqual(["getMe", "getChat"]);
    expect(JSON.stringify(result)).not.toContain("NOT-TO-BE-RETURNED");
  });
  it("rejects a group as the founder's private destination", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(reply({ id: 123, username: "MMTGlobalLogistics_Bot" }))
      .mockResolvedValueOnce(reply({ id: -456, type: "supergroup" }));
    expect((await probeLogisticsTelegram(send, { ...env, FOUNDER_CHAT_ID: "-456" })).privateChat).toBe("not_private");
  });
  it("does not expose secret-bearing provider exceptions", async () => {
    const send = vi.fn().mockRejectedValue(new Error(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`));
    const result = await probeLogisticsTelegram(send, env);
    expect(result.bot).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain(env.TELEGRAM_BOT_TOKEN);
  });
});
