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
import { IS_LIVE } from '@/lib/env';
import { fetchBtcTicker, fetchOiByExchange, fetchKlines, fetchLiquidations, fetchLongShortRatio, type BtcTickerData } from '@/services/binance';
import { fetchDominance, fetchTopAltcoins } from '@/services/coingecko';
import { fetchFearGreed } from '@/services/alternative';

// ─── Intervalos de refetch ────────────────────────────────────────────────────
const PRICE_INTERVAL   = IS_LIVE ? 5_000   : false;  // 5s quando live
const OI_INTERVAL      = IS_LIVE ? 30_000  : false;  // 30s quando live
const KLINES_INTERVAL  = IS_LIVE ? 60_000  : false;  // 1min quando live
const DOM_INTERVAL     = IS_LIVE ? 300_000 : false;  // 5min quando live
const FNG_INTERVAL     = IS_LIVE ? 3_600_000: false; // 1h quando live

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useBtcTicker — preço mark, funding rate, OI, variação 24h
 * Atualiza a cada 5s em modo live.
 */
export function useBtcTicker() {
  return useQuery({
    queryKey: ['btc', 'ticker'],
    queryFn:  fetchBtcTicker,
    staleTime: 4_000,
    refetchInterval: PRICE_INTERVAL,
    // Transformação para UI: formatar valores prontos para exibição
    select: (data: BtcTickerData) => ({
      ...data,
      mark_price_fmt:    data.mark_price.toLocaleString('en-US', { minimumFractionDigits: 0 }),
      funding_rate_fmt:  `${(data.last_funding_rate * 100).toFixed(4)}%`,
      price_change_sign: data.oi_delta_pct >= 0 ? '+' : '',
    }),
  });
}

/**
 * useOiByExchange — Open Interest por exchange
 * Atualiza a cada 30s em modo live.
 */
export function useOiByExchange() {
  return useQuery({
    queryKey: ['btc', 'oi-exchange'],
    queryFn:  fetchOiByExchange,
    staleTime: 25_000,
    refetchInterval: OI_INTERVAL,
  });
}

/**
 * useKlines — candles de preço
 * @param interval intervalo dos candles ('1h', '15m', '4h', '1d')
 * @param limit número de candles
 */
export function useKlines(interval = '1h', limit = 48) {
  return useQuery({
    queryKey: ['btc', 'klines', interval, limit],
    queryFn:  () => fetchKlines('BTCUSDT', interval, limit),
    staleTime: 55_000,
    refetchInterval: KLINES_INTERVAL,
    select: (data) => data.map(k => ({
      time:   k[0],
      open:   k[1],
      high:   k[2],
      low:    k[3],
      close:  k[4],
      volume: k[5],
      // CVD proxy: taker buy - taker sell (baseado nos campos 9 e 10)
      taker_buy:  k[9],
      bull:   k[4] >= k[1] ? k[5] : 0,
      bear:   k[4] < k[1]  ? k[5] : 0,
    })),
  });
}

/**
 * useDominance — BTC/ETH dominance e market cap total
 * Atualiza a cada 5min em modo live (respeita rate limit CoinGecko).
 */
export function useDominance() {
  return useQuery({
    queryKey: ['market', 'dominance'],
    queryFn:  fetchDominance,
    staleTime: 290_000,
    refetchInterval: DOM_INTERVAL,
  });
}

/**
 * useTopAltcoins — top altcoins por market cap com retornos
 * Atualiza a cada 5min em modo live.
 */
export function useTopAltcoins(limit = 20) {
  return useQuery({
    queryKey: ['market', 'altcoins', limit],
    queryFn:  () => fetchTopAltcoins(limit),
    staleTime: 290_000,
    refetchInterval: DOM_INTERVAL,
  });
}

/**
 * useLongShortRatio — proporção global de contas long vs short (Binance Futures)
 * Atualiza a cada 1min em modo live. Retorna null se o endpoint exigir auth.
 */
export function useLongShortRatio(symbol = 'BTCUSDT') {
  return useQuery({
    queryKey:        ['btc', 'longShortRatio', symbol],
    queryFn:         () => fetchLongShortRatio(symbol, '5m'),
    staleTime:       55_000,
    refetchInterval: IS_LIVE ? 60_000 : false,
    retry:           1,
  });
}

/**
 * useLiquidations — liquidações forçadas recentes de BTCUSDT
 * Atualiza a cada 30s em modo live.
 */
export function useLiquidations(limit = 50) {
  return useQuery({
    queryKey: ['btc', 'liquidations', limit],
    queryFn:  () => fetchLiquidations('BTCUSDT', limit),
    staleTime: 25_000,
    refetchInterval: OI_INTERVAL,
    retry: 0,                    // sem retry: endpoint requer auth, falha é permanente
    refetchOnWindowFocus: false,
  });
}

/**
 * useFearGreed — Fear & Greed Index com histórico 30d
 * Atualiza a cada hora em modo live (dado muda ~1x/dia).
 */
export function useFearGreed(limit = 30) {
  return useQuery({
    queryKey: ['sentiment', 'fear-greed', limit],
    queryFn:  () => fetchFearGreed(limit),
    staleTime: 3_500_000,
    refetchInterval: FNG_INTERVAL,
  });
}
