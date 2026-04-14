/**
 * coinmetrics.ts — CoinMetrics Community API (on-chain gratuito)
 *
 * Base: https://community-api.coinmetrics.io/v4
 * Sem API key · Rate limit: ~2 req/s · Frequência: diária
 * Qualidade: A — dados institucionais usados como referência pelo setor
 *
 * Métricas utilizadas (todas disponíveis no free tier):
 *   CapMVRVCur        — MVRV ratio (market cap / realized cap)
 *   CapRealUSD        — Realized Capitalization em USD
 *   PriceUSD          — Preço de fechamento diário
 *   NVTAdj            — NVT ratio ajustado (network value to transactions)
 *   SplyCur           — Supply em circulação
 *   CoinDaysDestroyed — Coin Days Destroyed (CDD)
 *   SplyAdr1yrPlus    — BTC em carteiras sem movimento há 1+ ano (HODL Wave proxy)
 *   SplyAct1yr        — BTC ativo nos últimos 12 meses
 *   AdrActCnt         — Endereços ativos diários (proxy de atividade)
 *   VelCur1yr         — Velocity (turnover) 1 ano
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

// Schema para métricas estendidas de ciclo (CDD, HODL Waves, Dormancy)
const CmExtDataPointSchema = z.object({
  asset:              z.string(),
  time:               z.string(),
  CoinDaysDestroyed:  z.coerce.number().optional(),
  SplyAdr1yrPlus:     z.coerce.number().optional(),
  SplyAct1yr:         z.coerce.number().optional(),
  AdrActCnt:          z.coerce.number().optional(),
  VelCur1yr:          z.coerce.number().optional(),
});

const CmExtResponseSchema = z.object({
  data: z.array(CmExtDataPointSchema),
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

export interface OnChainExtendedData {
  /** CDD do último dia disponível */
  cdd_current:       number;
  /** Média móvel 30 dias de CDD */
  cdd_ma30:          number;
  /** Z-Score de CDD na janela de 90 dias: (cdd - mean) / std */
  cdd_z_score:       number;
  /** Interpretação textual do CDD */
  cdd_signal:        string;
  /** Porcentagem do supply circulante em carteiras sem movimento há 1+ ano */
  hodl_wave_1yr_pct: number;
  /** Tendência derivada da variação recente do HODL Wave */
  hodl_wave_trend:   'accumulating' | 'distributing' | 'neutral';
  /** BTC ativo nos últimos 12 meses (SplyAct1yr) */
  active_supply_1yr: number;
  /** Proxy de dormancy: CDD / AdrActCnt — quanto mais alto, mais moedas antigas movendo */
  dormancy_value:    number;
  /** Interpretação textual do dormancy */
  dormancy_signal:   string;
  /** Histórico CDD diário com MA30 */
  history_cdd: Array<{ date: string; value: number; ma30: number }>;
  /** Histórico HODL Wave 1yr % */
  history_hodl: Array<{ date: string; pct: number }>;
  quality: 'A' | 'B';
  source:  string;
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

// ─── Helpers CDD / HODL / Dormancy ───────────────────────────────────────────

/** Calcula z-score na janela inteira (não usa windowDays aqui) */
function computeZScore(series: number[]): number {
  if (series.length < 5) return 0;
  const mean = series.reduce((s, v) => s + v, 0) / series.length;
  const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length;
  const std = Math.sqrt(variance);
  return std > 1e-10 ? (series[series.length - 1] - mean) / std : 0;
}

