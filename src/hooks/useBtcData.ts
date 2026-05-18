/**
 * useBtcData.ts — TanStack Query hooks para dados de BTC e mercado
 *
 * Padrão aplicado (conforme instrução do usuário):
 *   - z.coerce.number() nos schemas (binance.ts)
 *   - res.ok check antes do parse
 *   - refetchInterval apenas em DATA_MODE=live
 *   - select para transformações de UI
 *   - Mock só substitui live quando a API retornar 200 OK
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { IS_LIVE } from '@/lib/env';
import { fetchBtcTicker, fetchOiByExchange, fetchKlines, fetchLiquidations, fetchLongShortRatio, fetchFuturesBasis, fetchOiHistory, type BtcTickerData, type OiByExchangeEntry, type Kline, type LiquidationEntry, type LongShortRatioData, type FuturesBasisEntry } from '@/services/binance';
import { fetchDominance, fetchTopAltcoins, type DominanceData, type AltcoinMarketData } from '@/services/coingecko';
import { fetchFearGreed, type FearGreedData } from '@/services/alternative';
import { subscribeBtcPrice, subscribeStatus } from '@/services/binanceWs';
import { readModuleFlag } from '@/lib/moduleFlags';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';

// ─── DataState — interface padrão de resiliência ──────────────────────────────
export interface DataState<T> {
  data:        T | null;
  lastUpdated: string | null;
  isFallback:  boolean;
  debugError:  string | null;
}

// ─── Intervalos de refetch ────────────────────────────────────────────────────
const PRICE_INTERVAL   = IS_LIVE ? 5_000   : false;  // 5s quando live
const OI_INTERVAL      = IS_LIVE ? 30_000  : false;  // 30s quando live
const KLINES_INTERVAL  = IS_LIVE ? 60_000  : false;  // 1min quando live
const DOM_INTERVAL     = IS_LIVE ? 300_000 : false;  // 5min quando live
const FNG_INTERVAL     = IS_LIVE ? 3_600_000: false; // 1h quando live

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Zero-state para quando API falha e cache Supabase está vazio (último recurso)
const EMPTY_TICKER: BtcTickerData = {
  mark_price: 0, last_funding_rate: 0, next_funding_time: 0,
  price_change_pct: 0, volume_24h_usdt: 0, high_24h: 0, low_24h: 0,
  open_interest: 0, oi_delta_pct: 0,
};

/**
 * useBtcTicker — preço mark, funding rate, OI, variação 24h
 * Padrão DataState: withCache(30s) → fallback getStaleCache → isFallback=true.
 * Callers ganham isFallback + lastUpdated sem breaking change.
 */
export function useBtcTicker(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['btc', 'ticker'],
    queryFn: async (): Promise<DataState<BtcTickerData>> => {
      try {
        const data = await withCache('btc:ticker', 30, 'binance_futures', fetchBtcTicker);
        reportApiRecovery('binance_futures');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('BTC ticker fetch failed', { error: String(err) }, 'btc-ticker');
        reportApiFailure('binance_futures');
        const stale = await getStaleCache<BtcTickerData>('btc:ticker');
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 4_000,
    refetchInterval: PRICE_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<BtcTickerData>) => {
      const data = state.data ?? EMPTY_TICKER;
      return {
        ...data,
        mark_price_fmt:    data.mark_price.toLocaleString('en-US', { minimumFractionDigits: 0 }),
        funding_rate_fmt:  `${(data.last_funding_rate * 100).toFixed(4)}%`,
        price_change_sign: data.oi_delta_pct >= 0 ? '+' : '',
        isFallback:        state.isFallback,
        lastUpdated:       state.lastUpdated,
      };
    },
  });
}

/**
 * useOiByExchange — Open Interest por exchange
 * Padrão DataState: withCache(30s) → fallback getStaleCache → isFallback=true.
 */
