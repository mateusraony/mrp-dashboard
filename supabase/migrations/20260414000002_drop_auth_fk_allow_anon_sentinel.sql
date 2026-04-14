-- ─── MRP Dashboard — Drop FK auth.users → permite sentinel UUID anônimo ─────────
-- Versão: 2026-04-14
--
-- Contexto: o app não usa Supabase Auth (auth stub anônimo).
-- As colunas user_id em user_settings, alert_rules e portfolio_positions
-- tinham FK → auth.users(id), bloqueando o upsert com o sentinel UUID fixo
-- '00000000-0000-0000-0000-000000000000' (não existe em auth.users).
--
-- Correção: dropar as FKs. O UNIQUE em user_settings.user_id é mantido
-- para garantir que o upsert ON CONFLICT (user_id) funcione corretamente.
-- Quando auth real for implementado, as FKs podem ser readdicionadas.

alter table public.user_settings
  drop constraint if exists user_settings_user_id_fkey;

alter table public.alert_rules
  drop constraint if exists alert_rules_user_id_fkey;

alter table public.portfolio_positions
  drop constraint if exists portfolio_positions_user_id_fkey;
