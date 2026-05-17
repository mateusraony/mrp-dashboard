/**
 * eventVolatility.ts — Volatilidade real de BTC ao redor de eventos macro.
 *
 * Usa klines de 1h da Binance para calcular movimentos de preço em janelas
 * pré e pós-evento: -2h, -1h, -30m (interpolado), +1h, +4h, +24h.
 *
 * Fórmula: btc_move(t) = (price(eventTime + t) - refPrice) / refPrice × 100
 * onde refPrice = close do candle que contém o horário do evento.
 *
 * vol_spike_pct = (|move_+1h| - preVol) / preVol × 100
 * onde preVol = média(|move_-2h|, |move_-1h|) — ou 1 se zero para evitar div/0.
 */

import type { Kline } from '@/services/binance';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface EventWindow {
  label:     string;
  btc_move:  number;
}

export interface EventVolatilityRow {
  event:               string;
  date:                string;         // YYYY-MM-DD
  result_vs_expected:  'above' | 'below' | 'inline';
  actual:              string;
  expected:            string;
  windows:             EventWindow[];
  max_drawdown:        number;
  iv_before:           number;         // 0 quando não disponível via klines
  iv_after:            number;
  vol_spike_pct:       number;
}

export interface AvgVolatilityRow {
  event:      string;
  above_exp:  number;
  below_exp:  number;
  inline:     number;
  color:      string;
}

// ─── Input mínimo de evento macro ─────────────────────────────────────────────

