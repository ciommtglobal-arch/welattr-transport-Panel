# MMT Global — kurucu kontrollü lojistik otomasyonu

## Kapsam

Mevcut MMT Connect, Clerk oturumu, operasyon yetkisi, Express sunucusu ve
PostgreSQL/Drizzle bağlantısı kullanılır. Ayrı sunucu, bağlantı havuzu veya
başlangıçta tablo oluşturan bir mekanizma eklenmemiştir.

Akış:

1. Web API veya mevcut WhatsApp alıcısından gelen tamamlanmış yeni yük talebi,
   mevcut talep ve sevkiyat kayıtlarıyla aynı transaction içinde
   otomasyon kaydına bağlanır. Mevcut kaynaklardan gelen gerçek talepler için
   üretimdeki worker eksik otomasyon kayıtlarını da tamamlar.
2. Kaydedilmiş gerçek bilgilerden ilan taslağı ve beş maddelik kontrol listesi
   oluşturulur. Fiyat, taşıyıcı teklifi, koordinat veya eksik müşteri bilgisi
   uydurulmaz.
3. PDF/JPEG/PNG evraklar en fazla 10 MB olarak özel depoya yüklenir. Boyut, içerik
   türü ve dosya başlığı kontrol edilir. Bu, virüs taraması veya hukuki doğruluk
   onayı değildir.
4. Yükleme tamamlandığında belge, yükleme bağlantısının değiştiremeyeceği ayrı
   bir özel nesneye kopyalanır. Sürüm, checksum ve boyut sonraki işlemlerde
   yeniden kontrol edilir. Önceki evraklar korunur; yeni bekleyen evrakın yerine
   eski evrak otomatik kabul edilmez.
5. Yalnız mevcut kurucu kimliği, işlem için gerekli evrak kapsamını ve bilgileri
   inceleyerek teyit eder. Varsayılan talep teyidi, yük bilgisi ve firma yetki
   belgesi listesi her rota için hukuken yeterli evrak garantisi değildir.
6. Kurucu, incelenen ilan sürümüne ayrı yayın onayı verir. Kaynak, ilan, evrak,
   kapsam veya Telegram hedefi değişirse eski karar gönderim için kullanılamaz.
7. Yalnız production/deployment ortamında ve yalnız onaylı, güncel, TEST olmayan
   kayıt Telegram'a gönderilebilir. Sağlayıcı mesaj ve hedef grup alındısı
   doğrulanmadan `sent` kaydedilmez.

Bu onay **fiyat/teklif kabulü, sözleşme, ödeme, taşıyıcı yetkilendirmesi veya
sevkiyat başlatma onayı değildir**. Bunların mevcut ayrı kontrolleri korunur.

## Kullanım

Mevcut `/staff/lojistik-operasyon` sayfasında bir talep seçin. “MMT · Mersin
yayın masası” bölümü taslağı, belgeleri, görev durumunu ve gerçek işlem
geçmişini gösterir. Mevcut aktif operasyon personeli hazırlık yapabilir; son
doğrulama ve karar yetkisi kurucudadır. Hesaplara yeni kalıcı yetki verilmez.

Önizlemede gerçek gönderim kapalıdır. `UKR-MERSİN-NARENCİYE-001` pilotu
TEST olarak kalır. Özel Telegram TEST botu modu değiştirilmemiştir.

Onay verilmesi gönderim alındısı değildir. Telegram zaman aşımı veya süreç
kesintisi durumunda işlem `uncertain` olur; çift yayına yol açabilecek otomatik
tekrar yapılmaz. Açık sağlayıcı reddi `failed` olur; yeniden kurucu incelemesine
dönülmeden tekrar gönderilmez.

## Veritabanı ve yayın

Yalnız geliştirmede iki yeni tablo eklendi:

- `logistics_automation_jobs`
- `logistics_automation_documents`

Mevcut müşteri, personel, rol ve operasyon kayıtları değiştirilmedi veya
silinmedi. Testler yalnız ayrı TEST kayıtları/nesneleri veya transaction sonunda
geri alınan PostgreSQL geçici tablolar kullanır.

Yayın öncesi salt okunur şema karşılaştırmasında **yapısal veri kaybı veya geriye
uyumsuzluk uyarısı bulunmadı**. Bekleyen fark, önceki beş TEST tablosu, bu iki
otomasyon tablosu ve önceki Nexus çalışmasının yedi sütununu da içerir. Yayın
ekranında bütün fark incelenmelidir; üretim şemasını yalnız normal Publish
akışı uygular. Bu kontrol, gerçek yayın provasının veya üretim testinin yerine
geçmez.

**Deploy/Publish başlatılmadı. Üretim veritabanına yazılmadı. Dış mesaj veya
ödeme gönderilmedi.**

## Doğrulama

- Yeni otomasyon: PostgreSQL geçici tabloları ve sahte sağlayıcı/depo ile
  17 test PASS. Gerçek Telegram gönderimi yapılmaz.
