import { randomBytes } from "node:crypto";
import { clerkClient, getAuth } from "@clerk/express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { Router, type Request, type Response, type IRouter } from "express";
import { db, kasaBranchesTable as branches, kasaUsersTable as users, kasaRequestsTable as requests, kasaAuditTable as audits, type KasaMember } from "@workspace/db";
import {
  GetKasaMeResponse, SetupKasaOwnerResponse, GetKasaBranchesResponse, CreateKasaBranchBody, CreateKasaBranchResponse,
  UpdateKasaBranchBody, UpdateKasaBranchParams, UpdateKasaBranchResponse,
  GetKasaUsersResponse, GrantKasaUserBody, GrantKasaUserResponse, UpdateKasaUserBody, UpdateKasaUserParams, UpdateKasaUserResponse,
  GetKasaRequestsQueryParams, GetKasaRequestsResponse, CreateKasaRequestBody, CreateKasaRequestResponse,
  GetKasaRequestParams, GetKasaRequestResponse, GetKasaPublicRequestParams, GetKasaPublicRequestResponse,
  GetKasaSummaryQueryParams, GetKasaSummaryResponse,
} from "@workspace/api-zod";
import { canReadKasaRequest, kasaUserView, ownerIdentity, normalizeKasaAmount, validKasaDate, KASA_CURRENCIES, KASA_TIMEZONE } from "../lib/kasa";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const fail = (res: Response, status: number, error: string) => { res.status(status).json({ error }); };
const userId = (req: Request, res: Response) => {
  const id = getAuth(req).userId;
  if (!id) fail(res, 401, "Giriş yapmanız gerekiyor.");
  return id;
};
async function member(req: Request, res: Response, admin = false): Promise<KasaMember | null> {
  const id = userId(req, res);
  if (!id) return null;
  const [user] = await db.select().from(users).where(and(eq(users.clerkUserId, id), eq(users.active, true))).limit(1);
  if (!user || (admin && user.role !== "admin")) {
    fail(res, 403, admin ? "Bu işlem için kasa yöneticisi yetkisi gerekiyor." : "Bu uygulama için aktif kasa yetkiniz yok.");
    return null;
  }
  return user;
}
// Cookie-authenticated mutations require the same browser origin.
router.use("/kasa", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) { next(); return; }
  // Return 401 before origin checks for anonymous or spoofed-header requests.
  if (!getAuth(req).userId) { fail(res, 401, "Giriş yapmanız gerekiyor."); return; }
  try {
    const origin = new URL(req.get("origin") ?? "");
    if (!["https:", "http:"].includes(origin.protocol) || origin.host !== getClerkProxyHost(req) || req.get("sec-fetch-site") === "cross-site") {
      fail(res, 403, "İstek aynı uygulama üzerinden gönderilmelidir."); return;
    }
  } catch { fail(res, 403, "İstek kaynağı doğrulanamadı."); return; }
  next();
});

router.get("/kasa/me", async (req, res): Promise<void> => {
  const id = userId(req, res); if (!id) return;
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, id)).limit(1);
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.owner, true)).limit(1);
  res.json(GetKasaMeResponse.parse({
    user: user ? kasaUserView(user) : null, canSetup: !owner && id === ownerIdentity(), liveEnabled: false,
  }));
});

