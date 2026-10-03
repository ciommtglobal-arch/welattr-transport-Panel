import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import { db, companyInstructionsTable, type CompanyInstruction } from "@workspace/db";
import { CreateCompanyInstructionBody, GetCompanyInstructionsQueryParams } from "@workspace/api-zod";
import { requireMyCompany } from "../lib/companyAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(["/talimat-ekle", "/talimatlari-listele"], (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
const inputSchema = CreateCompanyInstructionBody.strict()
  .transform((data) => ({
    kurum_adi: data.kurum_adi.trim(),
    icerik: data.icerik.trim(),
    islem_turu: data.islem_turu.trim(),
  }))
  .refine((data) => data.kurum_adi.length >= 2 && data.icerik.length >= 5 && data.islem_turu.length >= 2);

function serialize(row: CompanyInstruction) {
  return {
    id: row.id,
    kurum: row.institution,
    icerik: row.content,
    islem_turu: row.operationType,
    imza: row.signatureLabel,
    ekosistem: row.ecosystemLabel,
    zaman: row.createdAt.toISOString(),
    olusturan: row.authorName,
  };
}

router.post("/talimat-ekle", async (req, res) => {
  const access = await requireMyCompany(req, res, ["owner"]);
  if (!access) return;
  const input = inputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Kurum adı (2–200), talimat (5–8000) ve işlem türünü (2–100 karakter) kontrol edin. Ek alanlar kabul edilmez." });
    return;
  }
  try {
    const [record] = await db.insert(companyInstructionsTable).values({
      businessProfileId: access.profile.id,
      institution: input.data.kurum_adi,
      content: input.data.icerik,
      operationType: input.data.islem_turu,
      authorMemberId: access.member.id,
      authorName: access.member.fullName,
    }).returning();
    if (!record) throw new Error("Insert returned no record");
    res.status(201).json({
      durum: "basarili",
      mesaj: "Talimat firma içi kayıt sistemine kaydedildi.",
      veri: serialize(record),
    });
  } catch {
    // Never log instruction text or database parameters.
    logger.error("Kurumsal talimat kaydı veritabanına yazılamadı.");
    res.status(503).json({ error: "Talimat kaydedilemedi. Tekrar denemeden önce kayıt listesini kontrol edin." });
  }
});

router.get("/talimatlari-listele", async (req, res) => {
  const access = await requireMyCompany(req, res, ["owner", "admin", "manager"]);
  if (!access) return;
  const query = GetCompanyInstructionsQueryParams.strict().safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Geçersiz sayfalama bilgisi." });
    return;
  }
  const { limit, offset } = query.data;
  // No caller-supplied company identifier is accepted.
  const scope = and(eq(companyInstructionsTable.businessProfileId, access.profile.id));
  try {
    const [records, totals] = await Promise.all([
      db.select().from(companyInstructionsTable).where(scope)
        .orderBy(desc(companyInstructionsTable.createdAt), desc(companyInstructionsTable.id))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(companyInstructionsTable).where(scope),
    ]);
    res.json({
      imza: "WelatTR",
      toplam_talimat: totals[0]?.total ?? 0,
      liste: records.map(serialize),
      canCreate: access.member.role === "owner",
      limit,
      offset,
    });
  } catch {
    logger.error("Kurumsal talimat listesi veritabanından okunamadı.");
    res.status(503).json({ error: "Talimatlar yüklenemedi. Yeniden deneyin." });
  }
});

export default router;