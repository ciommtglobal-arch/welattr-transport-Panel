import { clerkClient } from "@clerk/express";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AssignLogisticsListingGrantBody, AssignLogisticsListingGrantResponse,
  CreateB2BListingBody, CreateLogisticsListingDraftBody, CreateLogisticsListingDraftResponse,
  GetLogisticsListingAccessResponse, GetLogisticsListingDraftsQueryParams, GetLogisticsListingDraftsResponse,
  GetLogisticsListingGrantsResponse, PublishLogisticsListingDraftBody, PublishLogisticsListingDraftParams,
  PublishLogisticsListingDraftResponse, RevokeLogisticsListingGrantParams,
  SaveLogisticsListingDraftBody, SaveLogisticsListingDraftParams, SaveLogisticsListingDraftResponse,
} from "@workspace/api-zod";
import { b2bListingsTable, db, logisticsListingDraftsTable as drafts, logisticsListingGrantsTable as grants } from "@workspace/db";
import { requireLogisticsAccess } from "../lib/logisticsListingAuth";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router: IRouter = Router();
const serializeDraft = (draft: typeof drafts.$inferSelect) => ({
  ...draft, createdAt: draft.createdAt.toISOString(), updatedAt: draft.updatedAt.toISOString(),
  publishedAt: draft.publishedAt?.toISOString() ?? null,
});
const serializeGrant = (grant: typeof grants.$inferSelect) => ({
  ...grant, active: grant.active === 1, updatedAt: grant.updatedAt.toISOString(),
});
const draftKeys = ["title", "fullName", "organization", "location", "contact", "description"];
function onlyKeys(body: unknown, allowed: string[]) {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) &&
    Object.keys(body).every((key) => allowed.includes(key)));
}
function cleanDraft(input: { title: string; fullName: string; organization: string; location: string; contact: string; description: string }) {
  return {
    title: input.title.trim(), fullName: input.fullName.trim(), organization: input.organization.trim(),
    location: input.location.trim(), contact: input.contact.trim(), description: input.description.trim(),
  };
}

// Session-based state changes must originate from this app, not an outside site.
router.use("/logistics-listings", (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    try {
      const origin = new URL(req.get("origin") ?? "");
      if (!["http:", "https:"].includes(origin.protocol) || origin.host !== getClerkProxyHost(req) ||
        req.get("sec-fetch-site") === "cross-site") throw new Error("Cross origin");
    } catch {
      res.status(403).json({ error: "Bu işlem uygulamanın kendi ekranından yapılmalıdır." });
      return;
    }
  }
  next();
});

router.get("/logistics-listings/access", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (access) res.json(GetLogisticsListingAccessResponse.parse(access));
});

router.get("/logistics-listings/grants", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  if (!access.canManageGrants) { res.status(403).json({ error: "Yetki listesini yalnız yönetici görebilir." }); return; }
  const items = await db.select().from(grants).orderBy(desc(grants.updatedAt));
  res.json(GetLogisticsListingGrantsResponse.parse(items.map(serializeGrant)));
});

router.post("/logistics-listings/grants", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  if (!access.canManageGrants) { res.status(403).json({ error: "Bu yetkiyi yalnız yönetici atayabilir." }); return; }
  const body = AssignLogisticsListingGrantBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Doğrulanmış hesap e-postasını girin." }); return; }
  const email = body.data.email.trim().toLowerCase();
  let users;
  try { users = await clerkClient.users.getUserList({ emailAddress: [email], limit: 2 }); }
  catch { res.status(502).json({ error: "Hesap kimliği doğrulanamadı; yetki atanmadı." }); return; }
  const user = users.data.length === 1 ? users.data[0] : undefined;
  if (!user || !user.emailAddresses.some((item) => item.emailAddress.trim().toLowerCase() === email && item.verification?.status === "verified")) {
    res.status(400).json({ error: "Tek bir mevcut hesap ve doğrulanmış e-posta gerekiyor." }); return;
  }
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || email;
  const [grant] = await db.insert(grants).values({
    clerkUserId: user.id, verifiedEmail: email, displayName, assignedBy: access.userId, active: 1,
  }).onConflictDoUpdate({
    target: grants.clerkUserId,
    set: { verifiedEmail: email, displayName, active: 1, assignedBy: access.userId, updatedAt: new Date() },
  }).returning();
  req.log?.info({ grantId: grant.id, actor: access.userId }, "Logistics draft capability assigned; existing roles unchanged");
  res.json(AssignLogisticsListingGrantResponse.parse(serializeGrant(grant)));
});

router.delete("/logistics-listings/grants/:id", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  if (!access.canManageGrants) { res.status(403).json({ error: "Bu yetkiyi yalnız yönetici kaldırabilir." }); return; }
  const params = RevokeLogisticsListingGrantParams.safeParse(req.params);
  if (!params.success) { res.status(404).json({ error: "Yetki kaydı bulunamadı." }); return; }
  const [grant] = await db.update(grants).set({ active: 0, assignedBy: access.userId, updatedAt: new Date() })
    .where(eq(grants.id, params.data.id)).returning();
  if (!grant) { res.status(404).json({ error: "Yetki kaydı bulunamadı." }); return; }
  req.log?.info({ grantId: grant.id, actor: access.userId }, "Logistics draft capability revoked; records preserved");
  res.sendStatus(204);
});

