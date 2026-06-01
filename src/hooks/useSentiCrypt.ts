/**
 * useSentiCrypt.ts — Hook para sentimento cripto via SentiCrypt
 *
 * Padrão DataState: withCache(7200s/2h) → fallback getStaleCache → isFallback.
 * SentiCrypt atualiza ~2h, sem autenticação, CORS-friendly.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchSentiCrypt, type SentiCryptData } from '@/services/sentiCrypt';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

const EMPTY: SentiCryptData = { date: '', sentiment: 0, count: 0 };

export function useSentiCrypt() {
  return useQuery({
    queryKey: ['senticrypt', 'latest'],
    queryFn: async (): Promise<DataState<SentiCryptData>> => {
      try {
        const data = await withCache<SentiCryptData>(
          'senticrypt:latest',
          7200,
          'senticrypt',
          fetchSentiCrypt,
        );
        reportApiRecovery('senticrypt');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('SentiCrypt fetch failed', { error: String(err) }, 'senticrypt');
        reportApiFailure('senticrypt');
        const stale = await getStaleCache<SentiCryptData>('senticrypt:latest');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       7_000_000,   // ~2h, alinha com update do SentiCrypt
    refetchInterval: IS_LIVE ? 2 * 60 * 60_000 : false,
    retry: 1,
    enabled: IS_LIVE,
    select: (state: DataState<SentiCryptData>) => {
      const data = state.data ?? EMPTY;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}
