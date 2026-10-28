# Lojistik — gönderimsiz canlıya hazırlık

Bu hazırlık yayın, gerçek mesaj, ödeme, sevkiyat, hesap/rol değişikliği veya ticari onay değildir.

## Hazırlanan çalıştırma yolları

- Mevcut API geliştirmede sentetik TEST taslaklarını işlemeye devam eder.
- `pnpm --filter @workspace/api-server run build` API, bağımsız worker ve salt okunur denetim girişlerini birlikte derler.
- `pnpm --filter @workspace/api-server run logistics:worker -- --once` tek tur çalıştırır; üretim izni yoksa kapalı kalır.
- `pnpm --filter @workspace/api-server run logistics:worker` bağımsız döngüdür. HTTP sunucusu açmaz, mevcut PostgreSQL havuzunu kullanır.
- Birden çok worker aynı anda çalışırsa PostgreSQL advisory lock aynı taslak turunun eşzamanlı yürütülmesini engeller.
- Gemini çağrısı 45 saniye zaman sınırına sahiptir. Kaynak/sürüm kontrolleri, eşsiz taslak ve bildirim indeksleri korunur.
- TEST modunda gerçek kayıtlar, üretim modunda TEST kayıtları otomatik taslak üretimine alınmaz.
- Her iki mod yalnız taslak ve `dry_run` bildirim kaydı üretir. Bu girişlerde Telegram göndericisi yoktur.

## Salt okunur denetim

Derlemeden sonra:

```sh
pnpm --filter @workspace/api-server run logistics:audit -- \
  --telegram-readonly --expected-db-fingerprint=<platformda-doğrulanmış-geliştirme-parmak-izi>
```

Parmak izi, açıkça geliştirme ortamına yöneltilmiş salt okunur platform sorgusuyla karşılaştırılmalıdır. `NODE_ENV` tek başına veritabanı hedefini kanıtlamaz. Denetim kolon/indeks/kısıt adlarını kontrol eder; tam DDL tanımı doğrulaması yerine geçmez.

Telegram denetimi yalnız `getMe` ve gerekiyorsa `getChat` çağırır. Anahtar, sohbet kimliği, kişisel sohbet içeriği veya sağlayıcı hata gövdesi yazdırılmaz. Özel sohbetin erişilebilirliği, kurucuya ait olduğunun kanıtı sayılmaz.

## Ayrı onaydan sonra yapılabilecek üretim hazırlığı

1. Kurucu hesabının gerçek üretim Clerk kimliği ve mevcut panel erişimi doğrulanmalıdır. Hesaplara test amacıyla kurucu rolü verilmez.
2. Güncel Publish şema planı yeniden incelenir. Üretime doğrudan DDL, başlangıçta tablo oluşturma veya deployment-time migration script eklenmez.
3. Normal Publish akışı tabloları oluşturduktan sonra üretim şeması salt okunur doğrulanır.
4. Uzun süre çalışan ayrı bir worker hizmeti kullanıcı tarafından onaylanıp yapılandırılmalıdır. API Autoscale zamanlayıcısı kesintisiz çalışma kanıtı değildir.
5. İleride etkinleştirmek için mevcut Gemini değişkenlerine ek olarak `NODE_ENV=production`, `REPLIT_DEPLOYMENT`, `MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED=true` ve `MMT_LOGISTICS_POOL_WORKER_ROLE=dedicated` gerekir. Bunlar bu hazırlıkta değiştirilmemiştir. Kurucu kimliği de zorunludur.
6. Worker yalnız mevcut iç kaynakları ve açıkça izin verilmiş beslemeleri yeniler; izinsiz internet taraması yapmaz.
7. Gerçek Telegram gönderimi için ayrıca doğrulanmış alıcı bağı, kurucu izni ve kalıcı teslimat/tekrar korumalı gönderim kuyruğu gerekir. Mevcut dry-run tablosunun kısıtı gevşetilmez.

## Bu hazırlıkta doğrulananlar

- Güncel Publish farkı: 5 tablo, 4 kolon, 3 yabancı anahtar, 5 eşsiz indeks; toplam 17 SQL ifadesi.
- Hesaplanan farkta yapısal veri kaybı veya kaldırma yok.
- Aynı sıra, geliştirmede mevcut tablolara dokunmayan ayrı bir geçici şemada başarıyla prova edilip geri alındı. Bu bir gerçek üretim çatallama testi değildir.
- Gerçek salt okunur sorguda bot kimliği `MMTGlobalLogistics_Bot` olarak doğrulandı.
- Özel kurucu sohbeti eksik; grup yapılandırmasının varlığı özel alıcı onayı değildir.
- Gerçek kurucu oturumunda panel görünümü ve üretim worker sürekliliği henüz doğrulanmadı.