- Korunan lojistik/pilot akışları: 116 test PASS.
- Tip kontrolleri ve production frontend derlemesi PASS.
- Sağlayıcı alındısına bağlı tek gönderim, belirsiz alındıda tekrar yasağı,
  eksik/yeni evrak, yetki yükseltme, eski sürüm, değişen hedef, gerçek
  kullanıcı/sistem geçmişi ve TEST gönderim engeli testlere dahildir.
- Oturumlu operasyon ekranı, gerçek özel depo PDF yükleme/indirme, yenilemede
  kalıcılık, eski sürüm reddi ve taslağın korunması PASS. İlk bulunan personel
  erişim uyumsuzluğu düzeltildi. Mobil 402px taşması giderildi; odaklı kontrolde
  yatay kaydırma 0px olarak doğrulandı.
- Depo/temizlik regresyonları: 21 test PASS; yeni evraklar sahipsiz sayılmaz,
  gerçek toplu silme kilidi korunur.
- WhatsApp ayrıştırma/eksik bilgi kontrolleri: 6 test PASS.
- Böylece ilgili 160 sunucu testi PASS. Gerçek WhatsApp mesajının üretim
  alıcısına ulaşması bu çalışmada NOT TESTED; imzalı alıcıya yeni dış bağlantı
  kaydı veya canlı mesaj gönderimi yapılmadı.
- Canlı Telegram gönderimi, canlı hesap üzerinden kurucu kararı ve gerçek
  ödeme: NOT TESTED; bunlar yapılmış gibi raporlanmaz.

Komutlar:

```sh
LOGISTICS_AUTOMATION_DB_TEST=1 LOGISTICS_PILOT_DB_TEST=1 \
pnpm --filter @workspace/api-server exec vitest run \
  src/lib/logisticsAutomation.test.ts \
  src/lib/logisticsPilotWorkspace.test.ts \
  src/routes/logistics-test-pilot.test.ts \
  src/routes/logistics-operations.test.ts \
  src/routes/logistics-listing-workspace.test.ts \
  src/lib/logisticsWorkflow.test.ts \
  src/lib/logistics-preview-model.test.ts

pnpm --filter @workspace/api-server exec vitest run \
  src/lib/objectStorage.test.ts \
  src/lib/orphanUploadCleanupScheduler.test.ts \
  src/routes/storage.test.ts \
  src/routes/storage-cleanup.test.ts

pnpm --filter @workspace/api-server exec vitest run \
  src/lib/whatsappLogisticsIntake.test.ts

pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/mmt-global-website run typecheck
pnpm --filter @workspace/mmt-global-website run build
```

## Dosyalar

- `lib/db/src/schema/logistics-automation.ts` ve şema barrel export'u
- `lib/api-spec/openapi.yaml` ve üretilen React istemci/Zod dosyaları
- `artifacts/api-server/src/lib/logisticsAutomation.ts`
- `artifacts/api-server/src/lib/logisticsAutomationWorker.ts`
- `artifacts/api-server/src/lib/logisticsAutomation.test.ts`
- `artifacts/api-server/src/routes/logistics-automation.ts`
- Mevcut `routes/whatsapp-logistics-webhook.ts`
- Mevcut `routes/index.ts`, `routes/logistics-operations.ts`, `src/index.ts`
- Mevcut `routes/storage.ts`, `routes/storage-cleanup.test.ts`
- `artifacts/mmt-global-website/src/components/logistics-ops/automation-panel.tsx`
- Mevcut `components/logistics-ops/panels.tsx`, `pages/staff-logistics-operations.tsx`

## Autoscale çalışma sınırı

Mevcut yayın türü Autoscale olduğundan sunucu boşta uyuyabilir. Son onay verilen
kaydın gönderimi bu nedenle yalnız 15 saniyelik taramaya bırakılmaz: aynı onay
isteği içinde, yalnız production ve geçerli karar koşulları sağlandığında,
hedef kaydın gönderimi tetiklenir. Kuyruk ve kontrol kayıtları kalıcıdır.
Kesinti/belirsiz alındı yine başarı sayılmaz veya körlemesine tekrar edilmez.
Eski kayıt taraması aktif sunucu örneğinde devam eder; bu kurulum bağımsız
7/24 çalışan bir worker hizmeti olduğu iddiası taşımaz. Yayın türü veya
ücretlendirme ayarı değiştirilmemiştir.

Canlı loglarda eski `/api/telegram-webhook` yoluna gelen 404 kayıtları da
görülmektedir. Gönderen bot/kaynak doğrulanmadan webhook değiştirilmemiş veya
silinmemiştir. Bu yeni onaylı gönderim akışı o eski alıcıyı kullanmaz; bu not,
Telegram'dan gelen bütün mesaj akışlarının doğrulandığı anlamına gelmez.
