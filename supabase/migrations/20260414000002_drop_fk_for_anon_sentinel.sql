-- ─── MRP Dashboard — Corrige FK de user_id para permitir UUID sentinel anônimo ─
-- Versão: 2026-04-14
-- Problema: user_settings.user_id tem FK -> auth.users(id).
-- O sentinel UUID '00000000-0000-0000-0000-000000000000' não existe em auth.users,
-- então todo INSERT falhava com "violates foreign key constraint".
--
-- Solução: remove a FK constraint em user_settings, alert_rules e portfolio_positions.
-- O campo user_id permanece como UUID para futura integração de auth real, mas sem FK.
-- RLS já foi aberto via migração 20260414000000 (acesso público para app single-user).

-- ─── user_settings: remove FK em user_id ─────────────────────────────────────
alter table public.user_settings
  drop constraint if exists user_settings_user_id_fkey;

-- ─── alert_rules: remove FK em user_id ───────────────────────────────────────
alter table public.alert_rules
  drop constraint if exists alert_rules_user_id_fkey;

-- ─── portfolio_positions: remove FK em user_id ───────────────────────────────
alter table public.portfolio_positions
  drop constraint if exists portfolio_positions_user_id_fkey;

-- Verifica resultado (informativo — não falha se já estiver correto)
comment on column public.user_settings.user_id is
  'UUID do usuário. UNIQUE para garantir uma linha por usuário. FK removida para permitir UUID sentinel anônimo (00000000-...). Integrar auth.users no futuro via Supabase Auth.';

comment on column public.alert_rules.user_id is
  'UUID do usuário. FK removida para permitir uso sem autenticação real.';

comment on column public.portfolio_positions.user_id is
  'UUID do usuário. FK removida para permitir uso sem autenticação real.';
