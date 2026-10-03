import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import { db, companyFundRecordsTable as funds, companyInstructionsTable as instructions, type CompanyFundRecord } from "@workspace/db";
import { CreateCompanyFundRecordBody, GetCompanyRecordStatusQueryParams } from "@workspace/api-zod";
import { requireMyCompany } from "../lib/companyAuth";
import { logger } from "../lib/logger";
import { serializeCompanyInstruction } from "./company-instructions";

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

function serialize(row: CompanyFundRecord) {
  return {
    id: row.id, kurum: row.institution, islem_turu: row.operationType,
    miktar: row.amount, para_birimi: row.currency, aciklama: row.description,
    zaman: row.createdAt.toISOString(), olusturan: row.authorName,
    imza: "WelatTR", ekosistem: "Çelik Kubbe", kayit_durumu: "firma_ici_kayit",
  };
}

router.post("/celik-kubbe/fon-islem", async (req, res) => {
  const access = await requireMyCompany(req, res, ["owner"]);
  if (!access) return;
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
    res.status(201).json({
      durum: "basarili", mesaj: "Fon/kredi firma içi kaydı saklandı. Para transferi, kredi tahsisi veya resmi onay yapılmadı.",
      veri: serialize(record),
    });
  } catch {
    logger.error("Firma içi fon kaydı veritabanına yazılamadı.");
    res.status(503).json({ error: "Kayıt sonucu doğrulanamadı. Listeyi kontrol edin; tekrar denemede aynı taslak ve istek anahtarını kullanın." });
  }
});

router.get("/celik-kubbe/durum", async (req, res) => {
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
    res.json({
      ekosistem: "Çelik Kubbe", temsilci: "WelatTR",
      toplam_fon_islem: fundCount[0]?.total ?? 0,
      toplam_talimat: instructionCount[0]?.total ?? 0,
      fon_havuzu: fundRows.map(serialize), talimatlar: instructionRows.map(serializeCompanyInstruction),
      canCreate: access.member.role === "owner", ...page,
    });
  } catch {
    logger.error("Firma içi kayıt durumu okunamadı.");
    res.status(503).json({ error: "Kayıtlar yüklenemedi. Tekrar deneyin." });
  }
});

export default router;