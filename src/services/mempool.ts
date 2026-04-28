/**
 * mempool.ts — Mempool.space API (on-chain Bitcoin)
 *
 * API pública, sem autenticação, sem limite estrito.
 * Documentação: https://mempool.space/docs/api/rest
 *
 * Endpoints usados:
 *   /api/v1/fees/recommended        — taxas recomendadas (sat/vB)
 *   /api/mempool                    — estado atual da mempool
 *   /api/v1/difficulty-adjustment   — próximo ajuste de dificuldade
 *   /api/v1/mining/hashrate/pools/1w — hashrate por pool (última semana)
 *   /api/v1/mining/hashrate/3m      — hashrate histórico 3 meses
 *   /api/blocks/tip/height          — altura atual do bloco
 *
 * Nota: NUPL, MVRV, SOPR, Exchange Netflow, Whale Activity são métricas
 * on-chain privadas (Glassnode, CryptoQuant). Neste serviço ficam como
 * mock até integração paga ser autorizada.
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import {
  onChain,
  btcNUPL,
  btcSOPR,
  btcExchangeNetflow,
  btcWhaleActivity,
  btcRealizedMetrics,
  btcHashRate,
} from '@/components/data/mockData';

const BASE = 'https://mempool.space';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const FeesSchema = z.object({
  fastestFee:  z.coerce.number(),
  halfHourFee: z.coerce.number(),
  hourFee:     z.coerce.number(),
  economyFee:  z.coerce.number(),
  minimumFee:  z.coerce.number(),
});

const MempoolSchema = z.object({
  count:     z.coerce.number(),
  vsize:     z.coerce.number(),
  total_fee: z.coerce.number(),
  fee_histogram: z.array(z.tuple([z.number(), z.number()])).optional(),
});

const DifficultyAdjSchema = z.object({
  progressPercent:     z.coerce.number(),
  difficultyChange:    z.coerce.number(),
  estimatedRetargetDate: z.coerce.number(),
  remainingBlocks:     z.coerce.number(),
  remainingTime:       z.coerce.number(),
  previousRetarget:    z.coerce.number(),
  currentDifficulty:   z.coerce.number(),
  nextRetargetHeight:  z.coerce.number(),
});

const HashrateSchema = z.object({
  hashrates: z.array(z.object({
    timestamp:   z.coerce.number(),
    avgHashrate: z.coerce.number(),
    difficulty:  z.coerce.number().optional(),
  })),
  difficulty: z.array(z.object({
    timestamp:  z.coerce.number(),
    difficulty: z.coerce.number(),
    height:     z.coerce.number().optional(),
  })).optional(),
  currentHashrate: z.coerce.number().optional(),
  currentDifficulty: z.coerce.number().optional(),
});

const PoolsSchema = z.object({
  pools: z.array(z.object({
    poolId:         z.number().optional(),
    name:           z.string(),
    link:           z.string().optional(),
    blockCount:     z.coerce.number(),
    rank:           z.coerce.number().optional(),
    emptyBlocks:    z.coerce.number().optional(),
    slug:           z.string().optional(),
    avgMatchRate:   z.coerce.number().optional(),
    avgFeeDelta:    z.string().optional(),
    share:          z.coerce.number(),
  })),
  blockCount: z.coerce.number().optional(),
});

// ─── Shapes exportadas ────────────────────────────────────────────────────────

export interface FeesData {
  fastest_fee:   number;   // sat/vB para próximo bloco
  half_hour_fee: number;   // sat/vB para ~30min
  hour_fee:      number;   // sat/vB para ~1h
  economy_fee:   number;   // sat/vB para ≤24h
}

export interface MempoolData {
  tx_count:     number;
  vsize_bytes:  number;
  total_fee_btc: number;
  fees:         FeesData;
}

export interface HashrateData {
  current_eh:      number;   // EH/s atual
  prev_7d_eh:      number;
  prev_30d_eh:     number;
  delta_7d_pct:    number;
  delta_30d_pct:   number;
  difficulty:      number;
  prev_difficulty: number;
  diff_adj_pct:    number;   // último ajuste de dificuldade %
  next_adj_est_pct: number;  // estimativa do próximo ajuste %
  next_adj_blocks: number;   // blocos restantes até próximo ajuste
  history:         Array<{ timestamp: number; eh: number }>;
}

export interface MiningPoolEntry {
  name:       string;
  share_pct:  number;
  blocks_1w:  number;
}

/** Métricas on-chain avançadas — NUPL, SOPR, MVRV, Netflow, Whales */
export interface OnChainAdvancedData {
  /** Metadados de confiabilidade — sempre paid_required (sem API pública gratuita) */
  _meta: {
    mode: 'paid_required';
    reason: string;
    confidence: 'D';
  };
  nupl: {
    value:       number;
    zone:        string;
    zone_color:  string;
    prev_7d:     number;
    prev_30d:    number;
    delta_7d:    number;
    delta_30d:   number;
    quality:     'A' | 'B' | 'C';
  };
  sopr: {
    value:       number;
    smoothed_7d: number;
    prev_7d:     number;
    delta_7d:    number;
    quality:     'A' | 'B' | 'C';
  };
  mvrv: {
    ratio:       number;
    zscore:      number;
    realized_price: number;
    zone:        string;
    zone_color:  string;
    quality:     'A' | 'B' | 'C';
  };
  exchange_netflow: {
    netflow_24h:  number;
    inflow_24h:   number;
    outflow_24h:  number;
    netflow_7d:   number;
    reserves:     number;
    quality:      'A' | 'B' | 'C';
  };
  whales: {
    txs_over_1m_24h:   number;
    txs_over_10m_24h:  number;
    delta_1m_vs_avg:   number;
    delta_10m_vs_avg:  number;
    quality:           'A' | 'B' | 'C';
  };
}

