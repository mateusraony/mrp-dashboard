/**
 * globalMarkets.ts — Mercados Globais: FX, commodities, bancos centrais, correlações BTC
 *
 * Fontes:
 *   FRED API — FX rates, Gold, Silver, Oil, taxas bancos centrais (requer VITE_FRED_API_KEY)
 *   BCB OpenData — USDBRL, SELIC (sem auth)
 *
 * Funções puras (sem rede):
 *   pearsonCorrelation — coeficiente de correlação de Pearson
 *   computeBtcCorrelations — BTC vs ativos macro por janela temporal
 *
 * Regra de mock: mock NÃO substitui live com falha.
 */

import { DATA_MODE, env } from '@/lib/env';
import { fetchSeries } from '@/services/fred';
import { fetchBcbData } from '@/services/bcb';

// ─── Helper interno ───────────────────────────────────────────────────────────

function requireFredKey(): string {
  const key = env.VITE_FRED_API_KEY;
  if (!key) throw new Error('VITE_FRED_API_KEY não configurada');
  return key;
}

function calcDeltas(history: Array<{ date: string; value: number }>) {
  const n     = history.length;
  const last   = history[n - 1]?.value ?? 0;
  const prev1d = history[n - 2]?.value ?? last;
  const prev7d = history[Math.max(0, n - 6)]?.value ?? last;
  const prev30 = history[0]?.value ?? last;
  const d = (a: number, b: number) => b !== 0 ? (a - b) / Math.abs(b) : 0;
  return { last, delta_1d: d(last, prev1d), delta_7d: d(last, prev7d), delta_30d: d(last, prev30) };
}

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface FxRateData {
  pair:      string;
  value:     number;
  delta_1d:  number;
  delta_7d:  number;
  delta_30d: number;
  source:    'FRED' | 'BCB';
  series_id: string;
}

export interface CommodityData {
  name:      string;
  symbol:    string;
  unit:      string;
  value:     number;
  delta_1d:  number;
  delta_7d:  number;
  delta_30d: number;
  source:    'FRED';
  series_id: string;
}

export interface CentralBankRateData {
  bank:      string;
  country:   string;
  rate:      number | null;
  direction: 'hiking' | 'cutting' | 'hold';
  source:    'FRED' | 'BCB';
  series_id: string;
}

export interface BtcCorrelation {
  asset:    string;
  label:    string;
  corr_7d:  number | null;
  corr_30d: number | null;
  corr_90d: number | null;
}

export interface GlobalMarketsData {
  fxRates:          FxRateData[];
  commodities:      CommodityData[];
  centralBankRates: CentralBankRateData[];
  btcCorrelations:  BtcCorrelation[];
  updated_at:       number;
  quality:          'A' | 'B';
}

// ─── Funções puras de cálculo ─────────────────────────────────────────────────

/**
 * Coeficiente de correlação de Pearson entre dois arrays de igual tamanho.
 * Retorna null se n < 5 ou desvio padrão for zero.
 */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;

  const xs = x.slice(-n);
  const ys = y.slice(-n);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num    += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? null : parseFloat((num / denom).toFixed(3));
}

/**
 * Alinha duas séries por data, retornando apenas pontos comuns.
 */
function alignByDate(
  a: Array<{ date: string; value: number }>,
  b: Array<{ date: string; value: number }>,
): [number[], number[]] {
  const mapB = new Map(b.map(p => [p.date, p.value]));
  const xs: number[] = [], ys: number[] = [];
  for (const p of a) {
    const bVal = mapB.get(p.date);
    if (bVal !== undefined) { xs.push(p.value); ys.push(bVal); }
  }
  return [xs, ys];
}

/**
 * computeBtcCorrelations — correlações BTC vs S&P 500, DXY, Gold, VIX por janela.
 *
 * @param btcPrices  preços diários BTC como { date: 'YYYY-MM-DD', value: number }
 * @param fredSeries mapa assetId → série histórica FRED com o mesmo formato
 */
