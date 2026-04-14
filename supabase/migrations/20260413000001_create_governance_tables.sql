-- ─── MRP Dashboard — Governance Tables (Sprint 6.5) ─────────────────────────
-- Versão: 2026-04-13
-- Cria tabelas de governança:
--   alert_events      — log de disparos de alertas
--   threshold_history — histórico de mudanças de limiares
--
-- Nota: tabelas foram aplicadas via MCP em 2026-04-13.
-- Este arquivo garante rastreabilidade no controle de versão.

-- ─── 1. alert_events ─────────────────────────────────────────────────────────
create table if not exists public.alert_events (
  id             uuid        primary key default gen_random_uuid(),
  rule_id        text        not null,
  rule_label     text        not null,
  fired_at       timestamptz not null default now(),
  value_at_fire  numeric     not null,
  threshold      numeric     not null,
  condition      text        not null,
  source         text        not null default 'system',
  created_at     timestamptz not null default now()
);

alter table public.alert_events enable row level security;

create policy "alert_events: leitura pública"
  on public.alert_events for select using (true);

create policy "alert_events: inserção pública"
  on public.alert_events for insert with check (true);

create index if not exists alert_events_rule_id_idx on public.alert_events(rule_id);
create index if not exists alert_events_fired_at_idx on public.alert_events(fired_at desc);

-- ─── 2. threshold_history ────────────────────────────────────────────────────
create table if not exists public.threshold_history (
  id          uuid        primary key default gen_random_uuid(),
  rule_id     text        not null,
  rule_label  text        not null,
  old_value   numeric     not null,
  new_value   numeric     not null,
  changed_at  timestamptz not null default now(),
  changed_by  text        not null default 'user',
  created_at  timestamptz not null default now()
);

alter table public.threshold_history enable row level security;

create policy "threshold_history: leitura pública"
  on public.threshold_history for select using (true);

create policy "threshold_history: inserção pública"
  on public.threshold_history for insert with check (true);

create index if not exists threshold_history_rule_id_idx   on public.threshold_history(rule_id);
create index if not exists threshold_history_changed_at_idx on public.threshold_history(changed_at desc);
