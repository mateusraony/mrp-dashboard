-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 7.2 — System Logs (Debug Panel Persistence)
-- Persiste erros do DebugPanel no Supabase para análise e diagnóstico remoto.
-- Idempotente: seguro para re-aplicação.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.system_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text        NOT NULL CHECK (level IN ('error', 'warn', 'info')),
  message    text        NOT NULL,
  source     text,
  detail     text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_logs_level_idx      ON public.system_logs (level);
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_session_idx    ON public.system_logs (session_id);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_logs: leitura pública" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs: inserção pública" ON public.system_logs;

CREATE POLICY "system_logs: leitura pública"
  ON public.system_logs FOR SELECT USING (true);

CREATE POLICY "system_logs: inserção pública"
  ON public.system_logs FOR INSERT WITH CHECK (true);
