/**
 * supabase.ts — Supabase (Postgres) para persistência de dados do usuário
 *
 * Tabelas usadas:
 *   alert_rules        — regras de alerta configuradas pelo usuário
 *   portfolio_positions — posições abertas (BTC spot, futuros, opções, cash)
 *   user_settings      — configurações gerais (DATA_MODE, tema, API keys)
 *
 * Requer variáveis de ambiente:
 *   VITE_SUPABASE_URL      — URL do projeto Supabase
 *   VITE_SUPABASE_ANON_KEY — anon key pública (Row Level Security faz o resto)
 *
 * Regra de mock: DATA_MODE=mock → usa dados locais (sem Supabase).
 * DATA_MODE=live sem credenciais → lança erro descritivo.
 *
 * Sem VITE_SUPABASE_URL → retorna mock com aviso de configuração.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { env } from '@/lib/env';
import {
  defaultAlertRules,
} from '@/components/data/mockDataAlerts';
import {
  defaultPositions,
} from '@/components/data/mockDataPortfolio';

// Configurações padrão (não existem no mock — definidos aqui)
const defaultSettings = {
  data_mode:      'mock' as const,
  base_currency:  'USD',
  theme:          'dark' as const,
  notifications:  true,
  risk_profile:   'moderate' as const,
  leverage_limit: 3,
};

// ─── Schemas de validação (input/output Supabase) ─────────────────────────────

export const AlertRuleSchema = z.object({
  id:             z.string().uuid().optional(), // gerado pelo Supabase
  user_id:        z.string().uuid().optional(), // auth.uid()
  type:           z.string(),
  label:          z.string(),
  enabled:        z.boolean().default(true),
  condition:      z.string(),
  threshold:      z.coerce.number(),
  threshold_unit: z.string().default(''),
  notify:         z.array(z.string()).default(['in-app']),
  cooldown_min:   z.coerce.number().default(60),
  last_triggered: z.string().nullable().optional(),
  created_at:     z.string().optional(),
  updated_at:     z.string().optional(),
});
export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const PortfolioPositionSchema = z.object({
  id:            z.string().uuid().optional(),
  user_id:       z.string().uuid().optional(),
  type:          z.enum(['spot', 'futures_perp', 'futures_dated', 'option_call', 'option_put', 'cash']),
  asset:         z.string(),
  size:          z.coerce.number(),
  side:          z.enum(['long', 'short']),
  entry_price:   z.coerce.number(),
  strike:        z.coerce.number().optional().nullable(),
  expiry_days:   z.coerce.number().optional().nullable(),
  iv:            z.coerce.number().optional().nullable(),
  delta:         z.coerce.number().default(0),
  gamma:         z.coerce.number().default(0),
  theta:         z.coerce.number().default(0),
  vega:          z.coerce.number().default(0),
  color:         z.string().default('#3b82f6'),
  created_at:    z.string().optional(),
  updated_at:    z.string().optional(),
});
export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;

export const UserSettingsSchema = z.object({
  id:                  z.string().uuid().optional(),
  user_id:             z.string().uuid().optional(),
  data_mode:           z.enum(['mock', 'live']).default('mock'),
  base_currency:       z.string().default('USD'),
  theme:               z.enum(['dark', 'light']).default('dark'),
  notifications:       z.boolean().default(true),
  risk_profile:        z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  leverage_limit:      z.coerce.number().default(3),
  // Telegram Digest (Sprint 6.6)
  telegram_enabled:    z.boolean().default(false),
  telegram_chat_id:    z.string().nullable().optional(),
  telegram_bot_token:  z.string().nullable().optional(),
  telegram_schedule:   z.string().default('11:00'),
  // metadata
  created_at:          z.string().optional(),
  updated_at:          z.string().optional(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

// ─── Sentinel UUID para usuário anônimo ───────────────────────────────────────
// Como o app não usa autenticação real, usamos um UUID fixo como user_id.
// Isso garante que upsert por user_id encontre o registro existente em vez de criar um novo.
// O campo user_id na tabela é UNIQUE, então dois NULLs não conflitam — o sentinel resolve isso.
const ANON_USER_ID = '00000000-0000-0000-0000-000000000000';

// ─── Singleton do cliente Supabase ─────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[Supabase] Cliente não criado: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes.');
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local. ' +
      'Crie um projeto gratuito em https://supabase.com',
    );
  }

  _client = createClient(url, key, {
    auth: {
      persistSession:      false, // sem auth por agora (anon)
      autoRefreshToken:    false,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica se Supabase está configurado (não lança erro) */
