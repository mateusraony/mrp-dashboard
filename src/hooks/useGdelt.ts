/**
 * useGdelt.ts — TanStack Query hooks para notícias via GDELT DOC 2.0
 *
 * GDELT é pública e sem autenticação.
 * staleTime: 5min | refetchInterval: 10min em live.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchGdeltNews, fetchGdeltMentionsTimeline, type GdeltArticleEnriched, type GdeltTimelinePoint } from '@/services/gdelt';
import { fetchGdeltSentimentHistory, upsertGdeltArticles, type GdeltDaySentiment } from '@/services/supabase';
import { readModuleFlag } from '@/lib/moduleFlags';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { DataState } from '@/hooks/useBtcData';

// Re-exportar tipo para uso por consumidores deste hook
export type { GdeltTimelinePoint };

const DEFAULT_QUERY = 'bitcoin crypto';

/**
 * useGdeltNews — Notícias cripto em tempo real via GDELT DOC 2.0
 *
 * Em modo mock → retorna array vazio imediatamente (sem chamada de rede).
 * Em modo live → refetch a cada 10 minutos.
 * Implementa padrão DataState<T> com fallback para cache Supabase.
 */
export function useGdeltNews(query?: string) {
  const resolvedQuery = query ?? DEFAULT_QUERY;
  return useQuery({
    queryKey:       ['gdelt', 'news', resolvedQuery],
    queryFn:        async (): Promise<DataState<GdeltArticleEnriched[]>> => {
      try {
        const articles = await withCache<GdeltArticleEnriched[]>(
          `gdelt:news:${resolvedQuery}`,
          1800,   // 30 min — reduce GDELT hit frequency to avoid 429s
          'gdelt',
          () => fetchGdeltNews(resolvedQuery),
        );
        // Persiste no Supabase para histórico — fire-and-forget, não bloqueia UI
        if (IS_LIVE && articles.length > 0) {
          upsertGdeltArticles(
            articles.map(a => ({
              url:             a.url,
              title:           a.title,
              domain:          a.domain,
              published_at:    a.published_at,
              sentiment:       a.sentiment,
              sentiment_label: a.sentiment_label,
              query:           resolvedQuery,
            }))
          ).catch(() => {});
        }
        reportApiRecovery('gdelt');
        return { data: articles, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('GDELT news fetch failed', { error: String(err), query: resolvedQuery }, 'gdelt-news');
        reportApiFailure('gdelt');
        const stale = await getStaleCache<GdeltArticleEnriched[]>(`gdelt:news:${resolvedQuery}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       5 * 60_000,                         // 5 min
    refetchInterval: IS_LIVE ? 10 * 60_000 : false,     // 10 min em live
    retry:           1,
    enabled:         readModuleFlag('ENABLE_NEWS'),
    select:          (state: DataState<GdeltArticleEnriched[]>) => state.data ?? [],
  });
}

/**
 * useGdeltHistory — tendência de sentimento histórico (gdelt_articles Supabase)
 * Retorna array vazio quando Supabase não está configurado ou tabela vazia.
 * Lê diretamente do Supabase — sem DataState necessário.
 */
export function useGdeltHistory(days = 7) {
  return useQuery<GdeltDaySentiment[]>({
    queryKey:        ['gdelt', 'history', days],
    queryFn:         () => fetchGdeltSentimentHistory(days),
    staleTime:       5 * 60_000,
    refetchInterval: IS_LIVE ? 10 * 60_000 : false,
    retry:           0,
    enabled:         readModuleFlag('ENABLE_NEWS'),
  });
}

/** useGdeltMentionsTimeline — volume de artigos Bitcoin por hora (últimas 24h via GDELT timelinevolraw)
 * Implementa padrão DataState<T> com fallback para cache Supabase.
 */
export function useGdeltMentionsTimeline() {
  return useQuery({
    queryKey:        ['gdelt', 'mentions-timeline'],
    queryFn:         async (): Promise<DataState<GdeltTimelinePoint[]>> => {
      try {
        const points = await withCache<GdeltTimelinePoint[]>(
          'gdelt:mentions-timeline',
          600,
          'gdelt',
          fetchGdeltMentionsTimeline,
        );
        reportApiRecovery('gdelt');
        return { data: points, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('GDELT mentions timeline fetch failed', { error: String(err) }, 'gdelt-timeline');
        reportApiFailure('gdelt');
        const stale = await getStaleCache<GdeltTimelinePoint[]>('gdelt:mentions-timeline');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    refetchInterval: IS_LIVE ? 15 * 60_000 : false,
    staleTime:       10 * 60_000,
    retry:           1,
    enabled:         IS_LIVE && readModuleFlag('ENABLE_NEWS'),
    select:          (state: DataState<GdeltTimelinePoint[]>) => state.data ?? [],
  });
}
