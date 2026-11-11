import { ClipboardCheck, FileText, MapPinned, UsersRound } from "lucide-react";
import "./_shared/mmt.css";
import { EmptyTable, ManagementLayout } from "./_shared/Shared";

const columns = ["Sorumlu", "Durum", "Tarih", "Yapılacak işlem"];

export function FounderOverview() {
  return <ManagementLayout active="Genel bakış"><div className="mmt-management-header"><div><p className="mmt-kicker">Kurucu çalışma alanı / TASLAK</p><h1 className="mmt-management-title">Yönetim görünümü</h1><p className="mmt-management-sub">Öncelik alanları: bekleyen kararlar, devam eden ve geciken işler, ekip / bölge durumu, son etkinlikler.</p></div><div className="mmt-user">Rol kapıları üretimde ayrıca uygulanır</div></div>
    <div className="mmt-dashboard-grid">
      <section className="mmt-panel"><h2><ClipboardCheck size={17}/> Bekleyen kararlar ve onaylar</h2><EmptyTable columns={columns} text="Bekleyen onay kaydı yok."/><div className="mmt-note">Bu alan özelliği üretimde mevcuttur. Kurucu görünümü, ilgisiz şirketler üzerinde küresel yetki anlamına gelmez; rol ve kapsam kontrolü gereklidir.</div></section>
      <section className="mmt-panel"><h2><FileText size={17}/> Devam eden ve geciken işler</h2><EmptyTable columns={columns} text="Devam eden veya geciken iş kaydı yok."/><div className="mmt-note">İş dosyası takibi üretimde mevcut bir çalışma aracıdır.</div></section>
      <section className="mmt-panel"><h2><UsersRound size={17}/> Ekip ve bölgeler operasyonel durumu</h2><EmptyTable columns={columns} text="Ekip veya bölge durum kaydı yok."/><div className="mmt-note">Ekip ve bölge görünümü hazırlık kapsamındadır; bu önizleme atama verisi içermez.</div></section>
      <section className="mmt-panel"><h2><MapPinned size={17}/> Son etkinlikler ve bildirimler</h2><EmptyTable columns={columns} text="Son etkinlik veya bildirim kaydı yok."/><div className="mmt-note">B2B şirket görevleri, onaylar ve bildirim araçları üretimde mevcut olabilir; bu sandbox canlı veriye bağlı değildir.</div></section>
    </div>
  </ManagementLayout>;
}