# MMT Global — mobil imza hazırlık paketi

Bu dosyalar **imzasız taslaklardır**. Gerçek imza, sertifika doğrulaması, şirketi
temsil yetkisi, banka hesabı teyidi, KYC/AML tamamlanması veya POS kabulü anlamına
gelmez. Sağlayıcının resmî sözleşmesi yerine hazırlanmış sözleşmeler değildir.

## Dosyalar

- `mmt-mobil-imza-hazirlik.pdf` / `.docx`: durum, mobil imza sırası, belge listesi,
  yazılı teklif karşılaştırma şablonu ve resmî kaynaklar.
- `banka-teyit-talebi.pdf` / `.docx`: şirket hesabı, TRY/EUR/USD, IBAN/SWIFT ve
  mobil imza kabul kanalının banka tarafından teyidi için talep taslağı.
- `pos-kabul-teklif-talebi.pdf` / `.docx`: şirkete özel sağlayıcı kabulü, 3D Secure,
  yerli/yabancı kart, komisyon, valör, iade ve KYC koşullarına ilişkin talep taslağı.

DOCX düzenleme içindir; PDF imzasız inceleme kopyasıdır. `[KÖŞELİ PARANTEZLİ]`
alanlar tamamlanmadan imzalamayın. Şirket unvanı vergi levhası kopyasından
aktarılmıştır; güncel sicil ve temsil yetkisi ayrıca kontrol edilmelidir.

Kurumun kendi formu, kabul ettiği mobil imza yöntemi ve dosya formatı önceliklidir.
Doldurulan başvuru nüshası kurum formuna aktarılır veya TASLAK/İMZASIZ hazırlık
etiketleri son başvuru nüshasından kaldırılır. Metinle “imzalı/onaylı” damgası eklenmez.
Yetkili kişi son belgeyi resmî desteklenen işlemde inceleyip kendi mobil imzasıyla
onaylar. Kurum alındısı başvurunun kabul edildiğini göstermez; yazılı kabul ayrıca
alınır. İmzalı dosya sonradan değiştirilmez.

IBAN, SWIFT, VKN, kimlik, PIN, OTP, özel anahtar veya diğer erişim bilgileri
pakete aktarılmamıştır. Orijinal başvuru belgeleri kaynak koda veya kamuya açık
web dosyalarına eklenmez; yalnızca kurumun güvenli kanalında teslim edilir.

**Canlı tahsilat kapalı kalır.** Gerçek banka ve sağlayıcı onayları, sözleşme/KYC
sonucu, teknik ödeme/iade doğrulaması ve sahibin canlı açılış onayı tamamlanmadan
bu hazırlık paketi ödeme başlatma yetkisi vermez.

Yeniden üretim: `python3 scripts/src/generate-payment-preparation.py`

Belge durumunun ve resmî kaynakların son kontrol tarihi 03.10.2026'dır.
Dosyaları yeniden üretmek banka/POS kaydını, sertifikayı veya kamu izin durumunu
yeniden kontrol etmez. Başvuru tarihinde kurum ve izin kapsamı tekrar teyit edilir.