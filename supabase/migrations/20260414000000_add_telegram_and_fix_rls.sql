-- ─── MRP Dashboard — Telegram Settings + RLS anon fix ───────────────────────
-- Versão: 2026-04-14
-- Adiciona colunas de configuração do Telegram à tabela user_settings
-- Garante que usuários anônimos (sem auth) consigam inserir/atualizar dados

-- ─── Adiciona colunas Telegram em user_settings ───────────────────────────────
alter table public.user_settings
  add column if not exists telegram_enabled  boolean not null default false,
  add column if not exists telegram_chat_id  text,
  add column if not exists telegram_bot_token text,
  add column if not exists telegram_schedule text not null default '11:00';

-- ─── Garante acesso anônimo (sem auth.uid) para user_settings ─────────────────
-- Remove políticas antigas que dependiam de auth.uid() (bloqueavam usuários anon)
drop policy if exists "Usuário lê suas próprias configurações"   on public.user_settings;
drop policy if exists "Usuário cria suas próprias configurações" on public.user_settings;
drop policy if exists "Usuário atualiza suas próprias configurações" on public.user_settings;

-- Recria com acesso permissivo para uso anônimo (dashboard pessoal, sem multi-user)
create policy "user_settings: leitura pública"
  on public.user_settings for select using (true);

create policy "user_settings: inserção pública"
  on public.user_settings for insert with check (true);

create policy "user_settings: atualização pública"
  on public.user_settings for update using (true);

-- ─── Mesmo fix para alert_rules e portfolio_positions ────────────────────────
drop policy if exists "Usuário lê seus próprios alertas"     on public.alert_rules;
drop policy if exists "Usuário cria seus próprios alertas"   on public.alert_rules;
drop policy if exists "Usuário atualiza seus próprios alertas" on public.alert_rules;
drop policy if exists "Usuário deleta seus próprios alertas" on public.alert_rules;

create policy "alert_rules: leitura pública"   on public.alert_rules for select using (true);
create policy "alert_rules: inserção pública"  on public.alert_rules for insert with check (true);
create policy "alert_rules: atualização pública" on public.alert_rules for update using (true);
create policy "alert_rules: deleção pública"   on public.alert_rules for delete using (true);

drop policy if exists "Usuário lê suas próprias posições"      on public.portfolio_positions;
drop policy if exists "Usuário cria suas próprias posições"    on public.portfolio_positions;
drop policy if exists "Usuário atualiza suas próprias posições" on public.portfolio_positions;
drop policy if exists "Usuário deleta suas próprias posições"  on public.portfolio_positions;

create policy "portfolio: leitura pública"   on public.portfolio_positions for select using (true);
create policy "portfolio: inserção pública"  on public.portfolio_positions for insert with check (true);
create policy "portfolio: atualização pública" on public.portfolio_positions for update using (true);
create policy "portfolio: deleção pública"   on public.portfolio_positions for delete using (true);
