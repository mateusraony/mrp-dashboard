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
import { DATA_MODE, env } from '@/lib/env';
import {
  btcFutures,
  btcSpotFlow,
  oiByExchange,
} from '@/components/data/mockData';
import { futuresBasis as mockFuturesBasis } from '@/components/data/mockDataExtended';

// ─── Proxy helper (fapi endpoints têm CORS bloqueado no browser) ──────────────

async function callFapiViaProxy(endpoint: string): Promise<{ status: number; data: unknown }> {
  const baseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key     = env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !key) throw new Error('Supabase não configurado — proxy indisponível');
  const res = await fetch(`${baseUrl}/functions/v1/fred-proxy`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({ type: 'binance_fapi', params: { endpoint } }),
    signal:  AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok && res.status !== 401 && res.status !== 403) {
    throw new Error(`binance_fapi proxy error ${res.status}: ${(data as Record<string, unknown>).error ?? res.statusText}`);
  }
  return { status: res.status, data };
}

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

/**
 * fetchKlinesAt — candles de preço para um intervalo de tempo específico.
 * Usado por useEventVolatility para computar janelas ±24h em torno de eventos macro.
 * DATA_MODE=mock → retorna [] imediatamente (sem rede).
 */
export async function fetchKlinesAt(
  symbol = 'BTCUSDT',
  interval = '1h',
  startMs: number,
  endMs: number,
  limit = 50,
): Promise<Kline[]> {
  if (DATA_MODE === 'mock') return [];
  const url = `${SPOT_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=${limit}`;
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

// allForceOrders retorna objetos flat (não envelope { o: ... } do WebSocket)
const LiquidationItemSchema = z.object({
  symbol:       z.string(),
  side:         z.enum(['BUY', 'SELL']),
  origQty:      z.coerce.number(),
  executedQty:  z.coerce.number().optional(),
  averagePrice: z.coerce.number(),
  time:         z.coerce.number(),
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

  const { status, data } = await callFapiViaProxy(
    `/fapi/v1/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=1`,
  );
  if (status === 401 || status === 403) return null;
  const items = z.array(LongShortRatioItemSchema).parse(data as unknown[]);
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
 * Endpoint público: GET /fapi/v1/allForceOrders?symbol=BTCUSDT&limit=200
 * Sem API key. Retorna até 1000 ordens de liquidação. Suporta symbol, startTime, endTime, limit.
 */
export async function fetchLiquidations(symbol = 'BTCUSDT', limit = 200): Promise<LiquidationEntry[]> {
  if (DATA_MODE === 'mock') return mockLiquidations();

  const { status, data } = await callFapiViaProxy(
    `/fapi/v1/allForceOrders?symbol=${symbol}&limit=${limit}`,
  );
  if (status === 401 || status === 403) return [];
  const parsed = LiquidationsResponseSchema.parse(data);

  return parsed.map(item => {
    const qty   = item.executedQty ?? item.origQty;
    const price = item.averagePrice;
    return {
      symbol:    item.symbol,
      side:      item.side,
      qty,
      price,
      usd_value: qty * price,
      timestamp: item.time,
    };
  });
}

// ─── Futures Basis (Contango / Backwardation) ─────────────────────────────────

/** Uma entrada de basis para um vencimento de futuro datado vs perp */
export interface FuturesBasisEntry {
  symbol:           string;   // ex: 'BTCUSDT_250627'
  expiry_label:     string;   // ex: 'Jun-27-2025'
  mark_price:       number;
  days_to_exp:      number;
  basis_annualized: number;   // % anualizado = (mark/perp - 1) * 100 * (365 / days_to_exp)
}

/**
 * Schema para um item da resposta de /fapi/v1/premiumIndex (sem symbol específico).
 * Retorna array quando symbol não é passado.
 */
const PremiumIndexArrayItemSchema = z.object({
  symbol:    z.string(),
  markPrice: z.coerce.number(),
});

/**
 * Converte o sufixo de data do símbolo (ex: '250627') em um Date.
 * Formato Binance: YYMMDD → YY20-MM-DD
 */
function parseExpiryFromSymbol(suffix: string): Date | null {
  // sufixo: 6 dígitos YYMMDD
  if (!/^\d{6}$/.test(suffix)) return null;
  const yy = parseInt(suffix.slice(0, 2), 10);
  const mm = parseInt(suffix.slice(2, 4), 10) - 1; // 0-indexed
  const dd = parseInt(suffix.slice(4, 6), 10);
  return new Date(2000 + yy, mm, dd);
}

/**
 * Formata data de expiração como 'Mon-DD-YYYY' (ex: 'Jun-27-2025').
 */
function formatExpiryLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(/,/, '');
}

function mockFuturesBasisData(): FuturesBasisEntry[] {
  return mockFuturesBasis.futures.map(f => ({
    symbol:           `BTCUSDT_MOCK`,
    expiry_label:     f.expiry,
    mark_price:       f.price,
    days_to_exp:      f.days_to_exp,
    basis_annualized: f.basis_annualized,
  }));
}

/**
 * fetchFuturesBasis — busca o basis anualizado de futuros trimestrais BTC vs perp.
 *
 * Endpoint público: GET /fapi/v1/premiumIndex (sem symbol → retorna todos)
 * Sem autenticação necessária.
 *
 * - DATA_MODE=mock → retorna mockFuturesBasis.futures diretamente
 * - DATA_MODE=live → chama API real e calcula basis vs perp
 */
export async function fetchFuturesBasis(): Promise<FuturesBasisEntry[]> {
  if (DATA_MODE === 'mock') return mockFuturesBasisData();

  const url = `${FUTURES_BASE}/fapi/v1/premiumIndex`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance premiumIndex error ${res.status}`);

  const raw = await res.json();
  const items = z.array(PremiumIndexArrayItemSchema).parse(raw);

  // Encontrar o perp BTCUSDT (sem underscore = perp)
  const perp = items.find(i => i.symbol === 'BTCUSDT');
  if (!perp || perp.markPrice <= 0) throw new Error('BTCUSDT perp not found in premiumIndex');

  const now = Date.now();

  // Filtrar contratos trimestrais BTC: padrão BTCUSDT_YYMMDD
  const quarterlyPattern = /^BTCUSDT_(\d{6})$/;
  const results: FuturesBasisEntry[] = [];

  for (const item of items) {
    const match = item.symbol.match(quarterlyPattern);
    if (!match) continue;

    const expiry = parseExpiryFromSymbol(match[1]);
    if (!expiry) continue;

    const daysToExp = Math.max(1, Math.round((expiry.getTime() - now) / 86_400_000));
    // Ignorar contratos já expirados
    if (daysToExp <= 0) continue;

    const basisPct = (item.markPrice / perp.markPrice - 1) * 100;
    const basisAnnualized = basisPct * (365 / daysToExp);

    results.push({
      symbol:           item.symbol,
      expiry_label:     formatExpiryLabel(expiry),
      mark_price:       item.markPrice,
      days_to_exp:      daysToExp,
      basis_annualized: parseFloat(basisAnnualized.toFixed(4)),
    });
  }

  // Ordenar por dias para expiração (mais próximo primeiro)
  results.sort((a, b) => a.days_to_exp - b.days_to_exp);
  return results;
}

// ─── Open Interest Histórico ──────────────────────────────────────────────────

/** fetchOiHistory — Open Interest histórico 30 dias (Binance openInterestHist, público) */
export async function fetchOiHistory(): Promise<Array<{ t: number; oi: number }>> {
  if (DATA_MODE === 'mock') return [];
  const url = `${FUTURES_BASE}/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OI History error ${res.status}`);
  const raw: Array<{ timestamp: number; sumOpenInterestValue: string }> = await res.json();
  return raw.map(r => ({ t: r.timestamp, oi: parseFloat((parseFloat(r.sumOpenInterestValue) / 1e9).toFixed(2)) }));
}
