---
name: İncelenen kayıtla onay bağı
description: Kurucu onayını ve açık düzenleme formlarını arada değişen kayıtlarla karıştırmama ilkesi.
---

Kurucu onayı, yalnız doğru kişinin oturumuna değil, kişinin incelediği kayıt sürümüne de bağlı olmalıdır. Açık bir form, arka planda yenilenen verilerle sessizce yeni sürüme geçirilmemelidir.

**Why:** Bir teklif hâlâ onay beklerken fiyatı başka oturumda değişebilir. Yalnız durum ve yetki kontrolü, kurucunun görmediği koşulları onaylamasına engel olmaz. Plan notları da aynı şekilde eski bir formdan üzerine yazılabilir.

**How to apply:** Onay ve düzenleme akışlarında incelenen sürümü doğrula; değişmiş kayıtta işlemi durdur, girilen taslağı koru ve kullanıcıya güncel kaydı açıkça yeniden yükleme seçeneği ver. Zaman damgası sürüm olarak kullanılıyorsa aynı milisaniyedeki değişikliklerin ayırt edilmesini sağla.

## MMT Nexus / Shopify yayın kararı

Kurucu onayı tek başına halka yayın değildir. Kullanıcı, “Ayrı Yayımla kararıyla halka açık sayfa” seçeneğini seçti. Açık gösterime müşteri veya siparişin özel bilgileri taşınmamalıdır.

**Why:** Kullanıcı onaylanan kaydın kamuya görünmesini ayrı bir kurucu kararına bağladı.

**How to apply:** Onay ve yayın adımlarını ayrı tut; ikisini de incelenen sürüme bağla. Kamuya yalnız özel bilgi içermeyen koridor kartı çıkar, tüm siparişi veya ham Shopify metinlerini değil.
