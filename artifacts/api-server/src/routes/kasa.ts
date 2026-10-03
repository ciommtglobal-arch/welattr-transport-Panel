import { randomBytes } from "node:crypto";
import { clerkClient, getAuth } from "@clerk/express";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { Router, type Request, type Response, type IRouter } from "express";
import {
  db,
  kasaBranchesTable as branches,
  kasaUsersTable as users,
  kasaRequestsTable as requests,
  kasaAuditTable as audits,
  paymentAuditEventsTable,
  paymentSessionsTable,
  serviceInvoicesTable,
  type KasaMember,
} from "@workspace/db";
import {
  GetKasaMeResponse, SetupKasaOwnerResponse, GetKasaBranchesResponse, CreateKasaBranchBody, CreateKasaBranchResponse,
  UpdateKasaBranchBody, UpdateKasaBranchParams, UpdateKasaBranchResponse,
  GetKasaUsersResponse, GrantKasaUserBody, GrantKasaUserResponse, UpdateKasaUserBody, UpdateKasaUserParams, UpdateKasaUserResponse,
  GetKasaRequestsQueryParams, GetKasaRequestsResponse, CreateKasaRequestBody, CreateKasaRequestResponse,
  GetKasaRequestParams, GetKasaRequestResponse, GetKasaPublicRequestParams, GetKasaPublicRequestResponse,
  CancelKasaRequestParams, CancelKasaRequestBody, CancelKasaRequestResponse,
  GetKasaSummaryQueryParams, ExportKasaSummaryQueryParams, GetKasaServiceInvoicesResponse,
  CreateKasaServiceInvoiceBody, CreateKasaServiceInvoiceResponse, CancelKasaServiceInvoiceParams,
  CancelKasaServiceInvoiceResponse,
} from "@workspace/api-zod";
import { canReadKasaRequest, kasaUserView, ownerIdentity, normalizeKasaAmount, validKasaDate, KASA_TIMEZONE } from "../lib/kasa";
import { kasaSummary } from "../lib/kasaSummary";
import { reportCsv, reportHtml, reportFilename } from "../lib/kasaReportExport";
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
    user: user ? kasaUserView(user) : null,
    canSetup: !owner && id === ownerIdentity(),
    canManageInvoices: Boolean(user?.active && user.owner),
    liveEnabled: false,
  }));
});

async function invoiceOwner(req: Request, res: Response): Promise<KasaMember | null> {
  const user = await member(req, res);
  if (!user) return null;
  if (!user.owner) {
    fail(res, 403, "Hizmet faturalarına yalnızca uygulama sahibi erişebilir.");
    return null;
  }
  return user;
}

router.get("/kasa/service-invoices", async (req, res): Promise<void> => {
  if (!await invoiceOwner(req, res)) return;
  const rows = await db.select().from(serviceInvoicesTable).orderBy(desc(serviceInvoicesTable.issuedAt));
  const sessions = rows.length
    ? await db
        .select({
          orderId: paymentSessionsTable.orderId,
          invoiceReference: paymentSessionsTable.invoiceReference,
          status: paymentSessionsTable.status,
          createdAt: paymentSessionsTable.createdAt,
        })
        .from(paymentSessionsTable)
        .where(inArray(paymentSessionsTable.invoiceReference, rows.map((row) => row.reference)))
        .orderBy(desc(paymentSessionsTable.createdAt))
    : [];
  const latestPaymentByInvoice = new Map<
    string,
    { orderId: string; status: "pending" | "success" | "failed" | "cancelled" }
  >();
  for (const session of sessions) {
    const reference = session.invoiceReference;
    if (!reference || latestPaymentByInvoice.has(reference)) continue;
    latestPaymentByInvoice.set(reference, session);
  }
  res.json(
    GetKasaServiceInvoicesResponse.parse(
      rows.map((invoice) => ({
        ...invoice,
        paymentReference: latestPaymentByInvoice.get(invoice.reference)?.orderId ?? null,
        paymentStatus: latestPaymentByInvoice.get(invoice.reference)?.status ?? null,
      })),
    ),
  );
});

