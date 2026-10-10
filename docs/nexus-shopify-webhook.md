# MMT Nexus — kurucu onaylı Shopify kayıt alıcısı

Hedef mağaza: alioglu73.myshopify.com. Başka mağaza bağlantısı bu entegrasyonun doğrulandığı anlamına gelmez.

## Hazırlanan yollar

- `POST /api/webhook/shopify/nexus`: ham gövde üzerinden HMAC-SHA256 doğrulaması, mağaza ve varyant eşleştirmesi, atomik olay kaydı.
- `GET /api/nexus/intakes`: yalnız mevcut kurucu kimliği; son 100 kayıt.
- `/staff/nexus-denetim`: kurucu oturumuyla Çelik Kubbe denetim masası.

Yeni eşleşen kayıtların durumu `PENDING_FOUNDER_APPROVAL` olur. Tekrar gelen olaylar yeni kayıt üretmez. Sonraki Shopify bildirimleri kurucu kararını değiştirmez. Eski kaynak zaman damgası yeni kaynak verisini ezmez. Veritabanı başarısızlığında 503 döner; teslim alınmış gibi yanıt verilmez.

## Gerekli yapılandırma — henüz canlı kurulum değildir

- `SHOPIFY_NEXUS_SHOP_DOMAIN`: doğru mağaza alan adı.
- `SHOPIFY_NEXUS_RESERVATION_VARIANT_IDS`: doğrulanmış üç araç-portföyü varyant kimliği, virgülle ayrılmış.
- `SHOPIFY_NEXUS_FINANCING_VARIANT_IDS`: doğrulanmış Nexus finansman varyant kimlikleri.
- `SHOPIFY_NEXUS_WEBHOOK_SECRET`: Shopify bildirimini imzalayan gerçek sır; yalnız güvenli Secrets akışıyla.
- `MMT_FOUNDER_REVIEWER_CLERK_USER_ID`: projede kullanılan mevcut kurucu kimliği; başka bir hesabı kurucuya dönüştürmeyin.

Kimlikler ürün adı veya yalnız fiyat üzerinden tahmin edilmez. 75.000 TL dışındaki tutar veya TRY dışındaki para birimi eşleşen rezervasyonu düşürmez; kurucu incelemesi için uyarı ekler.

Kabul edilen konular: `orders/create`, `orders/paid`, `orders/updated`, `orders/cancelled`.
Bu kod webhook kaydı yapmaz. Shopify tarafında gerçek webhook yetkilendirmesi/kurulumu, sır, doğru yayın adresi ve teslimat doğrulaması ayrı gerekliliklerdir. Shopify Store bağlantısının mevcut sürümü webhook kurulumunu sağlamaz; uygulama kodundan webhook kaydı yapılmaz.

Yeni Drizzle şeması desteklenen geliştirme akışıyla uygulanmalıdır. Yönetilen üretim şeması yalnız onaylı Publish süreciyle güncellenir. Başlangıçta DDL çalıştırılmaz, mevcut kayıtlar taşınmaz/silinmez.

## Sınırlar

Finansman ürününün Shopify siparişi yalnız **finansman ilgi kaydıdır**. Belgeli ön başvuru formu veya banka kabulü değildir; ayrı bir ön başvuru webhook'u bağlanmış sayılmaz. Müşteri belgeleri ve tam sipariş gövdesi bu tablolarda tutulmaz.

Bu alıcı ödeme almaz, geri ödeme yapmaz, sipariş fulfil etmez ve rezervasyonu kesinleştirmez. Shopify ödeme düğmelerini ya da ödeme sağlayıcısını değiştirmez. Shopify ödeme durumu ve kurucu onay durumu ayrı tutulur.

Denetim ekranı bu aşamada salt okunurdur. Kurucu karar düğmeleri ve dış işlem uygulaması eklenmiş değildir. Canlı entegrasyon ancak gerçek mağaza bildirimi, kalıcı kayıt ve kurucu oturumunda görüntüleme doğrulandıktan sonra tamamlanmış sayılır.
