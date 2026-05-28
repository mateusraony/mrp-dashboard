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
  price_change_percentage_7d:  number | null;
  price_change_percentage_30d: number | null;
  price_change_percentage_90d: number | null;
  price_change_percentage_24h: number;
}

const AltcoinSchema = z.object({
  id:            z.string(),
  symbol:        z.string(),
  name:          z.string(),
  current_price: z.coerce.number(),
  market_cap:    z.coerce.number(),
  // null = CoinGecko did not return this window (coin too new, or API omitted it)
  price_change_percentage_7d_in_currency:  z.coerce.number().nullable().optional().default(null),
  price_change_percentage_30d_in_currency: z.coerce.number().nullable().optional().default(null),
  price_change_percentage_90d_in_currency: z.coerce.number().nullable().optional().default(null),
  price_change_percentage_24h: z.coerce.number().optional().default(0),
});
export const AltcoinsSchema = z.array(AltcoinSchema);

// ─── Dominance history ────────────────────────────────────────────────────────

export interface DominanceHistoryPoint {
  date:    string;
  btc_pct: number;
}

export interface DominanceHistoryData {
  history: DominanceHistoryPoint[];
  days:    number;
  source:  'global' | 'approx';  // 'approx' = /global/market_cap_chart unavailable
}

function mockDominanceHistory(days: number): DominanceHistoryData {
  let btc = 63.4;
  const history: DominanceHistoryPoint[] = Array.from({ length: days + 1 }, (_, i) => {
    const date = new Date(Date.now() - (days - i) * 86_400_000).toISOString().slice(0, 10);
    btc = Math.max(55, Math.min(72, btc + (i % 3 === 0 ? 0.3 : -0.15)));
    return { date, btc_pct: parseFloat(btc.toFixed(2)) };
  });
  return { history, days, source: 'global' };
}

export async function fetchDominanceHistory(days = 30): Promise<DominanceHistoryData> {
  if (DATA_MODE === 'mock') return mockDominanceHistory(days);

  const [btcRes, totalRes] = await Promise.allSettled([
    apiFetch(`${BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`),
    apiFetch(`${BASE}/global/market_cap_chart?days=${days}&vs_currency=usd`),
  ]);

  if (btcRes.status === 'rejected' || !btcRes.value.ok) {
    throw new Error('BTC market_chart fetch failed');
  }

  const btcData = await btcRes.value.json();
  const btcMcaps: [number, number][] = btcData.market_caps ?? [];

  // /global/market_cap_chart may be pro-only — fall back to ratio approximation
  if (totalRes.status === 'rejected' || !totalRes.value.ok) {
    const currentDom = await fetchDominance();
    const lastBtcMcap = btcMcaps.at(-1)?.[1] ?? 1;
    const history: DominanceHistoryPoint[] = btcMcaps.map(([ts, btcMcap]) => ({
      date:    new Date(ts).toISOString().slice(0, 10),
      btc_pct: parseFloat(((btcMcap / lastBtcMcap) * currentDom.btc_dominance).toFixed(2)),
    }));
    return { history, days, source: 'approx' };
  }

  const totalData = await totalRes.value.json();
  const totalMcaps: [number, number][] = totalData.market_cap_chart?.market_cap ?? [];
  const totalByDate = new Map(
    totalMcaps.map(([ts, val]) => [new Date(ts).toISOString().slice(0, 10), val]),
  );

  const history: DominanceHistoryPoint[] = btcMcaps
    .map(([ts, btcMcap]): DominanceHistoryPoint | null => {
      const date  = new Date(ts).toISOString().slice(0, 10);
      const total = totalByDate.get(date);
      if (!total || total === 0) return null;
      return { date, btc_pct: parseFloat(((btcMcap / total) * 100).toFixed(2)) };
    })
    .filter((v): v is DominanceHistoryPoint => v !== null);

  return { history, days, source: 'global' };
}

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

// ─── News ─────────────────────────────────────────────────────────────────────

export interface CoinGeckoNewsItem {
  id:           string;
  title:        string;
  author:       string;
  published_at: string;   // ISO 8601 (normalizado de unix timestamp)
  url:          string;
  news_site:    string;
  thumb_2x?:    string;
}

const CoinGeckoNewsItemSchema = z.object({
  id:           z.union([z.string(), z.number()]).transform(String),
  title:        z.string(),
  author:       z.string().catch(''),
  published_at: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === 'number'
      ? new Date(v * 1_000).toISOString()
      : new Date(v).toISOString(),
  ),
  url:          z.string().url(),
  news_site:    z.string().catch('CoinGecko'),
  thumb_2x:     z.string().optional(),
});

/**
 * fetchCoinGeckoNews — últimas notícias cripto via CoinGecko /news.
 * Gratuito, sem autenticação. Rate limit: 30 req/min free tier.
 * Cache recomendado: 10 min (withCache no hook).
 */
export async function fetchCoinGeckoNews(): Promise<CoinGeckoNewsItem[]> {
  if (DATA_MODE === 'mock') return [];
  const res = await apiFetch(`${BASE}/news`);
  if (!res.ok) throw new Error(`CoinGecko /news ${res.status}`);
  const raw: unknown = await res.json();
  // CoinGecko pode retornar { data: [...] } ou diretamente [...]
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : ((raw as Record<string, unknown>)?.data ?? []) as unknown[];
  const parsed = z.array(CoinGeckoNewsItemSchema).safeParse(list);
  if (!parsed.success) return [];
  return (parsed.data as unknown as CoinGeckoNewsItem[]).slice(0, 20);
}
