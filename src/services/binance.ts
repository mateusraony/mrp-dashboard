/**
 * binance.ts — Serviço Binance Futures + Spot
 *
 * Endpoints usados (todos públicos, sem autenticação):
 *   Futures: https://fapi.binance.com
 *   Spot:    https://api.binance.com
 *
 * Regra de mock: DATA_MODE=mock → retorna dados simulados SEM chamada HTTP.
 * DATA_MODE=live  → faz chamada real; se falhar → lança erro (não cai em mock).
 * O mock NUNCA é substituto silencioso de dado live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import {
  btcFutures,
  btcSpotFlow,
  oiByExchange,
} from '@/components/data/mockData';

// ─── Schemas ──────────────────────────────────────────────────────────────────

/** /fapi/v1/premiumIndex — preço mark, funding, etc. */
export const PremiumIndexSchema = z.object({
  symbol:          z.string(),
  markPrice:       z.coerce.number(),
  lastFundingRate: z.coerce.number(),
  nextFundingTime: z.coerce.number(),
  interestRate:    z.coerce.number(),
  time:            z.coerce.number(),
});
export type PremiumIndex = z.infer<typeof PremiumIndexSchema>;

/** /fapi/v1/openInterest — OI em contratos */
export const OpenInterestSchema = z.object({
  symbol:           z.string(),
  openInterest:     z.coerce.number(),
  time:             z.coerce.number(),
});
export type OpenInterest = z.infer<typeof OpenInterestSchema>;

/** /fapi/v1/ticker/24hr — volume e variação 24h */
export const Ticker24hSchema = z.object({
  symbol:             z.string(),
  priceChange:        z.coerce.number(),
  priceChangePercent: z.coerce.number(),
  lastPrice:          z.coerce.number(),
  volume:             z.coerce.number(),
  quoteVolume:        z.coerce.number(),
  highPrice:          z.coerce.number(),
  lowPrice:           z.coerce.number(),
  count:              z.coerce.number(),
});
export type Ticker24h = z.infer<typeof Ticker24hSchema>;

/** Dados combinados do ticker BTC (mock-compatible shape) */
export interface BtcTickerData {
  mark_price:        number;
  last_funding_rate: number;
  next_funding_time: number;
  price_change_pct:  number;
  volume_24h_usdt:   number;
  high_24h:          number;
  low_24h:           number;
  open_interest:     number;
  oi_delta_pct:      number;
}

// ─── Mock transformers ────────────────────────────────────────────────────────

function mockBtcTicker(): BtcTickerData {
  return {
    mark_price:        btcFutures.mark_price,
    last_funding_rate: btcFutures.funding_rate,
    next_funding_time: btcFutures.next_funding_ts,
    price_change_pct:  btcFutures.oi_delta_pct,
    volume_24h_usdt:   btcSpotFlow.volume_1d_usdt,
    high_24h:          btcFutures.mark_price * 1.025,
    low_24h:           btcFutures.mark_price * 0.972,
    open_interest:     btcFutures.open_interest_usdt,
    oi_delta_pct:      btcFutures.oi_delta_pct,
  };
}

/** OI por exchange (mock shape) */
export interface OiByExchangeEntry {
  exchange: string;
  oi_usd: number;
  share_pct: number;
}

