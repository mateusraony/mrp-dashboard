/**
 * useMultiVenue.ts — TanStack Query hooks para dados multi-exchange
 *
 * Exchanges suportadas:
 *   - Binance (já existente via useBtcTicker)
 *   - Bybit   (bybit.ts)
 *   - OKX     (okx.ts)
 *
 * Usado no painel Cross-venue de Derivatives.jsx para comparar:
 *   - Funding rates entre exchanges
 *   - OI por exchange
 *   - Divergência de funding (sinal de arbitragem)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchBybitTicker, fetchBybitFunding, BybitTickerData, BybitFundingEntry } from '@/services/bybit';
import { fetchOkxTicker, fetchOkxFunding, OkxTickerData, OkxFundingEntry } from '@/services/okx';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import { DataState } from '@/hooks/useBtcData';

const VENUE_INTERVAL = IS_LIVE ? 30_000 : false;  // 30s — mesma freq do Binance OI

// ─── Empty states ─────────────────────────────────────────────────────────────

const EMPTY_BYBIT_TICKER: BybitTickerData = {
  exchange: 'bybit' as const,
  symbol: 'BTCUSDT',
  mark_price: 0,
  index_price: 0,
  last_price: 0,
  funding_rate: 0,
  next_funding_ms: 0,
  open_interest: 0,
  open_interest_usd: 0,
  volume_24h: 0,
};

const EMPTY_OKX_TICKER: OkxTickerData = {
  exchange: 'okx' as const,
  symbol: 'BTC-USDT-SWAP',
  last_price: 0,
  funding_rate: 0,
  next_funding_rate: 0,
  next_funding_ms: 0,
  open_interest: 0,
  open_interest_usd: 0,
  volume_24h: 0,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useBybitTicker — mark price, funding rate, OI da Bybit
 */
export function useBybitTicker() {
  return useQuery({
    queryKey:        ['venue', 'bybit', 'ticker'],
    queryFn:         async (): Promise<DataState<BybitTickerData>> => {
      try {
        const data = await withCache('bybit:ticker', 30, 'bybit', fetchBybitTicker);
        reportApiRecovery('bybit');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Bybit ticker fetch failed', { error: String(err) }, 'bybit-ticker');
        reportApiFailure('bybit');
        const stale = await getStaleCache<BybitTickerData>('bybit:ticker');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<BybitTickerData>) => {
      const data = state.data ?? EMPTY_BYBIT_TICKER;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useBybitFunding — histórico das últimas 8 sessões de funding (Bybit)
 */
export function useBybitFunding() {
  return useQuery({
    queryKey:        ['venue', 'bybit', 'funding'],
    queryFn:         async (): Promise<DataState<BybitFundingEntry[]>> => {
      try {
        const data = await withCache('bybit:funding', 30, 'bybit', fetchBybitFunding);
        reportApiRecovery('bybit');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Bybit funding fetch failed', { error: String(err) }, 'bybit-funding');
        reportApiFailure('bybit');
        const stale = await getStaleCache<BybitFundingEntry[]>('bybit:funding');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<BybitFundingEntry[]>) => state.data ?? [],
  });
}

/**
 * useOkxTicker — preço, funding rate, OI da OKX
 */
export function useOkxTicker() {
  return useQuery({
    queryKey:        ['venue', 'okx', 'ticker'],
    queryFn:         async (): Promise<DataState<OkxTickerData>> => {
      try {
        const data = await withCache('okx:ticker', 30, 'okx', fetchOkxTicker);
        reportApiRecovery('okx');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('OKX ticker fetch failed', { error: String(err) }, 'okx-ticker');
        reportApiFailure('okx');
        const stale = await getStaleCache<OkxTickerData>('okx:ticker');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<OkxTickerData>) => {
      const data = state.data ?? EMPTY_OKX_TICKER;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useOkxFunding — histórico das últimas 8 sessões de funding (OKX)
 */
export function useOkxFunding() {
  return useQuery({
    queryKey:        ['venue', 'okx', 'funding'],
    queryFn:         async (): Promise<DataState<OkxFundingEntry[]>> => {
      try {
        const data = await withCache('okx:funding', 30, 'okx', fetchOkxFunding);
        reportApiRecovery('okx');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('OKX funding fetch failed', { error: String(err) }, 'okx-funding');
        reportApiFailure('okx');
        const stale = await getStaleCache<OkxFundingEntry[]>('okx:funding');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
    retry:           2,
    retryDelay:      (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select:          (state: DataState<OkxFundingEntry[]>) => state.data ?? [],
  });
}

/**
 * useMultiVenueSnapshot — snapshot consolidado das 3 exchanges (Binance já no caller)
 * Retorna Bybit + OKX juntos para facilitar comparação na UI.
 */
export function useMultiVenueSnapshot() {
  const bybit = useBybitTicker();
  const okx   = useOkxTicker();

  return {
    bybit:    bybit.data ?? null,
    okx:      okx.data  ?? null,
    isLoading: bybit.isLoading || okx.isLoading,
    isError:   bybit.isError   || okx.isError,
  };
}
