/**
 * coingecko.ts — CoinGecko API (free tier, sem autenticação)
 *
 * Rate limit: 30 req/min free tier.
 * Resiliência:
 *   - Sprint A: cache de borda no Supabase (market_cache, TTL 5 min)
 *   - Sprint B: apiFetch com retry 5xx + fallback CryptoCompare em 429
 *
 * Regra de mock: mock NÃO substitui live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import { btcDominance, stablecoinSupply } from '@/components/data/mockData';
import { ethDominance, topAltcoins } from '@/components/data/mockDataAltcoins';
import { withCache } from './marketCache';
import { apiFetch, RateLimitError } from '@/lib/apiClient';
import { fetchAltcoinsFromCryptoCompare } from './providers/cryptoCompare';

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
  btc_dominance:       number;
  eth_dominance:       number;
  others_dominance:    number;
  total_mcap_usd:      number;
  stablecoin_supply_b: number;
  updated_at:          number;
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
  price_change_percentage_90d: number;
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
  price_change_percentage_90d_in_currency: z.coerce.number().optional().default(0),
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
    price_change_percentage_90d: a.ret_30d * 2.5,
    price_change_percentage_24h: a.ret_7d / 7,
  }));
}

// ─── Validadores de cache (previnem cache poisoning — Sprint A P1) ─────────────

function validateDominance(v: unknown): DominanceData | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  if (typeof d.btc_dominance !== 'number') return null;
  if (typeof d.total_mcap_usd !== 'number') return null;
  return d as unknown as DominanceData;
}

function validateAltcoins(v: unknown): AltcoinMarketData[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const first = (v[0] as Record<string, unknown>);
  if (typeof first?.current_price !== 'number') return null;
  return v as AltcoinMarketData[];
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * fetchDominance — BTC/ETH dominance + total market cap
 * Cache: 5 min (Supabase market_cache — Sprint A)
 * Retry: 3× com backoff em 5xx (apiFetch — Sprint B)
 * Fallback em 429: não disponível — dominância é exclusiva do CoinGecko
 */
export async function fetchDominance(): Promise<DominanceData> {
  if (DATA_MODE === 'mock') return mockDominance();

  return withCache('coingecko:dominance', 300, 'coingecko', async () => {
    const res = await apiFetch(`${BASE}/global`);
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
  }, validateDominance);
}

/**
 * fetchTopAltcoins — top altcoins por market cap
 * Cache: 5 min (Supabase market_cache — Sprint A)
 * Retry: 3× com backoff em 5xx (apiFetch — Sprint B)
 * Fallback em 429: CryptoCompare /top/totalvolfull (sem 7d/30d/90d)
 */
export async function fetchTopAltcoins(limit = 20): Promise<AltcoinMarketData[]> {
  if (DATA_MODE === 'mock') return mockAltcoins();

  return withCache(`coingecko:altcoins:${limit}`, 300, 'coingecko', async () => {
    try {
      const params = new URLSearchParams({
        vs_currency:             'usd',
        order:                   'market_cap_desc',
        per_page:                String(limit),
        page:                    '1',
        price_change_percentage: '7d,30d,90d',
      });

      const res = await apiFetch(`${BASE}/coins/markets?${params}`);
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
        price_change_percentage_90d: c.price_change_percentage_90d_in_currency,
        price_change_percentage_24h: c.price_change_percentage_24h,
      }));
    } catch (err) {
      // Fallback automático para CryptoCompare quando CoinGecko está com rate limit
      if (err instanceof RateLimitError) {
        return fetchAltcoinsFromCryptoCompare(limit);
      }
      throw err;
    }
  }, validateAltcoins);
}
