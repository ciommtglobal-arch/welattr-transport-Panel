# Replit tek oturum uygulama paketi — MMT Connect / WelatTR / Gemini

**Tarih:** 23.11.2026 · **CIO talebi:** Replit Agent kredisi ve uyku modu nedeniyle araştırma döngülerine girmeden önce bütün hazırlıklar tamamlansın; tek sınırlı uygulama oturumuyla işe yarar, test edilebilir bir sonuç elde edilsin.

## Ön kontroller (Replit Agent başlatmadan)

| Kontrol | Sonuç |
| --- | --- |
| Mevcut MMT Global `MMT Connect` Replit yayımlanma durumu | `success`, `https://mmt-global-or-mmt-connect.replit.app` |
| Ayrı MMT Global Management Dashboard yayımlanma durumu | `suspended` — bu oturumda uyandırma/yayınlama yok |
| GitHub PR #19 | `draft`, merge edilmedi; dört alan sözleşmesi ve sentetik testler var |
| PR #19 GitHub Actions | `Shared AI bridge validation` başarılı (run `45260765567`) |
| Replit pilot eski Gemini kaynakları | `pilot/ai-collaboration` HEAD `9ca1bad2...`; kurumsal takip, manuel Gemini incelemesi, Clerk kurucu kapısı mevcut |
| Gerçek Replit Agent kredi bakiyesi / maliyet üst sınırı | **Bu bağlantıdan doğrulanamıyor; Agent çağrısı ücretli olabilir** |

**Tek hedef uygulama:** mevcut MMT Global / MMT Connect Replit pilot. Ayrı Dashboard'a, Render'a, Neon prod'a, Telegram'a, Meta'ya, Gmail'e veya Gemini sağlayıcısına dokunulmayacak.

## Tek Agent çalışmasının net kapsamı

1. Mevcut kod/dal, Clerk kurucu yetkisi, kurumsal takip GET ve sahiplik filtresini **kısaca doğrula**. Yeni proje/panel/şema/servis oluşturma.
2. Mevcut kurumsal takip kaydı için **yalnız kaynakta yetkilendirilmiş** `id`, `version`, `approval`, `at` alanlarını döndüren, **kaynak sunucuda uygulanan** bir salt-okunur özet erişimi hazırla. Ham `data`, `actor`, `hash`, `note`, geçmiş, e-posta, belge, kullanıcı kimliği veya gizli anahtar ağ üzerinden gönderilmesin.
3. **Kurucu/Clerk doğrulaması ve `owner_clerk_user_id` kayıt sahipliği** atlanamaz; farklı hesap/tenant veya eksik doğrulamada fail-closed 401/403. İstemciden gelen `actor`, `ownerId`, `scope` yetki kabul edilmez.
4. `approval` kurumsal dosya durumudur; manuel Gemini `decision` ile birleştirme. `data.status` bu sürümde yok. Yeni Gemini API çağrısı, otomatik provider worker veya eski Gemini sohbet hafızası ithalatı yok.
5. Var olan test sisteminde **sentetik** başarılı/yetkisiz/sahiplik dışı/hassas alan sızıntısı senaryolarını çalıştır. Mevcut typecheck, ilgili testler ve build komutlarını çalıştır. Test komutları veya ön koşullar başarısızsa raporla ve dur; dış servislerle düzeltme deneme.
6. Değişiklikleri yalnız geliştirme ortamında tut. `main` merge/push, yayınlama, Render deploy, Neon DB migration, secrets, ek paket, ücretli sağlayıcı, gerçek kurumsal dosya/tebligat işlemi veya dış iletişim yok.
7. Sonuç raporu: değişen dosyalar, branch/commit, çalışan testler, kalan blokajlar, gerçek veriye erişim yapılmadığının kanıtı. **Bir oturumda tamamlanamazsa kapsamı genişletme veya tekrar deneme döngüsüne girme; güvenli durumu koruyup eksikleri raporla.**

## Kabul ölçütleri

- Doğru CIO oturumuyla yalnız yetkili kaydın **tam dört alanı** görünür.
- Yetkisiz istek ve başka hesaba ait kayıtlar 401/403 veya boş güvenli yanıt alır; sahte veri dönmez.
- Ham kaynak verisi ağ üzerinden sızmaz. Sadece istemci tarafında filtrelemek **kabul edilmez**.
- Test/typecheck/build raporu vardır; başarısızlık gizlenmez.
- **Yayınlama ve canlı sistemde işlem yoktur.**

## İşlem sonrası ayrı aşamalar (bu Agent oturumunda yapılmaz)

1. CIO portalı için Clerk issuer/audience, şirket/tenant ve kaynak kayıt sahipliği güven ilişkisini doğrulama.
2. Yalnız dört alanlı server-side gateway ve ekran; ikinci Replit uygulaması için ayrı kontrollü iş.
3. Gemini manuel bağımsız inceleme ve geçmiş karar özetlerini **ayrı, CIO onaylı** ortak hafıza aşamasında bağlama.
4. Render/Neon görev kuyruğu, `UNKNOWN_OUTCOME` ve provider lock kontrollerini, test ve bütçe sınırları onaylandıktan sonra ele alma.

**Maliyet notu:** Tek bir Replit Agent isteği bile kullanım kredisi tüketebilir. Buradan Replit hesabındaki bakiye, Agent fiyatı veya harcama limiti görülemediği için **tek oturum = sabit maliyet / garanti bitiş** iddiasında bulunulmaz. Bu plan yeni ücretli servis açmaz; çalıştırmadan önce hesabın kendi limitleri geçerlidir.
