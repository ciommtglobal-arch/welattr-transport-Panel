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

## V1 veri sözleşmesi — Gemini bağımsız inceleme görüşü (23 Kasım 2026)

Gemini'nin CIO tarafından iletilen teknik değerlendirmesiyle ilk köprü kapsamı **yalnız kurumsal takip kaydının dört alanına** indirildi. Mevcut Replit kaynak GET `/api/staff/corporate-follow-up` yanıtında bu alanlar doğrudan var; diğer kaynaklardan sahte kimlik, sürüm veya durum üretmeyeceğiz.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "version": 3,
  "approval": "revision_requested",
  "at": "2026-11-23T20:00:00.000Z"
}
```

Yukarıdaki kayıt **yalnız sentetik şema örneğidir**, gerçek dosya veya canlı API sonucu değildir.

| Alan | Kaynak | Kural |
| --- | --- | --- |
| `id` | `id` | Kaynakta yetkilendirilmiş dosyanın UUID'si ile birebir eşleşmeli |
| `version` | `version` | Pozitif güvenli tam sayı, otomatik varsayılan yok |
| `approval` | `approval` | Yalnız `pending_review`, `approved`, `rejected`, `revision_requested`; bu **Gemini kararı veya e-imza değildir** |
| `at` | `at` | Kaynaktaki gerçek UTC ISO olay zamanı, uydurma `updatedAt` yok |

`data.status` (`pending`, `active`, `blocked`, `closed`) **v1'e alınmadı**. Gerçek kullanım gerekçesi ve ayrı testlerle gerekirse sonraki sürümde iş durumu olarak eklenebilir; AI görevi durumu sayılmaz.

**Güvenlik sınırı:** `projectAuthorizedCorporateFollowUp` yalnız saf allowlist fonksiyonudur ve tek başına kayıt sahipliği doğrulamaz. Kaynak sunucu önce kurucu/Clerk erişimini ve `owner_clerk_user_id = actor` kapsamını doğrulamalı, sonra yalnız bu dört alanı seçip **ham `data`, `actor`, `hash`, `note`, geçmiş, prompt, belge, e-posta, API anahtarı veya başka kişisel bilgileri ağ üzerinden göndermemelidir**. Tarayıcıdan verilen ID veya `actor` yetki kanıtı değildir. Bu kaynak tarafı değişiklik **henüz yapılmadı**; PR yalnız hazırlık kodunu ve testleri içerir.

**Manuel Gemini incelemeleri ayrı faz:** Mevcut `POST /api/staff/corporate-follow-up/gemini-review`, `action: "list"` çıktısındaki `id` inceleme UUID'sidir, dosya UUID'si değildir. `source` hedef türü (`gmail`, `case`, `task`), `decision` insan inceleme kararıdır; `version`, `updatedAt`, `geminiReviewStatus`, sağlayıcı/model kanıtı yoktur. `case` hedefi tebligat/notice içermez. Bunlar **v1 köprüsüne dahil edilmez**; mevcut Replit kodu ve geçmişi korunarak ayrı yetki/sözleşme incelemesine alınır.

## Gerçek bağlantı için kabul kapıları (henüz tamamlanmadı)

1. Replit portal, Replit pilot ve Render servislerinin kaynak repo, dal, commit, Clerk issuer/audience ve Neon hedef dal eşleştirmesi yetkili ortamda, sır değerleri açılmadan doğrulanır.
2. Kaynak sunucuda şirket/owner kayıt sahipliği denetlenir. CIO portalındaki server-side gateway yalnız sabit izinli upstream'e gider. Tarayıcıya servis anahtarı, ham belge, prompt veya DB bağlantısı verilmez.
3. Önce **salt okunur** durum aktarılır. `TASK_BOARD.md` tarihsel devir kaydı ile DB hafızası farklı kaynaklar olarak tutulur; otomatik birleşmez. Eski Gemini sohbetleri API anahtarıyla kendiliğinden içe aktarılmaz; seçilmiş karar özetleri CIO incelemesine tabidir.
4. Sentetik entegrasyon testlerinde yanlış issuer/audience/tenant 401/403; eksik owner eşleşmesi reddedilir; 429/503/timeout otomatik provider tekrarı veya yazma başlatmaz; hassas alanlar sızmaz. `mmtReviewSummaryContract.test.ts` şimdilik yalnız gerçek Replit şemalarına uygun saf veri projeksiyonunu test eder, ağ/kimlik/DB entegrasyonunu değil.
5. GitHub PR #14 `UNKNOWN_OUTCOME` / idempotency migration'ı merge edilmeden ve hedef Neon dalı/yedeği onaylanmadan görev yazma açılmaz. PR #18 `GET /api/gemini/provider-check` gerçek Gemini `generateContent` çağırır; health check olarak çalıştırılmaz. Worker varsayılan kapalı tutulur.
6. CIO ayrı olarak onaylamadan Replit Agent harcaması, canlı dağıtım, secrets, production migration, gerçek Gemini çağrısı, dış mesaj, resmî belge veya ödeme işlemi yapılmaz.

## Bu PR'ın gerçek kapsamı

- Kaynakta önceden yetkilendirilmiş UUID ile eşleşen, yalnız dört gerçek alanı yansıtan saf, fail-closed **kurumsal takip projeksiyonu** ve Vitest testleri. **Tenant/owner doğrulaması henüz bu fonksiyonda veya çalışan bir gateway'de yoktur.**
- Kaynak envanteri ve sonraki köprü/Clerk/Neon doğrulama adımları.
- **Henüz yok:** çalışan gateway, Replit portal değişikliği, ortak DB erişimi, Gemini sohbet hafızası ithalatı, otomatik worker, gerçek entegrasyon veya üretim dağıtımı.
