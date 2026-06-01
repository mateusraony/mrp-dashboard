/**
 * useWikiPageviews.ts — Pageviews do artigo Bitcoin na Wikipedia (atenção global)
 *
 * API pública da Wikimedia, sem autenticação, CORS-friendly.
 * Lag: ~24h (dado disponível no dia seguinte).
 * Útil como métrica de atenção/interesse: picos correlacionam com ATHs e crashes.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchBtcWikiPageviews, type WikiPageviewPoint } from '@/services/wikiPageviews';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { type DataState } from '@/hooks/useBtcData';

export function useWikiPageviews(days = 7) {
  return useQuery({
    queryKey: ['wiki', 'bitcoin', 'pageviews', days],
    queryFn: async (): Promise<DataState<WikiPageviewPoint[]>> => {
      try {
        const data = await withCache<WikiPageviewPoint[]>(
          `wiki:bitcoin:pageviews:${days}`,
          3600,
          'wikipedia',
          () => fetchBtcWikiPageviews(days),
        );
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Wikipedia pageviews fetch failed', { error: String(err), days }, 'wiki-pageviews');
        const stale = await getStaleCache<WikiPageviewPoint[]>(`wiki:bitcoin:pageviews:${days}`);
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       3_500_000,   // ~1h
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry: 1,
    enabled: IS_LIVE,
    select: (state: DataState<WikiPageviewPoint[]>) => ({
      points:      state.data ?? [],
      isFallback:  state.isFallback,
      lastUpdated: state.lastUpdated,
    }),
  });
}
