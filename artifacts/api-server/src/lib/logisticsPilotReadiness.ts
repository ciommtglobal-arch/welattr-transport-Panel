export const LOGISTICS_TEST_PILOT = "UKR-MERSİN-NARENCİYE-001";

type Check = {
  key: string;
  label: string;
  status: "PASS" | "FAIL" | "NOT_TESTED";
  detail: string;
};

// Legacy request-record inspection, not a browser test or a query of the separate
// persistent TEST workspace. Never infer its journey results from this endpoint.
export function buildLogisticsPilotReadiness(recordFound: boolean) {
  const checks: Check[] = [
    {
      key: "test_record", label: "Eski lojistik talep tablosundaki TEST kaydı",
      status: recordFound ? "PASS" : "FAIL",
      detail: recordFound
        ? "Mevcut şemada aynı referanslı isTest=true kayıt okundu. Sevkiyat hazır demek değildir."
        : "Aynı referansla erişilebilir TEST kaydı bulunamadı. Otomatik kayıt oluşturulmadı.",
    },
    {
      key: "file_access", label: "Bu kontrol için dosya erişimi", status: "PASS",
      detail: "Mevcut Clerk/operasyon yetkisi ve kurucu veya dosya bağlantısı kontrol edildi. Diğer dosya yollarının testi değildir.",
    },
    {
      key: "auth_lifecycle", label: "Kayıt, giriş, çıkış ve aynı hesapla tekrar giriş", status: "NOT_TESTED",
      detail: "Bu okuma isteği tam kullanıcı yaşam döngüsü testi çalıştırmaz.",
    },
    {
      key: "invitation", label: "Dosyaya bağlı kullanıcı ve rol daveti", status: "NOT_TESTED",
      detail: "Kalıcı davetler ayrı TEST çalışma alanındadır; bu eski talep kontrolü davet akışını çalıştırmaz.",
    },
    {
      key: "invitation_reuse", label: "Süresi dolmuş, iptal veya kullanılmış pilot daveti", status: "NOT_TESTED",
      detail: "Davet yaşam döngüsü TEST çalışma alanında doğrulanır; bu okuma isteği davet kullanmaz.",
    },
    {
      key: "task_delivery", label: "Görev sorumlusu, teslim tarihi ve çıktı", status: "NOT_TESTED",
      detail: "Kalıcı görevler ayrı TEST çalışma alanındadır; bu eski talep kontrolü görev teslimi yapmaz.",
    },
    {
      key: "output_revision", label: "Çıktı sürümleri, düzeltme ve yeniden teslim", status: "NOT_TESTED",
      detail: "Değişmez çıktı sürümleri TEST çalışma alanındadır; bu kontrol yeniden teslim yolculuğu çalıştırmaz.",
    },
    {
      key: "commercial_approval", label: "Kurucu ticari onay akışı", status: "NOT_TESTED",
      detail: "Bu kontrol ticari onay vermez. Özel TEST entegrasyonunun /approve işlemi 501 ile kapalı kalır.",
    },
    {
      key: "history", label: "Dosyanın görev ve revizyon işlem geçmişi", status: "NOT_TESTED",
      detail: "TEST geçmişi ayrı çalışma alanındadır; genel iletişim notları onun yerine geçmez.",
    },
    {
      key: "management_summary", label: "Eksik, gecikmiş ve karar bekleyen pilot işleri", status: "NOT_TESTED",
      detail: "Gerçek TEST görev sayıları ayrı TEST çalışma alanında hesaplanır; bu liste görev özeti değildir.",
    },
    {
      key: "geofence", label: "Konum, rota ve sınır doğrulaması", status: "NOT_TESTED",
      detail: "Doğrulanmış GPS/konum kaynağı ve geofence değerlendirmesi yok. VERIFIED_AUTO üretilmez.",
    },
  ];
  return {
    fileCode: LOGISTICS_TEST_PILOT,
    testOnly: true,
    readOnly: true,
    readyForLive: false,
    shipmentApproved: false,
    recordFound,
    checkedAt: new Date().toISOString(),
    checks,
    nextActions: [
      "Kalıcı pilot için /staff/test-lojistik TEST çalışma alanını açın.",
      "Davet, sorumlu, teslim ve korunan revizyonları çalışma alanında yürütün.",
      "Bu eski talep kontrolünü tam kullanıcı yolculuğu veya gerçek operasyon onayı saymayın.",
    ],
  };
}
