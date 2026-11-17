import express, { type Request, type Response } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";

const SOURCES = new Set(["chatgpt", "welattr", "gemini", "telegram", "shopify", "mmt", "manual", "system"]);
const TASK_STATUSES = new Set(["QUEUED", "PROCESSING", "COMPLETED", "FAILED"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const router = express.Router();

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function positiveLimit(value: unknown, fallback: number, maximum: number): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

router.use((req, res, next) => {
  const expected = process.env.MMT_AI_BRIDGE_TOKEN;
  const authorization = req.headers.authorization;
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected) return res.status(503).json({ error: "AI bridge is not configured." });
  if (!safeEqual(supplied, expected)) return res.status(401).json({ error: "Unauthorized" });
  return next();
});

router.get("/health", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        to_regclass('public.ai_tasks') AS tasks,
        to_regclass('public.ai_task_events') AS events,
        to_regclass('public.ai_memory_entries') AS memory
    `);
    const tables = result.rows[0] ?? {};
    const schemaReady = Boolean(tables.tasks && tables.events && tables.memory);
    return res.status(schemaReady ? 200 : 503).json({
      status: schemaReady ? "ready" : "migration_required",
      database: true,
      schema: {
        tasks: Boolean(tables.tasks),
        events: Boolean(tables.events),
        memory: Boolean(tables.memory),
      },
      gemini: {
        apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
        workerEnabled: process.env.GEMINI_TASK_WORKER_ENABLED === "true"
          && process.env.GEMINI_FREE_TIER_ONLY_CONFIRMED === "true"
          && Boolean(process.env.GEMINI_API_KEY?.trim()),
        workerCallsPer24Hours: 1,
      },
    });
  } catch {
    return res.status(503).json({ status: "unavailable", database: false });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  const body: unknown = req.body;
  if (!isRecord(body)
    || typeof body.source !== "string" || !SOURCES.has(body.source)
    || typeof body.task_type !== "string" || !body.task_type.trim() || body.task_type.length > 80
    || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 12_000
    || (body.assigned_agent !== undefined && body.assigned_agent !== "gemini")
    || (body.context !== undefined && !isRecord(body.context))) {
    return res.status(400).json({ error: "Invalid task payload." });
  }

  const context = (body.context ?? {}) as Record<string, unknown>;
  let contextText: string;
  try {
    contextText = JSON.stringify(context);
    if (contextText.length > 32_000) return res.status(400).json({ error: "Task context is too large." });
  } catch {
    return res.status(400).json({ error: "Task context is invalid." });
  }

  const taskId = randomUUID();
  const source = body.source;
  const taskType = body.task_type.trim();
  const prompt = body.prompt.trim();
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO public.ai_tasks
          (task_id, source, assigned_agent, task_type, prompt, context, status)
        VALUES ($1::uuid, $2, 'gemini', $3, $4, $5::jsonb, 'QUEUED')
      `, [taskId, source, taskType, prompt, contextText]);
      await client.query(`
        INSERT INTO public.ai_task_events (event_id, task_id, actor, event_type, details)
        VALUES ($1::uuid, $2::uuid, $3, 'TASK_CREATED', $4::jsonb)
      `, [randomUUID(), taskId, source, JSON.stringify({ task_type: taskType, assigned_agent: "gemini" })]);
      await client.query("COMMIT");
      return res.status(201).json({ task_id: taskId, status: "QUEUED", assigned_agent: "gemini" });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(503).json({ error: "Task could not be stored." });
    } finally {
      client.release();
    }
  } catch {
    return res.status(503).json({ error: "Task could not be stored." });
  }
});

router.get("/tasks", async (req, res) => {
  const rawStatus = req.query.status;
  const status = typeof rawStatus === "string" ? rawStatus.toUpperCase() : null;
  if (status && !TASK_STATUSES.has(status)) return res.status(400).json({ error: "Invalid task status." });
  const limit = positiveLimit(req.query.limit, 25, 100);
  try {
    const result = await pool.query(`
      SELECT task_id, source, assigned_agent, task_type, status, error_code,
             attempt_count, created_at, started_at, completed_at, updated_at
        FROM public.ai_tasks
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC
       LIMIT $2
    `, [status, limit]);
    return res.json({ tasks: result.rows });
  } catch {
    return res.status(503).json({ error: "Task records are unavailable." });
  }
});

