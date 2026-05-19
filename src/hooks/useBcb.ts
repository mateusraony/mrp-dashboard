/**
 * useBcb.ts — TanStack Query hook para dados do BCB (Banco Central do Brasil)
 *
 * Dados: SELIC (% a.a.), IPCA (% ao mês), USDBRL (R$ por USD)
 * Fonte: BCB OpenData — sem autenticação
 * Frequência: BCB atualiza diariamente → poll a cada 4h é suficiente
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBcbData, type BcbData } from '@/services/bcb';
import { IS_LIVE } from '@/lib/env';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

const EMPTY_BCB: BcbData = {
  selic:      0,
  ipca:       0,
  usdbrl:     0,
  updated_at: 0,
  quality:    'B',
  source:     '',
};

/**
 * useBcbData — SELIC, IPCA e USDBRL via BCB OpenData
 * staleTime: 4h — dados diários, não precisam de refresco frequente
 */
export function useBcbData() {
  return useQuery({
    queryKey:        ['bcb', 'macro'],
    queryFn: async (): Promise<DataState<BcbData>> => {
      try {
        const data = await withCache('bcb:macro', 14400, 'bcb', fetchBcbData);
        reportApiRecovery('bcb');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('BCB fetch failed', { error: String(err) }, 'bcb');
        reportApiFailure('bcb');
        const stale = await getStaleCache<BcbData>('bcb:macro');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       4 * 60 * 60 * 1000,                   // 4h
    refetchInterval: IS_LIVE ? 4 * 60 * 60 * 1000 : false, // 4h em live, desligado em mock
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<BcbData>) => {
      const data = state.data ?? EMPTY_BCB;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}
