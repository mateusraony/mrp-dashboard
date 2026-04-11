/**
 * coingecko.ts — CoinGecko API (free tier, sem autenticação)
 *
 * Rate limit: 30 req/min free tier. Usar staleTime agressivo nos hooks.
 * Endpoints usados: /api/v3/global (dominance, market cap)
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import { btcDominance, stablecoinSupply } from '@/components/data/mockData';
import { ethDominance, topAltcoins } from '@/components/data/mockDataAltcoins';

const BASE = 'https://api.coingecko.com/api/v3';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const GlobalDataSchema = z.object({
  data: z.object({
    active_cryptocurrencies:  z.number(),
    total_market_cap:         z.record(z.string(), z.coerce.number()),
    total_volume:             z.record(z.string(), z.coerce.number()),
    market_cap_percentage:    z.record(z.string(), z.coerce.number()),
    market_cap_change_percentage_24h_usd: z.coerce.number(),
    updated_at: z.coerce.number(),
  }),
});
export type GlobalData = z.infer<typeof GlobalDataSchema>;

export interface DominanceData {
  btc_dominance:    number;
  eth_dominance:    number;
  others_dominance: number;
  total_mcap_usd:   number;
  stablecoin_supply_b: number;
  updated_at:       number;
}

// ─── Mock transformers ────────────────────────────────────────────────────────

function mockDominance(): DominanceData {
  return {
    btc_dominance:       btcDominance.value,
    eth_dominance:       ethDominance.value,
    others_dominance:    100 - btcDominance.value - ethDominance.value,
    total_mcap_usd:      2_840_000_000_000,
    stablecoin_supply_b: stablecoinSupply.total_b,
    updated_at:          Date.now(),
  };
}

// ─── Altcoin shape ────────────────────────────────────────────────────────────

export interface AltcoinMarketData {
  id:            string;
  symbol:        string;
  name:          string;
  current_price: number;
  market_cap:    number;
  price_change_percentage_7d:  number;
  price_change_percentage_30d: number;
  price_change_percentage_24h: number;
}

const AltcoinSchema = z.object({
  id:            z.string(),
  symbol:        z.string(),
  name:          z.string(),
  current_price: z.coerce.number(),
  market_cap:    z.coerce.number(),
  price_change_percentage_7d_in_currency:  z.coerce.number().optional().default(0),
  price_change_percentage_30d_in_currency: z.coerce.number().optional().default(0),
  price_change_percentage_24h: z.coerce.number().optional().default(0),
});
export const AltcoinsSchema = z.array(AltcoinSchema);

function mockAltcoins(): AltcoinMarketData[] {
  return topAltcoins.map(a => ({
    id:            a.symbol.toLowerCase(),
    symbol:        a.symbol,
    name:          a.name,
    current_price: (a.mcap_b * 1e9) / (a.symbol === 'ETH' ? 2_800 : 1),
    market_cap:    a.mcap_b * 1e9,
    price_change_percentage_7d:  a.ret_7d,
    price_change_percentage_30d: a.ret_30d,
    price_change_percentage_24h: a.ret_7d / 7,
  }));
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * fetchDominance — BTC/ETH dominance + total market cap
 * Cache recomendado: 5 minutos (staleTime no hook)
 */
export async function fetchDominance(): Promise<DominanceData> {
  if (DATA_MODE === 'mock') return mockDominance();

  const res = await fetch(`${BASE}/global`);
  if (!res.ok) throw new Error(`CoinGecko /global error ${res.status}`);

  const raw = await res.json();
  const parsed = GlobalDataSchema.parse(raw);
  const pct = parsed.data.market_cap_percentage;

  return {
    btc_dominance:       pct['btc'] ?? 0,
    eth_dominance:       pct['eth'] ?? 0,
    others_dominance:    100 - (pct['btc'] ?? 0) - (pct['eth'] ?? 0),
    total_mcap_usd:      parsed.data.total_market_cap['usd'] ?? 0,
    stablecoin_supply_b: ((pct['usdt'] ?? 0) + (pct['usdc'] ?? 0)) / 100 * (parsed.data.total_market_cap['usd'] ?? 0) / 1e9,
    updated_at:          parsed.data.updated_at,
  };
}

/**
 * fetchTopAltcoins — top altcoins por market cap com retornos 7d/30d
 * Cache recomendado: 5 minutos
 * @param limit número de moedas (padrão 20)
 */
export async function fetchTopAltcoins(limit = 20): Promise<AltcoinMarketData[]> {
  if (DATA_MODE === 'mock') return mockAltcoins();

  const params = new URLSearchParams({
    vs_currency:              'usd',
    order:                    'market_cap_desc',
    per_page:                 String(limit),
    page:                     '1',
    price_change_percentage:  '7d,30d',
  });

  const res = await fetch(`${BASE}/coins/markets?${params}`);
  if (!res.ok) throw new Error(`CoinGecko /coins/markets error ${res.status}`);

  const raw = await res.json();
  const parsed = AltcoinsSchema.parse(raw);

  return parsed.map(c => ({
    id:            c.id,
    symbol:        c.symbol.toUpperCase(),
    name:          c.name,
    current_price: c.current_price,
    market_cap:    c.market_cap,
    price_change_percentage_7d:  c.price_change_percentage_7d_in_currency,
    price_change_percentage_30d: c.price_change_percentage_30d_in_currency,
    price_change_percentage_24h: c.price_change_percentage_24h,
  }));
}
