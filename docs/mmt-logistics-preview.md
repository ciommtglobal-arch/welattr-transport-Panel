# MMT GLOBAL — MMT LOJİSTİK önizleme raporu

## Durum

**CANLIYA ALINMADI.** Bu çalışma için deploy/publish yapılmadı. Canlı site, domain ayarları, mevcut kullanıcılar, personel, roller, yetkiler ve veriler değiştirilmedi veya silinmedi.

Bu, görev çalışma alanındaki geliştirme önizlemesidir. Ana projeye aktarılmış veya üretimde etkinleştirilmiş bir operasyon sistemi olduğu iddia edilmez.

## Çalışmaya başlamadan oluşturulan yedek

- Kod ve Git geçmişi yedeği: `.local/backups/mmt-global-before-logistics-preview-20261006.bundle`
- Başlangıç commit'i: `2e6a46ed336651a53d8660ff3aba200a8816bd3e`
- Yedek `git bundle verify` ile doğrulandı.
- SHA-256: `c1408d42c2c4afee86cb5011e830f2747a1fd78a6b857bf5928004b40f398912`
- Yedek mevcut görev çalışma alanında tutulur. Bu bir kod yedeğidir; veritabanı yedeği veya canlı veritabanına erişim değildir.

## 1. Değiştirilen ve eklenen dosyalar

### Uygulama

`artifacts/mmt-global-website/` altında:

- `src/App.tsx` — yalnız geliştirmede açılan önizleme rotası ve geliştirme ana sayfası. Üretim ana sayfası korunur; `/ecosystem` mevcut kurumsal görünümü açar.
- `src/pages/logistics-preview.tsx` — modül gezinmesi, yerel kayıtlar, filtreler, dil seçimi ve ikincil birimler.
- `src/lib/logistics-preview/model.ts` — on modülün alanları, taslak doğrulaması, revizyon ve yayın engeli.
- `src/lib/logistics-preview/use-workspace.ts` — tarayıcıya özel kayıt, sekmeler arası güncelleme ve JSON dışa aktarma.
- `src/lib/logistics-preview/i18n.ts` — TR / EN / AR / KU / RU / UA önizleme çevirileri.
- `src/components/logistics-preview/banner.tsx` — kalıcı önizleme ve güvenlik açıklaması.
- `src/components/logistics-preview/record-form.tsx` — modüle özel oluşturma ve düzenleme formu.
- `src/components/logistics-preview/record-detail.tsx` — ayrıntılar, revizyon geçmişi ve aşama hazırlığı.
- `src/components/logistics-preview/styles.tsx` — yalnız bu önizlemeye uygulanan mobil/masaüstü stilleri.

### Kontrol ve belgeler

- `artifacts/api-server/src/lib/logistics-preview-model.test.ts` — saf veri modeli ve altı dil kontrolü; API veya veritabanı işlemi yapmaz.
- `docs/mmt-logistics-preview.md` — bu rapor.
- `.agents/memory/MEMORY.md`, `.agents/memory/mmt-global-i18n.md`, `.agents/memory/mmt-logistics-priority.md` — kullanıcının marka, bölge, dil ve onay sınırlarının proje notları.
- `screenshots/mmt-logistics-preview-desktop.jpg`
- `screenshots/mmt-logistics-preview-mobile.jpg`

Mevcut API işleyicileri, veritabanı şeması, Clerk ayarları, artifact manifestleri, `.replit`, domain ve yayın ayarları değiştirilmedi.

## 2. Eklenen modüller

1. Firma Kaydı
2. Firma Daveti
3. İş Ortaklığı
4. Yük Veren Firma
5. Taşıyıcı/Araç
6. Bayi/Distribütör
7. Personel
8. Teklif
9. Sözleşme
10. Operasyon Takibi

Her modülde modüle özel alanlarla taslak oluşturma, kaydetme, düzenleme ve ayrıntı gösterimi vardır. Kayıtlar aranabilir; bölge ve durumla filtrelenebilir. Revizyon geçmişi tutulur. Taslaklar JSON olarak dışa aktarılabilir. Başlangıç kayıtları boştur; gerçekmiş gibi sunulan örnek firmalar veya personel eklenmedi.