router.get("/tasks/:taskId", async (req, res) => {
  if (!UUID_PATTERN.test(req.params.taskId)) return res.status(400).json({ error: "Invalid task ID." });
  try {
    const taskResult = await pool.query("SELECT * FROM public.ai_tasks WHERE task_id = $1::uuid", [req.params.taskId]);
    if (!taskResult.rows[0]) return res.status(404).json({ error: "Task not found." });
    const eventsResult = await pool.query(`
      SELECT event_id, actor, event_type, details, created_at
        FROM public.ai_task_events
       WHERE task_id = $1::uuid
       ORDER BY created_at
    `, [req.params.taskId]);
    return res.json({ task: taskResult.rows[0], events: eventsResult.rows });
  } catch {
    return res.status(503).json({ error: "Task history is unavailable." });
  }
});

router.post("/memory", async (req, res) => {
  const body: unknown = req.body;
  if (!isRecord(body)
    || typeof body.source !== "string" || !SOURCES.has(body.source)
    || typeof body.record_type !== "string" || !body.record_type.trim() || body.record_type.length > 80
    || typeof body.subject !== "string" || !body.subject.trim() || body.subject.length > 240
    || typeof body.content !== "string" || !body.content.trim() || body.content.length > 30_000
    || (body.source_record_id !== undefined && body.source_record_id !== null
      && (typeof body.source_record_id !== "string" || body.source_record_id.length > 200))
    || (body.metadata !== undefined && !isRecord(body.metadata))) {
    return res.status(400).json({ error: "Invalid memory entry." });
  }

  const metadata = (body.metadata ?? {}) as Record<string, unknown>;
  let metadataText: string;
  try {
    metadataText = JSON.stringify(metadata);
    if (metadataText.length > 32_000) return res.status(400).json({ error: "Memory metadata is too large." });
  } catch {
    return res.status(400).json({ error: "Memory metadata is invalid." });
  }

  const recordedAt = body.recorded_at === undefined ? new Date() : new Date(String(body.recorded_at));
  if (Number.isNaN(recordedAt.getTime())) return res.status(400).json({ error: "Invalid recorded_at timestamp." });

  try {
    const result = await pool.query(`
      INSERT INTO public.ai_memory_entries
        (memory_id, source, source_record_id, record_type, subject, content, metadata, recorded_at)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz)
      ON CONFLICT (source, source_record_id) WHERE source_record_id IS NOT NULL
      DO NOTHING
      RETURNING memory_id, source, source_record_id, record_type, subject, recorded_at, created_at
    `, [
      randomUUID(), body.source, body.source_record_id ?? null, body.record_type.trim(),
      body.subject.trim(), body.content.trim(), metadataText, recordedAt.toISOString(),
    ]);
    if (result.rows[0]) return res.status(201).json({ saved: true, duplicate: false, entry: result.rows[0] });
    const existing = await pool.query(`
      SELECT memory_id, source, source_record_id, record_type, subject, recorded_at, created_at
        FROM public.ai_memory_entries
       WHERE source = $1 AND source_record_id = $2
       LIMIT 1
    `, [body.source, body.source_record_id]);
    return res.status(200).json({ saved: true, duplicate: true, entry: existing.rows[0] ?? null });
  } catch {
    return res.status(503).json({ error: "Memory entry could not be stored." });
  }
});

router.get("/memory", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 300) : "";
  const limit = positiveLimit(req.query.limit, 15, 50);
  try {
    const result = query
      ? await pool.query(`
          SELECT memory_id, source, source_record_id, record_type, subject, content, metadata, recorded_at, created_at
            FROM public.ai_memory_entries
           WHERE to_tsvector('simple', COALESCE(subject, '') || ' ' || content)
                 @@ websearch_to_tsquery('simple', $1)
           ORDER BY ts_rank(
             to_tsvector('simple', COALESCE(subject, '') || ' ' || content),
             websearch_to_tsquery('simple', $1)
           ) DESC, recorded_at DESC
           LIMIT $2
        `, [query, limit])
      : await pool.query(`
          SELECT memory_id, source, source_record_id, record_type, subject, content, metadata, recorded_at, created_at
            FROM public.ai_memory_entries
           ORDER BY recorded_at DESC
           LIMIT $1
        `, [limit]);
    return res.json({ entries: result.rows });
  } catch {
    return res.status(503).json({ error: "Shared memory is unavailable." });
  }
});

export default router;
