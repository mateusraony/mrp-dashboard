/**
 * useBtcCorrelations.ts — Hook TanStack Query para correlações BTC × Ativos Globais
 *
 * Computa Pearson rolling usando BTC klines (Binance) + séries macro (FRED).
 * Cache 1h — correlações mudam devagar.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBtcCorrelations, BtcCorrelationsData } from '@/services/btcCorrelations';
import { withCache } from '@/services/marketCache';
import { logError, logInfo } from '@/lib/debugLog';
import { reportApiFailure } from '@/lib/apiHealthMonitor';
import { IS_LIVE } from '@/lib/env';

export interface DataState<T> {
  data:        T | null;
  lastUpdated: string | null;
  isFallback:  boolean;
  debugError:  string | null;
}

export function useBtcCorrelations() {
  return useQuery({
    queryKey:    ['btc', 'correlations'],
    queryFn:     async (): Promise<DataState<BtcCorrelationsData>> => {
      try {
        const data = await withCache(
          'btc:correlations',
          3600,
          'btc_correlations',
          fetchBtcCorrelations,
        );
        logInfo('BTC correlations ok', { pairs: data.pairs.length }, 'btc-corr');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('BTC correlations failed', { error: String(err) }, 'btc-corr');
        reportApiFailure('btc_correlations');
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       3_600_000,
    refetchInterval: IS_LIVE ? 3_600_000 : false,
    retry:           1,
    retryDelay:      5_000,
  });
}
