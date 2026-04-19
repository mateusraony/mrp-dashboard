-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 7.3 — Macro Calendar Pipeline
-- Tabelas para pipeline bronze/silver de eventos macro com AI inference log.
-- Arquitetura: catalog → schedule → market_reaction → feature_store → ai_inference
-- Idempotente: seguro para re-aplicação.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── macro_event_catalog — dicionário mestre de tipos de eventos ───────────────
CREATE TABLE IF NOT EXISTS public.macro_event_catalog (
  code                text        PRIMARY KEY,   -- ex: 'US_CPI'
  name                text        NOT NULL,
  agency              text        NOT NULL,
  tier                smallint    NOT NULL CHECK (tier IN (1, 2)),
  fred_series         text,
  fred_release_id     integer,
  unit                text        NOT NULL DEFAULT '%',
  release_time_et     text        DEFAULT '08:30',
  description         text,
  btc_impact_hist_avg numeric     DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── macro_event_schedule — instâncias de eventos com horário e resultado ──────
CREATE TABLE IF NOT EXISTS public.macro_event_schedule (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code       text        NOT NULL REFERENCES public.macro_event_catalog(code),
  release_time_utc timestamptz NOT NULL,
  status           text        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled', 'released', 'revised', 'canceled')),
  previous         numeric,
  actual           numeric,
  consensus        numeric,
  unit             text,
  source           text,
  payload_hash     text,
  raw_payload      jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_code, release_time_utc)
);

CREATE INDEX IF NOT EXISTS macro_schedule_code_idx   ON public.macro_event_schedule (event_code);
CREATE INDEX IF NOT EXISTS macro_schedule_time_idx   ON public.macro_event_schedule (release_time_utc DESC);
CREATE INDEX IF NOT EXISTS macro_schedule_status_idx ON public.macro_event_schedule (status);

-- ─── macro_event_market_reaction — retorno BTC por janela pós-evento ──────────
CREATE TABLE IF NOT EXISTS public.macro_event_market_reaction (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid    NOT NULL REFERENCES public.macro_event_schedule(id),
  window_label text    NOT NULL,       -- '+5m', '+1h', '+4h', '+24h'
  btc_ret_pct  numeric,
  rv_pre       numeric,
  rv_post      numeric,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, window_label)
);

-- ─── feature_store_macro — features de modelagem para AI ──────────────────────
CREATE TABLE IF NOT EXISTS public.feature_store_macro (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid    NOT NULL REFERENCES public.macro_event_schedule(id),
  surprise_raw    numeric,
  surprise_z      numeric,
  regime          text,               -- 'hawkish', 'dovish', 'neutral'
  feature_version text    DEFAULT 'v1',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, feature_version)
);

