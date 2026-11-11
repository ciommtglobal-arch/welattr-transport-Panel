import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetKasaUsersQueryKey, getGetKasaMeQueryKey, useGetKasaUsers, useGrantKasaUser, useUpdateKasaUser, type KasaUser } from '@workspace/api-client-react';
import { Pencil, UserPlus } from 'lucide-react';
import { EmptyState, ErrorBox, ListSkeleton, Modal, Notice, PageHeader, btn, btnSecondary, inputCls, labelCls } from '@/components/kit';
import { useMe } from '@/private/Gate';
import { useBranches } from '@/lib/branches';
import { errMsg } from '@/lib/format';

type Role = 'admin' | 'cashier';

function BranchSelect({ id, value, onChange, branches, testid }: { id: string; value: string; onChange: (v: string) => void; branches: { id: number; name: string; active: boolean }[]; testid: string }) {
  return (
    <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}>
      <option value="">Şube yok</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.active ? '' : ' (pasif)'}</option>)}
    </select>
  );
}

export default function UsersPage() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useGetKasaUsers({ query: { queryKey: getGetKasaUsersQueryKey() } });
  const b = useBranches();
  const grant = useGrantKasaUser();
  const update = useUpdateKasaUser();
  const branches = b.data ?? [];
  const activeBranches = branches.filter((x) => x.active);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [branch, setBranch] = useState('');
  const [edit, setEdit] = useState<KasaUser | null>(null);
  const [eRole, setERole] = useState<Role>('cashier');
  const [eBranch, setEBranch] = useState('');
  const [eActive, setEActive] = useState(true);
  const done = () => { qc.invalidateQueries({ queryKey: getGetKasaUsersQueryKey() }); qc.invalidateQueries({ queryKey: getGetKasaMeQueryKey() }); };
  const open = (u: KasaUser) => { update.reset(); setEdit(u); setERole(u.role); setEBranch(u.branchId ? String(u.branchId) : ''); setEActive(u.active); };
  const grantInvalid = !email.includes('@') || (role === 'cashier' && !branch);
  const editInvalid = eRole === 'cashier' && !eBranch;
  return (
    <>
      <title>Kullanıcılar | MMT Kasa</title>
      <PageHeader title="Kullanıcılar" sub="Yetki, hesabın doğrulanmış e-postası üzerinden verilir. Kişi önce kayıt olmuş olmalıdır." />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end" onSubmit={(e) => {
        e.preventDefault();
        if (grantInvalid) return;
        grant.mutate({ data: { email: email.trim(), role, branchId: branch ? Number(branch) : null } }, { onSuccess: () => { setEmail(''); setBranch(''); done(); } });
      }}>
        <div><label className={labelCls} htmlFor="ge">E-posta</label><input id="ge" type="email" maxLength={255} className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-grant-email" /></div>
        <div><label className={labelCls} htmlFor="gr">Rol</label><select id="gr" className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)} data-testid="select-grant-role"><option value="cashier">Kasiyer</option><option value="admin">Yönetici</option></select></div>
        <div><label className={labelCls} htmlFor="gb">Şube</label><BranchSelect id="gb" value={branch} onChange={setBranch} branches={activeBranches} testid="select-grant-branch" /></div>
        <button className={btn} disabled={grant.isPending || grantInvalid} data-testid="button-grant-user"><UserPlus className="h-4 w-4" />{grant.isPending ? 'Veriliyor…' : 'Yetki ver'}</button>
        {grant.isError && <div className="md:col-span-4"><ErrorBox message={errMsg(grant.error)} /></div>}
      </form>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title="Yetkili kullanıcı yok" text="Doğrulanmış e-postası olan mevcut bir hesaba yukarıdan rol verin." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" data-testid="list-users">
          {q.data.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`row-user-${u.id}`}>
              <div className="min-w-40 flex-1">
                <div className="font-semibold">{u.name}{u.id === me.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(siz)</span>}</div>
                <div className="text-xs text-muted-foreground">{u.role === 'admin' ? 'Yönetici' : 'Kasiyer'} · {u.branchId ? b.name(u.branchId) : 'Şube yok'}</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${u.active ? 'bg-paid-soft text-paid' : 'bg-muted text-muted-foreground'}`}>{u.active ? 'Aktif' : 'Pasif'}</span>
              <button className={btnSecondary} disabled={u.id === me.id} title={u.id === me.id ? 'Kendi hesabınızı değiştiremezsiniz' : undefined} onClick={() => open(u)} data-testid={`button-edit-user-${u.id}`}><Pencil className="h-3.5 w-3.5" />Düzenle</button>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Modal title={`${edit.name} düzenle`} onClose={() => setEdit(null)}>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (editInvalid || edit.id === me.id) return;
            update.mutate({ id: edit.id, data: { role: eRole, branchId: eBranch ? Number(eBranch) : null, active: eActive } }, { onSuccess: () => { done(); setEdit(null); } });
          }}>
            <div><label className={labelCls} htmlFor="er">Rol</label><select id="er" className={inputCls} value={eRole} onChange={(e) => setERole(e.target.value as Role)} data-testid="select-edit-role"><option value="cashier">Kasiyer</option><option value="admin">Yönetici</option></select></div>
            <div><label className={labelCls} htmlFor="eb">Şube</label><BranchSelect id="eb" value={eBranch} onChange={setEBranch} branches={branches} testid="select-edit-branch" /></div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} data-testid="checkbox-user-active" />Aktif</label>
            {editInvalid && <Notice tone="warn">Bir kasiyere şube atanmalıdır.</Notice>}
            {update.isError && <ErrorBox message={errMsg(update.error)} />}
            <button className={`${btn} w-full`} disabled={update.isPending || editInvalid} data-testid="button-save-user">{update.isPending ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
