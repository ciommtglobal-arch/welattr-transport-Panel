import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  AcceptB2BCompanyInvitationBody,
  CreateB2BCompanyRequestBody,
  CreateB2BCompanyTaskBody,
  InviteB2BCompanyMemberBody,
  UpdateB2BCompanyRequestBody,
  UpdateB2BCompanyRequestParams,
  UpdateB2BCompanyTaskParams,
  UpdateB2BCompanyTaskBody,
} from "@workspace/api-zod";
import {
  and,
  desc,
  eq,
  gt,
} from "drizzle-orm";
import {
  b2bCompanyMembersTable,
  b2bCompanyRequestsTable,
  b2bCompanyTasksTable,
  db,
  type B2BCompanyMember,
  type B2BCompanyRequest,
  type B2BCompanyTask,
} from "@workspace/db";
import { requireMyCompany } from "../lib/companyAuth";
import { requireUser } from "../lib/staffAuth";
import { createWorkflowApproval, isWorkflowEntityApproved } from "./workflow";

const router: IRouter = Router();
const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function serializeMember(member: B2BCompanyMember) {
  return {
    id: member.id,
    businessProfileId: member.businessProfileId,
    clerkUserId: member.clerkUserId,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    department: member.department,
    jobTitle: member.jobTitle,
    areas: member.areas,
    role: member.role,
    status: member.status,
    invitedAt: member.invitedAt.toISOString(),
    acceptedAt: member.acceptedAt?.toISOString() ?? null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

function serializeTask(task: B2BCompanyTask) {
  return {
    id: task.id,
    businessProfileId: task.businessProfileId,
    title: task.title,
    description: task.description,
    area: task.area,
    dueDate: task.dueDate,
    status: task.status,
    assigneeMemberId: task.assigneeMemberId,
    createdByClerkUserId: task.createdByClerkUserId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function serializeRequest(request: B2BCompanyRequest, requesterName: string) {
  return {
    id: request.id,
    businessProfileId: request.businessProfileId,
    requesterMemberId: request.requesterMemberId,
    requesterName,
    title: request.title,
    description: request.description,
    area: request.area,
    priority: request.priority,
    status: request.status,
    managerNote: request.managerNote,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

async function getActiveAssignee(
  businessProfileId: number,
  memberId: number | null | undefined,
) {
  if (memberId == null) return null;

  const [member] = await db
    .select()
    .from(b2bCompanyMembersTable)
    .where(
      and(
        eq(b2bCompanyMembersTable.id, memberId),
        eq(b2bCompanyMembersTable.businessProfileId, businessProfileId),
        eq(b2bCompanyMembersTable.status, "active"),
      ),
    )
    .limit(1);
  return member ?? null;
}

router.get(
  "/b2b/business-profile/members",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const members = await db
      .select()
      .from(b2bCompanyMembersTable)
      .where(
        eq(
          b2bCompanyMembersTable.businessProfileId,
          authorization.profile.id,
        ),
      )
      .orderBy(desc(b2bCompanyMembersTable.createdAt));

    res.json({
      items: members.map(serializeMember),
      total: members.length,
    });
  },
);

router.post(
  "/b2b/business-profile/members",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res, [
      "owner",
      "admin",
      "manager",
    ]);
    if (!authorization) return;

    const parsed = InviteB2BCompanyMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Personel bilgileri geçersiz.",
      });
      return;
    }

    const input = parsed.data;
    if (
      authorization.member.role !== "owner" &&
      (input.role === "owner" || input.role === "admin")
    ) {
      res.status(403).json({
        error:
          "Alan yöneticisi yalnızca personel veya alan yöneticisi davet edebilir.",
      });
      return;
    }
    const email = input.email.trim().toLowerCase();
    const [existing] = await db
      .select({ id: b2bCompanyMembersTable.id })
      .from(b2bCompanyMembersTable)
      .where(
        and(
          eq(
            b2bCompanyMembersTable.businessProfileId,
            authorization.profile.id,
          ),
          eq(b2bCompanyMembersTable.email, email),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({
        error: "Bu e-posta ile firma personeli zaten kayıtlı.",
      });
      return;
    }

    const token = randomBytes(32).toString("hex");
    const [member] = await db
      .insert(b2bCompanyMembersTable)
      .values({
        businessProfileId: authorization.profile.id,
        fullName: input.fullName.trim(),
        email,
        phone: input.phone?.trim() || null,
        department: input.department?.trim() || null,
        jobTitle: input.jobTitle?.trim() || null,
        areas: input.areas.map((area) => area.trim()),
        role: input.role === "owner" ? "member" : input.role ?? "member",
        status: "invited",
        inviteTokenHash: hashInviteToken(token),
        inviteExpiresAt: new Date(Date.now() + inviteLifetimeMs),
      })
      .returning();

    req.log.info(
      {
        businessProfileId: authorization.profile.id,
        memberId: member.id,
        actorClerkUserId: authorization.userId,
      },
      "B2B company personnel invitation created",
    );

    res.status(201).json({
      member: serializeMember(member),
      inviteUrl: `/b2b-agi/panel?invite=${token}`,
    });
  },
);

router.post(
  "/b2b/business-profile/members/invitations/accept",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;

    const parsed = AcceptB2BCompanyInvitationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Davet bağlantısı geçersiz." });
      return;
    }

    const [member] = await db
      .select()
      .from(b2bCompanyMembersTable)
      .where(eq(b2bCompanyMembersTable.inviteTokenHash, hashInviteToken(parsed.data.token)))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "Davet bulunamadı veya daha önce kullanıldı." });
      return;
    }
    if (member.status !== "invited" || member.clerkUserId) {
      res.status(400).json({ error: "Bu davet artık kullanılamaz." });
      return;
    }
    if (!member.inviteExpiresAt || member.inviteExpiresAt <= new Date()) {
      res.status(400).json({ error: "Bu davetin süresi dolmuş." });
      return;
    }

    const [alreadyMember] = await db
      .select({ id: b2bCompanyMembersTable.id })
      .from(b2bCompanyMembersTable)
      .where(
        and(
          eq(b2bCompanyMembersTable.businessProfileId, member.businessProfileId),
          eq(b2bCompanyMembersTable.clerkUserId, userId),
          eq(b2bCompanyMembersTable.status, "active"),
        ),
      )
      .limit(1);

    if (alreadyMember) {
      res.status(409).json({ error: "Bu hesap zaten firma personeli." });
      return;
    }

    const [accepted] = await db
      .update(b2bCompanyMembersTable)
      .set({
        clerkUserId: userId,
        status: "active",
        acceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      })
      .where(
        and(
          eq(b2bCompanyMembersTable.id, member.id),
          eq(b2bCompanyMembersTable.status, "invited"),
        ),
      )
      .returning();

    res.json(serializeMember(accepted));
  },
);

