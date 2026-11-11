import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Factory,
  Menu,
  Phone,
  Stethoscope,
  Truck,
  Tv,
  X,
} from "lucide-react";

type Sector = {
  id: string;
  label: string;
  kicker: string;
  summary: string;
  detail: string;
  metric: string;
  icon: typeof Truck;
};

const sectors: Sector[] = [
  {
    id: "01",
    label: "Lojistik",
    kicker: "HAREKETİN ALTYAPISI",
    summary: "Kıtaları birbirine bağlayan tedarik zincirleri.",
    detail: "Üretimden teslimata kadar akışın her durağında görünürlük, hız ve güven yaratıyoruz.",
    metric: "18 ülke / tek ağ",
    icon: Truck,
  },
  {
    id: "02",
    label: "Sağlık turizmi",
    kicker: "UZMANLIĞIN YOLCULUĞU",
    summary: "Bakımı, uzmanlığı ve modern tesisleri buluştururuz.",
    detail: "Doğru hizmeti doğru insanla eşleştiren, sınır ötesi deneyimler tasarlıyoruz.",
    metric: "42 uzmanlık hattı",
    icon: Stethoscope,
  },
  {
    id: "03",
    label: "İnşaat & gelişim",
    kicker: "YARININ ŞEHİRLERİ",
    summary: "Bölgesel projelerle şehirlerin yarınını planlarız.",
    detail: "Sermayeyi, mimariyi ve yerel bilgiyi uzun ömürlü yaşam alanlarında birleştiriyoruz.",
    metric: "7 aktif bölge",
    icon: Building2,
  },
  {
    id: "04",
    label: "Medya & marka",
    kicker: "FİKRİN SESİ",
    summary: "İyi fikirlere küresel bir ses, markalara net bir yön.",
    detail: "Stratejiden hikâyeye, markaların doğru yerde ve doğru tonda duyulmasını sağlıyoruz.",
    metric: "26 pazar / 1 dil",
    icon: Tv,
  },
  {
    id: "05",
    label: "Sanayi ticareti",
    kicker: "ÜRETİMDEN PAZARA",
    summary: "Ölçülebilir, sağlam ortaklıklar kurarız.",
    detail: "Üretim kapasitesini yeni pazarlara bağlayan ticari köprüler inşa ediyoruz.",
    metric: "31 uzun ortaklık",
    icon: Factory,
  },
];

