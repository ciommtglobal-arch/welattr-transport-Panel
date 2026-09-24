import { useAuth, UserButton } from "@clerk/react";
import { getGetStaffAccessQueryKey, useGetStaffAccess } from "@workspace/api-client-react";
import { Link, Redirect } from "wouter";

function AccessLoading() {
  return <main className="flex min-h-[80dvh] items-center justify-center bg-background text-foreground">Yetki kontrol ediliyor…</main>;
}

function AccessDenied() {
  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Bu çalışma alanına erişim yetkiniz yok.</h1>
      <p className="max-w-lg text-foreground/60">Mevcut hesabınıza personel veya kurucu yetkisi tanımlı değil. Yeni hesap oluşturmak yerine yetkili hesabınızla oturum açın.</p>
      <Link href="/b2b-agi/panel" className="text-primary underline">Şirket paneline dön</Link>
      <UserButton />
    </main>
  );
}

export function StaffWorkspaceRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  if (access.isError || !access.data) return <AccessDenied />;
  return <Redirect to={access.data.workspace} />;
}

export function FounderDashboard() {
  const { isLoaded, isSignedIn } = useAuth();
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  if (!isLoaded) return <AccessLoading />;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  if (access.isPending) return <AccessLoading />;
  if (access.isError || access.data?.role !== "founder") return <AccessDenied />;
  return (
    <main className="min-h-[100dvh] bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-wider">MMT GLOBAL</Link>
          <UserButton />
        </header>
        <p className="mt-14 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Kurucu çalışma alanı</p>
        <h1 className="mt-3 text-4xl font-semibold">Yönetim paneli</h1>
        <p className="mt-4 text-foreground/60">Yetkili hesabınız için mevcut yönetim alanları.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            { href: "/b2b-agi/panel", title: "Şirket paneli", text: "Şirket başvurusu, üyeler ve davetler" },
            { href: "/staff/b2b-dogrulamalar", title: "Firma doğrulaması", text: "Kurucu onayı gerektiren kayıtlar" },
            { href: "/staff/medya-merkezi", title: "Medya Merkezi", text: "Pilot içerik ve yayın onayları" },
          ].map(link => (
            <Link key={link.href} href={link.href} className="border border-border bg-card p-6 transition-colors hover:border-primary">
              <h2 className="text-xl font-semibold">{link.title}</h2>
              <p className="mt-2 text-sm text-foreground/60">{link.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}