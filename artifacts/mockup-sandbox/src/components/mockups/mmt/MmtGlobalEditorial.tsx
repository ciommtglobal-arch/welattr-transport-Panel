import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Factory,
  Globe2,
  Menu,
  Phone,
  Stethoscope,
  Truck,
  Tv,
  X,
} from "lucide-react";

const sectors = [
  {
    icon: Truck,
    index: "01",
    title: "Lojistik",
    text: "Kıtaları birbirine bağlayan, kesintisiz tedarik zincirleri.",
  },
  {
    icon: Stethoscope,
    index: "02",
    title: "Sağlık turizmi",
    text: "Uzmanlık, bakım ve modern tesisleri tek bir güven hattında buluştururuz.",
  },
  {
    icon: Building2,
    index: "03",
    title: "İnşaat & gelişim",
    text: "Şehirlerin yarınını bugünden planlayan bölgesel projeler.",
  },
  {
    icon: Tv,
    index: "04",
    title: "Medya & marka",
    text: "İyi fikirlere küresel bir ses, güçlü markalara net bir yön.",
  },
  {
    icon: Factory,
    index: "05",
    title: "Sanayi ticareti",
    text: "Üretimden pazara uzanan, ölçülebilir ve sağlam ortaklıklar.",
  },
];

export default function MmtGlobalEditorial() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSector, setActiveSector] = useState(0);

  const jump = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="mmt-editorial">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,500;1,500&display=swap');
        .mmt-editorial{--ink:#101b2b;--ink2:#17263a;--cream:#f2ede3;--paper:#faf7f0;--orange:#ec652d;--line:rgba(242,237,227,.2);min-height:100vh;background:var(--ink);color:var(--cream);font-family:'DM Sans',sans-serif;overflow:hidden}
        .mmt-editorial *{box-sizing:border-box}.mmt-editorial button,.mmt-editorial a{font:inherit}
        .mmt-editorial .mono{font-family:'DM Mono',monospace}.mmt-editorial .serif{font-family:'Playfair Display',serif}
        .mmt-editorial .shell{max-width:1440px;margin:auto;padding:0 56px}
        .mmt-editorial .topbar{height:84px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:relative;z-index:3}
        .mmt-editorial .brand{display:flex;align-items:center;gap:12px;color:var(--cream);text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.16em}
        .mmt-editorial .brandmark{width:29px;height:29px;background:var(--orange);display:grid;place-items:center;color:var(--paper);font-size:15px;border-radius:9px 0}
        .mmt-editorial .navlinks{display:flex;align-items:center;gap:32px}.mmt-editorial .navlinks button,.mmt-editorial .menu-btn{border:0;background:none;color:var(--cream);cursor:pointer;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.68}.mmt-editorial .navlinks button:hover{opacity:1;color:var(--orange)}
        .mmt-editorial .portal{background:var(--orange)!important;color:#fff!important;padding:13px 17px;opacity:1!important}
        .mmt-editorial .menu-btn{display:none;padding:10px}
        .mmt-editorial .hero{min-height:690px;display:grid;grid-template-columns:70px minmax(0,1fr) 340px;gap:38px;align-items:center;position:relative}
        .mmt-editorial .hero:before{content:"";position:absolute;inset:0 0 0 108px;background:linear-gradient(90deg,transparent 49.8%,rgba(242,237,227,.08) 50%,transparent 50.2%),linear-gradient(rgba(242,237,227,.06) 1px,transparent 1px);background-size:100% 100%,100% 96px;pointer-events:none}
        .mmt-editorial .vertical{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;letter-spacing:.22em;color:rgba(242,237,227,.45);text-transform:uppercase;display:flex;gap:14px;align-items:center}
        .mmt-editorial .vertical i{display:block;width:1px;height:74px;background:var(--orange)}
        .mmt-editorial .hero-copy{position:relative;z-index:1;padding:80px 0}.mmt-editorial .eyebrow{color:var(--orange);font-size:10px;letter-spacing:.21em;text-transform:uppercase;font-weight:600}
        .mmt-editorial h1{font-size:clamp(4.5rem,10.4vw,10.5rem);line-height:.82;letter-spacing:-.075em;margin:23px 0 42px;font-weight:600}.mmt-editorial h1 em{font-weight:500;letter-spacing:-.08em}
        .mmt-editorial .hero-note{max-width:390px;border-left:2px solid var(--orange);padding-left:18px;font-size:14px;line-height:1.65;color:rgba(242,237,227,.7)}
        .mmt-editorial .hero-aside{align-self:stretch;border-left:1px solid var(--line);padding:145px 0 0 30px;position:relative;z-index:1}.mmt-editorial .aside-number{font-size:100px;line-height:.8;color:rgba(242,237,227,.09);font-weight:700;letter-spacing:-.1em;margin-left:-7px}
        .mmt-editorial .aside-title{font-size:17px;line-height:1.25;margin:36px 0 13px;font-weight:600}.mmt-editorial .aside-copy{font-size:12px;line-height:1.6;color:rgba(242,237,227,.5);max-width:200px}
        .mmt-editorial .circle-link{border:1px solid rgba(236,101,45,.65);border-radius:50%;height:70px;width:70px;background:transparent;color:var(--orange);display:grid;place-items:center;cursor:pointer;margin-top:46px}.mmt-editorial .circle-link:hover{background:var(--orange);color:#fff}
        .mmt-editorial .cream-section{background:var(--cream);color:var(--ink);padding:92px 0 112px;border-radius:44px 44px 0 0;position:relative;z-index:2}
        .mmt-editorial .section-head{display:flex;align-items:center;gap:18px;text-transform:uppercase;font-size:10px;letter-spacing:.2em;font-weight:700;color:rgba(16,27,43,.5)}.mmt-editorial .section-head span:first-child{color:var(--orange);font-family:'DM Mono',monospace}.mmt-editorial .section-head:after{content:"";height:1px;background:rgba(16,27,43,.16);flex:1}
        .mmt-editorial .approach-grid{display:grid;grid-template-columns:40% 1fr;gap:100px;margin-top:74px;align-items:start}.mmt-editorial .approach-grid h2{font-size:clamp(3rem,5.4vw,6.6rem);line-height:.9;letter-spacing:-.07em;margin:0}.mmt-editorial .approach-grid h2 em{display:block;color:var(--orange);font-weight:500;margin-left:44px}.mmt-editorial .approach-copy{max-width:410px;padding-top:14px}.mmt-editorial .approach-copy p{font-size:17px;line-height:1.65;margin:0 0 28px;color:rgba(16,27,43,.65)}.mmt-editorial .text-link{border:0;border-bottom:1px solid var(--orange);padding:0 0 7px;background:none;color:var(--ink);cursor:pointer;font-size:11px;letter-spacing:.13em;text-transform:uppercase;font-weight:700}
        .mmt-editorial .ecosystem{background:var(--paper);color:var(--ink);padding:95px 0}.mmt-editorial .eco-layout{display:grid;grid-template-columns:33% 1fr;gap:90px;margin-top:76px}.mmt-editorial .eco-intro h2{font-size:clamp(2.5rem,4vw,4.6rem);line-height:.95;letter-spacing:-.07em;margin:0 0 23px}.mmt-editorial .eco-intro p{font-size:14px;color:rgba(16,27,43,.56);line-height:1.65;max-width:260px}.mmt-editorial .sector-list{border-top:1px solid rgba(16,27,43,.2)}.mmt-editorial .sector{display:grid;grid-template-columns:65px 1fr 30px;gap:20px;align-items:center;border-bottom:1px solid rgba(16,27,43,.2);padding:22px 0;cursor:pointer;transition:padding .3s}.mmt-editorial .sector:hover,.mmt-editorial .sector.active{padding-left:15px;padding-right:15px;background:rgba(236,101,45,.08)}.mmt-editorial .sector-index{font:11px 'DM Mono',monospace;color:var(--orange)}.mmt-editorial .sector-icon{width:34px;height:34px;border:1px solid rgba(16,27,43,.18);border-radius:50%;display:grid;place-items:center;color:var(--orange)}.mmt-editorial .sector-name{font-size:20px;font-weight:600}.mmt-editorial .sector-description{font-size:12px;color:rgba(16,27,43,.53);margin-top:4px}.mmt-editorial .sector-arrow{color:var(--orange);opacity:0;transform:translateX(-5px);transition:opacity .2s,transform .2s}.mmt-editorial .sector.active .sector-arrow,.mmt-editorial .sector:hover .sector-arrow{opacity:1;transform:none}
        .mmt-editorial .contact{background:var(--orange);padding:98px 0;color:#fff;position:relative;overflow:hidden}.mmt-editorial .contact:after{content:"MMT";position:absolute;font-size:clamp(11rem,25vw,30rem);font-weight:700;letter-spacing:-.12em;line-height:.7;right:-.08em;bottom:-.04em;color:rgba(16,27,43,.11);pointer-events:none}.mmt-editorial .contact-inner{position:relative;z-index:1;display:flex;align-items:end;justify-content:space-between;gap:40px}.mmt-editorial .contact h2{font-size:clamp(3.5rem,7vw,8rem);letter-spacing:-.08em;line-height:.84;margin:18px 0 0}.mmt-editorial .contact h2 em{font-weight:500}.mmt-editorial .contact-side{max-width:250px;font-size:13px;line-height:1.7}.mmt-editorial .contact-side a{display:inline-flex;align-items:center;gap:10px;color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.5);padding:14px 0;font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
        .mmt-editorial .footer{background:var(--ink);padding:28px 0;color:rgba(242,237,227,.5);font-size:10px;letter-spacing:.12em;text-transform:uppercase}.mmt-editorial .footer .shell{display:flex;justify-content:space-between;gap:20px}.mmt-editorial .footer strong{color:var(--cream)}
        @media(max-width:800px){.mmt-editorial .shell{padding:0 22px}.mmt-editorial .topbar{height:72px}.mmt-editorial .navlinks{display:none}.mmt-editorial .menu-btn{display:block}.mmt-editorial .mobile-menu{position:absolute;top:72px;left:0;right:0;background:var(--ink);border-bottom:1px solid var(--line);padding:20px 22px;display:grid;gap:18px}.mmt-editorial .mobile-menu button{border:0;background:none;color:var(--cream);text-align:left;font-size:11px;letter-spacing:.16em;text-transform:uppercase}.mmt-editorial .hero{grid-template-columns:1fr;min-height:650px}.mmt-editorial .hero:before{left:0}.mmt-editorial .vertical,.mmt-editorial .hero-aside{display:none}.mmt-editorial .hero-copy{padding:70px 0 100px}.mmt-editorial h1{font-size:clamp(4.5rem,21vw,8rem)}.mmt-editorial .approach-grid,.mmt-editorial .eco-layout{grid-template-columns:1fr;gap:45px;margin-top:52px}.mmt-editorial .approach-grid h2{font-size:clamp(3.5rem,16vw,6rem)}.mmt-editorial .ecosystem,.mmt-editorial .cream-section{padding:72px 0 78px}.mmt-editorial .contact-inner{display:block}.mmt-editorial .contact-side{margin-top:45px}.mmt-editorial .footer .shell{display:block;line-height:2}.mmt-editorial .footer span{display:block}}
      `}</style>

      <header className="shell topbar">
        <a className="brand" href="#top" onClick={() => jump("top")}>
          <span className="brandmark">M</span>
          MMT <span style={{ fontWeight: 400, opacity: 0.65 }}>GLOBAL</span>
        </a>
        <nav className="navlinks" aria-label="Ana navigasyon">
          <button onClick={() => jump("approach")}>Bakış açımız</button>
          <button onClick={() => jump("ecosystem")}>Ekosistem</button>
          <button onClick={() => jump("contact")}>İletişim</button>
          <button className="portal" onClick={() => jump("contact")}>Portala giriş</button>
        </nav>
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menüyü aç">
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        {menuOpen && <div className="mobile-menu"><button onClick={() => jump("approach")}>Bakış açımız</button><button onClick={() => jump("ecosystem")}>Ekosistem</button><button onClick={() => jump("contact")}>İletişim</button></div>}
      </header>

      <section className="shell hero" id="top">
        <div className="vertical mono"><i />Sınır tanımayan güç / 2024</div>
        <div className="hero-copy">
          <div className="eyebrow mono">MMT GLOBAL / FİNANS EKOSİSTEMİ</div>
          <h1>Üret.<br /><em className="serif">Tanıt.</em><br />Sat.</h1>
          <p className="hero-note">İlerlemenin arkasındaki insanları, sermayeyi ve yetkinliği sektörler, sınırlar ve nesiller arasında birbirine bağlarız.</p>
        </div>
        <aside className="hero-aside">
          <div className="aside-number">01</div>
          <div className="eyebrow mono">Bakış açımız</div>
          <h2 className="aside-title">Geleceği bugünden kuran bir ortaklık.</h2>
          <p className="aside-copy">Bir fikri büyütmek, doğru insanları aynı masaya getirmekle başlar.</p>
          <button className="circle-link" onClick={() => jump("approach")} aria-label="Bakış açımıza git"><ArrowDown size={20} /></button>
        </aside>
      </section>

      <section className="cream-section" id="approach">
        <div className="shell">
          <div className="section-head"><span>01</span><span>Bakış açımız</span></div>
          <div className="approach-grid">
            <h2>Geleceği <em className="serif">inşa</em> ediyoruz.</h2>
            <div className="approach-copy"><p>MMT Global yalnızca bugünün ihtiyaçlarına cevap vermez; yarının fırsatlarını da öngörür. Güçlü finansal yapımız ve çok uluslu uzmanlığımızla her sektörde sürdürülebilir değer yaratırız.</p><button className="text-link" onClick={() => jump("ecosystem")}>Hikayemizi keşfet <ArrowRight size={14} style={{ verticalAlign: "middle", marginLeft: 8 }} /></button></div>
          </div>
        </div>
      </section>

      <section className="ecosystem" id="ecosystem">
        <div className="shell">
          <div className="section-head"><span>02</span><span>Ekosistem</span></div>
          <div className="eco-layout">
            <div className="eco-intro"><h2>Bir ağ.<br /><span style={{ color: "var(--orange)" }}>Beş yön.</span></h2><p>Uzmanlıkları birbirine bağlar, büyümenin yalnız değil birlikte daha güçlü olduğuna inanırız.</p></div>
            <div className="sector-list">{sectors.map((sector, index) => { const Icon = sector.icon; return <button key={sector.index} className={`sector ${activeSector === index ? "active" : ""}`} onClick={() => setActiveSector(index)}><span className="sector-index">{sector.index}</span><span style={{ display: "flex", alignItems: "center", gap: 16 }}><span className="sector-icon"><Icon size={16} /></span><span><span className="sector-name" style={{ display: "block", textAlign: "left" }}>{sector.title}</span><span className="sector-description" style={{ display: "block", textAlign: "left" }}>{sector.text}</span></span></span><ArrowRight className="sector-arrow" size={18} /></button>; })}</div>
          </div>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="shell contact-inner"><div><div className="eyebrow mono" style={{ color: "#fff" }}>Birlikte başlayalım</div><h2>Küresel büyümeye<br /><em className="serif">hazır mısınız?</em></h2></div><div className="contact-side"><p>Sınırları aşan projelerde güvenilir iş ortağınız olmak için buradayız.</p><a href="tel:+441143521434"><Phone size={15} /> +44 114 352 1434</a></div></div>
      </section>
      <footer className="footer"><div className="shell"><span>© 2024 <strong>MMT Global Finance</strong></span><span>İstanbul / Sheffield / Dünya</span></div></footer>
    </main>
  );
}