router.post("/kasa/service-invoices", async (req, res): Promise<void> => {
  const user = await invoiceOwner(req, res);
  if (!user) return;
  const body = CreateKasaServiceInvoiceBody.strict().safeParse(req.body);
  const amountPattern = /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/;
  if (!body.success || !amountPattern.test(body.data.amount) || !body.data.description.trim()) {
    fail(res, 400, "Fatura tutarı, para birimi veya açıklaması geçersiz.");
    return;
  }
  const [whole, fraction = ""] = body.data.amount.split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents <= 0n) {
    fail(res, 400, "Fatura tutarı sıfırdan büyük olmalıdır.");
    return;
  }
  const amount = `${whole}.${fraction.padEnd(2, "0")}`;
  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(serviceInvoicesTable)
      .values({
        reference: `MMT-${randomBytes(16).toString("hex").toUpperCase()}`,
        amount,
        currency: body.data.currency,
        description: body.data.description.trim(),
        issuedByKasaUserId: user.id,
      })
      .returning();
    await tx.insert(paymentAuditEventsTable).values({
      eventKey: `invoice:issued:${invoice!.id}`,
      eventType: "invoice_issued",
      provider: "internal",
      invoiceReference: invoice!.reference,
      amount: invoice!.amount,
      currency: invoice!.currency,
      actorKasaUserId: user.id,
    });
    return invoice!;
  });
  res.status(201).json(
    CreateKasaServiceInvoiceResponse.parse({
      ...result,
      paymentReference: null,
      paymentStatus: null,
    }),
  );
});

