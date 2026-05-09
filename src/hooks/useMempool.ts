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
} from '@/services/mempool';
import { readModuleFlag } from '@/lib/moduleFlags';

// Intervalos de refetch
const MEMPOOL_INTERVAL  = IS_LIVE ? 30_000     : false;  // 30s — dado em tempo real
const HASHRATE_INTERVAL = IS_LIVE ? 300_000    : false;  // 5min — atualiza por bloco
const POOLS_INTERVAL    = IS_LIVE ? 3_600_000  : false;  // 1h — dado semanal
const ONCHAIN_INTERVAL  = IS_LIVE ? 3_600_000  : false;  // 1h — mock (sempre)

/**
 * useMempoolState — taxas (sat/vB) + estado da mempool (tx count, vsize)
 * Atualiza a cada 30s em modo live.
 */
export function useMempoolState() {
  return useQuery({
    queryKey: ['onchain', 'mempool'],
    queryFn:  fetchMempoolState,
    staleTime: 25_000,
    refetchInterval: MEMPOOL_INTERVAL,
    enabled:  readModuleFlag('ENABLE_ONCHAIN'),
  });
}

/**
 * useHashrate — hashrate atual em EH/s, histórico 3M, dificuldade
 * Atualiza a cada 5min em modo live.
 */
export function useHashrate() {
  return useQuery({
    queryKey: ['onchain', 'hashrate'],
    queryFn:  fetchHashrate,
    staleTime: 290_000,
    refetchInterval: HASHRATE_INTERVAL,
    enabled:  readModuleFlag('ENABLE_ONCHAIN'),
  });
}

/**
 * useMiningPools — distribuição de hashrate por pool (última semana)
 * Atualiza a cada 1h em modo live.
 */
export function useMiningPools() {
  return useQuery({
    queryKey: ['onchain', 'mining-pools'],
    queryFn:  fetchMiningPools,
    staleTime: 3_500_000,
    refetchInterval: POOLS_INTERVAL,
    enabled:  readModuleFlag('ENABLE_ONCHAIN'),
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
