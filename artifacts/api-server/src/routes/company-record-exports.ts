import { Router, type IRouter } from "express";
import { and, asc, eq, gt, gte, lt, inArray } from "drizzle-orm";
import { db, companyFundRecordsTable as funds, companyFundAmendmentsTable as amendments, companyInstructionsTable as instructions } from "@workspace/db";
import { ExportCompanyRecordsParams, ExportCompanyRecordsQueryParams } from "@workspace/api-zod";
import { requireMyCompany } from "../lib/companyAuth";
import { boundedCsv, exportDateRange, ExportTooLarge, EXPORT_PAGE_SIZE, INTERNAL_RECORD_NOTICE } from "../lib/companyRecordCsv";

const router: IRouter = Router();
// Include failed auth and validation responses in the same privacy boundary.
router.use("/company-records", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
router.get("/company-records/:kind/export", async (req, res): Promise<void> => {
  const access = await requireMyCompany(req, res, ["owner", "admin", "manager"]);
  if (!access) return;
  const params = ExportCompanyRecordsParams.strict().safeParse(req.params);
  const query = ExportCompanyRecordsQueryParams.strict().safeParse(req.query);
  const range = query.success ? exportDateRange(query.data.start, query.data.end) : null;
  if (!params.success || !query.success || !range) {
    res.status(400).json({ error: "Başlangıç ve bitiş tarihlerini YYYY-AA-GG olarak seçin. İki gün dahil en fazla 92 gün; firma seçimi ve ek alanlar kabul edilmez." }); return;
  }
  try {
    const file = await db.transaction(async (tx) => {
      const companyId = access.profile.id;
      const common = ["Kayıt ID", "Kurum", "İşlem türü"];
      if (params.data.kind === "instructions") {
        return boundedCsv(
          [...common, "Talimat", "Oluşturan üye ID", "Oluşturan kişi", "Oluşturulma zamanı (UTC)", "Belge niteliği"],
          (after) => tx.select().from(instructions).where(and(
            eq(instructions.businessProfileId, companyId), gt(instructions.id, after),
            gte(instructions.createdAt, range.start), lt(instructions.createdAt, range.endExclusive),
          )).orderBy(asc(instructions.id)).limit(EXPORT_PAGE_SIZE),
          (r) => [r.id, r.institution, r.operationType, r.content, r.authorMemberId, r.authorName, r.createdAt.toISOString(), INTERNAL_RECORD_NOTICE],
        );
      }
      return boundedCsv(
        [...common, "Tutar (tam ondalık)", "Para birimi", "Açıklama", "Oluşturan üye ID", "Oluşturan kişi", "Oluşturulma zamanı (UTC)",
          "İç kayıt durumu", "Yeni kayıt ID", "Düzeltme/iptal gerekçesi", "Düzeltme/iptali oluşturan kişi", "Düzeltme/iptal zamanı (UTC)", "Belge niteliği"],
        async (after) => {
          const rows = await tx.select().from(funds).where(and(
            eq(funds.businessProfileId, companyId), gt(funds.id, after),
            gte(funds.createdAt, range.start), lt(funds.createdAt, range.endExclusive),
          )).orderBy(asc(funds.id)).limit(EXPORT_PAGE_SIZE);
          const edges = rows.length ? await tx.select().from(amendments).where(and(
            eq(amendments.businessProfileId, companyId), inArray(amendments.originalRecordId, rows.map((r) => r.id)),
          )) : [];
          return rows.map((r) => ({ ...r, edge: edges.find((e) => e.originalRecordId === r.id) }));
        },
        (r) => [r.id, r.institution, r.operationType, r.amount.replace(".", ","), r.currency, r.description,
          r.authorMemberId, r.authorName, r.createdAt.toISOString(),
          r.edge ? (r.edge.kind === "iptal" ? "iptal" : "yerine_gecmis") : "guncel",
          r.edge?.replacementRecordId, r.edge?.reason, r.edge?.authorName, r.edge?.createdAt.toISOString(), INTERNAL_RECORD_NOTICE],
      );
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="firma-ici-${params.data.kind}-${query.data.start}-${query.data.end}.csv"`);
    res.send(file);
  } catch (error) {
    if (error instanceof ExportTooLarge) {
      res.status(413).json({ error: "Aralık 10.000 kayıt veya 20 MiB sınırını aşıyor. Eksik dosya oluşturulmadı; tarih aralığını daraltın." }); return;
    }
    // Do not log error objects: DB errors may contain sensitive SQL parameters.
    req.log?.error("Şirket içi CSV dışa aktarımı tamamlanamadı.");
    res.status(503).json({ error: "CSV oluşturulamadı; eksik dosya gönderilmedi. Yeniden deneyin." });
  }
});
export default router;