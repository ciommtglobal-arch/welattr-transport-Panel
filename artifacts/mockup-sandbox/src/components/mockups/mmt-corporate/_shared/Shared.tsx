import { Menu, X, ArrowUpRight, Bell, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

type HeaderProps = { management?: boolean; managementLabel?: string };
const publicLinks = ["Kurumsal", "Faaliyet Alanları", "Uluslararası Ağ", "İş Ortaklığı", "Medya", "İletişim"];

export function Header({ management = false, managementLabel = "Kurucu görünümü" }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const managementLinks = managementLabel === "Uzman görünümü" ? ["Bugünkü görevler", "Dosyalarım", "Bekleyen işler", "Destek talepleri", "Güncellemeler", "Ekip"] : ["Genel bakış", "Faaliyet alanları", "Ekipler", "Bölgeler", "İş dosyaları", "Bekleyen onaylar", "Raporlar", "Medya Merkezi"];
  return <header className="mmt-topbar">
    <a href="#" onClick={(e) => e.preventDefault()} aria-label="MMT Global ana sayfa">
      <img className="mmt-logo" src="/__mockup/images/mmt-logo.svg" alt="MMT Global" />
    </a>
    {!management && <nav className="mmt-nav" aria-label="Ana navigasyon">
      {publicLinks.map((link) => <a href={`#${link}`} key={link} onClick={(e) => e.preventDefault()}>{link}</a>)}
      <a className="mmt-entry" href="#calisma" onClick={(e) => e.preventDefault()}>Çalışma Alanına Giriş <ArrowUpRight size={13} /></a>
    </nav>}
    {management && <div className="mmt-user"><UserRound size={14} /> {managementLabel}</div>}
    <div className="mmt-toolbar">
      <button className="mmt-language-button" type="button" onClick={() => { setLanguagesOpen(!languagesOpen); setOpen(false); }} aria-label="Dil durumu" aria-expanded={languagesOpen} aria-controls="mmt-language-panel">TR</button>
      <button className="mmt-menu-button" type="button" onClick={() => { setOpen(!open); setLanguagesOpen(false); }} aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open}>{open ? <X size={19} /> : <Menu size={19} />}</button>
    </div>
    {languagesOpen && <div id="mmt-language-panel" className="mmt-language-panel">
      <strong>Arayüz dilleri</strong>
      <p>Bu tasarım önizlemesi Türkçedir. Canlı sitedeki dört dil korunur.</p>
      <span>TR · EN · AR · RU <small>Mevcut sitede</small></span>
      <span>Kurmançî · Soranî · Українська <small>Çeviri hazırlığı</small></span>
      <p>Arapça için mevcut sağdan sola düzen korunacak; Soranice düzeni taslaktır.</p>
    </div>}
    {management && <div className={`mmt-mobile-menu ${open ? "open" : ""}`} aria-hidden={!open}>
      {managementLinks.map((link) => <a href="#" key={link} onClick={(e) => { e.preventDefault(); setOpen(false); }}>{link}</a>)}
    </div>}
    {!management && <div className={`mmt-mobile-menu ${open ? "open" : ""}`} aria-hidden={!open}>
      {publicLinks.map((link) => <a href={`#${link}`} key={link} onClick={() => setOpen(false)}>{link}</a>)}
      <a className="mmt-entry" href="#calisma" onClick={() => setOpen(false)}>Çalışma Alanına Giriş</a>
    </div>}
  </header>;
}

export function SectionIntro({ kicker, title, description }: { kicker: string; title: string; description?: string }) {
  return <div className="mmt-section-head"><div><p className="mmt-kicker">{kicker}</p><h2 className="mmt-h2">{title}</h2></div>{description && <p>{description}</p>}</div>;
}

export function EmptyTable({ columns, text }: { columns: string[]; text: string }) {
  return <div className="mmt-records"><div className="mmt-record-head">{columns.map((column) => <span key={column}>{column}</span>)}</div><div className="mmt-empty">{text}<br /><small>Bu önizlemede kayıt, tarih veya durum verisi yok. Canlı çalışma alanına bağlandığında burada gösterilir.</small></div></div>;
}

export function ManagementLayout({ children, active = "Genel bakış", managementLabel = "Kurucu görünümü", links }: { children: ReactNode; active?: string; managementLabel?: string; links?: string[] }) {
  const navLinks = links ?? ["Genel bakış", "Faaliyet alanları", "Ekipler", "Bölgeler", "İş dosyaları", "Bekleyen onaylar", "Raporlar", "Medya Merkezi"];
  return <div className="mmt-page mmt-management"><div className="mmt-shell"><Header management managementLabel={managementLabel} /><div className="mmt-workspace">
    <aside className="mmt-side"><p className="mmt-side-label">Çalışma alanı</p>{navLinks.map((link) => <a className={link === active ? "active" : ""} href="#" key={link} onClick={(e) => e.preventDefault()}>{link}</a>)}</aside>
    <main className="mmt-main">{children}</main>
  </div></div></div>;
}

export function EmptyRows({ text }: { text: string }) {
  return <div className="mmt-empty"><Bell size={15} /> {text}<br /><small>Bu önizleme canlı hesap veya API bağlantısı içermez.</small></div>;
}