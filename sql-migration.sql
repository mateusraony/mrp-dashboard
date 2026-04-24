-- ════════════════════════════════════════════════
-- PARTE 1 DE 2: Cole isso no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/gvhkjfsngxrnjavstsju/sql/new
-- Clique em "Run" depois de colar
-- ════════════════════════════════════════════════

ALTER TABLE public.macro_event_schedule
  ADD COLUMN IF NOT EXISTS actual_source        text,
  ADD COLUMN IF NOT EXISTS actual_updated_at    timestamptz,
  ADD COLUMN IF NOT EXISTS is_revised           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count          smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error           text;

CREATE TABLE IF NOT EXISTS public.macro_alert_preferences (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sentinel         uuid        NOT NULL,
  event_code            text        NOT NULL,
  alert_enabled         boolean     NOT NULL DEFAULT false,
  alert_minutes_before  integer     NOT NULL DEFAULT 30 CHECK (alert_minutes_before BETWEEN 5 AND 1440),
  channels              text[]      NOT NULL DEFAULT '{"telegram"}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_sentinel, event_code)
);

CREATE INDEX IF NOT EXISTS macro_alert_prefs_sentinel_idx ON public.macro_alert_preferences (user_sentinel);
CREATE INDEX IF NOT EXISTS macro_alert_prefs_enabled_idx  ON public.macro_alert_preferences (alert_enabled) WHERE alert_enabled = true;

DROP TRIGGER IF EXISTS macro_alert_prefs_updated_at ON public.macro_alert_preferences;
CREATE TRIGGER macro_alert_prefs_updated_at
  BEFORE UPDATE ON public.macro_alert_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.telegram_delivery_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_key     text        NOT NULL,
  event_code       text,
  release_time_utc timestamptz,
  window_label     text,
  chat_id          text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  telegram_msg_id  integer,
  error_message    text,
  telegram_status  integer,
  latency_ms       integer,
  payload_preview  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_key)
);

CREATE TABLE IF NOT EXISTS public.system_job_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        text        NOT NULL,
  correlation_id  text        NOT NULL DEFAULT gen_random_uuid()::text,
  status          text NOT NULL DEFAULT 'started' CHECK (status IN ('started','success','partial','error')),
  events_found    integer,
  events_updated  integer,
  alerts_sent     integer,
  error_message   text,
  duration_ms     integer,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tg_delivery_status_idx ON public.telegram_delivery_log (status);
CREATE INDEX IF NOT EXISTS sys_job_log_name_idx   ON public.system_job_log (job_name, created_at DESC);

-- RLS nas novas tabelas
ALTER TABLE public.macro_alert_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_delivery_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_job_log           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "macro_alert_prefs: leitura publica"  ON public.macro_alert_preferences FOR SELECT USING (true);
CREATE POLICY "macro_alert_prefs: insercao anon"    ON public.macro_alert_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "macro_alert_prefs: atualizacao anon" ON public.macro_alert_preferences FOR UPDATE USING (true);

CREATE POLICY "tg_delivery: leitura publica"        ON public.telegram_delivery_log FOR SELECT USING (true);
CREATE POLICY "tg_delivery: insercao service_role"  ON public.telegram_delivery_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "tg_delivery: atualizacao service_role" ON public.telegram_delivery_log FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "sys_job_log: leitura publica"        ON public.system_job_log FOR SELECT USING (true);
CREATE POLICY "sys_job_log: insercao service_role"  ON public.system_job_log FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE VIEW public.v_job_health AS
SELECT
  job_name,
  COUNT(*)                                          AS total_runs,
  COUNT(*) FILTER (WHERE status = 'success')        AS success_count,
  COUNT(*) FILTER (WHERE status = 'error')          AS error_count,
  MAX(created_at)                                   AS last_run_at,
  MAX(created_at) FILTER (WHERE status = 'success') AS last_success_at,
  ROUND(AVG(duration_ms))                           AS avg_duration_ms
FROM public.system_job_log
WHERE created_at >= now() - interval '7 days'
GROUP BY job_name ORDER BY job_name;

CREATE OR REPLACE VIEW public.v_macro_actual_pending AS
SELECT s.id, s.event_code, s.release_time_utc, s.actual, s.retry_count, s.last_error,
       c.fred_series, c.name AS event_name
FROM public.macro_event_schedule s
JOIN public.macro_event_catalog  c ON c.code = s.event_code
WHERE s.actual IS NULL
  AND s.release_time_utc <= now() - interval '2 hours'
  AND s.retry_count < 5
ORDER BY s.release_time_utc DESC;

-- ════════════════════════════════════════════════
-- PARTE 2 DE 2: Cole isso em uma NOVA query no SQL Editor
-- (Settings > Database > Service Role Key para pegar a chave)
-- ════════════════════════════════════════════════

-- Habilita extensoes (necessario para pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Substitua os valores abaixo antes de executar:
ALTER DATABASE postgres SET app.supabase_url = 'https://gvhkjfsngxrnjavstsju.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aGtqZnNuZ3hybmphdnN0c2p1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzOTIxNCwiZXhwIjoyMDkxNTE1MjE0fQ.XNiyuUVUP_s2Qvrr0O_Xoy5Lti05M7fivcc_7fb9upI';

-- Cria os 3 jobs automaticos
SELECT cron.schedule('macro-actual-fetcher', '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/macro-actual-fetcher',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb)$$);

SELECT cron.schedule('macro-alert-worker', '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/macro-alert-worker',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb)$$);

SELECT cron.schedule('send-telegram-digest', '0 11 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-telegram-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb)$$);

-- Confirma jobs criados
SELECT jobname, schedule, active FROM cron.job;
