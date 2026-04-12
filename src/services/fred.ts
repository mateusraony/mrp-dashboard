/**
 * fred.ts — FRED (Federal Reserve Economic Data) API
 *
 * Endpoint: https://api.stlouisfed.org/fred/series/observations
 * Autenticação: VITE_FRED_API_KEY (gratuito, requer cadastro em fred.stlouisfed.org)
 *
 * Séries usadas:
 *   SP500        — S&P 500 Index (diário)
 *   DTWEXBGS     — USD Trade-Weighted Index (DXY proxy)
 *   GOLDAMGBD228NLBM — Gold Price LBMA AM (diário)
 *   VIXCLS       — CBOE VIX (diário)
 *   DGS10        — US 10-Year Treasury Yield (diário)
 *   DGS2         — US 2-Year Treasury Yield (diário)
 *   T10Y2Y       — Yield Curve Spread 10Y-2Y
 *   FEDFUNDS     — Fed Funds Rate
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 * Sem VITE_FRED_API_KEY → retorna mock com aviso de configuração.
 */

import { z } from 'zod';
import { DATA_MODE, env } from '@/lib/env';
import { macroBoard } from '@/components/data/mockData';

const BASE = 'https://api.stlouisfed.org/fred';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ObservationSchema = z.object({
  date:  z.string(),
  value: z.string(), // FRED retorna valores como string (pode ser '.' para N/A)
});

const ObservationsResponseSchema = z.object({
  observations:  z.array(ObservationSchema),
  series_id:     z.string().optional(),
  frequency_short: z.string().optional(),
});

// ─── Shapes exportadas ────────────────────────────────────────────────────────

export interface MacroSeriesEntry {
  id:           string;
  name:         string;
  series_id:    string;
  value:        number;
  prev:         number;        // dia anterior
  prev_7d:      number;
  prev_30d:     number;
  unit:         string;
  format:       'number' | 'yield' | 'percent';
  delta_1d:     number;        // variação relativa
  delta_7d:     number;
  delta_30d:    number;
  delta_1d_bp?: number;        // variação em basis points (só para yields)
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
  spread_10y2y: number;   // diferença em % (negativo = invertida)
  fed_funds:    number;
  history_10y:  Array<{ date: string; value: number }>;
  history_2y:   Array<{ date: string; value: number }>;
  updated_at:   number;
}

// ─── Config das séries ────────────────────────────────────────────────────────

interface SeriesConfig {
  id:        string;
  name:      string;
  series_id: string;
  unit:      string;
  format:    'number' | 'yield' | 'percent';
}

const MACRO_SERIES: SeriesConfig[] = [
  { id: 'SP500',  name: 'S&P 500',           series_id: 'SP500',               unit: 'pts',  format: 'number' },
  { id: 'DXY',    name: 'USD Broad Index',    series_id: 'DTWEXBGS',            unit: '',     format: 'number' },
  { id: 'GOLD',   name: 'Gold (LBMA AM)',     series_id: 'GOLDAMGBD228NLBM',    unit: '$/oz', format: 'number' },
  { id: 'VIX',    name: 'VIX',                series_id: 'VIXCLS',              unit: '',     format: 'number' },
  { id: 'US10Y',  name: 'US 10Y Yield',       series_id: 'DGS10',               unit: '%',    format: 'yield'  },
  { id: 'US2Y',   name: 'US 2Y Yield',        series_id: 'DGS2',                unit: '%',    format: 'yield'  },
];

// ─── Mock transformer ─────────────────────────────────────────────────────────

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
    // Histórico simulado (30d)
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
    fed_funds:    5.25,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Garante que VITE_FRED_API_KEY está configurada.
 * Se não estiver, lança erro descritivo.
 */
function requireApiKey(): string {
  const key = env.VITE_FRED_API_KEY;
  if (!key) {
    throw new Error(
      'FRED API key não configurada. Defina VITE_FRED_API_KEY em .env.local. ' +
      'Obtenha sua key gratuita em https://fred.stlouisfed.org/docs/api/api_key.html',
    );
  }
  return key;
}

/**
 * Busca observações de uma série FRED com histórico de N dias.
 */
async function fetchSeries(
  seriesId: string,
  apiKey: string,
  days = 35,
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date(Date.now() - days * 86_400_000)
    .toISOString().slice(0, 10);

  const params = new URLSearchParams({
    series_id:  seriesId,
    api_key:    apiKey,
    file_type:  'json',
    sort_order: 'asc',
    observation_start: startDate,
  });

  const res = await fetch(`${BASE}/series/observations?${params}`);
  if (!res.ok) throw new Error(`FRED API error ${res.status}: series_id=${seriesId}`);

  const raw = await res.json();
  const parsed = ObservationsResponseSchema.parse(raw);

  // Filtra observações com valor numérico válido (FRED usa '.' para N/A)
  return parsed.observations
    .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

/**
 * Extrai as variações temporais de um array de observações ordenado por data.
 */
function extractDeltas(history: Array<{ date: string; value: number }>, format: string) {
  const last    = history[history.length - 1]?.value ?? 0;
  const prev    = history[history.length - 2]?.value ?? last;  // ~1d antes (útil)
  const prev7d  = history[Math.max(0, history.length - 6)]?.value ?? last; // ~5 úteis
  const prev30d = history[0]?.value ?? last; // início do período

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

/**
 * fetchMacroBoard — S&P 500, DXY, Gold, VIX, US10Y, US2Y com histórico 30d
 *
 * Requer VITE_FRED_API_KEY. Cache recomendado: 1 hora.
 * FRED atualiza dados macro diariamente (sem intraday).
 */
export async function fetchMacroBoard(): Promise<MacroBoardData> {
  if (DATA_MODE === 'mock') return mockMacroBoard();

  const apiKey = requireApiKey();

  // Busca todas as séries em paralelo
  const results = await Promise.all(
    MACRO_SERIES.map(s => fetchSeries(s.series_id, apiKey, 35)),
  );

  const series: MacroSeriesEntry[] = MACRO_SERIES.map((cfg, i) => {
    const history = results[i];
    const deltas  = extractDeltas(history, cfg.format);

    return {
      id:           cfg.id,
      name:         cfg.name,
      series_id:    cfg.series_id,
      unit:         cfg.unit,
      format:       cfg.format,
      history:      history.slice(-30), // últimos 30d úteis
      quality:      'A',
      ...deltas,
    };
  });

  return {
    series,
    updated_at: Date.now(),
  };
}

/**
 * fetchYieldCurve — Curva de juros US: 10Y, 2Y, spread, Fed Funds
 *
 * Cache recomendado: 1 hora.
 */
export async function fetchYieldCurve(): Promise<YieldCurveData> {
  if (DATA_MODE === 'mock') return mockYieldCurve();

  const apiKey = requireApiKey();

  const [hist10y, hist2y, histFF] = await Promise.all([
    fetchSeries('DGS10',    apiKey, 35),
    fetchSeries('DGS2',     apiKey, 35),
    fetchSeries('FEDFUNDS', apiKey, 35),
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
