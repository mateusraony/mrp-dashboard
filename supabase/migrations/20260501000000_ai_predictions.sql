-- ═══════════════════════════════════════════════════════════════════════════════
-- 20260501000000_ai_predictions.sql
-- AI Rule Engine Predictions — Sprint 8.2
-- Idempotent: safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hour           text          NOT NULL UNIQUE,   -- 'YYYY-MM-DDTHH' UTC
  direction              text          NOT NULL,
  signal                 text          NOT NULL,
  confidence             numeric(4,3)  NOT NULL,
  timeframe              text          NOT NULL DEFAULT '4h–24h',
  price_at_prediction    numeric(12,2) NOT NULL,
  bull_case              text,
  bear_case              text,
  modules_snapshot       jsonb,
  outcome                text          NOT NULL DEFAULT 'PENDING'
                                       CHECK (outcome IN ('HIT','MISS','PARTIAL','PENDING')),
  outcome_price          numeric(12,2),
  outcome_ret_pct        numeric(6,3),
  outcome_evaluated_at   timestamptz,
  created_at             timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_predictions_created_at_idx
  ON public.ai_predictions (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_predictions_outcome_pending_idx
  ON public.ai_predictions (outcome)
  WHERE outcome = 'PENDING';

ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_predictions: leitura pública"     ON public.ai_predictions;
DROP POLICY IF EXISTS "ai_predictions: inserção pública"    ON public.ai_predictions;
DROP POLICY IF EXISTS "ai_predictions: atualização pública" ON public.ai_predictions;

CREATE POLICY "ai_predictions: leitura pública"
  ON public.ai_predictions FOR SELECT USING (true);

CREATE POLICY "ai_predictions: inserção pública"
  ON public.ai_predictions FOR INSERT WITH CHECK (true);

CREATE POLICY "ai_predictions: atualização pública"
  ON public.ai_predictions FOR UPDATE USING (true);
