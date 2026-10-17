---
name: Birlikte ödeme kanalları
description: Tami, Shopify ve Stripe için kullanıcının uluslararası çalışma hedefi ve tahsilat sınırları.
---

Kullanıcı mevcut Tami altyapısının tamamlanmasını seçti ve ekledi:
“Üçü bir birine entegreli olarak çalışsın uluslar arası çalışacağız.”
Buradaki üç seçenek Tami, Shopify ve Stripe idi.

**Why:** Kullanıcı bu kapsamı açıkça istedi; bu hedef üç sağlayıcının bağlandığı
veya uluslararası tahsilatın onaylandığı anlamına gelmez.

**How to apply:** Mevcut Tami fatura akışını ve Shopify ürün/checkout sahipliğini
koruyarak ortak görünürlük ve hizmet faturaları için kontrollü sağlayıcı seçimi
hedefle. Aynı ödemeyi farklı sağlayıcılarda otomatik yeniden deneme. Stripe hesap
bağlantısı, ülke/para birimi uygunluğu ve uçtan uca doğrulama tamamlanmadan üçlü
entegrasyon tamamlandı deme. Tahsilat yetkisini yayın veya kurucu operasyon onayı
yerine kullanma.

Kullanıcı Türkiye için zaten çalışması olduğunu belirtti; yabancı kart/3D yetkisi
açılamıyorsa ilk etapta Stripe ve Shopify ile ilerlemek istiyor.

**Why:** Kullanıcının uluslararası işe başlama tercihi budur; mevcut Türkiye
tahsilatını bozmak veya MMT Connect içindeki canlı kapıların zaten açık olduğunu
varsaymak için izin değildir.

**How to apply:** Türkiye'deki mevcut düzeni koru. Yabancı kart kabulü ile 3D
Secure yetkisini ayrı doğrula; kodla banka yetkisi açıldığını iddia etme. Stripe
hesabının kullanıcının seçtiği ve yetkili olduğu hesap olduğunu, test/canlı
durumunu ve uygulama bağlantısını ayrı ayrı doğrula.

Bağımsız Stripe Payment Link'in çalışma modu ile MCP/API hesabının ve uygulama
bağlantısının çalışma modunu birbirine eşitleme.

**Why:** Kullanıcının sunduğu ödeme sayfası açıkça canlı mod gösterirken daha
önce seçilen araç hesabı sandbox idi. Birinin test olması diğerinin de test
olduğunu göstermez; test hesabına verilen yetkiyi canlı hesaba taşımaz.

**How to apply:** Her kanalı kendi kanıtıyla değerlendir. Canlı linki kullanma
yetkisini ayrıca doğrula; linkin açılması, ödemenin başarılı olması, banka
hesabına aktarılması ve MMT faturasıyla otomatik eşleştirilmesini ayrı tut.
