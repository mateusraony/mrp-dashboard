/**
 * sessionAnalytics.test.ts — testes para computeSessionStats e getSessionForHour
 *
 * Testa lógica pura: sem chamadas de rede, sem mocks de API.
 */

import { describe, it, expect } from 'vitest';
import {
  getSessionForHour,
  computeSessionStats,
  type KlinePoint,
} from '@/utils/sessionAnalytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cria um timestamp UTC com hora específica (hoje) */
function tsAtUTCHour(hour: number): number {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d.getTime();
}

/** Cria um KlinePoint sintético para uma hora UTC específica */
function mkKline(
  utcHour: number,
  open = 85_000,
  close = 86_000,
  volume = 100,
  takerBuyFraction = 0.55,
): KlinePoint {
  const t = tsAtUTCHour(utcHour);
  const takerBuy = volume * takerBuyFraction;
  return {
    time:      t,
    open,
    high:      Math.max(open, close) + 200,
    low:       Math.min(open, close) - 200,
    close,
    volume,
    taker_buy: takerBuy,
    bull:      close >= open ? volume : 0,
    bear:      close < open  ? volume : 0,
  };
}

// ─── getSessionForHour ────────────────────────────────────────────────────────

describe('getSessionForHour', () => {
  it('hora 00 UTC → sessão Ásia', () => {
    expect(getSessionForHour(tsAtUTCHour(0))).toBe('asia');
  });

  it('hora 07 UTC → sessão Ásia (último da janela)', () => {
    expect(getSessionForHour(tsAtUTCHour(7))).toBe('asia');
  });

  it('hora 08 UTC → sessão Europa', () => {
    expect(getSessionForHour(tsAtUTCHour(8))).toBe('europe');
  });

  it('hora 15 UTC → sessão Europa (último da janela)', () => {
    expect(getSessionForHour(tsAtUTCHour(15))).toBe('europe');
  });

  it('hora 16 UTC → sessão EUA', () => {
    expect(getSessionForHour(tsAtUTCHour(16))).toBe('us');
  });

  it('hora 23 UTC → sessão EUA', () => {
    expect(getSessionForHour(tsAtUTCHour(23))).toBe('us');
  });
});

// ─── computeSessionStats ──────────────────────────────────────────────────────

describe('computeSessionStats', () => {
  // Cria 24 klines cobrindo 1 ciclo completo (00..23 UTC)
  const klines24h: KlinePoint[] = Array.from({ length: 24 }, (_, h) =>
    mkKline(h, 85_000, 86_000, 100, 0.6),
  );

  it('retorna exatamente 3 sessões', () => {
    const stats = computeSessionStats(klines24h, 85_000);
    expect(stats).toHaveLength(3);
  });

  it('labels corretas: Ásia, Europa, EUA', () => {
    const stats = computeSessionStats(klines24h, 85_000);
    const labels = stats.map(s => s.label);
    expect(labels).toEqual(['Ásia', 'Europa', 'EUA']);
  });

  it('cada sessão tem 8 candles (8h cada)', () => {
    const stats = computeSessionStats(klines24h, 85_000);
    for (const s of stats) {
      expect(s.candles).toBe(8);
    }
  });

  it('taker_buy_pct próximo de 60% (fração configurada)', () => {
    const stats = computeSessionStats(klines24h, 85_000);
    for (const s of stats) {
      expect(s.taker_buy_pct).toBeCloseTo(60, 0);
    }
  });

  it('dominant_side = buy quando taker_buy_pct > 52%', () => {
    const stats = computeSessionStats(klines24h, 85_000);
    for (const s of stats) {
      expect(s.dominant_side).toBe('buy');
    }
  });

  it('dominant_side = sell quando taker_buy_pct < 48%', () => {
    const sellKlines = Array.from({ length: 24 }, (_, h) =>
      mkKline(h, 86_000, 85_000, 100, 0.4),
    );
    const stats = computeSessionStats(sellKlines, 85_000);
    for (const s of stats) {
      expect(s.dominant_side).toBe('sell');
    }
  });

  it('CVD positivo quando taker_buy > taker_sell', () => {
    const stats = computeSessionStats(klines24h, 85_000);
    for (const s of stats) {
      expect(s.cvd).toBeGreaterThan(0);
    }
  });

  it('volume_usd_b calculado com btcPrice correto', () => {
    const stats = computeSessionStats(klines24h, 100_000);
    // 8 candles × volume 100 BTC × $100.000 = $80M → $0.08B (dividido por 1e9)
    for (const s of stats) {
      expect(s.volume_usd_b).toBeCloseTo(0.08, 2);
    }
  });

  it('retorna zeros para sessão sem dados', () => {
    // klines apenas na sessão Asia (horas 0-7)
    const asiaOnly = Array.from({ length: 8 }, (_, h) => mkKline(h));
    const stats = computeSessionStats(asiaOnly, 85_000);

    const europe = stats.find(s => s.label === 'Europa')!;
    const us     = stats.find(s => s.label === 'EUA')!;
    expect(europe.cvd).toBe(0);
    expect(europe.candles).toBe(0);
    expect(us.cvd).toBe(0);
    expect(us.candles).toBe(0);
  });

  it('price_move_pct calculado corretamente', () => {
    // open=85000 → close=85850 = +1%
    const klines = Array.from({ length: 24 }, (_, h) =>
      mkKline(h, 85_000, 85_850, 100, 0.55),
    );
    const stats = computeSessionStats(klines, 85_000);
    for (const s of stats) {
      expect(s.price_move_pct).toBeCloseTo(1, 0);
    }
  });
});
