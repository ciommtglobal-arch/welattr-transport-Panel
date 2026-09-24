import { ArrowRight, Globe2, Megaphone } from "lucide-react";
import "./_shared/mmt.css";
import { Header, SectionIntro } from "./_shared/Shared";

const fields = [
  ["Lojistik ve Taşımacılık", "Lojistik uzmanlığı ve dijital iş takibi için çalışma alanı. Hizmet operasyonunun durumu doğrulanmamıştır.", "Dijital özellik"],
  ["Uluslararası Ticaret ve B2B", "Üretici, alıcı ve iş ortağı akışları için dijital B2B özellikleri. Şirket veya hizmet faaliyeti doğrulanmamıştır.", "Dijital özellik"],
  ["Finansman Danışmanlığı", "İşletmeler için finansman seçenekleri ve yönlendirme süreçleri.", "Hazırlık"],
  ["Sağlık Turizmi", "Sınır ötesi sağlık hizmetleri için uzmanlık ve iş birliği zemini.", "Hazırlık"],
  ["İnşaat ve Gelişim", "Proje, ürün ve uygulama ortaklıkları için gelişen çalışma alanı.", "Hazırlık"],
  ["Medya ve Tanıtım", "Onaylı içerik, firma tanıtımı ve kurumsal iletişim araçları.", "Pilot"],
];
const regions = [["Türkiye", "Merkezden yürütülen çalışma ve iş ortağı koordinasyonu için ana bölge."], ["Ukrayna", "Uluslararası ağ kapsamında araştırılan bölgesel çalışma alanı."], ["Dubai / BAE", "Ticaret ve lojistik bağlantıları için hazırlık kapsamında inceleniyor."], ["Irak", "Bölgesel ticaret ve operasyon ihtiyaçları için hazırlık alanı."]];

export function CorporateHome() {
  return <div className="mmt-page"><div className="mmt-shell"><Header /></div>
    <main>
      <section className="mmt-shell mmt-hero">
        <div><p className="mmt-kicker">MMT GLOBAL / KURUMSAL YAPI</p><h1 className="mmt-h1">Uzmanlığı, ticareti ve operasyonu bir araya getiriyoruz.</h1><p className="mmt-lead">MMT Global; farklı alanlardaki uzmanları, işletmeleri ve iş ortaklarını ortak çalışma ve takip sistemiyle buluşturmak için gelişiyor.</p><div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:30}}><a className="mmt-button" href="#faaliyet" onClick={(e)=>e.preventDefault()}>Faaliyet Alanlarımız <ArrowRight size={15}/></a><a className="mmt-button secondary" href="#ortaklik" onClick={(e)=>e.preventDefault()}>İş Birliği Başvurusu <ArrowRight size={15}/></a></div></div>
        <aside className="mmt-hero-note"><p className="mmt-kicker">Açık durum</p><p>Bu yapı erken aşamadadır. Her faaliyet alanı için operasyonel durum, doğrulama ve hazırlık seviyesi ayrı gösterilir.</p></aside>
      </section>
      <section id="faaliyet" className="mmt-shell mmt-section"><SectionIntro kicker="01 / Faaliyet alanları" title="Birden çok alan, tek çalışma disiplini" description="Hazırlık aşamasındaki alanlar, faal bir hizmet gibi sunulmaz. Durum etiketleri mevcut kapsamı açıkça ayırır."/><div className="mmt-field-grid">{fields.map(([title, text, status], i) => <article className="mmt-field" key={title}><span className={`mmt-status ${status === "Hazırlık" ? "prep" : ""}`}>{status}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>
      <section className="mmt-shell mmt-section"><SectionIntro kicker="02 / Uluslararası ağ" title="Bölgesel çalışma kartları" description="Kartlar bir çalışma odağını gösterir; doğrulanmamış ofis, şirket veya yerleşke iddiası içermez."/><div className="mmt-regions">{regions.map(([city,text]) => <article className="mmt-region" key={city}><Globe2 size={17} color="var(--orange)"/><b>{city}</b><p>{text}</p></article>)}</div></section>
      <section className="mmt-shell mmt-section"><SectionIntro kicker="03 / Çalışma biçimimiz" title="Talebin izini kaybetmeden ilerleriz" description="Her iş dosyası sorumlusu, durumu, tarihi ve bir sonraki adımı görünür kılacak şekilde ele alınır."/><div className="mmt-steps">{["Talep","Uzman değerlendirmesi","Planlama","Gerekli onay","Uygulama ve raporlama"].map((step,i)=><div className="mmt-step" key={step}><span>0{i+1}</span><b>{step}</b></div>)}</div></section>
      <section className="mmt-shell mmt-section"><SectionIntro kicker="04 / Pilot günlüğü ve medya" title="Sadece hazırlığı ve onayı tamamlananı paylaşırız" description="Medya Merkezi ve B2B şirket görevleri üretim akışında mevcut araçlardır; bu önizleme canlı içerik göstermez."/><div className="mmt-empty"><Megaphone size={16}/> Onaylanmış duyuru veya yayınlanabilir pilot kaydı bulunmuyor.<br/><small>Durum: TASLAK / HAZIRLIK · Sorumlu, tarih ve sonraki adım canlı çalışma alanında tutulur.</small></div></section>
      <section id="ortaklik" className="mmt-shell mmt-section"><div className="mmt-contact"><div><p className="mmt-kicker">05 / İş ortağı ve uzman katılımı</p><h2 className="mmt-h2">Bir çalışma alanına katkı sunmak ister misiniz?</h2><p>Uzmanlık alanınızı, şirketinizi veya bölgesel bağlantınızı doğrulanabilir bilgilerle paylaşın. Uygunluk ve rol değerlendirmesi çalışma dosyası üzerinden yapılır.</p></div><a href="#basvuru" onClick={(e)=>e.preventDefault()} className="mmt-button">Başvuru çerçevesini gör <ArrowRight size={15}/></a></div></section>
      <footer className="mmt-shell mmt-footer"><span>© MMT Global · Kurumsal önizleme</span><span>TR / EN / AR / RU · Eksik çeviriler ayrıca belirtilir</span></footer>
    </main>
  </div>;
}