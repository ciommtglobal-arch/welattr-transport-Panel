/**
 * One-request Gemini connectivity check.
 * Calls only the selected Gemini model: no database, queue, or operational context.
 * Requires explicit free-tier confirmation and never prints credentials/provider errors.
 */
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

if (process.env.GEMINI_FREE_TIER_ONLY_CONFIRMED !== "true") {
  console.error(JSON.stringify({ success: false, error: "Set GEMINI_FREE_TIER_ONLY_CONFIRMED=true after confirming the provider project is on the free tier." }));
  process.exitCode = 1;
} else if (!apiKey) {
  console.error(JSON.stringify({ success: false, error: "GEMINI_API_KEY is missing." }));
  process.exitCode = 1;
} else {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(baseUrl ? { baseUrl, apiVersion: "" } : {}),
      timeout: 45_000,
    },
  });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: "Reply with exactly: MMT-GEMINI-PING-OK",
      config: { maxOutputTokens: 24, temperature: 0 },
    });
    const reply = response.text?.trim();
    if (!reply) throw new Error("Empty model response");
    console.log(JSON.stringify({ success: true, model, reply }));
  } catch {
    console.error(JSON.stringify({ success: false, model, error: "Gemini ping failed; provider details were suppressed." }));
    process.exitCode = 1;
  }
}
