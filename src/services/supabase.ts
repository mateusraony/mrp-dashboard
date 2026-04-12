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
  id:              z.string().uuid().optional(),
  user_id:         z.string().uuid().optional(),
  data_mode:       z.enum(['mock', 'live']).default('mock'),
  base_currency:   z.string().default('USD'),
  theme:           z.enum(['dark', 'light']).default('dark'),
  notifications:   z.boolean().default(true),
  risk_profile:    z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  leverage_limit:  z.coerce.number().default(3),
  // API keys são guardadas do lado cliente apenas — nunca persiste no Supabase
  created_at:      z.string().optional(),
  updated_at:      z.string().optional(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

// ─── Singleton do cliente Supabase ─────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local. ' +
      'Crie um projeto gratuito em https://supabase.com',
    );
  }

  _client = createClient(url, key, {
    auth: {
      persistSession:      false, // sem auth por agora (anon)
      autoRefreshToken:    false,
      detectSessionInBrowserUrl: false,
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
 * fetchUserSettings — busca configurações do usuário.
 * Retorna defaults se não existir ou se Supabase não estiver configurado.
 */
export async function fetchUserSettings(): Promise<UserSettings> {
  if (!isSupabaseConfigured()) {
    return UserSettingsSchema.parse(defaultSettings ?? {});
  }

  const sb = getClient();
  const result = await sb
    .from('user_settings')
    .select('*')
    .maybeSingle(); // retorna null se não existir (sem erro)

  if (result.error) throw new Error(`Supabase error: ${result.error.message}`);

  // Se não existe ainda, retorna defaults
  if (!result.data) return UserSettingsSchema.parse({});

  return UserSettingsSchema.parse(result.data);
}

/**
 * upsertUserSettings — salva configurações do usuário.
 * Usa upsert por user_id para garantir 1 registro por usuário.
 */
export async function upsertUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  if (!isSupabaseConfigured()) {
    return UserSettingsSchema.parse({ ...settings });
  }

  const sb = getClient();
  const payload = UserSettingsSchema.partial().parse(settings);
  const result = await sb
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  return UserSettingsSchema.parse(assertNoError(result));
}