export function isSupabaseConfigured(): boolean {
  return !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
}

/**
 * Wrapper de segurança: propaga o erro do Supabase como Error com mensagem legível.
 */
function assertNoError<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Supabase error: ${result.error.message}`);
  if (result.data === null) throw new Error('Supabase: resposta vazia inesperada');
  return result.data;
}

// ─── Alert Rules ──────────────────────────────────────────────────────────────

/**
 * fetchAlertRules — busca todas as regras de alerta do usuário.
 * Em mock retorna regras padrão sem tocar o Supabase.
 */
export async function fetchAlertRules(): Promise<AlertRule[]> {
  if (!isSupabaseConfigured()) {
    // Retorna mock com regras padrão (sem Supabase configurado)
    return defaultAlertRules.map(r => AlertRuleSchema.parse(r));
  }

  const sb = getClient();
  const result = await sb
    .from('alert_rules')
    .select('*')
    .order('created_at', { ascending: true });

  const rows = assertNoError(result);
  return (rows as unknown[]).map(r => AlertRuleSchema.parse(r));
}

/**
 * upsertAlertRule — cria ou atualiza uma regra de alerta.
 * Usa upsert por id para evitar duplicatas.
 */
export async function upsertAlertRule(rule: AlertRule): Promise<AlertRule> {
  if (!isSupabaseConfigured()) {
    // Simula persistência local em mock
    return AlertRuleSchema.parse({ ...rule, id: rule.id ?? crypto.randomUUID() });
  }

  const sb = getClient();
  const payload = AlertRuleSchema.parse(rule);
  const result = await sb
    .from('alert_rules')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  return AlertRuleSchema.parse(assertNoError(result));
}

/**
 * deleteAlertRule — remove uma regra pelo id.
 */
export async function deleteAlertRule(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const sb = getClient();
  const result = await sb
    .from('alert_rules')
    .delete()
    .eq('id', id);

  if (result.error) throw new Error(`Supabase delete error: ${result.error.message}`);
}

// ─── Portfolio Positions ──────────────────────────────────────────────────────

/**
 * fetchPortfolioPositions — busca posições do portfólio do usuário.
 */
export async function fetchPortfolioPositions(): Promise<PortfolioPosition[]> {
  if (!isSupabaseConfigured()) {
    return defaultPositions.map(p => PortfolioPositionSchema.parse(p));
  }

  const sb = getClient();
  const result = await sb
    .from('portfolio_positions')
    .select('*')
    .order('created_at', { ascending: true });

  const rows = assertNoError(result);
  return (rows as unknown[]).map(p => PortfolioPositionSchema.parse(p));
}

/**
 * upsertPortfolioPosition — cria ou atualiza uma posição.
 */
export async function upsertPortfolioPosition(pos: PortfolioPosition): Promise<PortfolioPosition> {
  if (!isSupabaseConfigured()) {
    return PortfolioPositionSchema.parse({ ...pos, id: pos.id ?? crypto.randomUUID() });
  }

  const sb = getClient();
  const payload = PortfolioPositionSchema.parse(pos);
  const result = await sb
    .from('portfolio_positions')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  return PortfolioPositionSchema.parse(assertNoError(result));
}

/**
 * deletePortfolioPosition — remove uma posição pelo id.
 */
export async function deletePortfolioPosition(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const sb = getClient();
  const result = await sb
    .from('portfolio_positions')
    .delete()
    .eq('id', id);

  if (result.error) throw new Error(`Supabase delete error: ${result.error.message}`);
}

// ─── User Settings ────────────────────────────────────────────────────────────

/**
 * fetchUserSettings — busca configurações do usuário anônimo (sentinel UUID).
 * Retorna defaults se não existir ou se Supabase não estiver configurado.
 *
 * Filtra pelo ANON_USER_ID para evitar `.maybeSingle()` falhar quando múltiplas
 * linhas existem (situação causada pelo bug antigo de upsert sem user_id).
 */
export async function fetchUserSettings(): Promise<UserSettings> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] fetchUserSettings: Supabase não configurado, retornando defaults.');
    return UserSettingsSchema.parse(defaultSettings ?? {});
  }

  const sb = getClient();
  const result = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', ANON_USER_ID)
    .maybeSingle(); // retorna null se não existir (sem erro 406)

  if (result.error) {
    console.error('[Supabase] fetchUserSettings error:', result.error.message);
    throw new Error(`Supabase error: ${result.error.message}`);
  }

  // Se não existe ainda nenhuma linha para este user_id, retorna defaults
  if (!result.data) {
    console.info('[Supabase] fetchUserSettings: nenhuma configuração encontrada, usando defaults.');
    return UserSettingsSchema.parse({});
  }

  return UserSettingsSchema.parse(result.data);
}

/**
 * upsertUserSettings — salva configurações do usuário anônimo.
 *
 * CORREÇÃO CRÍTICA: o upsert usa onConflict: 'user_id' e agora inclui o ANON_USER_ID
 * fixo no payload. Sem user_id no payload, dois NULLs não conflitam no Postgres
 * (NULL != NULL), criando uma nova linha a cada save em vez de atualizar a existente.
 *
 * A coluna user_id é UNIQUE na tabela — com o sentinel UUID fixo, o upsert
 * encontra o registro existente e faz UPDATE em vez de INSERT.
 */
export async function upsertUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] upsertUserSettings: Supabase não configurado, retornando mock merged com defaults.');
    return UserSettingsSchema.parse({ ...defaultSettings, ...settings });
  }

  const sb = getClient();

  // Inclui user_id fixo para garantir que o upsert encontre o registro existente
  const payload = UserSettingsSchema.partial().parse({
    ...settings,
    user_id: ANON_USER_ID,
  });

  console.info('[Supabase] upsertUserSettings: enviando payload com user_id sentinel', payload);

  const result = await sb
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (result.error) {
    console.error('[Supabase] upsertUserSettings error:', result.error.message, result.error);
    throw new Error(`Supabase upsert error: ${result.error.message}`);
  }

  if (!result.data) {
    console.error('[Supabase] upsertUserSettings: resposta vazia após upsert bem-sucedido.');
    throw new Error('Supabase: upsert retornou vazio inesperadamente');
  }

  console.info('[Supabase] upsertUserSettings: salvo com sucesso', result.data);
  return UserSettingsSchema.parse(result.data);
}

// ─── Governance — Alert Events (auditoria de disparos) ────────────────────────

export const AlertEventSchema = z.object({
  id:         z.string().uuid().optional(),
  rule_id:    z.string(),
  rule_label: z.string(),
  fired_at:   z.string(),              // ISO timestamp
  value_at_fire: z.coerce.number(),
  threshold:  z.coerce.number(),
  condition:  z.string(),
  source:     z.string().default('system'),
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

/** insertAlertEvent — registra disparo de alerta na tabela alert_events */
export async function insertAlertEvent(event: Omit<AlertEvent, 'id'>): Promise<void> {
  if (!isSupabaseConfigured()) return; // no-op em mock

  const sb = getClient();
  const payload = AlertEventSchema.omit({ id: true }).parse(event);

  try {
    await sb.from('alert_events').insert(payload);
  } catch {
    // tabela ainda não existe (migration pendente) — falha silenciosa
  }
}

/** fetchAlertEvents — últimos N disparos de alertas */
export async function fetchAlertEvents(limit = 20): Promise<AlertEvent[]> {
  if (!isSupabaseConfigured()) return MOCK_ALERT_EVENTS;

  const sb = getClient();
  try {
    const result = await sb
      .from('alert_events')
      .select('*')
      .order('fired_at', { ascending: false })
      .limit(limit);

    if (result.error) return MOCK_ALERT_EVENTS;
    return (result.data as unknown[]).map(r => AlertEventSchema.parse(r));
  } catch {
    return MOCK_ALERT_EVENTS;
  }
}

// ─── Governance — Threshold History (rastreio de mudanças de limiar) ──────────

export const ThresholdChangeSchema = z.object({
  id:        z.string().uuid().optional(),
  rule_id:   z.string(),
  rule_label:z.string(),
  old_value: z.coerce.number(),
  new_value: z.coerce.number(),
  changed_at:z.string(),
  changed_by:z.string().default('user'),
});
export type ThresholdChange = z.infer<typeof ThresholdChangeSchema>;

/** insertThresholdChange — registra mudança de threshold */
export async function insertThresholdChange(change: Omit<ThresholdChange, 'id'>): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const sb = getClient();
  const payload = ThresholdChangeSchema.omit({ id: true }).parse(change);

  try {
    await sb.from('threshold_history').insert(payload);
  } catch {
    // tabela pendente — falha silenciosa
  }
}

/** fetchThresholdHistory — histórico de mudanças (todas as regras ou uma específica) */
export async function fetchThresholdHistory(ruleId?: string): Promise<ThresholdChange[]> {
  if (!isSupabaseConfigured()) {
    return ruleId ? MOCK_THRESHOLD_HISTORY.filter(t => t.rule_id === ruleId) : MOCK_THRESHOLD_HISTORY;
  }

  const sb = getClient();
  try {
    let q = sb
      .from('threshold_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(50);

    if (ruleId) q = q.eq('rule_id', ruleId);

    const result = await q;
    if (result.error) return MOCK_THRESHOLD_HISTORY;
    return (result.data as unknown[]).map(r => ThresholdChangeSchema.parse(r));
  } catch {
    return MOCK_THRESHOLD_HISTORY;
  }
}

// ─── Mock data para governança ────────────────────────────────────────────────

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const minsAgo  = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

const MOCK_ALERT_EVENTS: AlertEvent[] = [
  { id: crypto.randomUUID(), rule_id: 'rule-001', rule_label: 'Funding Rate Extremo', fired_at: minsAgo(23), value_at_fire: 0.0812, threshold: 0.08, condition: '> 0.08%', source: 'binance' },
  { id: crypto.randomUUID(), rule_id: 'rule-002', rule_label: 'Long Flush Watch', fired_at: hoursAgo(2), value_at_fire: 1240, threshold: 1000, condition: 'liquidações > $1M', source: 'binance' },
  { id: crypto.randomUUID(), rule_id: 'rule-003', rule_label: 'MVRV Z-Score Crítico', fired_at: hoursAgo(6), value_at_fire: 3.82, threshold: 3.7, condition: '> 3.7', source: 'coinmetrics' },
  { id: crypto.randomUUID(), rule_id: 'rule-001', rule_label: 'Funding Rate Extremo', fired_at: hoursAgo(14), value_at_fire: 0.0923, threshold: 0.08, condition: '> 0.08%', source: 'binance' },
  { id: crypto.randomUUID(), rule_id: 'rule-004', rule_label: 'VIX Spike', fired_at: hoursAgo(28), value_at_fire: 22.4, threshold: 20, condition: '> 20', source: 'fred' },
];

const MOCK_THRESHOLD_HISTORY: ThresholdChange[] = [
  { id: crypto.randomUUID(), rule_id: 'rule-001', rule_label: 'Funding Rate Extremo', old_value: 0.06, new_value: 0.08, changed_at: hoursAgo(48), changed_by: 'user' },
  { id: crypto.randomUUID(), rule_id: 'rule-002', rule_label: 'Long Flush Watch', old_value: 500, new_value: 1000, changed_at: hoursAgo(72), changed_by: 'user' },
  { id: crypto.randomUUID(), rule_id: 'rule-003', rule_label: 'MVRV Z-Score Crítico', old_value: 3.5, new_value: 3.7, changed_at: hoursAgo(120), changed_by: 'user' },
];
