import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Building2, Check, ChevronRight,
  CircleHelp, ClipboardList, FileCheck2, FileText, Handshake, Landmark,
  MapPinned, PackageCheck, Pencil, Plus, RefreshCw, Search, ShieldCheck,
  Truck, UserRound, UsersRound, X
} from "lucide-react";
import "./_group.css";

type ModuleId = "firm" | "invite" | "partner" | "shipper" | "carrier" | "vehicle" | "dealer" | "staff" | "offer" | "contract" | "operation";
type RegionId = "mersin" | "iraq" | "gaziantep" | "ipekyolu" | "turkiye" | "ukraine" | "dubai";
type RecordStatus = "draft" | "review" | "approved-preview" | "rejected";
type DraftRecord = {
  id: string;
  module: ModuleId;
  region: RegionId;
  name: string;
  status: RecordStatus;
  fields: Record<string, string>;
  updated: string;
};
type FieldSpec = { key: string; label: string; type?: string; required?: boolean; options?: string[]; help?: string; full?: boolean };

const modules: { id: ModuleId; label: string; icon: typeof Building2; hint: string }[] = [
  { id: "firm", label: "Firma Kaydı", icon: Building2, hint: "Yeni firma bilgileri" },
  { id: "invite", label: "Firma Daveti", icon: UsersRound, hint: "E-posta daveti simülasyonu" },
  { id: "partner", label: "İş Ortaklığı", icon: Handshake, hint: "İş ortaklığı başvurusu" },
  { id: "shipper", label: "Yük Veren Firma", icon: PackageCheck, hint: "Yük ve çıkış bilgileri" },
  { id: "carrier", label: "Taşıyıcı / Nakliyeci", icon: Truck, hint: "Taşıyıcı başvurusu ve araç bilgileri" },
  { id: "vehicle", label: "Araç / Tır Kaydı", icon: Truck, hint: "Ayrı araç kaydı taslağı" },
  { id: "dealer", label: "Bayi / Distribütör", icon: Landmark, hint: "Bayi / distribütör başvurusu" },
  { id: "staff", label: "Personel", icon: UserRound, hint: "Personel başvurusu" },
  { id: "offer", label: "Teklif", icon: FileText, hint: "Teklif taslağı" },
  { id: "contract", label: "Sözleşme", icon: FileCheck2, hint: "Sözleşme takibi" },
  { id: "operation", label: "Operasyon Takibi", icon: Activity, hint: "Operasyon ve güzergâh takibi" },
];

const regions: { id: RegionId; label: string; country: string; status: "main" | "prep"; description: string }[] = [
  { id: "mersin", label: "Mersin / Türkiye", country: "Türkiye", status: "main", description: "Ana Lojistik Operasyon Merkezi" },
  { id: "ukraine", label: "Ukrayna", country: "Ukrayna", status: "prep", description: "MMT Global Ukraine · Hazırlık Aşaması" },
  { id: "dubai", label: "Dubai / BAE", country: "BAE", status: "prep", description: "MMT Global Dubai · Hazırlık Aşaması" },
];

const routes: { id: RegionId; label: string }[] = [
  { id: "mersin", label: "Mersin" }, { id: "iraq", label: "Irak" }, { id: "gaziantep", label: "Gaziantep" },
  { id: "ipekyolu", label: "İpekyolu" }, { id: "turkiye", label: "Türkiye geneli" },
  { id: "ukraine", label: "Türkiye–Ukrayna" }, { id: "dubai", label: "Körfez / Dubai" },
];

const companyFlow = ["Firma Kaydı", "Doğrulama", "Bölge Seçimi", "Faaliyet Alanı", "Yönetici İncelemesi", "Kurucu Onayı", "Sözleşme", "Aktif İş Ortağı"];

