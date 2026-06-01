/**
 * useCryptoPanic.ts — Notícias CryptoPanic com votos bullish/bearish da comunidade
 *
 * Requer VITE_CRYPTOPANIC_KEY (gratuita, sem cartão de crédito).
 * Se não configurada, retorna null — sem erro, sem fallback de cache.
 * Se configurada, salva no Supabase cache com TTL de 15min.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchCryptoPanicNews, type CryptoPanicPost } from '@/services/cryptoPanic';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { type DataState } from '@/hooks/useBtcData';

const hasKey = !!import.meta.env.VITE_CRYPTOPANIC_KEY;

export function useCryptoPanic() {
  return useQuery({
    queryKey: ['cryptopanic', 'btc', 'news'],
    queryFn: async (): Promise<DataState<CryptoPanicPost[] | null>> => {
      if (!hasKey) {
        return { data: null, lastUpdated: null, isFallback: false, debugError: 'VITE_CRYPTOPANIC_KEY não configurada' };
      }
      try {
        const data = await withCache<CryptoPanicPost[] | null>(
          'cryptopanic:btc:hot',
          900,
          'cryptopanic',
          fetchCryptoPanicNews,
          (v) => Array.isArray(v) && (v as CryptoPanicPost[]).length > 0 ? v as CryptoPanicPost[] : null,
        );
        reportApiRecovery('cryptopanic');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('CryptoPanic fetch failed', { error: String(err) }, 'cryptopanic');
        reportApiFailure('cryptopanic');
        const stale = await getStaleCache<CryptoPanicPost[]>('cryptopanic:btc:hot');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       10 * 60_000,
    refetchInterval: IS_LIVE && hasKey ? 15 * 60_000 : false,
    retry: 1,
    enabled: IS_LIVE,
    select: (state: DataState<CryptoPanicPost[] | null>) => ({
      posts:       state.data ?? null,
      isFallback:  state.isFallback,
      lastUpdated: state.lastUpdated,
      hasKey,
    }),
  });
}
