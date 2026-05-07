/**
 * useAiInsight — análise institucional em linguagem natural via Claude Haiku 4.5
 *
 * Cache de 15 minutos: uma chamada por janela de 15min, independente de
 * flutuações nos dados live. A chave usa um time-bucket em vez dos valores
 * das métricas — se usássemos riskScore/fundingRate como chave, cada tick
 * de 30s criaria uma query nova e chamaria a API imediatamente, bypassando
 * o staleTime e multiplicando o custo (~R$2/mês → centenas de chamadas).
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAiInsight, type AiInsightPayload } from '@/services/aiInsight';
import { IS_LIVE } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';

const BUCKET_MS = 15 * 60 * 1000;

export function useAiInsight(payload: AiInsightPayload | null) {
  const enabled = IS_LIVE && isSupabaseConfigured() && payload !== null;
  // Agrupa todas as chamadas dentro da mesma janela de 15min na mesma cache key
  const timeBucket = Math.floor(Date.now() / BUCKET_MS);

  return useQuery({
    queryKey: ['ai-insight', timeBucket],
    queryFn:  () => fetchAiInsight(payload!),
    enabled,
    staleTime: BUCKET_MS,
    retry:     1,
  });
}
