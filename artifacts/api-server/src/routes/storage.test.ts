import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  userId: null as string | null,
  active: null as number | null,
  documentSaved: false,
}));

const mockTables = vi.hoisted(() => ({
  staffUsersTable: {
    clerkUserId: "clerk_user_id",
    active: "active",
  },
  limitApplicationDocumentsTable: {
    objectPath: "object_path",
  },
}));

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(() => ({ userId: authState.userId })),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () =>
            table === mockTables.limitApplicationDocumentsTable
              ? authState.documentSaved
                ? [{ objectPath }]
                : []
              : authState.active === 1
                ? [
                    {
                      id: 1,
                      clerkUserId: authState.userId,
                      email: "staff@example.com",
                      role: "reviewer",
                      active: 1,
                    },
                  ]
                : [],
        }),
      }),
    }),
  },
  staffUsersTable: mockTables.staffUsersTable,
  limitApplicationDocumentsTable: mockTables.limitApplicationDocumentsTable,
}));

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import storageRouter from "./storage";

const app = express();
app.use(express.json());
app.use(storageRouter);

const objectPath = "/objects/uploads/document-123";
const existingFile = {
  bucket: { name: "private-bucket" },
  name: "uploads/document-123",
} as never;

describe("secure document download URLs", () => {
  const getObjectEntityFile = vi.spyOn(
    ObjectStorageService.prototype,
    "getObjectEntityFile",
  );
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    authState.userId = "clerk-user-1";
    authState.active = 1;
    authState.documentSaved = true;
    getObjectEntityFile.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns 401 for unauthenticated requests without touching storage", async () => {
    authState.userId = null;
    authState.active = null;

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(401);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the user has no staff record", async () => {
    authState.active = null;

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(403);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the staff record is inactive", async () => {
    authState.active = 0;

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(403);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 and does not inspect storage for an orphaned object path", async () => {
    authState.documentSaved = false;

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Belge bulunamadı.");
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a short-lived GET URL to active staff for an existing document", async () => {
    getObjectEntityFile.mockResolvedValue(existingFile);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ signed_url: "https://signed.example/doc" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(200);
    expect(response.body.downloadURL).toBe("https://signed.example/doc");
    expect(response.body.expiresAt).toBe("2026-09-02T12:05:00.000Z");
    expect(getObjectEntityFile).toHaveBeenCalledWith(objectPath);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      bucket_name: "private-bucket",
      object_name: "uploads/document-123",
      method: "GET",
      expires_at: "2026-09-02T12:05:00.000Z",
    });
  });

  it("rejects invalid object paths before signing", async () => {
    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath: "/objects/uploads/../private-document" });

    expect(response.status).toBe(400);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 and does not sign a missing object", async () => {
    getObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
