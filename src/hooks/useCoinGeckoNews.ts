/**
 * useCoinGeckoNews.ts — Notícias cripto via CoinGecko /news
 *
 * Gratuito, sem autenticação. staleTime 5min, refetch 10min em live.
 * Implementa padrão DataState<T> com fallback para cache Supabase.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchCoinGeckoNews, type CoinGeckoNewsItem } from '@/services/coingecko';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { readModuleFlag } from '@/lib/moduleFlags';
import type { DataState } from '@/hooks/useBtcData';

export type { CoinGeckoNewsItem };

export function useCoinGeckoNews() {
  return useQuery({
    queryKey:        ['coingecko', 'news'],
    queryFn:         async (): Promise<DataState<CoinGeckoNewsItem[]>> => {
      try {
        const items = await withCache<CoinGeckoNewsItem[]>(
          'crypto:news:v3',   // v3 = busts any stale empty [] from previous keys
          1800,
          'coingecko',
          fetchCoinGeckoNews,
          (v) => Array.isArray(v) && (v as CoinGeckoNewsItem[]).length > 0 ? v as CoinGeckoNewsItem[] : null,
        );
        reportApiRecovery('coingecko_news');
        return { data: items, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('CoinGecko news fetch failed', { error: String(err) }, 'coingecko-news');
        reportApiFailure('coingecko_news');
        const stale = await getStaleCache<CoinGeckoNewsItem[]>('crypto:news:v3');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       5 * 60_000,
    refetchInterval: IS_LIVE ? 10 * 60_000 : false,
    retry:           1,
    enabled:         IS_LIVE && readModuleFlag('ENABLE_NEWS'),
    select:          (state: DataState<CoinGeckoNewsItem[]>) => ({
      items:       state.data ?? [],
      isFallback:  state.isFallback,
      lastUpdated: state.lastUpdated,
    }),
  });
}
