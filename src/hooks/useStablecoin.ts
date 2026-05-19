import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchStablecoinData, type StablecoinData } from '@/services/defillama';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

const EMPTY_STABLECOIN: StablecoinData = {
  totalSupply:   0,
  totalChange24h: 0,
  top5:          [],
  byChain:       [],
  updatedAt:     0,
  quality:       'C',
  source:        'mock',
};

export function useStablecoinData() {
  return useQuery({
    queryKey:        ['stablecoin', 'data'],
    queryFn: async (): Promise<DataState<StablecoinData>> => {
      try {
        const data = await withCache('defillama:stablecoin', 3600, 'defillama', fetchStablecoinData);
        reportApiRecovery('defillama');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Stablecoin fetch failed', { error: String(err) }, 'defillama');
        reportApiFailure('defillama');
        const stale = await getStaleCache<StablecoinData>('defillama:stablecoin');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       58 * 60_000,   // 58 min
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<StablecoinData>) => {
      const data = state.data ?? EMPTY_STABLECOIN;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}
