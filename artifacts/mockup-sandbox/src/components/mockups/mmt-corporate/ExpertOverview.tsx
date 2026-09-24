import { BriefcaseBusiness, CircleHelp, ListChecks, RefreshCw } from "lucide-react";
import "./_shared/mmt.css";
import { EmptyTable, ManagementLayout } from "./_shared/Shared";

const columns = ["Sorumlu", "Durum", "Tarih", "Yapılacak işlem"];
const expertLinks = ["Bugünkü görevler", "Dosyalarım", "Bekleyen işler", "Destek talepleri", "Güncellemeler", "Ekip"];

export function ExpertOverview() {
  return <ManagementLayout active="Bugünkü görevler" managementLabel="Uzman görünümü" links={expertLinks}><div className="mmt-management-header"><div><p className="mmt-kicker">Uzman çalışma alanı / HAZIRLIK</p><h1 className="mmt-management-title">Çalışma sıranız</h1><p className="mmt-management-sub">Öncelik alanları: bugün yapılacaklar, atanmış dosyalar, bekleyen iş / destek ve son güncellemeler.</p></div><div className="mmt-user">Uzman görünümü</div></div>
    <div className="mmt-dashboard-grid">
      <section className="mmt-panel wide"><h2><ListChecks size={17}/> Bugünün görevleri</h2><EmptyTable columns={columns} text="Bugün için atanmış görev kaydı yok."/><div className="mmt-note">Görev atama özelliği üretimde kullanılabilir; bu önizleme herhangi bir kullanıcıya görev atamaz.</div></section>
      <section className="mmt-panel"><h2><BriefcaseBusiness size={17}/> Atanmış dosyalar</h2><EmptyTable columns={columns} text="Size atanmış dosya kaydı yok."/><div className="mmt-note">Dosya çalışma alanı hazırlık görünümündedir.</div></section>
      <section className="mmt-panel"><h2><CircleHelp size={17}/> Bekleyen iş ve destek</h2><EmptyTable columns={columns} text="Bekleyen iş veya destek kaydı yok."/><div className="mmt-note">Destek talebi aracı üretimde mevcut olabilir; bu sandbox canlı kuyruğa bağlı değildir.</div></section>
      <section className="mmt-panel wide"><h2><RefreshCw size={17}/> Son güncellemeler</h2><EmptyTable columns={columns} text="Son güncelleme veya bildirim kaydı yok."/><div className="mmt-note">Güncelleme ve bildirim görünümü canlı veri olmadan boş tutulmuştur.</div></section>
    </div>
  </ManagementLayout>;
}