import { describe, it, expect, vi } from "vitest";
import { verifyTelegramMarketAdmin } from "./telegramMarketListener";
describe("Telegram membership verification", () => {
  it("binds membership to the actual expected bot identity", async () => {
    const read = vi.fn().mockResolvedValueOnce({ id: 123, username: "mmt33_bot" })
      .mockResolvedValueOnce({ status: "administrator" });
    expect(await verifyTelegramMarketAdmin(-100123, read)).toBe(true);
    expect(read).toHaveBeenLastCalledWith("getChatMember", { chat_id: "-100123", user_id: "123" });
  });
  it("refuses non-admin membership even with privacy disabled", async () => {
    const read = vi.fn().mockResolvedValueOnce({ id: 123, username: "mmt33_bot", can_read_all_group_messages: true })
      .mockResolvedValueOnce({ status: "member" });
    expect(await verifyTelegramMarketAdmin(-100123, read)).toBe(false);
  });
  it("fails closed for a different bot", async () => {
    const read = vi.fn().mockResolvedValue({ id: 123, username: "other_bot" });
    await expect(verifyTelegramMarketAdmin(-100123, read)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
