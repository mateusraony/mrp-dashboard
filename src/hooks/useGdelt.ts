/**
 * useGdelt.ts — TanStack Query hooks para notícias via GDELT DOC 2.0
 *
 * GDELT é pública e sem autenticação.
 * staleTime: 5min | refetchInterval: 10min em live.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchGdeltNews } from '@/services/gdelt';
import { fetchGdeltSentimentHistory, upsertGdeltArticles, type GdeltDaySentiment } from '@/services/supabase';

const DEFAULT_QUERY = 'bitcoin crypto';

/**
 * useGdeltNews — Notícias cripto em tempo real via GDELT DOC 2.0
 *
 * Em modo mock → retorna array vazio imediatamente (sem chamada de rede).
 * Em modo live → refetch a cada 10 minutos.
 */
export function useGdeltNews(query?: string) {
  const resolvedQuery = query ?? DEFAULT_QUERY;
  return useQuery({
    queryKey:       ['gdelt', 'news', resolvedQuery],
    queryFn:        async () => {
      const articles = await fetchGdeltNews(resolvedQuery);
      // Persiste no Supabase para histórico — fire-and-forget, não bloqueia UI
      if (IS_LIVE && articles.length > 0) {
        upsertGdeltArticles(
          articles.map(a => ({
            url:          a.url,
            title:        a.title,
            source:       a.domain,
            published_at: a.published_at,
            sentiment:    a.sentiment,
            query:        resolvedQuery,
          }))
        ).catch(() => {});
      }
      return articles;
    },
    staleTime:      5 * 60_000,                         // 5 min
    refetchInterval: IS_LIVE ? 10 * 60_000 : false,    // 10 min em live
    retry:          1,
  });
}

/**
 * useGdeltHistory — tendência de sentimento histórico (gdelt_articles Supabase)
 * Retorna array vazio quando Supabase não está configurado ou tabela vazia.
 */
export function useGdeltHistory(days = 7) {
  return useQuery<GdeltDaySentiment[]>({
    queryKey:        ['gdelt', 'history', days],
    queryFn:         () => fetchGdeltSentimentHistory(days),
    staleTime:       5 * 60_000,
    refetchInterval: IS_LIVE ? 10 * 60_000 : false,
    retry:           0,
  });
}
