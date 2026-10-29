---
name: İncelenen kayıtla onay bağı
description: Kurucu onayını ve açık düzenleme formlarını arada değişen kayıtlarla karıştırmama ilkesi.
---

Kurucu onayı, yalnız doğru kişinin oturumuna değil, kişinin incelediği kayıt sürümüne de bağlı olmalıdır. Açık bir form, arka planda yenilenen verilerle sessizce yeni sürüme geçirilmemelidir.

**Why:** Bir teklif hâlâ onay beklerken fiyatı başka oturumda değişebilir. Yalnız durum ve yetki kontrolü, kurucunun görmediği koşulları onaylamasına engel olmaz. Plan notları da aynı şekilde eski bir formdan üzerine yazılabilir.

**How to apply:** Onay ve düzenleme akışlarında incelenen sürümü doğrula; değişmiş kayıtta işlemi durdur, girilen taslağı koru ve kullanıcıya güncel kaydı açıkça yeniden yükleme seçeneği ver. Zaman damgası sürüm olarak kullanılıyorsa aynı milisaniyedeki değişikliklerin ayırt edilmesini sağla.

## Teklif revizyonunun korunması

Kullanıcı teklif revizyonunda eski fiyat ve şartların korunmasını, yeni taslağın onaysız olarak yeniden kurucu incelemesine gelmesini istiyor. Revizyon yapan kişi onaylayan kişi olarak kaydedilmemeli.

**Why:** Kullanıcı revizyonun ticari onayla karışmaması ve eski geçmişin bozulmaması sınırını açıkça onayladı.

**How to apply:** Eski/yeni sürüm bağlantısı ve revizyon denetimi aynı atomik işleme dahil olmalı. Örnek kodlardaki adları mevcut çalışan sözleşmenin yerine körlemesine koyma; dış bildirim ve ödeme ayrı yetki gerektirir.

## MMT Nexus / Shopify yayın kararı

Kurucu onayı tek başına halka yayın değildir. Kullanıcı, “Ayrı Yayımla kararıyla halka açık sayfa” seçeneğini seçti. Açık gösterime müşteri veya siparişin özel bilgileri taşınmamalıdır.

**Why:** Kullanıcı onaylanan kaydın kamuya görünmesini ayrı bir kurucu kararına bağladı.

**How to apply:** Onay ve yayın adımlarını ayrı tut; ikisini de incelenen sürüme bağla. Kamuya yalnız özel bilgi içermeyen koridor kartı çıkar, tüm siparişi veya ham Shopify metinlerini değil.

## Evrak ve gönderim hedefi

Evrak onayı yalnız nesne yoluna bağlanmamalıdır: yükleme URL'si süresi dolana
kadar aynı nesnenin içeriği değiştirilebilir. İncelenen evrak sabitlenmiş bir
sürüme bağlanmalı; yükleme URL'si bu sürümü değiştirememelidir.
Yayın hedefi değişmesi de önceki incelemeyi geçersiz kılmalıdır.

**Why:** Aynı dosya yolu veya aynı ilan metni, incelenen evrakın/alıcının aynı
kaldığını tek başına kanıtlamaz.

**How to apply:** Yükleme tamamlandıktan sonra değiştirilemeyen belge sürümü
sakla, sürüm/checksum kontrollerini yap ve yayın hedefini onaylanan kaynak
parmak izine dahil et. Belirsiz sağlayıcı alındısını başarıya veya otomatik
tekrara dönüştürme.
