import { Router, type IRouter } from "express";
import { HealthCheckResponse, SystemHealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get(["/", "/healthz", "/health"], async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    await pool.query("SELECT 1");
    res.json(
      req.path === "/health"
        ? SystemHealthCheckResponse.parse({ status: "healthy", code: 200 })
        : HealthCheckResponse.parse({ status: "ok" }),
    );
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "API readiness check failed",
    );
    res.status(503).json({ error: "API is not ready." });
  }
});

export default router;
