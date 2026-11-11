# MMT Nexus — kurucu kararları ve ayrı yayın önizlemesi

## Kapsam ve bağlantılar

- `/nexus-onizleme`: sadece geliştirme derlemesinde bulunan, tarayıcı içi test ekranı.
  Gerçek Shopify ürünü/siparişi değildir; karar API'sini çağırmaz, veritabanına yazmaz.
- `/staff/nexus-denetim`: mevcut kurucu kimliğiyle korunan gerçek denetim masası.
- `/lojistik`: ayrı kurucu yayın kararı verilmiş koridor kartlarının açık görünümü.
- Bu çalışma bir Deploy/Publish işlemi değildir. Canlı veritabanında değişiklik yapılmadı.

## Güvenlik ve karar akışı

1. Shopify teslimatı kayıtları `PENDING_FOUNDER_APPROVAL` olarak oluşturur.
2. Onay/ret yalnız mevcut `MMT_FOUNDER_REVIEWER_CLERK_USER_ID` kimliğine açıktır.
   İsim, e-posta, istemci rolü veya gönderilen kullanıcı kimliği yetki sağlamaz.
3. Karar ve yayın, görüntülenen `snapshotToken` ile işlem içinde `SELECT FOR UPDATE`
   kilidi altında karşılaştırılır. Açık modal arka plan yenilemesiyle sessizce değişmez.
4. Onay yalnız incelenen kaynak koşullarını onaylar; yayın yapmaz.
5. Ayrı `Yayımla` kararı için geçerli güncel onay, pozitif miktar, iptal edilmemiş
   kalem ve doğrulanmış Samsun-Irak-Proje/Samsun-Gurcistan koridoru gerekir.
6. Ret ve yayından kaldırma açık görünümü kaldırır; sipariş satırını silmez.
7. Kabul edilen maddi kaynak değişiklikleri eski inceleme/yayın alanlarını temizler.
   Zaman damgası dışında değişmeyen tam teslimatlar kararı korur. Çelişen eşzamanlı
   kaynak görüntüleri 409 ile reddedilir ve teslimat uygulanmaz.
8. Her iki imzalı alıcı da tam, koridorlu görüntülerde aynı saklama kurallarını kullanır.
   Koridorsuz eski seçili-ürün akışı dış yayın için yeterli kanıt değildir; etkilenen
   koridor kaydının uygunluğu kaldırılır. Yeni, kabul edilen tam görüntü gereklidir.

## Açık yanıtın sınırı

`GET /api/logistics/nexus/publications` sadece `id`, `kind`, doğrulanmış `corridor`
ve `publishedAt` döndürür. Sipariş/müşteri/mağaza kimliği, ürün başlığı, serbest metin,
miktar, fiyat, onaylayanın kullanıcı kimliği veya dahili hash yayımlanmaz.
Kartlar ilgi kaydıdır; kesin rezervasyon, banka onayı, ödeme veya sözleşme değildir.
Açık yanıtta cache kapalıdır; ekran 30 saniyede bir yenilenir.

## Veritabanı ve sonraki yayın

Mevcut `nexus_shopify_intakes` tablosuna yedi nullable alan eklenmiştir:
`corridor`, `reviewed_source_hash`, `reviewed_at`, `reviewed_by`,
`published_source_hash`, `published_at`, `published_by`.
Mevcut kayıtları doldurma, silme, kullanıcı/rol değiştirme veya dış servis çağrısı yoktur.
Canlı şema bu alanları ancak kullanıcının başlattığı standart Publish akışında alır.
Başlangıç/build zamanı DDL veya ayrı üretim migration betiği yoktur.

Son karar/yayın kimliği ve zamanı korunur; append-only karar geçmişi bu kapsamda yoktur.

## Doğrulama ve canlıya geçiş sınırı

- İmza, bütün kalemler, tekrar/stale teslimatlar, kurucu yetkisi, snapshot çatışması,
  ayrı yayın, geri çekme, iptal ve açık DTO gizliliği için otomatik testler vardır.
- Native PostgreSQL CASE provaları açık geliştirme hedefinde, tek işlemde ve
  `ROLLBACK` ile yürütülür; gerçek kayıt veya test ürünü bırakılmaz.
- İzole test sayfası production derlemesine dahil edilmez.
- Gerçek kurucu oturumu ve gerçek Shopify teslimatı ayrıca doğrulanmalıdır.
- Mağaza yapılandırması yoksa açık API 503 döndürür; örnek kayıtla geçiştirmez.
  Onay alanları eksik eski şemada karar endpointleri de 503 döndürür.
- Mevcut özel/silinmiş ürün `variant_id=null` kabul eksikliği bu kapsamda giderilmedi.
- Doğrulanamayan tam kaynak bildirimleri 400/409 ile reddedilir. Bu durumda önceki
  yayını otomatik askıya alma/quarantine işlevi yoktur; gerçek yayın öncesi ayrı
  güvenlik çalışması gerektirir. İmzasız veya eski bildirim yayını düşürememelidir.
- Bu modül başka banka, ödeme, WhatsApp/Telegram veya bekleyen yayın aşamalarının
  tamamlandığını göstermez. Genel sistem için koşulsuz “yayına hazır” iddiası değildir.
