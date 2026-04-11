/**
 * alternative.ts — Alternative.me Fear & Greed Index
 *
 * API pública, sem autenticação, sem limite estrito.
 * Endpoint: https://api.alternative.me/fng/
 *
 * Regra de mock: idem binance.ts.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import { fearGreed } from '@/components/data/mockData';

const BASE = 'https://api.alternative.me';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const FngEntrySchema = z.object({
  value:                z.coerce.number(),
  value_classification: z.string(), // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  timestamp:            z.coerce.number(),
  time_until_update:    z.string().optional(),
});

export const FngResponseSchema = z.object({
  name:     z.string(),
  data:     z.array(FngEntrySchema),
  metadata: z.object({ error: z.string().nullable() }),
});

export type FngEntry = z.infer<typeof FngEntrySchema>;
export type FngResponse = z.infer<typeof FngResponseSchema>;

// ─── Shapes exportadas ────────────────────────────────────────────────────────

export interface FearGreedData {
  value:          number;
  label:          string;  // ex: 'Fear'
  previous_close: number;
  previous_week:  number;
  previous_month: number;
  history:        Array<{ timestamp: number; value: number; label: string }>;
}

// ─── Mock transformer ─────────────────────────────────────────────────────────

function mockFearGreed(): FearGreedData {
  return {
    value:          fearGreed.value,
    label:          fearGreed.label,
    previous_close: fearGreed.value - 3,
    previous_week:  fearGreed.value + 8,
    previous_month: fearGreed.value + 18,
    history: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 86_400_000,
      value:     Math.max(10, Math.min(90, fearGreed.value - 20 + i * 0.7 + (Math.random() - 0.5) * 8)),
      label:     'Fear',
    })),
  };
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

function classifyLabel(value: number): string {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 45) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
}

/**
 * fetchFearGreed — Fear & Greed Index com histórico 30d
 * Cache recomendado: 1 hora (atualiza uma vez por dia em geral)
 */
export async function fetchFearGreed(limit = 30): Promise<FearGreedData> {
  if (DATA_MODE === 'mock') return mockFearGreed();

  const res = await fetch(`${BASE}/fng/?limit=${limit}&format=json`);
  if (!res.ok) throw new Error(`Alternative.me FNG error ${res.status}`);

  const raw = await res.json();
  const parsed = FngResponseSchema.parse(raw);

  if (parsed.metadata.error) {
    throw new Error(`Alternative.me error: ${parsed.metadata.error}`);
  }

  const [current, previousClose, previousWeek, previousMonth] = parsed.data;

  return {
    value:          current?.value ?? 0,
    label:          current?.value_classification ?? 'Unknown',
    previous_close: previousClose?.value ?? 0,
    previous_week:  previousWeek?.value ?? 0,
    previous_month: previousMonth?.value ?? 0,
    history: parsed.data.map(d => ({
      timestamp: d.timestamp * 1000, // converter Unix seconds → ms
      value:     d.value,
      label:     classifyLabel(d.value),
    })).reverse(), // mais antigo → mais recente
  };
}