// ─── Mock transformers ────────────────────────────────────────────────────────

function mockMempoolData(): MempoolData {
  return {
    tx_count:      onChain.mempool.count,
    vsize_bytes:   onChain.mempool.vsize,
    total_fee_btc: onChain.mempool.total_fee,
    fees: {
      fastest_fee:   onChain.fees.fastestFee,
      half_hour_fee: onChain.fees.halfHourFee,
      hour_fee:      onChain.fees.hourFee,
      economy_fee:   onChain.fees.economyFee,
    },
  };
}

function mockHashrateData(): HashrateData {
  return {
    current_eh:       btcHashRate.hash_rate_eh,
    prev_7d_eh:       btcHashRate.hash_rate_prev_7d,
    prev_30d_eh:      btcHashRate.hash_rate_prev_30d,
    delta_7d_pct:     btcHashRate.delta_7d_pct,
    delta_30d_pct:    btcHashRate.delta_30d_pct,
    difficulty:       btcHashRate.difficulty,
    prev_difficulty:  btcHashRate.difficulty_prev,
    diff_adj_pct:     btcHashRate.difficulty_adj_pct,
    next_adj_est_pct: btcHashRate.next_adj_est_pct,
    next_adj_blocks:  btcHashRate.next_adj_blocks,
    history:          btcHashRate.history['1m'].map((h, i) => ({
      timestamp: Date.now() - (29 - i) * 86_400_000,
      eh:        h.v,
    })),
  };
}

