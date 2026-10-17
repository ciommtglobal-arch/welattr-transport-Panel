export const LOGISTICS_TEST_PILOT = "UKR-MERSİN-NARENCİYE-001";

type Check = {
  key: string;
  label: string;
  status: "PASS" | "FAIL" | "NOT_TESTED";
  detail: string;
};

// These are explicitly scoped implementation gaps, not a claim to have executed
// browser journeys. No mutation, geofence verification or approval occurs here.
export function buildLogisticsPilotReadiness(recordFound: boolean) {
  const checks: Check[] = [
    {
      key: "test_record", label: "Kalıcı TEST dosyası",
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
      key: "invitation", label: "Dosyaya bağlı kullanıcı ve rol daveti", status: "FAIL",
      detail: "Genel firma daveti pilot dosyasına bağlı davet/atama akışının yerine geçmez; pilot akışı tamamlanmadı.",
    },
    {
      key: "invitation_reuse", label: "Süresi dolmuş, iptal veya kullanılmış pilot daveti", status: "NOT_TESTED",
      detail: "Dosyaya bağlı davet yaşam döngüsü olmadan uçtan uca doğrulanamaz.",
    },
    {
      key: "task_delivery", label: "Görev sorumlusu, teslim tarihi ve çıktı", status: "FAIL",
      detail: "Pilot dosyasına bağlı kalıcı görev ve teslim akışı tamamlanmadı; genel görevler otomatik ilişkilendirilmedi.",
    },
    {
      key: "output_revision", label: "Çıktı sürümleri, düzeltme ve yeniden teslim", status: "FAIL",
      detail: "Dosya çıktısının önceki sürümünü koruyan revizyon yaşam döngüsü tamamlanmadı.",
    },
    {
      key: "commercial_approval", label: "Kurucu ticari onay akışı", status: "NOT_TESTED",
      detail: "Bu kontrol ticari onay vermez. Özel TEST entegrasyonunun /approve işlemi 501 ile kapalı kalır.",
    },
    {
      key: "history", label: "Dosyanın görev ve revizyon işlem geçmişi", status: "FAIL",
      detail: "Genel iletişim notları dosyaya bağlı davet/görev/çıktı sürüm geçmişinin tamamlandığını kanıtlamaz.",
    },
    {
      key: "management_summary", label: "Eksik, gecikmiş ve karar bekleyen pilot işleri", status: "FAIL",
      detail: "Bu liste hazırlık eksiklerini gösterir; kalıcı pilot görevlerinden üretilen canlı yönetim özeti değildir.",
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
      "Önce yalnız TEST dosyasına bağlı davet, sorumlu ve görev teslim akışını tamamlayın.",
      "Çıktı sürümleri, düzeltme/yeniden teslim ve kullanıcı/zaman içeren geçmişi bağlayın.",
      "Ardından aynı TEST hesabıyla uçtan uca doğrulayın; gerçek operasyonu ayrı kurucu kararına bırakın.",
    ],
  };
}
