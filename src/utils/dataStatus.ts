/**
 * dataStatus.ts — Utilitários de confiabilidade e registro de fontes de dados
 */
import type { DataMode, DataConfidence, DataPoint } from '@/types/dataStatus';
import { DATA_MODE, env } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';

// ─── normalizeDataStatus ───────────────────────────────────────────────────────

export interface NormalizeOptions {
  source: string;
  sourceUrl?: string;
  mode: DataMode;
  confidence?: DataConfidence;
  reason?: string;
  updatedAt?: number;
}

/** Mapeamento padrão de mode → confidence quando não explicitado */
const DEFAULT_CONFIDENCE: Record<DataMode, DataConfidence> = {
  live:          'A',
  estimated:     'B',
  mock:          'D',
  paid_required: 'D',
  error:         'D',
};

/**
 * normalizeDataStatus — wraps qualquer dado em um DataPoint padronizado.
 *
 * Se mode não for 'live', preencha reason para transparência ao usuário.
 */
export function normalizeDataStatus<T>(
  data: T,
  opts: NormalizeOptions,
): DataPoint<T> {
  return {
    data,
    mode:       opts.mode,
    source:     opts.source,
    sourceUrl:  opts.sourceUrl,
    updatedAt:  opts.updatedAt ?? Date.now(),
    confidence: opts.confidence ?? DEFAULT_CONFIDENCE[opts.mode],
    reason:     opts.reason,
  };
}

// ─── SOURCE_REGISTRY ──────────────────────────────────────────────────────────

export interface SourceRegistryEntry {
  name: string;
  url: string;
  free: boolean;
  authRequired: boolean;
  updateFrequency: string;
  limitation?: string;
  staticMode: DataMode;
  staticConfidence: DataConfidence;
}

/**
 * SOURCE_REGISTRY — registro estático de todos os serviços de dados.
 * Fonte única de verdade para a página DataSources e para badges de confiança.
 *
 * Atualizar aqui quando um serviço mudar de comportamento.
 */
