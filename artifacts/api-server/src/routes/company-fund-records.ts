import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { db, companyFundRecordsTable as funds, companyFundAmendmentsTable as amendments, companyInstructionsTable as instructions, type CompanyFundRecord, type CompanyFundAmendment } from "@workspace/db";
import { CreateCompanyFundRecordBody, GetCompanyRecordStatusQueryParams, CreateCompanyFundAmendmentBody, CreateCompanyFundAmendmentParams, CreateCompanyFundAmendmentResponse, GetCompanyRecordStatusResponse, CreateCompanyFundRecordResponse } from "@workspace/api-zod";
import { requireMyCompany } from "../lib/companyAuth";
import { logger } from "../lib/logger";
import { serializeCompanyInstruction } from "./company-instructions";
import { FundAmendmentSchemaPending, requireFundAmendmentRelationships } from "../lib/fundAmendmentReadiness";

const router: IRouter = Router();
router.use(["/celik-kubbe/fon-islem", "/celik-kubbe/durum"], (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

// Never round/coerce a binary float. Amounts cross both boundaries as strings.
export function normalizeFundAmount(value: string): string | null {
  if (!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const decimals = fraction.padEnd(2, "0");
  const cents = BigInt(whole) * 100n + BigInt(decimals);
  if (cents <= 0n || cents > 99999999999999n) return null;
  return `${whole}.${decimals}`;
}

const inputSchema = CreateCompanyFundRecordBody.strict().transform((data) => ({
  ...data,
  kurum: data.kurum.trim(),
  islem_turu: data.islem_turu.trim(),
  aciklama: data.aciklama.trim(),
  istek_anahtari: data.istek_anahtari.toLowerCase(),
})).refine((data) => data.kurum.length >= 2 && data.islem_turu.length >= 2);

export function serializeAmendment(row: CompanyFundAmendment) {
  return {
    id: row.id, onceki_kayit_id: row.originalRecordId, yeni_kayit_id: row.replacementRecordId,
    tur: row.kind, gerekce: row.reason, zaman: row.createdAt.toISOString(), olusturan: row.authorName,
  };
}

function serialize(row: CompanyFundRecord, history: CompanyFundAmendment[] = []) {
  const edges = history.filter((edge) => edge.originalRecordId === row.id || edge.replacementRecordId === row.id);
  const outgoing = edges.find((edge) => edge.originalRecordId === row.id);
  return {
    id: row.id, kurum: row.institution, islem_turu: row.operationType,
    miktar: row.amount, para_birimi: row.currency, aciklama: row.description,
    zaman: row.createdAt.toISOString(), olusturan: row.authorName,
    imza: "WelatTR", ekosistem: "Çelik Kubbe", kayit_durumu: "firma_ici_kayit",
    guncel_durum: outgoing ? (outgoing.kind === "iptal" ? "iptal" : "yerine_gecmis") : "guncel",
    duzeltmeler: edges.map(serializeAmendment),
  };
}

router.post("/celik-kubbe/fon-islem", async (req, res): Promise<void> => {
  const access = await requireMyCompany(req, res, ["owner"]);
  if (!access) return;
  if (access.profile.ownerClerkUserId !== access.userId) {
    res.status(403).json({ error: "Yalnızca firmanın sahibi kayıt ekleyebilir." }); return;
  }
  const input = inputSchema.safeParse(req.body);
  const amount = input.success ? normalizeFundAmount(input.data.miktar) : null;
  if (!input.success || amount === null) {
    res.status(400).json({ error: "Gerçek kurum ve işlem türü, TRY/EUR/USD, pozitif tutar (en fazla 999999999999.99 ve iki ondalık) ve UUID istek anahtarı gereklidir. Tutar metin olmalıdır. Yetkili, imza, onay, firma ve zaman gibi ek alanlar kabul edilmez." });
    return;
  }
  const data = input.data;
  try {
    // Unique company/key index is the atomic cross-process/concurrent retry guard.
    const [created] = await db.insert(funds).values({
      businessProfileId: access.profile.id, authorMemberId: access.member.id,
      authorName: access.member.fullName, institution: data.kurum,
      operationType: data.islem_turu, amount, currency: data.para_birimi,
      description: data.aciklama, requestKey: data.istek_anahtari,
    }).onConflictDoNothing({ target: [funds.businessProfileId, funds.requestKey] }).returning();
    const record = created ?? (await db.select().from(funds).where(and(
      eq(funds.businessProfileId, access.profile.id), eq(funds.requestKey, data.istek_anahtari),
    )).limit(1))[0];
    if (!record) throw new Error("Record unavailable");
    if (record.authorMemberId !== access.member.id || record.amount !== amount ||
      record.currency !== data.para_birimi || record.institution !== data.kurum ||
      record.operationType !== data.islem_turu || record.description !== data.aciklama) {
      res.status(409).json({ error: "Bu istek anahtarı başka bir kayıt için kullanılmış. Yeni veya değiştirilmiş kayıt için yeni istek anahtarı kullanın." });
      return;
    }
    const history = await db.select().from(amendments).where(and(
      eq(amendments.businessProfileId, access.profile.id),
      or(eq(amendments.originalRecordId, record.id), eq(amendments.replacementRecordId, record.id)),
    ));
    res.status(201).json(CreateCompanyFundRecordResponse.parse({
      durum: "basarili", mesaj: "Fon/kredi firma içi kaydı saklandı. Para transferi, kredi tahsisi veya resmi onay yapılmadı.",
      veri: serialize(record, history),
    }));
  } catch {
    logger.error("Firma içi fon kaydı veritabanına yazılamadı.");
    res.status(503).json({ error: "Kayıt sonucu doğrulanamadı. Listeyi kontrol edin; tekrar denemede aynı taslak ve istek anahtarını kullanın." });
  }
});

const amendmentInput = CreateCompanyFundAmendmentBody.strict().superRefine((data, ctx) => {
  if (data.gerekce.trim().length < 5) ctx.addIssue({ code: "custom", message: "Gerekçe gereklidir." });
  if (data.tur === "duzeltme") {
    const replacement = data.yeni_kayit;
    if (!replacement || replacement.kurum.trim().length < 2 ||
      replacement.islem_turu.trim().length < 2 || normalizeFundAmount(replacement.miktar) === null) {
      ctx.addIssue({ code: "custom", message: "Yeni kayıt ve kesin ondalıklı pozitif tutar gereklidir." });
    }
  } else if (data.yeni_kayit !== undefined) {
    ctx.addIssue({ code: "custom", message: "İptalde yeni kayıt gönderilemez." });
  }
});

class AmendmentConflict extends Error {}
class FundNotFound extends Error {}

router.post("/celik-kubbe/fon-islem/:id/duzeltmeler", async (req, res): Promise<void> => {
  const access = await requireMyCompany(req, res, ["owner"]);
  if (!access) return;
  if (access.profile.ownerClerkUserId !== access.userId) {
    res.status(403).json({ error: "Yalnızca firmanın sahibi düzeltme veya iptal ekleyebilir." }); return;
  }
  const params = CreateCompanyFundAmendmentParams.strict().safeParse(req.params);
  const input = amendmentInput.safeParse(req.body);
  const replacementKeys = ["kurum", "islem_turu", "miktar", "para_birimi", "aciklama"];
  const rawReplacement = req.body?.yeni_kayit;
  if (!params.success || !input.success || Object.keys(req.query).length ||
    (rawReplacement && Object.keys(rawReplacement).some((key) => !replacementKeys.includes(key)))) {
    res.status(400).json({ error: "Geçerli kayıt kimliği, gerekçe ve UUID gereklidir. Düzeltmede yeni kurum, işlem türü, pozitif ondalıklı metin tutar ve TRY/EUR/USD zorunludur. Firma, yazar, zaman ve yetki alanları kabul edilmez." }); return;
  }
  const data = input.data;
  const replacement = data.yeni_kayit;
  const newValues = replacement ? {
    institution: replacement.kurum.trim(), operationType: replacement.islem_turu.trim(),
    amount: normalizeFundAmount(replacement.miktar)!, currency: replacement.para_birimi,
    description: replacement.aciklama.trim(),
  } : null;
  try {
    const result = await db.transaction(async (tx) => {
      await requireFundAmendmentRelationships(tx);
      // Lock the scoped original: competing corrections cannot branch history.
      const [original] = await tx.select().from(funds).where(and(
        eq(funds.businessProfileId, access.profile.id), eq(funds.id, params.data.id),
      )).limit(1).for("update");
      if (!original) throw new FundNotFound();
      const [replay] = await tx.select().from(amendments).where(and(
        eq(amendments.businessProfileId, access.profile.id),
        eq(amendments.requestKey, data.istek_anahtari.toLowerCase()),
      )).limit(1);
      if (replay) {
        let matches = replay.originalRecordId === original.id && replay.authorMemberId === access.member.id &&
          replay.kind === data.tur && replay.reason === data.gerekce.trim();
        if (newValues) {
          const [saved] = await tx.select().from(funds).where(and(
            eq(funds.businessProfileId, access.profile.id), eq(funds.id, replay.replacementRecordId!),
          )).limit(1);
          matches = matches && !!saved && Object.entries(newValues).every(([key, value]) => saved[key as keyof CompanyFundRecord] === value);
        }
        if (!matches) throw new AmendmentConflict();
        return replay;
      }
      const [existing] = await tx.select().from(amendments).where(and(
        eq(amendments.businessProfileId, access.profile.id), eq(amendments.originalRecordId, original.id),
      )).limit(1);
      if (existing) throw new AmendmentConflict();
      let replacementId: number | null = null;
      if (newValues) {
        const [created] = await tx.insert(funds).values({
          ...newValues, businessProfileId: access.profile.id,
          authorMemberId: access.member.id, authorName: access.member.fullName,
          requestKey: randomUUID(),
        }).returning();
        replacementId = created!.id;
      }
      const [edge] = await tx.insert(amendments).values({
        businessProfileId: access.profile.id, originalRecordId: original.id,
        replacementRecordId: replacementId, kind: data.tur, reason: data.gerekce.trim(),
        requestKey: data.istek_anahtari.toLowerCase(),
        authorMemberId: access.member.id, authorName: access.member.fullName,
      }).returning();
      return edge!;
    });
    res.status(201).json(CreateCompanyFundAmendmentResponse.parse(serializeAmendment(result)));
  } catch (error) {
    // Postgres unique violations also protect distinct-record, same-key races.
    const dbError = error as { code?: string; cause?: { code?: string } };
    if (error instanceof FundAmendmentSchemaPending) {
      res.status(503).json({
        code: "FUND_SCHEMA_PENDING",
        error: "Düzeltme/iptal güvenlik ilişkileri henüz tamamlanmadı. İkinci yayın doğrulanana kadar bu işlem kapalıdır; hiçbir kayıt değiştirilmedi.",
      });
    } else if (error instanceof FundNotFound) {
      res.status(404).json({ error: "Bu firmada kayıt bulunamadı." });
    } else if (error instanceof AmendmentConflict || dbError.code === "23505" || dbError.cause?.code === "23505") {
      res.status(409).json({ error: "Kayıt zaten düzeltilmiş/iptal edilmiş veya istek anahtarı başka içerikle kullanılmış. Güncel kaydı kontrol edin." });
    } else {
      logger.error("Firma içi fon düzeltmesi saklanamadı.");
      res.status(503).json({ error: "Sonuç doğrulanamadı. Listeyi kontrol edin; aynı taslak ve istek anahtarıyla tekrar deneyin." });
    }
  }
});

router.get("/celik-kubbe/durum", async (req, res): Promise<void> => {
  const access = await requireMyCompany(req, res, ["owner", "admin", "manager"]);
  if (!access) return;
  const query = GetCompanyRecordStatusQueryParams.strict().safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Geçersiz sayfalama bilgisi. Firma seçimi ve ek sorgu alanları kabul edilmez." });
    return;
  }
  const page = query.data;
  const fundScope = eq(funds.businessProfileId, access.profile.id);
  const instructionScope = eq(instructions.businessProfileId, access.profile.id);
  try {
    const [fundRows, instructionRows, fundCount, instructionCount] = await Promise.all([
      db.select().from(funds).where(fundScope)
        .orderBy(desc(funds.createdAt), desc(funds.id)).limit(page.fon_limit).offset(page.fon_offset),
      db.select().from(instructions).where(instructionScope)
        .orderBy(desc(instructions.createdAt), desc(instructions.id)).limit(page.talimat_limit).offset(page.talimat_offset),
      db.select({ total: count() }).from(funds).where(fundScope),
      db.select({ total: count() }).from(instructions).where(instructionScope),
    ]);
    const ids = fundRows.map((row) => row.id);
    const history = ids.length ? await db.select().from(amendments).where(and(
      eq(amendments.businessProfileId, access.profile.id),
      or(inArray(amendments.originalRecordId, ids), inArray(amendments.replacementRecordId, ids)),
    )) : [];
    res.json(GetCompanyRecordStatusResponse.parse({
      ekosistem: "Çelik Kubbe", temsilci: "WelatTR",
      toplam_fon_islem: fundCount[0]?.total ?? 0,
      toplam_talimat: instructionCount[0]?.total ?? 0,
      fon_havuzu: fundRows.map((row) => serialize(row, history)), talimatlar: instructionRows.map(serializeCompanyInstruction),
      canCreate: access.member.role === "owner" && access.profile.ownerClerkUserId === access.userId, ...page,
    }));
  } catch {
    logger.error("Firma içi kayıt durumu okunamadı.");
    res.status(503).json({ error: "Kayıtlar yüklenemedi. Tekrar deneyin." });
  }
});

export default router;