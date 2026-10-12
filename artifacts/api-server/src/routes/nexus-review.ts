import { Router, type Request, type Response } from "express";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, nexusShopifyIntakesTable as intakes } from "@workspace/db";
import {
  GetNexusIntakesResponse, GetPublicNexusPublicationsResponse,
  ReviewNexusIntakeParams, ReviewNexusIntakeBody, ReviewNexusIntakeResponse,
  SetNexusPublicationParams, SetNexusPublicationBody, SetNexusPublicationResponse,
} from "@workspace/api-zod";
import { requireUser } from "../lib/staffAuth";
import { isLogisticsFounder } from "../lib/logisticsListingAuth";
import { nexusMapping } from "../lib/nexusShopify";
import {
  applyNexusDecision, applyNexusPublication, isPublishedNexus, nexusSnapshotToken,
  serializeNexus, NexusReviewError,
} from "../lib/nexusReview";

const router = Router();

function founderContext(req: Request, res: Response) {
  const actor = requireUser(req, res);
  if (!actor) return null;
  if (!isLogisticsFounder(actor)) {
    res.status(403).json({ error: "Bu karar ve denetim masası yalnız kurucuya açıktır." }); return null;
  }
  const mapping = nexusMapping(true);
  if (!mapping) {
    res.status(503).json({ error: "Nexus mağaza eşleştirmesi henüz yapılandırılmadı." }); return null;
  }
  res.setHeader("Cache-Control", "no-store");
  return { actor, shopDomain: mapping.shopDomain };
}

router.get("/nexus/intakes", async (req, res): Promise<void> => {
  const context = founderContext(req, res);
  if (!context) return;
  try {
    const rows = await db.select().from(intakes).where(eq(intakes.shopDomain, context.shopDomain))
      .orderBy(desc(intakes.createdAt)).limit(100);
    res.json(GetNexusIntakesResponse.parse(rows.map(serializeNexus)));
  } catch {
    res.status(503).json({ error: "Nexus denetim şeması veya kayıtları henüz hazır değil." });
  }
});

// Do not reuse a cached private response or serialize an intake into a public
// DTO: the public allowlist contains no free-form source/customer text.
router.get("/logistics/nexus/publications", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const mapping = nexusMapping(true);
  if (!mapping) {
    res.status(503).json({ error: "Nexus yayın kaynağı henüz yapılandırılmadı." }); return;
  }
  try {
    const rows = await db.select().from(intakes).where(and(
      eq(intakes.shopDomain, mapping.shopDomain), eq(intakes.status, "FOUNDER_APPROVED"),
      isNotNull(intakes.publishedAt),
    )).orderBy(desc(intakes.publishedAt)).limit(100);
    res.json(GetPublicNexusPublicationsResponse.parse(rows.filter(isPublishedNexus).map(row => ({
      id: row.id, kind: row.kind, corridor: row.corridor, publishedAt: row.publishedAt!.toISOString(),
    }))));
  } catch {
    res.status(503).json({ error: "Yayınlanan Nexus kayıtları henüz alınamıyor." });
  }
});

for (const operation of ["decision", "publication"] as const) {
  router.post(`/nexus/intakes/:id/${operation}`, async (req, res): Promise<void> => {
    const context = founderContext(req, res);
    if (!context) return;
    // Browser form submissions must not be accepted as authenticated decisions.
    if (!req.is("application/json")) {
      res.status(415).json({ error: "JSON gövdesi gerekiyor." }); return;
    }
    const params = (operation === "decision" ? ReviewNexusIntakeParams : SetNexusPublicationParams).safeParse(req.params);
    const body = (operation === "decision" ? ReviewNexusIntakeBody : SetNexusPublicationBody).safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Geçersiz kayıt, karar veya incelenen sürüm." }); return;
    }
    try {
      const schema = operation === "decision" ? ReviewNexusIntakeResponse : SetNexusPublicationResponse;
      const updated = await db.transaction(async tx => {
        const scope = and(eq(intakes.id, params.data.id), eq(intakes.shopDomain, context.shopDomain));
        const [row] = await tx.select().from(intakes).where(scope).limit(1).for("update");
        if (!row) throw new NexusReviewError(404, "Bu mağazada kayıt bulunamadı.");
        if (body.data.snapshotToken !== nexusSnapshotToken(row)) {
          throw new NexusReviewError(409, "Kayıt veya karar değişti. Güncel kaydı yeniden inceleyin.");
        }
        const action = body.data.action;
        const changes = action === "approve" || action === "reject"
          ? applyNexusDecision(row, action, context.actor)
          : applyNexusPublication(row, action, context.actor);
        const [saved] = await tx.update(intakes).set(changes).where(scope).returning();
        return schema.parse(serializeNexus(saved));
      });
      res.json(updated);
    } catch (error) {
      if (error instanceof NexusReviewError) {
        res.status(error.status).json({ error: error.message }); return;
      }
      req.log?.warn("Nexus founder decision could not be persisted.");
      res.status(503).json({ error: "Karar kaydedilemedi. Şema ve bağlantı hazır olmalıdır." });
    }
  });
}
export default router;
