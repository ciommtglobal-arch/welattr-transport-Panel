-- Additive safety fields for idempotent Gemini review tasks.
-- Deliberately not run by application startup. Review the exact target branch,
-- verify its backup, and obtain CIO approval before applying this migration.

ALTER TABLE public.ai_tasks
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE public.ai_tasks
  DROP CONSTRAINT IF EXISTS ai_tasks_status_check;

ALTER TABLE public.ai_tasks
  ADD CONSTRAINT ai_tasks_status_check
  CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNKNOWN_OUTCOME'));

CREATE UNIQUE INDEX IF NOT EXISTS ai_tasks_source_idempotency_uidx
  ON public.ai_tasks (source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
