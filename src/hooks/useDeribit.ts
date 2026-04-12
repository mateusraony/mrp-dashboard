/**
 * useDeribit.ts — TanStack Query hooks para dados de opções (Deribit)
 *
 * Padrão: refetchInterval só em IS_LIVE, select para transformações de UI.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchOptionsData, fetchDvolHistory } from '@/services/deribit';

// Intervalos de refetch
const OPTIONS_INTERVAL = IS_LIVE ? 60_000  : false;  // 1min quando live
const DVOL_INTERVAL    = IS_LIVE ? 3_600_000 : false; // 1h quando live

/**
 * useOptionsData — IV ATM, term structure, options chain, GEX, PCR, max pain
 * Atualiza a cada 1min em modo live.
 */
export function useOptionsData() {
  return useQuery({
    queryKey: ['options', 'data'],
    queryFn:  fetchOptionsData,
    staleTime: 55_000,
    refetchInterval: OPTIONS_INTERVAL,
  });
}

/**
 * useDvolHistory — histórico do índice DVOL (Deribit Volatility)
 * @param days número de dias de histórico (padrão 30)
 */
export function useDvolHistory(days = 30) {
  return useQuery({
    queryKey: ['options', 'dvol-history', days],
    queryFn:  () => fetchDvolHistory(days),
    staleTime: 3_500_000,
    refetchInterval: DVOL_INTERVAL,
  });
}
