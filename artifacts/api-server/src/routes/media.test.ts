import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "staff-user",
  staffRole: "reviewer" as string | null,
  item: null as Record<string, unknown> | null,
  sends: 0,
}));

vi.mock("../lib/staffAuth", () => ({
  requireUser: () => state.userId,
  requireStaff: async (_req: unknown, res: { status: (code: number) => { json: (value: unknown) => void } }) => {
    if (!state.staffRole) {
      res.status(403).json({ error: "Staff required" });
      return null;
    }
    return { userId: state.userId, staff: { role: state.staffRole } };
  },
}));

vi.mock("../lib/mediaPublisher", () => ({
  dispatchMediaToTelegram: async () => { state.sends++; return { externalId: "1", sentAt: new Date() }; },
}));

vi.mock("@workspace/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => state.item ? [state.item] : [] }),
        }),
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        update: () => ({
          set: (values: Record<string, unknown>) => ({
            where: () => ({ returning: async () => {
              const before = state.item;
              if (!before) return [];
              if (values.status === "publication_pending" && (before.status !== "approved" || before.pilotType !== "pilot_real")) return [];
              if (values.status === "published" && before.status !== "publication_pending") return [];
              state.item = { ...before, ...values };
              return [state.item];
            } }),
          }),
        }),
        insert: () => ({ values: async () => [] }),
      }),
    },
  };
});

import mediaRouter from "./media";

const app = express();
app.use(express.json());
app.use(mediaRouter);

describe("pilot media publication safety", () => {
  beforeEach(() => {
    state.userId = "staff-user";
    state.staffRole = "reviewer";
    state.sends = 0;
    state.item = {
      id: 3, title: "Pilot", summary: "Pilot içeriği", category: "medya",
      status: "approved", pilotType: "test", founderApprovedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
      includesTeamMembers: 0, sourceUrl: null, objectPath: null,
    };
    delete process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID;
  });

  it("never sends an approved TEST item to Telegram, even for the founder", async () => {
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-user";
    state.userId = "founder-user";
    state.staffRole = null;
    const response = await request(app).post("/media/items/3/publish");
    expect(response.status).toBe(409);
    expect(state.sends).toBe(0);
  });

  it("does not mark TEST as published from a claimed manual link", async () => {
    const response = await request(app).post("/media/items/3/record-publication")
      .send({ url: "https://www.instagram.com/p/example" });
    expect(response.status).toBe(409);
    expect(state.sends).toBe(0);
  });

  it("does not let reviewers bypass founder approval for real content", async () => {
    state.item = { id: 3, status: "approved", pilotType: "pilot_real", founderApprovedAt: new Date() };
    const response = await request(app).post("/media/items/3/publish");
    expect(response.status).toBe(403);
    expect(state.sends).toBe(0);
  });

  it("does not send an unapproved real item", async () => {
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-user";
    state.userId = "founder-user";
    state.staffRole = null;
    state.item = { id: 3, status: "draft", pilotType: "pilot_real", founderApprovedAt: null };
    const response = await request(app).post("/media/items/3/publish");
    expect(response.status).toBe(409);
    expect(state.sends).toBe(0);
  });

  it("records an approved real link as pending, then requires founder confirmation", async () => {
    state.item = { ...state.item, pilotType: "pilot_real" };
    const link = "https://www.instagram.com/p/real-post/";
    const record = await request(app).post("/media/items/3/record-publication")
      .send({ url: link, results: "Pilot tanıtımı" });
    expect(record.status).toBe(200);
    expect(record.body.status).toBe("publication_pending");
    expect(record.body.publishedAt).toBeNull();
    expect(state.sends).toBe(0);
    const denied = await request(app).post("/media/items/3/confirm-publication");
    expect(denied.status).toBe(403);
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID = "founder-user";
    state.userId = "founder-user";
    state.staffRole = null;
    const confirmed = await request(app).post("/media/items/3/confirm-publication");
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe("published");
    expect(confirmed.body.publicationUrl).toBe(link);
    expect(state.sends).toBe(0);
  });
});