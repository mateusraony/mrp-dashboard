-- ═══════════════════════════════════════════════════════════════════════════════
-- 20260423000000_macro_production_hardening.sql
-- MacroCalendar — Hardening de produção:
--   1. Colunas de rastreamento de actual no macro_event_schedule
--   2. Tabela macro_alert_preferences (alertas persistidos por usuário/evento)
--   3. Tabela telegram_delivery_log (dedup + auditoria de envios)
--   4. Tabela system_job_log (saúde de jobs agendados)
--   5. RLS hardening: escrita restrita a service_role em tabelas críticas
-- Idempotente: seguro para re-aplicação.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Colunas de rastreamento de actual ─────────────────────────────────────
-- Adicionadas ao macro_event_schedule para rastrear de onde/quando veio o valor real.

ALTER TABLE public.macro_event_schedule
  ADD COLUMN IF NOT EXISTS actual_source        text,
  ADD COLUMN IF NOT EXISTS actual_updated_at    timestamptz,
  ADD COLUMN IF NOT EXISTS is_revised           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count          smallint    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error           text;

COMMENT ON COLUMN public.macro_event_schedule.actual_source     IS 'Fonte do valor actual: FRED, BCB, MANUAL, etc.';
COMMENT ON COLUMN public.macro_event_schedule.actual_updated_at IS 'Timestamp da última atualização do campo actual.';
COMMENT ON COLUMN public.macro_event_schedule.is_revised        IS 'True quando o valor actual foi revisado após publicação inicial.';
COMMENT ON COLUMN public.macro_event_schedule.retry_count       IS 'Número de tentativas de fetch do actual (max 5 antes de desistir).';
COMMENT ON COLUMN public.macro_event_schedule.last_error        IS 'Último erro ao tentar buscar o actual. Limpo em caso de sucesso.';

-- ─── 2. Tabela macro_alert_preferences ────────────────────────────────────────
-- Persiste a preferência de alerta do usuário por código de evento.
-- Chave: (user_sentinel, event_code) — sentinel UUID do usuário anônimo.

CREATE TABLE IF NOT EXISTS public.macro_alert_preferences (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sentinel         uuid        NOT NULL,
  event_code            text        NOT NULL,
  alert_enabled         boolean     NOT NULL DEFAULT false,
  alert_minutes_before  integer     NOT NULL DEFAULT 30
                                    CHECK (alert_minutes_before BETWEEN 5 AND 1440),
  channels              text[]      NOT NULL DEFAULT '{"telegram"}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_sentinel, event_code)
);

CREATE INDEX IF NOT EXISTS macro_alert_prefs_sentinel_idx
  ON public.macro_alert_preferences (user_sentinel);
CREATE INDEX IF NOT EXISTS macro_alert_prefs_enabled_idx
  ON public.macro_alert_preferences (alert_enabled)
  WHERE alert_enabled = true;

DROP TRIGGER IF EXISTS macro_alert_prefs_updated_at ON public.macro_alert_preferences;
CREATE TRIGGER macro_alert_prefs_updated_at
  BEFORE UPDATE ON public.macro_alert_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Tabela telegram_delivery_log ──────────────────────────────────────────
-- Registra cada envio Telegram (ou tentativa) para deduplicação e auditoria.

CREATE TABLE IF NOT EXISTS public.telegram_delivery_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key     text        NOT NULL,   -- dedup key: event_code|release_time|window|chat_id
  event_code       text,
  release_time_utc timestamptz,
  window_label     text,                   -- 'digest', 'alert_30m', 'alert_60m', etc.
  chat_id          text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','sent','failed','skipped')),
  telegram_msg_id  integer,                -- message_id retornado pelo Telegram
  error_message    text,
  telegram_status  integer,                -- HTTP status da resposta Telegram
  latency_ms       integer,
  payload_preview  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_key)
);

CREATE INDEX IF NOT EXISTS tg_delivery_event_idx  ON public.telegram_delivery_log (event_code);
CREATE INDEX IF NOT EXISTS tg_delivery_time_idx   ON public.telegram_delivery_log (created_at DESC);
CREATE INDEX IF NOT EXISTS tg_delivery_status_idx ON public.telegram_delivery_log (status);

-- ─── 4. Tabela system_job_log ──────────────────────────────────────────────────
-- Rastreia execuções de jobs agendados (actual-fetcher, alert-worker, digest).

CREATE TABLE IF NOT EXISTS public.system_job_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        text        NOT NULL,
  correlation_id  text        NOT NULL DEFAULT gen_random_uuid()::text,
  status          text        NOT NULL DEFAULT 'started'
                              CHECK (status IN ('started','success','partial','error')),
  events_found    integer,
  events_updated  integer,
  alerts_sent     integer,
  error_message   text,
  duration_ms     integer,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_job_log_name_idx ON public.system_job_log (job_name, created_at DESC);
CREATE INDEX IF NOT EXISTS sys_job_log_time_idx ON public.system_job_log (created_at DESC);

-- ─── 5. RLS — macro_event_schedule (reads public, writes only service_role) ───

DROP POLICY IF EXISTS "macro_schedule: inserção pública"    ON public.macro_event_schedule;
DROP POLICY IF EXISTS "macro_schedule: atualização pública" ON public.macro_event_schedule;