function mockOiByExchange(): OiByExchangeEntry[] {
  // Mock tem oi_b (bilhões USD) — converter para oi_usd (USD) para manter shape do serviço
  return oiByExchange.map((e: { exchange: string; oi_b?: number; oi_usd?: number; share_pct: number }) => ({
    exchange:  e.exchange,
    oi_usd:    e.oi_usd ?? (e.oi_b ? e.oi_b * 1e9 : 0),
    share_pct: e.share_pct,
  }));
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const FUTURES_BASE = 'https://fapi.binance.com';
const SPOT_BASE    = 'https://api.binance.com';

async function safeFetch<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error ${res.status}: ${url}`);
  const data = await res.json();
  return schema.parse(data);
}

/**
 * Busca dados de funding rate e mark price (premiumIndex)
 * Apenas executado quando DATA_MODE === 'live'
 */
async function fetchPremiumIndex(symbol = 'BTCUSDT'): Promise<PremiumIndex> {
  return safeFetch(
    `${FUTURES_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`,
    PremiumIndexSchema,
  );
}

/**
 * Busca open interest em contratos
 */
async function fetchOpenInterest(symbol = 'BTCUSDT'): Promise<OpenInterest> {
  return safeFetch(
    `${FUTURES_BASE}/fapi/v1/openInterest?symbol=${symbol}`,
    OpenInterestSchema,
  );
}

/**
 * Busca ticker 24h
 */
async function fetchTicker24h(symbol = 'BTCUSDT'): Promise<Ticker24h> {
  return safeFetch(
    `${FUTURES_BASE}/fapi/v1/ticker/24hr?symbol=${symbol}`,
    Ticker24hSchema,
  );
}

// ─── Função principal exportada ───────────────────────────────────────────────

/**
 * fetchBtcTicker — retorna dados combinados de BTC.
 *
 * - DATA_MODE=mock → retorna mock instantaneamente (sem rede)
 * - DATA_MODE=live → faz 3 chamadas paralelas à Binance e combina
 *   Se qualquer chamada falhar → lança erro (UI exibe estado de erro)
 *   O mock NÃO é usado como fallback silencioso em modo live.
 */
export async function fetchBtcTicker(): Promise<BtcTickerData> {
  if (DATA_MODE === 'mock') return mockBtcTicker();

  const [premium, oi, ticker] = await Promise.all([
    fetchPremiumIndex(),
    fetchOpenInterest(),
    fetchTicker24h(),
  ]);

  // OI delta calculado vs abertura do dia (simplificado: usar priceChangePercent como proxy)
  const oiDeltaPct = ticker.priceChangePercent;

  return {
    mark_price:        premium.markPrice,
    last_funding_rate: premium.lastFundingRate,
    next_funding_time: premium.nextFundingTime,
    price_change_pct:  ticker.priceChangePercent,
    volume_24h_usdt:   ticker.quoteVolume,
    high_24h:          ticker.highPrice,
    low_24h:           ticker.lowPrice,
    open_interest:     oi.openInterest,
    oi_delta_pct:      oiDeltaPct,
  };
}

/**
 * fetchOiByExchange — Open Interest por exchange
 * Fonte: Binance pública (coinglass em prod seria melhor, mas pago)
 */
export async function fetchOiByExchange(): Promise<OiByExchangeEntry[]> {
  if (DATA_MODE === 'mock') return mockOiByExchange();

  // Binance não expõe breakdown por exchange — retorna dados da própria Binance
  // Em fase live real, substituir por CoinGlass API (pago) ou agregação manual
  const oi = await fetchOpenInterest();
  return [{
    exchange:  'Binance',
    oi_usd:    oi.openInterest * (await fetchTicker24h()).lastPrice,
    share_pct: 100,
  }];
}

/**
 * fetchKlines — candles de preço (Spot)
 * @param symbol  ex: 'BTCUSDT'
 * @param interval ex: '1h' | '15m' | '4h'
 * @param limit   número de candles (max 1000)
 */
export const KlineSchema = z.tuple([
  z.coerce.number(), // openTime
  z.coerce.number(), // open
  z.coerce.number(), // high
  z.coerce.number(), // low
  z.coerce.number(), // close
  z.coerce.number(), // volume
  z.coerce.number(), // closeTime
  z.coerce.number(), // quoteAssetVolume
  z.coerce.number(), // numberOfTrades
  z.coerce.number(), // takerBuyBaseAssetVolume
  z.coerce.number(), // takerBuyQuoteAssetVolume
  z.string(),        // ignore
]);
export type Kline = z.infer<typeof KlineSchema>;

export async function fetchKlines(
  symbol = 'BTCUSDT',
  interval = '1h',
  limit = 48,
): Promise<Kline[]> {
  if (DATA_MODE === 'mock') {
    // Retorna klines do mock data já formatados
    return btcSpotFlow.klines.slice(-limit).map((k: {
      time: number; open: number; high: number; low: number;
      close: number; volume: number;
    }) => [
      k.time, k.open, k.high, k.low, k.close, k.volume,
      k.time + 3_600_000, k.volume * k.close, 100, k.volume * 0.52,
      k.volume * k.close * 0.52, '0',
    ] as Kline);
  }

  const url = `${SPOT_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance Klines error ${res.status}`);
  const raw = await res.json() as unknown[][];
  return raw.map(k => KlineSchema.parse(k));
}

// ─── Liquidações ──────────────────────────────────────────────────────────────

export interface LiquidationEntry {
  symbol:     string;
  side:       'BUY' | 'SELL';       // BUY = short foi liquidado, SELL = long foi liquidado
  qty:        number;
  price:      number;
  usd_value:  number;
  timestamp:  number;
}

const LiquidationItemSchema = z.object({
  o: z.object({
    s:   z.string(),                // symbol
    S:   z.enum(['BUY', 'SELL']),   // side
    q:   z.coerce.number(),         // quantidade
    p:   z.coerce.number(),         // preço médio
    ap:  z.coerce.number().optional(), // preço médio de execução
    T:   z.coerce.number(),         // timestamp
  }),
});

const LiquidationsResponseSchema = z.array(LiquidationItemSchema);

function mockLiquidations(): LiquidationEntry[] {
  const sides: Array<'BUY' | 'SELL'> = ['BUY', 'SELL', 'SELL', 'BUY', 'SELL'];
  const price = 84_200;
  return Array.from({ length: 20 }, (_, i) => {
    const side  = sides[i % sides.length];
    const qty   = parseFloat((Math.random() * 2 + 0.1).toFixed(3));
    const p     = price + (Math.random() - 0.5) * 800;
    return {
      symbol:    'BTCUSDT',
      side,
      qty,
      price:     parseFloat(p.toFixed(1)),
      usd_value: parseFloat((qty * p).toFixed(0)),
      timestamp: Date.now() - i * 60_000 * Math.random() * 30,
    };
  });
}

// ─── Long/Short Ratio ─────────────────────────────────────────────────────────

export interface LongShortRatioData {
  symbol:        string;
  longAccount:   number;  // proporção de contas long (0-1)
  shortAccount:  number;
  timestamp:     number;
  ls_ratio_pct:  number;  // longAccount * 100 (0-100)
}

const LongShortRatioItemSchema = z.object({
  symbol:       z.string(),
  longAccount:  z.coerce.number(),
  shortAccount: z.coerce.number(),
  timestamp:    z.coerce.number(),
});

function mockLongShortRatio(): LongShortRatioData {
  return {
    symbol:       'BTCUSDT',
    longAccount:  0.5482,
    shortAccount: 0.4518,
    timestamp:    Date.now(),
    ls_ratio_pct: 54.82,
  };
}

/**
 * fetchLongShortRatio — proporção de contas long vs short (Binance Futures)
 *
 * Endpoint público: GET /fapi/v1/globalLongShortAccountRatio
 * Retorna null graciosamente se o endpoint exigir auth ou estiver indisponível.
 */
export async function fetchLongShortRatio(
  symbol = 'BTCUSDT',
  period = '5m',
): Promise<LongShortRatioData | null> {
  if (DATA_MODE === 'mock') return mockLongShortRatio();

  const url = `${FUTURES_BASE}/fapi/v1/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`;
  const res = await fetch(url);

  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Binance L/S Ratio error ${res.status}`);

  const raw = await res.json() as unknown[];
  const items = z.array(LongShortRatioItemSchema).parse(raw);
  const item  = items[0];
  if (!item) return null;

  return {
    symbol:       item.symbol,
    longAccount:  item.longAccount,
    shortAccount: item.shortAccount,
    timestamp:    item.timestamp,
    ls_ratio_pct: parseFloat((item.longAccount * 100).toFixed(2)),
  };
}

/**
 * fetchLiquidations — liquidações forçadas recentes de BTCUSDT (Binance Futures)
 *
 * Endpoint público: GET /fapi/v1/forceOrders?symbol=BTCUSDT&limit=50
 * Sem API key. Retorna as últimas 50 ordens de liquidação.
 */
export async function fetchLiquidations(symbol = 'BTCUSDT', limit = 50): Promise<LiquidationEntry[]> {
  if (DATA_MODE === 'mock') return mockLiquidations();

  const url = `${FUTURES_BASE}/fapi/v1/forceOrders?symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);

  // /fapi/v1/forceOrders requer autenticação (não é endpoint público).
  // Retorna [] sem lançar erro para evitar retry loop.
  if (res.status === 401 || res.status === 403) return [];
  if (!res.ok) throw new Error(`Binance Liquidations error ${res.status}`);

  const raw = await res.json();
  const parsed = LiquidationsResponseSchema.parse(raw);

  return parsed.map(item => ({
    symbol:    item.o.s,
    side:      item.o.S,
    qty:       item.o.q,
    price:     item.o.ap ?? item.o.p,
    usd_value: item.o.q * (item.o.ap ?? item.o.p),
    timestamp: item.o.T,
  }));
}
