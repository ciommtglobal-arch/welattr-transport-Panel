import React from "react";
import type { LogisticsPoolWorkspace } from "@workspace/api-client-react";

export function LogisticsEvidenceTable({ data }: { data: LogisticsPoolWorkspace }) {
  const real = data.entries.filter(e => !e.isTest);
  const byId = new Map(data.entries.map(e => [e.id, e]));
  const realDrafts = data.matches.filter(m => m.status === "pending" && m.aiDraft?.saved &&
    m.entryIds.length === 2 && m.entryIds.every(id => byId.has(id) && !byId.get(id)!.isTest));
  const rows = [
    ["Çalışan süreç kanıtı", data.automaticSchedule],
    ["İzinli iç kaynak", "Mevcut MMT yük ve taşıyıcı başvuruları kullanılır. Gerçek kayıtta kullanım teyidi ve kaydeden yetkili bilgisi zorunludur."],
    ["Gerçek yük / taşıyıcı", `${real.filter(e => e.role === "load" && e.active && e.eligible).length} yük / ${real.filter(e => e.role === "carrier" && e.active && e.eligible).length} taşıyıcı. Kayıt sayısı, müsaitlik veya evrak doğrulaması değildir.`],
    ["Etkin dış kaynak", `${data.sources.filter(s => s.enabled).length}; sağlıklı ve güncel kaynak: ${data.sources.filter(s => s.enabled && !s.lastError && s.lastSuccessAt && Date.now() - Date.parse(s.lastSuccessAt) < 900_000).length}. Genel internet taraması yapılmaz.`],
    ["Gerçek kurucu taslağı", `${realDrafts.length} inceleme bekleyen taslak. TEST taslakları bu sayıya dahil değildir.`],
    ["Son gerçek taslak zamanı", realDrafts.map(m => m.aiDraft!.generatedAt).sort().at(-1) ?? "Henüz gerçek taslak kanıtı yok."],
    ["Karar ve dış işlem", "Gemini taslak üretir. Otomatik ticari onay, ödeme ve worker Telegram gönderimi yoktur."],
  ];
  return (
    <section className="mt-5 border border-border bg-card/60 p-4" data-testid="logistics-evidence-table">
      <h2 className="text-lg font-semibold">Lojistik kanıt tablosu</h2>
      <p className="mt-1 text-xs text-foreground/55">Bu ortamın son sunucu yanıtıdır; önizleme, üretimin veya kesintisiz çalışmanın kanıtı değildir.</p>
      <table className="mt-3 w-full table-fixed text-left text-xs">
        <caption className="sr-only">Kaynak, süreç ve kurucu kuyruğu kanıtları</caption>
        <tbody>{rows.map(([label, value]) => (
          <tr key={label} className="border-t border-border">
            <th scope="row" className="w-1/3 break-words py-3 pr-3 align-top font-semibold">{label}</th>
            <td className="break-words py-3 align-top leading-6 text-foreground/65">{value}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}