export function useOiByExchange() {
  return useQuery({
    queryKey: ['btc', 'oi-exchange'],
    queryFn: async (): Promise<DataState<OiByExchangeEntry[]>> => {
      try {
        const data = await withCache('binance:oi-exchange', 30, 'binance_futures', fetchOiByExchange);
        reportApiRecovery('binance_futures');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('OI by exchange fetch failed', { error: String(err) }, 'oi-exchange');
        reportApiFailure('binance_futures');
        const stale = await getStaleCache<OiByExchangeEntry[]>('binance:oi-exchange');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 25_000,
    refetchInterval: OI_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<OiByExchangeEntry[]>) => state.data ?? [],
  });
}

/**
 * useKlines — candles de preço
 * Padrão DataState: withCache(60s) → fallback getStaleCache → select transforma array.
 */
export function useKlines(interval = '1h', limit = 48, enabled = true) {
  return useQuery({
    queryKey: ['btc', 'klines', interval, limit],
    queryFn: async (): Promise<DataState<Kline[]>> => {
      try {
        const data = await withCache(`binance:klines:${interval}:${limit}`, 60, 'binance_futures', () => fetchKlines('BTCUSDT', interval, limit));
        reportApiRecovery('binance_futures');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Klines fetch failed', { error: String(err), interval, limit }, 'klines');
        reportApiFailure('binance_futures');
        const stale = await getStaleCache<Kline[]>(`binance:klines:${interval}:${limit}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 55_000,
    refetchInterval: KLINES_INTERVAL,
    enabled,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<Kline[]>) => (state.data ?? []).map(k => ({
      time:      k[0],
      open:      k[1],
      high:      k[2],
      low:       k[3],
      close:     k[4],
      volume:    k[5],
      taker_buy: k[9],
      bull:  k[4] >= k[1] ? k[5] : 0,
      bear:  k[4] < k[1]  ? k[5] : 0,
    })),
  });
}

const EMPTY_DOMINANCE: DominanceData = {
  btc_dominance: 0, eth_dominance: 0, others_dominance: 0,
  total_mcap_usd: 0, stablecoin_supply_b: 0, updated_at: 0,
};

/**
 * useDominance — BTC/ETH dominance e market cap total
 * Padrão DataState: withCache(300s) → fallback getStaleCache → isFallback=true.
 */
export function useDominance() {
  return useQuery({
    queryKey: ['market', 'dominance'],
    queryFn: async (): Promise<DataState<DominanceData>> => {
      try {
        const data = await withCache('coingecko:dominance', 300, 'coingecko', fetchDominance);
        reportApiRecovery('coingecko');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Dominance fetch failed', { error: String(err) }, 'dominance');
        reportApiFailure('coingecko');
        const stale = await getStaleCache<DominanceData>('coingecko:dominance');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 290_000,
    refetchInterval: DOM_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<DominanceData>) => {
      const data = state.data ?? EMPTY_DOMINANCE;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useTopAltcoins — top altcoins por market cap com retornos
 * Padrão DataState: withCache(300s) → fallback getStaleCache → isFallback=true.
 */
export function useTopAltcoins(limit = 20) {
  return useQuery({
    queryKey: ['market', 'altcoins', limit],
    queryFn: async (): Promise<DataState<AltcoinMarketData[]>> => {
      try {
        const data = await withCache(`coingecko:altcoins:${limit}`, 300, 'coingecko', () => fetchTopAltcoins(limit));
        reportApiRecovery('coingecko');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Top altcoins fetch failed', { error: String(err), limit }, 'altcoins');
        reportApiFailure('coingecko');
        const stale = await getStaleCache<AltcoinMarketData[]>(`coingecko:altcoins:${limit}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 290_000,
    refetchInterval: DOM_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<AltcoinMarketData[]>) => state.data ?? [],
  });
}

/**
 * useLongShortRatio — proporção global de contas long vs short (Binance Futures)
 * Padrão DataState: withCache(60s) → fallback getStaleCache. Retorna null se auth falhar.
 */
export function useLongShortRatio(symbol = 'BTCUSDT') {
  return useQuery({
    queryKey:        ['btc', 'longShortRatio', symbol],
    queryFn: async (): Promise<DataState<LongShortRatioData | null>> => {
      try {
        const data = await withCache(`binance:longshort:${symbol}`, 60, 'binance_futures', () => fetchLongShortRatio(symbol, '5m'));
        reportApiRecovery('binance_futures');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('LongShortRatio fetch failed', { error: String(err), symbol }, 'longshort');
        const stale = await getStaleCache<LongShortRatioData>(`binance:longshort:${symbol}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       55_000,
    refetchInterval: IS_LIVE ? 60_000 : false,
    retry:           1,
    select: (state: DataState<LongShortRatioData | null>) => state.data,
  });
}

/**
 * useLiquidations — liquidações forçadas recentes de BTCUSDT
 * Padrão DataState: withCache(30s) → fallback getStaleCache.
 * retry:0 mantido — endpoint requer auth, falha é permanente.
 */
export function useLiquidations(limit = 50) {
  return useQuery({
    queryKey: ['btc', 'liquidations', limit],
    queryFn: async (): Promise<DataState<LiquidationEntry[]>> => {
      try {
        const data = await withCache(`binance:liquidations:${limit}`, 30, 'binance_futures', () => fetchLiquidations('BTCUSDT', limit));
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        const stale = await getStaleCache<LiquidationEntry[]>(`binance:liquidations:${limit}`);
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 25_000,
    refetchInterval: OI_INTERVAL,
    retry: 0,
    refetchOnWindowFocus: false,
    select: (state: DataState<LiquidationEntry[]>) => state.data ?? [],
  });
}

const EMPTY_FEAR_GREED: FearGreedData = {
  value: 0, label: 'Unknown',
  previous_close: 0, previous_week: 0, previous_month: 0,
  history: [],
};

/**
 * useFearGreed — Fear & Greed Index com histórico 30d
 * Padrão DataState: withCache(3600s) → fallback getStaleCache → isFallback=true.
 * TTL 1h: dado atualiza ~1x/dia; callers ganham isFallback + lastUpdated.
 */
export function useFearGreed(limit = 30) {
  return useQuery({
    queryKey: ['sentiment', 'fear-greed', limit],
    queryFn: async (): Promise<DataState<FearGreedData>> => {
      try {
        const data = await withCache(
          `fear-greed:${limit}`,
          3600,
          'alternative_me',
          () => fetchFearGreed(limit),
        );
        reportApiRecovery('alternative_me');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Fear & Greed fetch failed', { error: String(err), limit }, 'fear-greed');
        reportApiFailure('alternative_me');
        const stale = await getStaleCache<FearGreedData>(`fear-greed:${limit}`);
        if (stale) {
          return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        }
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime: 3_500_000,
    refetchInterval: FNG_INTERVAL,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: readModuleFlag('ENABLE_FEAR_GREED'),
    select: (state: DataState<FearGreedData>) => {
      const data = state.data ?? EMPTY_FEAR_GREED;
      return { ...data, isFallback: state.isFallback, lastUpdated: state.lastUpdated };
    },
  });
}

/**
 * useBtcPriceWs — preço BTC em tempo real via Binance WebSocket.
 * Retorna o último preço recebido e status da conexão.
 * Em modo mock retorna { price: null, connected: false }.
 */
export function useBtcPriceWs() {
  const [price, setPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!IS_LIVE) return;

    const unsubPrice  = subscribeBtcPrice(setPrice);
    const unsubStatus = subscribeStatus((isConnected) => {
      setConnected(isConnected);
      // Limpa o preço stale ao desconectar para que o fallback REST seja usado
      if (!isConnected) setPrice(null);
    });

    return () => {
      unsubPrice();
      unsubStatus();
      setConnected(false);
    };
  }, []);

  return { price, connected };
}

/**
 * useFuturesBasis — basis anualizado dos futuros trimestrais BTC vs perp.
 * Padrão DataState: withCache(60s) → fallback getStaleCache → isFallback=true.
 */
export function useFuturesBasis() {
  return useQuery({
    queryKey:        ['futures', 'basis'],
    queryFn: async (): Promise<DataState<FuturesBasisEntry[]>> => {
      try {
        const data = await withCache('binance:futures-basis', 60, 'binance_futures', fetchFuturesBasis);
        reportApiRecovery('binance_futures');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('Futures basis fetch failed', { error: String(err) }, 'futures-basis');
        reportApiFailure('binance_futures');
        const stale = await getStaleCache<FuturesBasisEntry[]>('binance:futures-basis');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    staleTime:       60_000,
    refetchInterval: IS_LIVE ? 60_000 : false,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    select: (state: DataState<FuturesBasisEntry[]>) => state.data ?? [],
  });
}

/**
 * useBtcOiHistory — Open Interest diário últimos 30 dias via Binance openInterestHist
 * Padrão DataState: withCache(300s) → fallback getStaleCache → isFallback=true.
 */
export function useBtcOiHistory() {
  return useQuery({
    queryKey:        ['btc-oi-history'],
    queryFn: async (): Promise<DataState<Array<{ t: number; oi: number }>>> => {
      try {
        const data = await withCache('binance:oi-history', 300, 'binance_futures', fetchOiHistory);
        reportApiRecovery('binance_futures');
        return { data, lastUpdated: new Date().toISOString(), isFallback: false, debugError: null };
      } catch (err) {
        logError('OI history fetch failed', { error: String(err) }, 'oi-history');
        reportApiFailure('binance_futures');
        const stale = await getStaleCache<Array<{ t: number; oi: number }>>('binance:oi-history');
        if (stale) return { data: stale.value, lastUpdated: stale.updatedAt.toISOString(), isFallback: true, debugError: String(err) };
        return { data: null, lastUpdated: null, isFallback: true, debugError: String(err) };
      }
    },
    refetchInterval: IS_LIVE ? 5 * 60_000 : false,
    staleTime:       4 * 60_000,
    retry:           1,
    enabled:         IS_LIVE,
    select: (state: DataState<Array<{ t: number; oi: number }>>) => state.data ?? [],
  });
}
