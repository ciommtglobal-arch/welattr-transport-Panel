import { clerkClient, getAuth } from "@clerk/express";
import {
  CreateStaffTrialCandidateBody,
  CreateStaffTrialCandidateResponse,
  CreateStaffTrialReportBody,
  CreateStaffTrialReportResponse,
  CreateStaffTrialTaskBody,
  CreateStaffTrialTaskResponse,
  GetStaffTrialCandidateReportsParams,
  GetStaffTrialCandidateReportsQueryParams,
  GetStaffTrialCandidateReportsResponse,
  GetStaffTrialCandidatesQueryParams,
  GetStaffTrialCandidatesResponse,
  GetStaffTrialCandidateTasksParams,
  GetStaffTrialCandidateTasksQueryParams,
  GetStaffTrialCandidateTasksResponse,
  GetStaffTrialTaskReportsParams,
  GetStaffTrialTaskReportsQueryParams,
  GetStaffTrialTaskReportsResponse,
  GetStaffTrialTasksQueryParams,
  GetStaffTrialTasksResponse,
  UpdateStaffTrialCandidateActiveBody,
  UpdateStaffTrialCandidateActiveParams,
  UpdateStaffTrialCandidateActiveResponse,
  UpdateStaffTrialCandidateEvaluationBody,
  UpdateStaffTrialCandidateEvaluationParams,
  UpdateStaffTrialCandidateEvaluationResponse,
  UpdateStaffTrialTaskBody,
  UpdateStaffTrialTaskParams,
  UpdateStaffTrialTaskResponse,
} from "@workspace/api-zod";
import {
  db,
  staffTrialCandidatesTable,
  staffTrialReportsTable,
  staffTrialTasksTable,
  staffUsersTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function currentUserId(req: Request) {
  return getAuth(req).userId ?? null;
}

function founderId() {
  return process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim() || null;
}

function requireUser(req: Request, res: Response) {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return userId;
}

function requireFounder(req: Request, res: Response) {
  const userId = requireUser(req, res);
  if (!userId) return null;
  if (!founderId() || userId !== founderId()) {
    res.status(403).json({ error: "Founder allowlist required" });
    return null;
  }
  return userId;
}

async function requireActiveCandidate(
  req: Request,
  res: Response,
) {
  const userId = requireUser(req, res);
  if (!userId) return null;
  const [candidate] = await db
    .select()
    .from(staffTrialCandidatesTable)
    .where(
      and(
        eq(staffTrialCandidatesTable.clerkUserId, userId),
        eq(staffTrialCandidatesTable.active, true),
      ),
    )
    .limit(1);
  if (!candidate) {
    res.status(403).json({ error: "Active trial candidate access required" });
    return null;
  }
  const [activeStaffUser] = await db
    .select({ id: staffUsersTable.id })
    .from(staffUsersTable)
    .where(
      and(
        eq(staffUsersTable.clerkUserId, userId),
        eq(staffUsersTable.active, 1),
      ),
    )
    .limit(1);
  if (activeStaffUser) {
    res.status(403).json({ error: "Active trial candidate access required" });
    return null;
  }
  return { userId, candidate };
}

function parsePage(queryParams: any, query: unknown, res: Response) {
  const parsed = queryParams.safeParse(query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return null;
  }
  return parsed.data as { page: number; pageSize: number };
}

function pageResult<T>(items: T[], page: number, pageSize: number) {
  return {
    items: items.slice(0, pageSize),
    page,
    pageSize,
    hasMore: items.length > pageSize,
  };
}

router.get("/staff/trial-candidates", async (req, res): Promise<void> => {
  if (!requireFounder(req, res)) return;
  const pagination = parsePage(
    GetStaffTrialCandidatesQueryParams,
    req.query,
    res,
  );
  if (!pagination) return;
  const { page, pageSize } = pagination;
  const candidates = await db
    .select({
      clerkUserId: staffTrialCandidatesTable.clerkUserId,
      verifiedEmail: staffTrialCandidatesTable.verifiedEmail,
      active: staffTrialCandidatesTable.active,
      evaluationNote: staffTrialCandidatesTable.evaluationNote,
      createdAt: staffTrialCandidatesTable.createdAt,
      updatedAt: staffTrialCandidatesTable.updatedAt,
    })
    .from(staffTrialCandidatesTable)
    .orderBy(desc(staffTrialCandidatesTable.createdAt))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  res.json(
    GetStaffTrialCandidatesResponse.parse(
      pageResult(candidates, page, pageSize),
    ),
  );
});

router.post("/staff/trial-candidates", async (req, res): Promise<void> => {
  const founderUserId = requireFounder(req, res);
  if (!founderUserId) return;
  const requestBody =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? {
          ...req.body,
          email:
            typeof req.body.email === "string"
              ? req.body.email.trim().toLowerCase()
              : req.body.email,
        }
      : req.body;
  const input = CreateStaffTrialCandidateBody.safeParse(requestBody);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const inputKeys = Object.keys(req.body as Record<string, unknown>);
  if (inputKeys.some((key) => key !== "email")) {
    res.status(400).json({ error: "Only an exact email may be supplied" });
    return;
  }
  let clerkUsers;
  try {
    clerkUsers = await clerkClient.users.getUserList({
      emailAddress: [input.data.email],
      limit: 2,
    });
  } catch {
    res.status(502).json({ error: "Unable to verify the Clerk account right now" });
    return;
  }
  if (clerkUsers.data.length === 0) {
    res.status(400).json({ error: "No Clerk account exists for this email" });
    return;
  }
  if (clerkUsers.data.length > 1) {
    res.status(400).json({ error: "The email matches multiple Clerk accounts" });
    return;
  }
  const clerkUser = clerkUsers.data[0]!;
  const hasVerifiedMatchingEmail = clerkUser.emailAddresses.some(
    (address) =>
      address.verification?.status === "verified" &&
      address.emailAddress.trim().toLowerCase() === input.data.email,
  );
  if (!hasVerifiedMatchingEmail) {
    res.status(400).json({
      error: "The email must be verified on the matching Clerk account",
    });
    return;
  }
  const [activeStaffUser] = await db
    .select({ id: staffUsersTable.id })
    .from(staffUsersTable)
    .where(
      and(
        eq(staffUsersTable.clerkUserId, clerkUser.id),
        eq(staffUsersTable.active, 1),
      ),
    )
    .limit(1);
  if (activeStaffUser) {
    res.status(409).json({
      error: "An active staff account cannot receive a trial grant",
    });
    return;
  }
  const [existing] = await db
    .select({ clerkUserId: staffTrialCandidatesTable.clerkUserId })
    .from(staffTrialCandidatesTable)
    .where(eq(staffTrialCandidatesTable.clerkUserId, clerkUser.id))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "This Clerk account already has a trial record" });
    return;
  }
  const [candidate] = await db
    .insert(staffTrialCandidatesTable)
    .values({
      clerkUserId: clerkUser.id,
      verifiedEmail: input.data.email,
      active: true,
      grantedByClerkUserId: founderUserId,
    })
    .returning();
  res.status(201).json(CreateStaffTrialCandidateResponse.parse(candidate));
});