export function computeBtcCorrelations(
  btcPrices: Array<{ date: string; value: number }>,
  fredSeries: Record<string, Array<{ date: string; value: number }>>,
): BtcCorrelation[] {
  const assets = [
    { asset: 'SP500', label: 'S&P 500'  },
    { asset: 'DXY',   label: 'DXY (USD)' },
    { asset: 'GOLD',  label: 'Gold'      },
    { asset: 'VIX',   label: 'VIX'       },
  ];

  return assets.map(({ asset, label }) => {
    const series = fredSeries[asset];
    if (!series || series.length < 5) {
      return { asset, label, corr_7d: null, corr_30d: null, corr_90d: null };
    }

    const [xs, ys] = alignByDate(btcPrices, series);
    return {
      asset,
      label,
      corr_7d:  pearsonCorrelation(xs.slice(-7),  ys.slice(-7)),
      corr_30d: pearsonCorrelation(xs.slice(-30), ys.slice(-30)),
      corr_90d: pearsonCorrelation(xs.slice(-90), ys.slice(-90)),
    };
  });
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

function mockGlobalMarkets(): GlobalMarketsData {
  const now = Date.now();
  return {
    fxRates: [
      { pair: 'EUR/USD', value: 1.085, delta_1d:  0.001, delta_7d: -0.005, delta_30d:  0.012, source: 'FRED', series_id: 'DEXUSEU' },
      { pair: 'USD/JPY', value: 149.5, delta_1d: -0.002, delta_7d:  0.008, delta_30d: -0.015, source: 'FRED', series_id: 'DEXJPUS' },
      { pair: 'GBP/USD', value: 1.265, delta_1d:  0.002, delta_7d:  0.003, delta_30d:  0.005, source: 'FRED', series_id: 'DEXUSUK' },
      { pair: 'USD/CNY', value: 7.240, delta_1d:  0.001, delta_7d: -0.003, delta_30d:  0.010, source: 'FRED', series_id: 'DEXCHUS' },
      { pair: 'USD/BRL', value: 5.720, delta_1d: -0.003, delta_7d:  0.012, delta_30d:  0.025, source: 'BCB',  series_id: 'BCB-1'   },
    ],
    commodities: [
      { name: 'Gold',          symbol: 'XAU', unit: '$/oz',  value: 2340, delta_1d:  0.004, delta_7d:  0.018, delta_30d:  0.055, source: 'FRED', series_id: 'GOLDAMGBD228NLBM' },
      { name: 'Silver',        symbol: 'XAG', unit: '$/oz',  value: 28.5, delta_1d:  0.006, delta_7d:  0.025, delta_30d:  0.080, source: 'FRED', series_id: 'SLVPRUSD'         },
      { name: 'WTI Crude Oil', symbol: 'WTI', unit: '$/bbl', value: 78.4, delta_1d: -0.010, delta_7d: -0.030, delta_30d:  0.020, source: 'FRED', series_id: 'DCOILWTICO'       },
    ],
    centralBankRates: [
      { bank: 'Federal Reserve', country: 'EUA',      rate:  5.25, direction: 'hold',    source: 'FRED', series_id: 'FEDFUNDS'         },
      { bank: 'Banco Central',   country: 'Brasil',   rate: 10.75, direction: 'cutting', source: 'BCB',  series_id: 'BCB-11'           },
      { bank: 'BCE',             country: 'Eurozona', rate:  4.00, direction: 'cutting', source: 'FRED', series_id: 'ECBDFR'           },
      { bank: 'BoJ',             country: 'Japão',    rate:  0.10, direction: 'hiking',  source: 'FRED', series_id: 'IRSTCI01JPM156N' },
    ],
    btcCorrelations: [
      { asset: 'SP500', label: 'S&P 500',    corr_7d:  0.42, corr_30d:  0.38, corr_90d:  0.31 },
      { asset: 'DXY',   label: 'DXY (USD)',  corr_7d: -0.55, corr_30d: -0.48, corr_90d: -0.41 },
      { asset: 'GOLD',  label: 'Gold',       corr_7d:  0.28, corr_30d:  0.22, corr_90d:  0.18 },
      { asset: 'VIX',   label: 'VIX',        corr_7d: -0.38, corr_30d: -0.32, corr_90d: -0.25 },
    ],
    updated_at: now,
    quality: 'B',
  };
}

// ─── Fetchers individuais (exportados para uso nos hooks) ─────────────────────

/** fetchFxRates — EUR/USD, USD/JPY, GBP/USD, USD/CNY via FRED + USD/BRL via BCB */
export async function fetchFxRates(): Promise<FxRateData[]> {
  if (DATA_MODE === 'mock') return mockGlobalMarkets().fxRates;

  const key = requireFredKey();

  const fredPairs = [
    { pair: 'EUR/USD', series: 'DEXUSEU' },
    { pair: 'USD/JPY', series: 'DEXJPUS' },
    { pair: 'GBP/USD', series: 'DEXUSUK' },
    { pair: 'USD/CNY', series: 'DEXCHUS' },
  ];

  const [fredResults, bcbData] = await Promise.all([
    Promise.allSettled(fredPairs.map(p => fetchSeries(p.series, key, 35))),
    fetchBcbData(),
  ]);

  const rates: FxRateData[] = fredPairs.map((p, i) => {
    const r = fredResults[i];
    if (r.status === 'rejected' || r.value.length === 0) {
      return { pair: p.pair, value: 0, delta_1d: 0, delta_7d: 0, delta_30d: 0, source: 'FRED' as const, series_id: p.series };
    }
    const { last, delta_1d, delta_7d, delta_30d } = calcDeltas(r.value);
    return { pair: p.pair, value: parseFloat(last.toFixed(4)), delta_1d, delta_7d, delta_30d, source: 'FRED' as const, series_id: p.series };
  });

  if (bcbData.usdbrl !== null) {
    rates.push({
      pair: 'USD/BRL', value: bcbData.usdbrl,
      delta_1d: 0, delta_7d: 0, delta_30d: 0,
      source: 'BCB' as const, series_id: 'BCB-1',
    });
  }

  return rates;
}

/** fetchCommodities — Gold, Silver, WTI Crude Oil via FRED */
export async function fetchCommodities(): Promise<CommodityData[]> {
  if (DATA_MODE === 'mock') return mockGlobalMarkets().commodities;

  const key = requireFredKey();

  const configs = [
    { name: 'Gold',          symbol: 'XAU', unit: '$/oz',  series: 'GOLDAMGBD228NLBM' },
    { name: 'Silver',        symbol: 'XAG', unit: '$/oz',  series: 'SLVPRUSD'         },
    { name: 'WTI Crude Oil', symbol: 'WTI', unit: '$/bbl', series: 'DCOILWTICO'       },
  ];

  const results = await Promise.allSettled(
    configs.map(c => fetchSeries(c.series, key, 35)),
  );

  return configs.map((c, i) => {
    const r = results[i];
    if (r.status === 'rejected' || r.value.length === 0) {
      return { ...c, value: 0, delta_1d: 0, delta_7d: 0, delta_30d: 0, source: 'FRED' as const, series_id: c.series };
    }
    const { last, delta_1d, delta_7d, delta_30d } = calcDeltas(r.value);
    return { ...c, value: parseFloat(last.toFixed(2)), delta_1d, delta_7d, delta_30d, source: 'FRED' as const, series_id: c.series };
  });
}

/** fetchCentralBankRates — Fed Funds, ECB, BoJ via FRED + SELIC via BCB */
export async function fetchCentralBankRates(): Promise<CentralBankRateData[]> {
  if (DATA_MODE === 'mock') return mockGlobalMarkets().centralBankRates;

  const key = requireFredKey();

  const fredConfigs = [
    { bank: 'Federal Reserve', country: 'EUA',      series: 'FEDFUNDS'         },
    { bank: 'BCE',             country: 'Eurozona', series: 'ECBDFR'           },
    { bank: 'BoJ',             country: 'Japão',    series: 'IRSTCI01JPM156N' },
  ];

  const [fredResults, bcbData] = await Promise.all([
    Promise.allSettled(fredConfigs.map(c => fetchSeries(c.series, key, 70))),
    fetchBcbData(),
  ]);

  const rates: CentralBankRateData[] = fredConfigs.map((c, i) => {
    const r = fredResults[i];
    if (r.status === 'rejected' || r.value.length === 0) {
      return { bank: c.bank, country: c.country, rate: null, direction: 'hold' as const, source: 'FRED' as const, series_id: c.series };
    }
    const hist = r.value;
    const current = hist[hist.length - 1]?.value ?? 0;
    const prev    = hist[Math.max(0, hist.length - 5)]?.value ?? current;
    const direction: CentralBankRateData['direction'] =
      current > prev + 0.01 ? 'hiking' : current < prev - 0.01 ? 'cutting' : 'hold';
    return { bank: c.bank, country: c.country, rate: parseFloat(current.toFixed(2)), direction, source: 'FRED' as const, series_id: c.series };
  });

  // Insere SELIC (BCB) após o Fed (posição 1)
  if (bcbData.selic !== null) {
    rates.splice(1, 0, {
      bank: 'Banco Central', country: 'Brasil',
      rate: bcbData.selic, direction: 'cutting',
      source: 'BCB' as const, series_id: 'BCB-11',
    });
  }

  return rates;
}

// ─── Fetcher principal ────────────────────────────────────────────────────────

/**
 * fetchGlobalMarketsData — FX, commodities e bancos centrais em paralelo.
 * Correlações BTC são calculadas no hook (requerem klines Binance separadamente).
 *
 * Cache recomendado: 1 hora (dados FRED são diários, não intraday).
 */
export async function fetchGlobalMarketsData(): Promise<Omit<GlobalMarketsData, 'btcCorrelations'>> {
  if (DATA_MODE === 'mock') {
    const m = mockGlobalMarkets();
    return { fxRates: m.fxRates, commodities: m.commodities, centralBankRates: m.centralBankRates, updated_at: m.updated_at, quality: m.quality };
  }

  const [fxRates, commodities, centralBankRates] = await Promise.all([
    fetchFxRates(),
    fetchCommodities(),
    fetchCentralBankRates(),
  ]);

  const hasData = fxRates.some(r => r.value > 0) && commodities.some(c => c.value > 0);

  return {
    fxRates,
    commodities,
    centralBankRates,
    updated_at: Date.now(),
    quality: hasData ? 'A' : 'B',
  };
}
