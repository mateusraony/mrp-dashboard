/**
 * fred.ts — FRED (Federal Reserve Economic Data) API
 *
 * Endpoint: via Edge Function fred-proxy (server-side)
 * Autenticação: FRED_API_KEY (Supabase Secret — sem prefixo VITE_)
 *
 * Séries usadas:
 *   SP500        — S&P 500 Index (diário)
 *   DTWEXBGS     — USD Trade-Weighted Index (DXY proxy)
 *   GOLDAMGBD228NLBM — Gold Price LBMA AM (diário)
 *   VIXCLS       — CBOE VIX (diário)
 *   DGS10        — US 10-Year Treasury Yield (diário)
 *   DGS2         — US 2-Year Treasury Yield (diário)
 *   T10Y2Y       — Yield Curve Spread 10Y-2Y
 *   DFF          — Daily Effective Fed Funds Rate
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 * Sem Supabase configurado → retorna mock com aviso de configuração.
 */

import { z } from 'zod';
import { DATA_MODE, env } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { macroBoard } from '@/components/data/mockData';
import { fetchSP500, fetchVIX } from '@/services/yahooFinance';

// ─── Schemas ────────────────────────────────────────────────────────────────

const ObservationSchema = z.object({
  date:  z.string(),
  value: z.string(),
});

const ObservationsResponseSchema = z.object({
  observations:  z.array(ObservationSchema),
  series_id:     z.string().optional(),
  frequency_short: z.string().optional(),
});

// ─── Shapes exportadas ─────────────────────────────────────────────────────────────

export interface MacroSeriesEntry {
  id:           string;
  name:         string;
  series_id:    string;
  value:        number;
  prev:         number;
  prev_7d:      number;
  prev_30d:     number;
  unit:         string;
  format:       'number' | 'yield' | 'percent';
  delta_1d:     number;
  delta_7d:     number;
  delta_30d:    number;
  delta_1d_bp?: number;
  delta_7d_bp?: number;
  delta_30d_bp?: number;
  history:      Array<{ date: string; value: number }>;
  quality:      'A' | 'B' | 'C';
}

export interface MacroBoardData {
  series:     MacroSeriesEntry[];
  updated_at: number;
}

export interface YieldCurveData {
  spread_10y2y: number;
  fed_funds:    number;
  history_10y:  Array<{ date: string; value: number }>;
  history_2y:   Array<{ date: string; value: number }>;
  updated_at:   number;
}

// ─── Config das séries ───────────────────────────────────────────────────────────────

interface SeriesConfig {
  id:        string;
  name:      string;
  series_id: string;
  unit:      string;
  format:    'number' | 'yield' | 'percent';
}

const MACRO_SERIES: SeriesConfig[] = [
  { id: 'DXY',    name: 'USD Broad Index',    series_id: 'DTWEXBGS',            unit: '',     format: 'number' },
  { id: 'GOLD',   name: 'Gold (LBMA AM)',     series_id: 'GOLDAMGBD228NLBM',    unit: '$/oz', format: 'number' },
  { id: 'US10Y',  name: 'US 10Y Yield',       series_id: 'DGS10',               unit: '%',    format: 'yield'  },
  { id: 'US2Y',   name: 'US 2Y Yield',        series_id: 'DGS2',                unit: '%',    format: 'yield'  },
];

// ─── Mock transformer ───────────────────────────────────────────────────────────────

function mockMacroBoard(): MacroBoardData {
  const series: MacroSeriesEntry[] = macroBoard.series.map(s => ({
    id:           s.id,
    name:         s.name,
    series_id:    s.series_id,
    value:        s.value,
    prev:         s.prev,
    prev_7d:      s.prev_7d,
    prev_30d:     s.prev_30d,
    unit:         s.unit,
    format:       (s.format as 'number' | 'yield' | 'percent'),
    delta_1d:     s.delta_1d,
    delta_7d:     s.delta_7d,
    delta_30d:    s.delta_30d,
    delta_1d_bp:  'delta_1d_bp' in s ? s.delta_1d_bp : undefined,
    delta_7d_bp:  'delta_7d_bp' in s ? s.delta_7d_bp : undefined,
    delta_30d_bp: 'delta_30d_bp' in s ? s.delta_30d_bp : undefined,
    history: Array.from({ length: 30 }, (_, i) => ({
      date:  new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      value: s.value * (1 + (Math.random() - 0.5) * 0.04 * ((30 - i) / 30)),
    })),
    quality: s.quality as 'A' | 'B' | 'C',
  }));

  return {
    series,
    updated_at: macroBoard.updated_at.getTime(),
  };
}

