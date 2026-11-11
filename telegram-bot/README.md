# MMT Global Telegram Lojistik Botu

Bu bot, Telegram Topics/Forum kullanan MMT Global operasyon grubunda:

- Yük İlanları ve Boş Araçlar topic'lerini denetler.
- Eksik alanlı ilanlara nazikçe şablon uyarısı ve buton menüsü gösterir.
- Butonlu 8 adımlı form ile ilanı seçilen topic'e formatlı olarak gönderir.
- İlan sahibinin telefonunu ayrı ve gizli bir alanda toplar; telefon numarası
  ilan topic'inde yayınlanmaz, yalnızca `TELEGRAM_CONTACT_ADMIN_IDS` içindeki
  operasyon hesaplarına özel bildirim olarak gönderilir.
- İletişim alanında `bot` seçildiğinde, botun özel sohbetine gelen mesajları
  operasyon hesabına iletir.
- İzinsiz dış bağlantıları, bot hesaplarını ve küfürlü içerikleri kaldırır.
- İlk iki ihlalde uyarır, varsayılan olarak üçüncü ihlalde kullanıcıyı gruptan uzaklaştırır.
- Yönetici `/links` komutu ile davet ve topic bağlantılarını üretir.

## Telegram tarafında bir kez yapılacaklar

1. `@BotFather` üzerinden bot oluşturup token alın ve tokenı Replit **Secrets** bölümünde
   `TELEGRAM_BOT_TOKEN` adıyla saklayın.
2. Botu süper gruba yönetici olarak ekleyin. En azından **Mesajları silme**,
   **Kullanıcıları yasaklama**, **Davet bağlantıları oluşturma** ve topic'e mesaj
   gönderme yetkileri açık olmalıdır.
3. Grup sahibi veya yetkili, Telegram uygulamasında:
   `Grup Bilgisi > Düzenle > Grup Türü > Genel Grup` adımlarıyla public username
   belirlemelidir.
4. Botun bulunduğu grup ve iki topic içinde `/id` gönderin. Çıkan değerleri
   `TELEGRAM_GROUP_ID`, `LOADS_TOPIC_ID` ve `EMPTY_VEHICLES_TOPIC_ID` olarak ekleyin.

### Telegram API sınırları

Bot API bir grubun public kullanıcı adını değiştiremez; bu işlem Telegram
uygulamasından yapılır. `create_chat_invite_link` ile üretilen davet bağlantısı
gruba yöneliktir, belirli bir topic'e üyelik kilidi koymaz. Public topic linki
`https://t.me/<username>/<topic_id>` biçiminde oluşturulabilir; özel gruplardaki
`https://t.me/c/...` bağlantısı ise yalnızca gruba zaten katılmış üyelerde çalışır.

## Replit ayarları

Gizli tokenı **Secrets** ile, diğer değerleri normal environment variable olarak
ekleyin. Örnek değerler `.env.example` dosyasındadır.

Çalıştırma komutu:

```bash
python3 telegram-bot/bot.py
```

Bot, ana API servisine bağlı değildir; bu nedenle API servisi yeniden başlasa bile
bot için ayrı bir Replit workflow kullanılır.

## Özel sohbet TEST pilotu

`TELEGRAM_PILOT_MODE=true` yalnız geliştirme ortamında mevcut botu sınırlı pilot
modunda çalıştırır. Ayrı bot, sunucu veya veritabanı oluşturulmaz.

- Yalnız `TELEGRAM_CONTACT_ADMIN_IDS` içinde önceden tanımlı hesapların kendi
  özel sohbetlerinde `/start`, `/help` ve `/pilot` komutlarına yanıt verir.
- Grup mesajlarına, ilanlara ve diğer kullanıcılara yanıt vermez. İlan yayını,
  moderasyon, davet üretme, finansal bildirim veya ticari onay çalıştırmaz.
- Başlangıçta mesaj göndermez ve botun komut menüsünü değiştirmez.
- Mevcut webhook veya bekleyen güncellemeler varsa bunları silmeden durur.
- Kullanılan referans `UKR-MERSİN-NARENCİYE-001` olarak korunur. Yanıt, kalıcı
  kayıt/görev durumunu okuyan bir yönetim özeti değildir; tamamlanmamış dosyayı
  tamamlanmış veya ticari olarak onaylanmış göstermez.
- Telegram kimliği MMT personel rolüne çevrilmez. Uygulamadaki dosya erişimi
  mevcut Clerk ve yetki kontrollerine tabidir.
- Production çalışma ortamında TEST modu başlamaz. Bu ayarı kapatmak normal
  botun grup yayını/moderasyon davranışına geri döndürür; ayrı onay olmadan
  kapatmayın veya normal çalışma modunu etkinleştirmeyin.

İzole güvenlik testleri (gerçek Telegram isteği veya veri kaydı yok):

```bash
python3 -m unittest discover -s telegram-bot -p 'test_pilot_mode.py' -v
```

## İlan şablonu

Kullanıcılar doğrudan ilan yazacaksa şu alanların her biri kendi satırında ve `:`
işaretiyle bulunmalıdır:

```text
Çıkış: Cizre
Varış: Erbil
Yük: Genel kargo
Tonaj: 24 ton
Kasa Tipi: Tenteli
Ücret: 1.200 USD
Telefon: +90 532 123 45 67 (gizli form alanı)
İletişim: @kullanici veya bot
```

## Güvenlik notları

- Tokenı koda, `.env` dosyasına veya sohbet mesajına yazmayın.
- Moderasyon sayaçları bellekte tutulur; workflow yeniden başlarsa sıfırlanır.
- `ALLOWED_LINK_DOMAINS` değerini operasyon ihtiyacına göre dar tutun.
- Botun yöneticilerin mesajlarını denetim dışında bırakması kasıtlıdır.
- Gizli telefon bildirimlerini alacak operasyon hesabının Telegram ID'sini
  `TELEGRAM_CONTACT_ADMIN_IDS` değişkenine ekleyin.
- Formda alınan telefon numarası ilan metninde yayınlanmaz; şoför ilgilendiğinde
  paylaşım operasyon hesabı üzerinden yapılmalıdır.