# MMT lojistik: kontrollü yayın hazırlığı

Bu belge canlı geçişin tamamlandığı iddiası değildir. Üretim DDL'si, veri kopyalama,
dış bildirim, ödeme veya ticari onay komutu içermez.

## Veritabanı geçişi

Geliştirmede tanımlı ve mevcut, üretimde yapılan salt okunur kontrolde bulunmayan tablolar:

1. `logistics_pool_sources`
2. `logistics_pool_entries`
3. `logistics_pool_matches`
4. `logistics_pool_ai_drafts`
5. `logistics_pool_draft_notifications`
6. `gemini_workspace_turns`

Kaynak Drizzle şemaları `lib/db/src/schema/` içindedir ve mevcut DB paketinden dışa aktarılır.
İlk beş tablo havuz/taslak/bildirim kaydı içindir; altıncısı önizleme konuşma geçmişidir,
ticari onay kuyruğu değildir. Worker ayrıca mevcut istek/taşıyıcı tablolarında
`captured_by_clerk_user_id` ve `contact_use_confirmed` alanlarını gerektirir.
Üretimdeki salt okunur kolon kontrolünde bu dört alan da bulunmadı. Geçiş yalnız
altı yeni tabloyla sınırlı değildir; her iki mevcut tabloya bu alanların veri kaybı
olmadan eklenmesi de Publish farkında yer almalıdır. Eski kayıtlara kullanım izni
kendiliğinden verilmez; mevcut Drizzle boolean varsayılanı `false` korunur.

**Aşama 1:** Worker etkinleştirme bayrağı kapalıyken normal Publish şema farkını inceleyin.
Tablo, alan veya kayıt silme/yeniden adlandırma önerisini otomatik kabul etmeyin.
Yeni tabloların kaynak → entry/match → AI draft → bildirim yabancı anahtar sırasını ve
mevcut payment-session unique-index bağımlılıklarını Publish doğrulamasında kontrol edin.
Dev verisini üretimin üzerine yazma seçeneğini kullanmayın. Bu dosyayı migration betiği
olarak çalıştırmayın; üretime Drizzle push, başlangıç DDL'si veya build-time DDL eklenmedi.

## Ayrı worker süreci

API artifact'ının hazırlanmış üretim komutu `scripts/start-logistics-services.mjs` kullanır.
Varsayılan davranış yalnız mevcut API'yi çalıştırmaktır. Worker, ancak açık aktivasyon ve
kurucu/Gemini önkoşulları varsa ayrı Node alt süreci olarak başlar. API'ye dedicated rol verilmez.
Bir alt süreç beklenmedik şekilde durursa diğeri de kapatılır; barındırma yeniden başlatabilir.
Worker içindeki PostgreSQL advisory lock korunur. İkinci DB havuzu veya HTTP sunucusu yoktur.

**Aşama 2:** 7/24 hedefi için yayın türü Reserved VM olmalıdır; mevcut Autoscale yayınının
boşta uyuması kesintisiz çalışma kanıtı değildir. Yayın türü bu çalışmada değiştirilmedi.
Yayın üzerinden şema doğrulanmadan ve kurucu izni olmadan
`MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED=true` etkinleştirmeyin.
İlk aşama artifact çalıştırma yapılandırması bu bayrağı açıkça `false` tutar; ortak ortamda
önceden bulunabilecek bir etkinleştirme değeri ilk şema yayınında worker başlatmamalıdır.
İkinci aşamada bu artifact değeri de normal manifest doğrulamasıyla güncellenmelidir;
yalnız Secrets ekranından değiştirmenin çalıştırma ayarını geçersiz kıldığını varsaymayın.
Üretim kurucu kimliğini geliştirmeden kopyalamayın; gerçek üretim oturumuyla doğrulayın.

Supervisor'ın oluşturduğu özel geçici dizinde worker son tur kanıtı atomik olarak yazılır.
Panel aynı sunucu örneğinin kanıtını okur; 180 saniyeden eski/gelecek tarihli/okunamayan
kanıt çalışıyor sayılmaz. Son tur kanıtı tek başına 7/24 garanti değildir.

## İzinli gerçek kaynak

İlk kaynak mevcut MMT Connect yük/taşıyıcı başvurularıdır; yeni üçüncü taraf beslemesi
veya kazıma izni uydurulmaz. Gerçek kayıtta `contact_use_confirmed=true` ve
`captured_by_clerk_user_id` gerekir; taşıyıcının mevcut onay durumu ve operasyonel
eşleşme şartları ayrıca geçerlidir. Eksik rızalı kaynak operasyon havuzuna alınmaz.
TEST kayıtları gerçek kayıtlarla eşleştirilmez. Dış kaynak eklenecekse veri sahibinin
kullanım izni, sözleşme/API şartları ve mevcut güvenli kaynak formu kullanılmalıdır.

Salt okunur üretim kontrolü: 1 yük isteği, 0 taşıyıcı; Mersin çıkışlı izinli gerçek aday 0.
Bu nedenle gerçek eşleşme veya arka planda üretildiği iddiası şu an yapılamaz.

## Araştırma sonucu — operasyon kaydı değildir

29 Ekim 2026 tarihinde okunan halka açık kaynaklar:

- https://armut.com/fiyatlari/tir-nakliye_92982 :
  10 Ekim 2026 tarihli Mersin/Toroslar → Mardin/Midyat seramik taşıma talebi örneği.
  Bir fiyat örnekleri sayfasıdır. Açık iş, güncel yükleme tarihi, müşteri kimliği veya
  yeniden kullanım/otomatik içe aktarma izni doğrulanmadı. Aktif yük diye kaydedilmedi.
- https://mersinnakliyat.com/yurtici-nakliye/ :
  Firma yurtiçi komple/parsiyel taşıma hizmeti beyan ediyor. Müsait araç, bu rota için
  kabul, tonaj, belge veya fiyat teyidi yok. MMT iş ortağı veya uygun taşıyıcı diye onaylanmadı.

Teyit listesi: talebin açıklığı ve paylaşım izni; yetkili firma/temsilci ve fatura bilgileri;
yükleme/teslim adresleri ve tarihleri; net tonaj, hacim, ambalaj ve yükleme ekipmanı;
araç/dorse kapasitesi ve müsaitliği; işe göre geçerli taşıma yetki belgesi, sürücü belgeleri,
sigorta kapsamı; navlun/komisyon/KDV ve ödeme koşulları. Sınır ötesi işte ayrıca gümrük,
izin ve uygulanabilir yaptırım kontrolleri gerekir. Belgenin varlığı doğruluğu değildir.

## Kabul kanıtı

1. Publish şema doğrulaması + üretimde salt okunur katalog kontrolü.
2. Gerçek üretim kurucu oturumuyla panel erişimi.
3. İzinli gerçek ve güncel Mersin yükü + uygun/onaylı taşıyıcı.
4. Panel kapalıyken ayrı worker'ın bu verileri işlemesi.
5. `background_worker` kaynaklı `pending_review` taslak ve `dry_run` bildirim kaydı.
6. Paneli sonradan açınca aynı taslak, kaynak ve eksik teyitlerin görünmesi.

Her adımın ayrı PASS/FAIL/NOT TESTED sonucu olmalı. Eksik gerçek veri, eksik izin,
eksik üretim geçişi veya erişilemeyen kurucu oturumu başarılı sayılamaz.
