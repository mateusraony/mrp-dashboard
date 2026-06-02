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

// ─── Tipos exportados ────────────────────────────────────────────────────────────────────────────────

/** Ponto de dado diário para o gráfico de mint/burn histórico */
export interface StablecoinDailyData {
  label:          string;  // ex: "01/jan" para eixo X
  date:           string;  // ISO date "YYYY-MM-DD"
  usdt_net:       number;  // delta supply USDT em $M (+mint, -burn)
  usdc_net:       number;  // delta supply USDC em $M
  total_net:      number;  // usdt_net + usdc_net
  usdt_supply_b:  number;  // supply total USDT em $B
  usdc_supply_b:  number;  // supply total USDC em $B
  usdt_mint:      number;  // max(0, usdt_net) para barras de mint
  usdc_mint:      number;  // max(0, usdc_net) para barras de mint
  btc_buy_vol_b:  number;  // placeholder — correlação com Binance é fase futura
}

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

// ─── Mock data ──────────────────────────────────────────────────────────────────────────────────

const mockStablecoinData: StablecoinData = {
  totalSupply: 243_000_000_000,
  totalChange24h: 0.08,
  top5: [
    {
      name: 'Tether',
      symbol: 'USDT',
      pegType: 'peggedUSD',
      circulating: 148_000_000_000,
      circulatingPrev: 147_800_000_000,
      change24h: 0.14,
      chainSupply: { Ethereum: 76_000_000_000, Tron: 58_000_000_000 },
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      pegType: 'peggedUSD',
      circulating: 56_000_000_000,
      circulatingPrev: 55_900_000_000,
      change24h: 0.18,
      chainSupply: { Ethereum: 32_000_000_000, Solana: 14_000_000_000 },
    },
    {
      name: 'USDS',
      symbol: 'USDS',
      pegType: 'peggedUSD',
      circulating: 8_200_000_000,
      circulatingPrev: 8_100_000_000,
      change24h: 1.23,
      chainSupply: { Ethereum: 7_500_000_000 },
    },
    {
      name: 'FDUSD',
      symbol: 'FDUSD',
      pegType: 'peggedUSD',
      circulating: 2_800_000_000,
      circulatingPrev: 2_750_000_000,
      change24h: 1.82,
      chainSupply: { BNB: 1_900_000_000 },
    },
    {
      name: 'PYUSD',
      symbol: 'PYUSD',
      pegType: 'peggedUSD',
      circulating: 1_400_000_000,
      circulatingPrev: 1_380_000_000,
      change24h: 1.45,
      chainSupply: { Ethereum: 1_400_000_000 },
    },
  ],
  byChain: [
    { chain: 'Ethereum', tvl: 108_000_000_000 },
    { chain: 'Tron',     tvl:  61_000_000_000 },
    { chain: 'BNB',      tvl:  28_000_000_000 },
    { chain: 'Solana',   tvl:  22_000_000_000 },
    { chain: 'Arbitrum', tvl:  12_000_000_000 },
  ],
  updatedAt: Date.now(),
  quality: 'B',
  source: 'mock',
};

// ─── Schemas Zod ────────────────────────────────────────────────────────────────────────────────

// Schema de cada stablecoin na resposta da DeFiLlama
const DefillamaCirculatingSchema = z.object({
  peggedUSD: z.number().optional(),
}).passthrough();

const DefillamaStablecoinSchema = z.object({
  id:          z.string().optional(),
  name:        z.string(),
  symbol:      z.string(),
  pegType:     z.string().default('peggedUSD'),
  circulating: DefillamaCirculatingSchema.optional(),
  circulatingPrevDay: DefillamaCirculatingSchema.optional(),
  // chainCirculating: supply por chain (objeto com chaves arbitrárias)
  chainCirculating: z.record(z.object({
    // DeFiLlama usa 'current' na maioria das respostas, mas alguns assets usam 'circulating'
    current:     DefillamaCirculatingSchema.optional(),
    circulating: DefillamaCirculatingSchema.optional(),
  }).passthrough()).optional(),
}).passthrough();

const DefillamaStablecoinsResponseSchema = z.object({
  peggedAssets: z.array(DefillamaStablecoinSchema),
});

