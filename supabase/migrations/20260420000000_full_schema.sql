-- ═══════════════════════════════════════════════════════════════════════════════
-- MRP Dashboard — Schema Completo e Idempotente
-- Versão: 20260420000000
-- Este único arquivo substitui todas as migrations anteriores.
-- SEGURO PARA RE-APLICAÇÃO MÚLTIPLA: todo statement usa IF NOT EXISTS / IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Extensões ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Função updated_at (CREATE OR REPLACE = sempre seguro) ───────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA 1: alert_rules
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid,
  type           text        NOT NULL,
  label          text        NOT NULL,
  enabled        boolean     NOT NULL DEFAULT true,
  condition      text        NOT NULL,
  threshold      numeric     NOT NULL,
  threshold_unit text        NOT NULL DEFAULT '',
  notify         text[]      NOT NULL DEFAULT '{"in-app"}',
  cooldown_min   integer     NOT NULL DEFAULT 60,
  last_triggered timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_user_id_idx ON public.alert_rules (user_id);
CREATE INDEX IF NOT EXISTS alert_rules_type_idx    ON public.alert_rules (type);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- Policies: drop all possible names then recreate
DROP POLICY IF EXISTS "Usuário lê seus próprios alertas"       ON public.alert_rules;
DROP POLICY IF EXISTS "Usuário cria seus próprios alertas"     ON public.alert_rules;
DROP POLICY IF EXISTS "Usuário atualiza seus próprios alertas" ON public.alert_rules;
DROP POLICY IF EXISTS "Usuário deleta seus próprios alertas"   ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: leitura pública"           ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: inserção pública"          ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: atualização pública"       ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: deleção pública"           ON public.alert_rules;

CREATE POLICY "alert_rules: leitura pública"
  ON public.alert_rules FOR SELECT USING (true);
CREATE POLICY "alert_rules: inserção pública"
  ON public.alert_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "alert_rules: atualização pública"
  ON public.alert_rules FOR UPDATE USING (true);
CREATE POLICY "alert_rules: deleção pública"
  ON public.alert_rules FOR DELETE USING (true);

DROP TRIGGER IF EXISTS alert_rules_updated_at ON public.alert_rules;
CREATE TRIGGER alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA 2: portfolio_positions
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.portfolio_positions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid,
  type         text        NOT NULL CHECK (type IN (
                             'spot','futures_perp','futures_dated',
                             'option_call','option_put','cash')),
  asset        text        NOT NULL,
  size         numeric     NOT NULL,
  side         text        NOT NULL CHECK (side IN ('long','short')),
  entry_price  numeric     NOT NULL,
  strike       numeric,
  expiry_days  integer,
  iv           numeric,
  delta        numeric     NOT NULL DEFAULT 0,
  gamma        numeric     NOT NULL DEFAULT 0,
  theta        numeric     NOT NULL DEFAULT 0,
  vega         numeric     NOT NULL DEFAULT 0,
  color        text        NOT NULL DEFAULT '#3b82f6',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_positions_user_id_idx ON public.portfolio_positions (user_id);
CREATE INDEX IF NOT EXISTS portfolio_positions_type_idx    ON public.portfolio_positions (type);

ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário lê suas próprias posições"       ON public.portfolio_positions;
DROP POLICY IF EXISTS "Usuário cria suas próprias posições"     ON public.portfolio_positions;
DROP POLICY IF EXISTS "Usuário atualiza suas próprias posições" ON public.portfolio_positions;
DROP POLICY IF EXISTS "Usuário deleta suas próprias posições"   ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: leitura pública"              ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: inserção pública"             ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: atualização pública"          ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: deleção pública"              ON public.portfolio_positions;

CREATE POLICY "portfolio: leitura pública"
  ON public.portfolio_positions FOR SELECT USING (true);
CREATE POLICY "portfolio: inserção pública"
  ON public.portfolio_positions FOR INSERT WITH CHECK (true);
CREATE POLICY "portfolio: atualização pública"
  ON public.portfolio_positions FOR UPDATE USING (true);
CREATE POLICY "portfolio: deleção pública"
  ON public.portfolio_positions FOR DELETE USING (true);

