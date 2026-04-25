-- ════════════════════════════════════════════════════════════════
-- sql-migration.sql — MacroCalendar Production Hardening
-- Execute no SQL Editor do Supabase (em partes separadas)
-- URL: https://supabase.com/dashboard/project/gvhkjfsngxrnjavstsju/sql/new
-- ════════════════════════════════════════════════════════════════
--
-- PARTE 1 — Criar tabelas novas (cole e clique Run)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.macro_alert_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sentinel         uuid NOT NULL,
  event_code            text NOT NULL,
  alert_enabled         boolean NOT NULL DEFAULT false,
  alert_minutes_before  integer NOT NULL DEFAULT 30
                        CHECK (alert_minutes_before BETWEEN 5 AND 1440),
  channels              text[] NOT NULL DEFAULT '{"telegram"}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_sentinel, event_code)
);

CREATE TABLE IF NOT EXISTS public.telegram_delivery_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key     text NOT NULL,
  event_code       text,
  release_time_utc timestamptz,
  window_label     text,
  chat_id          text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed','skipped')),
  telegram_msg_id  integer,
  error_message    text,
  telegram_status  integer,
  latency_ms       integer,
  payload_preview  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_key)
);

CREATE TABLE IF NOT EXISTS public.system_job_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        text NOT NULL,
  correlation_id  text NOT NULL DEFAULT gen_random_uuid()::text,
  status          text NOT NULL DEFAULT 'started'
                  CHECK (status IN ('started','success','partial','error')),
  events_found    integer,
  events_updated  integer,
  alerts_sent     integer,
  error_message   text,
  duration_ms     integer,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════
-- PARTE 2 — RLS nas novas tabelas (cole e clique Run)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.macro_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_delivery_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_job_log          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macro_alert_prefs: select" ON public.macro_alert_preferences;
DROP POLICY IF EXISTS "macro_alert_prefs: insert" ON public.macro_alert_preferences;
DROP POLICY IF EXISTS "macro_alert_prefs: update" ON public.macro_alert_preferences;
CREATE POLICY "macro_alert_prefs: select" ON public.macro_alert_preferences FOR SELECT USING (true);
CREATE POLICY "macro_alert_prefs: insert" ON public.macro_alert_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "macro_alert_prefs: update" ON public.macro_alert_preferences FOR UPDATE USING (true);

DROP POLICY IF EXISTS "tg_delivery: select" ON public.telegram_delivery_log;
DROP POLICY IF EXISTS "tg_delivery: insert" ON public.telegram_delivery_log;
DROP POLICY IF EXISTS "tg_delivery: update" ON public.telegram_delivery_log;
CREATE POLICY "tg_delivery: select" ON public.telegram_delivery_log FOR SELECT USING (true);
CREATE POLICY "tg_delivery: insert" ON public.telegram_delivery_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "tg_delivery: update" ON public.telegram_delivery_log FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "sys_job_log: select" ON public.system_job_log;
DROP POLICY IF EXISTS "sys_job_log: insert" ON public.system_job_log;
CREATE POLICY "sys_job_log: select" ON public.system_job_log FOR SELECT USING (true);
CREATE POLICY "sys_job_log: insert" ON public.system_job_log FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- PARTE 3 — Views de monitoramento (cole e clique Run)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_job_health AS
SELECT
  job_name,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE status = 'error')   AS error_count,
  MAX(created_at)                            AS last_run_at,
  ROUND(AVG(duration_ms))                    AS avg_duration_ms
FROM public.system_job_log
WHERE created_at >= now() - interval '7 days'
GROUP BY job_name ORDER BY job_name;

CREATE OR REPLACE VIEW public.v_macro_actual_pending AS
SELECT id, event_code, release_time_utc, actual, status
FROM public.macro_event_schedule
WHERE actual IS NULL
  AND release_time_utc <= now() - interval '2 hours'
ORDER BY release_time_utc DESC;

-- Confirmar criacao das tabelas (deve retornar 3 linhas):
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('macro_alert_preferences','telegram_delivery_log','system_job_log');

-- ════════════════════════════════════════════════════════════════
-- PARTE 4 — pg_cron (cole e clique Run — somente APÓS deploy das Edge Functions)
-- Substitua <SEU_PROJECT_REF> pelo ref do seu projeto Supabase
-- Encontre em: Settings > General > Reference ID
-- ════════════════════════════════════════════════════════════════

-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- ALTER DATABASE postgres SET app.supabase_url = 'https://<SEU_PROJECT_REF>.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = '<COLE_SUA_SERVICE_ROLE_KEY_AQUI>';
--
-- SELECT cron.schedule('macro-actual-fetcher', '*/15 * * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/macro-actual-fetcher',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || current_setting('app.service_role_key')),
--     body := '{}'::jsonb)$$);
--
-- SELECT cron.schedule('macro-alert-worker', '*/5 * * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/macro-alert-worker',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || current_setting('app.service_role_key')),
--     body := '{}'::jsonb)$$);
--
-- SELECT cron.schedule('send-telegram-digest', '0 11 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/send-telegram-digest',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || current_setting('app.service_role_key')),
--     body := '{}'::jsonb)$$);
