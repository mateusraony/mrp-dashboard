/**
 * useSoSoValue.ts — TanStack Query hooks para SoSoValue ETF API
 *
 * Requer VITE_SOSOVALUE_KEY no .env.local.
 * Registre-se gratuitamente em: https://sosovalue.com/developer
 *
 * staleTime: 30min | refetchInterval: 60min (dados D-1 — não muda em intraday)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE, env } from '@/lib/env';
import { fetchEtfSummary, fetchEtfFlowHistory, type EtfSummary, type EtfDailyFlow } from '@/services/sosovalue';

const hasKey = () => !!env.VITE_SOSOVALUE_KEY;

/**
 * useEtfSummary — AUM total + flows por fundo (lista completa) via SoSoValue.
 * Retorna null quando a chave não está configurada ou a API falha.
 */
export function useEtfSummary() {
  return useQuery<EtfSummary | null>({
    queryKey:        ['sosovalue', 'etf-summary'],
    queryFn:         fetchEtfSummary,
    staleTime:       30 * 60_000,
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           1,
    enabled:         IS_LIVE && hasKey(),
  });
}

/**
 * useEtfFlowHistory — histórico diário de flows (últimos N dias) via SoSoValue.
 * Retorna null quando a chave não está configurada ou a API falha.
 */
export function useEtfFlowHistory(days = 30) {
  return useQuery<EtfDailyFlow[] | null>({
    queryKey:        ['sosovalue', 'etf-history', days],
    queryFn:         () => fetchEtfFlowHistory(days),
    staleTime:       30 * 60_000,
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           1,
    enabled:         IS_LIVE && hasKey(),
  });
}
