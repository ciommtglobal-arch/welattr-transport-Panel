import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, logError } = vi.hoisted(() => ({
  query: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@workspace/db", () => ({ pool: { query } }));

import healthRouter from "./health";

const app = express();
app.use((req, _res, next) => {
  req.log = { error: logError } as unknown as typeof req.log;
  next();
});
app.use("/api", healthRouter);

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
});

describe("public API health checks", () => {
  it("checks the database and returns the requested health format without login", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "healthy", code: 200 });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it.each(["/api", "/api/healthz"])("preserves the existing response at %s", async (path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it.each(["/api", "/api/healthz", "/api/health"])(
    "returns 503 rather than a false healthy result at %s when the database fails",
    async (path) => {
      query.mockRejectedValueOnce(new Error("Private connection failure details"));
      const response = await request(app).get(path);
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "API is not ready." });
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(logError).toHaveBeenCalledWith(
        { errorType: "Error" },
        "API readiness check failed",
      );
    },
  );
});