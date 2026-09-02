import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowDownRight, Menu, X, ArrowRight, ChevronRight, Globe2, Building2, Stethoscope, Truck, Tv, Briefcase, Factory } from "lucide-react";
import { cn } from "@/lib/utils";

// Make sure to use the generated image
const HERO_BG = "/hero-bridge.jpg";

export default function Home() {
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
    <div className="relative w-full min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out px-6 md:px-12 py-6",
          isScrolled || mobileMenuOpen ? "bg-background/90 backdrop-blur-md border-b border-border/50" : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2 z-50">
            <div className="w-8 h-8 bg-primary rounded-br-xl rounded-tl-xl flex items-center justify-center text-primary-foreground font-bold text-lg tracking-tighter group-hover:scale-95 transition-transform">
              M
            </div>
            <span className="font-semibold text-lg tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide">
            <button onClick={() => scrollToSection("approach")} className="hover:text-primary transition-colors">
              BAKIŞ AÇIMIZ
            </button>
            <button onClick={() => scrollToSection("ecosystem")} className="hover:text-primary transition-colors">
              EKOSİSTEM
            </button>
            <button onClick={() => scrollToSection("contact")} className="hover:text-primary transition-colors">
              İLETİŞİM
            </button>
              <Link href="/limit" className="px-5 py-2.5 bg-primary text-white hover:bg-primary/90 transition-colors rounded-none font-semibold uppercase tracking-wider text-xs">
              PORTALA GİRİŞ
              </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden z-50 p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center gap-8 transition-all duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <button onClick={() => scrollToSection("approach")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          BAKIŞ AÇIMIZ
        </button>
        <button onClick={() => scrollToSection("ecosystem")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          EKOSİSTEM
        </button>
        <button onClick={() => scrollToSection("contact")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          İLETİŞİM
        </button>
          <Link href="/limit" className="mt-8 px-8 py-4 bg-primary text-white transition-colors rounded-none font-semibold uppercase tracking-wider text-sm">
          PORTALA GİRİŞ
          </Link>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[100dvh] w-full flex flex-col justify-center pt-24 pb-12 overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
            style={{ backgroundImage: `url(${HERO_BG})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 w-full flex flex-col gap-12 md:gap-16">
          
          {/* Top Label */}
          <div className="flex items-center gap-4 opacity-0 animate-slide-up-fade delay-150">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <p className="text-xs md:text-sm tracking-[0.2em] font-medium text-foreground/80 uppercase">
              MMT GLOBAL / FİNANS EKOSİSTEMİ ALTYAPISIYLA BÜYÜYEN GÜÇ
            </p>
          </div>

          {/* Headline */}
          <h1 className="flex flex-col gap-1 md:gap-2 text-[5.5rem] md:text-[8rem] lg:text-[10rem] leading-[0.85] tracking-tight">
            <span className="font-semibold opacity-0 animate-slide-up-fade delay-300">
              Üret.
            </span>
            <span className="font-serif italic text-primary font-normal opacity-0 animate-slide-up-fade delay-500">
              Ticaret.
            </span>
            <span className="font-semibold opacity-0 animate-slide-up-fade delay-700">
              Sat.
            </span>
          </h1>

          {/* Subtext and CTA row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mt-8 md:mt-16">
            <div className="max-w-xl opacity-0 animate-slide-up-fade delay-1000">
              <p className="text-lg md:text-xl leading-relaxed text-foreground/80 font-light">
                <strong className="font-semibold text-foreground">Sınır tanımayan güç: MMT Global.</strong><br/>
                İlerlemenin arkasındaki insanları, sermayeyi ve yetkinliği sektörler, sınırlar ve nesiller arasında birbirine bağlarız.
              </p>
            </div>
            
            <button 
              onClick={() => scrollToSection("approach")}
              className="group flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full border border-primary/40 flex items-center justify-center hover:bg-primary hover:border-primary transition-all duration-500 opacity-0 animate-slide-up-fade delay-1000"
              aria-label="Aşağı kaydır"
            >
              <ArrowDownRight className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500 group-hover:translate-x-1 group-hover:translate-y-1" />
            </button>
          </div>

          {/* Scroll Cue */}
          <div className="absolute bottom-8 left-6 md:left-12 flex items-center gap-6 opacity-0 animate-slide-up-fade delay-1000">
            <span className="text-[10px] md:text-xs tracking-[0.3em] text-foreground/60 font-medium">KEŞFETMEK İÇİN KAYDIR</span>
            <div className="w-16 md:w-24 h-[1px] bg-foreground/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-primary w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]" />
            </div>
          </div>

        </div>
      </section>

      {/* Approach Section */}
      <section id="approach" className="bg-secondary text-secondary-foreground py-24 md:py-32 px-6 md:px-12 rounded-t-3xl md:rounded-t-[3rem] -mt-6 relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mb-16 md:mb-24">
            <span className="text-primary font-mono text-sm tracking-widest">01</span>
            <h2 className="text-xs tracking-[0.2em] uppercase font-bold text-secondary-foreground/60">BAKIŞ AÇIMIZ</h2>
            <div className="flex-1 h-[1px] bg-border/40" />
            <div className="w-12 h-12 bg-background flex items-center justify-center rounded-tl-xl rounded-br-xl text-primary">
              <Globe2 size={20} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
            <div className="flex flex-col justify-center">
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-serif italic mb-8 leading-tight">
                Geleceği <br/><span className="font-sans font-semibold not-italic text-secondary-foreground">İnşa Ediyoruz</span>
              </h3>
              <p className="text-lg text-secondary-foreground/70 leading-relaxed font-light mb-8">
                MMT Global olarak, sadece bugünün ihtiyaçlarına cevap vermiyor, yarının fırsatlarını da öngörüyoruz. Güçlü finansal yapımız ve çok uluslu uzmanlığımızla, faaliyet gösterdiğimiz her sektörde sürdürülebilir bir değer yaratıyoruz.
              </p>
              <button className="flex items-center gap-3 text-sm font-semibold tracking-wider uppercase w-fit group">
                <span className="border-b border-primary pb-1 group-hover:text-primary transition-colors">Hikayemizi Keşfet</span>
                <ArrowRight size={16} className="text-primary group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
            <div className="relative aspect-[4/5] md:aspect-square bg-muted rounded-bl-[4rem] rounded-tr-[4rem] overflow-hidden">
               {/* Decorative architectural/abstract placeholder for approach */}
               <div className="absolute inset-0 bg-gradient-to-tr from-background/40 to-transparent z-10" />
               <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section id="ecosystem" className="py-24 md:py-32 px-6 md:px-12 bg-background relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mb-16 md:mb-24">
            <span className="text-primary font-mono text-sm tracking-widest">02</span>
            <h2 className="text-xs tracking-[0.2em] uppercase font-bold text-foreground/60">EKOSİSTEM</h2>
            <div className="flex-1 h-[1px] bg-border/40" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 md:gap-y-16">
            
            <EcosystemCard 
              icon={<Truck className="w-8 h-8" />}
              title="Lojistik"
              desc="Küresel tedarik zincirinde kesintisiz, hızlı ve güvenilir çözümlerle kıtaları birbirine bağlıyoruz."
            />
            <EcosystemCard 
              icon={<Stethoscope className="w-8 h-8" />}
              title="Sağlık Turizmi"
              desc="Dünya standartlarında sağlık hizmetlerini, modern tesisler ve alanında uzman profesyonellerle sunuyoruz."
            />
            <EcosystemCard 
              icon={<Building2 className="w-8 h-8" />}
              title="İnşaat & Bölgesel Gelişim"
              desc="Geleceğin şehirlerini modern, çevreci ve sürdürülebilir mimari projelerle bugünden inşa ediyoruz."
            />
            <EcosystemCard 
              icon={<Tv className="w-8 h-8" />}
              title="Medya & Markalaşma"
              desc="Etkili iletişim stratejileri ve yenilikçi medya çözümleriyle markaların küresel sesini yükseltiyoruz."
            />
            <EcosystemCard 
              icon={<Briefcase className="w-8 h-8" />}
              title="Finansal Hizmetler"
              desc="Kurumsal büyüme için stratejik danışmanlık, yatırım yönetimi ve yapısal finansman çözümleri sunuyoruz."
            />
            <EcosystemCard 
              icon={<Factory className="w-8 h-8" />}
              title="Sanayi Ticareti"
              desc="Üretimden pazarlamaya kadar endüstriyel ticaretin her aşamasında güçlü bir köprü görevi görüyoruz."
            />

          </div>
        </div>
      </section>

      {/* CTA / Contact Section */}
      <section id="contact" className="relative py-24 md:py-32 px-6 md:px-12 bg-primary text-primary-foreground overflow-hidden">
        {/* Abstract background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-semibold mb-8 tracking-tight leading-tight">
            Küresel Büyümeye <br/> <span className="font-serif italic font-normal">Hazır Mısınız?</span>
          </h2>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mb-12 font-light">
            Sınırları aşan projelerde ve stratejik yatırımlarda güvenilir iş ortağınız olmak için buradayız.
          </p>
          <div className="flex flex-col sm:flex-row gap-6">
             <a href="mailto:info@mmtglobal.com" className="px-8 py-4 bg-background text-foreground hover:bg-background/90 transition-colors font-semibold uppercase tracking-wider text-sm">
              BİZİMLE İLETİŞİME GEÇİN
             </a>
             <a href="#contact" className="px-8 py-4 bg-transparent border border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-colors font-semibold uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              KÜRESEL OFİSLERİMİZ <ChevronRight size={16} />
             </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border pt-16 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
               <Link href="/" className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 bg-primary rounded-br-lg rounded-tl-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
                  M
                </div>
                <span className="font-semibold tracking-wider text-sm">
                  MMT <span className="font-light opacity-80">GLOBAL</span>
                </span>
              </Link>
              <p className="text-sm text-foreground/60 font-light leading-relaxed">
                İlerlemenin arkasındaki insanları, sermayeyi ve yetkinliği sektörler, sınırlar ve nesiller arasında birbirine bağlarız.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">Hızlı Bağlantılar</h4>
              <ul className="space-y-4 text-sm text-foreground/60">
                <li><button onClick={() => scrollToSection("approach")} className="hover:text-primary transition-colors">Bakış Açımız</button></li>
                <li><button onClick={() => scrollToSection("ecosystem")} className="hover:text-primary transition-colors">Ekosistem</button></li>
                <li><Link href="/yatirimlar" className="hover:text-primary transition-colors">Yatırımlarımız</Link></li>
                <li><Link href="/kariyer" className="hover:text-primary transition-colors">Kariyer</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">Ekosistem</h4>
              <ul className="space-y-4 text-sm text-foreground/60">
                <li><span className="hover:text-primary transition-colors cursor-pointer">Lojistik</span></li>
                <li><span className="hover:text-primary transition-colors cursor-pointer">Sağlık Turizmi</span></li>
                <li><span className="hover:text-primary transition-colors cursor-pointer">İnşaat & Gelişim</span></li>
                <li><span className="hover:text-primary transition-colors cursor-pointer">Finans & Medya</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">İletişim</h4>
              <ul className="space-y-4 text-sm text-foreground/60">
                <li>Büyükdere Cad. No:123<br/>Şişli, İstanbul / Türkiye</li>
                <li><a href="mailto:info@mmtglobal.com" className="hover:text-primary transition-colors">info@mmtglobal.com</a></li>
                <li><a href="tel:+902120000000" className="hover:text-primary transition-colors">+90 (212) 000 00 00</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-foreground/40 font-light">
            <p>© {new Date().getFullYear()} MMT Global Finance. Tüm hakları saklıdır.</p>
            <div className="flex gap-6">
              <Link href="/gizlilik" className="hover:text-foreground transition-colors">Gizlilik Politikası</Link>
              <Link href="/cerez" className="hover:text-foreground transition-colors">Çerez Politikası</Link>
              <Link href="/kvkk" className="hover:text-foreground transition-colors">KVKK</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Global CSS animation for the scroll line */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scale-x {
          0% { transform: scaleX(0); transform-origin: left; }
          50% { transform: scaleX(1); transform-origin: left; }
          50.1% { transform: scaleX(1); transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}} />

      {/* Floating Action Button */}
       <button onClick={() => scrollToSection("contact")} className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 w-12 h-12 md:w-14 md:h-14 bg-card rounded-full shadow-lg shadow-black/20 flex flex-col items-center justify-center gap-0.5 border border-border group hover:scale-105 transition-transform" aria-label="Hızlı İşlemler">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
        </div>
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
        </div>
      </button>
    </div>
  );
}

function EcosystemCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group border border-border/50 bg-card p-8 md:p-10 hover:border-primary/50 transition-all duration-500 rounded-tr-[2rem] rounded-bl-[2rem] hover:-translate-y-2 flex flex-col">
      <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm border border-border/50">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-4 text-card-foreground group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-card-foreground/70 font-light leading-relaxed text-sm mb-8 flex-grow">
        {desc}
      </p>
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        <span>İncele</span>
        <ArrowRight size={14} />
      </div>
    </div>
  );
}
