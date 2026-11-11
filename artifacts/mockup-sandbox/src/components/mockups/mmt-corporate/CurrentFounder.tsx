import type { ReactNode, MouseEvent } from "react";
import { UserRound } from "lucide-react";
import "./_baseline.css";

type MockLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

function MockLink({ href: _href, className, children }: MockLinkProps) {
  return (
    <a href="#" className={className} onClick={(event: MouseEvent<HTMLAnchorElement>) => event.preventDefault()}>
      {children}
    </a>
  );
}

function StubUserButton() {
  return (
    <button
      type="button"
      aria-label="Kullanıcı menüsü"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground/70"
    >
      <UserRound size={18} />
    </button>
  );
}

export function CurrentFounder() {
  return (
    <main className="mmt-corporate-baseline min-h-[100dvh] bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <MockLink href="/" className="text-lg font-semibold tracking-wider">
            MMT GLOBAL
          </MockLink>
          <StubUserButton />
        </header>
        <p className="mt-14 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Kurucu çalışma alanı
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Yönetim paneli</h1>
        <p className="mt-4 text-foreground/60">
          Yetkili hesabınız için mevcut yönetim alanları.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            { href: "/b2b-agi/panel", title: "Şirket paneli", text: "Şirket başvurusu, üyeler ve davetler" },
            { href: "/staff/b2b-dogrulamalar", title: "Firma doğrulaması", text: "Kurucu onayı gerektiren kayıtlar" },
            { href: "/staff/medya-merkezi", title: "Medya Merkezi", text: "Pilot içerik ve yayın onayları" },
          ].map((link) => (
            <MockLink
              key={link.href}
              href={link.href}
              className="border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <h2 className="text-xl font-semibold">{link.title}</h2>
              <p className="mt-2 text-sm text-foreground/60">{link.text}</p>
            </MockLink>
          ))}
        </div>
      </div>
    </main>
  );
}