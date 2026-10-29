import { ReplitConnectors } from "@replit/connectors-sdk";
import { z } from "zod/v4";

const botIdentity = z.object({ id: z.number().int(), username: z.literal("mmt33_bot") });
const membership = z.object({ status: z.string() });
export type TelegramReader = (method: string, params?: Record<string, string>) => Promise<unknown>;
export const readTelegram: TelegramReader = async (method, params = {}) => {
  const connectors = new ReplitConnectors();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    // This SDK does not accept AbortSignal; bound the handler wait. The losing
    // read-only request may complete later, but cannot write or enroll a source.
    return await Promise.race([
      (async () => {
        const response = await connectors.proxy("telegram", `/${method}?${new URLSearchParams(params)}`, { method: "GET" });
        if (!response.ok) throw new Error("Telegram read unavailable");
        return z.object({ ok: z.literal(true), result: z.unknown() }).parse(await response.json()).result;
      })(),
      new Promise<never>((_resolve, reject) => { deadline = setTimeout(() => reject(new Error("Telegram read timeout")), 8000); }),
    ]);
  } finally { clearTimeout(deadline); }
};
/** Check on every accepted message; removing admin rights stops intake. Never mutate Telegram. */
export async function verifyTelegramMarketAdmin(chatId: number, read = readTelegram): Promise<boolean> {
  const bot = botIdentity.parse(await read("getMe"));
  const member = membership.parse(await read("getChatMember", { chat_id: String(chatId), user_id: String(bot.id) }));
  return member.status === "administrator" || member.status === "creator";
}