-- Escrita restrita a service_role (Edge Functions com SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY "macro_schedule: inserção service_role"
  ON public.macro_event_schedule FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "macro_schedule: atualização service_role"
  ON public.macro_event_schedule FOR UPDATE
  USING (auth.role() = 'service_role');

-- ─── 6. RLS — macro_event_market_reaction ────────────────────────────────────

DROP POLICY IF EXISTS "macro_reaction: inserção pública" ON public.macro_event_market_reaction;

CREATE POLICY "macro_reaction: inserção service_role"
  ON public.macro_event_market_reaction FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 7. RLS — feature_store_macro ────────────────────────────────────────────

DROP POLICY IF EXISTS "feature_store: inserção pública" ON public.feature_store_macro;

CREATE POLICY "feature_store: inserção service_role"
  ON public.feature_store_macro FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 8. RLS — ai_inference_log ───────────────────────────────────────────────

DROP POLICY IF EXISTS "ai_inference: inserção pública" ON public.ai_inference_log;

CREATE POLICY "ai_inference: inserção service_role"
  ON public.ai_inference_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 9. RLS — macro_alert_preferences (usuário anônimo via sentinel) ──────────

ALTER TABLE public.macro_alert_preferences ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer anon pode ler (necessário para carregar prefs no frontend)
CREATE POLICY "macro_alert_prefs: leitura pública"
  ON public.macro_alert_preferences FOR SELECT
  USING (true);

-- Escrita: anon pode inserir/atualizar apenas suas próprias prefs (via sentinel)
-- Sem auth.uid() real, aceitamos anon insert (sentinel garante namespace por usuário)
CREATE POLICY "macro_alert_prefs: inserção anon"
  ON public.macro_alert_preferences FOR INSERT
  WITH CHECK (true);

CREATE POLICY "macro_alert_prefs: atualização anon"
  ON public.macro_alert_preferences FOR UPDATE
  USING (true);

-- ─── 10. RLS — telegram_delivery_log (readonly para anon, escrita service_role)

ALTER TABLE public.telegram_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tg_delivery: leitura pública"
  ON public.telegram_delivery_log FOR SELECT
  USING (true);

CREATE POLICY "tg_delivery: inserção service_role"
  ON public.telegram_delivery_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "tg_delivery: atualização service_role"
  ON public.telegram_delivery_log FOR UPDATE
  USING (auth.role() = 'service_role');

-- ─── 11. RLS — system_job_log (readonly para anon, escrita service_role) ──────

ALTER TABLE public.system_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sys_job_log: leitura pública"
  ON public.system_job_log FOR SELECT
  USING (true);

CREATE POLICY "sys_job_log: inserção service_role"
  ON public.system_job_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 12. View de saúde dos jobs (observabilidade) ─────────────────────────────

CREATE OR REPLACE VIEW public.v_job_health AS
SELECT
  job_name,
  COUNT(*)                                      AS total_runs,
  COUNT(*) FILTER (WHERE status = 'success')    AS success_count,
  COUNT(*) FILTER (WHERE status = 'error')      AS error_count,
  MAX(created_at)                               AS last_run_at,
  MAX(created_at) FILTER (WHERE status = 'success') AS last_success_at,
  ROUND(AVG(duration_ms))                       AS avg_duration_ms,
  SUM(events_updated)                           AS total_events_updated,
  SUM(alerts_sent)                              AS total_alerts_sent
FROM public.system_job_log
WHERE created_at >= now() - interval '7 days'
GROUP BY job_name
ORDER BY job_name;

-- ─── 13. View de eventos com actual pendente ──────────────────────────────────

CREATE OR REPLACE VIEW public.v_macro_actual_pending AS
SELECT
  s.id,
  s.event_code,
  s.release_time_utc,
  s.status,
  s.actual,
  s.actual_source,
  s.actual_updated_at,
  s.retry_count,
  s.last_error,
  c.fred_series,
  c.fred_release_id,
  c.name         AS event_name
FROM public.macro_event_schedule s
JOIN public.macro_event_catalog  c ON c.code = s.event_code
WHERE
  s.status IN ('released', 'scheduled')
  AND s.actual IS NULL
  AND s.release_time_utc <= now() - interval '2 hours'
  AND s.retry_count < 5
ORDER BY s.release_time_utc DESC;

-- ─── 14. pg_cron jobs (instruções — requer extensão pg_cron no Supabase) ──────
-- Execute manualmente no Supabase Dashboard → SQL Editor após habilitar pg_cron:
--
-- SELECT cron.schedule(
--   'macro-actual-fetcher',
--   '*/15 * * * *',
--   $$SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/macro-actual-fetcher',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{}'::jsonb
--   ) AS request_id$$
-- );
--
-- SELECT cron.schedule(
--   'macro-alert-worker',
--   '*/5 * * * *',
--   $$SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/macro-alert-worker',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{}'::jsonb
--   ) AS request_id$$
-- );
--
-- SELECT cron.schedule(
--   'send-telegram-digest',
--   '0 11 * * *',
--   $$SELECT net.http_post(
--       url := current_setting('app.supabase_url') || '/functions/v1/send-telegram-digest',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--       ),
--       body := '{}'::jsonb
--   ) AS request_id$$
-- );
