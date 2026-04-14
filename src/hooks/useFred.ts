/**
 * useFred.ts — TanStack Query hooks para dados macro (FRED API)
 *
 * FRED atualiza dados uma vez por dia (não intraday).
 * Requer VITE_FRED_API_KEY — sem key: retorna mock sem erro de rede.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchMacroBoard, fetchYieldCurve, fetchGlobalLiquidity } from '@/services/fred';

// FRED atualiza 1x/dia — poll a cada 1h é suficiente
const MACRO_INTERVAL = IS_LIVE ? 3_600_000 : false;

/**
 * useMacroBoard — S&P 500, DXY, Gold, VIX, US10Y, US2Y com histórico 30d
 * Atualiza a cada 1h em modo live.
 */
export function useMacroBoard() {
  return useQuery({
    queryKey: ['macro', 'board'],
    queryFn:  fetchMacroBoard,
    staleTime: 3_500_000,
    refetchInterval: MACRO_INTERVAL,
  });
}

/**
 * useYieldCurve — spread 10Y-2Y, Fed Funds Rate, histórico
 */
export function useYieldCurve() {
  return useQuery({
    queryKey: ['macro', 'yield-curve'],
    queryFn:  fetchYieldCurve,
    staleTime: 3_500_000,
    refetchInterval: MACRO_INTERVAL,
  });
}

/**
 * useGlobalLiquidity — Fed BS, RRP, TGA, Net Liquidity, Real Yield, Term Premium, DXY
 * FRED atualiza dados semanais/diários — poll 1h é suficiente.
 */
export function useGlobalLiquidity() {
  return useQuery({
    queryKey: ['macro', 'global-liquidity'],
    queryFn:  fetchGlobalLiquidity,
    staleTime: 3_500_000,
    refetchInterval: IS_LIVE ? 3_600_000 : false,
  });
}
