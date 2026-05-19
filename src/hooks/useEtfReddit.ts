import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchEtfRedditPosts, type RedditPost } from '@/services/reddit';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

export function useEtfRedditPosts() {
  return useQuery({
    queryKey:        ['etf', 'reddit'],
    queryFn: async (): Promise<DataState<RedditPost[]>> => {
      try {
        const data = await withCache('reddit:etf', 1800, 'reddit', fetchEtfRedditPosts);
        reportApiRecovery('reddit');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('ETF Reddit posts fetch failed', { error: String(err) }, 'reddit');
        reportApiFailure('reddit');
        const stale = await getStaleCache<RedditPost[]>('reddit:etf');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       30 * 60_000,   // 30 min
    refetchInterval: IS_LIVE ? 30 * 60_000 : false,
    retry:           1,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<RedditPost[]>) => state.data ?? [],
  });
}
