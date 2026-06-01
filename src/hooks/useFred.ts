/**
 * useFred.ts — TanStack Query hooks para dados macro (FRED API)
 *
 * FRED atualiza dados uma vez por dia (não intraday).
 * Requer Supabase configurado (FRED_API_KEY em Supabase Secrets) — sem isso: retorna mock.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchMacroBoard, fetchYieldCurve, fetchGlobalLiquidity, fetchCreditSpread } from '@/services/fred';
import type { MacroBoardData, YieldCurveData, GlobalLiquidityData, CreditSpreadData } from '@/services/fred';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import type { DataState } from '@/hooks/useBtcData';

// FRED atualiza 1x/dia — poll a cada 1h é suficiente
const MACRO_INTERVAL = IS_LIVE ? 3_600_000 : false;

// ─── Empty states ─────────────────────────────────────────────────────────────

const EMPTY_MACRO_BOARD: MacroBoardData = { series: [], updated_at: 0 };

const EMPTY_YIELD_CURVE: YieldCurveData = {
  spread_10y2y: 0,
  fed_funds:    0,
  history_10y:  [],
  history_2y:   [],
  updated_at:   0,
};

const EMPTY_GLOBAL_LIQUIDITY: GlobalLiquidityData = {
  fed_balance_b:       0,
  fed_balance_chg_4w:  0,
  rrp_b:               0,
  rrp_trend:           'stable',
  tga_b:               0,
  tga_trend:           'stable',
  real_yield_10y:      0,
  term_premium_10y:    0,
  dollar_index:        0,
  net_liquidity:       0,
  net_liquidity_signal: '',
  history:             [],
  quality:             'A',
  source:              'FRED',
  updated_at:          0,
};

const EMPTY_CREDIT_SPREAD: CreditSpreadData = {
  hy_spread_bp: 0,
  ig_spread_bp: 0,
  prev_7d_hy:   0,
  prev_30d_hy:  0,
  delta_7d_bp:  0,
  delta_30d_bp: 0,
  regime:       'stable',
  history:      [],
  quality:      'C',
  updated_at:   0,
};

/**
 * useMacroBoard — S&P 500, DXY, Gold, VIX, US10Y, US2Y com histórico 30d
 * Atualiza a cada 1h em modo live.
 */
export function useMacroBoard() {
  return useQuery({
    queryKey: ['macro', 'board'],
    queryFn: async (): Promise<DataState<MacroBoardData>> => {
      try {
        const data = await withCache('fred:macro-board', 3600, 'fred', fetchMacroBoard);
        reportApiRecovery('fred');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('MacroBoard fetch failed', { error: String(err) }, 'macro-board');
        reportApiFailure('fred');
        const stale = await getStaleCache<MacroBoardData>('fred:macro-board');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 3_500_000,
    refetchInterval: MACRO_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<MacroBoardData>) => {
      const data = state.data ?? EMPTY_MACRO_BOARD;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useYieldCurve — spread 10Y-2Y, Fed Funds Rate, histórico
 */
export function useYieldCurve() {
  return useQuery({
    queryKey: ['macro', 'yield-curve'],
    queryFn: async (): Promise<DataState<YieldCurveData>> => {
      try {
        const data = await withCache('fred:yield-curve', 3600, 'fred', fetchYieldCurve);
        reportApiRecovery('fred');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('YieldCurve fetch failed', { error: String(err) }, 'yield-curve');
        reportApiFailure('fred');
        const stale = await getStaleCache<YieldCurveData>('fred:yield-curve');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 3_500_000,
    refetchInterval: MACRO_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<YieldCurveData>) => {
      const data = state.data ?? EMPTY_YIELD_CURVE;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useGlobalLiquidity — Fed BS, RRP, TGA, Net Liquidity, Real Yield, Term Premium, DXY
 * FRED atualiza dados semanais/diários — poll 6h é suficiente.
 */
export function useGlobalLiquidity() {
  return useQuery({
    queryKey: ['macro', 'global-liquidity'],
    queryFn: async (): Promise<DataState<GlobalLiquidityData>> => {
      try {
        const data = await withCache('fred:global-liquidity', 21600, 'fred', fetchGlobalLiquidity);
        reportApiRecovery('fred');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('GlobalLiquidity fetch failed', { error: String(err) }, 'global-liquidity');
        reportApiFailure('fred');
        const stale = await getStaleCache<GlobalLiquidityData>('fred:global-liquidity');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 3_500_000,
    refetchInterval: IS_LIVE ? 6 * 3_600_000 : false,  // 6h — dados semanais
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<GlobalLiquidityData>) => {
      const data = state.data ?? EMPTY_GLOBAL_LIQUIDITY;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useCreditSpread — HY e IG Credit Spread (OAS) via FRED
 * BAMLH0A0HYM2 (HY) + BAMLC0A0CM (IG) — gratuito com FRED_API_KEY.
 * Atualiza diariamente — poll 1h.
 */
export function useCreditSpread() {
  return useQuery({
    queryKey: ['macro', 'credit-spread'],
    queryFn: async (): Promise<DataState<CreditSpreadData>> => {
      try {
        const data = await withCache('fred:credit-spread', 3600, 'fred', fetchCreditSpread);
        reportApiRecovery('fred');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('CreditSpread fetch failed', { error: String(err) }, 'credit-spread');
        reportApiFailure('fred');
        const stale = await getStaleCache<CreditSpreadData>('fred:credit-spread');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 3_500_000,
    refetchInterval: MACRO_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<CreditSpreadData>) => {
      const data = state.data ?? EMPTY_CREDIT_SPREAD;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}
