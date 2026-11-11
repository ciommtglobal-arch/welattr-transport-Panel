---
name: OpenAPI body modeli ad çakışmaları
description: Yeni POST body modellerinde kod üretimi sonrası aynı adlı Zod ve TypeScript dışa aktarımını önleme.
---

Yeni POST istek gövdeleri için adlandırılmış OpenAPI component modelleri
kullanın; inline body nesnelerinden kaçının.

**Why:** Orval'ın inline gövde için ürettiği TypeScript model adı ile
projenin Zod dışa aktarım düzeninin operation-body takma adı aynı olabiliyor.
Her iki üretim adımı başarılı görünse bile ortak kütüphane tür kontrolü
çift dışa aktarım hatası veriyor. Adlandırılmış component referansı çakışmayı
önlüyor; çalışma zamanı veya kod üreticisini değiştirmek gerekmiyor.

**How to apply:** Yeni gövdeleri component olarak tanımlayın ve endpoint'te
referans verin. Sadece üreticinin başarı mesajını değil, üretim sonrası
ortak kütüphane tür kontrolünü de tamamlayın.