router.get("/logistics-listings/drafts", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  const params = GetLogisticsListingDraftsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Sayfa numarası geçersiz." }); return; }
  const page = params.data.page;
  const items = await db.select().from(drafts)
    .where(access.canManageGrants ? undefined : eq(drafts.authorClerkUserId, access.userId))
    .orderBy(desc(drafts.updatedAt), desc(drafts.id)).limit(26).offset((page - 1) * 25);
  res.json(GetLogisticsListingDraftsResponse.parse({
    items: items.slice(0, 25).map(serializeDraft), hasMore: items.length > 25, page,
  }));
});

router.post("/logistics-listings/drafts", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  if (!access.canDraft) { res.status(403).json({ error: "Etkin taslak yetkisi gerekiyor." }); return; }
  const body = CreateLogisticsListingDraftBody.strict().safeParse(req.body);
  if (!body.success || !body.data.title.trim()) { res.status(400).json({ error: "Taslak bilgileri geçersiz." }); return; }
  const result = await db.transaction(async (tx) => {
    const [grant] = await tx.select().from(grants).where(eq(grants.clerkUserId, access.userId)).for("update").limit(1);
    if (grant?.active !== 1) return null;
    const [draft] = await tx.insert(drafts).values({ ...cleanDraft(body.data), authorClerkUserId: access.userId }).returning();
    return draft;
  });
  if (!result) { res.status(403).json({ error: "Taslak yetkiniz kaldırılmış." }); return; }
  res.status(201).json(CreateLogisticsListingDraftResponse.parse(serializeDraft(result)));
});

router.patch("/logistics-listings/drafts/:id", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  if (!access.canDraft) { res.status(403).json({ error: "Etkin taslak yetkisi gerekiyor." }); return; }
  const params = SaveLogisticsListingDraftParams.safeParse(req.params);
  const body = SaveLogisticsListingDraftBody.safeParse(req.body);
  if (!params.success || !body.success || !onlyKeys(req.body, [...draftKeys, "revision"]) || !body.data.title.trim()) {
    res.status(400).json({ error: "Taslak güncellemesi geçersiz." }); return;
  }
  const result = await db.transaction(async (tx) => {
    const [grant] = await tx.select().from(grants).where(eq(grants.clerkUserId, access.userId)).for("update").limit(1);
    if (grant?.active !== 1) return { code: 403 as const };
    const [existing] = await tx.select().from(drafts)
      .where(and(eq(drafts.id, params.data.id), eq(drafts.authorClerkUserId, access.userId))).for("update").limit(1);
    if (!existing) return { code: 404 as const };
    if (existing.publishedListingId || existing.revision !== body.data.revision) return { code: 409 as const };
    const [draft] = await tx.update(drafts).set({
      ...cleanDraft(body.data), revision: existing.revision + 1, updatedAt: new Date(),
    }).where(eq(drafts.id, existing.id)).returning();
    return { code: 200 as const, draft };
  });
  if (result.code !== 200) {
    res.status(result.code).json({ error: result.code === 409 ? "Taslak değişmiş veya yayımlanmış; yeniden yükleyin." : "Taslak veya etkin yetki bulunamadı." });
    return;
  }
  res.json(SaveLogisticsListingDraftResponse.parse(serializeDraft(result.draft)));
});

router.post("/logistics-listings/drafts/:id/publish", async (req, res): Promise<void> => {
  const access = await requireLogisticsAccess(req, res);
  if (!access) return;
  if (!access.canPublish) { res.status(403).json({ error: "İlanı yalnız kurucu yayımlayabilir." }); return; }
  const params = PublishLogisticsListingDraftParams.safeParse(req.params);
  const body = PublishLogisticsListingDraftBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Yayım isteği geçersiz." }); return; }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(drafts).where(eq(drafts.id, params.data.id)).for("update").limit(1);
    if (!existing) return { code: 404 as const };
    if (existing.revision !== body.data.revision) return { code: 409 as const };
    if (existing.publishedListingId) return { code: 200 as const, draft: existing };
    const listing = CreateB2BListingBody.safeParse({ ...cleanDraft(existing), role: "logistics" });
    if (!listing.success) return { code: 400 as const };
    const now = new Date();
    const [published] = await tx.insert(b2bListingsTable).values({
      ...listing.data, role: "logistics", referenceCode: `B2B-${now.getUTCFullYear()}-${randomBytes(8).toString("hex").toUpperCase()}`,
      submitterClerkUserId: existing.authorClerkUserId, status: "approved",
      reviewerClerkUserId: access.userId, reviewedAt: now, publishedAt: now,
    }).returning();
    const [draft] = await tx.update(drafts).set({
      publishedListingId: published.id, publishedBy: access.userId, publishedAt: now, updatedAt: now,
    }).where(eq(drafts.id, existing.id)).returning();
    return { code: 200 as const, draft };
  });
  if (result.code !== 200) {
    res.status(result.code).json({ error: result.code === 400 ? "Yayım için başlık, iletişim, kurum, konum ve açıklama alanlarını tamamlayın." :
      result.code === 409 ? "Taslak incelemenizden sonra değişmiş; güncel sürümü inceleyin." : "Taslak bulunamadı." });
    return;
  }
  req.log?.info({ draftId: result.draft.id, listingId: result.draft.publishedListingId, actor: access.userId }, "Logistics listing published by founder");
  res.json(PublishLogisticsListingDraftResponse.parse(serializeDraft(result.draft)));
});

router.use("/logistics-listings", (error: unknown, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  req.log?.error({ err: error }, "Logistics listings workspace unavailable");
  res.status(503).json({ error: "Lojistik ilanları çalışma alanı hazır değil; kayıt yapılamadı. Önizleme şeması veya bağlantısı kontrol edilmelidir." });
});

export default router;
