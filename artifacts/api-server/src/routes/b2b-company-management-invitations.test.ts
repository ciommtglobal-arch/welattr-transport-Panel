import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "clerk-user-1" as string | null,
  emailAddresses: [] as Array<{
    emailAddress: string;
    verification?: { status: string } | null;
  }>,
  selectCount: 0,
  member: null as Record<string, unknown> | null,
  update: vi.fn(),
}));

const memberTable = vi.hoisted(() => ({
  id: "id",
  inviteTokenHash: "invite_token_hash",
  status: "status",
  clerkUserId: "clerk_user_id",
  inviteExpiresAt: "invite_expires_at",
  businessProfileId: "business_profile_id",
}));

vi.mock("@clerk/express", () => ({
  clerkClient: {
    users: {
      getUser: vi.fn(async () => ({ emailAddresses: state.emailAddresses })),
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => {
      const selectIndex = state.selectCount++;
      return {
        from: () => ({
          where: () => ({
            limit: async () =>
              selectIndex === 0 && state.member ? [state.member] : [],
          }),
        }),
      };
    },
    update: () => ({
      set: (updates: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => state.update(updates),
        }),
      }),
    }),
  },
  b2bCompanyMembersTable: memberTable,
  b2bCompanyRequestsTable: {},
  b2bCompanyTasksTable: {},
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

vi.mock("../lib/companyAuth", () => ({ requireMyCompany: vi.fn() }));
vi.mock("./workflow", () => ({
  createWorkflowApproval: vi.fn(),
  isWorkflowEntityApproved: vi.fn(),
}));

import b2bCompanyManagementRouter from "./b2b-company-management";

const app = express();
app.use(express.json());
app.use(b2bCompanyManagementRouter);

const inviteToken = "invitation-token-for-regression-test";
const inviteTokenHash =
  "4ae92ed758a3208e30845f31db07ee8509920622e5525e3b572201c1cde29605";

function createMember() {
  return {
    id: 41,
    businessProfileId: 7,
    clerkUserId: null,
    fullName: "Invited Member",
    email: "  member@example.com ",
    phone: null,
    department: null,
    jobTitle: null,
    areas: [],
    role: "member",
    status: "invited",
    inviteTokenHash,
    inviteExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    invitedAt: new Date("2029-01-01T00:00:00.000Z"),
    acceptedAt: null,
    createdAt: new Date("2029-01-01T00:00:00.000Z"),
    updatedAt: new Date("2029-01-01T00:00:00.000Z"),
  };
}

describe("B2B company invitation acceptance email verification", () => {
  beforeEach(() => {
    state.userId = "clerk-user-1";
    state.emailAddresses = [];
    state.selectCount = 0;
    state.member = createMember();
    state.update.mockReset().mockImplementation((updates) => [
      { ...state.member, ...updates },
    ]);
  });

  it("accepts an invitation using a matching verified secondary address", async () => {
    state.emailAddresses = [
      {
        emailAddress: "primary@example.com",
        verification: { status: "verified" },
      },
      {
        emailAddress: " MEMBER@example.com ",
        verification: { status: "verified" },
      },
    ];

    const response = await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken });

    expect(response.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "clerk-user-1",
        status: "active",
        inviteTokenHash: null,
      }),
    );
  });

  it("rejects an unverified matching secondary address without consuming the token", async () => {
    state.emailAddresses = [
      {
        emailAddress: "primary@example.com",
        verification: { status: "verified" },
      },
      {
        emailAddress: "member@example.com",
        verification: { status: "unverified" },
      },
    ];

    const response = await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken });

    expect(response.status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.member?.inviteTokenHash).toBe(inviteTokenHash);
  });

  it("rejects an invitation when no verified address matches", async () => {
    state.emailAddresses = [
      {
        emailAddress: "someone-else@example.com",
        verification: { status: "verified" },
      },
    ];

    const response = await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken });

    expect(response.status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.member?.inviteTokenHash).toBe(inviteTokenHash);
  });

  it("returns a conflict when another request consumes the invite before the update", async () => {
    state.emailAddresses = [
      {
        emailAddress: "member@example.com",
        verification: { status: "verified" },
      },
    ];
    state.update.mockImplementationOnce(() => []);

    const response = await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("başka bir oturumda");
  });

  // Isolated TEST fixtures only: Clerk and PostgreSQL are mocked above.
  // These cover company invitations, not a pilot-file invitation workflow.
  it.each([new Date("2000-01-01T00:00:00Z"), null])(
    "rejects an expired or missing expiry without changing membership",
    async (inviteExpiresAt) => {
      state.member = { ...createMember(), inviteExpiresAt };
      await request(app)
        .post("/b2b/business-profile/members/invitations/accept")
        .send({ token: inviteToken })
        .expect(400);
      expect(state.update).not.toHaveBeenCalled();
    },
  );

  it.each(["revoked", "active"])(
    "rejects a %s invitation without changing membership",
    async (status) => {
      state.member = { ...createMember(), status };
      await request(app)
        .post("/b2b/business-profile/members/invitations/accept")
        .send({ token: inviteToken })
        .expect(400);
      expect(state.update).not.toHaveBeenCalled();
    },
  );

  it("rejects an invitation already bound to another identity", async () => {
    state.member = { ...createMember(), clerkUserId: "TEST-other-user" };
    await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken })
      .expect(400);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("rejects a consumed or unknown token when no matching row exists", async () => {
    state.member = null;
    await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken })
      .expect(404);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("requires authentication before accepting an invitation", async () => {
    state.userId = null;
    await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({ token: inviteToken })
      .expect(401);
    expect(state.selectCount).toBe(0);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("retains the invited company and role rather than trusting request overrides", async () => {
    state.emailAddresses = [{
      emailAddress: "member@example.com",
      verification: { status: "verified" },
    }];
    const response = await request(app)
      .post("/b2b/business-profile/members/invitations/accept")
      .send({
        token: inviteToken,
        role: "owner",
        businessProfileId: 999,
        clerkUserId: "TEST-attacker",
      })
      .expect(200);
    expect(response.body).toMatchObject({
      businessProfileId: 7,
      role: "member",
      clerkUserId: "clerk-user-1",
    });
    const updates = state.update.mock.calls[0][0];
    expect(updates).not.toHaveProperty("role");
    expect(updates).not.toHaveProperty("businessProfileId");
    expect(updates.clerkUserId).toBe("clerk-user-1");
  });
});