export interface MacroEventInput {
  name:         string;
  code:         string;
  datetime_utc: string;
  actual:       string | null;
  previous:     string | null;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;

/** Retorna o close do candle de 1h que contém targetMs, ou null se não encontrado. */
function closePriceAt(klines: Kline[], targetMs: number): number | null {
  const candle = klines.find(k => k[0] <= targetMs && k[0] + HOUR_MS > targetMs);
  return candle ? candle[4] : null;
}

/** Variação percentual em relação ao preço de referência. */
function movePct(price: number | null, ref: number): number {
  if (price === null || ref === 0) return 0;
  return parseFloat(((price - ref) / ref * 100).toFixed(2));
}

/**
 * Infere result_vs_expected comparando actual vs previous.
 * Sem consensus disponível (API paga), usa variação em relação ao dado anterior.
 * Eventos de inflação (CPI/PCE/PPI): actual > previous → pressão hawkish (above).
 * Emprego (NFP/CLAIMS/JOLTS): actual > previous → hawkish (above).
 * FOMC: sempre inline (decisão tipicamente precificada).
 * GDP: actual > previous → acima (below = recessão risk).
 */
function inferResult(code: string, actual: string | null, previous: string | null): 'above' | 'below' | 'inline' {
  if (code.includes('FOMC') || code === 'US_FOMC') return 'inline';
  if (!actual || !previous) return 'inline';

  const toNum = (s: string) => {
    const m = s.replace(/[^0-9.\-+]/g, '');
    const n = parseFloat(m);
    return isNaN(n) ? null : n;
  };

  const a = toNum(actual);
  const p = toNum(previous);
  if (a === null || p === null) return 'inline';
  if (Math.abs(a - p) < 0.01) return 'inline';
  return a > p ? 'above' : 'below';
}

// ─── Computação principal ──────────────────────────────────────────────────────

/**
 * computeEventVolatilityRow — calcula janelas de movimento BTC para um evento.
 * Requer os klines do intervalo [eventMs - 2h, eventMs + 25h].
 */
export function computeEventVolatilityRow(
  ev:     MacroEventInput,
  klines: Kline[],
): EventVolatilityRow | null {
  if (klines.length < 3) return null;

  const eventMs  = new Date(ev.datetime_utc).getTime();
  const refPrice = closePriceAt(klines, eventMs);
  if (!refPrice) return null;

  const p_m2h  = closePriceAt(klines, eventMs - 2 * HOUR_MS);
  const p_m1h  = closePriceAt(klines, eventMs - 1 * HOUR_MS);
  const p_p1h  = closePriceAt(klines, eventMs + 1 * HOUR_MS);
  const p_p4h  = closePriceAt(klines, eventMs + 4 * HOUR_MS);
  const p_p24h = closePriceAt(klines, eventMs + 24 * HOUR_MS);

  const move_m2h  = movePct(p_m2h, refPrice);
  const move_m1h  = movePct(p_m1h, refPrice);
  const move_p1h  = movePct(p_p1h, refPrice);
  const move_p4h  = movePct(p_p4h, refPrice);
  const move_p24h = movePct(p_p24h, refPrice);
  // -30m: interpolação linear entre -1h e event candle (sem candle de 30m disponível)
  const move_m30m = parseFloat(((move_m1h + 0) / 2).toFixed(2));

  const allMoves  = [move_m2h, move_m1h, move_m30m, move_p1h, move_p4h, move_p24h];
  const max_drawdown = Math.min(...allMoves);

  const preVol    = (Math.abs(move_m2h) + Math.abs(move_m1h)) / 2 || 1;
  const vol_spike_pct = parseFloat(((Math.abs(move_p1h) - preVol) / preVol * 100).toFixed(1));

  const result_vs_expected = inferResult(ev.code, ev.actual, ev.previous);

  // Nome curto: "CPI Mar 2026" a partir do datetime_utc
  const monthYear = new Date(ev.datetime_utc).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  const shortName = ev.name.split('(')[0].trim().split(' ').slice(0, 2).join(' ');
  const eventLabel = `${shortName} ${monthYear}`;

  return {
    event: eventLabel,
    date:  ev.datetime_utc.slice(0, 10),
    result_vs_expected,
    actual:   ev.actual   ?? '—',
    expected: ev.previous ? `prev: ${ev.previous}` : '—',
    windows: [
      { label: '-2h',  btc_move: move_m2h },
      { label: '-1h',  btc_move: move_m1h },
      { label: '-30m', btc_move: move_m30m },
      { label: '+1h',  btc_move: move_p1h },
      { label: '+4h',  btc_move: move_p4h },
      { label: '+24h', btc_move: move_p24h },
    ],
    max_drawdown,
    iv_before: 0,
    iv_after:  0,
    vol_spike_pct,
  };
}

// ─── Agregação por tipo de evento ─────────────────────────────────────────────

const EVENT_COLOR: Record<string, string> = {
  CPI:   '#ef4444',
  FOMC:  '#a78bfa',
  NFP:   '#60a5fa',
  PCE:   '#10b981',
  GDP:   '#f59e0b',
  PPI:   '#fb923c',
  OTHER: '#64748b',
};

function eventCategory(code: string): string {
  if (code.includes('CPI'))   return 'CPI';
  if (code.includes('FOMC'))  return 'FOMC';
  if (code.includes('NFP'))   return 'NFP';
  if (code.includes('PCE'))   return 'PCE';
  if (code.includes('GDP'))   return 'GDP';
  if (code.includes('PPI'))   return 'PPI';
  return 'OTHER';
}

/**
 * computeAvgVolatility — agrega EventVolatilityRow[] em médias por tipo de evento.
 * Retorna no mesmo shape que avgVolatilityByEvent do mock.
 */
export function computeAvgVolatility(rows: EventVolatilityRow[]): AvgVolatilityRow[] {
  const buckets: Record<string, { above: number[]; below: number[]; inline: number[] }> = {};

  for (const row of rows) {
    const cat  = eventCategory(row.event.toUpperCase().split(' ')[0]);
    if (!buckets[cat]) buckets[cat] = { above: [], below: [], inline: [] };
    const move24h = row.windows.find(w => w.label === '+24h')?.btc_move ?? 0;
    buckets[cat][row.result_vs_expected].push(move24h);
  }

  const avg = (arr: number[]) =>
    arr.length ? parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1)) : 0;

  return Object.entries(buckets).map(([cat, b]) => ({
    event:     cat,
    above_exp: avg(b.above),
    below_exp: avg(b.below),
    inline:    avg(b.inline),
    color:     EVENT_COLOR[cat] ?? EVENT_COLOR.OTHER,
  }));
}