/** Calcula MA simples de N dias */
function movingAverage(series: number[], window: number): number[] {
  return series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

/** Interpreta z-score do CDD */
function cddSignal(zScore: number): string {
  if (zScore > 2.0)  return 'CDD muito elevado — moedas antigas sendo movimentadas em escala (possível distribuição de ciclo).';
  if (zScore > 1.0)  return 'CDD acima da média — aumento de atividade de holders de longo prazo. Monitorar.';
  if (zScore > 0)    return 'CDD levemente acima da média — movimento moderado de moedas dormentes.';
  if (zScore > -1.0) return 'CDD próximo à média — sem sinal direcional relevante.';
  return 'CDD baixo — moedas antigas em repouso (HODL forte). Sinal de acumulação silenciosa.';
}

/** Interpreta valor de dormancy proxy (CDD / endereços ativos) */
function dormancySignal(dormancy: number, cddZ: number): string {
  if (dormancy > 10_000 && cddZ > 1.5)
    return 'Dormancy elevada com CDD alto — holders velhos distribuindo. Atenção para topo de ciclo.';
  if (dormancy > 5_000)
    return 'Dormancy moderada — alguma movimentação de moedas antigas. Contexto neutro a negativo.';
  if (dormancy < 1_000)
    return 'Dormancy baixa — moedas antigas em repouso. Alinhado com fase de acumulação.';
  return 'Dormancy dentro do padrão histórico — sem sinal de alerta.';
}

/** Interpreta tendência do HODL Wave 1yr */
function hodlTrend(
  history: Array<{ pct: number }>,
): 'accumulating' | 'distributing' | 'neutral' {
  if (history.length < 14) return 'neutral';
  const recent  = history.slice(-7).reduce((s, d) => s + d.pct, 0) / 7;
  const earlier = history.slice(-14, -7).reduce((s, d) => s + d.pct, 0) / 7;
  const delta   = recent - earlier;
  if (delta >  0.003) return 'accumulating';  // HODL Wave aumentando → acumulação
  if (delta < -0.003) return 'distributing';  // HODL Wave caindo    → distribuição
  return 'neutral';
}

// ─── Mock Extended ────────────────────────────────────────────────────────────

function mockOnChainExtended(): OnChainExtendedData {
  // Valores razoáveis para ciclo atual (acumulação moderada)
  const CDD_BASE    = 8_000_000;
  const HODL_BASE   = 0.705; // 70.5% do supply em HODL >1 ano
  const ADR_ACT     = 850_000;
  const SUPPLY_CIRC = 19_700_000;

  // Gera 90 dias de histórico simulado
  const historyCdd: Array<{ date: string; value: number; ma30: number }> = [];
  const cddSeries: number[] = [];

  for (let i = 89; i >= 0; i--) {
    const t   = Date.now() - i * 86_400_000;
    const val = CDD_BASE * (1 + (Math.random() - 0.5) * 0.6);
    cddSeries.push(val);
    historyCdd.push({
      date:  new Date(t).toISOString().slice(0, 10),
      value: Math.round(val),
      ma30:  0, // preenchido abaixo
    });
  }

  // Calcula MA30
  const ma30 = movingAverage(cddSeries, 30);
  historyCdd.forEach((d, i) => { d.ma30 = Math.round(ma30[i]); });

  const historyHodl: Array<{ date: string; pct: number }> = Array.from(
    { length: 90 },
    (_, i) => {
      const t   = Date.now() - (89 - i) * 86_400_000;
      const pct = HODL_BASE + (Math.random() - 0.5) * 0.01;
      return { date: new Date(t).toISOString().slice(0, 10), pct };
    },
  );

  const cddCurrent = cddSeries[cddSeries.length - 1];
  const cddZ       = computeZScore(cddSeries);
  const dormancy   = cddCurrent / ADR_ACT;

  return {
    cdd_current:       Math.round(cddCurrent),
    cdd_ma30:          Math.round(ma30[ma30.length - 1]),
    cdd_z_score:       parseFloat(cddZ.toFixed(3)),
    cdd_signal:        cddSignal(cddZ),
    hodl_wave_1yr_pct: parseFloat(HODL_BASE.toFixed(4)),
    hodl_wave_trend:   hodlTrend(historyHodl),
    active_supply_1yr: parseFloat((SUPPLY_CIRC * 0.29).toFixed(0)),
    dormancy_value:    parseFloat(dormancy.toFixed(2)),
    dormancy_signal:   dormancySignal(dormancy, cddZ),
    history_cdd:       historyCdd,
    history_hodl:      historyHodl,
    quality:           'B',
    source:            'mock',
  };
}

// ─── Fetcher — Extended ───────────────────────────────────────────────────────

/**
 * fetchOnChainExtended — CDD, HODL Waves proxy, Dormancy via CoinMetrics Community
 *
 * Busca 90 dias de: CoinDaysDestroyed, SplyAdr1yrPlus, SplyAct1yr, AdrActCnt, VelCur1yr.
 * Sem API key. Atualização diária. Qualidade A quando live, B quando mock.
 *
 * Regra: mock NÃO substitui live com falha — lança erro se API retornar != 2xx.
 */
export async function fetchOnChainExtended(): Promise<OnChainExtendedData> {
  if (DATA_MODE === 'mock') return mockOnChainExtended();

  const metrics = 'CoinDaysDestroyed,SplyAdr1yrPlus,SplyAct1yr,AdrActCnt,VelCur1yr';
  const params  = new URLSearchParams({
    assets:    ASSET,
    metrics,
    frequency: '1d',
    limit:     '90',
    sort:      'time',
  });

  const res = await fetch(`${BASE}/timeseries/asset-metrics?${params}`);
  if (!res.ok) throw new Error(`CoinMetrics Extended API error ${res.status}: ${res.statusText}`);

  const raw    = await res.json();
  const parsed = CmExtResponseSchema.parse(raw);

  if (parsed.data.length === 0) throw new Error('CoinMetrics Extended: sem dados retornados');

  // ── Extrai séries ──────────────────────────────────────────────────────────
  const validPts = parsed.data.filter(
    d => d.CoinDaysDestroyed !== undefined || d.SplyAdr1yrPlus !== undefined,
  );
  if (validPts.length === 0) throw new Error('CoinMetrics Extended: nenhum ponto válido após parse');

  const cddSeries: number[]  = [];
  const hodlSeries: number[] = [];
  const adrSeries:  number[] = [];

  const historyCdd: Array<{ date: string; value: number; ma30: number }> = [];
  const historyHodl: Array<{ date: string; pct: number }>                = [];

  // Total supply circulante para calcular HODL %
  // Usamos SplyAct1yr vs SplyAdr1yrPlus para derivar o supply circulante proxy
  let lastSplyCur = 19_700_000; // fallback

  for (const d of validPts) {
    const date = d.time.slice(0, 10);
    const cdd  = d.CoinDaysDestroyed ?? 0;
    const hodl = d.SplyAdr1yrPlus   ?? 0;
    const adr  = d.AdrActCnt        ?? 1;
    // Proxy de supply: sply_1yr_active + sply_1yr_plus ≈ total circulante
    const splyAct = d.SplyAct1yr ?? 0;
    if (hodl + splyAct > 0) lastSplyCur = hodl + splyAct;

    cddSeries.push(cdd);
    hodlSeries.push(hodl);
    adrSeries.push(adr);

    historyCdd.push({ date, value: Math.round(cdd), ma30: 0 });
    historyHodl.push({ date, pct: lastSplyCur > 0 ? hodl / lastSplyCur : 0 });
  }

  // Preenche MA30
  const ma30 = movingAverage(cddSeries, 30);
  historyCdd.forEach((d, i) => { d.ma30 = Math.round(ma30[i]); });

  // ── Métricas finais ────────────────────────────────────────────────────────
  const last        = validPts[validPts.length - 1];
  const cddCurrent  = cddSeries[cddSeries.length - 1];
  const cddZ        = computeZScore(cddSeries);
  const hodlPct     = historyHodl[historyHodl.length - 1]?.pct ?? 0;
  const dormancy    = adrSeries[adrSeries.length - 1] > 0
    ? cddCurrent / adrSeries[adrSeries.length - 1]
    : 0;

  return {
    cdd_current:       Math.round(cddCurrent),
    cdd_ma30:          Math.round(ma30[ma30.length - 1]),
    cdd_z_score:       parseFloat(cddZ.toFixed(3)),
    cdd_signal:        cddSignal(cddZ),
    hodl_wave_1yr_pct: parseFloat(hodlPct.toFixed(4)),
    hodl_wave_trend:   hodlTrend(historyHodl),
    active_supply_1yr: parseFloat((last.SplyAct1yr ?? 0).toFixed(0)),
    dormancy_value:    parseFloat(dormancy.toFixed(2)),
    dormancy_signal:   dormancySignal(dormancy, cddZ),
    history_cdd:       historyCdd,
    history_hodl:      historyHodl,
    quality:           'A',
    source:            'CoinMetrics Community',
  };
}

// ─── Fetcher — Cycle ──────────────────────────────────────────────────────────

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
