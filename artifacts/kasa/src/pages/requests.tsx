import { useState } from 'react';
import { Link } from 'wouter';
import { getGetKasaRequestsQueryKey, useGetKasaRequests, type GetKasaRequestsParams } from '@workspace/api-client-react';
import { ChevronRight, PlusCircle } from 'lucide-react';
import { EmptyState, ErrorBox, ListSkeleton, PageHeader, StatusBadge, btn, btnSecondary, inputCls, labelCls } from '@/components/kit';
import { useMe } from '@/private/Gate';
import { useBranches } from '@/lib/branches';
import { dateTime, errMsg, money } from '@/lib/format';

export default function RequestsPage() {
  const me = useMe();
  const admin = me.role === 'admin';
  const [branch, setBranch] = useState('');
  const [date, setDate] = useState('');
  const b = useBranches();
  const params: GetKasaRequestsParams | undefined = admin && (branch || date) || (!admin && date)
    ? { ...(admin && branch ? { branchId: Number(branch) } : {}), ...(date ? { date } : {}) }
    : undefined;
  const q = useGetKasaRequests(params, { query: { queryKey: getGetKasaRequestsQueryKey(params), refetchInterval: 30000 } });
  const filtered = !!params;
  return (
    <>
      <title>Talepler | MMT Kasa</title>
      <PageHeader title="Talepler" sub={admin ? 'Tüm şubelerin ödeme talepleri.' : 'Kendi açtığınız ödeme talepleri.'}
        action={<Link href="/requests/new" className={btn} data-testid="link-new-request"><PlusCircle className="h-4 w-4" />Yeni talep</Link>} />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        {admin && (
          <div className="min-w-44">
            <label className={labelCls} htmlFor="f-branch">Şube</label>
            <select id="f-branch" className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="select-filter-branch">
              <option value="">Tüm şubeler</option>
              {(b.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}{x.active ? '' : ' (pasif)'}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="f-date">Tarih</label>
          <input id="f-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-filter-date" />
        </div>
        {filtered && <button className={btnSecondary} onClick={() => { setBranch(''); setDate(''); }} data-testid="button-clear-filters">Filtreleri temizle</button>}
      </div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={filtered ? 'Bu filtrede talep yok' : 'Henüz talep yok'} text={filtered ? 'Farklı bir tarih veya şube deneyin.' : 'İlk ödeme talebini oluşturduğunuzda burada listelenir.'}
          action={!filtered && <Link href="/requests/new" className={btn}>Talep oluştur</Link>} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" data-testid="list-requests">
          {q.data.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 transition hover:bg-secondary/60 md:grid-cols-[1.2fr_1fr_auto_auto_auto]" data-testid={`row-request-${r.id}`}>
                <span className="num text-sm font-semibold">{r.reference}</span>
                <span className="num text-right text-lg font-semibold md:order-3">{money(r.amount, r.currency)}</span>
                <span className="text-xs text-muted-foreground md:order-2">{b.name(r.branchId)} · {dateTime(r.createdAt)}</span>
                <span className="md:order-4"><StatusBadge status={r.status} /></span>
                <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:order-5 md:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
