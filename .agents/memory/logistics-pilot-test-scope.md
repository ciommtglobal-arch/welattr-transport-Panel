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
