# MMT Global — kurumsal ve resmî iş akışı

Bu çalışma düzeni MMT Global / WelatTR / MMT Connect görevlerini aynı kayıt ve onay zincirinde izlemek içindir. Varsayılan hedef, rutin kurumsal ve resmî işleri uçtan uca dijital akışta otomatik yürütmek; insan müdahalesini yalnız kanunen zorunlu imza/onay, kurum veya sağlayıcı engeli, eksik kanıt ya da yüksek riskli istisnaya indirmektir. Asistan koordinasyon, hazırlık, teknik inceleme, otomasyon tasarımı ve kayıt takibini yürütür. Şirket adına temsil, imza, hukukî görüş verme, resmî başvuru gönderme veya dış tarafa taahhüt verme yetkisi oluşturmaz. CIO'nun açık onayı ve gereken gerçek imza/kimlik doğrulaması olmadan resmî işlem tamamlanmış sayılmaz.

## Dijital öncelikli işletim

- Gelen e-posta, web formu veya entegrasyon olayı tek bir dijital görev kaydına alınır; kaynak, zaman damgası ve kimlik/idempotency bilgisi korunur.
- OCR/alan çıkarımı, sınıflama, sorumlu kuyruğa yönlendirme, eksik belge kontrolü, durum güncellemesi ve son tarih hatırlatmaları otomatikleştirilir.
- Standart ve düşük riskli adımlar, kuralları sağladığında otomatik yürür; veri/izin doğrulaması başarısızsa akış kapalı kalır ve görev istisna kuyruğuna alınır.
- Resmî portal ve sağlayıcı API'leri uygunsa sonuçlar makineyle doğrulanıp kanıt kaydı eklenir. Entegrasyon yoksa dijital belge/yanıt yükleme tek istisna girdisidir; görev yine aynı dijital kayıtta izlenir.
- CIO onayı ve e-imza dijital onay ekranı/sağlayıcı aracı üzerinden alınır. İmza sahibinin kimlik doğrulaması ve bizzat imzası gereken yerde otomasyon taslağı ve kontrol paketini hazırlar, ardından bekler.
- Canlı dış mesaj, ödeme, resmî başvuru, taahhüt, yetki değişikliği ve production değişikliği için onay adımı sistemde ayrı kaydedilir; önceden tanımlı kapsam dışındaki hiçbir iş otomatik genişletilmez.

## Görev yaşam döngüsü

1. **Talep kaydı:** Amaç, kapsam, ilgili şirket/proje, sahibi, öncelik ve istenen tarih yazılır.
2. **Kanıt ve gereklilik:** Kaynak belge/bağlantı, kurumun güncel şartı, eksik bilgi ve son tarih kaydedilir. Gizli anahtarlar, parola, erişim tokenı ve tam kimlik numaraları görev panosuna konmaz.
3. **Taslak ve kontrol:** Form, yazışma veya teknik değişiklik hazırlanır. Hukukî/finansal içerik doğrulanması gereken uzman incelemesi olarak işaretlenir.
4. **CIO onayı:** Kapsam, alıcı/kurum, tutar veya taahhüt, ekler ve gönderim yöntemi açıkça gösterilir. Kritik resmî işlerde gereken e-imza CIO tarafından kendi yetkili aracıyla atılır.
5. **İcra:** Onaylanan iş, yetkili hesap/kurum portalından CIO tarafından veya ayrıca yetkilendirilmiş kişi tarafından tamamlanır. Bu depodaki otomasyon tek başına gönderim/başvuru yetkisi vermez.
6. **Makbuz ve kapatma:** Başvuru numarası, alındı/yanıt, tarih, güvenli kanıt bağlantısı ve sonraki adım kaydedilir. İş ancak kurum/karşı taraf sonucu kanıtlandığında kapatılır.

## İş alanları ve kapılar

