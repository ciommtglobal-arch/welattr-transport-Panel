-- Shared MMT / WelatTR task and append-only memory layer.
-- Additive only. This file is deliberately not executed by application startup.
-- Review the target database, verify a backup, and obtain CIO approval before applying.

CREATE TABLE IF NOT EXISTS public.ai_tasks (
  task_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  assigned_agent TEXT NOT NULL DEFAULT 'gemini',
  task_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  result TEXT,
  error_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_tasks_queue_idx
  ON public.ai_tasks (assigned_agent, status, created_at);
CREATE INDEX IF NOT EXISTS ai_tasks_created_at_idx
  ON public.ai_tasks (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_task_events (
  event_id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.ai_tasks(task_id),
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_task_events_task_idx
  ON public.ai_task_events (task_id, created_at);

CREATE TABLE IF NOT EXISTS public.ai_memory_entries (
  memory_id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  source_record_id TEXT,
  record_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_source_record_uidx
  ON public.ai_memory_entries (source, source_record_id)
  WHERE source_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_memory_recorded_at_idx
  ON public.ai_memory_entries (recorded_at DESC);
CREATE INDEX IF NOT EXISTS ai_memory_search_idx
  ON public.ai_memory_entries
  USING GIN (to_tsvector('simple', COALESCE(subject, '') || ' ' || content));
