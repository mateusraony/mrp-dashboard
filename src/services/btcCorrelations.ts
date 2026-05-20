/**
 * btcCorrelations.ts — Correlação Pearson rolling: BTC × Ativos Globais
 *
 * Fontes:
 *   - BTC preços diários: Binance spot /api/v3/klines (1d, 185 candles)
 *   - Séries macro: FRED via fred-proxy (SP500, DTWEXBGS, GOLDAMGBD228NLBM, DGS10, VIXCLS, BAMLH0A0HYM2)
 *
 * Método: Pearson r sobre retornos percentuais diários alinhados por data.
 * HY Bonds: série BAMLH0A0HYM2 (OAS spread) negada para refletir direção de preço.
 *
 * Janelas: 1M (30d), 3M (90d), 6M (180d)
 * Cache recomendado: 3600s — correlações mudam lentamente.
 */

import { fetchKlines } from '@/services/binance';
import { fetchSeries } from '@/services/fred';
import { DATA_MODE } from '@/lib/env';
import { btcCorrelations as mockCorr } from '@/components/data/mockData';

export interface CorrPair {
  key:    string;
  label:  string;
  color:  string;
  icon:   string;
  desc:   string;
  corr:   { '1m': number; '3m': number; '6m': number };
  series: { '1m': number[]; '3m': number[]; '6m': number[] };
}

export interface BtcCorrelationsData {
  pairs:      CorrPair[];
  updated_at: number;
  quality:    'A' | 'B' | 'C';
}

// ─── Cálculo de Pearson ───────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom < 1e-12 ? 0 : Math.min(0.99, Math.max(-0.99, num / denom));
}

function toReturns(prices: number[]): number[] {
  return prices.slice(1).map((p, i) => (prices[i] > 0 ? p / prices[i] - 1 : 0));
}

// Alinha BTC (por date string) com série macro, retorna pares comuns ordenados
function alignedReturns(
  btcByDate: Map<string, number>,
  macroHistory: Array<{ date: string; value: number }>,
  negate: boolean,
): { btcRet: number[]; macroRet: number[] } {
  const btcPrices: number[] = [];
  const macroPrices: number[] = [];

  for (const { date, value } of macroHistory) {
    const btcVal = btcByDate.get(date);
    if (btcVal !== undefined) {
      btcPrices.push(btcVal);
      macroPrices.push(negate ? -value : value);
    }
  }

  return {
    btcRet:   toReturns(btcPrices),
    macroRet: toReturns(macroPrices),
  };
}

// Correlação para janela de N dias (últimos N pontos do array alinhado)
function corrWindow(
  btcByDate: Map<string, number>,
  macroHistory: Array<{ date: string; value: number }>,
  days: number,
  negate: boolean,
): number {
  const recent = macroHistory.slice(-(days + 5));
  const { btcRet, macroRet } = alignedReturns(btcByDate, recent, negate);
  const take = Math.min(days, btcRet.length, macroRet.length);
  return parseFloat(pearson(btcRet.slice(-take), macroRet.slice(-take)).toFixed(2));
}

// Série de correlações rolling para gráfico (comprimento = window)
// Quando dados alinhados são menores que window (ex: 6M com ~130 dias úteis vs 180),
// usa effectiveWindow = n disponível para evitar série flat de zeros.
function rollingSeries(
  btcByDate: Map<string, number>,
  macroHistory: Array<{ date: string; value: number }>,
  window: number,
  negate: boolean,
): number[] {
  const { btcRet, macroRet } = alignedReturns(btcByDate, macroHistory, negate);
  const n = Math.min(btcRet.length, macroRet.length);
  if (n < 5) return Array(window).fill(0);

  // Se dados disponíveis são menores que window, usar todos os dados como janela
  const effectiveWindow = Math.min(window, n);
  const result: number[] = [];
  for (let i = effectiveWindow; i <= n; i++) {
    const r = pearson(btcRet.slice(i - effectiveWindow, i), macroRet.slice(i - effectiveWindow, i));
    result.push(parseFloat(r.toFixed(2)));
  }
  // Pad início com primeiro valor para manter comprimento = window
  while (result.length < window) result.unshift(result[0] ?? 0);
  return result.slice(-window);
}

// ─── Config das séries macro ──────────────────────────────────────────────────

