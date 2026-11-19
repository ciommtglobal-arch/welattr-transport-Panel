import { GoogleGenAI } from "@google/genai";
import { Router, type IRouter } from "express";
import { requireLogisticsFounder } from "../lib/logisticsWorkflowAuth";
import {
  createSingleCheckHandler,
  createSingleCheckLock,
  type FailureKind,
  type MaskedErrorResponse,
} from "../lib/geminiSingleCheckLock.js";

const router: IRouter = Router();
const checkLock = createSingleCheckLock();

function safeText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/((?:api[_-]?key|authorization|bearer|token|password|secret)\\s*[:=]\\s*)[^,\\s"'&]+/gi, "$1[REDACTED]")
    .replace(/([?&][^=\\s&]+)=([^&\\s]+)/g, "$1=[REDACTED]")
    .replace(/(https?:\\/\\/[^\\s?#]+)\\?[^\\s#]*/gi, "$1?[REDACTED]")
    .slice(0, 200);
}

function classifyProviderError(error: unknown): FailureKind {
  if (!error || typeof error !== "object") return "transient";
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  const status = Number(value.status ?? value.statusCode ?? value.code);
  if ([400, 401, 403, 404].includes(status)) return "config";
  const code = String(value.status ?? value.code ?? "").toUpperCase();
  if (["INVALID_ARGUMENT", "PERMISSION_DENIED", "UNAUTHENTICATED", "NOT_FOUND"].includes(code)) {
    return "config";
  }
  return "transient";
}

function maskProviderError(error: unknown): MaskedErrorResponse {
  const value = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };
  const diagnostic = {
    ...(safeText(value?.name) ? { name: safeText(value.name) } : {}),
    message: safeText(value?.message) ?? "Gemini sağlayıcı isteği başarısız.",
    ...(typeof (value?.status ?? value?.statusCode) === "number"
      || typeof (value?.status ?? value?.statusCode) === "string"
      ? { status: safeText(value.status ?? value.statusCode) } : {}),
    ...(typeof value?.code === "number" || typeof value?.code === "string"
      ? { code: safeText(value.code) } : {}),
  };
  return {
    statusCode: 502,
    body: {
      success: false,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
      error: diagnostic,
    },
  };
}

// Express otherwise treats HEAD as GET; authorize first and never spend a provider request.
router.head("/gemini/provider-check", (req, res): void => {
  res.set("Cache-Control", "no-store");
  if (!requireLogisticsFounder(req, res)) return;
  res.setHeader("Allow", "GET");
  res.status(405).end();
});

router.get("/gemini/provider-check", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!requireLogisticsFounder(req, res)) return;

  if (process.env.NODE_ENV !== "production"
      || process.env.GEMINI_PROVIDER_CHECK_ENABLED !== "true"
      || process.env.GEMINI_FREE_TIER_ONLY_CONFIRMED !== "true") {
    res.status(404).json({ error: "Gemini bağlantı kontrolü kapalı." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
    || process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "Sunucuda Gemini API anahtarı yapılandırılmamış." });
    return;
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const handleCheck = createSingleCheckHandler({
    lock: checkLock,
    classifyError: classifyProviderError,
    maskError: (error, kind) => {
      const masked = maskProviderError(error);
      req.log?.warn(
        { model, kind, error: masked.body.error },
        "Gemini tek seferlik sağlayıcı kontrolü başarısız; hassas alanlar filtrelendi.",
      );
      return masked;
    },
    runGeminiCheck: async () => {
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
      return { model, reply };
    },
    successResponse: ({ model: resultModel, reply }) => ({
      success: true,
      model: resultModel,
      reply,
    }),
  });

  await handleCheck(req, res);
});

router.all("/gemini/provider-check", (req, res, next): void => {
  // Leave CORS preflight handling to the application CORS middleware.
  if (req.method.toUpperCase() === "OPTIONS") {
    next();
    return;
  }

  if (!requireLogisticsFounder(req, res)) return;
  res.set("Cache-Control", "no-store");
  res.setHeader("Allow", "GET");
  res.status(405).end();
});

export default router;