router.patch(
  "/staff/trial-candidates/:clerkUserId/active",
  async (req, res): Promise<void> => {
    const founderUserId = requireFounder(req, res);
    if (!founderUserId) return;
    const params = UpdateStaffTrialCandidateActiveParams.safeParse(req.params);
    const body = UpdateStaffTrialCandidateActiveBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : body.error?.message ?? "Invalid body",
      });
      return;
    }
    const [updated] = await db
      .update(staffTrialCandidatesTable)
      .set({ active: body.data.active, updatedAt: new Date() })
      .where(
        eq(staffTrialCandidatesTable.clerkUserId, params.data.clerkUserId),
      )
      .returning({
        clerkUserId: staffTrialCandidatesTable.clerkUserId,
        verifiedEmail: staffTrialCandidatesTable.verifiedEmail,
        active: staffTrialCandidatesTable.active,
        evaluationNote: staffTrialCandidatesTable.evaluationNote,
        createdAt: staffTrialCandidatesTable.createdAt,
        updatedAt: staffTrialCandidatesTable.updatedAt,
      });
    if (!updated) {
      res.status(404).json({ error: "Trial candidate not found" });
      return;
    }
    res.json(UpdateStaffTrialCandidateActiveResponse.parse(updated));
  },
);

router.get("/staff/trial-tasks", async (req, res): Promise<void> => {
  const authorization = await requireActiveCandidate(req, res);
  if (!authorization) return;
  const pagination = parsePage(GetStaffTrialTasksQueryParams, req.query, res);
  if (!pagination) return;
  const { page, pageSize } = pagination;
  const tasks = await db
    .select()
    .from(staffTrialTasksTable)
    .where(eq(staffTrialTasksTable.candidateId, authorization.candidate.id))
    .orderBy(desc(staffTrialTasksTable.createdAt))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  res.json(
    GetStaffTrialTasksResponse.parse(pageResult(tasks, page, pageSize)),
  );
});