router.post("/kasa/service-invoices/:id/cancel", async (req, res): Promise<void> => {
  const user = await invoiceOwner(req, res);
  if (!user) return;
  const params = CancelKasaServiceInvoiceParams.safeParse(req.params);
  if (!params.success) {
    fail(res, 400, "Fatura numarası geçersiz.");
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(serviceInvoicesTable)
      .where(eq(serviceInvoicesTable.id, params.data.id))
      .for("update")
      .limit(1);
    if (!invoice) return { kind: "missing" as const };
    if (invoice.status === "cancelled") return { kind: "cancelled" as const, invoice };
    if (invoice.status !== "issued") return { kind: "conflict" as const };
    const [pending] = await tx
      .select({ orderId: paymentSessionsTable.orderId })
      .from(paymentSessionsTable)
      .where(
        and(
          eq(paymentSessionsTable.invoiceReference, invoice.reference),
          eq(paymentSessionsTable.status, "pending"),
        ),
      )
      .limit(1);
    if (pending) return { kind: "conflict" as const };
    const [cancelled] = await tx
      .update(serviceInvoicesTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(serviceInvoicesTable.id, invoice.id))
      .returning();
    await tx.insert(paymentAuditEventsTable).values({
      eventKey: `invoice:cancelled:${invoice.id}`,
      eventType: "invoice_cancelled",
      provider: "internal",
      invoiceReference: invoice.reference,
      amount: invoice.amount,
      currency: invoice.currency,
      actorKasaUserId: user.id,
    });
    return { kind: "cancelled" as const, invoice: cancelled! };
  });
  if (result.kind === "missing") {
    fail(res, 404, "Fatura bulunamadı.");
    return;
  }
  if (result.kind === "conflict") {
    fail(res, 409, "Ödenmiş veya ödeme işlemi devam eden fatura iptal edilemez.");
    return;
  }
  const sessions = await db
    .select({ orderId: paymentSessionsTable.orderId, status: paymentSessionsTable.status })
    .from(paymentSessionsTable)
    .where(eq(paymentSessionsTable.invoiceReference, result.invoice.reference))
    .orderBy(desc(paymentSessionsTable.createdAt));
  const latestPayment = sessions[0] ?? null;
  res.json(
    CancelKasaServiceInvoiceResponse.parse({
      ...result.invoice,
      paymentReference: latestPayment?.orderId ?? null,
      paymentStatus: latestPayment?.status ?? null,
    }),
  );
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
router.post("/kasa/requests/:id/cancel", async (req, res): Promise<void> => {
  const user = await member(req, res); if (!user) return;
  const p = CancelKasaRequestParams.safeParse(req.params);
  const b = CancelKasaRequestBody.strict().safeParse(req.body);
  if (!p.success || !b.success) { fail(res, 400, "Talebi iptal etmek için açık onay gerekiyor."); return; }
  const result = await db.transaction(async tx => {
    // Recheck the current grant under lock; concurrent revocation cannot slip through.
    const [current] = await tx.select().from(users).where(eq(users.id, user.id)).for("share");
    if (!current?.active) return { kind: "forbidden" as const };
    const [row] = await tx.select().from(requests).where(eq(requests.id, p.data.id)).for("update");
    if (!row || !canReadKasaRequest(current, row.cashierId)) return { kind: "missing" as const };
    // Never use cancellation as a refund or to overwrite provider evidence.
    if (row.status !== "PENDING" || row.providerReference !== null || row.verifiedAt !== null || row.completedAt !== null) {
      return { kind: "conflict" as const };
    }
    const cancelledAt = new Date();
    const [cancelled] = await tx.update(requests).set({
      status: "CANCELLED", cancelledAt, cancelledBy: current.id,
    }).where(and(eq(requests.id, row.id), eq(requests.status, "PENDING"))).returning();
    if (!cancelled) return { kind: "conflict" as const };
    await tx.insert(audits).values({
      actorId: current.id, action: "request_cancel", entityId: row.id, createdAt: cancelledAt,
    });
    return { kind: "cancelled" as const, row: cancelled };
  });
  if (result.kind === "forbidden") { fail(res, 403, "Aktif kasa yetkiniz yok."); return; }
  if (result.kind === "missing") { fail(res, 404, "Talep bulunamadı."); return; }
  if (result.kind === "conflict") { fail(res, 409, "Yalnızca henüz tahsil edilmemiş bekleyen talepler iptal edilebilir. Sayfayı yenileyin."); return; }
  res.json(CancelKasaRequestResponse.parse(result.row));
});
router.get("/kasa/public/:reference", async (req, res): Promise<void> => {
  const p = GetKasaPublicRequestParams.safeParse(req.params);
  if (!p.success || !/^[a-f0-9]{48}$/.test(p.data.reference)) { fail(res, 404, "Talep bulunamadı."); return; }
  const [row] = await db.select({ amount: requests.amount, currency: requests.currency, status: requests.status }).from(requests).where(eq(requests.reference, p.data.reference)).limit(1);
  if (!row) { fail(res, 404, "Talep bulunamadı."); return; }
  res.json(GetKasaPublicRequestResponse.parse(
    row.status === "CANCELLED" ? { status: "CANCELLED", liveEnabled: false } : { ...row, liveEnabled: false },
  ));
});
router.get("/kasa/summary", async (req, res): Promise<void> => {
  if (!await member(req, res, true)) return;
  const q = GetKasaSummaryQueryParams.strict().safeParse(req.query);
  if (!q.success || !validKasaDate(q.data.date)) { fail(res, 400, "Tarih veya şube filtresi geçersiz."); return; }
  res.json(await kasaSummary(q.data));
});
router.get("/kasa/summary/export", async (req, res): Promise<void> => {
  if (!await member(req, res, true)) return;
  const q = ExportKasaSummaryQueryParams.strict().safeParse(req.query);
  if (!q.success || !validKasaDate(q.data.date)) { fail(res, 400, "Tarih, şube veya dosya biçimi geçersiz."); return; }
  const { branchId, date, format } = q.data;
  let branchName = "Tüm şubeler";
  if (branchId) {
    const [branch] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, branchId)).limit(1);
    if (!branch) { fail(res, 404, "Şube bulunamadı."); return; }
    branchName = branch.name;
  }
  const snapshot = { summary: await kasaSummary({ branchId, date }), branchId, branchName, date, generatedAt: new Date().toISOString() };
  res.setHeader("Content-Type", format === "csv" ? "text/csv; charset=utf-8" : "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${reportFilename(format, branchId, date, snapshot.generatedAt)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(format === "csv" ? reportCsv(snapshot) : reportHtml(snapshot));
});

// Do not expose SQL, validation internals or account-provider errors to browsers.
router.use("/kasa", (error: unknown, req: Request, res: Response, next: (error?: unknown) => void) => {
  if (res.headersSent) { next(error); return; }
  (req.log ?? logger).error({ errorType: error instanceof Error ? error.name : "unknown" }, "Kasa request failed");
  fail(res, 500, "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
});

export default router;