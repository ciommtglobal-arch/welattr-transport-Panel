import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetKasaRequestsQueryKey, getGetKasaSummaryQueryKey, useCreateKasaRequest, type KasaRequestInputCurrency } from '@workspace/api-client-react';
import { ErrorBox, Notice, PageHeader, Skeleton, btn, inputCls, labelCls } from '@/components/kit';
import { useMe } from '@/private/Gate';
import { useBranches } from '@/lib/branches';
import { errMsg, normalizeAmountInput, validAmount } from '@/lib/format';

export default function NewRequestPage() {
  const me = useMe();
  const admin = me.role === 'admin';
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const b = useBranches();
  const create = useCreateKasaRequest();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<KasaRequestInputCurrency>('TRY');
  const [branch, setBranch] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  const active = (b.data ?? []).filter((x) => x.active);
  const cashierBranchId = me.branchId;
  const cashierBranchOk = !!cashierBranchId && active.some((x) => x.id === cashierBranchId);
  const branchId = admin ? Number(branch) : (cashierBranchId ?? 0);
  const amt = normalizeAmountInput(amount);
  const amtOk = validAmount(amt);

  if (b.isError)
    return <><PageHeader title="Yeni talep" /><ErrorBox message={errMsg(b.error)} onRetry={() => b.refetch()} /></>;
  if (!admin && !cashierBranchId)
    return <><PageHeader title="Yeni talep" /><Notice tone="warn">Hesabınıza aktif bir şube atanmamış. Yöneticinizden şube ataması isteyin.</Notice></>;
  if (!admin && !b.isLoading && !cashierBranchOk)
    return <><PageHeader title="Yeni talep" /><Notice tone="warn">Atandığınız şube pasif. Yöneticinizden aktif bir şube ataması isteyin.</Notice></>;
  if (admin && !b.isLoading && !b.isError && active.length === 0)
    return <><PageHeader title="Yeni talep" /><Notice tone="warn">Aktif şube yok. Talep açmak için önce <Link href="/branches" className="font-bold underline">bir şube oluşturun</Link>.</Notice></>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!amtOk || !branchId) return;
    create.mutate({ data: { amount: amt, currency, branchId, ...(note.trim() ? { note: note.trim() } : {}) } }, {
      onSuccess: (r) => {
        qc.invalidateQueries({ queryKey: getGetKasaRequestsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetKasaSummaryQueryKey() });
        nav(`/requests/${r.id}`);
      },
    });
  };

  return (
    <>
      <title>Yeni talep | MMT Kasa</title>
      <PageHeader title="Yeni ödeme talebi" sub="Talep Bekliyor durumunda açılır ve tahsil edilene kadar gelir sayılmaz." />
      {b.isLoading ? <Skeleton className="h-64 max-w-lg" /> : (
        <form onSubmit={submit} className="rise max-w-lg space-y-4 rounded-lg border border-border bg-card p-5" noValidate>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <label className={labelCls} htmlFor="amount">Tutar</label>
              <input id="amount" inputMode="decimal" placeholder="0,00" className={`${inputCls} num text-lg`} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="input-amount" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cur">Para birimi</label>
              <select id="cur" className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value as KasaRequestInputCurrency)} data-testid="select-currency">
                <option>TRY</option><option>EUR</option><option>USD</option>
              </select>
            </div>
          </div>
          {touched && !amtOk && <p className="text-xs text-destructive" data-testid="error-amount">En fazla 8 basamak ve 2 ondalık içeren, sıfırdan büyük bir tutar girin.</p>}
          {admin ? (
            <div>
              <label className={labelCls} htmlFor="branch">Şube</label>
              <select id="branch" className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="select-branch">
                <option value="">Şube seçin</option>
                {active.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              {touched && !branchId && <p className="mt-1 text-xs text-destructive">Şube seçin.</p>}
            </div>
          ) : (
            <div><span className={labelCls}>Şube</span><div className="rounded-md bg-secondary px-3 py-2.5 text-sm font-semibold" data-testid="text-branch">{b.name(cashierBranchId)}</div></div>
          )}
          <div>
            <label className={labelCls} htmlFor="note">Not (isteğe bağlı)</label>
            <textarea id="note" maxLength={500} rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-note" />
          </div>
          {create.isError && <ErrorBox message={errMsg(create.error)} />}
          <button className={`${btn} w-full`} disabled={create.isPending} data-testid="button-create-request">{create.isPending ? 'Oluşturuluyor…' : 'Talebi oluştur'}</button>
        </form>
      )}
    </>
  );
}
