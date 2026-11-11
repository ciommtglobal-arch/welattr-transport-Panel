# MMT lojistik kalıcı TEST çalışma alanı

## Teslim kapsamı

- Yol: `/staff/test-lojistik` (yalnız geliştirme önizlemesi).
- Sabit referans: **UKR-MERSİN-NARENCİYE-001**.
- Kalıcı, dosyaya ve gerçek Clerk kullanıcısına bağlı TEST davetleri.
- Görev sorumlusu, teslim tarihi, çıktı teslimi, gerekçeli düzeltme ve yeniden teslim.
- Eski çıktılar değiştirilmez; her yeniden teslim ayrı sürümdür.
- Kullanıcı/işlem/zaman geçmişi ve gerçek görevlerden hesaplanan yönetim özeti.
- Son TEST değerlendirmesi yalnız mevcut kurucu yetkisine açıktır.
- `approved_test` ticari onay, gerçek sevkiyat, sözleşme, ödeme veya yayın değildir.
- Özel servis entegrasyonunun `/approve` işlemi 501 döndürmeye devam eder.

## Yetki ve güvenlik

Mevcut Clerk oturumu zorunludur. TEST dosyasını mevcut operasyon yetkilisi veya
kurucu açıkça oluşturur; sayfayı açmak kayıt üretmez. Dosya sahibi ve kurucu dışında
erişim, bu dosyaya bağlı kabul edilmiş ve iptal edilmemiş davet gerektirir.
Davet kullanıcı kimliği, dosya, rol ve süreye bağlıdır. İptal, bağlı erişimi kaldırır.
Davet rolü küresel personel rolü değildir.

Alıcı mevcut bir geliştirme TEST hesabı olmalıdır: Clerk `privateMetadata` içinde
`logisticsPilotTest: true` veya `+clerk_test…@example.com` test e-postası.
İmza, Telegram kimliği veya istemciden gönderilen rol gerçek kullanıcı yerine geçmez.
Yetkisiz biri kendi çıktısını kabul edemez veya kurucu TEST kararı veremez.

Anahtarın yalnız özeti veritabanında tutulur; oluşturma yanıtında tek kullanımlık
iletim için bir kez döner, ekranda açık yazılmaz. URL, log, tarayıcı kalıcı deposu
ve sorgu önbelleğine kaydedilmez. Değişiklikler dosya satır kilidi altında, işlem
geçmişiyle aynı veritabanı transaction'ında tamamlanır.

Sunucu `NODE_ENV=development|test` dışındaki ortamlarda veya
`REPLIT_DEPLOYMENT` varsa 404 döndürür. Ön yüz sayfası ve rotası üretim
derlemesine dahil değildir. Uygulama başlangıcına DDL eklenmemiştir.

## Veritabanı değişikliği

Yalnız doğrulanmış geliştirme veritabanına beş ek tablo oluşturuldu:

- `logistics_pilot_files`
- `logistics_pilot_invites`
- `logistics_pilot_tasks`
- `logistics_pilot_submissions`
- `logistics_pilot_events`

Mevcut müşteri, sevkiyat, ödeme, personel rolü ve hesap kayıtları değiştirilmedi.
Bu tablolar gerçek lojistik tablolarına otomatik kayıt yazmaz. Üretim veritabanına
işlem yapılmadı. İleride kullanıcı Publish seçerse bu ek şema da yayın farkına
girebilir; o aşama ayrı inceleme ve onay gerektirir.

## Doğrulama sonuçları

116 sunucu testi ve 9 Telegram testi geçti. PostgreSQL akış testleri gerçek
geliştirme bağlantısında, yalnız `pg_temp` tablolarına yazar; rollback ile kapanır.
Genel tablolardaki mevcut kayıtlar test amacıyla güncellenmez veya silinmez.

