-- ─── MRP Dashboard — Remove FK auth.users → permite sentinel anônimo ─────────
-- Versão: 2026-04-15
--
-- Contexto: o app não usa Supabase Auth (stub anônimo, single-user).
-- user_id nas 3 tabelas core tinha FK → auth.users(id), bloqueando upsert
-- com o sentinel fixo '00000000-0000-0000-0000-000000000000' (não existe em auth.users).
--
-- Correção: remove as FKs. UNIQUE em user_settings.user_id é mantido para
-- garantir ON CONFLICT (user_id) no upsert. IF EXISTS torna idempotente.

alter table public.user_settings
  drop constraint if exists user_settings_user_id_fkey;

alter table public.alert_rules
  drop constraint if exists alert_rules_user_id_fkey;

alter table public.portfolio_positions
  drop constraint if exists portfolio_positions_user_id_fkey;

comment on column public.user_settings.user_id is
  'UUID do usuário. UNIQUE para ON CONFLICT no upsert. FK removida para uso sem Supabase Auth. Sentinel: 00000000-0000-0000-0000-000000000000.';
