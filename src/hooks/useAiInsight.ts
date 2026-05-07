/**
 * useAiInsight — análise institucional em linguagem natural via Claude Haiku 4.5
 *
 * Cache de 15 minutos: uma chamada por sessão de mercado.
 * Só executa quando IS_LIVE && Supabase configurado.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAiInsight, type AiInsightPayload } from '@/services/aiInsight';
import { IS_LIVE } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';

export function useAiInsight(payload: AiInsightPayload | null) {
  const enabled = IS_LIVE && isSupabaseConfigured() && payload !== null;

  return useQuery({
    queryKey: [
      'ai-insight',
      payload?.riskScore,
      payload?.fearGreedValue,
      payload?.mtfConfluence,
      payload?.fundingRate,
    ],
    queryFn:   () => fetchAiInsight(payload!),
    enabled,
    staleTime: 15 * 60 * 1000,
    retry:     1,
  });
}
