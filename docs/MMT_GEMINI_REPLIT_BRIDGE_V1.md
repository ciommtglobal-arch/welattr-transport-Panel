# MMT Connect + WelatTR + Gemini: Replit geçmişini koruyan köprü (v1)

**Durum:** CIO onayıyla yalnızca izole GitHub inceleme dalında hazırlanmış sözleşme ve testler. Bu dosya veya bu PR, Replit ile Render arasında çalışan bağlantı kurulduğu anlamına gelmez. Üretime dağıtım, veritabanı değişikliği, ücretli Replit Agent veya gerçek Gemini API çağrısı yapılmaz.

## Kanonik kaynaklar (23 Kasım 2026 salt-okunur inceleme)

| Sistem | Kanıtlı kaynak | Görev |
| --- | --- | --- |
| Replit MMT Global / MMT Connect | `pilot/ai-collaboration` HEAD `9ca1bad2b8f43c78d8efd4d8fa561242a33d40cc` | Eski Gemini ortak masa, manuel bağımsız inceleme, pilot hafıza ve ajan koordinasyonu |
| Replit Management Dashboard | `artifacts/mmt-global-dashboard` + `artifacts/api-server` (ayrı Replit monorepo) | Tek CIO operasyon ekranı adayı; mevcut Gemini işlevi mesaj özetiyle sınırlı |
| GitHub / Render | `ciommtglobal-arch/welattr-transport-Panel`, Render `welattr-api-test`, `fix/gemini-provider-lock-state-20261119` | Ayrı AI görev/hafıza API ve Gemini provider-lock testleri; Render test dalı, Replit pilot ile aynı commit değil |
| Neon | `welattr-api-test-gemini-pilot-20261117`, `mmt-connect-pilot-20261113`, `production` | Ayrı dallar mevcut; hangi uygulamanın hangi dala bağlandığı kanıtlanmadı |

## Önceki Gemini–Replit çalışmaları yeniden kullanılacak

- Replit pilot geçmişinde `temiz-branch` (`63f519f`), `pilot/ai-collaboration`, Gemini adaptör kapısı (`ce56bdc`), üç ajan mock koordinasyonu (`0569f65`), agent registry / Google AI Studio adaptörü (`7f91b77`), manuel inceleme (`manualGeminiReview.ts`) korunuyor.
- Mevcut Replit pilotta `/staff/gemini`, `/api/gemini/workspace`, `deskAiProviders.ts`, `googleAiStudioGemini.ts`, `geminiWorkspace.ts`, `agentRegistry.ts`, `sharedWorkspace/pilotRepository.ts`, `memory_store` ve `TASK_BOARD.md` izleri var. `/api/ai/tasks` ve `/api/memory` bu Repl'de kayıtlı HTTP uçları olarak doğrulanmadı; bu adlar Render/GitHub API'siyle karıştırılmayacak.
- Eski `STATE.md` 51 mock/yerel test ve typecheck başarısı kaydediyor; bu, güncel HEAD veya gerçek sağlayıcı bağlantısı için test kanıtı değildir.
- Eski WelatTR API Test, WelatTR Panel 1–2 ve Telegram bot çalışmaları tarihsel kaynaklar olarak korunur. Ayrı eski Replit uygulamalarının tam dosyaları ve Gemini sohbet geçmişinin otomatik aktarımı doğrulanmadı.

## V1 veri sözleşmesi

Replit kaynak koduyla yeniden eşleştirildi: `mmtReviewSummaryContract.ts` **iki ayrı, salt-okunur kaynak projeksiyonu** sunar. Kurumsal takip için gerçek GET alanları `id` (UUID), `version`, `approval` (`pending_review`, `approved`, `rejected`, `revision_requested`) ve `at` (UTC ISO) kullanılır; çıktıda `sourceSystem`, `recordId`, `version`, `approval`, `at` bulunur. Manuel Gemini incelemesi için mevcut LIST yanıtının `id` (review UUID), `source` (`gmail`, `case`, `task`), `createdAt`, `respondedAt`, `decidedAt`, `decision` alanları kullanılır; çıktıda `reviewMode: manual_unverified` açıkça belirtilir. Hiçbir `taskStatus`, `geminiReviewStatus`, `cioDecisionStatus` veya `updatedAt` **uydurulmaz**. TASK_BOARD.md metin kimlikleri, ai_tasks ve mesaj özetleri bu ilk projeksiyona dahil edilmez.

