import { Router, type IRouter } from "express";
import {
  and,
  desc,
  eq,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  workflowApprovalsTable,
  workflowNotificationsTable,
  type WorkflowApproval,
  type WorkflowNotification,
} from "@workspace/db";
import {
  CreateB2BWorkflowApprovalBody,
  DecideB2BWorkflowApprovalBody,
  DecideB2BWorkflowApprovalParams,
  ReviewB2BWorkflowApprovalBody,
  ReviewB2BWorkflowApprovalParams,
  MarkWorkflowNotificationReadParams,
} from "@workspace/api-zod";
import { requireMyCompany } from "../lib/companyAuth";
import { requireUser } from "../lib/staffAuth";

const router: IRouter = Router();
const reviewWindowMinutes = 5;
const ownerWindowMinutes = 15;

const riskRules = [
  {
    category: "financial" as const,
    words: ["ödeme", "fiyat", "ücret", "bedel", "para", "finans", "tahsilat", "pos", "iade"],
    reason: "Finansal işlem, ödeme veya fiyat içeriyor.",
  },
  {
    category: "legal" as const,
    words: ["sözleşme", "hukuk", "hukuki", "belge", "taahhüt", "imza", "contract"],
    reason: "Hukuki belge, sözleşme veya imza içeriyor.",
  },
  {
    category: "external" as const,
    words: ["gönder", "gönderim", "yayın", "yayımla", "herkese açık", "müşteri", "e-posta", "telegram"],
    reason: "Dışarıya gönderim veya herkese açık yayın içeriyor.",
  },
  {
    category: "delete" as const,
    words: ["sil", "kaldır", "geri döndürülemez", "kalıcı değişiklik"],
    reason: "Silme veya geri döndürülemez değişiklik içeriyor.",
  },
  {
    category: "permission" as const,
    words: ["yetki", "rol", "erişim", "personel", "izin"],
    reason: "Yetki, rol veya erişim değişikliği içeriyor.",
  },
];

export function classifyWorkflowRisk(input: {
  title: string;
  summary?: string | null;
  riskCategory?: string | null;
  riskReason?: string | null;
}) {
  if (
    input.riskCategory &&
    input.riskCategory !== "none" &&
    riskRules.some((rule) => rule.category === input.riskCategory)
  ) {
    return {
      category: input.riskCategory as
        | "financial"
        | "legal"
        | "external"
        | "delete"
        | "permission",
      reason: input.riskReason?.trim() || "İşlem riskli işlem kapsamına alındı.",
    };
  }

  const haystack = `${input.title} ${input.summary ?? ""}`.toLocaleLowerCase(
    "tr-TR",
  );
  const matched = riskRules.find((rule) =>
    rule.words.some((word) => haystack.includes(word)),
  );
  return matched
    ? { category: matched.category, reason: matched.reason }
    : { category: "none" as const, reason: null };
}

function serializeApproval(approval: WorkflowApproval) {
  return {
    id: approval.id,
    businessProfileId: approval.businessProfileId,
    entityType: approval.entityType,
    entityId: approval.entityId,
    title: approval.title,
    summary: approval.summary,
    submittedByClerkUserId: approval.submittedByClerkUserId,
    ownerClerkUserId: approval.ownerClerkUserId,
    reviewerClerkUserId: approval.reviewerClerkUserId,
    riskCategory: approval.riskCategory,
    riskReason: approval.riskReason,
    status: approval.status,
    reviewerDecisionAt: approval.reviewerDecisionAt?.toISOString() ?? null,
    ownerDecisionAt: approval.ownerDecisionAt?.toISOString() ?? null,
    decisionDueAt: approval.decisionDueAt?.toISOString() ?? null,
    autoDecisionAt: approval.autoDecisionAt?.toISOString() ?? null,
    decisionNote: approval.decisionNote,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
  };
}

