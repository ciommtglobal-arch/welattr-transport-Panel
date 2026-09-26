import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import {
  AcceptB2BCompanyInvitationBody,
  AddB2BCompanyTaskReportResponse,
  CreateB2BCompanyRequestBody,
  CreateB2BCompanyTaskBody,
  AddB2BCompanyTaskReportBody,
  AddB2BCompanyTaskReportParams,
  GetB2BCompanyTaskReportsQueryParams,
  GetB2BCompanyTaskReportsResponse,
  GetStaffB2BCompanyTaskReportsQueryParams,
  GetStaffB2BCompanyTaskReportsResponse,
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
  b2bCompanyTaskReportsTable,
  b2bCompanyTasksTable,
  db,
  type B2BCompanyMember,
  type B2BCompanyRequest,
  type B2BCompanyTask,
  type B2BCompanyTaskReport,
} from "@workspace/db";
import { requireMyCompany } from "../lib/companyAuth";
import { canViewCompanyMember, canViewCompanyTask } from "../lib/companyDelegation";
import { requireUser } from "../lib/staffAuth";
import { createWorkflowApproval, isWorkflowEntityApproved } from "./workflow";

const router: IRouter = Router();
const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getAuthenticatedEmails(userId: string) {
  const user = await clerkClient.users.getUser(userId);
  return new Set(
    user.emailAddresses
      .filter((emailAddress) => emailAddress.verification?.status === "verified")
      .map((emailAddress) => normalizeEmail(emailAddress.emailAddress))
      .filter(Boolean),
  );
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
    isPilotAssistant: member.isPilotAssistant,
    leadMemberId: member.leadMemberId,
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

function serializeTaskReport(report: B2BCompanyTaskReport) {
  return {
    id: report.id,
    taskId: report.taskId,
    authorMemberId: report.authorMemberId,
    content: report.content,
    createdAt: report.createdAt.toISOString(),
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

    const visibleMembers = members.filter((member) =>
      canViewCompanyMember(authorization.member, member.id),
    );
    res.json({
      items: visibleMembers.map(serializeMember),
      total: visibleMembers.length,
    });
  },
);

router.post(
  "/b2b/business-profile/members",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res, [
      "owner",
      "admin",
    ]);
    if (!authorization) return;

    const parsed = InviteB2BCompanyMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          parsed.error.issues[0]?.message ?? "Uzman ekip bilgileri geçersiz.",
      });
      return;
    }

    const input = parsed.data;
    if (
      (input.isPilotAssistant && ((input.role && input.role !== "member") || !input.leadMemberId)) ||
      (!input.isPilotAssistant && input.leadMemberId != null)
    ) {
      res.status(400).json({ error: "Pilot asistan, uzman ekip üyesi rolüyle bir alan liderine bağlanmalıdır." });
      return;
    }
    if (
      authorization.member.role !== "owner" &&
      (input.role === "owner" || input.role === "admin")
    ) {
      res.status(403).json({
        error:
          "Alan lideri yalnızca uzman ekip üyesi veya alan lideri davet edebilir.",
      });
      return;
    }
    if (input.leadMemberId != null) {
      if (input.role && input.role !== "member") {
        res.status(400).json({ error: "Pilot asistan yalnız uzman ekip üyesi olabilir." });
        return;
      }
      const [lead] = await db.select().from(b2bCompanyMembersTable).where(
        and(
          eq(b2bCompanyMembersTable.id, input.leadMemberId),
          eq(b2bCompanyMembersTable.businessProfileId, authorization.profile.id),
          eq(b2bCompanyMembersTable.role, "manager"),
        ),
      ).limit(1);
      if (!lead || lead.status === "revoked") {
        res.status(400).json({ error: "Asistan yalnız bu firmadaki yetkili alan liderine bağlanabilir." });
        return;
      }
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
        error: "Bu e-posta ile uzman ekip üyesi zaten kayıtlı.",
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
        isPilotAssistant: input.isPilotAssistant ?? false,
        leadMemberId: input.leadMemberId ?? null,
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

    let authenticatedEmails: Set<string>;
    try {
      authenticatedEmails = await getAuthenticatedEmails(userId);
    } catch (error) {
      req.log.error(
        { err: error, clerkUserId: userId },
        "Clerk user email lookup failed while accepting B2B invitation",
      );
      res.status(503).json({
        error: "Hesabınızın e-posta doğrulaması şu anda kontrol edilemedi.",
      });
      return;
    }

    if (!authenticatedEmails.has(normalizeEmail(member.email))) {
      res.status(403).json({
        error:
          "Bu davet, giriş yaptığınız hesabın e-posta adresiyle eşleşmiyor.",
      });
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
      res.status(409).json({ error: "Bu hesap zaten uzman ekip üyesi." });
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
          memberNames.get(request.requesterMemberId) ?? "Uzman ekip üyesi",
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
      serializeRequest(updated, requester?.fullName ?? "Uzman ekip üyesi"),
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

    const visibleTasks = tasks.filter((task) =>
      canViewCompanyTask(authorization.member, task),
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
          error: "Sorumlu ekip üyesi bu firmaya bağlı aktif bir kullanıcı değil.",
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

router.post(
  "/b2b/business-profile/tasks/:id/reports",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const params = AddB2BCompanyTaskReportParams.safeParse(req.params);
    const parsed = AddB2BCompanyTaskReportBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: parsed.success
          ? "Görev kimliği geçersiz."
          : parsed.error.issues[0]?.message ?? "Görev raporu geçersiz.",
      });
      return;
    }
    const content = parsed.data.content.trim();
    if (!content) {
      res.status(400).json({ error: "Görev raporu metni boş olamaz." });
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
    if (!task || !canViewCompanyTask(authorization.member, task)) {
      res.status(404).json({ error: "Görev bulunamadı." });
      return;
    }
    if (
      authorization.member.status !== "active" ||
      !authorization.member.clerkUserId ||
      authorization.member.clerkUserId !== authorization.userId ||
      task.assigneeMemberId !== authorization.member.id
    ) {
      res.status(403).json({
        error: "Yalnızca aktif ve kendisine atanmış göreve rapor eklenebilir.",
      });
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
        error: "Bu göreve rapor eklemek için sahip onayı gerekiyor.",
      });
      return;
    }
    if (task.status === "completed") {
      res.status(409).json({ error: "Tamamlanan göreve yeni rapor eklenemez." });
      return;
    }

    const [report] = await db
      .insert(b2bCompanyTaskReportsTable)
      .values({
        taskId: task.id,
        authorMemberId: authorization.member.id,
        content,
      })
      .returning();
    res
      .status(201)
      .json(AddB2BCompanyTaskReportResponse.parse(serializeTaskReport(report)));
  },
);