export default function MmtGlobalNavigator() {
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = sectors[active];
  const Icon = current.icon;

  const jump = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="mmt-navigator">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,500;1,500&display=swap');
        .mmt-navigator{--navy:#101a29;--navy2:#192a40;--cream:#f4efe5;--paper:#fbf8f1;--orange:#ea632c;--ink:#142238;--line:rgba(244,239,229,.2);min-height:100vh;background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;overflow:hidden}
        .mmt-navigator *{box-sizing:border-box}.mmt-navigator button,.mmt-navigator a{font:inherit}.mmt-navigator .mono{font-family:'DM Mono',monospace}.mmt-navigator .serif{font-family:'Playfair Display',serif}
        .mmt-navigator .wrap{max-width:1420px;margin:auto;padding:0 58px}.mmt-navigator .dark{background:var(--navy);color:var(--cream)}
        .mmt-navigator .nav{height:86px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:relative;z-index:5}
        .mmt-navigator .brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--cream);font-size:13px;font-weight:700;letter-spacing:.16em}.mmt-navigator .mark{background:var(--orange);color:white;width:30px;height:30px;display:grid;place-items:center;border-radius:10px 0;font-size:15px}
        .mmt-navigator .nav-actions{display:flex;align-items:center;gap:30px}.mmt-navigator .nav-actions button{background:none;border:0;color:var(--cream);opacity:.65;text-transform:uppercase;letter-spacing:.16em;font-size:10px;cursor:pointer}.mmt-navigator .nav-actions button:hover{opacity:1;color:var(--orange)}.mmt-navigator .nav-actions .nav-cta{background:var(--orange);color:#fff;opacity:1;padding:14px 18px}
        .mmt-navigator .menu{display:none;background:none;border:0;color:var(--cream);padding:8px;cursor:pointer}
        .mmt-navigator .hero{min-height:690px;display:grid;grid-template-columns:1.18fr .82fr;gap:90px;align-items:center;padding-top:44px;padding-bottom:74px;position:relative}.mmt-navigator .hero:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0 58%,rgba(244,239,229,.06) 58.1%,transparent 58.2%),linear-gradient(rgba(244,239,229,.045) 1px,transparent 1px);background-size:100% 100%,100% 112px;pointer-events:none}
        .mmt-navigator .hero-copy,.mmt-navigator .hero-panel{position:relative;z-index:1}.mmt-navigator .eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--orange);font-weight:600}.mmt-navigator h1{font-size:clamp(4.7rem,10vw,9.9rem);line-height:.83;letter-spacing:-.08em;margin:29px 0 38px;font-weight:600}.mmt-navigator h1 em{font-weight:500}.mmt-navigator .lead{max-width:430px;border-left:2px solid var(--orange);padding-left:18px;color:rgba(244,239,229,.7);font-size:14px;line-height:1.7}
        .mmt-navigator .hero-panel{align-self:stretch;border-left:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;padding-left:42px}.mmt-navigator .panel-top{display:flex;justify-content:space-between;align-items:center;color:rgba(244,239,229,.42);font-size:10px;letter-spacing:.16em;text-transform:uppercase}.mmt-navigator .panel-count{font-size:100px;line-height:.78;letter-spacing:-.1em;color:rgba(244,239,229,.09);font-weight:700;margin:24px 0 22px}.mmt-navigator .hero-panel h2{font-size:27px;line-height:1.14;max-width:300px;margin:0 0 16px}.mmt-navigator .hero-panel p{font-size:13px;line-height:1.7;color:rgba(244,239,229,.54);max-width:290px;margin:0}.mmt-navigator .scroll-link{margin-top:34px;width:max-content;background:none;border:0;color:var(--cream);border-bottom:1px solid var(--orange);padding:0 0 8px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}.mmt-navigator .scroll-link svg{vertical-align:middle;margin-left:8px;color:var(--orange)}
        .mmt-navigator .route{background:var(--cream);border-radius:42px 42px 0 0;padding:85px 0 105px}.mmt-navigator .section-label{display:flex;align-items:center;gap:17px;color:rgba(20,34,56,.5);font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}.mmt-navigator .section-label strong{color:var(--orange);font-family:'DM Mono',monospace;font-weight:400}.mmt-navigator .section-label:after{content:"";height:1px;background:rgba(20,34,56,.17);flex:1}
        .mmt-navigator .route-head{display:flex;justify-content:space-between;align-items:end;gap:35px;margin-top:55px}.mmt-navigator .route-head h2{font-size:clamp(3rem,6vw,6.6rem);letter-spacing:-.08em;line-height:.86;margin:0}.mmt-navigator .route-head h2 em{color:var(--orange);font-weight:500}.mmt-navigator .route-head p{max-width:260px;color:rgba(20,34,56,.58);font-size:13px;line-height:1.65;margin:0 0 3px}
        .mmt-navigator .route-grid{display:grid;grid-template-columns:38% 1fr;gap:78px;margin-top:75px}.mmt-navigator .sector-tabs{border-top:1px solid rgba(20,34,56,.2)}.mmt-navigator .tab{width:100%;display:grid;grid-template-columns:44px 1fr 20px;gap:16px;align-items:center;text-align:left;background:none;border:0;border-bottom:1px solid rgba(20,34,56,.2);padding:19px 0;cursor:pointer;color:var(--ink);transition:padding .25s,background .25s}.mmt-navigator .tab:hover,.mmt-navigator .tab.active{padding-left:14px;padding-right:12px;background:rgba(234,99,44,.09)}.mmt-navigator .tab-index{font:11px 'DM Mono',monospace;color:var(--orange)}.mmt-navigator .tab-name{font-size:16px;font-weight:600}.mmt-navigator .tab-kicker{display:block;font:9px 'DM Mono',monospace;color:rgba(20,34,56,.48);margin-bottom:4px;letter-spacing:.12em}.mmt-navigator .tab-arrow{color:var(--orange);opacity:0;transform:translateX(-5px);transition:opacity .2s,transform .2s}.mmt-navigator .tab.active .tab-arrow,.mmt-navigator .tab:hover .tab-arrow{opacity:1;transform:none}
        .mmt-navigator .detail{min-height:360px;background:var(--navy);color:var(--cream);padding:42px 46px;position:relative;overflow:hidden}.mmt-navigator .detail:after{content:"";position:absolute;width:250px;height:250px;border:1px solid rgba(234,99,44,.35);border-radius:50%;right:-80px;bottom:-130px}.mmt-navigator .detail-icon{width:52px;height:52px;border:1px solid rgba(244,239,229,.3);border-radius:50%;display:grid;place-items:center;color:var(--orange);margin-bottom:56px}.mmt-navigator .detail h3{font-size:clamp(2rem,4vw,4rem);letter-spacing:-.07em;line-height:.9;margin:0 0 18px}.mmt-navigator .detail p{max-width:360px;color:rgba(244,239,229,.62);line-height:1.65;font-size:14px;margin:0}.mmt-navigator .detail-foot{display:flex;justify-content:space-between;align-items:end;margin-top:48px;gap:20px}.mmt-navigator .detail-metric{font:10px 'DM Mono',monospace;color:var(--orange);letter-spacing:.08em;text-transform:uppercase}.mmt-navigator .detail-link{color:var(--cream);text-decoration:none;border-bottom:1px solid var(--orange);padding-bottom:7px;font-size:10px;letter-spacing:.15em;text-transform:uppercase}.mmt-navigator .detail-link svg{vertical-align:middle;margin-left:7px;color:var(--orange)}
        .mmt-navigator .contact{background:var(--orange);color:#fff;padding:94px 0;position:relative;overflow:hidden}.mmt-navigator .contact:after{content:"MMT";position:absolute;right:-.07em;bottom:-.04em;font-size:clamp(11rem,25vw,29rem);line-height:.7;letter-spacing:-.13em;font-weight:700;color:rgba(20,34,56,.12);pointer-events:none}.mmt-navigator .contact-inner{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:end;gap:40px}.mmt-navigator .contact h2{font-size:clamp(3.5rem,7vw,7.8rem);letter-spacing:-.09em;line-height:.85;margin:16px 0 0}.mmt-navigator .contact h2 em{font-weight:500}.mmt-navigator .contact-side{max-width:255px;font-size:13px;line-height:1.7}.mmt-navigator .contact-side a{color:#fff;text-decoration:none;display:flex;align-items:center;gap:10px;margin-top:30px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.55);font-size:11px;letter-spacing:.15em;font-weight:700}
        .mmt-navigator .footer{background:var(--navy);color:rgba(244,239,229,.5);padding:27px 0;font:10px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase}.mmt-navigator .footer .wrap{display:flex;justify-content:space-between}.mmt-navigator .footer strong{color:var(--cream)}
        @media(max-width:800px){.mmt-navigator .wrap{padding:0 22px}.mmt-navigator .nav{height:72px}.mmt-navigator .nav-actions{display:none}.mmt-navigator .menu{display:block}.mmt-navigator .mobile{position:absolute;top:72px;left:0;right:0;background:var(--navy);padding:22px;display:grid;gap:17px;border-bottom:1px solid var(--line)}.mmt-navigator .mobile button{background:none;border:0;color:var(--cream);text-align:left;text-transform:uppercase;letter-spacing:.16em;font-size:10px}.mmt-navigator .hero{grid-template-columns:1fr;min-height:650px;padding-top:30px}.mmt-navigator .hero-panel{display:none}.mmt-navigator h1{font-size:clamp(4.7rem,21vw,8rem);margin-top:24px}.mmt-navigator .route{padding:70px 0 78px}.mmt-navigator .route-head{display:block;margin-top:45px}.mmt-navigator .route-head p{margin-top:26px}.mmt-navigator .route-grid{grid-template-columns:1fr;gap:42px;margin-top:50px}.mmt-navigator .detail{min-height:340px;padding:30px 26px}.mmt-navigator .detail-icon{margin-bottom:47px}.mmt-navigator .contact{padding:76px 0}.mmt-navigator .contact-inner{display:block}.mmt-navigator .contact-side{margin-top:40px}.mmt-navigator .footer .wrap{display:block;line-height:2.3}}
      `}</style>

      <section className="dark">
        <header className="wrap nav">
          <a className="brand" href="#top" onClick={() => jump("top")}>
            <span className="mark">M</span>MMT <span style={{ opacity: 0.62, fontWeight: 400 }}>GLOBAL</span>
          </a>
          <nav className="nav-actions">
            <button onClick={() => jump("route")}>Ekosistem</button>
            <button onClick={() => jump("contact")}>İletişim</button>
            <button className="nav-cta" onClick={() => jump("contact")}>Portala giriş</button>
          </nav>
          <button className="menu" onClick={() => setMenuOpen((value) => !value)} aria-label="Menüyü aç">
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          {menuOpen && <div className="mobile"><button onClick={() => jump("route")}>Ekosistem</button><button onClick={() => jump("contact")}>İletişim</button><button onClick={() => jump("contact")}>Portala giriş</button></div>}
        </header>
        <div className="wrap hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow mono">MMT GLOBAL / FİNANS EKOSİSTEMİ</div>
            <h1>Birlikte<br /><em className="serif">ilerle.</em></h1>
            <p className="lead">İlerlemenin arkasındaki insanları, sermayeyi ve yetkinliği sektörler, sınırlar ve nesiller arasında birbirine bağlarız.</p>
          </div>
          <aside className="hero-panel">
            <div className="panel-top mono"><span>İlk adım</span><span>MMT / 01</span></div>
            <div className="panel-count">01</div>
            <div className="eyebrow mono">Bakış açımız</div>
            <h2>Doğru insanları aynı masaya getirerek büyürüz.</h2>
            <p>Bir fikri küresel bir harekete dönüştürmek için finansı, uzmanlığı ve cesareti aynı hatta topluyoruz.</p>
            <button className="scroll-link" onClick={() => jump("route")}>Rotanı seç <ArrowRight size={14} /></button>
          </aside>
        </div>
      </section>

      <section className="route" id="route">
        <div className="wrap">
          <div className="section-label"><strong>02</strong><span>Ekosistemde bir rota</span></div>
          <div className="route-head">
            <h2>Bir ağ.<br /><em className="serif">Beş yön.</em></h2>
            <p>İhtiyacınız olan uzmanlığı seçin. Her yön, büyümeyi ileri taşıyan başka bir güce açılır.</p>
          </div>
          <div className="route-grid">
            <div className="sector-tabs">
              {sectors.map((sector, index) => (
                <button key={sector.id} className={`tab ${active === index ? "active" : ""}`} onClick={() => setActive(index)}>
                  <span className="tab-index">{sector.id}</span>
                  <span><span className="tab-kicker">{sector.kicker}</span><span className="tab-name">{sector.label}</span></span>
                  <ArrowRight className="tab-arrow" size={17} />
                </button>
              ))}
            </div>
            <article className="detail">
              <div className="detail-icon"><Icon size={21} /></div>
              <div className="eyebrow mono">{current.kicker}</div>
              <h3>{current.summary}</h3>
              <p>{current.detail}</p>
              <div className="detail-foot"><span className="detail-metric">{current.metric}</span><a className="detail-link" href="#contact" onClick={() => jump("contact")}>Bu rotayı konuş <ArrowRight size={13} /></a></div>
            </article>
          </div>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="wrap contact-inner"><div><div className="eyebrow mono" style={{ color: "#fff" }}>Bir sonraki adım</div><h2>Rotanızı<br /><em className="serif">birlikte çizelim.</em></h2></div><div className="contact-side"><p>Sınırları aşan projelerde güvenilir iş ortağınız olmak için buradayız.</p><a href="tel:+441143521434"><Phone size={15} /> +44 114 352 1434</a></div></div>
      </section>
      <footer className="footer"><div className="wrap"><span>© 2024 <strong>MMT Global Finance</strong></span><span>İstanbul / Sheffield / Dünya</span></div></footer>
    </main>
  );
}