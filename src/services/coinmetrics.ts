/**
 * coinmetrics.ts — CoinMetrics Community API (on-chain gratuito)
 *
 * Base: https://community-api.coinmetrics.io/v4
 * Sem API key · Rate limit: ~2 req/s · Frequência: diária
 * Qualidade: A — dados institucionais usados como referência pelo setor
 *
 * Métricas utilizadas (todas disponíveis no free tier):
 *   CapMVRVCur   — MVRV ratio (market cap / realized cap)
 *   CapRealUSD   — Realized Capitalization em USD
 *   PriceUSD     — Preço de fechamento diário
 *   NVTAdj       — NVT ratio ajustado (network value to transactions)
 *   SplyCur      — Supply em circulação
 *
 * MVRV Z-Score calculado em: scripts/validate_mvrv_zscore.py (Fase 5)
 * Fórmula validada: z = (mvrv_atual - mean_Nd) / std_Nd
 * NUPL = (MarketCap - RealizedCap) / MarketCap (derivado das métricas acima)
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import { btcRealizedMetrics, btcNUPL } from '@/components/data/mockData';

const BASE = 'https://community-api.coinmetrics.io/v4';
const ASSET = 'btc';

// ─── Schemas ──────────────────────────────────────────────────────────────────

// CoinMetrics retorna todos os campos numéricos como strings
const CmDataPointSchema = z.object({
  asset:       z.string(),
  time:        z.string(),
  CapMVRVCur:  z.string().optional(),
  CapRealUSD:  z.string().optional(),
  PriceUSD:    z.string().optional(),
  NVTAdj:      z.string().optional(),
  SplyCur:     z.string().optional(),
});

const CmResponseSchema = z.object({
  data: z.array(CmDataPointSchema),
});

// ─── Interfaces exportadas ────────────────────────────────────────────────────

export interface MvrvDataPoint {
  date:          string;
  mvrv:          number;
  realized_cap:  number;
  price:         number;
  nupl:          number;
  realized_price: number;
  nvt:           number;
}

export interface OnChainCycleData {
  mvrv_current:    number;
  mvrv_zscore:     number;
  mvrv_zone:       string;
  mvrv_zone_color: string;
  realized_price:  number;
  realized_cap:    number;
  nupl:            number;
  nupl_zone:       string;
  nupl_zone_color: string;
  nvt_current:     number;
  current_price:   number;
  history:         MvrvDataPoint[];
  quality:         'A' | 'B' | 'C';
  source:          string;
  updated_at:      number;
}

// ─── Helpers de cálculo ────────────────────────────────────────────────────────

function computeMvrvZScore(history: number[], windowDays = 365): number {
  if (history.length < 5) return 0;
  const w = history.slice(-Math.min(windowDays, history.length));
  const mean = w.reduce((s, v) => s + v, 0) / w.length;
  const variance = w.reduce((s, v) => s + (v - mean) ** 2, 0) / w.length;
  const std = Math.sqrt(variance);
  return std > 1e-10 ? (history[history.length - 1] - mean) / std : 0;
}

function mvrvZone(mvrv: number): { zone: string; color: string } {
  if (mvrv < 1.0) return { zone: 'Fundo / Subvalorizado', color: '#3b82f6' };
  if (mvrv < 2.5) return { zone: 'Zona Neutra / Acumulação', color: '#10b981' };
  if (mvrv < 3.7) return { zone: 'Mercado Caro', color: '#f59e0b' };
  return { zone: 'Euforia / Topo de Ciclo', color: '#ef4444' };
}

function nuplZone(nupl: number): { zone: string; color: string } {
  if (nupl < 0)    return { zone: 'Capitulação', color: '#ef4444' };
  if (nupl < 0.25) return { zone: 'Esperança', color: '#f59e0b' };
  if (nupl < 0.5)  return { zone: 'Crença / Otimismo', color: '#10b981' };
  if (nupl < 0.75) return { zone: 'Ganância', color: '#f59e0b' };
  return { zone: 'Euforia', color: '#ef4444' };
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

function mockOnChainCycle(): OnChainCycleData {
  const m = btcRealizedMetrics;
  const n = btcNUPL;
  const mvrvZ = mvrvZone(m.mvrv_ratio);
  const nuplZ = nuplZone(n.value);

  // Histórico simulado de 90 dias baseado nos valores mock
  const history: MvrvDataPoint[] = Array.from({ length: 90 }, (_, i) => {
    const t = Date.now() - (89 - i) * 86_400_000;
    const mvrv = m.mvrv_ratio * (1 + (Math.random() - 0.5) * 0.15 * ((90 - i) / 90));
    const rp = m.realized_price * (1 + (Math.random() - 0.5) * 0.04 * ((90 - i) / 90));
    const price = m.current_price * (1 + (Math.random() - 0.5) * 0.25 * ((90 - i) / 90));
    const supply = 19_700_000;
    const rc = rp * supply;
    const mc = price * supply;
    return {
      date: new Date(t).toISOString().slice(0, 10),
      mvrv: parseFloat(mvrv.toFixed(4)),
      realized_cap: rc,
      price,
      nupl: parseFloat(((mc - rc) / mc).toFixed(4)),
      realized_price: rp,
      nvt: parseFloat((42 + (Math.random() - 0.5) * 10).toFixed(2)),
    };
  });

  return {
    mvrv_current:    m.mvrv_ratio,
    mvrv_zscore:     m.mvrv_zscore,
    mvrv_zone:       mvrvZ.zone,
    mvrv_zone_color: mvrvZ.color,
    realized_price:  m.realized_price,
    realized_cap:    m.realized_price * 19_700_000,
    nupl:            n.value,
    nupl_zone:       nuplZ.zone,
    nupl_zone_color: nuplZ.color,
    nvt_current:     42,
    current_price:   m.current_price,
    history,
    quality:         'B',  // mock
    source:          'mock',
    updated_at:      Date.now(),
  };
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * fetchOnChainCycle — MVRV Z-Score, NUPL, Realized Price via CoinMetrics Community
 *
 * Busca 365 dias de dados para cálculo correto do Z-Score.
 * Sem API key necessária. Atualização diária.
 */
