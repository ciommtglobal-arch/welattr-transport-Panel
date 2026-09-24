import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get(["/", "/healthz"], async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (error) {
    req.log.error(
      { errorType: error instanceof Error ? error.name : "unknown" },
      "API readiness check failed",
    );
    res.status(503).json({ error: "API is not ready." });
  }
});

export default router;
