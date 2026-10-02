import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetKasaBranchesQueryKey, useCreateKasaBranch, useGetKasaBranches, useUpdateKasaBranch, type KasaBranch } from '@workspace/api-client-react';
import { Pencil, Plus } from 'lucide-react';
import { EmptyState, ErrorBox, ListSkeleton, Modal, PageHeader, btn, btnDanger, btnSecondary, inputCls, labelCls } from '@/components/kit';
import { errMsg } from '@/lib/format';

export default function BranchesPage() {
  const qc = useQueryClient();
  const q = useGetKasaBranches({ query: { queryKey: getGetKasaBranchesQueryKey() } });
  const create = useCreateKasaBranch();
  const update = useUpdateKasaBranch();
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<KasaBranch | null>(null);
  const [eName, setEName] = useState('');
  const [eActive, setEActive] = useState(true);
  const done = () => qc.invalidateQueries({ queryKey: getGetKasaBranchesQueryKey() });
  const open = (b: KasaBranch) => { update.reset(); setEdit(b); setEName(b.name); setEActive(b.active); };
  return (
    <>
      <title>Şubeler | MMT Kasa</title>
      <PageHeader title="Şubeler" sub="Şubeler silinmez; kullanım dışı kalanlar pasifleştirilir." />
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4" onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        create.mutate({ data: { name: n } }, { onSuccess: () => { setName(''); done(); } });
      }}>
        <div className="min-w-56 flex-1"><label className={labelCls} htmlFor="bn">Yeni şube adı</label><input id="bn" maxLength={100} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} data-testid="input-branch-name" /></div>
        <button className={btn} disabled={create.isPending || !name.trim()} data-testid="button-create-branch"><Plus className="h-4 w-4" />{create.isPending ? 'Ekleniyor…' : 'Şube ekle'}</button>
        {create.isError && <div className="w-full"><ErrorBox message={errMsg(create.error)} /></div>}
      </form>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title="Henüz şube yok" text="Kasiyerlerin talep açabilmesi için en az bir aktif şube gerekir. Yukarıdan ilk şubeyi ekleyin." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" data-testid="list-branches">
          {q.data.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`row-branch-${b.id}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${b.active ? 'bg-paid' : 'bg-input'}`} />
              <span className="flex-1 font-semibold">{b.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{b.active ? 'Aktif' : 'Pasif'}</span></span>
              <button className={btnSecondary} onClick={() => open(b)} data-testid={`button-edit-branch-${b.id}`}><Pencil className="h-3.5 w-3.5" />Düzenle</button>
              {b.active && <button className={btnDanger} disabled={update.isPending} onClick={() => update.mutate({ id: b.id, data: { name: b.name, active: false } }, { onSuccess: done })} data-testid={`button-deactivate-branch-${b.id}`}>Pasifleştir</button>}
            </li>
          ))}
        </ul>
      )}
      {!edit && update.isError && <div className="mt-4"><ErrorBox message={errMsg(update.error)} /></div>}
      {edit && (
        <Modal title="Şubeyi düzenle" onClose={() => setEdit(null)}>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!eName.trim()) return;
            update.mutate({ id: edit.id, data: { name: eName.trim(), active: eActive } }, { onSuccess: () => { done(); setEdit(null); } });
          }}>
            <div><label className={labelCls} htmlFor="en">Ad</label><input id="en" maxLength={100} className={inputCls} value={eName} onChange={(e) => setEName(e.target.value)} data-testid="input-edit-branch-name" /></div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} data-testid="checkbox-branch-active" />Aktif</label>
            {update.isError && <ErrorBox message={errMsg(update.error)} />}
            <button className={`${btn} w-full`} disabled={update.isPending || !eName.trim()} data-testid="button-save-branch">{update.isPending ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
