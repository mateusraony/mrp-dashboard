/**
 * aiPredictions.ts — persiste previsões do AI rule engine no Supabase.
 * Sprint 8.2: AI Track Record live.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';
import type { RuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiPrediction {
  id:                   string;
  session_hour:         string;
  direction:            string;
  signal:               string;
  confidence:           number;
  timeframe:            string;
  price_at_prediction:  number;
  bull_case:            string | null;
  bear_case:            string | null;
  modules_snapshot:     Record<string, unknown> | null;
  outcome:              'HIT' | 'MISS' | 'PARTIAL' | 'PENDING';
  outcome_price:        number | null;
  outcome_ret_pct:      number | null;
  outcome_evaluated_at: string | null;
  created_at:           string;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Dedup key: 'YYYY-MM-DDTHH' in UTC — one prediction slot per hour. */
export function sessionHour(): string {
  return new Date().toISOString().slice(0, 13);
}

// ─── persistPrediction ────────────────────────────────────────────────────────

/**
 * Persiste a previsão atual no Supabase.
 * Usa session_hour como chave de dedup — chamadas duplicadas na mesma hora são no-op.
 * Falhas silenciosas: nunca lança erro para não quebrar a UI.
 */
export async function persistPrediction(
  overall: RuleBasedAnalysis['overall'],
  price: number,
  modules: RuleBasedAnalysis['modules'],
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getClient();
    const { error } = await sb.from('ai_predictions').upsert(
      {
        session_hour:        sessionHour(),
        direction:           overall.direction,
        signal:              overall.recommendation,
        confidence:          overall.confidence,
        timeframe:           overall.timeframe,
        price_at_prediction: price,
        bull_case:           overall.bull_case ?? null,
        bear_case:           overall.bear_case ?? null,
        modules_snapshot:    modules as unknown as Record<string, unknown>,
      },
      { onConflict: 'session_hour', ignoreDuplicates: true },
    );
    if (error) console.warn('[aiPredictions] persistPrediction:', error.message);
  } catch (err) {
    console.warn('[aiPredictions] persistPrediction error (silent):', err);
  }
}

// ─── fetchRecentPredictions ───────────────────────────────────────────────────

/** Retorna as últimas N previsões ordenadas por created_at desc. */
export async function fetchRecentPredictions(limit = 10): Promise<AiPrediction[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const sb = getClient();
    const { data, error } = await sb
      .from('ai_predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('[aiPredictions] fetchRecentPredictions:', error.message);
      return [];
    }
    return (data ?? []) as AiPrediction[];
  } catch (err) {
    console.warn('[aiPredictions] fetchRecentPredictions error (silent):', err);
    return [];
  }
}

// ─── evaluateOutcomes ─────────────────────────────────────────────────────────

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Avalia previsões PENDING com mais de 4h de idade e atualiza outcome no DB.
 * Usa Promise.allSettled — falha individual não aborta o lote.
 */
export async function evaluateOutcomes(
  predictions: AiPrediction[],
  currentPrice: number,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getClient();
  const now = Date.now();

  const pending = predictions.filter(
    p => p.outcome === 'PENDING' && now - new Date(p.created_at).getTime() > FOUR_HOURS_MS,
  );

  if (pending.length === 0) return;

  await Promise.allSettled(
    pending.map(async (p) => {
      const ret = (currentPrice - p.price_at_prediction) / p.price_at_prediction;
      let outcome: 'HIT' | 'MISS' | 'PARTIAL';

      if (p.direction === 'bullish' || p.direction === 'bullish_bias') {
        outcome = ret >= 0.005 ? 'HIT' : ret >= 0 ? 'PARTIAL' : 'MISS';
      } else if (p.direction === 'bearish' || p.direction === 'bearish_bias') {
        outcome = ret <= -0.005 ? 'HIT' : ret <= 0 ? 'PARTIAL' : 'MISS';
      } else {
        outcome = Math.abs(ret) < 0.005 ? 'HIT' : 'MISS';
      }

      const { error } = await sb
        .from('ai_predictions')
        .update({
          outcome,
          outcome_price:        currentPrice,
          outcome_ret_pct:      parseFloat((ret * 100).toFixed(3)),
          outcome_evaluated_at: new Date().toISOString(),
        })
        .eq('id', p.id);

      if (error) console.warn('[aiPredictions] evaluateOutcomes update:', error.message);
    }),
  );
}
