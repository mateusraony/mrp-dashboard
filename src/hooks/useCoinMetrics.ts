/**
 * useCoinMetrics.ts — TanStack Query hooks para CoinMetrics Community API
 *
 * Dados:
 *   useOnChainCycle   — MVRV Z-Score, NUPL, Realized Price/Cap, NVT
 *   useOnChainExtended — CDD, HODL Waves proxy, Dormancy
 *
 * Fonte: CoinMetrics Community (gratuito, sem API key, qualidade A)
 * Atualização: 1x/dia (dados on-chain não são intraday)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchOnChainCycle, fetchOnChainExtended } from '@/services/coinmetrics';
import { readModuleFlag } from '@/lib/moduleFlags';

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
    queryKey:        ['onchain', 'cycle'],
    queryFn:         fetchOnChainCycle,
    staleTime:       3_500_000,
    refetchInterval: ONCHAIN_CYCLE_INTERVAL,
    enabled:         readModuleFlag('ENABLE_COINMETRICS'),
  });
}

/**
 * useOnChainExtended — CDD, HODL Waves proxy, Dormancy
 *
 * Em modo live: busca CoinDaysDestroyed, SplyAdr1yrPlus, SplyAct1yr,
 *   AdrActCnt e VelCur1yr da CoinMetrics Community API (últimos 90 dias).
 * Em modo mock: retorna valores simulados razoáveis (quality B).
 * Atualiza a cada 1h em modo live.
 */
export function useOnChainExtended() {
  return useQuery({
    queryKey:        ['onchain', 'extended'],
    queryFn:         fetchOnChainExtended,
    staleTime:       3_500_000,
    refetchInterval: IS_LIVE ? 3_600_000 : false,
    enabled:         readModuleFlag('ENABLE_COINMETRICS'),
  });
}
