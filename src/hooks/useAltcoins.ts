/**
 * useAltcoins.ts — TanStack Query hooks para dados de altcoins
 *
 * Fonte: CoinGecko /coins/markets (free tier, sem auth)
 * Rate limit: 30 req/min — staleTime 5min é conservador o suficiente.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchAltcoinsExtended, type AltcoinsExtendedData } from '@/services/altcoins';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

const ALT_INTERVAL = IS_LIVE ? 300_000 : false;  // 5min — respeita rate limit CoinGecko

const EMPTY_ALTCOINS: AltcoinsExtendedData = {
  alts:           [],
  altSeasonIndex: {
    value:             0,
    phase:             'neutral',
    signal:            '',
    top_outperformers: [],
    total_alts:        0,
    alts_above_btc:    0,
  },
  altSeasonTrend: [],
  sectorRotation: [],
  btcRet7d:       0,
  btcRet30d:      0,
  btcRet90d:      0,
  dataSource:     'coingecko',
  updated_at:     0,
};

/**
 * useAltcoinsData — top 50 altcoins + Alt Season Index + rotação setorial
 *
 * Em modo mock → dados simulados com 5 altcoins representativas.
 * Em modo live → refetch a cada 5 minutos.
 */
export function useAltcoinsData(limit = 50) {
  return useQuery({
    queryKey:        ['altcoins', 'extended', limit],
    queryFn: async (): Promise<DataState<AltcoinsExtendedData>> => {
      try {
        const data = await withCache(
          `coingecko:altcoins-ext:${limit}`,
          300,
          'coingecko',
          () => fetchAltcoinsExtended(limit),
        );
        reportApiRecovery('coingecko');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Altcoins fetch failed', { error: String(err) }, 'altcoins');
        reportApiFailure('coingecko');
        const stale = await getStaleCache<AltcoinsExtendedData>(`coingecko:altcoins-ext:${limit}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       290_000,                        // 4m50s
    refetchInterval: ALT_INTERVAL,
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<AltcoinsExtendedData>) => {
      const data = state.data ?? EMPTY_ALTCOINS;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}
