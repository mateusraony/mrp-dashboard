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
import { fetchOnChainCycle, fetchOnChainExtended, OnChainCycleData, OnChainExtendedData } from '@/services/coinmetrics';
import { readModuleFlag } from '@/lib/moduleFlags';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { DataState } from '@/hooks/useBtcData';

// Dados on-chain mudam apenas 1x/dia — poll a cada 1h é suficiente
const ONCHAIN_CYCLE_INTERVAL = IS_LIVE ? 3_600_000 : false;

// ─── Empty states ─────────────────────────────────────────────────────────────

const EMPTY_ONCHAIN_CYCLE: OnChainCycleData = {
  mvrv_current:    0,
  mvrv_zscore:     0,
  mvrv_zone:       '',
  mvrv_zone_color: '#64748b',
  realized_price:  0,
  realized_cap:    0,
  nupl:            0,
  nupl_zone:       '',
  nupl_zone_color: '#64748b',
  nvt_current:     0,
  current_price:   0,
  history:         [],
  quality:         'C' as const,
  source:          '',
  updated_at:      0,
};

const EMPTY_ONCHAIN_EXTENDED: OnChainExtendedData = {
  cdd_current:       0,
  cdd_ma30:          0,
  cdd_z_score:       0,
  cdd_signal:        '',
  hodl_wave_1yr_pct: 0,
  hodl_wave_trend:   'neutral' as const,
  active_supply_1yr: 0,
  dormancy_value:    0,
  dormancy_signal:   '',
  history_cdd:       [],
  history_hodl:      [],
  quality:           'B' as const,
  source:            '',
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useOnChainCycle — MVRV Z-Score, NUPL, Realized Price, NVT
 *
 * Em modo live: busca dados reais da CoinMetrics Community API.
 * Em modo mock: retorna valores simulados baseados no mock data existente.
 * Atualiza a cada 1h em modo live.
 * Padrão DataState: withCache(3600s) → fallback getStaleCache → isFallback=true.
 */
export function useOnChainCycle(pageEnabled = true) {
  return useQuery({
    queryKey:        ['onchain', 'cycle'],
    queryFn:         async (): Promise<DataState<OnChainCycleData>> => {
      try {
        const data = await withCache('coinmetrics:cycle', 3600, 'coinmetrics', fetchOnChainCycle);
        reportApiRecovery('coinmetrics');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('OnChainCycle fetch failed', { error: String(err) }, 'coinmetrics-cycle');
        reportApiFailure('coinmetrics');
        const stale = await getStaleCache<OnChainCycleData>('coinmetrics:cycle');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       3_500_000,
    refetchInterval: ONCHAIN_CYCLE_INTERVAL,
    enabled:         pageEnabled && readModuleFlag('ENABLE_COINMETRICS'),
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<OnChainCycleData>) => {
      const data = state.data ?? EMPTY_ONCHAIN_CYCLE;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useOnChainExtended — CDD, HODL Waves proxy, Dormancy
 *
 * Em modo live: busca CoinDaysDestroyed, SplyAdr1yrPlus, SplyAct1yr,
 *   AdrActCnt e VelCur1yr da CoinMetrics Community API (últimos 90 dias).
 * Em modo mock: retorna valores simulados razoáveis (quality B).
 * Atualiza a cada 1h em modo live.
 * Padrão DataState: withCache(3600s) → fallback getStaleCache → isFallback=true.
 */
export function useOnChainExtended(pageEnabled = true) {
  return useQuery({
    queryKey:        ['onchain', 'extended'],
    queryFn:         async (): Promise<DataState<OnChainExtendedData>> => {
      try {
        const data = await withCache('coinmetrics:extended', 3600, 'coinmetrics', fetchOnChainExtended);
        reportApiRecovery('coinmetrics');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('OnChainExtended fetch failed', { error: String(err) }, 'coinmetrics-extended');
        reportApiFailure('coinmetrics');
        const stale = await getStaleCache<OnChainExtendedData>('coinmetrics:extended');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       3_500_000,
    refetchInterval: IS_LIVE ? 3_600_000 : false,
    enabled:         pageEnabled && readModuleFlag('ENABLE_COINMETRICS'),
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<OnChainExtendedData>) => {
      const data = state.data ?? EMPTY_ONCHAIN_EXTENDED;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}