router.post("/kasa/setup", async (req, res): Promise<void> => {
  const id = userId(req, res); if (!id) return;
  if (id !== ownerIdentity()) { fail(res, 403, "İlk yönetici kurulumu yalnızca doğrulanmış sahibin hesabıyla yapılabilir."); return; }
  let account;
  try { account = await clerkClient.users.getUser(id); }
  catch { fail(res, 502, "Hesap doğrulama hizmetine ulaşılamadı."); return; }
  const primary = account.emailAddresses.find(e => e.id === account.primaryEmailAddressId);
  if (primary?.verification?.status !== "verified") { fail(res, 403, "Önce hesabınızın e-posta adresini doğrulayın."); return; }
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(841904)`);
    const [owner] = await tx.select().from(users).where(eq(users.owner, true)).limit(1);
    if (owner) return owner.clerkUserId === id ? owner : null;
    const [existing] = await tx.select().from(users).where(eq(users.clerkUserId, id)).limit(1);
    const values = { clerkUserId: id, name: [account.firstName, account.lastName].filter(Boolean).join(" ") || "Uygulama sahibi", role: "admin" as const, active: true, owner: true };
    const [user] = existing
      ? await tx.update(users).set(values).where(eq(users.id, existing.id)).returning()
      : await tx.insert(users).values(values).returning();
    await tx.insert(audits).values({ actorId: user!.id, action: "owner_setup", entityId: user!.id });
    return user!;
  });
  if (!result) { fail(res, 409, "Uygulama sahibi daha önce kurulmuş."); return; }
  res.json(SetupKasaOwnerResponse.parse(kasaUserView(result)));
});

router.get("/kasa/branches", async (req, res): Promise<void> => {
  const user = await member(req, res); if (!user) return;
  const rows = await db.select().from(branches).where(user.role === "cashier" ? eq(branches.id, user.branchId ?? -1) : undefined).orderBy(branches.name);
  res.json(GetKasaBranchesResponse.parse(rows));
});
router.post("/kasa/branches", async (req, res): Promise<void> => {
  const user = await member(req, res, true); if (!user) return;
  const parsed = CreateKasaBranchBody.strict().safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) { fail(res, 400, "Şube adı 1–100 karakter olmalıdır."); return; }
  const result = await db.transaction(async tx => {
    const [row] = await tx.insert(branches).values({ name: parsed.data.name.trim() }).onConflictDoNothing().returning();
    if (row) await tx.insert(audits).values({ actorId: user.id, action: "branch_create", entityId: row.id });
    return row;
  });
  if (!result) { fail(res, 409, "Bu isimde bir şube zaten var."); return; }
  res.status(201).json(CreateKasaBranchResponse.parse(result));
});
router.patch("/kasa/branches/:id", async (req, res): Promise<void> => {
  const user = await member(req, res, true); if (!user) return;
  const p = UpdateKasaBranchParams.safeParse(req.params), b = UpdateKasaBranchBody.strict().safeParse(req.body);
  if (!p.success || !b.success || !b.data.name.trim()) { fail(res, 400, "Şube bilgileri geçersiz."); return; }
  try {
    const result = await db.transaction(async tx => {
      const [row] = await tx.update(branches).set({ ...b.data, name: b.data.name.trim() }).where(eq(branches.id, p.data.id)).returning();
      if (row) await tx.insert(audits).values({ actorId: user.id, action: row.active ? "branch_update" : "branch_deactivate", entityId: row.id });
      return row;
    });
    if (!result) { fail(res, 404, "Şube bulunamadı."); return; }
    res.json(UpdateKasaBranchResponse.parse(result));
  } catch (error) {
    if ((error as { cause?: { code?: string }; code?: string }).cause?.code === "23505" || (error as { code?: string }).code === "23505") { fail(res, 409, "Bu isimde bir şube zaten var."); return; }
    throw error;
  }
});

router.get("/kasa/users", async (req, res): Promise<void> => {
  if (!await member(req, res, true)) return;
  res.json(GetKasaUsersResponse.parse((await db.select().from(users).orderBy(users.id)).map(kasaUserView)));
});
async function validBranch(branchId: number | null, role: string, allowInactive = false) {
  if (branchId === null) return role === "admin";
  const [branch] = await db.select().from(branches).where(and(eq(branches.id, branchId), allowInactive ? undefined : eq(branches.active, true))).limit(1);
  return !!branch;
}
router.post("/kasa/users", async (req, res): Promise<void> => {
  const user = await member(req, res, true); if (!user) return;
  const b = GrantKasaUserBody.strict().safeParse(req.body);
  if (!b.success || !await validBranch(b.data.branchId, b.data.role)) { fail(res, 400, "Kasiyer için aktif şube seçin; kullanıcı bilgilerini kontrol edin."); return; }
  const email = b.data.email.trim().toLowerCase();
  let accounts;
  try { accounts = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 }); }
  catch { fail(res, 502, "Kullanıcı doğrulama hizmetine ulaşılamadı."); return; }
  const matches = accounts.data.filter(a => a.emailAddresses.some(e => e.emailAddress.toLowerCase() === email && e.verification?.status === "verified"));
  if (matches.length !== 1) { fail(res, 400, "Bu e-postayla kayıtlı tek bir doğrulanmış hesap bulunmalı. Önce kullanıcı kayıt olup e-postasını doğrulasın."); return; }
  const target = matches[0]!;
  const result = await db.transaction(async tx => {
    const [row] = await tx.insert(users).values({
      clerkUserId: target.id, name: [target.firstName, target.lastName].filter(Boolean).join(" ") || target.username || "Kasa kullanıcısı",
      role: b.data.role, branchId: b.data.branchId,
    }).onConflictDoNothing().returning();
    if (row) await tx.insert(audits).values({ actorId: user.id, action: "user_grant", entityId: row.id });
    return row;
  });
  if (!result) { fail(res, 409, "Bu hesap zaten eklenmiş. Mevcut kaydı düzenleyin."); return; }
  res.status(201).json(GrantKasaUserResponse.parse(kasaUserView(result)));
});
router.patch("/kasa/users/:id", async (req, res): Promise<void> => {
  const user = await member(req, res, true); if (!user) return;
  const p = UpdateKasaUserParams.safeParse(req.params), b = UpdateKasaUserBody.strict().safeParse(req.body);
  if (!p.success || !b.success) { fail(res, 400, "Kullanıcı bilgileri geçersiz."); return; }
  if (p.data.id === user.id) { fail(res, 403, "Kendi yetkinizi veya şubenizi bu ekrandan değiştiremezsiniz."); return; }
  if (!await validBranch(b.data.branchId, b.data.role, !b.data.active)) { fail(res, 400, "Aktif kasiyer için aktif bir şube gereklidir."); return; }
  const [target] = await db.select().from(users).where(eq(users.id, p.data.id)).limit(1);
  if (!target) { fail(res, 404, "Kullanıcı bulunamadı."); return; }
  if (target.owner) { fail(res, 403, "Uygulama sahibinin yetkileri değiştirilemez."); return; }
  const [row] = await db.transaction(async tx => {
    const rows = await tx.update(users).set(b.data).where(eq(users.id, p.data.id)).returning();
    await tx.insert(audits).values({ actorId: user.id, action: "user_update", entityId: p.data.id });
    return rows;
  });
  res.json(UpdateKasaUserResponse.parse(kasaUserView(row!)));
});

function filters(branchId?: number, date?: string): SQL[] {
  const items: SQL[] = [];
  if (branchId) items.push(eq(requests.branchId, branchId));
  if (date) items.push(sql`(${requests.createdAt} at time zone ${KASA_TIMEZONE})::date = ${date}::date`);
  return items;
}
router.get("/kasa/requests", async (req, res): Promise<void> => {
  const user = await member(req, res); if (!user) return;
  const q = GetKasaRequestsQueryParams.strict().safeParse(req.query);
  if (!q.success || !validKasaDate(q.data.date)) { fail(res, 400, "Şube veya tarih filtresi geçersiz."); return; }
  const conditions = filters(q.data.branchId, q.data.date);
  if (user.role === "cashier") conditions.push(eq(requests.cashierId, user.id));
  res.json(GetKasaRequestsResponse.parse(await db.select().from(requests).where(and(...conditions)).orderBy(desc(requests.createdAt))));
});
router.post("/kasa/requests", async (req, res): Promise<void> => {
  const user = await member(req, res); if (!user) return;
  const b = CreateKasaRequestBody.strict().safeParse(req.body);
  const amount = b.success ? normalizeKasaAmount(b.data.amount) : null;
  if (!b.success || !amount) { fail(res, 400, "Pozitif, en fazla iki ondalıklı tutar ve geçerli para birimi girin."); return; }
  if (user.role === "cashier" && user.branchId !== b.data.branchId) { fail(res, 403, "Yalnızca kendi şubeniz için talep oluşturabilirsiniz."); return; }
  const result = await db.transaction(async tx => {
    // Row locks prevent a branch/user being deactivated during request creation.
    const [current] = await tx.select().from(users).where(eq(users.id, user.id)).for("share");
    const [branch] = await tx.select().from(branches).where(eq(branches.id, b.data.branchId)).for("share");
    if (!current?.active || !branch?.active || (current.role === "cashier" && current.branchId !== branch.id)) return null;
    const [row] = await tx.insert(requests).values({
      amount, currency: b.data.currency, branchId: branch.id, cashierId: user.id,
      reference: randomBytes(24).toString("hex"), note: b.data.note?.trim() ?? "", status: "PENDING",
    }).returning();
    await tx.insert(audits).values({ actorId: user.id, action: "request_create", entityId: row!.id });
    return row;
  });
  if (!result) { fail(res, 409, "Aktif kullanıcı ve aktif şube gereklidir. Sayfayı yenileyin."); return; }
  res.status(201).json(CreateKasaRequestResponse.parse(result));
});
router.get("/kasa/requests/:id", async (req, res): Promise<void> => {
  const user = await member(req, res); if (!user) return;
  const p = GetKasaRequestParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, "Talep numarası geçersiz."); return; }
  const [row] = await db.select().from(requests).where(eq(requests.id, p.data.id)).limit(1);
  if (!row || !canReadKasaRequest(user, row.cashierId)) { fail(res, 404, "Talep bulunamadı."); return; }
  res.json(GetKasaRequestResponse.parse(row));
});
router.get("/kasa/public/:reference", async (req, res): Promise<void> => {
  const p = GetKasaPublicRequestParams.safeParse(req.params);
  if (!p.success || !/^[a-f0-9]{48}$/.test(p.data.reference)) { fail(res, 404, "Talep bulunamadı."); return; }
  const [row] = await db.select({ amount: requests.amount, currency: requests.currency, status: requests.status }).from(requests).where(eq(requests.reference, p.data.reference)).limit(1);
  if (!row) { fail(res, 404, "Talep bulunamadı."); return; }
  res.json(GetKasaPublicRequestResponse.parse({ ...row, liveEnabled: false }));
});
router.get("/kasa/summary", async (req, res): Promise<void> => {
  if (!await member(req, res, true)) return;
  const q = GetKasaSummaryQueryParams.strict().safeParse(req.query);
  if (!q.success || !validKasaDate(q.data.date)) { fail(res, 400, "Tarih veya şube filtresi geçersiz."); return; }
  const evidence = sql`${requests.status} = 'COMPLETED' and ${requests.verifiedAt} is not null and ${requests.providerReference} is not null and ${requests.completedAt} is not null`;
  const conditions: SQL[] = [];
  if (q.data.branchId) conditions.push(eq(requests.branchId, q.data.branchId));
  if (q.data.date) conditions.push(sql`(case when ${requests.status} = 'COMPLETED' then ${requests.completedAt} else ${requests.createdAt} end at time zone ${KASA_TIMEZONE})::date = ${q.data.date}::date`);
  const rows = await db.select({
    currency: requests.currency,
    revenue: sql<string>`coalesce(sum(${requests.amount}) filter (where ${evidence}), 0)::numeric(20,2)::text`,
    pendingAmount: sql<string>`coalesce(sum(${requests.amount}) filter (where ${requests.status} = 'PENDING'), 0)::numeric(20,2)::text`,
    pendingCount: sql<number>`count(*) filter (where ${requests.status} = 'PENDING')::int`,
    completedCount: sql<number>`count(*) filter (where ${evidence})::int`,
  }).from(requests).where(and(...conditions)).groupBy(requests.currency);
  const totals = KASA_CURRENCIES.map(currency => rows.find(r => r.currency === currency) ?? { currency, revenue: "0.00", pendingAmount: "0.00", pendingCount: 0, completedCount: 0 });
  res.json(GetKasaSummaryResponse.parse({ totals, timezone: KASA_TIMEZONE, fiscalReport: false, liveEnabled: false }));
});

// Do not expose SQL, validation internals or account-provider errors to browsers.
router.use("/kasa", (error: unknown, req: Request, res: Response, next: (error?: unknown) => void) => {
  if (res.headersSent) { next(error); return; }
  (req.log ?? logger).error({ errorType: error instanceof Error ? error.name : "unknown" }, "Kasa request failed");
  fail(res, 500, "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
});

export default router;