export async function fetchOnChainCycle(): Promise<OnChainCycleData> {
  if (DATA_MODE === 'mock') return mockOnChainCycle();

  const metrics = 'CapMVRVCur,CapRealUSD,PriceUSD,NVTAdj,SplyCur';
  const params = new URLSearchParams({
    assets:    ASSET,
    metrics,
    frequency: '1d',
    limit:     '365',
    sort:      'time',
  });

  const res = await fetch(`${BASE}/timeseries/asset-metrics?${params}`);
  if (!res.ok) throw new Error(`CoinMetrics API error ${res.status}: ${res.statusText}`);

  const raw = await res.json();
  const parsed = CmResponseSchema.parse(raw);

  if (parsed.data.length === 0) throw new Error('CoinMetrics: sem dados retornados');

  // Transforma os dados (strings → números)
  const points: MvrvDataPoint[] = parsed.data
    .filter(d => d.CapMVRVCur && d.CapRealUSD && d.PriceUSD)
    .map(d => {
      const mvrv  = parseFloat(d.CapMVRVCur!);
      const rc    = parseFloat(d.CapRealUSD!);
      const price = parseFloat(d.PriceUSD!);
      const sply  = d.SplyCur ? parseFloat(d.SplyCur) : 19_700_000;
      const mc    = price * sply;
      const rp    = sply > 0 ? rc / sply : 0;
      const nupl  = mc > 0 ? (mc - rc) / mc : 0;
      return {
        date:           d.time.slice(0, 10),
        mvrv,
        realized_cap:   rc,
        price,
        nupl:           parseFloat(nupl.toFixed(6)),
        realized_price: parseFloat(rp.toFixed(2)),
        nvt:            d.NVTAdj ? parseFloat(d.NVTAdj) : 0,
      };
    });

  if (points.length === 0) throw new Error('CoinMetrics: nenhum ponto válido após parse');

  const last = points[points.length - 1];
  const mvrvHistory = points.map(p => p.mvrv);
  const zScore = computeMvrvZScore(mvrvHistory);
  const mvrvZ = mvrvZone(last.mvrv);
  const nuplZ = nuplZone(last.nupl);

  return {
    mvrv_current:    last.mvrv,
    mvrv_zscore:     parseFloat(zScore.toFixed(3)),
    mvrv_zone:       mvrvZ.zone,
    mvrv_zone_color: mvrvZ.color,
    realized_price:  last.realized_price,
    realized_cap:    last.realized_cap,
    nupl:            last.nupl,
    nupl_zone:       nuplZ.zone,
    nupl_zone_color: nuplZ.color,
    nvt_current:     last.nvt,
    current_price:   last.price,
    history:         points.slice(-90), // últimos 90 dias para gráficos
    quality:         'A',
    source:          'CoinMetrics Community',
    updated_at:      Date.now(),
  };
}
