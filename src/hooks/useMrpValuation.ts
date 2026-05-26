/**
 * useMrpValuation — Feature A: Previsão de Custos e Valuation de Estoque
 * Chama a Edge Function mrp-valuation-agent e retorna o resultado com fallback.
 */

import { useQuery } from '@tanstack/react-query';
import { env }      from '@/lib/env';
import { logError } from '@/lib/debugLog';

export interface ValuationScenarioLine {
  sku:             string;
  product_name:    string;
  quantity:        number;
  unit:            string;
  current_cost:    number;
  current_value:   number;
  pessimist_cost:  number;
  pessimist_value: number;
  neutral_value:   number;
  optimist_value:  number;
  margin_impact:   number | null;
}

export interface ValuationData {
  generated_at:          string;
  currency:              string;
  total_inventory_value: number;
  scenarios: {
    pessimist:  number;
    neutral:    number;
    optimist:   number;
    variation_pct: { pessimist: number; optimist: number };
  };
  items_below_reorder: number;
  lines:               ValuationScenarioLine[];
  ai_analysis:         string;
}

interface DataState<T> {
  data:        T | null;
  lastUpdated: string | null;
  isFallback:  boolean;
  debugError:  string | null;
}

async function fetchValuation(currency: string): Promise<ValuationData> {
  const sbUrl = env.VITE_SUPABASE_URL;
  const sbKey = env.VITE_SUPABASE_ANON_KEY;

  if (!sbUrl || !sbKey) throw new Error('Supabase não configurado');

  const res = await fetch(`${sbUrl}/functions/v1/mrp-valuation-agent`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey:         sbKey,
      Authorization:  `Bearer ${sbKey}`,
    },
    body: JSON.stringify({ currency }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`mrp-valuation-agent ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<ValuationData>;
}

export function useMrpValuation(currency = 'BRL') {
  return useQuery<DataState<ValuationData>>({
    queryKey: ['mrp', 'valuation', currency],
    queryFn: async (): Promise<DataState<ValuationData>> => {
      try {
        const data = await fetchValuation(currency);
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('MRP valuation agent failed', { error: String(err) }, 'mrp-valuation');
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       5 * 60_000,  // 5 min — dados de estoque não mudam a cada segundo
    refetchInterval: 10 * 60_000, // revalida a cada 10 min
    retry:  1,
    retryDelay: 3_000,
  });
}
