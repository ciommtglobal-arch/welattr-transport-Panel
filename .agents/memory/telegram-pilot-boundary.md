---
name: Telegram pilot sınırı
description: TEST pilot isteğini gerçek grup yayını ve ticari otomasyondan ayırma; webhook sahipliğini doğrulama.
---

Telegram pilotunu açma isteğini gerçek lojistik grubunda ilan yayını,
moderasyon, finansal bildirim veya ticari onay izni olarak genişletmeyin.
TEST dosyası gerçek operasyona dönüşmez.

**Why:** Kullanıcı otomasyonu başlatmak istedi; mevcut normal botun ilan yayımlama
ve kullanıcı moderasyonu davranışları, dosyanın önceki TEST sınırından daha genişti.

**How to apply:** Pilot için önceden yetkilendirilmiş operasyon hesaplarına özel,
kullanıcının başlattığı sohbet yanıtlarıyla sınırlı kalın. Telegram kimliğini MMT
personel rolü veya dosya yetkisi saymayın. Komutun çalışması, kalıcı dosya/görev
akışının tamamlandığı anlamına gelmez.

Botun webhook sahipliğini her bot için ayrı doğrulayın; yayın loglarındaki
Telegram 404 isteklerini otomatik olarak lojistik botuna bağlamayın.

**Why:** Yayında Telegram webhook 404 kayıtları görülürken yapılandırılmış
lojistik botunun kendi webhook bilgisi boştu. Bu kayıtlar aynı botun bağlantı
sorunu olduğunu kanıtlamadı.

**How to apply:** Polling başlangıcının mevcut webhook'u veya bekleyen
güncellemeleri koruduğunu varsaymayın. Mevcut webhook/mesaj kuyruğu varsa ayrı
inceleme ve onay olmadan silmeyin; dış mesaj veya gerçek tahsilatla bağlantı
testi yapmayın.

## Piyasa gruplarının otomatik keşfi

Kullanıcı @mmt33_bot için sabit grup ID zorunluluğunun kaldırılmasını; botun
yönetici olduğu group/supergroup sohbetinin ilk mesajıyla chat_id kaydını istedi.

**Why:** Kullanıcı grubu elle tanımlamak yerine yönetici yapılan bot üzerinden otomatik katılım talep etti.

**How to apply:** Gerçek Telegram yönetici durumunu ve webhook kimliğini doğrula;
kapatılmış kaynağı yeniden açma. Bu yetki dış bildirim, ticari onay veya ödeme izni değildir.

@mmt33_bot için piyasa alımı webhook sahibidir; eski normal Telegram polling
iş akışını otomatik olarak yeniden başlatmayın. VIP botu ayrı tutulur.

**Why:** Kullanıcı yayımlanmış uygulamayı grup dinleyicisi olarak bağlamayı seçti;
aynı botta polling ve webhook birlikte çalışmaz, eski bootstrap webhook'u silebilir.

**How to apply:** Genel workflow toplu başlatmalarında normal Telegram polling'i
hariç tutun; alıcı değiştirmeden önce getWebhookInfo ve bekleyen mesajları kontrol edin.
