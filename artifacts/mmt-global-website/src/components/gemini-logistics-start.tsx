import { useMemo, useState } from "react";
import { Link } from "wouter";
import { getGetLogisticsPoolQueryKey, useGetLogisticsPool } from "@workspace/api-client-react";
import { btnGhost, btnPrimary } from "@/components/logistics-ops/shared";
import { prepareGeminiLogisticsInstruction, summarizeGeminiLogistics } from "@/lib/gemini-logistics";

export function GeminiLogisticsStart({ userId, busy, onPrepare }: {
  userId: string; busy: boolean; onPrepare: (instruction: string) => void;
}) {
  const queryKey = useMemo(() => [...getGetLogisticsPoolQueryKey(), userId], [userId]);
  const pool = useGetLogisticsPool({
    query: { queryKey, staleTime: 15_000, retry: false, refetchOnWindowFocus: true },
  });
  const summary = pool.data ? summarizeGeminiLogistics(pool.data) : null;
  const [notice, setNotice] = useState("");
  const unavailable = pool.isPending || pool.isError || pool.isFetching || !summary;
  function prepare(purpose: "plan" | "checks") {
    if (unavailable || busy || !summary) return;
    if (Date.now() - pool.dataUpdatedAt > 60_000) {
      setNotice("Özet bir dakikadan eski; önce yenileniyor. Yenilendikten sonra plan veya kontrol düğmesine tekrar basın.");
      void pool.refetch();
      return;
    }
    setNotice("");
    onPrepare(prepareGeminiLogisticsInstruction(summary, new Date(pool.dataUpdatedAt).toISOString(), purpose));
  }
  return (
    <section className="mt-5 border border-border bg-card p-4" aria-labelledby="logistics-start-title" data-testid="gemini-logistics-start">
      <h2 id="logistics-start-title" className="font-semibold">Lojistik çalışma başlangıcı</h2>
      <p className="mt-1 text-xs leading-5 text-foreground/60">Mevcut havuzun salt okunur özeti; API'nin döndürdüğü kayıtlarla sınırlıdır. Bu alan açılınca tarama, kayıt değişikliği veya Gemini çağrısı yapılmaz.</p>
      {pool.isPending ? <p className="mt-3 text-sm" role="status">Havuz özeti yükleniyor…</p>
        : pool.isError ? <p className="mt-3 text-sm text-red-300" role="alert">Havuz doğrulanamadı; bunu sıfır kayıt olarak göstermiyoruz. Yenileyin veya mevcut havuz ekranına geçin.</p>
        : summary ? <>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {([["Aktif yük", summary.loads], ["Aktif taşıyıcı", summary.carriers], ["Alıcı / satıcı", `${summary.buyers} / ${summary.sellers}`], ["İnceleme bekleyen", summary.pending]] as const).map(([label, value]) =>
              <div key={label}><dt className="text-xs text-foreground/60">{label}</dt><dd className="mt-1 font-mono text-lg">{value}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs leading-5 text-foreground/60">Yalnız TEST dışı aktif ve uygun kayıtlar sayılır; bilgi doğruluğu garanti edilmez. Doğrulanmamış: {summary.unverified}. Ayrı TEST kaydı: {summary.testRecords}. Tarafları eksik eşleşme: {summary.incompleteMatches}. Hatalı kaynak: {summary.sourceErrors}.</p>
          <p className="mt-2 text-xs leading-5 text-foreground/60">{summary.externalDiscoveryConfigured ? "Etkin dış kaynak yapılandırması var; başarılı veri toplandığını tek başına kanıtlamaz." : "Dış kaynak bağlı değil; sistemin internetten yeni müşteri bulduğu varsayılmaz."} Son özet: {new Date(pool.dataUpdatedAt).toLocaleString("tr-TR")}.</p>
          <p className="mt-2 text-xs leading-5 text-foreground/60">Mevcut zamanlama: {pool.data?.automaticSchedule}</p>
        </> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={unavailable || busy} onClick={() => prepare("plan")} data-testid="button-logistics-plan">Günlük planı talimata ekle</button>
        <button type="button" className={btnGhost} disabled={unavailable || busy} onClick={() => prepare("checks")} data-testid="button-logistics-checks">Eksik kontrolünü talimata ekle</button>
        <button type="button" className={btnGhost} disabled={pool.isFetching} onClick={() => void pool.refetch()} data-testid="button-logistics-summary-refresh">{pool.isFetching ? "Yenileniyor…" : "Özeti yenile"}</button>
      </div>
      {notice ? <p className="mt-2 text-xs text-foreground/60" role="status">{notice}</p> : null}
      <nav className="mt-3 flex flex-wrap gap-4 text-xs text-primary" aria-label="Lojistik çalışma bağlantıları">
        <Link href="/staff/lojistik-havuzu" className="underline">Havuz, saha kaydı ve eşleştirme</Link>
        <Link href="/staff/lojistik-operasyon" className="underline">Dosya, görev ve operasyon takibi</Link>
      </nav>
      <p className="mt-3 text-xs leading-5 text-foreground/60">Düğmeler yalnız talimat kutusuna metin ekler; mevcut yazınız silinmez. Kontrol edip Gönder dediğinizde Gemini yanıt hazırlar. İletişim bilgileri ve kayıt içerikleri bu özete eklenmez.</p>
    </section>
  );
}
