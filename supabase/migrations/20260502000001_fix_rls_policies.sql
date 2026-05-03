-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260502000001_fix_rls_policies
-- Objetivo: Restringir acesso RLS das tabelas de dados do usuário ao sentinel UUID.
--
-- Contexto: o app opera sem Supabase Auth real (stub anônimo). Todos os dados
-- de usuário são gravados com user_id = '00000000-0000-0000-0000-000000000000'
-- (ANON_USER_ID definido em src/services/supabase.ts). As políticas anteriores
-- usavam USING (true), deixando qualquer portador da anon key com acesso total
-- a leitura, escrita e exclusão de todos os registros.
--
-- Correção: substituir USING (true) por restrição explícita ao sentinel UUID
-- nas três tabelas que contêm dados sensíveis do usuário:
--   - user_settings  (inclui telegram_bot_token e telegram_chat_id)
--   - alert_rules    (regras de alerta configuradas pelo usuário)
--   - portfolio_positions (posições do portfólio do usuário)
--
-- Tabelas de auditoria/sistema (alert_events, threshold_history):
--   Mantidas com políticas públicas pois:
--   1. Não contêm coluna user_id nem dados pessoais sensíveis;
--   2. São necessárias para exibição do audit trail no frontend via anon key;
--   3. Escrita feita via service_role (Edge Functions) que ignora RLS de qualquer forma.
--
-- SEGURO PARA RE-APLICAÇÃO: usa DROP IF EXISTS antes de cada CREATE.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constante documentada: o sentinel UUID usado pelo app ─────────────────────
-- '00000000-0000-0000-0000-000000000000' = ANON_USER_ID em src/services/supabase.ts

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA: user_settings
-- Contém telegram_bot_token e telegram_chat_id — dados mais sensíveis do app.
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "user_settings: leitura pública"     ON public.user_settings;
DROP POLICY IF EXISTS "user_settings: inserção pública"    ON public.user_settings;
DROP POLICY IF EXISTS "user_settings: atualização pública" ON public.user_settings;

-- Leitura: apenas o próprio sentinel pode ver suas configurações.
-- Impede que qualquer outro portador da anon key leia o token do Telegram.
CREATE POLICY "user_settings: sentinel leitura"
  ON public.user_settings FOR SELECT
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Inserção: só aceita linhas com o sentinel UUID.
-- Impede criação de registros "órfãos" com user_id arbitrário.
CREATE POLICY "user_settings: sentinel inserção"
  ON public.user_settings FOR INSERT
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Atualização: só permite alterar a linha do sentinel.
CREATE POLICY "user_settings: sentinel atualização"
  ON public.user_settings FOR UPDATE
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA: alert_rules
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "alert_rules: leitura pública"     ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: inserção pública"    ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: atualização pública" ON public.alert_rules;
DROP POLICY IF EXISTS "alert_rules: deleção pública"     ON public.alert_rules;

CREATE POLICY "alert_rules: sentinel leitura"
  ON public.alert_rules FOR SELECT
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "alert_rules: sentinel inserção"
  ON public.alert_rules FOR INSERT
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "alert_rules: sentinel atualização"
  ON public.alert_rules FOR UPDATE
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "alert_rules: sentinel deleção"
  ON public.alert_rules FOR DELETE
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELA: portfolio_positions
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "portfolio: leitura pública"     ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: inserção pública"    ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: atualização pública" ON public.portfolio_positions;
DROP POLICY IF EXISTS "portfolio: deleção pública"     ON public.portfolio_positions;

CREATE POLICY "portfolio: sentinel leitura"
  ON public.portfolio_positions FOR SELECT
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "portfolio: sentinel inserção"
  ON public.portfolio_positions FOR INSERT
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "portfolio: sentinel atualização"
  ON public.portfolio_positions FOR UPDATE
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "portfolio: sentinel deleção"
  ON public.portfolio_positions FOR DELETE
  USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABELAS DE AUDITORIA: alert_events e threshold_history
-- NÃO alteradas — mantidas com políticas públicas existentes.
-- Razão: sem coluna user_id, sem dados sensíveis, necessário para audit trail.
-- ══════════════════════════════════════════════════════════════════════════════
