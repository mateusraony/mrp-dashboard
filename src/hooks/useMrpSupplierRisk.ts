/**
 * useMrpSupplierRisk — Feature C: Score de Risco de Fornecedores
 * Chama a Edge Function mrp-supplier-risk-agent e retorna scores calculados.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { env }      from '@/lib/env';
import { logError } from '@/lib/debugLog';

export interface SupplierScoreBreakdown {
  punctuality:   number;
  lead_time:     number;
  cancellation:  number;
  concentration: number;
  geo_risk:      number;
}

export interface SupplierRiskLine {
  supplier_id:       string;
  name:              string;
  country:           string;
  category:          string;
  risk_score:        number;
  risk_label:        'Baixo' | 'Moderado' | 'Alto' | 'Crítico';
  on_time_rate_pct:  number;
  avg_lead_time:     number;
  total_pos:         number;
  late_pos:          number;
  cancelled_pos:     number;
  total_spend:       number;
  spend_share_pct:   number;
  score_breakdown:   SupplierScoreBreakdown;
}

export interface SupplierRiskData {
  generated_at:       string;
  suppliers_analyzed: number;
  high_risk_count:    number;
  total_spend:        number;
  suppliers:          SupplierRiskLine[];
  ai_analysis:        string;
}

interface DataState<T> {
  data:        T | null;
  lastUpdated: string | null;
  isFallback:  boolean;
  debugError:  string | null;
}

async function fetchSupplierRisk(): Promise<SupplierRiskData> {
  const sbUrl = env.VITE_SUPABASE_URL;
  const sbKey = env.VITE_SUPABASE_ANON_KEY;

  if (!sbUrl || !sbKey) throw new Error('Supabase não configurado');

  const res = await fetch(`${sbUrl}/functions/v1/mrp-supplier-risk-agent`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey:         sbKey,
      Authorization:  `Bearer ${sbKey}`,
    },
    body: '{}',
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`mrp-supplier-risk-agent ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<SupplierRiskData>;
}

export function useMrpSupplierRisk() {
  return useQuery<DataState<SupplierRiskData>>({
    queryKey: ['mrp', 'supplier-risk'],
    queryFn: async (): Promise<DataState<SupplierRiskData>> => {
      try {
        const data = await fetchSupplierRisk();
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('MRP supplier risk agent failed', { error: String(err) }, 'mrp-supplier-risk');
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       15 * 60_000, // 15 min — risk score não muda com alta frequência
    refetchInterval: 30 * 60_000, // revalida a cada 30 min
    retry:  1,
    retryDelay: 3_000,
  });
}

/** Mutation para forçar reavaliação manual de risco */
export function useReevaluateSupplierRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchSupplierRisk,
    onSuccess: (data) => {
      queryClient.setQueryData<DataState<SupplierRiskData>>(['mrp', 'supplier-risk'], {
        data,
        lastUpdated: new Date().toISOString(),
        isFallback:  false,
        debugError:  null,
      });
    },
    onError: (err) => {
      logError('MRP supplier risk manual trigger failed', { error: String(err) }, 'mrp-supplier-risk');
    },
  });
}
