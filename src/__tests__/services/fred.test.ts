/**
 * fred.test.ts — smoke tests para serviços FRED (mock mode)
 *
 * DATA_MODE=mock → sem chamadas de rede. Sem VITE_FRED_API_KEY necessária.
 * Valida shape, tipos e invariantes do mock.
 */

import { describe, it, expect } from 'vitest';
import { fetchMacroBoard, fetchYieldCurve, fetchGlobalLiquidity } from '@/services/fred';

describe('fetchMacroBoard (mock mode)', () => {
  it('retorna MacroBoardData com series e updated_at', async () => {
    const data = await fetchMacroBoard();
    expect(data).toHaveProperty('series');
    expect(data).toHaveProperty('updated_at');
    expect(Array.isArray(data.series)).toBe(true);
  });

  it('series contém pelo menos 4 entradas', async () => {
    const data = await fetchMacroBoard();
    expect(data.series.length).toBeGreaterThanOrEqual(4);
  });

  it('cada série tem campos obrigatórios', async () => {
    const data = await fetchMacroBoard();
    for (const s of data.series) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('value');
      expect(s).toHaveProperty('history');
      expect(s).toHaveProperty('quality');
      expect(typeof s.value).toBe('number');
    }
  });

  it('history de cada série tem pelo menos 30 pontos', async () => {
    const data = await fetchMacroBoard();
    for (const s of data.series) {
      expect(s.history.length).toBeGreaterThanOrEqual(30);
    }
  });

  it('history entries têm date e value', async () => {
    const data = await fetchMacroBoard();
    const h = data.series[0].history[0];
    expect(h).toHaveProperty('date');
    expect(h).toHaveProperty('value');
    expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('updated_at é número positivo', async () => {
    const data = await fetchMacroBoard();
    expect(data.updated_at).toBeGreaterThan(0);
  });
});

describe('fetchYieldCurve (mock mode)', () => {
  it('retorna YieldCurveData com campos obrigatórios', async () => {
    const data = await fetchYieldCurve();
    expect(data).toHaveProperty('spread_10y2y');
    expect(data).toHaveProperty('fed_funds');
    expect(data).toHaveProperty('history_10y');
    expect(data).toHaveProperty('history_2y');
    expect(data).toHaveProperty('updated_at');
  });

  it('fed_funds é positivo', async () => {
    const data = await fetchYieldCurve();
    expect(data.fed_funds).toBeGreaterThan(0);
  });

  it('history_10y e history_2y têm pelo menos 30 pontos', async () => {
    const data = await fetchYieldCurve();
    expect(data.history_10y.length).toBeGreaterThanOrEqual(30);
    expect(data.history_2y.length).toBeGreaterThanOrEqual(30);
  });

  it('cada history entry tem date e value', async () => {
    const data = await fetchYieldCurve();
    const h = data.history_10y[0];
    expect(h).toHaveProperty('date');
    expect(h).toHaveProperty('value');
  });
});

describe('fetchGlobalLiquidity (mock mode)', () => {
  it('retorna GlobalLiquidityData com campos obrigatórios', async () => {
    const data = await fetchGlobalLiquidity();
    expect(data).toHaveProperty('fed_balance_b');
    expect(data).toHaveProperty('rrp_b');
    expect(data).toHaveProperty('tga_b');
    expect(data).toHaveProperty('net_liquidity');
    expect(data).toHaveProperty('history');
    expect(data).toHaveProperty('quality');
    expect(data).toHaveProperty('source');
    expect(data).toHaveProperty('updated_at');
  });

  it('fed_balance_b é positivo e razoável (> 1000 bilhões)', async () => {
    const data = await fetchGlobalLiquidity();
    expect(data.fed_balance_b).toBeGreaterThan(1000);
  });

  it('net_liquidity = fed_balance_b - rrp_b - tga_b', async () => {
    const data = await fetchGlobalLiquidity();
    const expected = data.fed_balance_b - data.rrp_b - data.tga_b;
    expect(data.net_liquidity).toBeCloseTo(expected, 0);
  });

  it('rrp_trend é um dos valores válidos', async () => {
    const data = await fetchGlobalLiquidity();
    expect(['draining', 'adding', 'stable']).toContain(data.rrp_trend);
  });

  it('tga_trend é um dos valores válidos', async () => {
    const data = await fetchGlobalLiquidity();
    expect(['spending', 'building', 'stable']).toContain(data.tga_trend);
  });

  it('history tem pelo menos 10 pontos com campos corretos', async () => {
    const data = await fetchGlobalLiquidity();
    expect(data.history.length).toBeGreaterThanOrEqual(10);
    const h = data.history[0];
    expect(h).toHaveProperty('date');
    expect(h).toHaveProperty('fed_b');
    expect(h).toHaveProperty('rrp_b');
    expect(h).toHaveProperty('tga_b');
    expect(h).toHaveProperty('net_b');
  });

  it('source é FRED', async () => {
    const data = await fetchGlobalLiquidity();
    expect(data.source).toBe('FRED');
  });
});
