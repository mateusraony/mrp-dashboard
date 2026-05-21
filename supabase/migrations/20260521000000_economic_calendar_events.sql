-- Cria tabela economic_calendar_events para eventos do Investing.com (3 estrelas apenas)
-- Idempotente. Usa service_role para escrita, leitura pública.
-- Migration: 20260521000000_economic_calendar_events.sql

CREATE TABLE IF NOT EXISTS public.economic_calendar_events (
  id              text        PRIMARY KEY,  -- 'inv_<event_attr_id>_<YYYYMMDD>'
  source          text        NOT NULL DEFAULT 'investing.com',
  event_id        text,
  country         text,
  currency        text,
  title           text        NOT NULL,
  datetime_utc    timestamptz NOT NULL,
  datetime_brt    text,                     -- ISO com offset -03:00
  importance      smallint    NOT NULL DEFAULT 3,
  actual          text,
  forecast        text,
  previous        text,
  unit            text,
  status          text        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled', 'released', 'revised', 'failed')),
  ai_analysis     text,
  ai_probability  numeric,
  ai_direction    text        CHECK (ai_direction IN ('up', 'down', 'neutral')),
  notify_state    text        CHECK (notify_state IN ('pending', 'pre_sent', 'post_sent')),
  raw_payload     jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  source_url      text        DEFAULT 'https://br.investing.com/economic-calendar',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eco_calendar_datetime_idx ON public.economic_calendar_events (datetime_utc DESC);
CREATE INDEX IF NOT EXISTS eco_calendar_currency_idx ON public.economic_calendar_events (currency);
CREATE INDEX IF NOT EXISTS eco_calendar_status_idx   ON public.economic_calendar_events (status);
CREATE INDEX IF NOT EXISTS eco_calendar_notify_idx   ON public.economic_calendar_events (notify_state, datetime_utc);

-- RLS
ALTER TABLE public.economic_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eco_calendar_public_select" ON public.economic_calendar_events;
CREATE POLICY "eco_calendar_public_select"
  ON public.economic_calendar_events
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "eco_calendar_service_insert" ON public.economic_calendar_events;
CREATE POLICY "eco_calendar_service_insert"
  ON public.economic_calendar_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "eco_calendar_service_update" ON public.economic_calendar_events;
CREATE POLICY "eco_calendar_service_update"
  ON public.economic_calendar_events
  FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "eco_calendar_service_delete" ON public.economic_calendar_events;
CREATE POLICY "eco_calendar_service_delete"
  ON public.economic_calendar_events
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Trigger para atualizar updated_at automaticamente
-- Usa a função set_updated_at() que já existe no banco
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'eco_calendar_updated_at'
      AND tgrelid = 'public.economic_calendar_events'::regclass
  ) THEN
    CREATE TRIGGER eco_calendar_updated_at
      BEFORE UPDATE ON public.economic_calendar_events
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
