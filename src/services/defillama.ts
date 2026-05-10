/**
 * defillama.ts — DeFiLlama Stablecoins API
 *
 * Endpoints públicos (sem autenticação):
 *   https://stablecoins.llama.fi/stablecoins?includePrices=true — lista completa
 *   https://stablecoins.llama.fi/stablecoinchains              — supply por chain
 *
 * Cache: withCache TTL 3600s (1h) — dados de stablecoins mudam lentamente.
 * Rate limit: DeFiLlama não publica limites, mas é generosa. Em caso de 429,
 *   registra em system_logs e retorna mock.
 */

import { z } from 'zod';
import { apiFetch, RateLimitError } from '@/lib/apiClient';
import { withCache } from '@/services/marketCache';
import { DATA_MODE, IS_LIVE } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { env } from '@/lib/env';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface StablecoinSnapshot {
  name: string;
  symbol: string;
  pegType: string;
  circulating: number;       // supply circulante em USD
  circulatingPrev: number;   // supply circulante 24h antes
  change24h: number;         // variação percentual 24h
  chainSupply: Record<string, number>;  // supply por chain
}

export interface StablecoinData {
  totalSupply: number;           // total de todas as stablecoins em USD
  totalChange24h: number;        // variação 24h total em %
  top5: StablecoinSnapshot[];    // top 5 por market cap
  byChain: Array<{ chain: string; tvl: number }>;  // top 5 chains
  updatedAt: number;             // timestamp
  quality: 'A' | 'B' | 'C';
  source: 'DeFiLlama' | 'cache' | 'mock';
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockStablecoinData: StablecoinData = {
  totalSupply: 178_000_000_000,
  totalChange24h: 0.12,
  top5: [
    {
      name: 'Tether',
      symbol: 'USDT',
      pegType: 'peggedUSD',
      circulating: 110_000_000_000,
      circulatingPrev: 109_800_000_000,
      change24h: 0.18,
      chainSupply: { Ethereum: 60_000_000_000, Tron: 40_000_000_000 },
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      pegType: 'peggedUSD',
      circulating: 35_000_000_000,
      circulatingPrev: 34_900_000_000,
      change24h: 0.29,
      chainSupply: { Ethereum: 20_000_000_000, Solana: 8_000_000_000 },
    },
    {
      name: 'DAI',
      symbol: 'DAI',
      pegType: 'peggedUSD',
      circulating: 5_000_000_000,
      circulatingPrev: 5_100_000_000,
      change24h: -1.96,
      chainSupply: { Ethereum: 4_000_000_000 },
    },
    {
      name: 'FDUSD',
      symbol: 'FDUSD',
      pegType: 'peggedUSD',
      circulating: 2_100_000_000,
      circulatingPrev: 2_050_000_000,
      change24h: 2.44,
      chainSupply: { BNB: 1_500_000_000 },
    },
    {
      name: 'PYUSD',
      symbol: 'PYUSD',
      pegType: 'peggedUSD',
      circulating: 900_000_000,
      circulatingPrev: 880_000_000,
      change24h: 2.27,
      chainSupply: { Ethereum: 900_000_000 },
    },
  ],
  byChain: [
    { chain: 'Ethereum', tvl: 80_000_000_000 },
    { chain: 'Tron',     tvl: 45_000_000_000 },
    { chain: 'BNB',      tvl: 20_000_000_000 },
    { chain: 'Solana',   tvl: 12_000_000_000 },
    { chain: 'Arbitrum', tvl:  8_000_000_000 },
  ],
  updatedAt: Date.now(),
  quality: 'B',
  source: 'mock',
};

// ─── Schemas Zod ──────────────────────────────────────────────────────────────

const DefillamaCirculatingSchema = z.object({
  peggedUSD: z.number().optional(),
}).passthrough();

const DefillamaStablecoinSchema = z.object({
  name:        z.string(),
  symbol:      z.string(),
  pegType:     z.string().default('peggedUSD'),
  circulating: DefillamaCirculatingSchema.optional(),
  circulatingPrevDay: DefillamaCirculatingSchema.optional(),
  chainCirculating: z.record(z.object({
    current: DefillamaCirculatingSchema.optional(),
  }).passthrough()).optional(),
}).passthrough();

const DefillamaStablecoinsResponseSchema = z.object({
  peggedAssets: z.array(DefillamaStablecoinSchema),
});

const DefillamaChainSchema = z.object({
  name:       z.string(),
  totalCirculatingUSD: z.object({
    peggedUSD: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

const DefillamaChainArraySchema = z.array(DefillamaChainSchema);

// ─── Helper para registrar rate limit em system_logs ─────────────────────────

async function logRateLimit(retryAfter: number | undefined): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const SB_URL = env.VITE_SUPABASE_URL;
  const SB_KEY = env.VITE_SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return;

  fetch(`${SB_URL}/rest/v1/system_logs`, {
    method: 'POST',
    headers: {
      apikey:         SB_KEY,
      Authorization:  `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer':       'return=minimal',
    },
    body: JSON.stringify({
      level:   'warn',
      source:  'defillama',
      message: 'Rate limit atingido',
      context: { timestamp: Date.now(), retryAfter },
    }),
  }).catch(() => {});
}

// ─── Fetcher principal ────────────────────────────────────────────────────────

async function fetchFromDeFiLlama(): Promise<StablecoinData> {
  const [stablecoinsRes, chainsRes] = await Promise.all([
    apiFetch('https://stablecoins.llama.fi/stablecoins?includePrices=true'),
    apiFetch('https://stablecoins.llama.fi/stablecoinchains'),
  ]);

  const [stablecoinsJson, chainsJson] = await Promise.all([
    stablecoinsRes.json(),
    chainsRes.json(),
  ]);

  const stablecoinsData = DefillamaStablecoinsResponseSchema.parse(stablecoinsJson);
  const chainsData      = DefillamaChainArraySchema.parse(chainsJson);

  const assets = stablecoinsData.peggedAssets;

  const withSupply = assets.map(asset => {
    const circulating    = asset.circulating?.peggedUSD    ?? 0;
    const circulatingPrev = asset.circulatingPrevDay?.peggedUSD ?? circulating;

    const chainSupply: Record<string, number> = {};
    if (asset.chainCirculating) {
      for (const [chain, chainData] of Object.entries(asset.chainCirculating)) {
        const val = chainData.current?.peggedUSD ?? 0;
        if (val > 0) chainSupply[chain] = val;
      }
    }

    const change24h = circulatingPrev > 0
      ? ((circulating - circulatingPrev) / circulatingPrev) * 100
      : 0;

    return {
      name:           asset.name,
      symbol:         asset.symbol,
      pegType:        asset.pegType,
      circulating,
      circulatingPrev,
      change24h,
      chainSupply,
    };
  });

  const sorted = [...withSupply].sort((a, b) => b.circulating - a.circulating);
  const top5   = sorted.slice(0, 5);

  const totalSupply   = withSupply.reduce((s, a) => s + a.circulating, 0);
  const totalPrevious = withSupply.reduce((s, a) => s + a.circulatingPrev, 0);
  const totalChange24h = totalPrevious > 0
    ? ((totalSupply - totalPrevious) / totalPrevious) * 100
    : 0;

  const chainMap = new Map<string, number>();
  for (const chain of chainsData) {
    const tvl = chain.totalCirculatingUSD?.peggedUSD ?? 0;
    if (tvl > 0) chainMap.set(chain.name, tvl);
  }
  const byChain = Array.from(chainMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([chain, tvl]) => ({ chain, tvl }));

  return {
    totalSupply,
    totalChange24h,
    top5,
    byChain,
    updatedAt: Date.now(),
    quality: 'A',
    source: 'DeFiLlama',
  };
}

// ─── Função pública ───────────────────────────────────────────────────────────

export async function fetchStablecoinData(): Promise<StablecoinData> {
  if (DATA_MODE === 'mock') {
    return { ...mockStablecoinData, updatedAt: Date.now() };
  }

  try {
    return await withCache<StablecoinData>(
      'defillama:stablecoins',
      3_600,
      'defillama',
      fetchFromDeFiLlama,
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      logRateLimit(err.retryAfterMs);
      console.warn('[DeFiLlama] Rate limit atingido — retornando mock:', err.message);
      return { ...mockStablecoinData, updatedAt: Date.now(), quality: 'C', source: 'mock' };
    }

    console.error('[DeFiLlama] Erro ao buscar dados — retornando mock:', err);
    return { ...mockStablecoinData, updatedAt: Date.now(), quality: 'C', source: 'mock' };
  }
}
