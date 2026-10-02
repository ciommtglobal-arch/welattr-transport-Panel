import { Link } from 'wouter';
import { ArrowRight, CheckCircle2, Clock, QrCode, ShieldOff } from 'lucide-react';
import { Logo } from '@/components/kit';

export default function Landing() {
  const cta = 'inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-bold transition active:translate-y-px';
  return (
    <div className="min-h-[100dvh]">
      <title>MMT Kasa | Talep ve tahsilat defteri</title>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-secondary" data-testid="link-sign-in">Giriş yap</Link>
          <Link href="/sign-up" className={`${cta} bg-primary text-primary-foreground hover:brightness-125`} data-testid="link-sign-up">Hesap oluştur</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.15fr_1fr] md:pt-16">
        <div className="rise">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-pending">Şube kasası için</p>
          <h1 className="text-5xl font-bold leading-[1.04] md:text-7xl">
            İstenen para ile <em className="text-primary">kasaya giren</em> para aynı değildir.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            MMT Kasa, kasiyerin açtığı ödeme taleplerini ayrı, tahsil edilmiş geliri ayrı tutar. Bekleyen talep hiçbir zaman gelir olarak sayılmaz.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-in" className={`${cta} bg-primary text-primary-foreground hover:brightness-125`} data-testid="cta-sign-in">
              Defteri aç <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#nasil" className={`${cta} border border-input bg-card hover:bg-secondary`}>Nasıl çalışır</a>
          </div>
        </div>

        <div className="rise [animation-delay:150ms]" aria-hidden>
          <div className="ruled relative rounded-lg border border-border bg-card p-5 shadow-[6px_6px_0_hsl(var(--border))]">
            <div className="mb-3 flex justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Yeni defter</span><span>Boş başlangıç</span>
            </div>
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              İlk kaydınızla başlayın. Örnek işlem eklenmez.
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t-2 border-foreground pt-3">
              <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Gelir</div><div className="num text-xl font-semibold text-paid">—</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Bekleyen</div><div className="num text-xl font-semibold text-pending">—</div></div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Tanıtım görünümü; kayıtlarınız yalnızca girişten sonra gösterilir.</p>
        </div>
      </section>

      <section id="nasil" className="border-y border-border bg-secondary/50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="mb-10 text-4xl font-bold">Üç adımda ayrım</h2>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-[1.2fr_1fr_1fr]">
            {[
              [Clock, 'Talep açılır', 'Kasiyer tutarı, para birimini ve şubeyi girer. Talep Bekliyor durumunda oluşur.'],
              [QrCode, 'QR paylaşılır', 'Her talebin benzersiz bir referansı ve QR kodu vardır. Müşteri sayfasında yalnızca tutar ve durum görünür.'],
              [CheckCircle2, 'Tahsilat ayrı tutulur', 'Şu an tahsilat kapalıdır. Sağlayıcı bağlandığında yalnızca doğrulanmış tahsilatlar gelir sayılacaktır.'],
            ].map(([Icon, t, d], i) => {
              const I = Icon as typeof Clock;
              return (
                <div key={i} className="bg-card p-6">
                  <I className="mb-4 h-6 w-6 text-primary" />
                  <h3 className="text-xl font-bold">{t as string}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-4xl font-bold">Kim ne görür</h2>
          <ul className="mt-6 space-y-4 text-sm">
            <li><b>Kasiyer</b> yalnızca kendi açtığı talepleri ve atandığı şubeyi görür.</li>
            <li><b>Yönetici</b> şubeleri, kullanıcıları, tüm talepleri ve gelir özetini yönetir.</li>
            <li><b>Müşteri</b> QR sayfasında tutar, para birimi ve durumdan fazlasını görmez.</li>
          </ul>
        </div>
        <div className="rounded-lg border-2 border-foreground bg-card p-6">
          <ShieldOff className="mb-3 h-6 w-6 text-pending" />
          <h3 className="text-2xl font-bold">Açık sınırlar</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Canlı ödeme alma şu an kapalıdır; müşteri sayfasında ödeme düğmesi devre dışıdır.</li>
            <li>Raporlar mali Z raporu değildir.</li>
            <li>Gösterilen gelir kasa bakiyesi değildir.</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        MMT Kasa. Talep ve tahsilat ayrımı için bağımsız operasyon aracı.
      </footer>
    </div>
  );
}
