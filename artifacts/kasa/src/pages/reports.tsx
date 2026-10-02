import { useState } from 'react';
import { getGetKasaSummaryQueryKey, useGetKasaSummary, type GetKasaSummaryParams } from '@workspace/api-client-react';
import { EmptyState, ErrorBox, Notice, PageHeader, Skeleton, btnSecondary, inputCls, labelCls } from '@/components/kit';
import { useBranches } from '@/lib/branches';
import { errMsg, money, validReportDate } from '@/lib/format';

export default function ReportsPage() {
  const [branch, setBranch] = useState('');
  const [date, setDate] = useState('');
  const b = useBranches();
  const params: GetKasaSummaryParams | undefined = branch || date
    ? { ...(branch ? { branchId: Number(branch) } : {}), ...(date ? { date } : {}) }
    : undefined;
  const dateValid = validReportDate(date);
  const q = useGetKasaSummary(params, { query: { queryKey: getGetKasaSummaryQueryKey(params), refetchInterval: 60000, enabled: dateValid } });
  const s = q.data;
  return (
    <>
      <title>Raporlar | MMT Kasa</title>
      <PageHeader title="Gelir özeti" sub="Gelir yalnızca tahsil edildi durumundaki taleplerden gelir; para birimleri ayrı gösterilir ve birbirine eklenmez." />
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Notice tone="warn"><b>Mali Z raporu değildir.</b> Bu özet resmi bir kapanış belgesi yerine geçmez.</Notice>
        <Notice tone="warn"><b>Kasa bakiyesi değildir.</b> Kasadaki nakit veya hesap bakiyesi bu ekranda hesaplanmaz.</Notice>
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-44"><label className={labelCls} htmlFor="rb">Şube</label>
          <select id="rb" className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="select-report-branch">
            <option value="">Tüm şubeler</option>
            {(b.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.active ? '' : ' (pasif)'}</option>)}
          </select></div>
        <div><label className={labelCls} htmlFor="rd">Gün</label><input id="rd" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-report-date" /></div>
        {params && <button className={btnSecondary} onClick={() => { setBranch(''); setDate(''); }} data-testid="button-clear-report-filters">Temizle</button>}
      </div>
      {!dateValid ? <ErrorBox message="2000 yılı veya sonrasında geçerli bir gün seçin." /> : q.isLoading ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : q.isError ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />
        : !s?.totals.length ? <EmptyState title="Bu seçimde kayıt yok" text="Seçilen şube ve günde talep bulunmuyor. Filtreleri değiştirerek tekrar bakın." />
        : (
        <>
          <div className="grid gap-4 md:grid-cols-2" data-testid="report-totals">
            {s.totals.map((t) => (
              <div key={t.currency} className="rise rounded-lg border border-border bg-card p-5" data-testid={`card-total-${t.currency}`}>
                <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{t.currency}</h3><span className="text-xs text-muted-foreground">{t.completedCount} tahsil · {t.pendingCount} bekleyen</span></div>
                <div className="mt-4 text-xs font-bold uppercase tracking-wider text-paid">Gelir (tahsil edilen)</div>
                <div className="num text-3xl font-semibold text-paid" data-testid={`text-revenue-${t.currency}`}>{money(t.revenue, t.currency)}</div>
                <div className="mt-4 border-t border-dashed border-input pt-3 text-xs font-bold uppercase tracking-wider text-pending">Bekleyen (gelir değil)</div>
                <div className="num text-xl font-semibold text-pending" data-testid={`text-pending-${t.currency}`}>{money(t.pendingAmount, t.currency)}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Saat dilimi: {s.timezone}. {params ? `Filtre: ${branch ? b.name(Number(branch)) : 'tüm şubeler'}${date ? `, ${date}` : ', tüm günler'}.` : 'Filtre yok: tüm şubeler ve günler.'} Canlı ödeme kapalıdır.
          </p>
        </>)}
    </>
  );
}