function mockYieldCurve(): YieldCurveData {
  const us10y = macroBoard.series.find(s => s.id === 'US10Y')!;
  const us2y  = macroBoard.series.find(s => s.id === 'US2Y')!;

  return {
    spread_10y2y: us10y.value - us2y.value,
    fed_funds:    3.65,
    history_10y: Array.from({ length: 30 }, (_, i) => ({
      date:  new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      value: us10y.value + (Math.random() - 0.5) * 0.2,
    })),
    history_2y: Array.from({ length: 30 }, (_, i) => ({
      date:  new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      value: us2y.value + (Math.random() - 0.5) * 0.15,
    })),
    updated_at: Date.now(),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function callFredProxy(
  type: 'observations' | 'release_dates',
  params: Record<string, string>,
): Promise<unknown> {
  const baseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key     = env.VITE_SUPABASE_ANON_KEY;

  if (!baseUrl || !key) {
    throw new Error(
      'Supabase não configurado — VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
      'necessários para acessar dados FRED via proxy seguro.',
    );
  }

  const res = await fetch(`${baseUrl}/functions/v1/fred-proxy`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body:   JSON.stringify({ type, params }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    throw new Error(
      `fred-proxy error ${res.status}: ${(err.error as string | undefined) ?? res.statusText}`,
    );
  }

  return res.json();
}

export async function fetchSeries(
  seriesId: string,
  days = 35,
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date(Date.now() - days * 86_400_000)
    .toISOString().slice(0, 10);

  const raw = await callFredProxy('observations', {
    series_id:         seriesId,
    sort_order:        'asc',
    observation_start: startDate,
  });

  const parsed = ObservationsResponseSchema.parse(raw);

  return parsed.observations
    .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

function extractDeltas(history: Array<{ date: string; value: number }>, format: string) {
  const last    = history[history.length - 1]?.value ?? 0;
  const prev    = history[history.length - 2]?.value ?? last;
  const prev7d  = history[Math.max(0, history.length - 6)]?.value ?? last;
  const prev30d = history[0]?.value ?? last;

  const delta_1d   = prev   ? (last - prev)   / prev   : 0;
  const delta_7d   = prev7d ? (last - prev7d) / prev7d : 0;
  const delta_30d  = prev30d ? (last - prev30d) / prev30d : 0;

  const isYield = format === 'yield';
  return {
    value:        last,
    prev,
    prev_7d:      prev7d,
    prev_30d:     prev30d,
    delta_1d,
    delta_7d,
    delta_30d,
    delta_1d_bp:  isYield ? (last - prev)   * 100 : undefined,
    delta_7d_bp:  isYield ? (last - prev7d) * 100 : undefined,
    delta_30d_bp: isYield ? (last - prev30d) * 100 : undefined,
  };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchMacroBoard(): Promise<MacroBoardData> {
  if (DATA_MODE === 'mock') return mockMacroBoard();

  const settled = await Promise.allSettled(
    MACRO_SERIES.map(s => fetchSeries(s.series_id, 35)),
  );

  const series: MacroSeriesEntry[] = [];
  for (let i = 0; i < MACRO_SERIES.length; i++) {
    const result = settled[i];
    const cfg    = MACRO_SERIES[i];
    if (result.status === 'rejected') {
      console.warn(`[fred] ${cfg.series_id} falhou (${result.reason?.message ?? result.reason}) — placeholder quality C`);
      series.push({
        id:           cfg.id,
        name:         cfg.name,
        series_id:    cfg.series_id,
        unit:         cfg.unit,
        format:       cfg.format,
        value:        0,
        prev:         0,
        prev_7d:      0,
        prev_30d:     0,
        delta_1d:     0,
        delta_7d:     0,
        delta_30d:    0,
        delta_1d_bp:  cfg.format === 'yield' ? 0 : undefined,
        delta_7d_bp:  cfg.format === 'yield' ? 0 : undefined,
        delta_30d_bp: cfg.format === 'yield' ? 0 : undefined,
        history:      [],
        quality:      'C',
      });
      continue;
    }
    const history = result.value;
    const deltas  = extractDeltas(history, cfg.format);
    series.push({
      id:       cfg.id,
      name:     cfg.name,
      series_id: cfg.series_id,
      unit:     cfg.unit,
      format:   cfg.format,
      history:  history.slice(-30),
      quality:  'A',
      ...deltas,
    });
  }

  const [sp500Result, vixResult] = await Promise.allSettled([
    fetchSP500(35),
    fetchVIX(35),
  ]);

  if (sp500Result.status === 'fulfilled' && sp500Result.value.length > 0) {
    const history = sp500Result.value;
    const deltas  = extractDeltas(history, 'number');
    series.push({
      id: 'SP500', name: 'S&P 500', series_id: 'SP500',
      unit: 'pts', format: 'number',
      history: history.slice(-30), quality: 'A',
      ...deltas,
    });
  } else {
    console.warn('[fred] SP500 via Yahoo Finance falhou — série omitida');
  }

  if (vixResult.status === 'fulfilled' && vixResult.value.length > 0) {
    const history = vixResult.value;
    const deltas  = extractDeltas(history, 'number');
    series.push({
      id: 'VIX', name: 'VIX', series_id: 'VIXCLS',
      unit: '', format: 'number',
      history: history.slice(-30), quality: 'A',
      ...deltas,
    });
  } else {
    console.warn('[fred] VIX via Yahoo Finance falhou — série omitida');
  }

  return {
    series,
    updated_at: Date.now(),
  };
}

// ─── Global Liquidity ────────────────────────────────────────────────────────────

export interface GlobalLiquidityData {
  fed_balance_b: number;
  fed_balance_chg_4w: number;
  rrp_b: number;
  rrp_trend: 'draining' | 'adding' | 'stable';
  tga_b: number;
  tga_trend: 'spending' | 'building' | 'stable';
  real_yield_10y: number;
  term_premium_10y: number;
  dollar_index: number;
  net_liquidity: number;
  net_liquidity_signal: string;
  history: Array<{
    date: string;
    fed_b: number;
    rrp_b: number;
    tga_b: number;
    net_b: number;
  }>;
  quality: 'A';
  source: 'FRED';
  updated_at: number;
}

function calcTrend<T extends string>(
  current: number,
  prev4w: number,
  labels: { up: T; down: T; flat: T },
  threshold = 0.02,
): T {
  const chg = prev4w > 0 ? (current - prev4w) / prev4w : 0;
  if (chg > threshold) return labels.up;
  if (chg < -threshold) return labels.down;
  return labels.flat;
}

function mockGlobalLiquidity(): GlobalLiquidityData {
  const fed_b = 6_700;
  const rrp_b = 1;
  const tga_b = 860;
  const net    = fed_b - rrp_b - tga_b;

  const now = Date.now();
  const history = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 7 * 86_400_000);
    const _fed = fed_b * (0.97 + (i / 30) * 0.03 + (Math.random() - 0.5) * 0.005);
    const _rrp = rrp_b * (1.4 - (i / 30) * 0.4 + (Math.random() - 0.5) * 0.02);
    const _tga = tga_b * (0.9 + (Math.random() - 0.5) * 0.1);
    return {
      date:  d.toISOString().slice(0, 10),
      fed_b: parseFloat(_fed.toFixed(1)),
      rrp_b: parseFloat(_rrp.toFixed(1)),
      tga_b: parseFloat(_tga.toFixed(1)),
      net_b: parseFloat((_fed - _rrp - _tga).toFixed(1)),
    };
  });

  return {
    fed_balance_b:       fed_b,
    fed_balance_chg_4w:  -120,
    rrp_b,
    rrp_trend:           'draining',
    tga_b,
    tga_trend:           'building',
    real_yield_10y:      1.95,
    term_premium_10y:    0.62,
    dollar_index:        118.5,
    net_liquidity:       net,
    net_liquidity_signal: 'Liquidez líquida estável — RRP drenando gradualmente (bullish marginal)',
    history,
    quality:    'A',
    source:     'FRED',
    updated_at: now,
  };
}

export async function fetchGlobalLiquidity(): Promise<GlobalLiquidityData> {
  if (DATA_MODE === 'mock') return mockGlobalLiquidity();

  const LIQUIDITY_SERIES = ['WALCL', 'RRPONTSYD', 'WTREGEN', 'DFII10', 'THREEFYTP10', 'DTWEXBGS'] as const;
  const liqSettled = await Promise.allSettled(
    LIQUIDITY_SERIES.map(id => fetchSeries(id, 35)),
  );

  const liqGet = (idx: number): Array<{ date: string; value: number }> => {
    const r = liqSettled[idx];
    if (r.status === 'rejected') {
      console.warn(`[fred] ${LIQUIDITY_SERIES[idx]} falhou (${r.reason?.message ?? r.reason}) — usando []`);
      return [];
    }
    return r.value;
  };

  const walcl   = liqGet(0);
  const rrp     = liqGet(1);
  const wtregen = liqGet(2);
  const dfii10  = liqGet(3);
  const term10  = liqGet(4);
  const dtwex   = liqGet(5);

  const fed_b  = (walcl[walcl.length - 1]?.value   ?? 6_700_000) / 1_000;
  const rrp_b  = rrp[rrp.length - 1]?.value         ?? 1;
  const tga_b  = (wtregen[wtregen.length - 1]?.value ?? 860_000) / 1_000;

  const fourWeeksAgo = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const fed4w  = ([...walcl].reverse().find(r => r.date <= fourWeeksAgo)?.value   ?? fed_b * 1_000) / 1_000;
  const rrp4w  = ([...rrp].reverse().find(r => r.date <= fourWeeksAgo)?.value     ?? rrp_b);
  const tga4w  = ([...wtregen].reverse().find(r => r.date <= fourWeeksAgo)?.value ?? tga_b * 1_000) / 1_000;

  const fed_balance_chg_4w = fed_b - fed4w;

  const rrp_trend = calcTrend(rrp_b, rrp4w, { up: 'adding', down: 'draining', flat: 'stable' });
  const tga_trend = calcTrend(tga_b, tga4w, { up: 'building', down: 'spending', flat: 'stable' });

  const real_yield_10y   = dfii10[dfii10.length - 1]?.value   ?? 0;
  const term_premium_10y = term10[term10.length - 1]?.value   ?? 0;
  const dollar_index     = dtwex[dtwex.length - 1]?.value     ?? 0;

  const net_liquidity = fed_b - rrp_b - tga_b;

  const chg4wPct = fed_b > 0 ? (fed_balance_chg_4w / fed_b) * 100 : 0;
  let net_liquidity_signal: string;
  if (net_liquidity > 6_500 && rrp_trend === 'draining') {
    net_liquidity_signal = 'Alta liquidez líquida + RRP drenando → condições favoráveis ao risco';
  } else if (net_liquidity < 5_500 || rrp_trend === 'adding') {
    net_liquidity_signal = 'Liquidez líquida comprimida → headwind para ativos de risco';
  } else if (chg4wPct > 0.5) {
    net_liquidity_signal = 'Expansão do Fed BS (4 semanas) → injeção líquida de liquidez';
  } else {
    net_liquidity_signal = 'Liquidez líquida estável — sem sinal direcional forte';
  }

  const histLen = Math.min(walcl.length, 30);
  const history = walcl.slice(-histLen).map(w => {
    const w_fed   = w.value / 1_000;
    const w_rrp   = rrp.find(r => r.date >= w.date)?.value ?? rrp_b;
    const w_tga   = (wtregen.find(t => t.date >= w.date)?.value ?? tga_b * 1_000) / 1_000;
    return {
      date:  w.date,
      fed_b: parseFloat(w_fed.toFixed(1)),
      rrp_b: parseFloat(w_rrp.toFixed(1)),
      tga_b: parseFloat(w_tga.toFixed(1)),
      net_b: parseFloat((w_fed - w_rrp - w_tga).toFixed(1)),
    };
  });

  return {
    fed_balance_b:       parseFloat(fed_b.toFixed(1)),
    fed_balance_chg_4w:  parseFloat(fed_balance_chg_4w.toFixed(1)),
    rrp_b:               parseFloat(rrp_b.toFixed(1)),
    rrp_trend,
    tga_b:               parseFloat(tga_b.toFixed(1)),
    tga_trend,
    real_yield_10y:      parseFloat(real_yield_10y.toFixed(2)),
    term_premium_10y:    parseFloat(term_premium_10y.toFixed(2)),
    dollar_index:        parseFloat(dollar_index.toFixed(2)),
    net_liquidity:       parseFloat(net_liquidity.toFixed(1)),
    net_liquidity_signal,
    history,
    quality:    'A',
    source:     'FRED',
    updated_at: Date.now(),
  };
}

export async function fetchYieldCurve(): Promise<YieldCurveData> {
  if (DATA_MODE === 'mock') return mockYieldCurve();

  const [hist10y, hist2y, histFF] = await Promise.all([
    fetchSeries('DGS10', 35),
    fetchSeries('DGS2',  35),
    fetchSeries('DFF',   35),
  ]);

  const last10y  = hist10y[hist10y.length - 1]?.value ?? 0;
  const last2y   = hist2y[hist2y.length - 1]?.value ?? 0;
  const lastFF   = histFF[histFF.length - 1]?.value ?? 0;

  return {
    spread_10y2y: last10y - last2y,
    fed_funds:    lastFF,
    history_10y:  hist10y.slice(-30),
    history_2y:   hist2y.slice(-30),
    updated_at:   Date.now(),
  };
}
