import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: null as string | null,
  candidates: [] as Array<Record<string, any>>,
  tasks: [] as Array<Record<string, any>>,
  reports: [] as Array<Record<string, any>>,
  staffUsers: [] as Array<Record<string, any>>,
  clerkUsers: [] as Array<{
    id: string;
    emailAddresses: Array<{
      emailAddress: string;
      verification?: { status: string } | null;
    }>;
  }>,
  clerkLookupError: false,
  inserted: [] as Array<Record<string, any>>,
  lookupEmails: [] as string[][],
}));

const tables = vi.hoisted(() => ({
  candidates: {
    name: "candidates",
    clerkUserId: { name: "clerkUserId" },
    active: { name: "active" },
    createdAt: { name: "createdAt" },
  },
  tasks: {
    name: "tasks",
    id: { name: "id" },
    candidateId: { name: "candidateId" },
    createdAt: { name: "createdAt" },
  },
  reports: { name: "reports", taskId: { name: "taskId" } },
  staffUsers: {
    name: "staffUsers",
    id: { name: "id" },
    clerkUserId: { name: "clerkUserId" },
    active: { name: "active" },
  },
}));

function matches(row: Record<string, any>, condition: any): boolean {
  if (!condition) return true;
  if (condition.op === "and") {
    return condition.conditions.every((nested: any) => matches(row, nested));
  }
  if (condition.op === "eq") return row[condition.column.name] === condition.value;
  if (condition.op === "in") return condition.values.includes(row[condition.column.name]);
  return true;
}

function rowsFor(
  table: { name: string },
  condition: any,
  joinedTable?: { name: string },
) {
  if (table.name === "reports" && joinedTable?.name === "tasks") {
    const matchingTaskIds = state.tasks
      .filter((task) => matches(task, condition))
      .map((task) => task.id);
    return state.reports.filter((report) =>
      matchingTaskIds.includes(report.taskId),
    );
  }
  const rows =
    table.name === "candidates"
      ? state.candidates
      : table.name === "tasks"
        ? state.tasks
        : table.name === "reports"
          ? state.reports
          : table.name === "staffUsers"
            ? state.staffUsers
            : [];
  return rows.filter((row) => matches(row, condition));
}

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  desc: (column: unknown) => ({ op: "desc", column }),
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  inArray: (column: unknown, values: unknown[]) => ({ op: "in", column, values }),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (table: { name: string }) => {
        let condition: any;
        let joinedTable: { name: string } | undefined;
        let limit = Number.POSITIVE_INFINITY;
        let offset = 0;
        const query: any = {
          where: (value: any) => {
            condition = value;
            return query;
          },
          innerJoin: (joinTable: { name: string }) => {
            joinedTable = joinTable;
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
          then: (resolve: (value: unknown[]) => unknown) =>
            Promise.resolve(
              rowsFor(table, condition, joinedTable).slice(
                offset,
                offset + limit,
              ),
            ).then(resolve),
        };
        return query;
      },
    }),
    insert: (table: { name: string }) => ({
      values: (value: Record<string, any>) => ({
        returning: async () => {
          state.inserted.push(value);
          const row = {
            id: 11,
            ...value,
            evaluationNote: null,
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
          };
          if (table.name === "candidates") state.candidates.push(row);
          return [row];
        },
      }),
    }),
  },
  staffTrialCandidatesTable: tables.candidates,
  staffTrialReportsTable: tables.reports,
  staffTrialTasksTable: tables.tasks,
  staffUsersTable: tables.staffUsers,
}));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: state.userId }),
  clerkClient: {
    users: {
      getUserList: vi.fn(async (params: { emailAddress: string[]; limit: number }) => {
        if (state.clerkLookupError) throw new Error("Clerk unavailable");
        state.lookupEmails.push(params.emailAddress);
        return {
          data: state.clerkUsers
            .filter((user) =>
              user.emailAddresses.some((address) =>
                params.emailAddress.includes(
                  address.emailAddress.trim().toLowerCase(),
                ),
              ),
            )
            .slice(0, params.limit),
        };
      }),
    },
  },
}));

import trialRouter from "./staff-trial";

const app = express();
app.use(express.json());
app.use(trialRouter);