router.get(
  "/b2b/business-profile/requests",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const [requests, members] = await Promise.all([
      db
        .select()
        .from(b2bCompanyRequestsTable)
        .where(eq(b2bCompanyRequestsTable.businessProfileId, authorization.profile.id))
        .orderBy(desc(b2bCompanyRequestsTable.createdAt)),
      db
        .select({
          id: b2bCompanyMembersTable.id,
          fullName: b2bCompanyMembersTable.fullName,
        })
        .from(b2bCompanyMembersTable)
        .where(eq(b2bCompanyMembersTable.businessProfileId, authorization.profile.id)),
    ]);

    const memberNames = new Map(members.map((member) => [member.id, member.fullName]));
    const canSeeAll =
      authorization.member.role === "owner" ||
      authorization.member.role === "admin" ||
      authorization.member.role === "manager";
    const visibleRequests = canSeeAll
      ? requests
      : requests.filter(
          (request) => request.requesterMemberId === authorization.member.id,
        );

    res.json({
      items: visibleRequests.map((request) =>
        serializeRequest(
          request,
          memberNames.get(request.requesterMemberId) ?? "Firma personeli",
        ),
      ),
      total: visibleRequests.length,
    });
  },
);

router.post(
  "/b2b/business-profile/requests",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const parsed = CreateB2BCompanyRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Talep bilgileri geçersiz.",
      });
      return;
    }

    const input = parsed.data;
    const [request] = await db
      .insert(b2bCompanyRequestsTable)
      .values({
        businessProfileId: authorization.profile.id,
        requesterMemberId: authorization.member.id,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        area: input.area.trim(),
        priority: input.priority ?? "normal",
      })
      .returning();

    await createWorkflowApproval({
      businessProfileId: authorization.profile.id,
      entityType: "company_request",
      entityId: request.id,
      title: request.title,
      summary: request.description,
      submittedByClerkUserId: authorization.userId,
      ownerClerkUserId: authorization.profile.ownerClerkUserId,
    });

    req.log.info(
      {
        businessProfileId: authorization.profile.id,
        requestId: request.id,
        requesterMemberId: authorization.member.id,
      },
      "B2B company internal request created",
    );

    res.status(201).json(serializeRequest(request, authorization.member.fullName));
  },
);

router.patch(
  "/b2b/business-profile/requests/:id",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res, [
      "owner",
      "admin",
      "manager",
    ]);
    if (!authorization) return;

    const params = UpdateB2BCompanyRequestParams.safeParse(req.params);
    const parsed = UpdateB2BCompanyRequestBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Talep güncellemesi geçersiz." });
      return;
    }

    const [request] = await db
      .select()
      .from(b2bCompanyRequestsTable)
      .where(
        and(
          eq(b2bCompanyRequestsTable.id, params.data.id),
          eq(
            b2bCompanyRequestsTable.businessProfileId,
            authorization.profile.id,
          ),
        ),
      )
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Talep bulunamadı." });
      return;
    }
    if (
      !(await isWorkflowEntityApproved({
        businessProfileId: authorization.profile.id,
        entityType: "company_request",
        entityId: request.id,
      }))
    ) {
      res.status(409).json({
        error: "Bu talep onay kararı verilmeden güncellenemez.",
      });
      return;
    }

    const input = parsed.data;
    const [updated] = await db
      .update(b2bCompanyRequestsTable)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.managerNote !== undefined
          ? { managerNote: input.managerNote.trim() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(b2bCompanyRequestsTable.id, request.id))
      .returning();

    const [requester] = await db
      .select({ fullName: b2bCompanyMembersTable.fullName })
      .from(b2bCompanyMembersTable)
      .where(eq(b2bCompanyMembersTable.id, updated.requesterMemberId))
      .limit(1);

    res.json(
      serializeRequest(updated, requester?.fullName ?? "Firma personeli"),
    );
  },
);