| Kontrol | Sonuç | Kanıt / sınır |
| --- | --- | --- |
| Giriş, çıkış, aynı hesapla tekrar giriş | PASS | Programatik Clerk TEST hesabıyla tarayıcıda gözlendi |
| Manuel kayıt, e-posta doğrulaması, MFA | NOT TESTED | Mevcut kimlik doğrulama arayüzü değiştirilmedi; test yardımcısı kullanıldı |
| Davetin kullanıcı, rol ve dosyaya bağlanması | PASS | PostgreSQL rollback testi; Clerk alıcı kontrolü testte taklit edildi |
| Gerçek Clerk alıcısıyla tarayıcıda davet kabulü | NOT TESTED | Tarayıcı geçişi davet üretmedi |
| Süresi dolmuş, iptal edilmiş, yeniden kullanılan davet | PASS | Guard ve PostgreSQL testleri |
| Dosyaya yetkisiz doğrudan erişim | PASS | PostgreSQL erişim reddi ve tarayıcıda başlangıç 403 kontrolü |
| Sorumlu, teslim tarihi, çıktının kalıcı kaydı | PASS | PostgreSQL testi; tarayıcıda kaydetme ve yenileme sonrası koruma |
| Düzeltme ve önceki çıktıyı koruyarak yeniden teslim | PASS | PostgreSQL testinde iki ayrı sürüm korundu |
| Kendi çıktısını kabul edememe / yetkisiz kurucu kararı | PASS | Sunucu testleri; kendi çıktısını kabul düğmesi tarayıcıda kapalı |
| İşlem geçmişinde gerçek kullanıcı, işlem ve zaman | PASS | PostgreSQL ve oturumlu tarayıcı kontrolü |
| Eksik, gecikmiş ve karar bekleyen işler | PASS | PostgreSQL hesaplamaları; tarayıcıda bekleyen karar sayısı |
| 402 px mobil görünüm | PASS | Oturumlu ekran kontrolü; yatay taşma gözlenmedi |
| Production/deployment kilidi | PASS | Otomatik 404 testleri; TEST sayfası üretim JS paketinde yok |
| Gerçek ticari onay, GPS/geofence, ödeme, sevkiyat | NOT TESTED | Bu çalışma bunları etkinleştirmez |
| Gerçek Telegram kullanıcı komutu / grup yayını | NOT TESTED | Özel TEST botu başlatıldı; insan hesabından komut veya grup yayını yapılmadı |

Tarayıcı testi yalnız bu çalışmada oluşturduğu TEST dosyası, görev, çıktı ve
işlem kayıtlarını güvenli biçimde temizledi. Yeni TEST Clerk hesabı kaldı;
mevcut kullanıcı ve roller değiştirilmedi. İlk kullanımda yetkili hesap
“TEST dosyası oluştur” düğmesiyle kendi çalışma dosyasını açabilir.

## Komutlar

```sh
# Kalıcı akış testi: önce geliştirme hedefini doğrulayın.
LOGISTICS_PILOT_DB_TEST=1 pnpm --filter @workspace/api-server exec vitest run \
  src/lib/logisticsPilotWorkspace.test.ts \
  src/routes/logistics-test-pilot.test.ts \
  src/routes/logistics-operations.test.ts \
  src/routes/logistics-listing-workspace.test.ts \
  src/lib/logisticsWorkflow.test.ts \
  src/lib/logistics-preview-model.test.ts

python3 -m unittest discover -s telegram-bot -p 'test_pilot_mode.py' -v
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/mmt-global-website run typecheck
pnpm --filter @workspace/mmt-global-website run build
```

İlk geçişte eski salt-okunur kontrolün beklenen NOT_TESTED sayısı değiştiği için
bir test beklentisi uyuşmadı. Eski kontrolün yeni çalışma alanını test etmiş gibi
görünmemesi için kapsam metni ve beklenti düzeltildi; ilgili 27 test tekrar geçti.
Kalan 89 sunucu testi önceki aynı geçişte başarılıydı. Derlemedeki büyük paket
uyarısı engelleyici hata değildir.

## Dosyalar

- `lib/db/src/schema/logistics-pilot.ts`, `lib/db/src/schema/index.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-client-react/src/generated/**`, `lib/api-zod/src/generated/**`
- `artifacts/api-server/src/lib/logisticsPilotWorkspace.ts`
- `artifacts/api-server/src/lib/logisticsPilotWorkspace.test.ts`
- `artifacts/api-server/src/lib/logisticsPilotReadiness.ts`
- `artifacts/api-server/src/routes/logistics-pilot-workspace.ts`
- `artifacts/api-server/src/routes/logistics-test-pilot.test.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/mmt-global-website/src/pages/staff-test-logistics.tsx`
- `artifacts/mmt-global-website/src/pages/staff-operations-desk.tsx`
- `artifacts/mmt-global-website/src/components/logistics-pilot-readiness.tsx`
- `artifacts/mmt-global-website/src/App.tsx`
- `telegram-bot/pilot_mode.py`, `telegram-bot/test_pilot_mode.py`
- Bu rapor ve proje kapsam hafızası.

**CANLIYA ALINMADI. DEPLOY / PUBLISH başlatılmadı; domain ve yayın ayarları değişmedi.**
