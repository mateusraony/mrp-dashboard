/**
 * useGdelt.ts — TanStack Query hooks para notícias via GDELT DOC 2.0
 *
 * GDELT é pública e sem autenticação.
 * staleTime: 5min | refetchInterval: 10min em live.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchGdeltNews } from '@/services/gdelt';

const DEFAULT_QUERY = 'bitcoin crypto';

/**
 * useGdeltNews — Notícias cripto em tempo real via GDELT DOC 2.0
 *
 * Em modo mock → retorna array vazio imediatamente (sem chamada de rede).
 * Em modo live → refetch a cada 10 minutos.
 */
export function useGdeltNews(query?: string) {
  return useQuery({
    queryKey:       ['gdelt', 'news', query ?? DEFAULT_QUERY],
    queryFn:        () => fetchGdeltNews(query),
    staleTime:      5 * 60_000,                         // 5 min
    refetchInterval: IS_LIVE ? 10 * 60_000 : false,    // 10 min em live
    retry:          1,
  });
}
