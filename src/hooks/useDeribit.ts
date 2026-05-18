/**
 * useDeribit.ts — TanStack Query hooks para dados de opções (Deribit)
 *
 * Padrão: DataState<T> com withCache + fallback getStaleCache (Regra de Ouro #1).
 * refetchInterval só em IS_LIVE, select para transformações de UI.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchOptionsData, fetchDvolHistory, OptionsData } from '@/services/deribit';
import { readModuleFlag } from '@/lib/moduleFlags';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { DataState } from '@/hooks/useBtcData';

// Intervalos de refetch
const OPTIONS_INTERVAL = IS_LIVE ? 60_000    : false;  // 1min quando live
const DVOL_INTERVAL    = IS_LIVE ? 3_600_000 : false;  // 1h quando live

// Estado vazio para fallback de useOptionsData
const EMPTY_OPTIONS: OptionsData = {
  spot: 0,
  iv_atm: 0,
  dvol_history: [],
  term_structure: [],
  chain: [],
  put_call_ratio_oi: 0,
  put_call_ratio_vol: 0,
  max_pain: 0,
  gamma_exposure_usd: 0,
  quality: 'C' as const,
};

/**
 * useOptionsData — IV ATM, term structure, options chain, GEX, PCR, max pain
 * Padrão DataState: withCache(60s) → fallback getStaleCache → isFallback=true.
 * Atualiza a cada 1min em modo live.
 */
export function useOptionsData() {
  return useQuery({
    queryKey: ['options', 'data'],
    queryFn: async (): Promise<DataState<OptionsData>> => {
      try {
        const data = await withCache<OptionsData>(
          'deribit:options',
          60,
          'deribit',
          fetchOptionsData,
        );
        reportApiRecovery('deribit');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Options data fetch failed', { error: String(err) }, 'deribit-options');
        reportApiFailure('deribit');
        const stale = await getStaleCache<OptionsData>('deribit:options');
        if (stale) {
          return { data: stale.data, lastUpdated: stale.lastUpdated, isFallback: true, debugError: String(err) };
        }
        return { data: EMPTY_OPTIONS, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 55_000,
    refetchInterval: OPTIONS_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: readModuleFlag('ENABLE_OPTIONS'),
    select: (state: DataState<OptionsData>) => ({
      ...((state.data ?? EMPTY_OPTIONS) as OptionsData),
      isFallback: state.isFallback,
      lastUpdated: state.lastUpdated,
    }),
  });
}

/**
 * useDvolHistory — histórico do índice DVOL (Deribit Volatility)
 * Padrão DataState: withCache(3600s) → fallback getStaleCache → isFallback=true.
 * Select retorna o array diretamente para compatibilidade com callers existentes.
 * @param days número de dias de histórico (padrão 30)
 */
export function useDvolHistory(days = 30) {
  return useQuery({
    queryKey: ['options', 'dvol-history', days],
    queryFn: async (): Promise<DataState<Array<{ timestamp: number; value: number }>>> => {
      try {
        const data = await withCache<Array<{ timestamp: number; value: number }>>(
          `deribit:dvol:${days}`,
          3600,
          'deribit',
          () => fetchDvolHistory(days),
        );
        reportApiRecovery('deribit');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('DVOL history fetch failed', { error: String(err), days }, 'deribit-dvol');
        reportApiFailure('deribit');
        const stale = await getStaleCache<Array<{ timestamp: number; value: number }>>(`deribit:dvol:${days}`);
        if (stale) {
          return { data: stale.data, lastUpdated: stale.lastUpdated, isFallback: true, debugError: String(err) };
        }
        return { data: [], lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 3_500_000,
    refetchInterval: DVOL_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: readModuleFlag('ENABLE_OPTIONS'),
    select: (state: DataState<Array<{ timestamp: number; value: number }>>) => state.data ?? [],
  });
}