router.post("/staff/trial-tasks", async (req, res): Promise<void> => {
  const founderUserId = requireFounder(req, res);
  if (!founderUserId) return;
  const input = CreateStaffTrialTaskBody.safeParse(req.body);
  if (!input.success || !input.data.title.trim()) {
    res.status(400).json({
      error: input.success ? "Task title must not be empty" : input.error.message,
    });
    return;
  }
  const [candidate] = await db
    .select()
    .from(staffTrialCandidatesTable)
    .where(
      and(
        eq(staffTrialCandidatesTable.clerkUserId, input.data.clerkUserId),
        eq(staffTrialCandidatesTable.active, true),
      ),
    )
    .limit(1);
  if (!candidate) {
    res.status(400).json({ error: "Task candidate must have an active trial grant" });
    return;
  }
  const [task] = await db
    .insert(staffTrialTasksTable)
    .values({
      candidateId: candidate.id,
      title: input.data.title.trim(),
      description: input.data.description?.trim() || null,
      createdByClerkUserId: founderUserId,
    })
    .returning();
  res.status(201).json(CreateStaffTrialTaskResponse.parse(task));
});

router.patch(
  "/staff/trial-tasks/:id",
  async (req, res): Promise<void> => {
    const authorization = await requireActiveCandidate(req, res);
    if (!authorization) return;
    const params = UpdateStaffTrialTaskParams.safeParse(req.params);
    const body = UpdateStaffTrialTaskBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : body.error?.message ?? "Invalid body",
      });
      return;
    }
    if (Object.keys(body.data).length === 0) {
      res.status(400).json({ error: "At least one trial task field is required" });
      return;
    }
    const [task] = await db
      .select()
      .from(staffTrialTasksTable)
      .where(
        and(
          eq(staffTrialTasksTable.id, params.data.id),
          eq(staffTrialTasksTable.candidateId, authorization.candidate.id),
        ),
      )
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "Trial task not found" });
      return;
    }
    const resultText = Object.prototype.hasOwnProperty.call(
      body.data,
      "resultText",
    )
      ? body.data.resultText
      : task.resultText;
    const status = body.data.status ?? task.status;
    if (status === "completed" && !resultText?.trim()) {
      res.status(400).json({
        error: "A nonempty resultText is required to complete a trial task",
      });
      return;
    }
    const [updated] = await db
      .update(staffTrialTasksTable)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(staffTrialTasksTable.id, params.data.id),
          eq(staffTrialTasksTable.candidateId, authorization.candidate.id),
        ),
      )
      .returning();
    res.json(UpdateStaffTrialTaskResponse.parse(updated));
  },
);

router.get(
  "/staff/trial-tasks/:id/reports",
  async (req, res): Promise<void> => {
    const authorization = await requireActiveCandidate(req, res);
    if (!authorization) return;
    const params = GetStaffTrialTaskReportsParams.safeParse(req.params);
    const pagination = parsePage(
      GetStaffTrialTaskReportsQueryParams,
      req.query,
      res,
    );
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!pagination) return;
    const [task] = await db
      .select({ id: staffTrialTasksTable.id })
      .from(staffTrialTasksTable)
      .where(
        and(
          eq(staffTrialTasksTable.id, params.data.id),
          eq(staffTrialTasksTable.candidateId, authorization.candidate.id),
        ),
      )
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "Trial task not found" });
      return;
    }
    const { page, pageSize } = pagination;
    const reports = await db
      .select()
      .from(staffTrialReportsTable)
      .where(eq(staffTrialReportsTable.taskId, task.id))
      .orderBy(desc(staffTrialReportsTable.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    res.json(
      GetStaffTrialTaskReportsResponse.parse(
        pageResult(reports, page, pageSize),
      ),
    );
  },
);

