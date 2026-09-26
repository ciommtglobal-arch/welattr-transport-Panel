import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorization: null as Record<string, any> | null,
  userId: "member-user",
  task: null as Record<string, any> | null,
  reports: [] as Array<Record<string, any>>,
  founderReports: [] as Array<Record<string, any>>,
  approved: true,
  inserted: [] as Array<Record<string, any>>,
}));

const tables = vi.hoisted(() => ({
  members: { name: "members", id: "member_id" },
  tasks: {
    name: "tasks",
    id: "task_id",
    businessProfileId: "profile_id",
    title: "title",
    area: "area",
  },
  reports: {
    name: "reports",
    id: "report_id",
    taskId: "task_id",
    authorMemberId: "author_member_id",
    content: "content",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  desc: (column: unknown) => column,
  eq: (...conditions: unknown[]) => conditions,
  gt: (...conditions: unknown[]) => conditions,
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (table: { name: string }) => {
        let source = table.name;
        let offset = 0;
        let limit = Number.POSITIVE_INFINITY;
        const query: any = {
          where: () => query,
          innerJoin: () => {
            source = "founder";
            return query;
          },
          orderBy: () => query,
          limit: (value: number) => {
            limit = value;
            return query;
          },
          offset: (value: number) => {
            offset = value;
            return query;
          },
          then: (
            resolve: (rows: Array<Record<string, any>>) => unknown,
            reject: (error: unknown) => unknown,
          ) => {
            const rows =
              source === "tasks"
                ? state.task
                  ? [state.task]
                  : []
                : source === "founder"
                  ? state.founderReports
                  : state.reports;
            return Promise.resolve(rows.slice(offset, offset + limit)).then(
              resolve,
              reject,
            );
          },
        };
        return query;
      },
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          const row = {
            id: state.inserted.length + 1,
            ...values,
            createdAt: new Date("2029-05-01T12:00:00.000Z"),
          };
          state.inserted.push(row);
          return [row];
        },
      }),
    }),
  },
  b2bCompanyMembersTable: tables.members,
  b2bCompanyRequestsTable: {},
  b2bCompanyTaskReportsTable: tables.reports,
  b2bCompanyTasksTable: tables.tasks,
}));

vi.mock("../lib/companyAuth", () => ({
  requireMyCompany: vi.fn(async () => state.authorization),
}));

vi.mock("../lib/staffAuth", () => ({
  requireUser: (
    _req: unknown,
    res: { status: (status: number) => { json: (body: unknown) => void } },
  ) => {
    if (state.userId) return state.userId;
    res.status(401).json({ error: "Sign in required" });
    return null;
  },
}));

vi.mock("./workflow", () => ({
  createWorkflowApproval: vi.fn(),
  isWorkflowEntityApproved: vi.fn(async () => state.approved),
}));

import b2bCompanyManagementRouter from "./b2b-company-management";

const app = express();
app.use(express.json());
app.use(b2bCompanyManagementRouter);

function setCompanyRole(
  role: "owner" | "admin" | "manager" | "member",
  options: { assistant?: boolean; memberId?: number; linked?: boolean } = {},
) {
  const memberId = options.memberId ?? 11;
  state.authorization = {
    userId: state.userId,
    profile: { id: 7, ownerClerkUserId: "owner-user" },
    member: {
      id: memberId,
      businessProfileId: 7,
      clerkUserId: options.linked === false ? null : state.userId,
      role,
      status: "active",
      areas: ["operations"],
      isPilotAssistant: options.assistant ?? false,
      leadMemberId: null,
    },
  };
}

describe("B2B company task progress reports", () => {
  beforeEach(() => {
    state.userId = "member-user";
    state.authorization = null;
    state.task = {
      id: 51,
      businessProfileId: 7,
      title: "Inspect site",
      area: "operations",
      status: "in_progress",
      assigneeMemberId: 11,
    };
    state.reports = [
      {
        id: 5,
        taskId: 51,
        authorMemberId: 11,
        content: "Progress recorded",
        createdAt: new Date("2029-04-30T12:00:00.000Z"),
      },
    ];
    state.founderReports = [
      {
        id: 5,
        businessProfileId: 7,
        taskId: 51,
        taskTitle: "Inspect site",
        taskArea: "operations",
        authorMemberId: 11,
        content: "Progress recorded",
        createdAt: new Date("2029-04-30T12:00:00.000Z"),
      },
    ];
    state.approved = true;
    state.inserted = [];
    delete process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID;
  });

  it.each(["owner", "manager"] as const)(
    "%s can read reports for a visible company task",
    async (role) => {
      setCompanyRole(role);
      const response = await request(app)
        .get("/b2b/business-profile/task-reports?taskId=51")
        .expect(200);
      expect(response.body.items[0]).toMatchObject({
        taskId: 51,
        authorMemberId: 11,
        content: "Progress recorded",
      });
    },
  );

  it("allows a linked active assistant to append a report only to their assigned approved task", async () => {
    setCompanyRole("member", { assistant: true });
    const response = await request(app)
      .post("/b2b/business-profile/tasks/51/reports")
      .send({ content: "  Work is underway.  " })
      .expect(201);

    expect(response.body).toMatchObject({
      taskId: 51,
      authorMemberId: 11,
      content: "Work is underway.",
    });
    expect(state.inserted).toHaveLength(1);

    const ownReports = await request(app)
      .get("/b2b/business-profile/task-reports?taskId=51")
      .expect(200);
    expect(ownReports.body.items[0]).toMatchObject({
      taskId: 51,
      authorMemberId: 11,
      content: "Progress recorded",
    });
  });

  it("rejects an assistant whose active invitation is not linked to this Clerk identity", async () => {
    setCompanyRole("member", { assistant: true, linked: false });
    await request(app)
      .post("/b2b/business-profile/tasks/51/reports")
      .send({ content: "Cannot attribute this yet." })
      .expect(403);
    expect(state.inserted).toHaveLength(0);
  });

  it("rejects an unrelated member even when task-area visibility allows reading the task", async () => {
    setCompanyRole("member", { memberId: 22 });
    await request(app)
      .post("/b2b/business-profile/tasks/51/reports")
      .send({ content: "Not assigned to me." })
      .expect(403);
    await request(app)
      .get("/b2b/business-profile/task-reports?taskId=51")
      .expect(403);
    expect(state.inserted).toHaveLength(0);
  });

  it("requires approval before accepting reports", async () => {
    setCompanyRole("member");
    state.approved = false;
    await request(app)
      .post("/b2b/business-profile/tasks/51/reports")
      .send({ content: "Waiting for approval." })
      .expect(409);
    expect(state.inserted).toHaveLength(0);
  });

  it("allows only the allowlisted founder to read a PII-limited cross-company page", async () => {
    state.userId = "founder-user";
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-user";
    const response = await request(app)
      .get("/b2b/staff/company-task-reports?page=1&pageSize=1")
      .expect(200);
    expect(response.body.items[0]).toMatchObject({
      businessProfileId: 7,
      taskId: 51,
      authorMemberId: 11,
    });
    expect(response.body.items[0]).not.toHaveProperty("email");
    expect(response.body.items[0]).not.toHaveProperty("fullName");
    await request(app)
      .post("/b2b/staff/company-task-reports")
      .send({ content: "No staff writes." })
      .expect(404);
  });

  it("denies cross-company report reads to a non-allowlisted identity", async () => {
    state.userId = "other-user";
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-user";
    await request(app).get("/b2b/staff/company-task-reports").expect(403);
  });
});