const SERIES_CONFIG = [
  {
    key:       'SPX',
    label:     'S&P 500',
    color:     '#60a5fa',
    icon:      '📈',
    seriesId:  'SP500',
    negate:    false,
    desc:      'Correlação positiva — BTC se move com o apetite de risco do equity americano.',
  },
  {
    key:       'DXY',
    label:     'DXY',
    color:     '#ef4444',
    icon:      '💵',
    seriesId:  'DTWEXBGS',
    negate:    false,
    desc:      'Correlação negativa — dólar forte = pressão sobre BTC e ativos de risco.',
  },
  {
    key:       'GOLD',
    label:     'Gold',
    color:     '#f59e0b',
    icon:      '🥇',
    seriesId:  'GOLDAMGBD228NLBM',
    negate:    false,
    desc:      'Correlação fraca/moderada — ambos são "stores of value" mas divergem em regime de risco.',
  },
  {
    key:       'US10Y',
    label:     'US 10Y',
    color:     '#a78bfa',
    icon:      '📊',
    seriesId:  'DGS10',
    negate:    false,
    desc:      'Yields altos = custo de capital sobe = pressão em ativos especulativos como BTC.',
  },
  {
    key:       'VIX',
    label:     'VIX',
    color:     '#f97316',
    icon:      '🌡️',
    seriesId:  'VIXCLS',
    negate:    false,
    desc:      'VIX alto = pânico no mercado = BTC geralmente vende junto com equities em risk-off.',
  },
  {
    key:       'HY',
    label:     'HY Bonds',
    color:     '#10b981',
    icon:      '🔗',
    seriesId:  'BAMLH0A0HYM2',
    // OAS spread: queda (tightening) = risk-on = BTC sobe → negar retorno do spread
    negate:    true,
    desc:      'Títulos High Yield se movem com apetite a risco — correlação moderada com BTC.',
  },
] as const;

// ─── Mock transformer ─────────────────────────────────────────────────────────

function mockData(): BtcCorrelationsData {
  const iconMap: Record<string, string> = { SPX: '📈', DXY: '💵', GOLD: '🥇', VIX: '🌡️', HY: '🔗', US10Y: '📊' };
  return {
    pairs: mockCorr.pairs.map(p => ({
      key:   p.asset,
      label: p.label,
      color: p.color,
      icon:  iconMap[p.asset] ?? '📊',
      desc:  '',
      corr:  { '1m': p.corr_1m, '3m': p.corr_1m * 0.92, '6m': p.corr_1m * 0.84 },
      series: {
        '1m': p.history_1m.map((v: number) => v),
        // 3M/6M: varia em torno do corr base com amplitude maior (janela mais longa = mais variação)
        '3m': Array.from({ length: 90 }, (_, i) => {
          const base = p.corr_1m * 0.92;
          const s = (Math.sin(i * 0.21 + p.corr_1m * 10) * 0.5 + 1) / 2;
          return parseFloat(Math.min(0.99, Math.max(-0.99, base + (s - 0.5) * 0.28)).toFixed(2));
        }),
        '6m': Array.from({ length: 180 }, (_, i) => {
          const base = p.corr_1m * 0.84;
          const s = (Math.sin(i * 0.11 + p.corr_1m * 10) * 0.5 + 1) / 2;
          return parseFloat(Math.min(0.99, Math.max(-0.99, base + (s - 0.5) * 0.36)).toFixed(2));
        }),
      },
    })),
    updated_at: Date.now(),
    quality:    'B',
  };
}

// ─── Fetcher principal ────────────────────────────────────────────────────────

export async function fetchBtcCorrelations(): Promise<BtcCorrelationsData> {
  if (DATA_MODE === 'mock') return mockData();

  // 365 dias → ~252 dias úteis → 73 pontos rolling para janela 6M (window=180)
  // 185 era insuficiente: 132 dias úteis - window 180 = 0 pontos (série flat)
  const DAYS = 365;

  // BTC preços diários (spot Binance — endpoint público, sem CORS issues)
  const klines = await fetchKlines('BTCUSDT', '1d', DAYS);
  const btcByDate = new Map<string, number>(
    klines.map(k => [new Date(k[0]).toISOString().slice(0, 10), k[4]]),
  );

  // Séries macro via FRED (fred-proxy)
  const settled = await Promise.allSettled(
    SERIES_CONFIG.map(s => fetchSeries(s.seriesId, DAYS)),
  );

  const pairs: CorrPair[] = SERIES_CONFIG.map((cfg, idx) => {
    const result = settled[idx];
    if (result.status === 'rejected' || result.value.length < 10) {
      // Fallback gracioso: retorna corr=0 com série flat
      return {
        key:    cfg.key,
        label:  cfg.label,
        color:  cfg.color,
        icon:   cfg.icon,
        desc:   cfg.desc,
        corr:   { '1m': 0, '3m': 0, '6m': 0 },
        series: { '1m': Array(30).fill(0), '3m': Array(90).fill(0), '6m': Array(180).fill(0) },
      };
    }
    const hist = result.value;
    return {
      key:   cfg.key,
      label: cfg.label,
      color: cfg.color,
      icon:  cfg.icon,
      desc:  cfg.desc,
      corr: {
        '1m': corrWindow(btcByDate, hist, 30,  cfg.negate),
        '3m': corrWindow(btcByDate, hist, 90,  cfg.negate),
        '6m': corrWindow(btcByDate, hist, 180, cfg.negate),
      },
      series: {
        '1m': rollingSeries(btcByDate, hist, 30,  cfg.negate),
        '3m': rollingSeries(btcByDate, hist, 90,  cfg.negate),
        '6m': rollingSeries(btcByDate, hist, 180, cfg.negate),
      },
    };
  });

  return { pairs, updated_at: Date.now(), quality: 'A' };
}
