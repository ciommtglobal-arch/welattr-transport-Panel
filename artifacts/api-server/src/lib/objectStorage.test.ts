import { beforeEach, describe, expect, it, vi } from "vitest";

const storageState = vi.hoisted(() => ({
  bucket: vi.fn(),
  getFiles: vi.fn(),
}));

vi.mock("@google-cloud/storage", () => ({
  File: class File {},
  Storage: class Storage {
    bucket(name: string) {
      return storageState.bucket(name);
    }
  },
}));

import { ObjectStorageService } from "./objectStorage";

describe("ObjectStorageService upload listing", () => {
  const service = new ObjectStorageService();

  beforeEach(() => {
    process.env.PRIVATE_OBJECT_DIR = "/private-bucket/private-documents";
    storageState.bucket.mockReturnValue({
      getFiles: storageState.getFiles,
    });
    storageState.getFiles.mockReset();
  });

  it("lists uploads below a private prefix with canonical document paths", async () => {
    const oldFile = {
      name: "private-documents/uploads/old-upload",
      getMetadata: vi.fn().mockResolvedValue([
        {
          timeCreated: "2026-09-01T00:00:00.000Z",
          size: "128",
        },
      ]),
    };
    const recentFile = {
      name: "private-documents/uploads/recent-upload",
      getMetadata: vi.fn().mockResolvedValue([
        {
          timeCreated: "2026-09-02T11:30:00.000Z",
          size: "256",
        },
      ]),
    };
    const ignoredFile = {
      name: "private-documents/uploads/nested/ignored",
      getMetadata: vi.fn(),
    };
    storageState.getFiles.mockResolvedValue([
      [oldFile, recentFile, ignoredFile],
      {},
    ]);

    const entries = await service.listObjectEntityFiles();

    expect(storageState.bucket).toHaveBeenCalledWith("private-bucket");
    expect(storageState.getFiles).toHaveBeenCalledWith({
      prefix: "private-documents/uploads/",
    });
    expect(entries).toEqual([
      {
        file: oldFile,
        objectPath: "/objects/uploads/old-upload",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        size: 128,
      },
      {
        file: recentFile,
        objectPath: "/objects/uploads/recent-upload",
        createdAt: new Date("2026-09-02T11:30:00.000Z"),
        size: 256,
      },
    ]);
    expect(ignoredFile.getMetadata).not.toHaveBeenCalled();
  });

  it("deletes a listed object through the storage client", async () => {
    const file = { delete: vi.fn().mockResolvedValue([]) };

    await service.deleteObjectEntityFile(file as never);

    expect(file.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
});