router.post(
  "/staff/trial-tasks/:id/reports",
  async (req, res): Promise<void> => {
    const authorization = await requireActiveCandidate(req, res);
    if (!authorization) return;
    const params = GetStaffTrialTaskReportsParams.safeParse(req.params);
    const body = CreateStaffTrialReportBody.safeParse(req.body);
    if (!params.success || !body.success || !body.data.content.trim()) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : !body.success
            ? body.error.message
            : "Report content must not be empty",
      });
      return;
    }
    const [task] = await db
      .select({ id: staffTrialTasksTable.id })
      .from(staffTrialTasksTable)
      .where(
        and(
          eq(staffTrialTasksTable.id, params.data.id),
          eq(staffTrialTasksTable.candidateId, authorization.candidate.id),
        ),
      )
      .limit(1);
    if (!task) {
      res.status(404).json({ error: "Trial task not found" });
      return;
    }
    const [report] = await db
      .insert(staffTrialReportsTable)
      .values({
        taskId: task.id,
        authorClerkUserId: authorization.userId,
        content: body.data.content.trim(),
      })
      .returning();
    res.status(201).json(CreateStaffTrialReportResponse.parse(report));
  },
);

router.get(
  "/staff/trial-candidates/:clerkUserId/tasks",
  async (req, res): Promise<void> => {
    if (!requireFounder(req, res)) return;
    const params = GetStaffTrialCandidateTasksParams.safeParse(req.params);
    const pagination = parsePage(
      GetStaffTrialCandidateTasksQueryParams,
      req.query,
      res,
    );
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!pagination) return;
    const [candidate] = await db
      .select()
      .from(staffTrialCandidatesTable)
      .where(eq(staffTrialCandidatesTable.clerkUserId, params.data.clerkUserId))
      .limit(1);
    if (!candidate) {
      res.status(404).json({ error: "Trial candidate not found" });
      return;
    }
    const { page, pageSize } = pagination;
    const tasks = await db
      .select()
      .from(staffTrialTasksTable)
      .where(eq(staffTrialTasksTable.candidateId, candidate.id))
      .orderBy(desc(staffTrialTasksTable.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    res.json(
      GetStaffTrialCandidateTasksResponse.parse(
        {
          candidate,
          ...pageResult(tasks, page, pageSize),
        },
      ),
    );
  },
);

router.get(
  "/staff/trial-candidates/:clerkUserId/reports",
  async (req, res): Promise<void> => {
    if (!requireFounder(req, res)) return;
    const params = GetStaffTrialCandidateReportsParams.safeParse(req.params);
    const pagination = parsePage(
      GetStaffTrialCandidateReportsQueryParams,
      req.query,
      res,
    );
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!pagination) return;
    const [candidate] = await db
      .select()
      .from(staffTrialCandidatesTable)
      .where(eq(staffTrialCandidatesTable.clerkUserId, params.data.clerkUserId))
      .limit(1);
    if (!candidate) {
      res.status(404).json({ error: "Trial candidate not found" });
      return;
    }
    const { page, pageSize } = pagination;
    const reports = await db
      .select({
        id: staffTrialReportsTable.id,
        taskId: staffTrialReportsTable.taskId,
        content: staffTrialReportsTable.content,
        createdAt: staffTrialReportsTable.createdAt,
      })
      .from(staffTrialReportsTable)
      .innerJoin(
        staffTrialTasksTable,
        eq(staffTrialReportsTable.taskId, staffTrialTasksTable.id),
      )
      .where(eq(staffTrialTasksTable.candidateId, candidate.id))
      .orderBy(desc(staffTrialReportsTable.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    res.json(
      GetStaffTrialCandidateReportsResponse.parse(
        {
          candidate,
          ...pageResult(reports, page, pageSize),
        },
      ),
    );
  },
);

router.patch(
  "/staff/trial-candidates/:clerkUserId/evaluation",
  async (req, res): Promise<void> => {
    if (!requireFounder(req, res)) return;
    const params = UpdateStaffTrialCandidateEvaluationParams.safeParse(
      req.params,
    );
    const body = UpdateStaffTrialCandidateEvaluationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : body.error?.message ?? "Invalid body",
      });
      return;
    }
    const [candidate] = await db
      .update(staffTrialCandidatesTable)
      .set({ evaluationNote: body.data.evaluationNote, updatedAt: new Date() })
      .where(eq(staffTrialCandidatesTable.clerkUserId, params.data.clerkUserId))
      .returning({
        clerkUserId: staffTrialCandidatesTable.clerkUserId,
        verifiedEmail: staffTrialCandidatesTable.verifiedEmail,
        active: staffTrialCandidatesTable.active,
        evaluationNote: staffTrialCandidatesTable.evaluationNote,
        createdAt: staffTrialCandidatesTable.createdAt,
        updatedAt: staffTrialCandidatesTable.updatedAt,
      });
    if (!candidate) {
      res.status(404).json({ error: "Trial candidate not found" });
      return;
    }
    res.json(UpdateStaffTrialCandidateEvaluationResponse.parse(candidate));
  },
);

export default router;