function serializeNotification(notification: WorkflowNotification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    approvalId: notification.approvalId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

async function notify(
  recipientClerkUserId: string | null | undefined,
  values: {
    type: "approval" | "risk" | "deadline" | "rating";
    title: string;
    body: string;
    approvalId?: number | null;
  },
) {
  if (!recipientClerkUserId) return;
  await db.insert(workflowNotificationsTable).values({
    recipientClerkUserId,
    type: values.type,
    title: values.title,
    body: values.body,
    approvalId: values.approvalId ?? null,
  });
}

export async function createWorkflowApproval(input: {
  businessProfileId: number;
  entityType:
    | "company_task"
    | "company_request"
    | "business_profile"
    | "limit_application"
    | "b2b_listing"
    | "b2b_request"
    | "b2b_report"
    | "media_item"
    | "media_delivery"
    | "logistics_offer";
  entityId: number;
  title: string;
  summary?: string;
  submittedByClerkUserId: string | null;
  ownerClerkUserId: string | null;
  riskCategory?: string | null;
  riskReason?: string | null;
}) {
  const risk = classifyWorkflowRisk(input);
  const now = new Date();
  const ownerSubmitted =
    Boolean(input.submittedByClerkUserId) &&
    input.submittedByClerkUserId === input.ownerClerkUserId;
  const isAutoApproved = ownerSubmitted && risk.category === "none";
  const [approval] = await db
    .insert(workflowApprovalsTable)
    .values({
      businessProfileId: input.businessProfileId,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title.trim(),
      summary: input.summary?.trim() ?? "",
      submittedByClerkUserId: input.submittedByClerkUserId,
      ownerClerkUserId: input.ownerClerkUserId,
      riskCategory: risk.category,
      riskReason: risk.reason,
      status: isAutoApproved ? "auto_approved" : "pending_reviewer",
      decisionDueAt: new Date(
        now.getTime() +
          (risk.category === "none"
            ? reviewWindowMinutes
            : ownerWindowMinutes) *
            60_000,
      ),
      autoDecisionAt: isAutoApproved
        ? now
        : risk.category === "none"
          ? new Date(now.getTime() + reviewWindowMinutes * 60_000)
          : null,
    })
    .returning();

  if (!isAutoApproved) {
    await notify(input.ownerClerkUserId, {
      type: risk.category === "none" ? "approval" : "risk",
      title: "Yeni onay işi bekliyor",
      body:
        risk.category === "none"
          ? `${input.title} için Abdurrahman incelemesi bekleniyor.`
          : `${input.title} manuel sahip onayı bekliyor: ${risk.reason}`,
      approvalId: approval.id,
    });
  }
  return approval;
}

export async function isWorkflowEntityApproved(input: {
  businessProfileId: number;
  entityType: "company_task" | "company_request";
  entityId: number;
}) {
  const [approval] = await db
    .select({ status: workflowApprovalsTable.status })
    .from(workflowApprovalsTable)
    .where(
      and(
        eq(workflowApprovalsTable.businessProfileId, input.businessProfileId),
        eq(workflowApprovalsTable.entityType, input.entityType),
        eq(workflowApprovalsTable.entityId, input.entityId),
      ),
    )
    .orderBy(desc(workflowApprovalsTable.createdAt))
    .limit(1);

  return (
    !approval ||
    approval.status === "auto_approved" ||
    approval.status === "approved"
  );
}

async function expireOverdueApprovals(businessProfileId: number) {
  const now = new Date();
  await db
    .update(workflowApprovalsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(workflowApprovalsTable.businessProfileId, businessProfileId),
        lt(workflowApprovalsTable.decisionDueAt, now),
        or(
          eq(workflowApprovalsTable.status, "pending_reviewer"),
          eq(workflowApprovalsTable.status, "pending_owner"),
        ),
      ),
    );
}

router.get(
  "/b2b/business-profile/approvals",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;
    await expireOverdueApprovals(authorization.profile.id);
    const items = await db
      .select()
      .from(workflowApprovalsTable)
      .where(eq(workflowApprovalsTable.businessProfileId, authorization.profile.id))
      .orderBy(desc(workflowApprovalsTable.createdAt));
    res.json({
      items: items.map(serializeApproval),
      total: items.length,
    });
  },
);

router.post(
  "/b2b/business-profile/approvals",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;
    const parsed = CreateB2BWorkflowApprovalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Onay kaydı bilgileri geçersiz." });
      return;
    }
    const approval = await createWorkflowApproval({
      ...parsed.data,
      businessProfileId: authorization.profile.id,
      submittedByClerkUserId: authorization.userId,
      ownerClerkUserId: authorization.profile.ownerClerkUserId,
    });
    res.status(201).json(serializeApproval(approval));
  },
);

