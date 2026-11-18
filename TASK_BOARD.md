# MMT Global / WelatTR — görev panosu

Güncelleme tarihi: 2026-11-18 (Europe/Istanbul saat dilimi)

Bu pano, kod deposunda doğrulanabilen hazırlık ve engelleri özetler. Hedef, rutin işleri insan eli değmeden dijital otomasyonla yürütmek; görevleri yalnız imza/kimlik doğrulaması, kurum/sağlayıcı engeli veya doğrulama istisnasında CIO kuyruğuna çıkarmaktır. Kaynak dokümanlar ve sağlayıcı kanıtları esas alınır. Bu listedeki onay kutusu, tek başına resmî veya canlı işlem yetkisi değildir.

| ID | Görev | Sorumlu | Durum | Kanıt | Sonraki adım | CIO onayı |
|---|---|---|---|---|---|---|
| AUTH-001 | Clerk üretim oturumu ve panel alan adı doğrulaması | CIO + teknik koordinasyon | WAITING_EXTERNAL | Kullanıcının bildirdiği “External Account was not found”; destek yanıtı bekleniyor | Destek yanıtını al, doğru Clerk uygulamasını ve panel hesabını doğrula; gizli anahtar paylaşma | Giriş/hesap değişikliği için gerekli |
| META-001 | Render'dan Meta WhatsApp Cloud API yanıtı | Teknik koordinasyon | PREPARING | [Meta Graph API PR #9](https://github.com/ciommtglobal-arch/welattr-transport-Panel/pull/9), taslak ve birleştirilmemiş | Değişiklik incelemesi ve build/typecheck; test numarasıyla onaylı deneme; Render secret varlığı yalnızca anahtar adlarıyla doğrulanmalı | Merge/deploy ve gerçek alıcıya mesaj için gerekli |
| MEM-001 | Paylaşılan hafıza tablosu ve Gemini görev kuyruğu | Teknik koordinasyon + CIO | BLOCKED | [AI_SHARED_MEMORY_BRIDGE.md](docs/AI_SHARED_MEMORY_BRIDGE.md) | Render API'nin gerçek DB hedefini gizli değer göstermeden doğrula; yedekle; additive migration planını incele; pilot/prod ayrımını koru | DB değişikliği ve worker aktivasyonu için gerekli |
| LOG-001 | Rızalı gerçek kaynakla lojistik eşleştirme | CIO + operasyon | BLOCKED | [logistics-controlled-launch.md](docs/logistics-controlled-launch.md) | Üretim şeması/izinli güncel yük/taşıyıcı kanıtlarını doğrula; TEST kayıtlarını gerçeklerden ayır | Gerçek veri ve işlem için gerekli |
| LOG-002 | Sürekli çalışan lojistik worker | Teknik koordinasyon | BLOCKED | [logistics-live-readiness.md](docs/logistics-live-readiness.md) | Şema ve kaynak geçişi sonrası ayrı worker servisi/çalıştırma planı; maliyet ve süreklilik kanıtı | Yeni servis/bütçe ve canlı aktivasyon için gerekli |
| CORP-001 | Kurumsal e-posta, alan adı ve şirket iletişim hesabı | CIO + teknik koordinasyon | INBOX | [Kurumsal süreç standardı](docs/corporate-official-workflow.md) | Mevcut sahiplik, kurtarma yöntemi ve alan adı durumunu sağlayıcı kayıtlarından envantere al | Hesap sahipliği veya dış değişiklikte gerekli |
| OFFICIAL-001 | Resmî başvuru ve şirket belge envanteri | CIO + teknik koordinasyon | INBOX | [Kurumsal süreç standardı](docs/corporate-official-workflow.md) | Kurum, başvuru türü, süre, yetkili imza ve belge gerekliliklerini dosya bazında kaydet | Başvuru ve e-imza için gerekli |
| TG-001 | Telegram bot sağlık ve alıcı doğrulaması | Teknik koordinasyon + CIO | BLOCKED | [logistics-live-readiness.md](docs/logistics-live-readiness.md) | Servis log/sağlık kanıtı ve özel alıcı sahipliği doğrulaması; gönderimsiz kontrol | Gerçek bildirim alıcısı ve gönderim için gerekli |

## Kısa takip kuralları

- Her görev için kanıt bağlantısı, son kontrol zamanı, ortam ve sonraki adım tutulur.
- Uygun görevler `AUTO_READY` → `AUTO_RUNNING` durumlarında dijital ilerler; imza `WAITING_SIGNATURE`, diğer istisnalar `NEEDS_HUMAN_EXCEPTION` olarak açıkça işaretlenir.
- Durum değişikliği ancak yeni kanıtla yapılır.
- Gizli değerler panoya yazılmaz; yalnız sağlayıcı ortamında saklanır.
- Dış mesaj, finansal hareket, resmî başvuru, veritabanı migration ve production deploy ayrı CIO onayı ister.