DROP TRIGGER IF EXISTS portfolio_positions_updated_at ON public.portfolio_positions;
CREATE TRIGGER portfolio_positions_updated_at
  BEFORE UPDATE ON public.portfolio_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA 3: user_settings
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_settings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        UNIQUE,
  data_mode      text        NOT NULL DEFAULT 'mock'
                             CHECK (data_mode IN ('mock','live')),
  base_currency  text        NOT NULL DEFAULT 'USD',
  theme          text        NOT NULL DEFAULT 'dark'
                             CHECK (theme IN ('dark','light')),
  notifications  boolean     NOT NULL DEFAULT true,
  risk_profile   text        NOT NULL DEFAULT 'moderate'
                             CHECK (risk_profile IN ('conservative','moderate','aggressive')),
  leverage_limit numeric     NOT NULL DEFAULT 3,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Colunas Telegram (adicionadas depois — ADD COLUMN IF NOT EXISTS é idempotente)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS telegram_enabled   boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_chat_id   text,
  ADD COLUMN IF NOT EXISTS telegram_bot_token text,
  ADD COLUMN IF NOT EXISTS telegram_schedule  text     NOT NULL DEFAULT '11:00';

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário lê suas próprias configurações"      ON public.user_settings;
DROP POLICY IF EXISTS "Usuário cria suas próprias configurações"    ON public.user_settings;
DROP POLICY IF EXISTS "Usuário atualiza suas próprias configurações" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings: leitura pública"              ON public.user_settings;
DROP POLICY IF EXISTS "user_settings: inserção pública"             ON public.user_settings;
DROP POLICY IF EXISTS "user_settings: atualização pública"          ON public.user_settings;

CREATE POLICY "user_settings: leitura pública"
  ON public.user_settings FOR SELECT USING (true);
CREATE POLICY "user_settings: inserção pública"
  ON public.user_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "user_settings: atualização pública"
  ON public.user_settings FOR UPDATE USING (true);

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Remove FK para auth.users (permite sentinel UUID anônimo sem Supabase Auth)
ALTER TABLE public.user_settings      DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE public.alert_rules        DROP CONSTRAINT IF EXISTS alert_rules_user_id_fkey;
ALTER TABLE public.portfolio_positions DROP CONSTRAINT IF EXISTS portfolio_positions_user_id_fkey;

-- Remove linhas órfãs sem user_id
DELETE FROM public.user_settings WHERE user_id IS NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA 4: alert_events (governança)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.alert_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       text        NOT NULL,
  rule_label    text        NOT NULL,
  fired_at      timestamptz NOT NULL DEFAULT now(),
  value_at_fire numeric     NOT NULL,
  threshold     numeric     NOT NULL,
  condition     text        NOT NULL,
  source        text        NOT NULL DEFAULT 'system',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_events: leitura pública"  ON public.alert_events;
DROP POLICY IF EXISTS "alert_events: inserção pública" ON public.alert_events;

CREATE POLICY "alert_events: leitura pública"
  ON public.alert_events FOR SELECT USING (true);
CREATE POLICY "alert_events: inserção pública"
  ON public.alert_events FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS alert_events_rule_id_idx  ON public.alert_events(rule_id);
CREATE INDEX IF NOT EXISTS alert_events_fired_at_idx ON public.alert_events(fired_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA 5: threshold_history (governança)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.threshold_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id    text        NOT NULL,
  rule_label text        NOT NULL,
  old_value  numeric     NOT NULL,
  new_value  numeric     NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text        NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.threshold_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threshold_history: leitura pública"  ON public.threshold_history;
DROP POLICY IF EXISTS "threshold_history: inserção pública" ON public.threshold_history;

CREATE POLICY "threshold_history: leitura pública"
  ON public.threshold_history FOR SELECT USING (true);
CREATE POLICY "threshold_history: inserção pública"
  ON public.threshold_history FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS threshold_history_rule_id_idx    ON public.threshold_history(rule_id);
CREATE INDEX IF NOT EXISTS threshold_history_changed_at_idx ON public.threshold_history(changed_at DESC);

-- ─── Comentários ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.alert_rules         IS 'Regras de alerta configuradas pelo usuário';
COMMENT ON TABLE public.portfolio_positions IS 'Posições do portfólio do usuário';
COMMENT ON TABLE public.user_settings       IS 'Configurações gerais do usuário (single-user, sem auth)';
COMMENT ON TABLE public.alert_events        IS 'Log de disparos de alertas (governança)';
COMMENT ON TABLE public.threshold_history   IS 'Histórico de mudanças de limiares (governança)';
COMMENT ON COLUMN public.user_settings.user_id IS
  'UUID do usuário. UNIQUE para ON CONFLICT no upsert. Sem FK para permitir sentinel anônimo 00000000-0000-0000-0000-000000000000.';
