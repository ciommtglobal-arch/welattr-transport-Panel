import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "staff-user" as string | null,
  role: "finance" as "finance" | "reviewer" | "operations" | "admin" | null,
}));

vi.mock("../lib/staffAuth", () => ({
  requireUser: (_req: unknown, res: { status: (status: number) => { json: (body: unknown) => void } }) => {
    if (state.userId) return state.userId;
    res.status(401).json({ error: "Sign in required" });
    return null;
  },
  requireStaff: async (_req: unknown, res: { status: (status: number) => { json: (body: unknown) => void } }) => {
    if (state.role) return { staff: { role: state.role }, userId: state.userId };
    res.status(403).json({ error: "Staff required" });
    return null;
  },
  requireOperationsStaff: vi.fn(),
}));

import staffRouter from "./staff-profiles";
vi.mock("../lib/logisticsListingAuth", () => ({ findLogisticsGrant: async () => null }));

const app = express();
app.use(staffRouter);

describe("existing-account workspace routing", () => {
  const previousFounder = process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID;
  beforeEach(() => {
    state.userId = "staff-user";
    state.role = "finance";
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-user";
  });
  afterEach(() => {
    if (previousFounder === undefined) delete process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID;
    else process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = previousFounder;
  });

  it("routes the allowlisted founder to management without creating a staff account", async () => {
    state.userId = "founder-user";
    state.role = null;
    const response = await request(app).get("/staff/access");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ role: "founder", workspace: "/staff/yonetim-paneli" });
  });

  it.each(["admin", "operations", "finance", "reviewer"] as const)(
    "routes existing %s staff to the shared workspace without changing their role",
    async (role) => {
      state.role = role;
      const response = await request(app).get("/staff/access");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ role, workspace: "/staff/calisma-alani" });
    },
  );

  it("does not give unrelated signed-in users a staff workspace", async () => {
    state.role = null;
    const response = await request(app).get("/staff/access");
    expect(response.status).toBe(403);
  });

  it("requires an existing session", async () => {
    state.userId = null;
    const response = await request(app).get("/staff/access");
    expect(response.status).toBe(401);
  });
});