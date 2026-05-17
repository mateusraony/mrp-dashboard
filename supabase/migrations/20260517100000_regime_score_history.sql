-- regime_score_history — histórico diário do Market Regime Score
-- Preenchido pelo cliente (fire-and-forget) uma vez por dia quando IS_LIVE=true
-- Fallback gracioso: se tabela vazia, UI usa estimativa linear

CREATE TABLE IF NOT EXISTS regime_score_history (
  id         BIGSERIAL PRIMARY KEY,
  scored_at  DATE        NOT NULL DEFAULT CURRENT_DATE,  -- uma linha por dia
  score      SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  label      TEXT        NOT NULL CHECK (label IN ('Risk-On', 'Risk-Off', 'Neutral')),
  components JSONB       DEFAULT '[]'::jsonb,             -- snapshot dos 6 componentes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (scored_at)   -- upsert idempotente por dia
);

-- Índice para range queries (últimos N dias)
CREATE INDEX IF NOT EXISTS idx_regime_score_history_scored_at
  ON regime_score_history (scored_at DESC);

-- RLS: leitura pública (anon), escrita pública (anon) — sem auth real ainda
ALTER TABLE regime_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regime_history_read"  ON regime_score_history FOR SELECT USING (true);
CREATE POLICY "regime_history_write" ON regime_score_history FOR INSERT WITH CHECK (true);
CREATE POLICY "regime_history_update" ON regime_score_history FOR UPDATE USING (true);
