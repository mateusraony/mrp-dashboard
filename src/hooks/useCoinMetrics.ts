/**
 * useCoinMetrics.ts — TanStack Query hook para CoinMetrics Community API
 *
 * Dados: MVRV Z-Score, NUPL, Realized Price/Cap, NVT
 * Fonte: CoinMetrics Community (gratuito, sem API key, qualidade A)
 * Atualização: 1x/dia (FRED-like — dados on-chain não são intraday)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchOnChainCycle } from '@/services/coinmetrics';

// Dados on-chain mudam apenas 1x/dia — poll a cada 1h é suficiente
const ONCHAIN_CYCLE_INTERVAL = IS_LIVE ? 3_600_000 : false;

/**
 * useOnChainCycle — MVRV Z-Score, NUPL, Realized Price, NVT
 *
 * Em modo live: busca dados reais da CoinMetrics Community API.
 * Em modo mock: retorna valores simulados baseados no mock data existente.
 * Atualiza a cada 1h em modo live.
 */
export function useOnChainCycle() {
  return useQuery({
    queryKey:       ['onchain', 'cycle'],
    queryFn:        fetchOnChainCycle,
    staleTime:      3_500_000,
    refetchInterval: ONCHAIN_CYCLE_INTERVAL,
  });
}
