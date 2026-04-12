-- ─── MRP Dashboard — Migração inicial ───────────────────────────────────────
-- Versão: 2026-04-12
-- Cria as 3 tabelas de persistência de dados do usuário:
--   alert_rules, portfolio_positions, user_settings
--
-- Row Level Security (RLS) habilitado em todas as tabelas.
-- Política padrão: usuário só acessa seus próprios registros via auth.uid().
-- Para uso anônimo (sem auth), remover as políticas de user_id ou usar anon.

-- ─── Extensões ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── 1. alert_rules ──────────────────────────────────────────────────────────
create table if not exists public.alert_rules (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete cascade,
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

-- Índices
create index if not exists alert_rules_user_id_idx on public.alert_rules (user_id);
create index if not exists alert_rules_type_idx    on public.alert_rules (type);

-- RLS
alter table public.alert_rules enable row level security;

create policy "Usuário lê seus próprios alertas"
  on public.alert_rules for select
  using (auth.uid() = user_id or user_id is null);

create policy "Usuário cria seus próprios alertas"
  on public.alert_rules for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Usuário atualiza seus próprios alertas"
  on public.alert_rules for update
  using (auth.uid() = user_id or user_id is null);

create policy "Usuário deleta seus próprios alertas"
  on public.alert_rules for delete
  using (auth.uid() = user_id or user_id is null);

-- Trigger: atualizar updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger alert_rules_updated_at
  before update on public.alert_rules
  for each row execute function public.set_updated_at();

-- ─── 2. portfolio_positions ───────────────────────────────────────────────────
create table if not exists public.portfolio_positions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  type         text        not null check (type in (
                             'spot', 'futures_perp', 'futures_dated',
                             'option_call', 'option_put', 'cash'
                           )),
  asset        text        not null,
  size         numeric     not null,
  side         text        not null check (side in ('long', 'short')),
  entry_price  numeric     not null,
  strike       numeric,                    -- apenas para opções
  expiry_days  integer,                    -- apenas para futuros/opções
  iv           numeric,                    -- IV da opção (0–1)
  delta        numeric     not null default 0,
  gamma        numeric     not null default 0,
  theta        numeric     not null default 0,
  vega         numeric     not null default 0,
  color        text        not null default '#3b82f6',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Índices
create index if not exists portfolio_positions_user_id_idx on public.portfolio_positions (user_id);
create index if not exists portfolio_positions_type_idx    on public.portfolio_positions (type);

-- RLS
alter table public.portfolio_positions enable row level security;

create policy "Usuário lê suas próprias posições"
  on public.portfolio_positions for select
  using (auth.uid() = user_id or user_id is null);

create policy "Usuário cria suas próprias posições"
  on public.portfolio_positions for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Usuário atualiza suas próprias posições"
  on public.portfolio_positions for update
  using (auth.uid() = user_id or user_id is null);

create policy "Usuário deleta suas próprias posições"
  on public.portfolio_positions for delete
  using (auth.uid() = user_id or user_id is null);

create trigger portfolio_positions_updated_at
  before update on public.portfolio_positions
  for each row execute function public.set_updated_at();

-- ─── 3. user_settings ────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users(id) on delete cascade,
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

-- RLS
alter table public.user_settings enable row level security;

create policy "Usuário lê suas próprias configurações"
  on public.user_settings for select
  using (auth.uid() = user_id or user_id is null);

create policy "Usuário cria suas próprias configurações"
  on public.user_settings for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Usuário atualiza suas próprias configurações"
  on public.user_settings for update
  using (auth.uid() = user_id or user_id is null);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ─── Comentários de documentação ─────────────────────────────────────────────
comment on table public.alert_rules        is 'Regras de alerta configuradas pelo usuário (funded risk, IV spike, etc.)';
comment on table public.portfolio_positions is 'Posições do portfólio do usuário (spot, futuros, opções, cash)';
comment on table public.user_settings      is 'Configurações gerais do usuário (modo, tema, preferências)';
