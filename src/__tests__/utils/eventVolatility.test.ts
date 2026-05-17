import { describe, it, expect } from 'vitest';
import {
  computeEventVolatilityRow,
  computeAvgVolatility,
  type MacroEventInput,
} from '@/utils/eventVolatility';
import type { Kline } from '@/services/binance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;

/** Gera kline sintético com close = price, openTime = ts */
function makeKline(ts: number, price: number): Kline {
  return [ts, price, price * 1.001, price * 0.999, price, 100,
          ts + HOUR_MS - 1, price * 100, 50, 50, price * 50 * 100, '0'];
}

const EVENT_UTC = '2026-03-12T13:30:00Z';
const EVENT_MS  = new Date(EVENT_UTC).getTime();

/** Sequência: -3h=-2h=-1h=refPrice, +1h=+4h=+24h têm preços distintos */
function makeKlines(ref: number, moves: { m2: number; m1: number; p1: number; p4: number; p24: number }) {
  return [
    makeKline(EVENT_MS - 3 * HOUR_MS, ref),
    makeKline(EVENT_MS - 2 * HOUR_MS, ref * (1 + moves.m2 / 100)),
    makeKline(EVENT_MS - 1 * HOUR_MS, ref * (1 + moves.m1 / 100)),
    makeKline(EVENT_MS,               ref),
    makeKline(EVENT_MS + 1 * HOUR_MS, ref * (1 + moves.p1 / 100)),
    makeKline(EVENT_MS + 2 * HOUR_MS, ref * (1 + moves.p1 / 100)),
    makeKline(EVENT_MS + 3 * HOUR_MS, ref * (1 + moves.p4 / 100)),
    makeKline(EVENT_MS + 4 * HOUR_MS, ref * (1 + moves.p4 / 100)),
    makeKline(EVENT_MS + 24 * HOUR_MS, ref * (1 + moves.p24 / 100)),
  ];
}

const baseEvent: MacroEventInput = {
  name:         'CPI (MoM)',
  code:         'US_CPI',
  datetime_utc: EVENT_UTC,
  actual:       '+0.4%',
  previous:     '+0.3%',
};

// ─── computeEventVolatilityRow ────────────────────────────────────────────────

describe('computeEventVolatilityRow', () => {
  it('retorna null quando klines insuficientes', () => {
    const result = computeEventVolatilityRow(baseEvent, []);
    expect(result).toBeNull();
  });

  it('retorna null quando klines não cobrem o horário do evento', () => {
    const klines = [makeKline(EVENT_MS + 10 * HOUR_MS, 80000)];
    expect(computeEventVolatilityRow(baseEvent, klines)).toBeNull();
  });

  it('calcula movimentos corretos para queda pós-evento', () => {
    const klines = makeKlines(80000, { m2: -0.5, m1: -0.8, p1: -3.2, p4: -4.8, p24: -6.2 });
    const row = computeEventVolatilityRow(baseEvent, klines);
    expect(row).not.toBeNull();
    const w = (label: string) => row!.windows.find(w => w.label === label)!.btc_move;
    expect(w('-2h')).toBeCloseTo(-0.5, 1);
    expect(w('-1h')).toBeCloseTo(-0.8, 1);
    expect(w('+1h')).toBeCloseTo(-3.2, 1);
    expect(w('+4h')).toBeCloseTo(-4.8, 1);
    expect(w('+24h')).toBeCloseTo(-6.2, 1);
  });

  it('calcula movimentos corretos para alta pós-evento', () => {
    const klines = makeKlines(80000, { m2: 0.1, m1: 0.2, p1: 1.8, p4: 3.2, p24: 4.9 });
    const row = computeEventVolatilityRow(baseEvent, klines);
    expect(row).not.toBeNull();
    const w = (label: string) => row!.windows.find(w => w.label === label)!.btc_move;
    expect(w('+1h')).toBeCloseTo(1.8, 1);
    expect(w('+24h')).toBeCloseTo(4.9, 1);
  });

  it('max_drawdown é o mínimo dos movimentos', () => {
    const klines = makeKlines(80000, { m2: -0.5, m1: -0.8, p1: -3.2, p4: -4.8, p24: -6.2 });
    const row = computeEventVolatilityRow(baseEvent, klines)!;
    expect(row.max_drawdown).toBeLessThanOrEqual(-6.0);
  });

  it('infere result_vs_expected como "above" quando actual > previous', () => {
    const klines = makeKlines(80000, { m2: 0, m1: 0, p1: -2, p4: -3, p24: -4 });
    const row = computeEventVolatilityRow(baseEvent, klines)!;
    expect(row.result_vs_expected).toBe('above');
  });

  it('infere result_vs_expected como "below" quando actual < previous', () => {
    const ev = { ...baseEvent, actual: '+0.2%', previous: '+0.3%' };
    const klines = makeKlines(80000, { m2: 0, m1: 0, p1: 2, p4: 3, p24: 5 });
    const row = computeEventVolatilityRow(ev, klines)!;
    expect(row.result_vs_expected).toBe('below');
  });

  it('FOMC sempre retorna inline independente do actual/previous', () => {
    const ev: MacroEventInput = { ...baseEvent, code: 'US_FOMC', actual: '4.5%', previous: '4.25%' };
    const klines = makeKlines(80000, { m2: 0, m1: 0, p1: -1, p4: -2, p24: -3 });
    const row = computeEventVolatilityRow(ev, klines)!;
    expect(row.result_vs_expected).toBe('inline');
  });

  it('windows têm exatamente 6 entradas com os labels corretos', () => {
    const klines = makeKlines(80000, { m2: 0, m1: 0, p1: 1, p4: 2, p24: 3 });
    const row = computeEventVolatilityRow(baseEvent, klines)!;
    expect(row.windows).toHaveLength(6);
    const labels = row.windows.map(w => w.label);
    expect(labels).toEqual(['-2h', '-1h', '-30m', '+1h', '+4h', '+24h']);
  });

  it('vol_spike_pct reflete aumento de volatilidade pós-evento', () => {
    // pré: moves pequenos; pós: move grande
    const klines = makeKlines(80000, { m2: 0.1, m1: 0.1, p1: 5.0, p4: 5.0, p24: 5.0 });
    const row = computeEventVolatilityRow(baseEvent, klines)!;
    expect(row.vol_spike_pct).toBeGreaterThan(0);
  });

  it('row contém o campo code do evento de entrada', () => {
    const klines = makeKlines(80000, { m2: 0, m1: 0, p1: 1, p4: 2, p24: 3 });
    const row = computeEventVolatilityRow(baseEvent, klines)!;
    expect(row.code).toBe('US_CPI');
  });

  it('retorna null quando +24h candle falta e evento < 25h atrás', () => {
    // evento no futuro próximo (< 25h) — sem candle +24h
    const recentEvent: MacroEventInput = {
      ...baseEvent,
      datetime_utc: new Date(Date.now() - 2 * HOUR_MS).toISOString(), // 2h atrás
    };
    // klines só cobrem até agora — sem +24h
    const eventMs = new Date(recentEvent.datetime_utc).getTime();
    const klines = [
      makeKline(eventMs - 3 * HOUR_MS, 80000),
      makeKline(eventMs - 2 * HOUR_MS, 80000),
      makeKline(eventMs - 1 * HOUR_MS, 80000),
      makeKline(eventMs,               80000),
      makeKline(eventMs + 1 * HOUR_MS, 80000),
    ];
    expect(computeEventVolatilityRow(recentEvent, klines)).toBeNull();
  });
});