Firma Daveti gerçek e-posta göndermez veya hesap oluşturmaz. Personel modülü gerçek görev/rol/yetki atamaz. Sözleşme imzasız bir taslak metnidir; imza veya hukuki kabul işlemi yapılmaz. Operasyon Takibi canlı konum veya gerçekleşmiş taşımacılık kanıtı değildir.

## Bölgeler ve marka

- Ana marka: **MMT GLOBAL**
- Ana odak: **MMT LOJİSTİK**
- Mersin/Türkiye: Ana lojistik operasyon merkezi.
- Ukrayna: Bölgesel operasyon hazırlığı; aktif dış operasyon olarak sunulmaz.
- Dubai/BAE: Bölgesel operasyon hazırlığı; aktif dış operasyon olarak sunulmaz.

Finans, sağlık ve medya silinmedi. Önizlemede ikincil bağlantılarla mevcut alanlara erişim korunur.

## Yönetim akışı

**TASLAK → KURUCU ONAYI → YAYIN**

Önizlemede yalnız taslak oluşturma ve **yerel onay hazırlığı** yapılabilir. Onay hazırlığı kurucuya bildirim göndermez ve gerçek kurucu onayı sayılmaz. Bu aşamadaki kayıt düzenlemeye kilitlenir; düzenlemek için taslağa döndürülür.

**Yayın tamamen kapalıdır.** Firma, bayi, personel görevi, bölge veya içerik yayımlayan bir önizleme işlemi yoktur. Yerel depolamada uydurulmuş `approved` veya `published` durumları kabul edilmez.

## Diller

Önizleme TR / EN / AR / KU / RU / UA seçeneklerini içerir. Arapça sağdan sola; Kürtçe Latin yazısıyla soldan sağa gösterilir. UA seçeneğinde HTML dil kodu `uk` kullanılır. Mevcut sitenin dil yapısı ve çevirileri değiştirilmedi; altı dilli altyapı bu yeni önizleme yüzeyine eklendi. Kullanıcının yazdığı kayıt metni otomatik çevrilmez.

## 3. Veritabanında yapılan değişiklikler

**Yok.** Tablo, kolon, migration veya veritabanı kaydı eklenmedi, değiştirilmedi veya silinmedi. Üretim veritabanına sorgu/yazma yapılmadı.

Taslaklar yalnız kullanılan tarayıcının yerel önizleme alanında saklanır. Başka cihazlara paylaşılmaz; gerçek hesaba bağlanmaz. Tarayıcı verisi silinirse yerel taslaklar kaybolabilir; JSON dışa aktarma kullanılabilir. Gerçek kişisel bilgi, şifre, kod veya hassas belge girilmemelidir.

## 4. Önizleme bağlantısı

https://95daecab-4d2f-48d4-8df3-209aa45e9f35-00-aa4eoej441wn-zriqw3ca.sisko.replit.dev/lojistik-onizleme

Geliştirme önizlemesinin ana sayfası da aynı ekranı açar. Üretim derlemesinde bu önizleme rotası ve bileşenleri bulunmaz.

## Kontroller

- Veri modeli, yayın engeli, doğrulama, revizyon ve altı dil için **27 otomatik kontrol geçti**.
- Web uygulamasının TypeScript kontrolü geçti.
- Yerel Vite derlemesi başarılı oldu; önizleme rotası ve yerel depolama anahtarlarının üretim paketine girmediği doğrulandı. Derleme yayınlama değildir.
- Yönetilen web önizleme servisi yeniden başlatıldı ve çalışır durumda.
- Masaüstü ve 390 piksel genişliğindeki mobil ekran görüntüleri sağlıklı. Etkileşimli gerçek hesap testi veya gerçek davet kabulü yapılmadı.

## 5. Canlıya alınmadı onayı ve durma sınırı

**CANLIYA ALINMADI — DEPLOY/PUBLISH YAPILMADI.**

Bu rapordan sonra yeni işlem başlatılmaz; kullanıcıdan sonraki talimat beklenir.

Önceden istenen gerçek lider ve pilot asistan davet/kabul/yetki doğrulaması tamamlanmış değildir. Bu önizleme, gerçek kişi hesapları ve üretim oturumlarıyla yapılacak doğrulamanın yerine geçmez.
