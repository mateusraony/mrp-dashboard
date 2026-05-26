/**
 * useMrpReconciler — Feature B: Conciliação Financeira de Compras
 * Chama a Edge Function mrp-reconciler-agent e retorna divergências encontradas.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { env }      from '@/lib/env';
import { logError } from '@/lib/debugLog';

export interface DivergenceItem {
  po_id:         string;
  po_number:     string;
  supplier_name: string;
  po_value:      number;
  total_paid:    number;
  gap:           number;
  type:          'underpayment' | 'overpayment' | 'missing_payment' | 'late_delivery';
  severity:      'critical' | 'warning' | 'info';
  note:          string;
}

export interface ReconciliationData {
  generated_at:       string;
  total_pos_checked:  number;
  divergences_found:  number;
  total_gap_value:    number;
  divergences:        DivergenceItem[];
  summary:            string;
}

interface DataState<T> {
  data:        T | null;
  lastUpdated: string | null;
  isFallback:  boolean;
  debugError:  string | null;
}

async function runReconciliation(): Promise<ReconciliationData> {
  const sbUrl = env.VITE_SUPABASE_URL;
  const sbKey = env.VITE_SUPABASE_ANON_KEY;

  if (!sbUrl || !sbKey) throw new Error('Supabase não configurado');

  const res = await fetch(`${sbUrl}/functions/v1/mrp-reconciler-agent`, {
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
    throw new Error(`mrp-reconciler-agent ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<ReconciliationData>;
}

/** Hook de leitura — executa reconciliação e retorna resultado */
export function useMrpReconciler() {
  return useQuery<DataState<ReconciliationData>>({
    queryKey: ['mrp', 'reconciliation'],
    queryFn: async (): Promise<DataState<ReconciliationData>> => {
      try {
        const data = await runReconciliation();
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('MRP reconciler agent failed', { error: String(err) }, 'mrp-reconciler');
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       2 * 60_000,  // 2 min
    refetchInterval: 5 * 60_000,  // revalida a cada 5 min
    retry:  1,
    retryDelay: 3_000,
  });
}

/** Mutation para forçar reconciliação manual (botão "Reconciliar agora") */
export function useTriggerReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runReconciliation,
    onSuccess: (data) => {
      queryClient.setQueryData<DataState<ReconciliationData>>(['mrp', 'reconciliation'], {
        data,
        lastUpdated: new Date().toISOString(),
        isFallback:  false,
        debugError:  null,
      });
    },
    onError: (err) => {
      logError('MRP reconciler manual trigger failed', { error: String(err) }, 'mrp-reconciler');
    },
  });
}