describe("staff trial authorization", () => {
  beforeEach(() => {
    state.userId = null;
    state.candidates = [];
    state.tasks = [];
    state.reports = [];
    state.staffUsers = [];
    state.inserted = [];
    state.lookupEmails = [];
    state.clerkLookupError = false;
    state.clerkUsers = [
      {
        id: "existing-clerk-user",
        emailAddresses: [
        {
          emailAddress: "Candidate@Example.Test",
          verification: { status: "verified" },
        },
        ],
      },
    ];
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "trial-founder";
  });

  it.each([
    ["unrelated account", "unrelated-user"],
    ["finance staff principal", "finance-user"],
    ["reviewer staff principal", "reviewer-user"],
    ["revoked trial candidate", "revoked-user"],
  ])("%s cannot access candidate tasks without an active exact-id grant", async (_label, userId) => {
    state.userId = userId;
    if (userId === "revoked-user") {
      state.candidates = [
        { id: 7, clerkUserId: "revoked-user", active: false },
      ];
    }
    await request(app).get("/staff/trial-tasks").expect(403);
  });

  it("requires Clerk authentication", async () => {
    await request(app).get("/staff/trial-tasks").expect(401);
  });

  it("denies a trial candidate after an active staff account is added", async () => {
    state.userId = "candidate-a";
    state.candidates = [{ id: 7, clerkUserId: "candidate-a", active: true }];
    state.staffUsers = [
      {
        id: 9,
        clerkUserId: "candidate-a",
        email: "candidate@example.test",
        role: "reviewer",
        active: 1,
      },
    ];
    await request(app).get("/staff/trial-tasks").expect(403);
  });

  it("allows an active candidate to list only tasks attached to their exact trial record", async () => {
    state.userId = "candidate-a";
    state.candidates = [
      { id: 7, clerkUserId: "candidate-a", active: true },
      { id: 8, clerkUserId: "candidate-b", active: true },
    ];
    state.tasks = [
      {
        id: 20,
        candidateId: 7,
        title: "Candidate A",
        description: null,
        status: "open",
        resultText: null,
        supportReceived: false,
        supportDetails: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        id: 21,
        candidateId: 8,
        title: "Candidate B",
        description: null,
        status: "open",
        resultText: null,
        supportReceived: false,
        supportDetails: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
    ];
    const response = await request(app).get("/staff/trial-tasks").expect(200);
    expect(response.body.items.map((task: { id: number }) => task.id)).toEqual([20]);
    expect(response.body.items[0]).not.toHaveProperty("candidateId");
  });

  it("hides another candidate's task from a candidate task update", async () => {
    state.userId = "candidate-a";
    state.candidates = [{ id: 7, clerkUserId: "candidate-a", active: true }];
    state.tasks = [
      {
        id: 21,
        candidateId: 8,
        title: "Candidate B",
        status: "open",
        resultText: null,
      },
    ];
    await request(app)
      .patch("/staff/trial-tasks/21")
      .send({ status: "in_progress" })
      .expect(404);
  });

  it("requires a nonempty result before a candidate can complete a task", async () => {
    state.userId = "candidate-a";
    state.candidates = [{ id: 7, clerkUserId: "candidate-a", active: true }];
    state.tasks = [
      {
        id: 20,
        candidateId: 7,
        title: "Candidate A",
        status: "open",
        resultText: null,
        supportReceived: false,
        supportDetails: null,
      },
    ];
    const response = await request(app)
      .patch("/staff/trial-tasks/20")
      .send({ status: "completed" })
      .expect(400);
    expect(response.body.error).toContain("resultText");
  });

  it("rejects null resultText when updating an already-completed task", async () => {
    state.userId = "candidate-a";
    state.candidates = [{ id: 7, clerkUserId: "candidate-a", active: true }];
    state.tasks = [
      {
        id: 20,
        candidateId: 7,
        title: "Candidate A",
        status: "completed",
        resultText: "Previously completed result",
        supportReceived: false,
        supportDetails: null,
      },
    ];
    const response = await request(app)
      .patch("/staff/trial-tasks/20")
      .send({ resultText: null })
      .expect(400);
    expect(response.body.error).toContain("resultText");
  });

  it("rejects a finance principal from founder-only operations", async () => {
    state.userId = "finance-user";
    await request(app).get("/staff/trial-candidates").expect(403);
    await request(app)
      .post("/staff/trial-tasks")
      .send({ clerkUserId: "candidate-a", title: "Task" })
      .expect(403);
  });

  it("founder verifies the existing Clerk account and exact verified email before granting trial access", async () => {
    state.userId = "trial-founder";
    const response = await request(app)
      .post("/staff/trial-candidates")
      .send({
        email: "  CANDIDATE@EXAMPLE.TEST ",
      })
      .expect(201);
    expect(response.body.clerkUserId).toBe("existing-clerk-user");
    expect(response.body.verifiedEmail).toBe("candidate@example.test");
    expect(response.body).not.toHaveProperty("role");
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).not.toHaveProperty("email");
    expect(state.inserted[0]).not.toHaveProperty("role");
    expect(state.inserted[0].verifiedEmail).toBe("candidate@example.test");
    expect(state.lookupEmails).toEqual([["candidate@example.test"]]);
  });

  it("rejects caller-supplied Clerk ids; grant requests accept only email", async () => {
    state.userId = "trial-founder";
    await request(app)
      .post("/staff/trial-candidates")
      .send({
        email: "candidate@example.test",
        clerkUserId: "caller-selected-id",
      })
      .expect(400);
    expect(state.inserted).toHaveLength(0);
  });

  it("rejects trial grants for an existing active staff account without changing it", async () => {
    state.userId = "trial-founder";
    state.staffUsers = [
      {
        id: 9,
        clerkUserId: "existing-clerk-user",
        email: "candidate@example.test",
        role: "finance",
        active: 1,
      },
    ];
    await request(app)
      .post("/staff/trial-candidates")
      .send({ email: "candidate@example.test" })
      .expect(409);
    expect(state.inserted).toHaveLength(0);
    expect(state.staffUsers[0].role).toBe("finance");
  });

  it("does not grant access for missing accounts or unverified/mismatched email", async () => {
    state.userId = "trial-founder";
    state.clerkUsers = [];
    await request(app)
      .post("/staff/trial-candidates")
      .send({ email: "missing@example.test" })
      .expect(400);
    state.clerkUsers = [
      {
        id: "unverified-user",
        emailAddresses: [
          {
            emailAddress: "candidate@example.test",
            verification: { status: "unverified" },
          },
        ],
      },
    ];
    await request(app)
      .post("/staff/trial-candidates")
      .send({ email: "candidate@example.test" })
      .expect(400);
    expect(state.inserted).toHaveLength(0);
  });

  it("rejects ambiguous email matches and Clerk lookup failures", async () => {
    state.userId = "trial-founder";
    state.clerkUsers.push({
      id: "duplicate-clerk-user",
      emailAddresses: [
        {
          emailAddress: "candidate@example.test",
          verification: { status: "verified" },
        },
      ],
    });
    await request(app)
      .post("/staff/trial-candidates")
      .send({ email: "candidate@example.test" })
      .expect(400);
    state.clerkLookupError = true;
    await request(app)
      .post("/staff/trial-candidates")
      .send({ email: "candidate@example.test" })
      .expect(502);
    expect(state.inserted).toHaveLength(0);
  });

  it("includes verified email only in founder candidate review", async () => {
    state.userId = "trial-founder";
    state.candidates = [
      {
        id: 5,
        clerkUserId: "existing-clerk-user",
        verifiedEmail: "candidate@example.test",
        active: true,
        evaluationNote: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
    ];
    const founderResponse = await request(app)
      .get("/staff/trial-candidates")
      .expect(200);
    expect(founderResponse.body.items[0].verifiedEmail).toBe(
      "candidate@example.test",
    );
    state.tasks = [
      {
        id: 41,
        candidateId: 5,
        title: "Trial assignment",
        description: null,
        status: "blocked",
        resultText: "Waiting for access",
        supportReceived: true,
        supportDetails: "Access request is pending.",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        id: 42,
        candidateId: 6,
        title: "Another candidate assignment",
        description: null,
        status: "completed",
        resultText: "Other candidate result",
        supportReceived: false,
        supportDetails: null,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      },
    ];
    state.reports = [
      {
        id: 51,
        taskId: 41,
        content: "Candidate report one",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
      {
        id: 52,
        taskId: 41,
        content: "Candidate report two",
        createdAt: new Date("2024-01-02T00:00:00Z"),
      },
      {
        id: 53,
        taskId: 42,
        content: "Other candidate report",
        createdAt: new Date("2024-01-03T00:00:00Z"),
      },
    ];
    const founderTaskReview = await request(app)
      .get("/staff/trial-candidates/existing-clerk-user/tasks")
      .expect(200);
    expect(founderTaskReview.body.candidate.verifiedEmail).toBe(
      "candidate@example.test",
    );
    expect(founderTaskReview.body.items[0].supportDetails).toBe(
      "Access request is pending.",
    );
    const founderReportReview = await request(app)
      .get("/staff/trial-candidates/existing-clerk-user/reports?pageSize=1")
      .expect(200);
    expect(founderReportReview.body.candidate.verifiedEmail).toBe(
      "candidate@example.test",
    );
    expect(founderReportReview.body.items).toHaveLength(1);
    expect(founderReportReview.body.hasMore).toBe(true);
    expect(founderReportReview.body.items[0].content).not.toBe(
      "Other candidate report",
    );
    state.userId = "existing-clerk-user";
    state.candidates = [
      {
        id: 7,
        clerkUserId: "existing-clerk-user",
        verifiedEmail: "candidate@example.test",
        active: true,
      },
    ];
    const candidateResponse = await request(app)
      .get("/staff/trial-tasks")
      .expect(200);
    expect(candidateResponse.body).not.toHaveProperty("verifiedEmail");
    expect(candidateResponse.body.items).toEqual([]);
  });

  it("caps candidate-written support details at 2,000 characters", async () => {
    state.userId = "candidate-a";
    state.candidates = [{ id: 7, clerkUserId: "candidate-a", active: true }];
    await request(app)
      .patch("/staff/trial-tasks/20")
      .send({ supportDetails: "x".repeat(2001) })
      .expect(400);
  });
});