// Schema para /stablecoinchains
const DefillamaChainSchema = z.object({
  name:       z.string(),
  totalCirculatingUSD: z.object({
    peggedUSD: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

const DefillamaChainArraySchema = z.array(DefillamaChainSchema);

// ─── Helper para registrar rate limit em system_logs ─────────────────────────────────────────────

async function logRateLimit(retryAfter: number | undefined): Promise<void> {
  // Registra apenas se Supabase estiver configurado
  if (!isSupabaseConfigured()) return;

  const SB_URL = env.VITE_SUPABASE_URL;
  const SB_KEY = env.VITE_SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return;

  // Fire-and-forget — não bloqueia o retorno
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
  }).catch(() => {}); // silencia erro de rede
}

// ─── Fetcher principal ───────────────────────────────────────────────────────────────────────────────

/** Busca dados reais das APIs DeFiLlama e transforma para StablecoinData */
async function fetchFromDeFiLlama(): Promise<StablecoinData> {
  // Busca stablecoins e chains em paralelo
  const [stablecoinsRes, chainsRes] = await Promise.all([
    apiFetch('https://stablecoins.llama.fi/stablecoins?includePrices=true'),
    apiFetch('https://stablecoins.llama.fi/stablecoinchains'),
  ]);

  const [stablecoinsJson, chainsJson] = await Promise.all([
    stablecoinsRes.json(),
    chainsRes.json(),
  ]);

  // Valida com Zod — lança se inválido (será capturado pelo caller)
  const stablecoinsData = DefillamaStablecoinsResponseSchema.parse(stablecoinsJson);
  const chainsData      = DefillamaChainArraySchema.parse(chainsJson);

  const assets = stablecoinsData.peggedAssets;

  // Extrai supply atual de cada stablecoin (campo peggedUSD dentro de circulating)
  const withSupply = assets.map(asset => {
    const circulating    = asset.circulating?.peggedUSD    ?? 0;
    const circulatingPrev = asset.circulatingPrevDay?.peggedUSD ?? circulating;

    // Supply por chain
    const chainSupply: Record<string, number> = {};
    if (asset.chainCirculating) {
      for (const [chain, chainData] of Object.entries(asset.chainCirculating)) {
        const val = chainData.current?.peggedUSD ?? chainData.circulating?.peggedUSD ?? 0;
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

  // Ordena por supply e pega top 5
  const sorted = [...withSupply].sort((a, b) => b.circulating - a.circulating);
  const top5   = sorted.slice(0, 5);

  // Total supply
  const totalSupply   = withSupply.reduce((s, a) => s + a.circulating, 0);
  const totalPrevious = withSupply.reduce((s, a) => s + a.circulatingPrev, 0);
  const totalChange24h = totalPrevious > 0
    ? ((totalSupply - totalPrevious) / totalPrevious) * 100
    : 0;

  // Supply por chain — top 5
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

// ─── Função pública ──────────────────────────────────────────────────────────────────────────────────

/**
 * fetchStablecoinData — entry point público para o hook useStablecoinData.
 *
 * Fluxo:
 *   DATA_MODE=mock     → retorna mock imediatamente
 *   DATA_MODE=live     → withCache (TTL 3600s) → API DeFiLlama
 *   429 rate limit     → loga em system_logs, retorna mock com quality 'C'
 *   Zod parse error    → retorna mock com quality 'C'
 */
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
      (d): StablecoinData | null => {
        const data = d as StablecoinData;
        return typeof data?.totalSupply === 'number' && Array.isArray(data?.top5)
          ? data
          : null;
      },
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Registra rate limit em Supabase de forma assíncrona
      logRateLimit(err.retryAfterMs);
      console.warn('[DeFiLlama] Rate limit atingido — retornando mock:', err.message);
      return { ...mockStablecoinData, updatedAt: Date.now(), quality: 'C', source: 'mock' };
    }

    // Zod parse error ou qualquer outro — retorna mock degradado
    console.error('[DeFiLlama] Erro ao buscar dados — retornando mock:', err);
    return { ...mockStablecoinData, updatedAt: Date.now(), quality: 'C', source: 'mock' };
  }
}

// ─── Histórico de Supply — USDT + USDC ───────────────────────────────────────

const DefillamaHistoryTokenSchema = z.object({
  date:                z.number(),
  totalCirculatingUSD: z.object({ peggedUSD: z.number().default(0) }).passthrough().optional(),
  // DeFiLlama usa totalCirculating (em unidades nativas) em algumas respostas históricas;
  // para stablecoins USD-pegged, peggedUSD tem o mesmo valor em dólares.
  totalCirculating:    z.object({ peggedUSD: z.number().default(0) }).passthrough().optional(),
}).passthrough();

const DefillamaStablecoinHistorySchema = z.object({
  tokens: z.array(DefillamaHistoryTokenSchema),
}).passthrough();

/**
 * fetchStablecoinHistory — Retorna histórico diário de supply USDT+USDC via DeFiLlama.
 *
 * Estratégia:
 *   1. Busca a lista /stablecoins para obter os IDs de USDT e USDC
 *   2. Busca /stablecoin/{id} para cada um em paralelo
 *   3. Calcula delta diário (mint-burn net) como variação de supply
 *
 * Substitui ~70% do Glassnode para dados de stablecoin — gratuitamente.
 */
export async function fetchStablecoinHistory(days = 30): Promise<StablecoinDailyData[]> {
  if (DATA_MODE === 'mock') return [];

  // Etapa 1: IDs de USDT e USDC
  const listRes  = await apiFetch('https://stablecoins.llama.fi/stablecoins?includePrices=true');
  const listJson = await listRes.json();
  const parsed   = DefillamaStablecoinsResponseSchema.parse(listJson);

  const assets = parsed.peggedAssets as Array<{ id?: string; symbol: string }>;
  const usdtId = assets.find(a => a.symbol === 'USDT')?.id;
  const usdcId = assets.find(a => a.symbol === 'USDC')?.id;

  if (!usdtId || !usdcId) throw new Error('USDT/USDC IDs not found in DeFiLlama list');

  // Etapa 2: Histórico em paralelo
  const [usdtRes, usdcRes] = await Promise.all([
    apiFetch(`https://stablecoins.llama.fi/stablecoin/${usdtId}`),
    apiFetch(`https://stablecoins.llama.fi/stablecoin/${usdcId}`),
  ]);

  const [usdtJson, usdcJson] = await Promise.all([usdtRes.json(), usdcRes.json()]);
  const usdtHist = DefillamaStablecoinHistorySchema.parse(usdtJson);
  const usdcHist = DefillamaStablecoinHistorySchema.parse(usdcJson);

  // Etapa 3: Alinhar datas e calcular deltas
  const usdtTokens = usdtHist.tokens.sort((a, b) => a.date - b.date);
  const usdcTokens = usdcHist.tokens.sort((a, b) => a.date - b.date);

  // Pegar (days + 1) entradas para calcular `days` deltas
  const needed = days + 1;
  const usdtSlice = usdtTokens.slice(-needed);
  const usdcSlice = usdcTokens.slice(-needed);

  const result: StablecoinDailyData[] = [];

  // Helper: lê peggedUSD do campo USD ou, como fallback, do campo nativo
  const getSupply = (token: typeof usdtSlice[0] | undefined): number =>
    token?.totalCirculatingUSD?.peggedUSD ?? token?.totalCirculating?.peggedUSD ?? 0;

  for (let i = 1; i < usdtSlice.length; i++) {
    const usdtSupplyNow  = getSupply(usdtSlice[i]);
    const usdtSupplyPrev = getSupply(usdtSlice[i - 1]) || usdtSupplyNow;
    const usdcSupplyNow  = getSupply(usdcSlice[i]);
    const usdcSupplyPrev = getSupply(usdcSlice[i - 1]) || usdcSupplyNow;

    const usdtNet = (usdtSupplyNow - usdtSupplyPrev) / 1e6; // em $M
    const usdcNet = (usdcSupplyNow - usdcSupplyPrev) / 1e6;

    const dateObj = new Date(usdtSlice[i].date * 1000);
    const label   = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const date    = dateObj.toISOString().slice(0, 10);

    result.push({
      label,
      date,
      usdt_net:      usdtNet,
      usdc_net:      usdcNet,
      total_net:     usdtNet + usdcNet,
      usdt_supply_b: usdtSupplyNow / 1e9,
      usdc_supply_b: usdcSupplyNow / 1e9,
      usdt_mint:     Math.max(0, usdtNet),
      usdc_mint:     Math.max(0, usdcNet),
      btc_buy_vol_b: 0,
    });
  }

  return result;
}
