import { randomUUID } from "node:crypto";
import { File, Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  private getPrivateObjectDir() {
    const directory = process.env.PRIVATE_OBJECT_DIR;
    if (!directory) {
      throw new Error("PRIVATE_OBJECT_DIR is not configured.");
    }
    return directory;
  }

  async getObjectEntityUploadURL() {
    const fullPath = `${this.getPrivateObjectDir()}/uploads/${randomUUID()}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket_name: bucketName,
          object_name: objectName,
          method: "PUT",
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to sign object URL: ${response.status}`);
    }

    const data = (await response.json()) as { signed_url: string };
    return data.signed_url;
  }

  async getObjectEntityDownloadURL(objectPath: string, ttlSec = 5 * 60) {
    const file = await this.getObjectEntityFile(objectPath);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket_name: file.bucket.name,
          object_name: file.name,
          method: "GET",
          expires_at: expiresAt.toISOString(),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to sign object URL: ${response.status}`);
    }

    const data = (await response.json()) as { signed_url: string };
    return {
      downloadURL: data.signed_url,
      expiresAt: expiresAt.toISOString(),
    };
  }

  normalizeObjectEntityPath(rawPath: string) {
    const url = new URL(rawPath);
    const privateDirectory = `${this.getPrivateObjectDir().replace(/\/$/, "")}/`;
    const rawObjectPath = url.pathname;

    if (!rawObjectPath.startsWith(privateDirectory)) {
      throw new Error("Object path is outside the private upload directory.");
    }

    return `/objects/${rawObjectPath.slice(privateDirectory.length)}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!/^\/objects\/uploads\/[a-zA-Z0-9-]+$/.test(objectPath)) {
      throw new ObjectNotFoundError();
    }

    const objectEntityPath = `${this.getPrivateObjectDir().replace(/\/$/, "")}/${objectPath.slice("/objects/".length)}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return file;
  }
}

function parseObjectPath(path: string) {
  const pathParts = `/${path}`.replace(/^\/+/, "/").split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid object storage path.");
  }

  return {
    bucketName: pathParts[1],
    objectName: pathParts.slice(2).join("/"),
  };
}
