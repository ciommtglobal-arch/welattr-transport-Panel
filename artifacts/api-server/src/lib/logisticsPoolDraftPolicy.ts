export type LogisticsDraftMode = "disabled" | "test_drafts" | "production_drafts";

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
    return "Üretim taslak izni yapılandırılmış. Ayrı lojistik worker süreci 2 dakikada bir uygun gerçek eşleşmeleri inceleyebilir; bu bilgi worker'ın çalıştığının kanıtı değildir. Telegram gönderimi ve otomatik ticari onay kapalıdır.";
  }
  if (logisticsDraftMode() === "test_drafts") {
    return "Geliştirme/TEST API süreci çalışırken worker 2 dakikada bir mevcut sentetik TEST eşleşmelerini kontrol eder; uygun taslak için Telegram'a gönderilmeyen bir TEST bildirimi kaydeder. Yeni dış fırsat keşfetmez.";
  }
  return "Gemini taslak otomasyonu bu ortamda kapalı. Kuyruktaki kayıtlar canlı gönderim veya ticari onay anlamına gelmez.";
}
