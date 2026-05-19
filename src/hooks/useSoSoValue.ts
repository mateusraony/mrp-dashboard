/**
 * useSoSoValue.ts — TanStack Query hooks para SoSoValue ETF API
 *
 * Requer VITE_SOSOVALUE_KEY no .env.local.
 * Registre-se gratuitamente em: https://sosovalue.com/developer
 *
 * staleTime: 30min | refetchInterval: 60min (dados D-1 — não muda em intraday)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE, env } from '@/lib/env';
import { fetchEtfSummary, fetchEtfFlowHistory, type EtfSummary, type EtfDailyFlow } from '@/services/sosovalue';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

const hasKey = () => !!env.VITE_SOSOVALUE_KEY;

/**
 * useEtfSummary — AUM total + flows por fundo (lista completa) via SoSoValue.
 * Retorna null quando a chave não está configurada ou a API falha.
 */
export function useEtfSummary() {
  return useQuery<DataState<EtfSummary | null>, Error, EtfSummary | null>({
    queryKey:        ['sosovalue', 'etf-summary'],
    queryFn:         async (): Promise<DataState<EtfSummary | null>> => {
      try {
        const data = await withCache('sosovalue:etf-summary', 3600, 'sosovalue', fetchEtfSummary);
        reportApiRecovery('sosovalue');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('ETF summary fetch failed', { error: String(err) }, 'sosovalue-etf-summary');
        reportApiFailure('sosovalue');
        const stale = await getStaleCache<EtfSummary | null>('sosovalue:etf-summary');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    select:          (state) => state.data,
    staleTime:       30 * 60_000,
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           1,
    enabled:         IS_LIVE && hasKey(),
  });
}

/**
 * useEtfFlowHistory — histórico diário de flows (últimos N dias) via SoSoValue.
 * Retorna null quando a chave não está configurada ou a API falha.
 */
export function useEtfFlowHistory(days = 30) {
  return useQuery<DataState<EtfDailyFlow[] | null>, Error, EtfDailyFlow[] | null>({
    queryKey:        ['sosovalue', 'etf-history', days],
    queryFn:         async (): Promise<DataState<EtfDailyFlow[] | null>> => {
      try {
        const data = await withCache(`sosovalue:etf-history:${days}`, 3600, 'sosovalue', () => fetchEtfFlowHistory(days));
        reportApiRecovery('sosovalue');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('ETF flow history fetch failed', { error: String(err) }, 'sosovalue-etf-history');
        reportApiFailure('sosovalue');
        const stale = await getStaleCache<EtfDailyFlow[] | null>(`sosovalue:etf-history:${days}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    select:          (state) => state.data,
    staleTime:       30 * 60_000,
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           1,
    enabled:         IS_LIVE && hasKey(),
  });
}
