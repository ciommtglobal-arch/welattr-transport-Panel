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

Kullanıcı, alıcı adı Parlar Global LLC görünen canlı 100 USD Stripe hizmet bedeli
bağlantısını MMT Global için kullanmaya yetkili olduğunu açıkça onayladı.
Bu Stripe hesabının ABD'deki şirket üzerine kayıtlı olduğunu da belirtti.
Sonrasında ABD şirketinin kendisine ait olmadığını açıkça söyledi. Stripe
hesabını kullanmaya yetkili olduğu beyanını, şirket sahipliği veya payout/banka
yetkisinin doğrulandığı şeklinde yorumlamayın.

**Why:** Kullanıcı doğrudan bu canlı hesabı kullanma yetkisi sorusuna evet dedi;
hesabın şirket ülkesini ayrıca Amerika Birleşik Devletleri olarak doğruladı.
Şirketin kendisine ait olduğu varsayımını ise daha sonra düzeltti.

**How to apply:** Aynı bağlantı ve alıcı için hesap yetkisini tekrar tekrar
sormayın. Bu onayı gerçek tahsilat yapma, Tami/Shopify kaydını ödendi sayma,
otomatik mutabakatın tamamlandığını iddia etme veya projeyi yayımlama iznine
dönüştürmeyin. Bağlantı/alıcı değişirse kapsamı yeniden doğrulayın.
Başka şirkete ait tahsilat için resmî temsil/iş ilişkisi ve sağlayıcının izin
verdiği model ayrıca netleşmeden kullanıcının kendi IBAN'ına doğrudan payout
veya o şirket adına banka hesabı açma önerisi vermeyin.

Uluslararası tahsilat hedefi, yurt dışındaki Stripe hesabına gelen paranın
Türkiye'deki banka hesabına ulaşmasını da kapsıyor. Kullanıcı Stripe bakiyesini
Tami'ye veya bankaya nasıl aktaracağını soruyor; bunu sırf test için para
dolaştırma talebi gibi yorumlamayın.

**Why:** Kullanıcı, önceki yanıtın sorusunu karşılamadığını belirterek asıl
konunun yabancı Stripe hesabından Türkiye'ye para çekimi olduğunu açıkladı.

**How to apply:** Ödeme alma/API entegrasyonu ile bankaya payout yolunu ayrı
çözün. Stripe hesabının ülkesini, kabul edilen banka ve para birimini doğrulayın;
Türk IBAN desteğini, doğrudan Stripe→Tami aktarımını veya Global Payouts
uygunluğunu hesaba özel kanıt olmadan vaat etmeyin.