export const SOURCE_REGISTRY: Record<string, SourceRegistryEntry> = {
  binance_futures: {
    name: 'Binance Futures',
    url: 'https://fapi.binance.com',
    free: true,
    authRequired: false,
    updateFrequency: '< 5s',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  binance_liquidations: {
    name: 'Binance Liquidations',
    url: 'https://fapi.binance.com/fapi/v1/forceOrders',
    free: false,
    authRequired: true,
    updateFrequency: 'N/A',
    limitation: 'Retorna 401 — endpoint exige autenticação (API Key)',
    staticMode: 'error',
    staticConfidence: 'D',
  },
  binance_ls_ratio: {
    name: 'Binance Long/Short Ratio',
    url: 'https://fapi.binance.com/futures/data/globalLongShortAccountRatio',
    free: true,
    authRequired: false,
    updateFrequency: '5min',
    limitation: 'Pode retornar 403 dependendo da região/configuração',
    staticMode: 'live',
    staticConfidence: 'B',
  },
  deribit: {
    name: 'Deribit Options',
    url: 'https://www.deribit.com/api/v2',
    free: true,
    authRequired: false,
    updateFrequency: '< 30s',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  coingecko: {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3',
    free: true,
    authRequired: false,
    updateFrequency: '5min',
    limitation: 'Rate limit 30 req/min no free tier',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  mempool_basic: {
    name: 'Mempool.space (fees / hashrate / pools)',
    url: 'https://mempool.space/api',
    free: true,
    authRequired: false,
    updateFrequency: '30s – 1h',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  mempool_advanced: {
    name: 'Mempool.space (NUPL / SOPR / Netflow / Whales)',
    url: 'https://mempool.space',
    free: false,
    authRequired: true,
    updateFrequency: 'N/A',
    limitation: 'Requer Glassnode ~$29/mês — não há API pública gratuita',
    staticMode: 'paid_required',
    staticConfidence: 'D',
  },
  gdelt: {
    name: 'GDELT',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc',
    free: true,
    authRequired: false,
    updateFrequency: '15min',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  alternative_me: {
    name: 'Alternative.me (Fear & Greed)',
    url: 'https://api.alternative.me/fng/',
    free: true,
    authRequired: false,
    updateFrequency: '1h',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  coinmetrics: {
    name: 'CoinMetrics Community (MVRV / CDD / HODL)',
    url: 'https://community-api.coinmetrics.io/v4',
    free: true,
    authRequired: false,
    updateFrequency: 'Diário',
    limitation: '~2 req/s, dados apenas diários',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  coinmetrics_nupl: {
    name: 'CoinMetrics (NUPL proxy)',
    url: 'https://community-api.coinmetrics.io/v4',
    free: true,
    authRequired: false,
    updateFrequency: 'Diário',
    limitation: 'Proxy: (MarketCap − RealizedCap) / MarketCap — não é a fórmula oficial Glassnode',
    staticMode: 'estimated',
    staticConfidence: 'B',
  },
  bcb: {
    name: 'BCB OpenData (SELIC / IPCA / USDBRL)',
    url: 'https://api.bcb.gov.br/dados/serie',
    free: true,
    authRequired: false,
    updateFrequency: 'Diário',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  fred: {
    name: 'FRED — St. Louis Fed',
    url: 'https://api.stlouisfed.org/fred',
    free: true,
    authRequired: true,
    updateFrequency: 'Diário',
    limitation: 'Requer FRED_API_KEY em Supabase Secrets (gratuita em stlouisfed.org)',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  macro_consensus: {
    name: 'Consensus Macro (Bloomberg / Refinitiv)',
    url: '',
    free: false,
    authRequired: true,
    updateFrequency: 'N/A',
    limitation: 'Requer Bloomberg Terminal ou Refinitiv — não implementado',
    staticMode: 'paid_required',
    staticConfidence: 'D',
  },
  btc_correlations: {
    name: 'Correlações BTC (calculado)',
    url: '',
    free: true,
    authRequired: false,
    updateFrequency: 'Sob demanda',
    limitation: 'Pearson de séries FRED — cálculo proxy, não fonte direta',
    staticMode: 'estimated',
    staticConfidence: 'B',
  },
  bybit: {
    name: 'Bybit',
    url: 'https://api.bybit.com/v5',
    free: true,
    authRequired: false,
    updateFrequency: '< 10s',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  okx: {
    name: 'OKX',
    url: 'https://www.okx.com/api/v5',
    free: true,
    authRequired: false,
    updateFrequency: '< 10s',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  binance_ws: {
    name: 'Binance WebSocket (BTC preço)',
    url: 'https://fstream.binance.com',
    free: true,
    authRequired: false,
    updateFrequency: '~1s (streaming)',
    limitation: 'Singleton — reconecta com backoff 1s→30s',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  defillama: {
    name: 'DeFiLlama (stablecoins)',
    url: 'https://stablecoins.llama.fi',
    free: true,
    authRequired: false,
    updateFrequency: '1h',
    limitation: 'Rate limit generoso; em 429 retorna dado estimado (quality=C)',
    staticMode: 'live',
    staticConfidence: 'A',
  },
  sosovalue: {
    name: 'SoSoValue (ETF flows)',
    url: 'https://sosovalue.com/developer',
    free: false,
    authRequired: true,
    updateFrequency: '1h',
    limitation: 'Requer VITE_SOSOVALUE_KEY — free tier: 20 req/min. Sem key: sem dados de ETF.',
    staticMode: 'paid_required',
    staticConfidence: 'D',
  },
  reddit: {
    name: 'Reddit JSON API (ETF posts)',
    url: 'https://www.reddit.com',
    free: true,
    authRequired: false,
    updateFrequency: '30min',
    limitation: 'API pública de subreddit — sem autenticação. Pode sofrer rate limit.',
    staticMode: 'live',
    staticConfidence: 'B',
  },
  cryptocompare: {
    name: 'CryptoCompare (fallback CoinGecko)',
    url: 'https://min-api.cryptocompare.com',
    free: true,
    authRequired: false,
    updateFrequency: '5min',
    limitation: 'Ativado automaticamente quando CoinGecko retorna 429. Sem key: 100 req/min.',
    staticMode: 'live',
    staticConfidence: 'B',
  },
  yahoo_finance: {
    name: 'Yahoo Finance (S&P 500 / VIX)',
    url: 'https://query1.finance.yahoo.com',
    free: true,
    authRequired: false,
    updateFrequency: '1h',
    limitation: 'Fallback quando FRED não disponível. Acesso via proxy para evitar CORS.',
    staticMode: 'live',
    staticConfidence: 'B',
  },
  glassnode: {
    name: 'Glassnode (NUPL / SOPR / Netflow / Whales)',
    url: 'https://glassnode.com/pricing',
    free: false,
    authRequired: true,
    updateFrequency: 'N/A',
    limitation: 'Requer plano Standard (~$29/mês). Sem key: NUPL/SOPR/Netflow/Whales são MOCK fixo.',
    staticMode: 'paid_required',
    staticConfidence: 'D',
  },
  x_twitter: {
    name: 'X/Twitter API (sentimento social)',
    url: 'https://developer.x.com/en/products/twitter-api',
    free: false,
    authRequired: true,
    updateFrequency: 'N/A',
    limitation: 'Plano Basic mínimo: $100/mês. Sem key: trending topics e KOL sentiment são HARDCODED.',
    staticMode: 'paid_required',
    staticConfidence: 'D',
  },
};

// ─── getRuntimeMode ───────────────────────────────────────────────────────────

/**
 * getRuntimeMode — retorna o modo real de um serviço no build atual.
 *
 * Leva em conta DATA_MODE global e configuração do Supabase (para FRED via proxy).
 * Como DATA_MODE é lido no bootstrap do módulo, é preciso de page reload
 * para que mudanças de localStorage surtam efeito — comportamento intencional.
 */
export function getRuntimeMode(serviceKey: string): DataMode {
  const reg = SOURCE_REGISTRY[serviceKey];
  if (!reg) return 'error';
  // Em modo mock global, tudo vira mock (exceto paid_required — mantemos para transparência)
  if (DATA_MODE === 'mock' && reg.staticMode !== 'paid_required') return 'mock';
  // FRED requer Supabase configurado (proxy server-side) — sem ele é erro em live mode
  if (serviceKey === 'fred' && !isSupabaseConfigured() && DATA_MODE === 'live') return 'error';
  // SoSoValue requer VITE_SOSOVALUE_KEY — sem key não há dados de ETF
  if (serviceKey === 'sosovalue') {
    if (!env.VITE_SOSOVALUE_KEY) return 'paid_required';
    return DATA_MODE === 'mock' ? 'mock' : 'live';
  }
  return reg.staticMode;
}

/**
 * getSourceSummary — contagem de modos para o banner da página DataSources.
 */
export function getSourceSummary(): Record<DataMode, number> {
  const summary: Record<DataMode, number> = {
    live: 0, mock: 0, estimated: 0, paid_required: 0, error: 0,
  };
  for (const key of Object.keys(SOURCE_REGISTRY)) {
    const mode = getRuntimeMode(key);
    summary[mode]++;
  }
  return summary;
}
