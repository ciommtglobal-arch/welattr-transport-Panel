import { type ReactNode, createContext, useContext } from 'react';
import { Link, useLocation } from 'wouter';
import { Show, useClerk } from '@clerk/react';
import { Redirect } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetKasaMeQueryKey,
  useGetKasaMe,
  useSetupKasaOwner,
  type KasaUser,
} from '@workspace/api-client-react';
import { BarChart3, Building2, LayoutDashboard, ListChecks, LogOut, PlusCircle, ShieldAlert, Users } from 'lucide-react';
import { ErrorBox, Logo, Skeleton, btn, btnSecondary } from '@/components/kit';
import { errMsg } from '@/lib/format';

const MeCtx = createContext<KasaUser | null>(null);
export const useMe = () => {
  const u = useContext(MeCtx);
  if (!u) throw new Error('useMe outside gate');
  return u;
};

const NAV = [
  { href: '/panel', label: 'Panel', icon: LayoutDashboard, admin: false },
  { href: '/requests', label: 'Talepler', icon: ListChecks, admin: false },
  { href: '/requests/new', label: 'Yeni talep', icon: PlusCircle, admin: false },
  { href: '/branches', label: 'Şubeler', icon: Building2, admin: true },
  { href: '/users', label: 'Kullanıcılar', icon: Users, admin: true },
  { href: '/reports', label: 'Raporlar', icon: BarChart3, admin: true },
];

function Shell({ user, children }: { user?: KasaUser; children: ReactNode }) {
  const [loc] = useLocation();
  const { signOut } = useClerk();
  const items = NAV.filter((n) => user && (!n.admin || user.role === 'admin'));
  const active = (h: string) => (h === '/requests' ? loc === h || /^\/requests\/\d+/.test(loc) : loc === h);
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-[100dvh] md:w-60 md:shrink-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:px-5 md:py-6">
          <Logo light to="/panel" />
          <button onClick={() => signOut()} className="rounded p-2 text-sidebar-foreground/70 hover:text-sidebar-foreground md:hidden" aria-label="Çıkış" data-testid="button-signout-mobile">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3">
          {items.map((n) => (
            <Link key={n.href} href={n.href} data-testid={`nav-${n.href.slice(1).replace('/', '-')}`}
              className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition ${active(n.href) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60'}`}>
              <n.icon className={`h-4 w-4 ${active(n.href) ? 'text-sidebar-primary' : ''}`} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 pt-6 md:absolute md:bottom-5 md:block md:w-60">
          {user && (
            <div className="mb-3 border-t border-sidebar-border pt-3 text-xs">
              <div className="font-semibold [overflow-wrap:anywhere]" data-testid="text-user-name">{user.name}</div>
              <div className="text-sidebar-foreground/60">{user.role === 'admin' ? 'Yönetici' : 'Kasiyer'}</div>
            </div>
          )}
          <button onClick={() => signOut()} className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground" data-testid="button-signout">
            <LogOut className="h-4 w-4" /> Çıkış yap
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function AccessView() {
  const me = useGetKasaMe({ query: { queryKey: getGetKasaMeQueryKey(), staleTime: 15000 } });
  const qc = useQueryClient();
  const setup = useSetupKasaOwner();
  const data = me.data;
  const inactive = !!data?.user && !data.user.active;
  return (
    <Shell>
      <div className="rise mx-auto mt-6 max-w-xl rounded-xl border border-border bg-card p-7 md:mt-16">
        <ShieldAlert className="mb-3 h-8 w-8 text-pending" />
        {data?.canSetup ? (
          <>
            <h1 className="text-3xl font-bold">İlk kurulum</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Bu hesap sahip izin listesinde. Kurulumu tamamladığınızda yönetici olarak kaydedilirsiniz; şube, kullanıcı ve rapor ekranları açılır.
            </p>
            <button className={`${btn} mt-5`} disabled={setup.isPending} data-testid="button-setup-owner"
              onClick={() => setup.mutate(undefined, {
                onSuccess: (user) => {
                  qc.setQueryData(getGetKasaMeQueryKey(), (old: typeof data) => (old ? { ...old, user } : old));
                  qc.invalidateQueries({ queryKey: getGetKasaMeQueryKey() });
                },
              })}>
              {setup.isPending ? 'Kuruluyor…' : 'Sahip olarak kurulumu tamamla'}
            </button>
            {setup.isError && <div className="mt-4"><ErrorBox message={errMsg(setup.error)} /></div>}
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{inactive ? 'Hesabınız pasif' : 'Erişiminiz yok'}</h1>
            <p className="mt-2 text-sm text-muted-foreground" data-testid="text-no-access">
              {inactive
                ? 'Hesabınız bir yönetici tarafından pasifleştirilmiş. Yeniden açılması için yöneticinizle görüşün.'
                : 'Giriş yaptığınız hesaba henüz MMT Kasa yetkisi tanımlanmamış. Yöneticinizden hesabınızın doğrulanmış e-posta adresine yetki vermesini isteyin.'}
            </p>
            <button className={`${btnSecondary} mt-5`} onClick={() => me.refetch()} data-testid="button-recheck">Erişimi yeniden kontrol et</button>
          </>
        )}
      </div>
    </Shell>
  );
}

function Inner({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const me = useGetKasaMe({ query: { queryKey: getGetKasaMeQueryKey(), staleTime: 15000 } });
  if (me.isLoading)
    return (
      <Shell>
        <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>
      </Shell>
    );
  if (me.isError)
    return <Shell><ErrorBox message={errMsg(me.error)} onRetry={() => me.refetch()} /></Shell>;
  const user = me.data?.user;
  if (!user || !user.active) return <AccessView />;
  if (admin && user.role !== 'admin')
    return (
      <Shell user={user}>
        <ErrorBox message="Bu sayfa yalnızca yöneticilere açıktır." />
      </Shell>
    );
  return (
    <MeCtx.Provider value={user}>
      <Shell user={user}>{children}</Shell>
    </MeCtx.Provider>
  );
}

export function Gate({ admin, children }: { admin?: boolean; children: ReactNode }) {
  return (
    <>
      <Show when="signed-in"><Inner admin={admin}>{children}</Inner></Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}
