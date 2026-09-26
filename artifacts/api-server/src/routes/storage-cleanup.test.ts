import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "clerk-user-1",
  role: "admin" as "admin" | "operations" | "reviewer",
  references: [] as string[],
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
  },
  b2bListingsTable: {
    imageObjectPath: "image_object_path",
  },
  mediaItemsTable: {
    objectPath: "media_object_path",
  },
}));

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(() => ({ userId: state.userId })),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows =
            table === mockTables.limitApplicationDocumentsTable
              ? state.references.map((objectPath) => ({ objectPath }))
              : table === mockTables.b2bBusinessProfilesTable ||
                  table === mockTables.b2bListingsTable ||
                  table === mockTables.mediaItemsTable
                ? []
              : [
                  {
                    id: 1,
                    clerkUserId: state.userId,
                    email: "staff@example.com",
                    role: state.role,
                    active: 1,
                  },
                ];

          return {
            limit: async () => rows,
            then: (
              resolve: (value: typeof rows) => unknown,
              reject: (reason: unknown) => unknown,
            ) => Promise.resolve(rows).then(resolve, reject),
          };
        },
      }),
    }),
  },
  staffUsersTable: mockTables.staffUsersTable,
  limitApplicationDocumentsTable: mockTables.limitApplicationDocumentsTable,
  b2bBusinessProfilesTable: mockTables.b2bBusinessProfilesTable,
  b2bListingsTable: mockTables.b2bListingsTable,
  mediaItemsTable: mockTables.mediaItemsTable,
}));

import { ObjectStorageService } from "../lib/objectStorage";
import storageRouter from "./storage";

const app = express();
app.use(express.json());
app.use(storageRouter);

const oldOrphanPath = "/objects/uploads/old-orphan";
const recentOrphanPath = "/objects/uploads/recent-orphan";
const referencedPath = "/objects/uploads/referenced";
const objects = [
  {
    file: { name: "uploads/old-orphan" } as never,
    objectPath: oldOrphanPath,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    size: 100,
  },
  {
    file: { name: "uploads/recent-orphan" } as never,
    objectPath: recentOrphanPath,
    createdAt: new Date("2026-09-02T11:30:00.000Z"),
    size: 200,
  },
  {
    file: { name: "uploads/referenced" } as never,
    objectPath: referencedPath,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    size: 300,
  },
];

describe("orphan upload cleanup", () => {
  const listObjectEntityFiles = vi.spyOn(
    ObjectStorageService.prototype,
    "listObjectEntityFiles",
  );
  const deleteObjectEntityFile = vi.spyOn(
    ObjectStorageService.prototype,
    "deleteObjectEntityFile",
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    state.userId = "clerk-user-1";
    state.role = "admin";
    state.references = [referencedPath];
    listObjectEntityFiles.mockReset().mockResolvedValue(objects);
    deleteObjectEntityFile.mockReset().mockResolvedValue(undefined);
    delete process.env.ORPHAN_UPLOAD_RETENTION_HOURS;
  });

  it("only allows admin and operations staff to run cleanup", async () => {
    state.role = "reviewer";

    const response = await request(app)
      .post("/storage/uploads/cleanup-orphans")
      .send({ dryRun: true });

    expect(response.status).toBe(403);
    expect(listObjectEntityFiles).not.toHaveBeenCalled();
  });

  it("rejects an invalid dry-run value instead of defaulting to deletion", async () => {
    const response = await request(app)
      .post("/storage/uploads/cleanup-orphans")
      .send({ dryRun: "true" });

    expect(response.status).toBe(400);
    expect(listObjectEntityFiles).not.toHaveBeenCalled();
    expect(deleteObjectEntityFile).not.toHaveBeenCalled();
  });

  it("reports eligible orphan objects without deleting in dry-run mode", async () => {
    const response = await request(app)
      .post("/storage/uploads/cleanup-orphans")
      .send({ dryRun: true });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      dryRun: true,
      retentionHours: 24,
      scannedObjects: 3,
      referencedObjects: 1,
      orphanedObjects: 2,
      eligibleObjects: 1,
      eligibleObjectPaths: [oldOrphanPath],
      deletedObjectPaths: [],
    });
    expect(deleteObjectEntityFile).not.toHaveBeenCalled();
  });

  it("refuses real deletion until the owner reviews the dry-run report", async () => {
    const response = await request(app)
      .post("/storage/uploads/cleanup-orphans")
      .send();

    expect(response.status).toBe(423);
    expect(listObjectEntityFiles).not.toHaveBeenCalled();
    expect(deleteObjectEntityFile).not.toHaveBeenCalled();
  });
});