router.patch(
  "/b2b/business-profile/approvals/:id/review",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res, [
      "owner",
      "admin",
      "manager",
    ]);
    if (!authorization) return;
    const params = ReviewB2BWorkflowApprovalParams.safeParse(req.params);
    const parsed = ReviewB2BWorkflowApprovalBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Onay incelemesi geçersiz." });
      return;
    }
    const [existing] = await db
      .select()
      .from(workflowApprovalsTable)
      .where(
        and(
          eq(workflowApprovalsTable.id, params.data.id),
          eq(
            workflowApprovalsTable.businessProfileId,
            authorization.profile.id,
          ),
          eq(workflowApprovalsTable.status, "pending_reviewer"),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Bekleyen onay işi bulunamadı." });
      return;
    }
    const isRejected = parsed.data.decision === "reject";
    const nextStatus = isRejected
      ? "rejected"
      : existing.riskCategory === "none"
        ? "auto_approved"
        : "pending_owner";
    const now = new Date();
    const [updated] = await db
      .update(workflowApprovalsTable)
      .set({
        status: nextStatus,
        reviewerClerkUserId: authorization.userId,
        reviewerDecisionAt: now,
        decisionNote: parsed.data.note?.trim() || null,
        decisionDueAt:
          nextStatus === "pending_owner"
            ? new Date(now.getTime() + ownerWindowMinutes * 60_000)
            : existing.decisionDueAt,
        autoDecisionAt:
          nextStatus === "auto_approved"
            ? now
            : null,
        updatedAt: now,
      })
      .where(eq(workflowApprovalsTable.id, existing.id))
      .returning();
    if (nextStatus === "pending_owner" || nextStatus === "rejected") {
      await notify(existing.ownerClerkUserId, {
        type: nextStatus === "rejected" ? "approval" : "risk",
        title:
          nextStatus === "rejected"
            ? "Onay işi reddedildi"
            : "Manuel sahip onayı gerekiyor",
        body:
          nextStatus === "rejected"
            ? `${existing.title} inceleme aşamasında reddedildi.`
            : `${existing.title} için ${existing.riskReason ?? "riskli işlem"} nedeniyle sizin kararınız gerekiyor.`,
        approvalId: existing.id,
      });
    }
    res.json(serializeApproval(updated));
  },
);

router.patch(
  "/b2b/business-profile/approvals/:id/owner-decision",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res, ["owner", "admin"]);
    if (!authorization) return;
    const params = DecideB2BWorkflowApprovalParams.safeParse(req.params);
    const parsed = DecideB2BWorkflowApprovalBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Sahip kararı geçersiz." });
      return;
    }
    const [existing] = await db
      .select()
      .from(workflowApprovalsTable)
      .where(
        and(
          eq(workflowApprovalsTable.id, params.data.id),
          eq(
            workflowApprovalsTable.businessProfileId,
            authorization.profile.id,
          ),
          eq(workflowApprovalsTable.status, "pending_owner"),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Sahip kararı bekleyen iş bulunamadı." });
      return;
    }
    const now = new Date();
    const [updated] = await db
      .update(workflowApprovalsTable)
      .set({
        status: parsed.data.decision === "approve" ? "approved" : "rejected",
        ownerDecisionByClerkUserId: authorization.userId,
        ownerDecisionAt: now,
        decisionNote: parsed.data.note?.trim() || null,
        updatedAt: now,
      })
      .where(eq(workflowApprovalsTable.id, existing.id))
      .returning();
    if (existing.submittedByClerkUserId) {
      await notify(existing.submittedByClerkUserId, {
        type: "approval",
        title:
          updated.status === "approved"
            ? "Onay işi onaylandı"
            : "Onay işi reddedildi",
        body: `${existing.title} için sahip kararı: ${updated.status === "approved" ? "onaylandı" : "reddedildi"}.`,
        approvalId: existing.id,
      });
    }
    res.json(serializeApproval(updated));
  },
);

router.get("/workflow/notifications", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const items = await db
    .select()
    .from(workflowNotificationsTable)
    .where(eq(workflowNotificationsTable.recipientClerkUserId, userId))
    .orderBy(desc(workflowNotificationsTable.createdAt))
    .limit(50);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowNotificationsTable)
    .where(
      and(
        eq(workflowNotificationsTable.recipientClerkUserId, userId),
        isNull(workflowNotificationsTable.readAt),
      ),
    );
  res.json({
    items: items.map(serializeNotification),
    total: items.length,
    unreadCount: count ?? 0,
  });
});

router.patch(
  "/workflow/notifications/:id/read",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const params = MarkWorkflowNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Bildirim kimliği geçersiz." });
      return;
    }
    const [updated] = await db
      .update(workflowNotificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(workflowNotificationsTable.id, params.data.id),
          eq(workflowNotificationsTable.recipientClerkUserId, userId),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Bildirim bulunamadı." });
      return;
    }
    res.json(serializeNotification(updated));
  },
);

export default router;