| Alan | Hazırlanacak kayıt | Tamamlanma kanıtı |
|---|---|---|
| Şirket ve kurumsal kimlik | Unvan, yetkili kişi, adres/iletişim, faaliyet ve güncel resmî belge listesi | Kaynağı ve geçerlilik tarihi görünen belge; CIO kontrolü |
| E-posta, alan adı ve kurumsal telefon | Hesap/alan adı sahibi, kurtarma erişimi, DNS ve sağlayıcı ayarları | Doğrulanmış sahiplik ve gönderim/alım denemesi; gizli bilgiler yalnız sağlayıcı kasasında |
| Clerk ve panel erişimi | Doğru üretim projesi, doğru alan adı, yayın anahtarı eşleşmesi, sahip hesabı | CIO'nun gerçek hesabıyla giriş ve erişim kontrolü; anahtar değeri kaydedilmez |
| Meta / WhatsApp | Meta işletme varlığı, numara/telefon numarası kimliği, webhook, izinler ve şablon gereksinimleri | Meta test numarasıyla kontrollü uçtan uca deneme; canlı alıcı/yanıt için ayrı CIO onayı |
| Finans ve ödeme | Kurum/ürün, şartlar, ücretler, veri kaynağı, risk ve karar sahibi | Resmî kurum teyidi ve CIO'nun ayrı finansal onayı; otomatik ödeme yok |
| Lojistik ve ticaret | Taraf/işletme doğrulaması, izinli veri kaynağı, yük/araç/rota/şartlar | Güncel yazılı teyit ve ilgili belgeler; onaysız eşleştirme/teklif/gönderim yok |
| Resmî başvuru ve hukukî dosya | Kurum, başvuru türü, süre, gereken belge, yetkili imza sahibi | Kurum alındı belgesi veya resmî cevap; taslak hukukî sonuç sayılmaz |

## Durum sözlüğü

- **AUTO_READY:** Gerekli veri ve kurallar mevcut; dijital otomasyon sıraya alınabilir.
- **AUTO_RUNNING:** Otomasyon çalışıyor; her adım ve sonuç kaydediliyor.
- **WAITING_SIGNATURE:** Dijital taslak hazır; yetkili kişinin e-imzası/kimlik doğrulaması gerekiyor.
- **NEEDS_HUMAN_EXCEPTION:** Otomasyon kanıt, erişim, mevzuat veya veri tutarsızlığı nedeniyle durdu; yalnız istisna çözümü bekleniyor.
- **INBOX:** Talep geldi, kapsamı henüz netleşiyor.
- **PREPARING:** Kanıt ve taslak hazırlanıyor.
- **WAITING_EXTERNAL:** Kurum, destek ekibi veya sağlayıcı yanıtı bekleniyor.
- **WAITING_CIO:** CIO kararı/e-imzası gerekiyor.
- **READY_FOR_CONTROLLED_TEST:** Test girdileri, geri alma yolu ve alıcı onayı belirli.
- **TESTED:** Sonuç, tarih ve kanıt kaydedildi; canlı kullanım izni anlamına gelmez.
- **LIVE_APPROVED:** CIO'nun açık canlı onayı kayıtlı ve ilgili sağlayıcı ayarı yapılmış.
- **BLOCKED:** Erişim, veri, yetki, bütçe veya kurum şartı eksik.
- **CLOSED:** Sonuç kanıtlandı ve kayıt kapatıldı.

## Kayıt ve güvenlik ilkeleri

- Her dış sistem değişikliği için sistem adı, hesap/proje, ortam (TEST/PILOT/PROD), değişen alan, sorumlu, tarih, geri alma planı ve kanıt bağlantısı kaydedilir.
- Parolalar, `sk_*` anahtarları, Meta tokenları, Clerk secret key'leri, veritabanı URL'leri ve kişisel hassas veriler GitHub, görev panosu, e-posta taslağı veya sohbet mesajına yazılmaz. Yalnız ilgili sağlayıcının gizli değişken kasasında tutulur.
- Üretim veritabanı değişikliği için hedef veritabanı/branch doğrulanır, yedek ve etki planı incelenir, sonra CIO onayı alınır. Uygulama başlangıcında kendiliğinden DDL/migration çalıştırılmaz.
- Entegrasyonlar önce test hesabı/numarası ve gönderimsiz taslakla doğrulanır. Gerçek kullanıcıya mesaj, resmî başvuru, ödeme, taahhüt veya ticari hareket ayrı ve açık onay ister.
- Kanıt yoksa başarı durumu verilmez. Çalıştırılmayan kontrol `NOT TESTED` olarak kalır.

## Bu sürümdeki sınır

Bu dosya dijital öncelikli işletim hedefini ve kayıt şablonunu tanımlar. Bu hedef, henüz bağlanmamış kurum API'lerinin, yetkilerin, e-imza hesabının veya sağlayıcı erişiminin hazır olduğu anlamına gelmez. Bu dosya Render/Neon/Meta/Clerk ayarını değiştirmez, anahtarı eklemez, migration çalıştırmaz, başvuru yapmaz ve dış mesaj göndermez.
