---
name: Shopify catalog connection
description: Durable rules for the connected physical-products store catalog.
---

The physical-products storefront treats Shopify as the system of record and reads its catalog only from server-side connector code. A connected but empty store must render an honest empty state; products, prices, inventory, images, collections, and publications must come from real Shopify data or explicit merchant input.

**Why:** The connected store can exist before the merchant has supplied a real catalog. Demo products or guessed commercial data would create misleading listings and could publish inventory that does not exist.

**How to apply:** Keep buyer-facing catalog responses minimal and public-safe, cache short-lived reads, and require explicit merchant product details before any Admin API write or checkout exposure.

MMT Nexus için kullanıcının belirttiği doğru mağaza `alioglu73.myshopify.com` mağazasıdır. Kullanıcı Shopify'dan gelen 75.000 TL rezervasyonları ve finansman başvurularını Çelik Kubbe denetim masasında `PENDING_FOUNDER_APPROVAL` (“Kurucu Onayı Bekliyor”) durumunda görmek istiyor.

**Why:** Kullanıcı doğru mağazayı açıkça belirtti ve kontrolün kurucu onayında kalmasını istedi.

**How to apply:** Entegrasyon hedefini doğrula; başka bir bağlı mağazayı Nexus sayma. Gelen kayıt ile kurucu onayını ayrı tut; mevcut canlı verileri bozma.