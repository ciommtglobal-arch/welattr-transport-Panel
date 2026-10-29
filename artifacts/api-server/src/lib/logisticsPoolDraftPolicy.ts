export type LogisticsDraftMode = "disabled" | "test_drafts" | "production_drafts";
export const PRODUCTION_DRAFT_INTERVAL_MS = 30 * 60_000;
export const MAX_PENDING_BACKGROUND_DRAFTS = 3;

/** A founder click is independent of the background-worker activation switch. */
export function manualLogisticsDraftEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = Boolean(env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim() && env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim());
  return configured && (
    (["development", "test"].includes(env.NODE_ENV ?? "") && !env.REPLIT_DEPLOYMENT) ||
    (env.NODE_ENV === "production" && Boolean(env.REPLIT_DEPLOYMENT))
  );
}

/** Candidate eligibility is not carrier verification or commercial approval. */
export function permittedCarrierCandidate(record: {
  status: string; isTest: boolean; contactUseConfirmed: boolean; capturedByClerkUserId: string | null;
}): boolean {
  return permittedInternalLogisticsRecord(record) &&
    (record.status === "approved" || record.status === "pending");
}

/** TEST fixtures stay isolated; real internal records require attributable consent. */
export function permittedInternalLogisticsRecord(record: {
  isTest: boolean; contactUseConfirmed: boolean; capturedByClerkUserId: string | null;
}): boolean {
  return record.isTest || (record.contactUseConfirmed && Boolean(record.capturedByClerkUserId?.trim()));
}

/** Production activation is explicit; neither mode can send messages or approve. */
export function logisticsDraftMode(env: NodeJS.ProcessEnv = process.env): LogisticsDraftMode {
  if (!env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim() || !env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim()) return "disabled";
  if (["development", "test"].includes(env.NODE_ENV ?? "") && !env.REPLIT_DEPLOYMENT) return "test_drafts";
  if (env.NODE_ENV === "production" && env.REPLIT_DEPLOYMENT &&
      env.MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED === "true") return "production_drafts";
  return "disabled";
}

export function logisticsDraftScheduleDescription(): string {
  if (logisticsDraftMode() === "production_drafts") {
    return "Üretim taslak izni yapılandırılmış. Ayrı worker 30 dakikada bir uygun gerçek eşleşmeleri inceleyebilir; 3 güncel taslak inceleme beklerken arka plan üretimi durur. Bu bilgi worker'ın çalıştığının kanıtı değildir. Telegram gönderimi ve otomatik ticari onay kapalıdır.";
  }
  if (logisticsDraftMode() === "test_drafts") {
    if (process.env.MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED !== "true") {
      return "Arka plan TEST worker'ı kapalı; yalnız yetkili kullanıcının açıkça başlattığı manuel taslak hazırlanabilir. Dış bildirim ve otomatik ticari karar yoktur.";
    }
    return "Geliştirme/TEST API süreci çalışırken worker 2 dakikada bir mevcut sentetik TEST eşleşmelerini kontrol eder; uygun taslak için Telegram'a gönderilmeyen bir TEST bildirimi kaydeder. Yeni dış fırsat keşfetmez.";
  }
  return "Gemini taslak otomasyonu bu ortamda kapalı. Kuyruktaki kayıtlar canlı gönderim veya ticari onay anlamına gelmez.";
}
