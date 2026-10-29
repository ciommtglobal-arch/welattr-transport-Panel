import type { LogisticsPoolEntry, LogisticsPoolMatch, LogisticsPoolWorkspace } from "@workspace/api-client-react";

type PoolSummaryInput = {
  entries: Pick<LogisticsPoolEntry, "id" | "role" | "isTest" | "active" | "eligible" | "verified">[];
  matches: Pick<LogisticsPoolMatch, "entryIds" | "status">[];
  sources: Pick<LogisticsPoolWorkspace["sources"][number], "lastError">[];
  externalDiscoveryConfigured: boolean;
};

export function summarizeGeminiLogistics(pool: PoolSummaryInput) {
  const entries = new Map(pool.entries.map((entry) => [entry.id, entry]));
  const active = pool.entries.filter((entry) => !entry.isTest && entry.active && entry.eligible);
  const counts = (role: LogisticsPoolEntry["role"]) => active.filter((entry) => entry.role === role).length;
  const pending = pool.matches.filter((match) => match.status === "pending");
  return {
    loads: counts("load"), carriers: counts("carrier"),
    buyers: counts("buyer"), sellers: counts("seller"),
    unverified: active.filter((entry) => !entry.verified).length,
    testRecords: pool.entries.filter((entry) => entry.isTest).length,
    pending: pending.filter((match) => match.entryIds.length >= 2 &&
      match.entryIds.every((id) => {
        const entry = entries.get(id);
        return entry && !entry.isTest && entry.active && entry.eligible;
      })).length,
    incompleteMatches: pending.filter((match) => match.entryIds.length < 2 ||
      match.entryIds.some((id) => !entries.has(id))).length,
    sourceErrors: pool.sources.filter((source) => Boolean(source.lastError)).length,
    externalDiscoveryConfigured: pool.externalDiscoveryConfigured,
  };
}

export function prepareGeminiLogisticsInstruction(
  summary: ReturnType<typeof summarizeGeminiLogistics>,
  capturedAt: string,
  purpose: "plan" | "checks",
) {
  return [
    "MMT LOJİSTİK — panelden alınmış sayısal durum özeti (kişisel veri içermez).",
    `Özet zamanı: ${capturedAt}. Bu anlık görüntüdür; geçmiş mesajlardaki sayıları güncel sayma.`,
    `TEST dışı aktif/uygun kayıtlar: yük=${summary.loads}, taşıyıcı=${summary.carriers}, alıcı=${summary.buyers}, satıcı=${summary.sellers}.`,
    `Doğrulanmamış aktif kayıt=${summary.unverified}; inceleme bekleyen uygun TEST dışı eşleşme=${summary.pending}.`,
    `Ayrı tutulan TEST kayıtları=${summary.testRecords}; tarafları eksik eşleşme=${summary.incompleteMatches}; hatalı kaynak=${summary.sourceErrors}.`,
    `Etkin dış kaynak yapılandırması=${summary.externalDiscoveryConfigured ? "var (yeni müşteri bulunduğunun kanıtı değildir)" : "yok"}.`,
    purpose === "plan"
      ? "Mersin merkezli lojistik komisyonculuğu için bu sayılara göre bugünkü en fazla üç somut işi öner. Her işte benden gerekeni ve senin yanıt içinde hazırlayabileceğin taslağı ayır."
      : "Bu özete göre işe başlama engellerini ve kurucu incelemesinden önce kontrol edilmesi gerekenleri sırala. Eksik taraf varsa yük/taşıyıcı başvurusu toplamak için kişisel veri içermeyen bir davet metni taslağı hazırla.",
    "Yalnız öneri ve taslak üret. Kayıt açtım, müşteri buldum, eşleştirdim, mesaj gönderdim, ödeme yaptım veya operasyon başlattım deme. Onay ve yayın ayrı kurucu kararlarıdır.",
  ].join("\n");
}