router.get(
  "/b2b/business-profile/tasks",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const tasks = await db
      .select()
      .from(b2bCompanyTasksTable)
      .where(
        eq(
          b2bCompanyTasksTable.businessProfileId,
          authorization.profile.id,
        ),
      )
      .orderBy(desc(b2bCompanyTasksTable.createdAt));

    const canSeeAll =
      authorization.member.role === "owner" ||
      authorization.member.role === "admin" ||
      authorization.member.role === "manager";
    const visibleTasks = canSeeAll
      ? tasks
      : tasks.filter(
          (task) =>
            task.assigneeMemberId === authorization.member.id ||
            authorization.member.areas.includes(task.area),
        );

    res.json({
      items: visibleTasks.map(serializeTask),
      total: visibleTasks.length,
    });
  },
);

router.post(
  "/b2b/business-profile/tasks",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res, [
      "owner",
      "admin",
      "manager",
    ]);
    if (!authorization) return;

    const parsed = CreateB2BCompanyTaskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Görev bilgileri geçersiz.",
      });
      return;
    }

    const input = parsed.data;
    if (input.assigneeMemberId != null) {
      const assignee = await getActiveAssignee(
        authorization.profile.id,
        input.assigneeMemberId,
      );
      if (!assignee) {
        res.status(400).json({
          error: "Sorumlu personel bu firmaya bağlı aktif bir kullanıcı değil.",
        });
        return;
      }
    }

    const [task] = await db
      .insert(b2bCompanyTasksTable)
      .values({
        businessProfileId: authorization.profile.id,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        area: input.area.trim(),
        dueDate:
          input.dueDate instanceof Date
            ? input.dueDate.toISOString().slice(0, 10)
            : input.dueDate ?? null,
        status: input.status ?? "pending",
        assigneeMemberId: input.assigneeMemberId ?? null,
        createdByClerkUserId: authorization.userId,
      })
      .returning();

    await createWorkflowApproval({
      businessProfileId: authorization.profile.id,
      entityType: "company_task",
      entityId: task.id,
      title: task.title,
      summary: `${task.area}: ${task.description}`,
      submittedByClerkUserId: authorization.userId,
      ownerClerkUserId: authorization.profile.ownerClerkUserId,
    });

    res.status(201).json(serializeTask(task));
  },
);

router.patch(
  "/b2b/business-profile/tasks/:id",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const params = UpdateB2BCompanyTaskParams.safeParse(req.params);
    const parsed = UpdateB2BCompanyTaskBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Görev güncellemesi geçersiz." });
      return;
    }

    const [task] = await db
      .select()
      .from(b2bCompanyTasksTable)
      .where(
        and(
          eq(b2bCompanyTasksTable.id, params.data.id),
          eq(
            b2bCompanyTasksTable.businessProfileId,
            authorization.profile.id,
          ),
        ),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Görev bulunamadı." });
      return;
    }
    if (
      !(await isWorkflowEntityApproved({
        businessProfileId: authorization.profile.id,
        entityType: "company_task",
        entityId: task.id,
      }))
    ) {
      res.status(409).json({
        error: "Bu görev onay kararı verilmeden güncellenemez.",
      });
      return;
    }

    const input = parsed.data;
    const isManager =
      authorization.member.role === "owner" ||
      authorization.member.role === "admin" ||
      authorization.member.role === "manager";
    if (!isManager) {
      if (
        task.assigneeMemberId !== authorization.member.id ||
        Object.keys(input).some((key) => key !== "status")
      ) {
        res.status(403).json({
          error: "Personel yalnızca kendisine atanmış görevin durumunu değiştirebilir.",
        });
        return;
      }
    }

    if (isManager && input.assigneeMemberId !== undefined) {
      const assignee = await getActiveAssignee(
        authorization.profile.id,
        input.assigneeMemberId,
      );
      if (input.assigneeMemberId !== null && !assignee) {
        res.status(400).json({
          error: "Sorumlu personel bu firmaya bağlı aktif bir kullanıcı değil.",
        });
        return;
      }
    }

    const [updated] = await db
      .update(b2bCompanyTasksTable)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() }
          : {}),
        ...(input.area !== undefined ? { area: input.area.trim() } : {}),
        ...(input.dueDate !== undefined
          ? {
              dueDate:
                input.dueDate instanceof Date
                  ? input.dueDate.toISOString().slice(0, 10)
                  : input.dueDate,
            }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.assigneeMemberId !== undefined
          ? { assigneeMemberId: input.assigneeMemberId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(b2bCompanyTasksTable.id, task.id))
      .returning();

    res.json(serializeTask(updated));
  },
);

export default router;