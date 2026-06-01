/**
 * useRedditSentiment.ts — Top posts de r/Bitcoin com sentimento por título
 *
 * Padrão DataState: withCache(1800s/30min) → fallback getStaleCache → isFallback.
 * Reddit JSON API pública, sem autenticação, CORS liberado.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchRedditBitcoinPosts, type RedditBitcoinPost } from '@/services/reddit';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

export function useRedditSentiment(limit = 25) {
  return useQuery({
    queryKey: ['reddit', 'bitcoin', 'sentiment', limit],
    queryFn: async (): Promise<DataState<RedditBitcoinPost[]>> => {
      try {
        const data = await withCache<RedditBitcoinPost[]>(
          `reddit:bitcoin:top:${limit}`,
          1800,
          'reddit',
          () => fetchRedditBitcoinPosts(limit),
          (v) => Array.isArray(v) && (v as RedditBitcoinPost[]).length > 0 ? v as RedditBitcoinPost[] : null,
        );
        reportApiRecovery('reddit');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Reddit Bitcoin sentiment fetch failed', { error: String(err), limit }, 'reddit-sentiment');
        reportApiFailure('reddit');
        const stale = await getStaleCache<RedditBitcoinPost[]>(`reddit:bitcoin:top:${limit}`);
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       25 * 60_000,
    refetchInterval: IS_LIVE ? 30 * 60_000 : false,
    retry: 1,
    enabled: IS_LIVE,
    select: (state: DataState<RedditBitcoinPost[]>) => ({
      posts:       state.data ?? [],
      isFallback:  state.isFallback,
      lastUpdated: state.lastUpdated,
    }),
  });
}