// ─── computeAvgVolatility ─────────────────────────────────────────────────────

describe('computeAvgVolatility', () => {
  it('retorna array vazio para input vazio', () => {
    expect(computeAvgVolatility([])).toEqual([]);
  });

  it('agrupa corretamente por tipo de evento usando code (não label)', () => {
    const rows = [
      {
        // label em português — sem code seria bucketed como OTHER
        event: 'Consumer Price Index mar. de 2026', code: 'US_CPI',
        date: '2026-03-12', result_vs_expected: 'above' as const,
        actual: '+0.4%', expected: 'prev: +0.3%',
        windows: [{ label: '+24h', btc_move: -5 }, { label: '+1h', btc_move: -3 }, { label: '-2h', btc_move: 0 }, { label: '-1h', btc_move: 0 }, { label: '-30m', btc_move: 0 }, { label: '+4h', btc_move: -4 }],
        max_drawdown: -5, iv_before: 0, iv_after: 0, vol_spike_pct: 10,
      },
      {
        event: 'Nonfarm Payrolls mar. de 2026', code: 'US_NFP',
        date: '2026-03-07', result_vs_expected: 'below' as const,
        actual: '+150K', expected: 'prev: +185K',
        windows: [{ label: '+24h', btc_move: 4 }, { label: '+1h', btc_move: 2 }, { label: '-2h', btc_move: 0 }, { label: '-1h', btc_move: 0 }, { label: '-30m', btc_move: 0 }, { label: '+4h', btc_move: 3 }],
        max_drawdown: 0, iv_before: 0, iv_after: 0, vol_spike_pct: 5,
      },
    ];
    const avg = computeAvgVolatility(rows);
    const cpi = avg.find(r => r.event === 'CPI');
    const nfp = avg.find(r => r.event === 'NFP');
    expect(cpi?.above_exp).toBeCloseTo(-5, 0);
    expect(nfp?.below_exp).toBeCloseTo(4, 0);
  });

  it('cada linha tem os campos obrigatórios', () => {
    const rows = [
      {
        event: 'CPI', code: 'US_CPI', date: '2026-03-12', result_vs_expected: 'above' as const,
        actual: '+0.4%', expected: '—',
        windows: [{ label: '+24h', btc_move: -3 }, { label: '+1h', btc_move: -2 }, { label: '-2h', btc_move: 0 }, { label: '-1h', btc_move: 0 }, { label: '-30m', btc_move: 0 }, { label: '+4h', btc_move: -2 }],
        max_drawdown: -3, iv_before: 0, iv_after: 0, vol_spike_pct: 8,
      },
    ];
    const avg = computeAvgVolatility(rows);
    expect(avg[0]).toHaveProperty('event');
    expect(avg[0]).toHaveProperty('above_exp');
    expect(avg[0]).toHaveProperty('below_exp');
    expect(avg[0]).toHaveProperty('inline');
    expect(avg[0]).toHaveProperty('color');
  });
});
