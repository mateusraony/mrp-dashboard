/**
 * useMempool.ts — TanStack Query hooks para dados on-chain (Mempool.space)
 *
 * Mempool.space é pública, sem autenticação.
 * NUPL/SOPR/MVRV sempre retornam mock (sem API pública gratuita).
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import {
  fetchMempoolState,
  fetchHashrate,
  fetchMiningPools,
  fetchOnChainAdvanced,
  MempoolData,
  HashrateData,
  MiningPoolEntry,
} from '@/services/mempool';
import { readModuleFlag } from '@/lib/moduleFlags';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { DataState } from '@/hooks/useBtcData';

// Intervalos de refetch
const MEMPOOL_INTERVAL  = IS_LIVE ? 30_000     : false;  // 30s — dado em tempo real
const HASHRATE_INTERVAL = IS_LIVE ? 300_000    : false;  // 5min — atualiza por bloco
const POOLS_INTERVAL    = IS_LIVE ? 3_600_000  : false;  // 1h — dado semanal
const ONCHAIN_INTERVAL  = IS_LIVE ? 3_600_000  : false;  // 1h — mock (sempre)

// ─── Empty states ─────────────────────────────────────────────────────────────

const EMPTY_MEMPOOL: MempoolData = {
  tx_count:      0,
  vsize_bytes:   0,
  total_fee_btc: 0,
  fees: {
    fastest_fee:   0,
    half_hour_fee: 0,
    hour_fee:      0,
    economy_fee:   0,
  },
};

const EMPTY_HASHRATE: HashrateData = {
  current_eh:       0,
  prev_7d_eh:       0,
  prev_30d_eh:      0,
  delta_7d_pct:     0,
  delta_30d_pct:    0,
  difficulty:       0,
  prev_difficulty:  0,
  diff_adj_pct:     0,
  next_adj_est_pct: 0,
  next_adj_blocks:  0,
  history:          [],
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useMempoolState — taxas (sat/vB) + estado da mempool (tx count, vsize)
 * Atualiza a cada 30s em modo live.
 * Padrão DataState: withCache(30s) → fallback getStaleCache → isFallback=true.
 */
export function useMempoolState() {
  return useQuery({
    queryKey: ['onchain', 'mempool'],
    queryFn:  async (): Promise<DataState<MempoolData>> => {
      try {
        const data = await withCache('mempool:state', 30, 'mempool', fetchMempoolState);
        reportApiRecovery('mempool');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('MempoolState fetch failed', { error: String(err) }, 'mempool-state');
        reportApiFailure('mempool');
        const stale = await getStaleCache<MempoolData>('mempool:state');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       25_000,
    refetchInterval: MEMPOOL_INTERVAL,
    enabled:         readModuleFlag('ENABLE_ONCHAIN'),
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<MempoolData>) => {
      const data = state.data ?? EMPTY_MEMPOOL;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useHashrate — hashrate atual em EH/s, histórico 3M, dificuldade
 * Atualiza a cada 5min em modo live.
 * Padrão DataState: withCache(300s) → fallback getStaleCache → isFallback=true.
 */
export function useHashrate() {
  return useQuery({
    queryKey: ['onchain', 'hashrate'],
    queryFn:  async (): Promise<DataState<HashrateData>> => {
      try {
        const data = await withCache('mempool:hashrate', 300, 'mempool', fetchHashrate);
        reportApiRecovery('mempool');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Hashrate fetch failed', { error: String(err) }, 'mempool-hashrate');
        reportApiFailure('mempool');
        const stale = await getStaleCache<HashrateData>('mempool:hashrate');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       290_000,
    refetchInterval: HASHRATE_INTERVAL,
    enabled:         readModuleFlag('ENABLE_ONCHAIN'),
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<HashrateData>) => {
      const data = state.data ?? EMPTY_HASHRATE;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useMiningPools — distribuição de hashrate por pool (última semana)
 * Atualiza a cada 1h em modo live.
 * Padrão DataState: withCache(3600s) → fallback getStaleCache → isFallback=true.
 * select: retorna array diretamente para compatibilidade com consumers existentes.
 */
export function useMiningPools() {
  return useQuery({
    queryKey: ['onchain', 'mining-pools'],
    queryFn:  async (): Promise<DataState<MiningPoolEntry[]>> => {
      try {
        const data = await withCache('mempool:pools', 3600, 'mempool', fetchMiningPools);
        reportApiRecovery('mempool');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('MiningPools fetch failed', { error: String(err) }, 'mempool-pools');
        reportApiFailure('mempool');
        const stale = await getStaleCache<MiningPoolEntry[]>('mempool:pools');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       3_500_000,
    refetchInterval: POOLS_INTERVAL,
    enabled:         readModuleFlag('ENABLE_ONCHAIN'),
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<MiningPoolEntry[]>) => state.data ?? [],
  });
}

/**
 * useOnChainAdvanced — NUPL, SOPR, MVRV, Exchange Netflow, Whale Activity
 *
 * Nota: sempre retorna mock (quality='B') — sem API pública gratuita
 * para estas métricas. Fonte futura: Glassnode / CryptoQuant.
 */
export function useOnChainAdvanced() {
  return useQuery({
    queryKey: ['onchain', 'advanced'],
    queryFn:  fetchOnChainAdvanced,
    staleTime: 3_500_000,
    refetchInterval: ONCHAIN_INTERVAL,
    enabled:  readModuleFlag('ENABLE_ONCHAIN'),
  });
}
