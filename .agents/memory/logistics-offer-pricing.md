---
name: Lojistik teklif fiyatı
description: Müşteri satış fiyatı, taşıyıcı maliyeti ve komisyonla birlikte ayrı ticari satış farkı modeli.
---

MMT lojistik koridor kontrolünde teklif navlunu, müşteriye vereceğimiz taşıma satış fiyatıdır; taşıyıcıya ödeyeceğimiz taşıma maliyeti değildir.

**Why:** Kullanıcı bu iki anlam arasından açıkça “Müşteriye vereceğimiz taşıma satış fiyatı” seçeneğini seçti.

**How to apply:** Teklif, maliyet ve rapor alanlarında müşteri satış fiyatını taşıyıcı giderinden ayrı tutun. Satış fiyatı için belirlenen alt sınırı taşıyıcı maliyetine uygulamayın.

Kullanıcı MMT Connect için “Komisyon ve ayrı ticari satış farkı” modelini seçti. Müşteri satış fiyatı ile taşıyıcı bedeli arasındaki brüt ticari fark, platform komisyonundan ayrı bir MMT gelir kalemi olarak hesaplanacak.

**Why:** Tek ortak navlun üzerinden yalnız eşleştirme komisyonu ile ayrıca ticari satış farkı hesaplayan model karşılaştırıldığında kullanıcı ikinci modeli açıkça seçti.

**How to apply:** Ticari farkı komisyonla birleştirip tek komisyon gibi göstermeyin ve net kâr diye adlandırmayın. Her örnek dağılımda tahsil edilecek toplam ile tüm hakediş/gelir kalemlerinin toplamını dengeleyin. Bu model seçimi gerçek tahsilat, cüzdan aktarımı veya yayın izni değildir.

Taşıyıcının toplam platform komisyonundaki %50 payı, brüt hakedişinden düşülecek; ayrıca komisyon ödemesi alınması modeli seçilmedi.

**Why:** Kullanıcı iki ödeme yöntemi arasında açıkça “Hakedişinden düşülsün” seçeneğini seçti.

**How to apply:** Brüt taşıyıcı hakedişini, platform komisyonu kesintisini ve net hakedişi ayrı gösterin. Ticari satış farkını taşıyıcıdan ayrıca kesilecek ikinci bir komisyon gibi yorumlamayın. Bu karar yalnız taslak hesap kuralıdır; gerçek kesinti, tahsilat veya aktarımı etkinleştirme izni değildir.
