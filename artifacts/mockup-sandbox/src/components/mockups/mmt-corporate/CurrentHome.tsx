import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import "./_baseline.css";

type MockLinkProps = {
  href: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
};

function MockLink({ href: _href, className, onClick, children }: MockLinkProps) {
  return (
    <a
      href="#"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}

export function CurrentHome() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="mmt-corporate-baseline relative min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground selection:bg-primary selection:text-white">
      {/* Navigation */}
      <nav
        className={[
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out px-6 md:px-12 py-6",
          isScrolled || mobileMenuOpen
            ? "bg-background/90 backdrop-blur-md border-b border-border/50"
            : "bg-transparent",
        ].join(" ")}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <MockLink href="/" className="group flex items-center gap-2 z-50">
            <div className="w-8 h-8 bg-primary rounded-br-xl rounded-tl-xl flex items-center justify-center text-primary-foreground font-bold text-lg tracking-tighter group-hover:scale-95 transition-transform">
              M
            </div>
            <span className="font-semibold text-lg tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </MockLink>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide">
            <button onClick={() => scrollToSection("approach")} className="hover:text-primary transition-colors">
              BAKIŞ AÇIMIZ
            </button>
            <button onClick={() => scrollToSection("ecosystem")} className="hover:text-primary transition-colors">
              EKOSİSTEM
            </button>
            <MockLink href="/birimler" className="hover:text-primary transition-colors">
              BİRİMLER
            </MockLink>
            <button onClick={() => scrollToSection("corporate-fleet")} className="hover:text-primary transition-colors">
              KURUMSAL FİLO
            </button>
            <button onClick={() => scrollToSection("contact")} className="hover:text-primary transition-colors">
              İLETİŞİM
            </button>
            <MockLink href="/b2b-agi" className="hover:text-primary transition-colors">
              ÜCRETSİZ B2B AĞI
            </MockLink>
            <MockLink
              href="/limit"
              className="px-5 py-2.5 bg-primary text-white hover:bg-primary/90 transition-colors rounded-none font-semibold uppercase tracking-wider text-xs"
            >
              PORTALA GİRİŞ
            </MockLink>
            <MockLink
              href="/cuzdan-demo"
              className="border border-primary px-5 py-2.5 text-primary transition-colors hover:bg-primary hover:text-white rounded-none font-semibold uppercase tracking-wider text-xs"
            >
              DEMO CÜZDAN
            </MockLink>
            <MockLink
              href="/odeme"
              className="border border-foreground/30 px-5 py-2.5 text-foreground transition-colors hover:border-primary hover:text-primary rounded-none font-semibold uppercase tracking-wider text-xs"
            >
              TİCARİ ÖDEME
            </MockLink>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="relative z-[60] flex min-h-12 min-w-12 items-center justify-center p-2 -mr-2 touch-manipulation"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        id="mobile-navigation"
        className={[
          "fixed inset-0 overflow-y-auto bg-background/95 backdrop-blur-xl z-40 flex flex-col items-center justify-start gap-7 px-6 py-24 transition-all duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <div className="grid w-full max-w-sm grid-cols-3 gap-2 border-b border-border/70 pb-6">
          <MockLink
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-primary/50 bg-primary/10 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-primary"
          >
            ANA SAYFA
          </MockLink>
          <MockLink
            href="/b2b-agi"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-border px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/75"
          >
            ÜCRETSİZ B2B AĞI
          </MockLink>
          <MockLink
            href="/b2b-agi/panel"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-border px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/75"
          >
            FİRMA PANELİM
          </MockLink>
        </div>
        <MockLink
          href="/staff/giris"
          onClick={() => setMobileMenuOpen(false)}
          className="w-full max-w-sm border border-primary bg-primary/10 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-primary"
        >
          Personel Girişi
        </MockLink>
        <button onClick={() => scrollToSection("approach")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          BAKIŞ AÇIMIZ
        </button>
        <button onClick={() => scrollToSection("ecosystem")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          EKOSİSTEM
        </button>
        <MockLink href="/birimler" className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          BİRİMLER
        </MockLink>
        <button onClick={() => scrollToSection("corporate-fleet")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          KURUMSAL FİLO
        </button>
        <button onClick={() => scrollToSection("contact")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          İLETİŞİM
        </button>
        <MockLink href="/b2b-agi" className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          ÜCRETSİZ B2B AĞI
        </MockLink>
        <div className="mt-4 grid w-[min(20rem,calc(100vw-3rem))] grid-cols-2 gap-3 border-t border-border/60 pt-6">
          <p className="col-span-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Başvuru kategorileri
          </p>
          <MockLink href="/limit/ticari" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            Ticari
          </MockLink>
          <MockLink href="/limit/konut" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            Konut
          </MockLink>
          <MockLink href="/limit/tasit" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            Taşıt
          </MockLink>
          <MockLink href="/limit/bireysel" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            Bireysel
          </MockLink>
        </div>
        <MockLink
          href="/limit"
          className="mt-2 px-8 py-4 bg-primary text-white transition-colors rounded-none font-semibold uppercase tracking-wider text-sm"
        >
          TÜM BAŞVURULAR
        </MockLink>
        <MockLink
          href="/cuzdan-demo"
          className="mt-2 border border-primary px-8 py-4 text-primary transition-colors hover:bg-primary hover:text-white rounded-none font-semibold uppercase tracking-wider text-sm"
        >
          DEMO CÜZDAN
        </MockLink>
        <MockLink
          href="/odeme"
          className="mt-2 border border-foreground/30 px-8 py-4 text-foreground transition-colors hover:border-primary hover:text-primary rounded-none font-semibold uppercase tracking-wider text-sm"
        >
          TİCARİ ÖDEME
        </MockLink>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100dvh-1rem)] w-full flex flex-col justify-center overflow-hidden pb-10 pt-24 md:min-h-[100dvh] md:pb-12">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
            style={{ backgroundImage: "url('/__mockup/images/hero-bridge.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 md:gap-16 md:px-12">
          {/* Top Label */}
          <div className="flex items-center gap-4 md:opacity-0 md:animate-slide-up-fade delay-150">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <p className="text-xs md:text-sm tracking-[0.2em] font-medium text-foreground/80 uppercase">
              MMT GLOBAL / ÜCRETSİZ B2B İŞ AĞI
            </p>
          </div>

          {/* Headline */}
          <h1 className="flex flex-col gap-1 text-[4.25rem] leading-[0.85] tracking-tight sm:text-[5.5rem] md:gap-2 md:text-[8rem] lg:text-[10rem]">
            <span className="font-semibold md:opacity-0 md:animate-slide-up-fade delay-300">
              Üret.
            </span>
            <span className="font-serif italic text-primary font-normal md:opacity-0 md:animate-slide-up-fade delay-500">
              Tanıt.
            </span>
            <span className="font-semibold md:opacity-0 md:animate-slide-up-fade delay-700">
              Sat.
            </span>
          </h1>

          {/* Subtext and CTA row */}
          <div className="mt-4 flex flex-col justify-between gap-6 md:mt-16 md:flex-row md:items-end md:gap-12">
            <div className="max-w-xl md:opacity-0 md:animate-slide-up-fade delay-1000">
              <p className="text-base leading-relaxed text-foreground/80 md:text-xl">
                <strong className="font-semibold text-foreground">Firmanı tanıt, iş bağlantıları kur, ekibini tek yerden yönet.</strong><br />
                Üretici tanıtımı, alıcı talepleri ve temel B2B bağlantı hizmetleri ücretsizdir.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
                <MockLink
                  href="/b2b-agi/katil"
                  className="inline-flex w-fit items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  FİRMA KAYDI
                  <ArrowRight size={15} />
                </MockLink>
                <MockLink
                  href="/b2b-agi"
                  className="inline-flex w-fit items-center justify-center gap-2 border border-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  İŞ AĞINI KEŞFET
                  <ArrowRight size={15} />
                </MockLink>
                <MockLink
                  href="/b2b-agi/panel"
                  className="inline-flex w-fit items-center justify-center gap-2 border border-foreground/35 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  DAVET ET
                  <ArrowRight size={15} />
                </MockLink>
              </div>
            </div>

            <button
              onClick={() => scrollToSection("approach")}
              className="group flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full border border-primary/40 flex items-center justify-center hover:bg-primary hover:border-primary transition-all duration-500 opacity-0 animate-slide-up-fade delay-1000"
              aria-label="AĞI KEŞFETMEK İÇİN KAYDIR"
            >
              <ArrowDownRight className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500 group-hover:translate-x-1 group-hover:translate-y-1" />
            </button>
          </div>

          {/* Scroll Cue */}
          <div className="absolute bottom-8 left-6 hidden items-center gap-6 opacity-0 animate-slide-up-fade delay-1000 md:left-12 md:flex">
            <span className="text-[10px] md:text-xs tracking-[0.3em] text-foreground/60 font-medium">
              AĞI KEŞFETMEK İÇİN KAYDIR
            </span>
            <div className="w-16 md:w-24 h-[1px] bg-foreground/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-primary w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}