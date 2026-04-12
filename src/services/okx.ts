/**
 * okx.ts — OKX API V5 (dados de derivativos BTC)
 *
 * Base: https://www.okx.com/api/v5
 * Sem API key necessária para dados públicos de mercado.
 * Rate limit: 20 req/2s por IP (public endpoints)
 *
 * Endpoints usados:
 *   /public/funding-rate?instId=BTC-USDT-SWAP         — funding rate atual
 *   /market/ticker?instId=BTC-USDT-SWAP               — ticker (price, OI)
 *   /public/funding-rate-history?instId=BTC-USDT-SWAP — histórico funding
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';

const BASE = 'https://www.okx.com/api/v5';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const OkxFundingSchema = z.object({
  code: z.string(),
  data: z.array(z.object({
    instId:          z.string(),
    fundingRate:     z.coerce.number(),
    nextFundingRate: z.coerce.number().optional(),
    fundingTime:     z.coerce.number(),
    nextFundingTime: z.coerce.number().optional(),
    method:          z.string().optional(),
  })),
});

const OkxTickerSchema = z.object({
  code: z.string(),
  data: z.array(z.object({
    instId:    z.string(),
    last:      z.coerce.number(),
    bidPx:     z.coerce.number().optional(),
    askPx:     z.coerce.number().optional(),
    open24h:   z.coerce.number().optional(),
    volCcy24h: z.coerce.number().optional(),
    vol24h:    z.coerce.number().optional(),
    oi:        z.coerce.number().optional(),
    oiCcy:     z.coerce.number().optional(),
  })),
});

const OkxFundingHistorySchema = z.object({
  code: z.string(),
  data: z.array(z.object({
    instId:      z.string(),
    fundingRate: z.coerce.number(),
    fundingTime: z.coerce.number(),
  })),
});

// ─── Interfaces exportadas ────────────────────────────────────────────────────

export interface OkxTickerData {
  exchange:         'okx';
  symbol:           string;
  last_price:       number;
  funding_rate:     number;
  next_funding_rate: number;
  next_funding_ms:  number;
  open_interest:    number;
  open_interest_usd: number;
  volume_24h:       number;
}

export interface OkxFundingEntry {
  rate:       number;
  timestamp:  number;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

function mockOkxTicker(): OkxTickerData {
  return {
    exchange:          'okx',
    symbol:            'BTC-USDT-SWAP',
    last_price:        84_150,
    funding_rate:      0.00008,
    next_funding_rate: 0.00010,
    next_funding_ms:   Date.now() + 14_400_000,
    open_interest:     72_100,
    open_interest_usd: 6_068_415_000,
    volume_24h:        28_500,
  };
}

function mockOkxFunding(): OkxFundingEntry[] {
  const base = 0.00008;
  return Array.from({ length: 8 }, (_, i) => ({
    rate:      base + (Math.random() - 0.5) * 0.00015,
    timestamp: Date.now() - i * 8 * 3_600_000,
  }));
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * fetchOkxTicker — preço, funding rate, OI do BTCUSDT perpétuo OKX
 */
export async function fetchOkxTicker(): Promise<OkxTickerData> {
  if (DATA_MODE === 'mock') return mockOkxTicker();

  // Busca funding + ticker em paralelo
  const [resFund, resTicker] = await Promise.all([
    fetch(`${BASE}/public/funding-rate?instId=BTC-USDT-SWAP`),
    fetch(`${BASE}/market/ticker?instId=BTC-USDT-SWAP`),
  ]);

  if (!resFund.ok)   throw new Error(`OKX funding API error ${resFund.status}`);
  if (!resTicker.ok) throw new Error(`OKX ticker API error ${resTicker.status}`);

  const [rawFund, rawTicker] = await Promise.all([resFund.json(), resTicker.json()]);

  const parsedFund   = OkxFundingSchema.parse(rawFund);
  const parsedTicker = OkxTickerSchema.parse(rawTicker);

  if (parsedFund.code !== '0')   throw new Error(`OKX funding error: code=${parsedFund.code}`);
  if (parsedTicker.code !== '0') throw new Error(`OKX ticker error: code=${parsedTicker.code}`);

  const fund   = parsedFund.data[0];
  const ticker = parsedTicker.data[0];

  if (!fund || !ticker) throw new Error('OKX: dados ausentes no response');

  // OI em contratos × 0.01 BTC (tamanho do contrato BTC-USDT-SWAP) × last_price
  const oiContracts = ticker.oi ?? 0;
  const oiUsd       = oiContracts * 0.01 * ticker.last;

  return {
    exchange:          'okx',
    symbol:            'BTC-USDT-SWAP',
    last_price:        ticker.last,
    funding_rate:      fund.fundingRate,
    next_funding_rate: fund.nextFundingRate ?? 0,
    next_funding_ms:   fund.nextFundingTime ?? 0,
    open_interest:     oiContracts,
    open_interest_usd: oiUsd,
    volume_24h:        ticker.vol24h ?? 0,
  };
}

/**
 * fetchOkxFunding — histórico das últimas 8 sessões de funding
 */
export async function fetchOkxFunding(): Promise<OkxFundingEntry[]> {
  if (DATA_MODE === 'mock') return mockOkxFunding();

  const url = `${BASE}/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OKX funding history error ${res.status}`);

  const raw    = await res.json();
  const parsed = OkxFundingHistorySchema.parse(raw);

  if (parsed.code !== '0') throw new Error(`OKX funding history error: code=${parsed.code}`);

  return parsed.data.map(e => ({
    rate:      e.fundingRate,
    timestamp: e.fundingTime,
  }));
}