function mockOnChainAdvanced(): OnChainAdvancedData {
  return {
    _meta: {
      mode: 'paid_required',
      reason: 'NUPL/SOPR/Netflow/Whales requerem Glassnode (~$29/mês). Exibindo dados de demonstração.',
      confidence: 'D',
    },
    nupl: {
      value:      btcNUPL.value,
      zone:       btcNUPL.zone,
      zone_color: btcNUPL.zone_color,
      prev_7d:    btcNUPL.prev_7d,
      prev_30d:   btcNUPL.prev_30d,
      delta_7d:   btcNUPL.delta_7d,
      delta_30d:  btcNUPL.delta_30d,
      quality:    btcNUPL.quality as 'A' | 'B' | 'C',
    },
    sopr: {
      value:       btcSOPR.value,
      smoothed_7d: btcSOPR.smoothed_7d,
      prev_7d:     btcSOPR.prev_7d,
      delta_7d:    btcSOPR.delta_7d,
      quality:     btcSOPR.quality as 'A' | 'B' | 'C',
    },
    mvrv: {
      ratio:          btcRealizedMetrics.mvrv_ratio,
      zscore:         btcRealizedMetrics.mvrv_zscore,
      realized_price: btcRealizedMetrics.realized_price,
      zone:           btcRealizedMetrics.mvrv_zone,
      zone_color:     btcRealizedMetrics.mvrv_zone_color,
      quality:        'B',
    },
    exchange_netflow: {
      netflow_24h:  btcExchangeNetflow.netflow_24h,
      inflow_24h:   btcExchangeNetflow.inflow_24h,
      outflow_24h:  btcExchangeNetflow.outflow_24h,
      netflow_7d:   btcExchangeNetflow.netflow_7d,
      reserves:     btcExchangeNetflow.exchange_reserves,
      quality:      btcExchangeNetflow.quality as 'A' | 'B' | 'C',
    },
    whales: {
      txs_over_1m_24h:  btcWhaleActivity.txs_over_1m_24h,
      txs_over_10m_24h: btcWhaleActivity.txs_over_10m_24h,
      delta_1m_vs_avg:  btcWhaleActivity.delta_1m_vs_avg,
      delta_10m_vs_avg: btcWhaleActivity.delta_10m_vs_avg,
      quality:          btcWhaleActivity.quality as 'A' | 'B' | 'C',
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mempool.space API error ${res.status}: ${url}`);
  const data = await res.json();
  return schema.parse(data);
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * fetchMempoolState — taxas recomendadas + estado da mempool
 * Cache recomendado: 30s (dado em tempo real)
 */
export async function fetchMempoolState(): Promise<MempoolData> {
  if (DATA_MODE === 'mock') return mockMempoolData();

  const [fees, mempool] = await Promise.all([
    safeFetch(`${BASE}/api/v1/fees/recommended`, FeesSchema),
    safeFetch(`${BASE}/api/mempool`, MempoolSchema),
  ]);

  return {
    tx_count:      mempool.count,
    vsize_bytes:   mempool.vsize,
    total_fee_btc: mempool.total_fee / 1e8, // converter satoshis → BTC
    fees: {
      fastest_fee:   fees.fastestFee,
      half_hour_fee: fees.halfHourFee,
      hour_fee:      fees.hourFee,
      economy_fee:   fees.economyFee,
    },
  };
}

/**
 * fetchHashrate — hashrate atual, histórico 3M e dificuldade
 * Cache recomendado: 5 minutos (atualiza a cada bloco ~10min)
 */
export async function fetchHashrate(): Promise<HashrateData> {
  if (DATA_MODE === 'mock') return mockHashrateData();

  const [hashrateData, diffAdj] = await Promise.all([
    safeFetch(`${BASE}/api/v1/mining/hashrate/3m`, HashrateSchema),
    safeFetch(`${BASE}/api/v1/difficulty-adjustment`, DifficultyAdjSchema),
  ]);

  const history = hashrateData.hashrates;
  const current = hashrateData.currentHashrate ?? history[history.length - 1]?.avgHashrate ?? 0;
  const idx7d   = Math.max(0, history.length - 7);
  const idx30d  = Math.max(0, history.length - 30);
  const prev7d  = history[idx7d]?.avgHashrate ?? current;
  const prev30d = history[idx30d]?.avgHashrate ?? current;

  // Converter H/s → EH/s (÷ 1e18)
  const toEh = (v: number) => v / 1e18;

  return {
    current_eh:       toEh(current),
    prev_7d_eh:       toEh(prev7d),
    prev_30d_eh:      toEh(prev30d),
    delta_7d_pct:     prev7d  ? (current - prev7d)  / prev7d  * 100 : 0,
    delta_30d_pct:    prev30d ? (current - prev30d) / prev30d * 100 : 0,
    difficulty:       hashrateData.currentDifficulty ?? diffAdj.currentDifficulty,
    prev_difficulty:  diffAdj.currentDifficulty / (1 + diffAdj.previousRetarget / 100),
    diff_adj_pct:     diffAdj.previousRetarget,
    next_adj_est_pct: diffAdj.difficultyChange,
    next_adj_blocks:  diffAdj.remainingBlocks,
    history: history.map(h => ({
      timestamp: h.timestamp * 1000, // Mempool usa segundos → ms
      eh:        toEh(h.avgHashrate),
    })),
  };
}

/**
 * fetchMiningPools — distribuição de hashrate por pool (última semana)
 * Cache recomendado: 1 hora
 */
export async function fetchMiningPools(): Promise<MiningPoolEntry[]> {
  if (DATA_MODE === 'mock') {
    // Pools simuladas
    return [
      { name: 'Foundry USA', share_pct: 28.4, blocks_1w: 142 },
      { name: 'AntPool',     share_pct: 19.2, blocks_1w: 96  },
      { name: 'F2Pool',      share_pct: 14.8, blocks_1w: 74  },
      { name: 'Binance Pool',share_pct: 11.6, blocks_1w: 58  },
      { name: 'ViaBTC',      share_pct: 9.4,  blocks_1w: 47  },
      { name: 'Outros',      share_pct: 16.6, blocks_1w: 83  },
    ];
  }

  const data = await safeFetch(`${BASE}/api/v1/mining/pools/1w`, PoolsSchema);

  return data.pools.map(p => ({
    name:       p.name,
    share_pct:  p.share * 100,
    blocks_1w:  p.blockCount,
  }));
}

/**
 * fetchOnChainAdvanced — NUPL, SOPR, MVRV, Exchange Netflow, Whale Activity
 *
 * ATENÇÃO: Estas métricas são privadas (Glassnode, CryptoQuant).
 * Em DATA_MODE=live, retorna mock com quality='B' até integração paga.
 * Não há API pública gratuita confiável para estas métricas.
 *
 * Para produção real: substituir por Glassnode API ou CryptoQuant API.
 */
export async function fetchOnChainAdvanced(): Promise<OnChainAdvancedData> {
  // Independente do DATA_MODE, retorna mock (não há API pública para estas métricas)
  // quality='B' indica que é estimado / não é dado live oficial
  return mockOnChainAdvanced();
}
