/**
 * bybit.ts — Bybit V5 API (dados de derivativos BTC)
 *
 * Base: https://api.bybit.com/v5
 * Sem API key necessária para dados públicos de mercado.
 * Rate limit: 600 req/min (public endpoints)
 *
 * Endpoints usados:
 *   /market/tickers?category=linear&symbol=BTCUSDT — ticker (price, funding, OI)
 *   /market/funding/history?category=linear&symbol=BTCUSDT&limit=8 — histórico funding
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';

const BASE = 'https://api.bybit.com/v5';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const BybitTickerItemSchema = z.object({
  symbol:              z.string(),
  lastPrice:           z.coerce.number(),
  markPrice:           z.coerce.number(),
  indexPrice:          z.coerce.number(),
  fundingRate:         z.coerce.number(),
  nextFundingTime:     z.coerce.number(),
  openInterestValue:   z.coerce.number(),
  openInterest:        z.coerce.number(),
  volume24h:           z.coerce.number(),
  turnover24h:         z.coerce.number(),
  bid1Price:           z.coerce.number().optional(),
  ask1Price:           z.coerce.number().optional(),
});

const BybitTickerResponseSchema = z.object({
  retCode:  z.number(),
  retMsg:   z.string(),
  result:   z.object({
    list: z.array(BybitTickerItemSchema),
  }),
});

const BybitFundingItemSchema = z.object({
  symbol:          z.string(),
  fundingRate:     z.coerce.number(),
  fundingRateTime: z.coerce.number(),
});

const BybitFundingResponseSchema = z.object({
  retCode: z.number(),
  retMsg:  z.string(),
  result:  z.object({
    list: z.array(BybitFundingItemSchema),
  }),
});

// ─── Interfaces exportadas ────────────────────────────────────────────────────

export interface BybitTickerData {
  exchange:         'bybit';
  symbol:           string;
  mark_price:       number;
  index_price:      number;
  last_price:       number;
  funding_rate:     number;
  next_funding_ms:  number;
  open_interest:    number;
  open_interest_usd: number;
  volume_24h:       number;
}

export interface BybitFundingEntry {
  rate:       number;
  timestamp:  number;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

function mockBybitTicker(): BybitTickerData {
  return {
    exchange:         'bybit',
    symbol:           'BTCUSDT',
    mark_price:       84_200,
    index_price:      84_180,
    last_price:       84_190,
    funding_rate:     0.0001,
    next_funding_ms:  Date.now() + 14_400_000,
    open_interest:    78_400,
    open_interest_usd: 6_601_280_000,
    volume_24h:       32_000,
  };
}

function mockBybitFunding(): BybitFundingEntry[] {
  const base = 0.0001;
  return Array.from({ length: 8 }, (_, i) => ({
    rate:      base + (Math.random() - 0.5) * 0.0002,
    timestamp: Date.now() - i * 8 * 3_600_000,
  }));
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * fetchBybitTicker — preço, funding rate e OI do par BTCUSDT perpétuo linear
 */
export async function fetchBybitTicker(): Promise<BybitTickerData> {
  if (DATA_MODE === 'mock') return mockBybitTicker();

  const url = `${BASE}/market/tickers?category=linear&symbol=BTCUSDT`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bybit API error ${res.status}`);

  const raw = await res.json();
  const parsed = BybitTickerResponseSchema.parse(raw);

  if (parsed.retCode !== 0) throw new Error(`Bybit error: ${parsed.retMsg}`);

  const item = parsed.result.list[0];
  if (!item) throw new Error('Bybit: ticker não encontrado');

  return {
    exchange:         'bybit',
    symbol:           item.symbol,
    mark_price:       item.markPrice,
    index_price:      item.indexPrice,
    last_price:       item.lastPrice,
    funding_rate:     item.fundingRate,
    next_funding_ms:  item.nextFundingTime,
    open_interest:    item.openInterest,
    open_interest_usd: item.openInterestValue,
    volume_24h:       item.volume24h,
  };
}

/**
 * fetchBybitFunding — histórico das últimas 8 sessões de funding (24h)
 */
export async function fetchBybitFunding(): Promise<BybitFundingEntry[]> {
  if (DATA_MODE === 'mock') return mockBybitFunding();

  const url = `${BASE}/market/funding/history?category=linear&symbol=BTCUSDT&limit=8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bybit funding API error ${res.status}`);

  const raw = await res.json();
  const parsed = BybitFundingResponseSchema.parse(raw);

  if (parsed.retCode !== 0) throw new Error(`Bybit funding error: ${parsed.retMsg}`);

  return parsed.result.list.map(e => ({
    rate:      e.fundingRate,
    timestamp: e.fundingRateTime,
  }));
}
