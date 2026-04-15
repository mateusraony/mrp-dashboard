-- ─── MRP Dashboard — Migração inicial ───────────────────────────────────────
-- Versão: 2026-04-12
-- Cria as 3 tabelas de persistência de dados do usuário:
--   alert_rules, portfolio_positions, user_settings
--
-- IDEMPOTENTE: seguro para re-aplicar (IF NOT EXISTS, DROP ... IF EXISTS).

-- ─── Extensões ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Helper: updated_at ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 1. alert_rules ──────────────────────────────────────────────────────────
create table if not exists public.alert_rules (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid,
  type           text        not null,
  label          text        not null,
  enabled        boolean     not null default true,
  condition      text        not null,
  threshold      numeric     not null,
  threshold_unit text        not null default '',
  notify         text[]      not null default '{"in-app"}',
  cooldown_min   integer     not null default 60,
  last_triggered timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists alert_rules_user_id_idx on public.alert_rules (user_id);
create index if not exists alert_rules_type_idx    on public.alert_rules (type);

alter table public.alert_rules enable row level security;

drop policy if exists "Usuário lê seus próprios alertas"      on public.alert_rules;
drop policy if exists "Usuário cria seus próprios alertas"    on public.alert_rules;
drop policy if exists "Usuário atualiza seus próprios alertas" on public.alert_rules;
drop policy if exists "Usuário deleta seus próprios alertas"  on public.alert_rules;
drop policy if exists "alert_rules: leitura pública"          on public.alert_rules;
drop policy if exists "alert_rules: inserção pública"         on public.alert_rules;
drop policy if exists "alert_rules: atualização pública"      on public.alert_rules;
drop policy if exists "alert_rules: deleção pública"          on public.alert_rules;

create policy "alert_rules: leitura pública"   on public.alert_rules for select using (true);
create policy "alert_rules: inserção pública"  on public.alert_rules for insert with check (true);
create policy "alert_rules: atualização pública" on public.alert_rules for update using (true);
create policy "alert_rules: deleção pública"   on public.alert_rules for delete using (true);

drop trigger if exists alert_rules_updated_at on public.alert_rules;
create trigger alert_rules_updated_at
  before update on public.alert_rules
  for each row execute function public.set_updated_at();

-- ─── 2. portfolio_positions ───────────────────────────────────────────────────
create table if not exists public.portfolio_positions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid,
  type         text        not null check (type in (
                             'spot', 'futures_perp', 'futures_dated',
                             'option_call', 'option_put', 'cash'
                           )),
  asset        text        not null,
  size         numeric     not null,
  side         text        not null check (side in ('long', 'short')),
  entry_price  numeric     not null,
  strike       numeric,
  expiry_days  integer,
  iv           numeric,
  delta        numeric     not null default 0,
  gamma        numeric     not null default 0,
  theta        numeric     not null default 0,
  vega         numeric     not null default 0,
  color        text        not null default '#3b82f6',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists portfolio_positions_user_id_idx on public.portfolio_positions (user_id);
create index if not exists portfolio_positions_type_idx    on public.portfolio_positions (type);

alter table public.portfolio_positions enable row level security;

drop policy if exists "Usuário lê suas próprias posições"       on public.portfolio_positions;
drop policy if exists "Usuário cria suas próprias posições"     on public.portfolio_positions;
drop policy if exists "Usuário atualiza suas próprias posições"  on public.portfolio_positions;
drop policy if exists "Usuário deleta suas próprias posições"   on public.portfolio_positions;
drop policy if exists "portfolio: leitura pública"              on public.portfolio_positions;
drop policy if exists "portfolio: inserção pública"             on public.portfolio_positions;
drop policy if exists "portfolio: atualização pública"          on public.portfolio_positions;
drop policy if exists "portfolio: deleção pública"              on public.portfolio_positions;

create policy "portfolio: leitura pública"   on public.portfolio_positions for select using (true);
create policy "portfolio: inserção pública"  on public.portfolio_positions for insert with check (true);
create policy "portfolio: atualização pública" on public.portfolio_positions for update using (true);
create policy "portfolio: deleção pública"   on public.portfolio_positions for delete using (true);

drop trigger if exists portfolio_positions_updated_at on public.portfolio_positions;
create trigger portfolio_positions_updated_at
  before update on public.portfolio_positions
  for each row execute function public.set_updated_at();

-- ─── 3. user_settings ────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid unique,
  data_mode      text        not null default 'mock' check (data_mode in ('mock', 'live')),
  base_currency  text        not null default 'USD',
  theme          text        not null default 'dark' check (theme in ('dark', 'light')),
  notifications  boolean     not null default true,
  risk_profile   text        not null default 'moderate'
                             check (risk_profile in ('conservative', 'moderate', 'aggressive')),
  leverage_limit numeric     not null default 3,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Usuário lê suas próprias configurações"      on public.user_settings;
drop policy if exists "Usuário cria suas próprias configurações"    on public.user_settings;
drop policy if exists "Usuário atualiza suas próprias configurações" on public.user_settings;
drop policy if exists "user_settings: leitura pública"              on public.user_settings;
drop policy if exists "user_settings: inserção pública"             on public.user_settings;
drop policy if exists "user_settings: atualização pública"          on public.user_settings;

create policy "user_settings: leitura pública"    on public.user_settings for select using (true);
create policy "user_settings: inserção pública"   on public.user_settings for insert with check (true);
create policy "user_settings: atualização pública" on public.user_settings for update using (true);

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ─── Comentários ──────────────────────────────────────────────────────────────
comment on table public.alert_rules         is 'Regras de alerta configuradas pelo usuário';
comment on table public.portfolio_positions is 'Posições do portfólio do usuário';
comment on table public.user_settings       is 'Configurações gerais do usuário';
