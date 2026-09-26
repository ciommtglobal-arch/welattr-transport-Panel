import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  userId: null as string | null,
  active: null as number | null,
  documentSaved: false,
  businessProfileSaved: false,
  businessProfileOwner: null as string | null,
}));

const mockTables = vi.hoisted(() => ({
  staffUsersTable: {
    clerkUserId: "clerk_user_id",
    active: "active",
  },
  limitApplicationDocumentsTable: {
    objectPath: "object_path",
  },
  b2bBusinessProfilesTable: {
    verificationDocumentObjectPath: "verification_document_object_path",
    ownerClerkUserId: "owner_clerk_user_id",
  },
  mediaItemsTable: {
    objectPath: "media_object_path",
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
              : table === mockTables.b2bBusinessProfilesTable
                ? authState.businessProfileSaved
                  ? [
                      {
                        objectPath,
                        ownerClerkUserId: authState.businessProfileOwner,
                      },
                    ]
                  : []
                : table === mockTables.mediaItemsTable
                  ? []
              : table === mockTables.staffUsersTable && authState.active === 1
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
  b2bBusinessProfilesTable: mockTables.b2bBusinessProfilesTable,
  mediaItemsTable: mockTables.mediaItemsTable,
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
    authState.businessProfileSaved = false;
    authState.businessProfileOwner = null;
    vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "");
    getObjectEntityFile.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it("allows the allowlisted founder to download their own B2B verification document", async () => {
    authState.userId = "founder-user";
    authState.active = null;
    authState.documentSaved = false;
    authState.businessProfileSaved = true;
    authState.businessProfileOwner = "founder-user";
    vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "founder-user");
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
    expect(getObjectEntityFile).toHaveBeenCalledWith(objectPath);
  });

  it("denies the allowlisted founder another owner's B2B verification document", async () => {
    authState.userId = "founder-user";
    authState.active = null;
    authState.documentSaved = false;
    authState.businessProfileSaved = true;
    authState.businessProfileOwner = "another-founder";
    vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "founder-user");

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(403);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies the allowlisted founder access to limit application documents", async () => {
    authState.userId = "founder-user";
    authState.active = null;
    authState.documentSaved = true;
    vi.stubEnv("MMT_FOUNDER_REVIEWER_CLERK_USER_ID", "founder-user");

    const response = await request(app)
      .post("/storage/objects/request-download-url")
      .send({ objectPath });

    expect(response.status).toBe(403);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
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
