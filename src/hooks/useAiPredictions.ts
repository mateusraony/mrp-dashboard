/**
 * useAiPredictions — TanStack Query hooks para persistência de previsões AI.
 * Sprint 8.2: AI Track Record live.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  fetchRecentPredictions,
  persistPrediction,
  evaluateOutcomes,
  type AiPrediction,
} from '@/services/aiPredictions';
import type { RuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';

const QUERY_KEY = ['supabase', 'ai-predictions'] as const;

/**
 * useAiPredictions — busca previsões recentes e avalia outcomes PENDING.
 * Retorna [] quando Supabase não está configurado (Dashboard usa AI_HISTORY como fallback).
 */
export function useAiPredictions(currentPrice?: number) {
  const { data: predictions = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn:  () => fetchRecentPredictions(10),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  // Avalia outcomes PENDING sempre que o preço atualiza
  useEffect(() => {
    if (!currentPrice || predictions.length === 0) return;
    evaluateOutcomes(predictions, currentPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice]);

  return { predictions, isLoading };
}

/**
 * usePersistPrediction — mutation para persistir uma nova previsão.
 * Invalida a query ao suceder para refresh automático da lista.
 */
export function usePersistPrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      overall,
      price,
      modules,
    }: {
      overall: RuleBasedAnalysis['overall'];
      price:   number;
      modules: RuleBasedAnalysis['modules'];
    }) => persistPrediction(overall, price, modules),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export type { AiPrediction };
