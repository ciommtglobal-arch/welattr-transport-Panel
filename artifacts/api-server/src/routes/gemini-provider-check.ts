import { GoogleGenAI } from "@google/genai";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
let checkState: "unused" | "running" | "finished" = "unused";

function safeText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/((?:api[_-]?key|authorization|bearer|token|password|secret)\s*[:=]\s*)[^,\s"'&]+/gi, "$1[REDACTED]")
    .replace(/([?&][^=\s&]+)=([^&\s]+)/g, "$1=[REDACTED]")
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s#]*/gi, "$1?[REDACTED]")
    .slice(0, 200);
}

// Express otherwise treats HEAD as GET and would trigger the one-shot provider call
// when a browser, proxy, or monitor probes this URL.
router.head("/gemini/provider-check", (_req, res): void => {
  res.set("Cache-Control", "no-store");
  res.set("Allow", "GET");
  res.status(405).end();
});

router.get("/gemini/provider-check", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (process.env.NODE_ENV !== "production"
      || process.env.GEMINI_PROVIDER_CHECK_ENABLED !== "true"
      || process.env.GEMINI_FREE_TIER_ONLY_CONFIRMED !== "true") {
    res.status(404).json({ error: "Gemini bağlantı kontrolü kapalı." });
    return;
  }
  if (checkState !== "unused") {
    res.status(409).json({ error: "Bu dağıtımda tek bağlantı kontrolü zaten başladı. Yeni istek gönderilmedi." });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim()
    || process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "Sunucuda Gemini API anahtarı yapılandırılmamış." });
    return;
  }
  checkState = "running";
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  try {
    const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        ...(baseUrl ? { baseUrl, apiVersion: "" } : {}),
        timeout: 45_000,
      },
    });
    const result = await ai.models.generateContent({
      model,
      contents: "Reply with exactly: MMT-GEMINI-PING-OK",
      config: { maxOutputTokens: 24, temperature: 0 },
    });
    const reply = result.text?.trim();
    if (!reply) throw new Error("Empty model response");
    req.log?.info({ model }, "Gemini tek seferlik sağlayıcı kontrolü başarılı.");
    res.json({ success: true, model, reply });
  } catch (error: unknown) {
    const value = error as { name?: unknown; message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown };
    const diagnostic = {
      ...(safeText(value?.name) ? { name: safeText(value.name) } : {}),
      message: safeText(value?.message) ?? "Gemini sağlayıcı isteği başarısız.",
      ...(typeof (value?.status ?? value?.statusCode) === "number" || typeof (value?.status ?? value?.statusCode) === "string"
        ? { status: safeText(value.status ?? value.statusCode) } : {}),
      ...(typeof value?.code === "number" || typeof value?.code === "string"
        ? { code: safeText(value.code) } : {}),
    };
    req.log?.warn({ model, diagnostic }, "Gemini tek seferlik sağlayıcı kontrolü başarısız; hassas alanlar filtrelendi.");
    res.status(502).json({ success: false, model, error: diagnostic });
  } finally {
    checkState = "finished";
  }
});

export default router;
