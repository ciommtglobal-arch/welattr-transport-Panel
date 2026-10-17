---
name: Lojistik pilotunun TEST sınırı
description: UKR-MERSİN-NARENCİYE-001 için gerçek ticari kayıt ve işlem oluşturulmaması.
---

UKR-MERSİN-NARENCİYE-001 yalnız TEST verisidir. Bu pilotun denetimi ve
çalışmaları gerçek müşteri, sevkiyat, sözleşme veya ticari onay oluşturmamalıdır.
Yalnız TEST kullanıcıları ve sahte veriler kullanılmalı; mevcut hesaplar,
yetkiler ve gerçek veritabanı kayıtları değiştirilmemeli veya silinmemelidir.

**Why:** Kullanıcı bu dosyanın yalnız TEST olduğunu ve mevcut verilerin
korunmasını açıkça istedi.

**How to apply:** Bu pilotla ilgili sonraki çalışmalarda testleri izole edin;
eksik kontrolleri PASS saymayın. Ticari işlemlere veya canlı yayına geçişi
bu pilotun test onayı olarak yorumlamayın.

Özel MMT entegrasyonunda servisler arası HMAC, kullanıcı kimliği veya
ticari yetki değildir; kullanıcı Clerk oturumundan ve dosya erişimi mevcut
yetki sisteminden gelmelidir. Bu özel protokol Shopify/WhatsApp imzasının
yerine kullanılamaz. Görev/kurucu onay akışı yoksa başarı taklidi yapılmamalıdır.

**Why:** Kullanıcı özel entegrasyonun TEST sınırını ve servis ile gerçek
kullanıcı kimliğinin ayrılmasını açıkça istedi.

**How to apply:** Yeni olay türleri veya inceleme işlevleri eklenirken bu
ayrımı koruyun; TEST alındısını ticari onay veya tamamlanmış görev saymayın.

Salt okunur hazırlık kontrolü onayı, kalıcı davet/görev oluşturma veya eksik
dosyayı otomatik tamamlama yetkisi değildir. Kullanıcının dosyanın bitmesi ve
başka projelere geçmek için çalışma alanı istemesi de tek başına bu sınırı
kaldırmaz.

**Why:** Kullanıcı kayıtları değiştirmeden eksikleri raporlayan güvenli TEST
kontrolünü seçti; otomatik tamamlanmış/onaylanmış kayıt üretmeyi seçmedi.

**How to apply:** Çalışma alanının hazırlanması ile lojistik dosyasının gerçek
yaşam döngüsünün tamamlanmasını ayrı raporlayın. Sonraki davet/görev geliştirmesini
bu salt okunur kontrolün tamamlanmış bir özelliği gibi sunmayın.

Kullanıcı daha sonra mevcut veriler korunarak kalıcı pilot akışının tamamlanması
için yalnız geliştirmede ek TEST tablolarına açıkça izin verdi. Bu izin mevcut
hesapları veya personel rollerini değiştirme, ticari onay verme veya yayın yapma
izni değildir.

**Why:** Kullanıcı “mevcut verileri koruyarak TEST akışını tamamla” seçimini onayladı.

**How to apply:** Salt-okunur kontrolün önceki kapsamını kalıcı TEST geliştirmesini
engelleyen güncel bir yasak saymayın. TEST değerlendirmesi ile gerçek ticari kurucu
onayını ayrı tutun; bir TEST sonucunu sevkiyat/ödeme/yayın yetkisine dönüştürmeyin.