-- ─── ai_inference_log — log completo de inferências AI ────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_inference_log (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid    REFERENCES public.macro_event_schedule(id),
  model_version   text,
  feature_version text,
  input_features  jsonb,
  prediction      text    CHECK (prediction IN ('up', 'down', 'flat')),
  confidence      numeric CHECK (confidence >= 0 AND confidence <= 1),
  explanation     text,
  outcome_actual  text    CHECK (outcome_actual IN ('up', 'down', 'flat', NULL)),
  feedback_score  numeric,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_inference_event_idx ON public.ai_inference_log (event_id);
CREATE INDEX IF NOT EXISTS ai_inference_time_idx  ON public.ai_inference_log (created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.macro_event_catalog        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_event_schedule       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_event_market_reaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_store_macro        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inference_log           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macro_catalog: leitura pública"    ON public.macro_event_catalog;
DROP POLICY IF EXISTS "macro_schedule: leitura pública"   ON public.macro_event_schedule;
DROP POLICY IF EXISTS "macro_schedule: inserção pública"  ON public.macro_event_schedule;
DROP POLICY IF EXISTS "macro_schedule: atualização pública" ON public.macro_event_schedule;
DROP POLICY IF EXISTS "macro_reaction: leitura pública"   ON public.macro_event_market_reaction;
DROP POLICY IF EXISTS "macro_reaction: inserção pública"  ON public.macro_event_market_reaction;
DROP POLICY IF EXISTS "feature_store: leitura pública"    ON public.feature_store_macro;
DROP POLICY IF EXISTS "feature_store: inserção pública"   ON public.feature_store_macro;
DROP POLICY IF EXISTS "ai_inference: leitura pública"     ON public.ai_inference_log;
DROP POLICY IF EXISTS "ai_inference: inserção pública"    ON public.ai_inference_log;

CREATE POLICY "macro_catalog: leitura pública"
  ON public.macro_event_catalog FOR SELECT USING (true);

CREATE POLICY "macro_schedule: leitura pública"
  ON public.macro_event_schedule FOR SELECT USING (true);

CREATE POLICY "macro_schedule: inserção pública"
  ON public.macro_event_schedule FOR INSERT WITH CHECK (true);

CREATE POLICY "macro_schedule: atualização pública"
  ON public.macro_event_schedule FOR UPDATE USING (true);

CREATE POLICY "macro_reaction: leitura pública"
  ON public.macro_event_market_reaction FOR SELECT USING (true);

CREATE POLICY "macro_reaction: inserção pública"
  ON public.macro_event_market_reaction FOR INSERT WITH CHECK (true);

CREATE POLICY "feature_store: leitura pública"
  ON public.feature_store_macro FOR SELECT USING (true);

CREATE POLICY "feature_store: inserção pública"
  ON public.feature_store_macro FOR INSERT WITH CHECK (true);

CREATE POLICY "ai_inference: leitura pública"
  ON public.ai_inference_log FOR SELECT USING (true);

CREATE POLICY "ai_inference: inserção pública"
  ON public.ai_inference_log FOR INSERT WITH CHECK (true);

-- ─── Trigger updated_at para macro_event_schedule ────────────────────────────
DROP TRIGGER IF EXISTS set_macro_schedule_updated_at ON public.macro_event_schedule;
CREATE TRIGGER set_macro_schedule_updated_at
  BEFORE UPDATE ON public.macro_event_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Seed: event catalog ──────────────────────────────────────────────────────
INSERT INTO public.macro_event_catalog
  (code, name, agency, tier, fred_series, fred_release_id, unit, release_time_et, description, btc_impact_hist_avg)
VALUES
  ('US_CPI',        'CPI (MoM)',                   'BLS',    1, 'CPIAUCSL',          10,  '%',  '08:30', 'Inflação ao consumidor. Mais impactante para o Fed e BTC.',    -2.5),
  ('US_NFP',        'Nonfarm Payrolls',             'BLS',    1, 'PAYEMS',            50,  'K',  '08:30', 'Empregos não-agrícolas criados. Indicador líder do emprego.',  -1.8),
  ('US_UNEMPLOYMENT','Unemployment Rate',           'BLS',    2, 'UNRATE',            50,  '%',  '08:30', 'Taxa de desemprego. Publicado junto com NFP.',                  0.8),
  ('US_FOMC',       'FOMC Interest Rate Decision',  'Fed',    1, 'FEDFUNDS',          NULL,'%',  '14:00', 'Decisão de juros do Federal Reserve. Maior impacto em BTC.',   -3.2),
  ('US_GDP',        'GDP (QoQ)',                    'BEA',    1, 'A191RL1Q225SBEA',   53,  '%',  '08:30', 'PIB dos EUA (variação trimestral anualizada).',                 1.2),
  ('US_PCE',        'PCE Price Index (MoM)',        'BEA',    2, 'PCEPI',             54,  '%',  '08:30', 'Indicador de inflação preferido do Fed.',                      -1.9),
  ('US_PPI',        'PPI (MoM)',                    'BLS',    2, 'PPIACO',            62,  '%',  '08:30', 'Inflação ao produtor — antecede CPI ~30 dias.',                -1.1),
  ('US_RETAIL',     'Retail Sales (MoM)',           'Census', 2, 'RSXFS',             226, '%',  '08:30', 'Vendas no varejo — proxy de consumo e crescimento.',            0.6)
ON CONFLICT (code) DO NOTHING;