function CompanyFlowPreview() {
  return <section className="rd-company-flow" aria-label="Firma ve bayi yönetim akışı taslağı">
    <h3>Firma / Bayi Yönetim Akışı</h3>
    <ol>{companyFlow.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
    <p>Planlanan akışın önizlemesidir. Doğrulama, yönetici incelemesi, kurucu onayı ve sözleşme tamamlanmadan aktif ortaklık kurulmaz. Bu ekranda gerçek bayilik, bölge yetkisi, münhasırlık veya personel unvanı verilmez.</p>
  </section>;
}

const moduleFields: Record<ModuleId, FieldSpec[]> = {
  firm: [
    { key: "legalName", label: "Ticari unvan", required: true }, { key: "taxNo", label: "Vergi numarası" },
    { key: "activity", label: "Faaliyet alanı", required: true, options: ["Lojistik", "İthalat / ihracat", "Depolama", "Dış ticaret", "Diğer"] },
    { key: "contact", label: "Kurumsal iletişim", required: true }, { key: "verification", label: "Doğrulama durumu", options: ["Belge bekleniyor", "Ön inceleme", "Bilgi tamamlanacak"] },
    { key: "notes", label: "İnceleme notu", type: "textarea", full: true },
  ],
  invite: [
    { key: "email", label: "Kurumsal e-posta", type: "email", required: true, help: "Bu önizlemede hiçbir e-posta gönderilmez." },
    { key: "company", label: "Firma adı", required: true }, { key: "region", label: "İlgili bölge", required: true, options: ["Mersin", "Irak", "Gaziantep", "İpekyolu", "Türkiye geneli", "Ukrayna (hazırlık)", "Dubai / BAE (hazırlık)"] },
    { key: "purpose", label: "Davet amacı", required: true, options: ["Firma kaydı incelemesi", "İş ortaklığı görüşmesi", "Taşıyıcı ağı ön değerlendirmesi", "Distribütör başvurusu"] },
    { key: "notes", label: "Not", type: "textarea", full: true },
  ],
  partner: [
    { key: "company", label: "Firma adı", required: true }, { key: "partnershipType", label: "İş birliği türü", required: true, options: ["Lojistik iş ortağı", "İthalat / ihracat", "Taşıyıcı ağı", "Ticaret bağlantısı", "Türkiye–Ukrayna ticaret bağlantısı", "Kurumsal iş geliştirme"] },
    { key: "route", label: "Önerilen hat", required: true }, { key: "region", label: "Bölge", required: true, options: ["Mersin", "Irak", "Gaziantep", "İpekyolu", "Türkiye geneli", "Ukrayna (hazırlık)", "Dubai / BAE (hazırlık)"] },
    { key: "contact", label: "Kurumsal iletişim", required: true }, { key: "notes", label: "Başvuru notu", type: "textarea", full: true },
  ],
  shipper: [
    { key: "company", label: "Yük veren firma", required: true }, { key: "cargo", label: "Yük tanımı", required: true },
    { key: "origin", label: "Çıkış noktası", required: true }, { key: "destination", label: "Varış noktası", required: true },
    { key: "loadDate", label: "Planlanan yükleme", type: "date" }, { key: "volume", label: "Miktar / araç ihtiyacı", required: true },
    { key: "notes", label: "Operasyon notu", type: "textarea", full: true },
  ],
  carrier: [
    { key: "company", label: "Taşıyıcı / nakliyeci", required: true }, { key: "vehicle", label: "Araç tipi", required: true, options: ["Çekici + dorse", "Tenteli tır", "Frigo", "Kamyon", "Panelvan", "Diğer"] },
    { key: "plate", label: "Araç / plaka referansı", required: true }, { key: "route", label: "Önerilen güzergâh", required: true },
    { key: "capacity", label: "Taşıma kapasitesi" }, { key: "contact", label: "Kurumsal iletişim", required: true },
    { key: "notes", label: "Belge / inceleme notu", type: "textarea", full: true },
  ],
  vehicle: [
    { key: "reference", label: "Araç / tır kayıt referansı", required: true },
    { key: "plate", label: "Örnek plaka / araç referansı", required: true },
    { key: "vehicle", label: "Araç tipi", required: true, options: ["Çekici + dorse", "Tenteli tır", "Frigo", "Kamyon", "Panelvan", "Diğer"] },
    { key: "company", label: "Taşıyıcı / nakliyeci firma", required: true },
    { key: "capacity", label: "Taşıma kapasitesi", required: true },
    { key: "route", label: "Planlanan güzergâh", required: true },
    { key: "documentStatus", label: "Belge inceleme durumu", options: ["Belge bekleniyor", "Ön inceleme", "Bilgi tamamlanacak"] },
    { key: "notes", label: "İnceleme notu", type: "textarea", full: true, help: "Araç kaydı gerçek filoya veya operasyonlara eklenmez." },
  ],
  dealer: [
    { key: "company", label: "Başvuran firma", required: true }, { key: "type", label: "Başvuru türü", required: true, options: ["Bayi", "Distribütör", "Acente", "Kurumsal iş geliştirme"] },
    { key: "market", label: "Önerilen pazar / bölge", required: true }, { key: "products", label: "İlgili hizmet alanı", required: true },
    { key: "contact", label: "Kurumsal iletişim", required: true }, { key: "notes", label: "Ön değerlendirme notu", type: "textarea", full: true },
  ],
  staff: [
    { key: "candidate", label: "Başvuru referansı", required: true }, { key: "area", label: "İlgilendiği çalışma alanı", required: true, options: ["Lojistik operasyon", "Dış ticaret", "Bölgesel hazırlık", "Operasyon desteği"] },
    { key: "region", label: "Tercih edilen bölge", required: true }, { key: "contact", label: "İletişim", required: true },
    { key: "experience", label: "Deneyim özeti", type: "textarea", full: true }, { key: "notes", label: "İnceleme notu", type: "textarea", full: true },
  ],
  offer: [
    { key: "client", label: "Teklif alıcısı", required: true }, { key: "service", label: "Hizmet / hat", required: true },
    { key: "amount", label: "Teklif tutarı", type: "number", required: true }, { key: "currency", label: "Para birimi", required: true, options: ["USD", "EUR", "TRY", "AED"] },
    { key: "validUntil", label: "Geçerlilik tarihi", type: "date", required: true }, { key: "terms", label: "Kapsam / koşullar", type: "textarea", full: true },
  ],
  contract: [
    { key: "party", label: "Karşı taraf", required: true }, { key: "contractType", label: "Sözleşme türü", required: true, options: ["Taşıma", "İş ortaklığı", "Hizmet", "Bayi / distribütör başvurusu"] },
    { key: "startDate", label: "Başlangıç tarihi", type: "date", required: true }, { key: "endDate", label: "Bitiş tarihi", type: "date", required: true },
    { key: "contractStatus", label: "Takip durumu", required: true, options: ["Taslak hazırlanıyor", "Hukuk incelemesi", "Karşı taraf değerlendirmesi", "İmza bekliyor"] },
    { key: "notes", label: "Sözleşme notu", type: "textarea", full: true },
  ],
  operation: [
    { key: "reference", label: "Operasyon referansı", required: true }, { key: "cargo", label: "Yük / hizmet", required: true },
    { key: "origin", label: "Çıkış", required: true }, { key: "destination", label: "Varış", required: true },
    { key: "vehicle", label: "Araç / taşıyıcı referansı" }, { key: "operationStatus", label: "Operasyon durumu", required: true, options: ["Planlama taslağı", "Taşıyıcı araştırılıyor", "Yükleme planı bekliyor", "Belge kontrolü"] },
    { key: "date", label: "Planlanan tarih", type: "date" }, { key: "notes", label: "Takip notu", type: "textarea", full: true },
  ],
};

const seed: DraftRecord[] = [
  { id: "R-0242", module: "vehicle", region: "mersin", name: "Örnek Araç 13", status: "draft", updated: "Örnek kayıt", fields: { reference: "ARAC-013", plate: "ÖRNEK-013", vehicle: "Tenteli tır", company: "Örnek Taşıyıcı 03", capacity: "24 t", route: "Mersin — Irak", documentStatus: "Belge bekleniyor", notes: "Gerçek araç, plaka veya filo kaydı değildir." } },
  { id: "R-0241", module: "firm", region: "mersin", name: "Örnek Firma 01", status: "review", updated: "Bugün · 09:42", fields: { legalName: "Örnek Firma 01 Lojistik Ltd.", taxNo: "33•••••812", activity: "Lojistik", contact: "operasyon@ornekfirma01.test", verification: "Belge bekleniyor", notes: "Mersin çıkışlı kara yolu hatları için ön inceleme." } },
  { id: "R-0240", module: "partner", region: "ukraine", name: "Örnek Firma 02", status: "review", updated: "Dün · 16:18", fields: { company: "Örnek Firma 02", partnershipType: "Türkiye–Ukrayna ticaret bağlantısı", route: "Mersin — Odesa", region: "Ukrayna (hazırlık)", contact: "contact@ornekfirma02.test", notes: "Bölgesel hazırlık kaydı; yayın ve ortaklık kararı verilmedi." } },
  { id: "R-0239", module: "carrier", region: "iraq", name: "Örnek Taşıyıcı 03", status: "draft", updated: "Dün · 14:05", fields: { company: "Örnek Taşıyıcı 03", vehicle: "Tenteli tır", plate: "TR-33 · referans 03", route: "Mersin — Gaziantep — Irak", capacity: "24 t", contact: "filo@ornek03.test", notes: "Araç uygunluğu henüz doğrulanmadı." } },
  { id: "R-0238", module: "offer", region: "gaziantep", name: "Örnek Teklif 04", status: "review", updated: "12 Haz · 11:30", fields: { client: "Örnek Firma 04", service: "Gaziantep — Mersin parsiyel taşıma", amount: "1840", currency: "USD", validUntil: "2026-06-28", terms: "Ön fiyat çalışması; bağlayıcı teklif değildir." } },
  { id: "R-0237", module: "operation", region: "ipekyolu", name: "Operasyon örneği 05", status: "draft", updated: "11 Haz · 15:10", fields: { reference: "OP-IR-005", cargo: "Kuru gıda / parsiyel", origin: "Mersin", destination: "İpekyolu hattı", vehicle: "Taşıyıcı bekleniyor", operationStatus: "Taşıyıcı araştırılıyor", date: "2026-06-25", notes: "Planlama önizlemesi." } },
  { id: "R-0236", module: "staff", region: "mersin", name: "Başvuru örneği 06", status: "review", updated: "10 Haz · 10:12", fields: { candidate: "P-006", area: "Lojistik operasyon", region: "Mersin", contact: "aday06@example.test", experience: "Kara yolu sevkiyat süreçleri", notes: "Herhangi bir unvan veya atama yapılmamıştır." } },
  { id: "R-0235", module: "shipper", region: "turkiye", name: "Örnek Yük Veren 07", status: "draft", updated: "09 Haz · 13:22", fields: { company: "Örnek Firma 07", cargo: "Ambalajlı kuru yük", origin: "Gaziantep", destination: "Mersin", loadDate: "2026-06-24", volume: "1 tenteli tır", notes: "Örnek yük talebi." } },
  { id: "R-0234", module: "dealer", region: "dubai", name: "Örnek Distribütör 08", status: "review", updated: "08 Haz · 17:50", fields: { company: "Örnek Firma 08", type: "Distribütör", market: "Dubai / BAE", products: "Lojistik ve dış ticaret", contact: "business@ornek08.test", notes: "Başvuru inceleniyor; yetki veya münhasırlık tanınmamıştır." } },
  { id: "R-0233", module: "contract", region: "mersin", name: "Sözleşme taslağı 09", status: "draft", updated: "07 Haz · 09:08", fields: { party: "Örnek Firma 09", contractType: "Taşıma", startDate: "2026-07-01", endDate: "2026-12-31", contractStatus: "Hukuk incelemesi", notes: "İmzalanmamış örnek takip kaydı." } },
  { id: "R-0232", module: "invite", region: "turkiye", name: "Davet önizlemesi 10", status: "draft", updated: "06 Haz · 12:41", fields: { email: "iletisim@ornekfirma10.test", company: "Örnek Firma 10", region: "Türkiye geneli", purpose: "Firma kaydı incelemesi", notes: "Gönderim simüle edilmedi." } },
  { id: "R-0231", module: "partner", region: "dubai", name: "Örnek Firma 11", status: "approved-preview", updated: "05 Haz · 16:22", fields: { company: "Örnek Firma 11", partnershipType: "Kurumsal iş geliştirme", route: "Mersin — Dubai", region: "Dubai / BAE (hazırlık)", contact: "connect@ornek11.test", notes: "Sadece önizlemede onaylandı; gerçek etkisi yok." } },
  { id: "R-0230", module: "operation", region: "iraq", name: "Operasyon örneği 12", status: "rejected", updated: "04 Haz · 10:03", fields: { reference: "OP-IR-012", cargo: "Genel yük", origin: "Mersin", destination: "Irak", vehicle: "Araç bekleniyor", operationStatus: "Planlama taslağı", date: "2026-06-20", notes: "Örnek kayıt; yeniden düzenlenebilir." } },
];

const regionLabel = (id: RegionId) => routes.find((item) => item.id === id)?.label ?? "Mersin";
const moduleLabel = (id: ModuleId) => modules.find((item) => item.id === id)?.label ?? id;
const statusLabel: Record<RecordStatus, string> = { draft: "TASLAK", review: "KURUCU İNCELEMESİ", "approved-preview": "ÖNİZLEMEDE ONAYLANDI", rejected: "REDDEDİLDİ · ÖRNEK" };

function makeSeed(): DraftRecord[] { return seed.map((item) => ({ ...item, fields: { ...item.fields } })); }

export function RegionalLogisticsDraft() {
  const [records, setRecords] = useState<DraftRecord[]>(makeSeed);
  const [activeModule, setActiveModule] = useState<ModuleId | "overview">("overview");
  const [regionFilter, setRegionFilter] = useState<RegionId | "all">("all");
  const [previewRole, setPreviewRole] = useState<"viewer" | "founder">("viewer");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [formError, setFormError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  const shownRecords = useMemo(() => records.filter((record) =>
    (regionFilter === "all" || record.region === regionFilter) &&
    (activeModule === "overview" || record.module === activeModule) &&
    (statusFilter === "all" || record.status === statusFilter) &&
    (!search || `${record.name} ${record.id} ${moduleLabel(record.module)} ${Object.values(record.fields).join(" ")}`.toLowerCase().includes(search.toLowerCase()))
  ), [records, regionFilter, activeModule, statusFilter, search]);
  const selectedRecord = records.find((item) => item.id === selectedId) ?? null;
  const currentModule = activeModule === "overview" ? null : modules.find((item) => item.id === activeModule) ?? null;

  const countMetrics = (items: DraftRecord[]) => {
    const applications = items.filter((item) => ["partner", "shipper", "carrier", "vehicle", "dealer", "staff"].includes(item.module));
    return [
      { label: "Firma", value: items.filter((item) => item.module === "firm").length },
      { label: "Başvurular", value: applications.length },
      { label: "İş ortakları", value: items.filter((item) => item.module === "partner" || item.module === "dealer").length },
      { label: "Teklifler", value: items.filter((item) => item.module === "offer").length },
      { label: "Operasyonlar", value: items.filter((item) => item.module === "operation").length },
      { label: "Personel", value: items.filter((item) => item.module === "staff").length },
      { label: "Onay bekleyenler", value: items.filter((item) => item.status === "review").length },
    ];
  };
  const setFeedback = (text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3400);
  };
  const openCreate = () => {
    if (!currentModule) return;
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };
  const openEdit = (record: DraftRecord) => {
    if (previewRole !== "founder") {
      setFeedback("Düzenleme yalnızca kurucu simülasyonunda kullanılabilir.", true);
      return;
    }
    setActiveModule(record.module);
    setSelectedId(record.id);
    setEditingId(record.id);
    setFormError("");
    setModalOpen(true);
  };
  useEffect(() => {
    if (!modalOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);
  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const fields: Record<string, string> = {};
    moduleFields[activeModule as ModuleId].forEach((spec) => { fields[spec.key] = String(data.get(spec.key) ?? "").trim(); });
    if (moduleFields[activeModule as ModuleId].some((spec) => spec.required && !fields[spec.key])) {
      setFormError("Zorunlu alanları doldurun; yalnızca boşluk kullanılamaz.");
      return;
    }
    if (activeModule === "contract" && fields.endDate < fields.startDate) {
      setFormError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }
    if (editingId && previewRole !== "founder") {
      setFormError("Düzenleme yalnızca kurucu simülasyonunda kullanılabilir.");
      return;
    }
    const name = activeModule === "firm" ? fields.legalName : activeModule === "invite" ? fields.company : activeModule === "partner" || activeModule === "shipper" || activeModule === "carrier" || activeModule === "dealer" ? fields.company : activeModule === "staff" ? fields.candidate : activeModule === "offer" ? fields.client : activeModule === "contract" ? fields.party : fields.reference;
    const chosenRegion = String(data.get("_region") ?? "");
    const recordRegion: RegionId = routes.some((route) => route.id === chosenRegion) ? chosenRegion as RegionId : "mersin";
    const now = "Şimdi · önizleme";
    if (editingId) {
      setRecords((previous) => previous.map((record) => record.id === editingId ? { ...record, region: recordRegion, name: name || record.name, fields, status: "draft", updated: now } : record));
      setSelectedId(editingId);
      setFeedback("Değişiklikler taslak olarak kaydedildi. İncelemeye yeniden göndermek gerekir.");
    } else {
      const newRecord: DraftRecord = { id: `D-${crypto.randomUUID()}`, module: activeModule as ModuleId, region: recordRegion, name: name || "Yeni örnek kayıt", fields, status: "draft", updated: now };
      setRecords((previous) => [newRecord, ...previous]);
      setSelectedId(newRecord.id);
      setStatusFilter("all");
      setFeedback("Yeni kayıt yalnızca bu önizlemede TASLAK olarak oluşturuldu.");
    }
    setRegionFilter(recordRegion);
    setStatusFilter("all");
    setSearch("");
    setModalOpen(false);
  };
  const updateStatus = (record: DraftRecord, next: RecordStatus) => {
    if (next !== "review" && previewRole !== "founder") {
      setFeedback("Karar işlemleri yalnızca kurucu simülasyonunda kullanılabilir.", true);
      return;
    }
    setRecords((previous) => previous.map((item) => item.id === record.id ? { ...item, status: next, updated: "Şimdi · önizleme" } : item));
    const messages: Record<RecordStatus, string> = {
      draft: "Kayıt taslakta tutuluyor; gerçek etkisi yok.",
      review: "Kayıt kurucu incelemesi için bu önizlemede sıraya alındı.",
      "approved-preview": "Önizlemede onaylandı. Gerçek kurucu onayı değildir ve hiçbir canlı etkisi yoktur.",
      rejected: "Örnek kayıt bu önizlemede reddedildi; canlı sistem değişikliği yok.",
    };
    setFeedback(messages[next]);
  };
  const selectRegion = (region: RegionId | "all") => {
    setRegionFilter(region);
    setSelectedId(null);
  };
  const openRecord = (record: DraftRecord) => {
    setSelectedId(record.id);
    setActiveModule(record.module);
    setStatusFilter("all");
  };
  const moduleRecords = activeModule === "overview" ? [] : shownRecords;

  return (
    <div className="regional-draft">
      <div className="rd-shell">
        <div className="rd-notice" role="note">
          <AlertTriangle size={16} />
          <div><strong>TASLAK / ÖNİZLEME</strong> · Örnek veriler; veritabanına yazılmaz, canlı yayına alınmaz. Onay simülasyonlarının gerçek etkisi yoktur. Sayfa yenilendiğinde tüm değişiklikler sıfırlanır.</div>
        </div>
        <header className="rd-topbar">
          <div className="rd-brand" aria-label="MMT Global, MMT Lojistik">
            <div className="rd-mark" aria-hidden="true">MMT</div>
            <div><div className="rd-brand-name">MMT GLOBAL</div><div className="rd-brand-sub">Regional logistics workspace</div></div>
            <div className="rd-brand-divider" />
            <div className="rd-logistics">MMT LOJİSTİK</div>
          </div>
          <div className="rd-top-right">
            <label className="rd-preview-role">Önizleme görünümü
              <select aria-label="Önizleme görünümü" value={previewRole} onChange={(event) => setPreviewRole(event.target.value as "viewer" | "founder")}>
                <option value="viewer">Standart önizleme</option>
                <option value="founder">Kurucu · simülasyon</option>
              </select>
            </label>
            <div className="rd-role-tag"><ShieldCheck size={15} /> {previewRole === "founder" ? "SIMULASYON · KURUCU GÖRÜNÜMÜ" : "SADECE ÖNİZLEME"}</div>
          </div>
        </header>

        <div className="rd-headline">
          <div>
            <p className="rd-kicker">MMT LOJİSTİK &nbsp; / &nbsp; TASLAK ÇALIŞMA ALANI</p>
            <h1 className="rd-title">Bölgesel Operasyonlar</h1>
            <p className="rd-subtitle">Mersin merkezli lojistik hazırlık, bölgesel başvurular ve operasyon taslakları.</p>
          </div>
          <div className="rd-reset-note"><RefreshCw size={13} /> Yalnızca oturum içi örnek çalışma</div>
        </div>

        <div className="rd-layout">
          <aside className="rd-sidebar">
            <div className="rd-nav-label">Çalışma alanı</div>
            <nav className="rd-nav" aria-label="Bölgesel operasyon modülleri">
              <button type="button" className={activeModule === "overview" ? "active" : ""} onClick={() => { setActiveModule("overview"); setSelectedId(null); }}><MapPinned size={15} /><span>Bölgesel Operasyonlar</span></button>
              {modules.map((item) => {
                const Icon = item.icon;
                return <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => { setActiveModule(item.id); setSelectedId(null); setStatusFilter("all"); }}><Icon size={15} /><span>{item.label}</span></button>;
              })}
            </nav>
            <div className="rd-nav-bottom">
              <div className="rd-nav-label">Diğer alanlar</div>
              <div className="rd-secondary"><span>Finans</span><span>İkincil</span></div>
              <div className="rd-secondary"><span>Sağlık</span><span>İkincil</span></div>
              <div className="rd-secondary"><span>Medya</span><span>İkincil</span></div>
            </div>
          </aside>

          <main className="rd-content">
            {activeModule === "overview" ? (
              <>
                <div className="rd-region-grid" aria-label="Bölgesel hazırlık durumları">
                  {regions.map((region) => {
                    const metrics = countMetrics(records.filter((record) => record.region === region.id));
                    return <article key={region.id} className={`rd-region-card ${region.status === "prep" ? "inactive" : ""} ${regionFilter === region.id ? "selected" : ""}`}>
                      <div className="rd-region-top"><div><h2 className="rd-region-name">{region.label}</h2><p className="rd-region-caption">{region.description}</p></div><span className={`rd-region-state ${region.status === "main" ? "main" : ""}`}>{region.status === "main" ? "ANA MERKEZ" : "YAYINDA DEĞİL · KURUCU ONAYI BEKLİYOR"}</span></div>
                      <div className="rd-region-metrics">{metrics.map((metric) => <div className="rd-mini-metric" key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>
                      <button className="rd-region-select" type="button" aria-label={`${region.label} kayıtlarını filtrele`} onClick={() => selectRegion(regionFilter === region.id ? "all" : region.id)} />
                    </article>;
                  })}
                </div>
                <div className="rd-route-row">
                  <span className="rd-route-label">ANA HATLAR / FİLTRE</span>
                  <button type="button" className={`rd-route-chip ${regionFilter === "all" ? "active" : ""}`} onClick={() => selectRegion("all")}>Tüm bölgeler</button>
                  {routes.map((route) => <button key={route.id} type="button" className={`rd-route-chip ${regionFilter === route.id ? "active" : ""}`} onClick={() => selectRegion(regionFilter === route.id ? "all" : route.id)}>{route.label}</button>)}
                </div>
                <div className="rd-stat-strip">
                  {countMetrics(regionFilter === "all" ? records : records.filter((item) => item.region === regionFilter)).map((metric) => <div className={`rd-stat ${metric.label === "Onay bekleyenler" ? "pending" : ""}`} key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
                </div>
                <div className="rd-main-grid">
                  <section className="rd-panel">
                    <div className="rd-panel-head"><div><h2 className="rd-panel-title">Son örnek kayıtlar</h2><p className="rd-panel-caption">Seçili kapsam: {regionFilter === "all" ? "Tüm bölgeler" : regionLabel(regionFilter)}</p></div><span className="rd-status draft">YALNIZCA ÖRNEK</span></div>
                    <div className="rd-table-wrap"><table className="rd-table"><thead><tr><th>Kayıt</th><th>Modül / Bölge</th><th>Durum</th><th /></tr></thead><tbody>
                      {shownRecords.slice(0, 6).map((record) => <tr key={record.id}><td><span className="rd-record-name">{record.name}</span><span className="rd-record-kind">{record.id} · {record.updated}</span></td><td>{moduleLabel(record.module)}<br /><span className="rd-record-kind">{regionLabel(record.region)}</span></td><td><span className={`rd-status ${record.status === "review" ? "review" : record.status === "approved-preview" ? "approved" : record.status}`}>{statusLabel[record.status]}</span></td><td><button type="button" className="rd-text-button" onClick={() => openRecord(record)}>İncele</button></td></tr>)}
                      {shownRecords.length === 0 && <tr><td colSpan={4}><div className="rd-empty"><CircleHelp size={22} /><h3>Bu filtrede örnek kayıt yok</h3><p>Başka bir bölge seçin veya ilgili modülde yeni bir taslak oluşturun.</p></div></td></tr>}
                    </tbody></table></div>
                  </section>
                  <div>
                    <section className="rd-panel">
                      <div className="rd-panel-head"><div><h2 className="rd-panel-title">Yayın kontrolü</h2><p className="rd-panel-caption">Her kayıt için açık, manuel inceleme akışı.</p></div><ShieldCheck size={17} color="#d56a36" /></div>
                      <div style={{ padding: "16px 18px" }}>
                        <div className="rd-flow"><div className="rd-flow-step current"><span>1</span>TASLAK</div><div className="rd-flow-line" /><div className="rd-flow-step"><span>2</span>KURUCU ONAYI</div><div className="rd-flow-line" /><div className="rd-flow-step"><span>3</span>YAYIN</div></div>
                        <div className="rd-flag"><strong>Yayın kapalı</strong><p>Yayına alma bu taslakta her durumda devre dışıdır. Gerçek kurucu onayı ve ayrıca yetkilendirilmiş uygulama gerekir.</p></div>
                        <CompanyFlowPreview />
                        <div className="rd-founder-note">{previewRole === "founder" ? "Kurucu görünümü yalnızca bu ekranın kontrol simülasyonudur; gerçek hesap veya yetki değildir." : "İnceleme ve karar simülasyonu yalnızca “Kurucu · simülasyon” önizlemesinde görünür."}</div>
                      </div>
                    </section>
                    <div className="rd-footer-note">Ukrayna ve Dubai / BAE bölgesel hazırlık alanları <strong>YAYINDA DEĞİL / KURUCU ONAYI BEKLİYOR.</strong> Firma incelemesi, bayi veya distribütör yetkisi, personel unvanı, sözleşme imzası ve yayın işlemi yapılmaz.</div>
                  </div>
                </div>
              </>
            ) : currentModule && (
              <>
                <div className="rd-panel">
                  <div className="rd-panel-head"><div><p className="rd-kicker" style={{ marginBottom: 5 }}>BÖLGESEL OPERASYONLAR / {currentModule.label.toLocaleUpperCase("tr-TR")}</p><h2 className="rd-panel-title">{currentModule.label}</h2><p className="rd-panel-caption">{currentModule.hint} · tüm işlemler bu oturumda kalır.</p></div><span className="rd-status draft">{regionFilter === "all" ? "TÜM BÖLGELER" : regionLabel(regionFilter)}</span></div>
                  <div className="rd-module-toolbar">
                    <div className="rd-search"><Search size={14} /><input aria-label="Kayıtlarda ara" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad, referans veya içerikte ara" /></div>
                    <select className="rd-select" aria-label="Duruma göre filtrele" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">Tüm durumlar</option><option value="draft">Taslak</option><option value="review">Kurucu incelemesi</option><option value="approved-preview">Önizlemede onaylandı</option><option value="rejected">Reddedildi · örnek</option>
                    </select>
                    <button type="button" className="rd-button primary" onClick={openCreate}><Plus size={14} /> Yeni taslak</button>
                  </div>
                  <div className="rd-module-body">
                    <div className="rd-list" aria-label={`${currentModule.label} örnek kayıtları`}>
                      {moduleRecords.map((record) => <button type="button" key={record.id} className={`rd-list-item ${selectedId === record.id ? "selected" : ""}`} onClick={() => setSelectedId(record.id)}>
                        <span><strong>{record.name}</strong><small>{record.id} · {regionLabel(record.region)} · {record.updated}</small></span><span className={`rd-status ${record.status === "review" ? "review" : record.status === "approved-preview" ? "approved" : record.status}`}>{statusLabel[record.status]}</span>
                      </button>)}
                      {moduleRecords.length === 0 && <div className="rd-empty"><ClipboardList size={22} /><h3>Henüz kayıt bulunmuyor</h3><p>Arama ve filtreleri temizleyin ya da yalnızca bu önizlemede yeni bir taslak başlatın.</p></div>}
                    </div>
                    <div className="rd-detail">
                      {selectedRecord && selectedRecord.module === activeModule ? (
                        <>
                          <div className="rd-detail-top"><div><h3>{selectedRecord.name}</h3><p className="rd-detail-sub">{selectedRecord.id} · {moduleLabel(selectedRecord.module)} · {regionLabel(selectedRecord.region)}</p></div><span className={`rd-status ${selectedRecord.status === "review" ? "review" : selectedRecord.status === "approved-preview" ? "approved" : selectedRecord.status}`}>{statusLabel[selectedRecord.status]}</span></div>
                          <div className="rd-detail-grid">{moduleFields[selectedRecord.module].map((field) => <div key={field.key} className="rd-detail-field"><label>{field.label}</label><span>{selectedRecord.fields[field.key] || "—"}</span></div>)}</div>
                          <div className="rd-detail-note"><strong>Önizleme kaydı.</strong> Bu bilgiler örnek amaçlıdır; doğrulanmış firma, atanmış personel, sözleşme, teklif veya aktif operasyon anlamına gelmez.</div>
                          {["firm", "partner", "dealer"].includes(selectedRecord.module) && <CompanyFlowPreview />}
                          <div className="rd-detail-actions">
                            {previewRole === "founder" && <button type="button" className="rd-button secondary" onClick={() => openEdit(selectedRecord)}><Pencil size={13} /> DÜZENLE</button>}
                            {selectedRecord.status === "draft" && <button type="button" className="rd-button orange" onClick={() => updateStatus(selectedRecord, "review")}><ArrowRight size={13} /> İncelemeye gönder</button>}
                            {previewRole === "founder" && selectedRecord.status === "review" && <>
                              <button type="button" className="rd-button approve" onClick={() => updateStatus(selectedRecord, "approved-preview")}><Check size={13} /> ONAYLA</button>
                              <button type="button" className="rd-button reject" onClick={() => updateStatus(selectedRecord, "rejected")}>REDDET</button>
                              <button type="button" className="rd-button secondary" onClick={() => updateStatus(selectedRecord, "draft")}>TASLAKTA TUT</button>
                            </>}
                            {previewRole === "founder" && <button type="button" className="rd-button primary" disabled title="Yayın kapalıdır; gerçek kurucu onayı ve ayrıca yetkilendirilmiş uygulama gerekir.">YAYINA AL · KAPALI</button>}
                          </div>
                          <div className="rd-founder-note">Yayına alma kapalıdır: yayın kapalı, gerçek kurucu onayı ve ayrıca yetkilendirilmiş uygulama gerekir. Simüle edilmiş kararlar gerçek etki oluşturmaz.</div>
                        </>
                      ) : (
                        <div className="rd-empty"><MapPinned size={23} /><h3>Bir örnek kaydı seçin</h3><p>Detaylarını ve bu önizlemede izin verilen taslak adımlarını görmek için listeden kayıt seçin.</p></div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rd-footer-note">Bölge kapsamı: {regionFilter === "all" ? "Tüm bölgesel örnek kayıtlar" : regionLabel(regionFilter)}. Ukrayna ve Dubai / BAE hazırlık kayıtları yayınlanmamıştır; kurucu onayı beklemektedir.</div>
              </>
            )}
          </main>
        </div>
      </div>

      {modalOpen && currentModule && (
        <div className="rd-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="rd-modal" role="dialog" aria-modal="true" aria-labelledby="rd-modal-title">
            <div className="rd-modal-head"><div><p className="rd-kicker" style={{ marginBottom: 4 }}>{editingId ? "TASLAK DÜZENLEME" : "YENİ ÖRNEK KAYIT"}</p><h2 id="rd-modal-title">{editingId ? "Taslağı düzenle" : `${currentModule.label} · yeni taslak`}</h2><p>Kaydetme yalnızca bu sayfanın geçici belleğinde gerçekleşir.</p></div><button type="button" ref={closeRef} className="rd-icon-button" aria-label="Pencereyi kapat" onClick={() => setModalOpen(false)}><X size={17} /></button></div>
            <form className="rd-form" onSubmit={submitDraft}>
              <div className="rd-form-grid">
                <div className="rd-field">
                  <label htmlFor="rd-record-region">İlgili bölge / hat *</label>
                  <select id="rd-record-region" name="_region" required defaultValue={editingId ? records.find((item) => item.id === editingId)?.region ?? "mersin" : regionFilter === "all" ? "mersin" : regionFilter}>
                    {routes.map((route) => <option key={route.id} value={route.id}>{route.label}{route.id === "ukraine" || route.id === "dubai" ? " · hazırlık" : ""}</option>)}
                  </select>
                </div>
                {moduleFields[activeModule as ModuleId].map((field) => {
                  const existing = editingId ? records.find((item) => item.id === editingId)?.fields[field.key] ?? "" : "";
                  return <div className={`rd-field ${field.full ? "full" : ""}`} key={field.key}>
                    <label htmlFor={`rd-${field.key}`}>{field.label}{field.required ? " *" : ""}</label>
                    {field.options ? <select id={`rd-${field.key}`} name={field.key} defaultValue={existing} required={field.required}><option value="">Seçiniz</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                      : field.type === "textarea" ? <textarea id={`rd-${field.key}`} name={field.key} defaultValue={existing} required={field.required} placeholder="Örnek bilgi girin" />
                      : <input id={`rd-${field.key}`} name={field.key} type={field.type ?? "text"} defaultValue={existing} required={field.required} min={field.type === "number" ? "0" : undefined} step={field.type === "number" ? "0.01" : undefined} placeholder={field.type === "email" ? "ornek@firma.test" : "Bilgi girin"} />}
                    {field.help && <span className="rd-field-help">{field.help}</span>}
                  </div>;
                })}
              </div>
              {formError && <p role="alert" style={{ color: "#8b4f4c", fontSize: 10 }}>{formError}</p>}
              <div className="rd-modal-warning"><AlertTriangle size={14} /> Firma daveti yalnızca taslak simülasyonudur; e-posta gönderilmez. Bayilik, bölge yetkisi, münhasırlık, personel unvanı ve sözleşme imzası verilmez.</div>
              <div className="rd-form-actions"><button type="button" className="rd-button secondary" onClick={() => setModalOpen(false)}>İptal</button><button type="submit" className="rd-button primary"><Check size={14} /> TASLAK OLARAK KAYDET</button></div>
            </form>
          </section>
        </div>
      )}
      {toast && <div className={`rd-toast ${toast.error ? "error" : ""}`} role="status" aria-live="polite">{toast.text}</div>}
    </div>
  );
}