İlk sürümde **başlık, ham Gemini yanıtı, prompt, memory content, e-posta, belge, Clerk user ID, owner scope ve gizli anahtar** taşınmaz. Kurumsal takip `approval` alanı bir dosya durumudur; manuel Gemini incelemesindeki `decision` ayrı bir insan inceleme kararıdır. Bunların hiçbiri tek başına doğrulanmış e-imza veya resmî onay anlamına gelmez. `UNKNOWN_OUTCOME`, `UNVERIFIED` ve `NOT_CONNECTED` gibi bu kaynaklarda bulunmayan durumlar otomatik üretilmez.

Saf dönüştürücüler `projectAuthorizedCorporateFollowUp` ve `projectAuthorizedManualGeminiReview` kaydın UUID'sini kaynak sunucunun **önceden yetkilendirdiği** UUID ile karşılaştırır. **Bu fonksiyonlar tek başına kullanıcıyı veya tenant'ı yetkilendirmez.** Kaynak sunucu `owner_clerk_user_id`/ilgili dosya ve görev sahipliğini ayrıca doğrulamalı; portalın Clerk issuer/audience ve şirket üyeliği için sunucu tarafında açık güven ilişkisi kurulmalıdır. Tarayıcıdan gönderilen owner ID, e-posta veya Clerk user ID yetki kanıtı değildir.

## Gerçek bağlantı için kabul kapıları (henüz tamamlanmadı)

1. Replit portal, Replit pilot ve Render servislerinin kaynak repo, dal, commit, Clerk issuer/audience ve Neon hedef dal eşleştirmesi yetkili ortamda, sır değerleri açılmadan doğrulanır.
2. Kaynak sunucuda şirket/owner kayıt sahipliği denetlenir. CIO portalındaki server-side gateway yalnız sabit izinli upstream'e gider. Tarayıcıya servis anahtarı, ham belge, prompt veya DB bağlantısı verilmez.
3. Önce **salt okunur** durum aktarılır. `TASK_BOARD.md` tarihsel devir kaydı ile DB hafızası farklı kaynaklar olarak tutulur; otomatik birleşmez. Eski Gemini sohbetleri API anahtarıyla kendiliğinden içe aktarılmaz; seçilmiş karar özetleri CIO incelemesine tabidir.
4. Sentetik entegrasyon testlerinde yanlış issuer/audience/tenant 401/403; eksik owner eşleşmesi reddedilir; 429/503/timeout otomatik provider tekrarı veya yazma başlatmaz; hassas alanlar sızmaz. `mmtReviewSummaryContract.test.ts` şimdilik yalnız gerçek Replit şemalarına uygun saf veri projeksiyonunu test eder, ağ/kimlik/DB entegrasyonunu değil.
5. GitHub PR #14 `UNKNOWN_OUTCOME` / idempotency migration'ı merge edilmeden ve hedef Neon dalı/yedeği onaylanmadan görev yazma açılmaz. PR #18 `GET /api/gemini/provider-check` gerçek Gemini `generateContent` çağırır; health check olarak çalıştırılmaz. Worker varsayılan kapalı tutulur.
6. CIO ayrı olarak onaylamadan Replit Agent harcaması, canlı dağıtım, secrets, production migration, gerçek Gemini çağrısı, dış mesaj, resmî belge veya ödeme işlemi yapılmaz.

## Bu PR'ın gerçek kapsamı

- Saf, fail-closed, tenant/source karşılaştırmalı **salt okunur veri projeksiyonu** ve Vitest testleri.
- Kaynak envanteri ve sonraki köprü/Clerk/Neon doğrulama adımları.
- **Henüz yok:** çalışan gateway, Replit portal değişikliği, ortak DB erişimi, Gemini sohbet hafızası ithalatı, otomatik worker, gerçek entegrasyon veya üretim dağıtımı.