router.get(
  "/b2b/business-profile/task-reports",
  async (req, res): Promise<void> => {
    const authorization = await requireMyCompany(req, res);
    if (!authorization) return;

    const parsed = GetB2BCompanyTaskReportsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Görev raporu araması geçersiz." });
      return;
    }
    const { taskId, page, pageSize } = parsed.data;
    const [task] = await db
      .select()
      .from(b2bCompanyTasksTable)
      .where(
        and(
          eq(b2bCompanyTasksTable.id, taskId),
          eq(
            b2bCompanyTasksTable.businessProfileId,
            authorization.profile.id,
          ),
        ),
      )
      .limit(1);
    if (!task || !canViewCompanyTask(authorization.member, task)) {
      res.status(404).json({ error: "Görev bulunamadı." });
      return;
    }
    const isCompanyManager =
      authorization.member.role === "owner" ||
      authorization.member.role === "admin" ||
      authorization.member.role === "manager";
    const isActiveAssignedMember =
      authorization.member.status === "active" &&
      Boolean(authorization.member.clerkUserId) &&
      authorization.member.clerkUserId === authorization.userId &&
      task.assigneeMemberId === authorization.member.id;
    if (!isCompanyManager && !isActiveAssignedMember) {
      res.status(403).json({
        error: "Firma görevi raporlarını görüntüleme yetkiniz bulunmuyor.",
      });
      return;
    }

    const reports = await db
      .select()
      .from(b2bCompanyTaskReportsTable)
      .where(eq(b2bCompanyTaskReportsTable.taskId, task.id))
      .orderBy(desc(b2bCompanyTaskReportsTable.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    const hasMore = reports.length > pageSize;
    res.json(
      GetB2BCompanyTaskReportsResponse.parse({
        items: reports.slice(0, pageSize).map(serializeTaskReport),
        page,
        pageSize,
        hasMore,
      }),
    );
  },
);

router.get(
  "/b2b/staff/company-task-reports",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const founderId = process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim();
    if (!founderId || userId !== founderId) {
      res.status(403).json({ error: "Kurucu personel erişimi gerekiyor." });
      return;
    }

    const parsed = GetStaffB2BCompanyTaskReportsQueryParams.safeParse(
      req.query,
    );
    if (!parsed.success) {
      res.status(400).json({ error: "Görev raporu araması geçersiz." });
      return;
    }
    const { page, pageSize } = parsed.data;
    const reports = await db
      .select({
        id: b2bCompanyTaskReportsTable.id,
        businessProfileId: b2bCompanyTasksTable.businessProfileId,
        taskId: b2bCompanyTasksTable.id,
        taskTitle: b2bCompanyTasksTable.title,
        taskArea: b2bCompanyTasksTable.area,
        authorMemberId: b2bCompanyTaskReportsTable.authorMemberId,
        content: b2bCompanyTaskReportsTable.content,
        createdAt: b2bCompanyTaskReportsTable.createdAt,
      })
      .from(b2bCompanyTaskReportsTable)
      .innerJoin(
        b2bCompanyTasksTable,
        eq(b2bCompanyTaskReportsTable.taskId, b2bCompanyTasksTable.id),
      )
      .orderBy(desc(b2bCompanyTaskReportsTable.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    const hasMore = reports.length > pageSize;
    res.json(
      GetStaffB2BCompanyTaskReportsResponse.parse({
        items: reports.slice(0, pageSize).map((report) => ({
          ...report,
          createdAt: report.createdAt.toISOString(),
        })),
        page,
        pageSize,
        hasMore,
      }),
    );
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
          error:
            "Uzman ekip üyesi yalnızca kendisine atanmış görevin durumunu değiştirebilir.",
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
          error: "Sorumlu ekip üyesi bu firmaya bağlı aktif bir kullanıcı değil.",
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