# Özel MMT TEST entegrasyonu

Bu modül mevcut Express sunucusu, Clerk middleware'i, lojistik yetki
yardımcıları ve `@workspace/db` Drizzle bağlantısını kullanır. İkinci sunucu,
ayrı pg havuzu, `initDb`, DDL veya migration içermez.

## Etkinleşme sınırı

Varsayılan olarak kapalıdır. Üç koşul birlikte gerekir:

- Sunucunun `NODE_ENV` değeri `development` veya `test`.
- `REPLIT_DEPLOYMENT` ortam işareti bulunmamalı.
- Sunucu tarafında `MMT_TEST_INTEGRATION_ENABLED=true` olmalı.

`NODE_ENV=production`, yayımlanmış ortam veya eksik TEST anahtarı ile işlem
yapılmaz. İstemci bir body/header/query alanıyla TEST modunu etkinleştiremez.
Hiçbir ortam değişkeni veya secret bu geliştirmeyle değiştirilmedi.

İsteklerin işlenmesi için geliştirme ortamında
`MMT_TEST_INTEGRATION_HMAC_SECRET` gerekir; en az 32 bayt olmalı ve Secrets
üzerinden yönetilmelidir. Üretim adlı eski WelatTR anahtarı kullanılmaz.
Bu anahtar kaynak koda veya loglara yazılmaz.

## Uç noktalar

- `POST /api/mmt/test-integration/events`
- `POST /api/mmt/test-integration/approve`

Mevcut genel sağlık uç noktaları korunur. Yeni bir sağlık sunucusu açılmaz.
Shopify ve WhatsApp alıcıları veya imza protokolleri değiştirilmez.

## Doğrulama

İki bağımsız güven sınırı birlikte zorunludur:

1. Mevcut Clerk oturumundan gerçek kullanıcı kimliği.
2. Yalnız bu özel entegrasyona ait servisler arası HMAC:
   `X-MMT-Signature` = SHA256 HMAC hex,
   imzalanan baytlar = `timestamp.eventId.` UTF-8 öneki + değişmemiş ham gövde.
   `X-MMT-Timestamp` 13 basamaklı Unix milisaniyesi, tolerans 5 dakika;
   `X-MMT-Event-Id` 1–128 harf/rakam/alt çizgi/tire.

Ham gövde `express.json()` öncesinde, 16 KiB sınır ve `inflate:false`
ile alınır. İmza `timingSafeEqual` ile doğrulanır; JSON daha sonra çözülür.
JSON yeniden serileştirilerek istek imzası hesaplanmaz.
Shopify/WhatsApp imzaları bu özel uç noktalarda kabul edilmez.

`events` gövdesinde yalnız `docRef` ve `kind` kabul edilir.
Türler: `invoice_verification`, `identity_document`, `contract_review`,
`compliance_check`. Bunlar olay sınıflarıdır; belgenin/kimliğin/sözleşmenin
doğrulandığı veya ticari onay aldığı anlamına gelmez.
Referans NFC Unicode olarak değerlendirilir; Türkçe İ korunur:
`UKR-MERSİN-NARENCİYE-001` değiştirilmez.

## Dosya erişimi ve kayıt

Mevcut aktif operasyon rolü veya mevcut tam kurucu kimliği gerekir.
Operasyon personeli ayrıca ilgili TEST kaydının talep sahibi ya da atanmış
sevkiyat sorumlusu olmalıdır. Diğer roller yükseltilmez.

Kayıt, mevcut `logistics_requests.reference_code` ile bulunur ve `isTest=true`
olmalıdır. Yoksa 404; başka sorumluya aitse 403 döner. Gerçek kayıtlar kurucu
için de kabul edilmez. Pilot kartının ekranda bulunması veritabanında bir
kaydın bulunduğu anlamına gelmez. Bu modül eksik pilot, müşteri veya sevkiyat
oluşturmaz; testler yalnız bellek içi sahte kayıtlar kullanır.

Mevcut `logistics_communications` tablosuna TEST/internal/note etkinliği
yazılır. `createdByClerkUserId` Clerk oturumundan gelir; oluşturulma zamanı
mevcut DB varsayılanıdır. HMAC gönderen etiketi kullanıcı yerine yazılmaz.
Kuyruk, görev veya ticari durum oluşturulmaz/değiştirilmez.

Transaction advisory lock olay kimliğinin işlenmesini süreçler arasında
sıralar; aynı olay/içerik/kullanıcı tekrarında ikinci etkinlik yazılmaz.
Farklı içerik/kullanıcı/dosya 409'dur. Şema değiştirilmediği için yeni bir
benzersizlik indeksi yoktur; koruma bu modülün transaction akışındadır.
Genel bir elle yazılmış notun imzalı alındı gibi kabul edilmemesi için
etkinlik metninde ayrı alan adıyla HMAC bütünlük kanıtı bulunur.
Bu kanıt istek kimlik bilgisi değildir. Anahtar değişirse eski alındının
kanıtı doğrulanamaz; tekrar sessizce yazılmak yerine 409 ile durdurulur.

200 yalnız iç TEST etkinliğinin kaydedildiğini/tekrarının bulunduğunu belirtir.
`queuedForReview=false`, `shipmentApproved=false`, `testOnly=true` kalır.
Kayıt hatasında 503 döner; sahte `persisted=true` verilmez.

## Onay kapalı

`approve` aynı ortam, Clerk ve özel HMAC kontrollerinden geçer; mevcut tam
kurucu kimliği dışında 403 döner. Kurucu için bile 501 döner. Veritabanına
yazmaz, görev veya onay durumu değiştirmez. Bu entegrasyonun dosya/görev/
kurucu karar akışı mevcut olmadan başarıyla onaylandı gösterilmez.

## Doğrulama

İzole HTTP testleri `src/routes/mmt-test-integration.test.ts` içindedir.
Clerk ve PostgreSQL mock edilir; gerçek veri veya hesap değiştirilmez.
Üretim/published/kapalı ortam, oturumsuz HMAC, rol ve başka dosya reddi,
Türkçe İ, gerçek kayıt reddi, ham imza, zaman penceresi, 16 KiB/gzip,
tekrar/çakışma, sahte not, depo hatası ve 501 kontrol edilir.

API/web tür kontrolleri ve derlemeleri ile mevcut lojistik, firma daveti,
personel ve Shopify/Nexus testleri ayrıca çalıştırılır.
Gerçek PostgreSQL eşzamanlılık testi veya gerçek servis/Clerk uçtan uca
teslimatı bu değişiklik kapsamında doğrulanmış sayılmaz.

Deploy/Publish, domain veya yayın ayarı değişikliği yapılmaz.
