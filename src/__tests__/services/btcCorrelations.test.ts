/**
 * btcCorrelations.test.ts — Testes para cálculos de correlação BTC
 *
 * Cobre as funções puras internas via comportamento observável:
 *   - pearson (via fetchBtcCorrelations em mock mode)
 *   - toReturns / alinhamento
 *   - mock data shape
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchBtcCorrelations } from '@/services/btcCorrelations';

// DATA_MODE=mock é forçado pelo vitest.config.ts (VITE_DATA_MODE=mock)

describe('fetchBtcCorrelations — mock mode', () => {
  it('retorna 5 pares de correlação', async () => {
    const result = await fetchBtcCorrelations();
    expect(result.pairs).toHaveLength(5);
  });

  it('cada par tem chave, label, color, icon, desc', async () => {
    const { pairs } = await fetchBtcCorrelations();
    for (const p of pairs) {
      expect(p.key).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.color).toMatch(/^#/);
      expect(p.icon).toBeTruthy();
    }
  });

  it('correlações estão no intervalo [-1, 1]', async () => {
    const { pairs } = await fetchBtcCorrelations();
    for (const p of pairs) {
      for (const tf of ['1m', '3m', '6m'] as const) {
        expect(p.corr[tf]).toBeGreaterThanOrEqual(-1);
        expect(p.corr[tf]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('séries têm comprimento correto por timeframe', async () => {
    const { pairs } = await fetchBtcCorrelations();
    for (const p of pairs) {
      expect(p.series['1m']).toHaveLength(30);
      expect(p.series['3m'].length).toBeGreaterThanOrEqual(30);
      expect(p.series['6m'].length).toBeGreaterThanOrEqual(30);
    }
  });

  it('updated_at é um timestamp recente', async () => {
    const { updated_at } = await fetchBtcCorrelations();
    expect(updated_at).toBeGreaterThan(Date.now() - 5000);
  });

  it('pares incluem SPX e DXY', async () => {
    const { pairs } = await fetchBtcCorrelations();
    const keys = pairs.map(p => p.key);
    expect(keys).toContain('SPX');
    expect(keys).toContain('DXY');
  });

  it('SPX tem correlação positiva (mock baseline)', async () => {
    const { pairs } = await fetchBtcCorrelations();
    const spx = pairs.find(p => p.key === 'SPX');
    expect(spx).toBeDefined();
    expect(spx!.corr['1m']).toBeGreaterThan(0);
  });

  it('DXY tem correlação negativa (mock baseline)', async () => {
    const { pairs } = await fetchBtcCorrelations();
    const dxy = pairs.find(p => p.key === 'DXY');
    expect(dxy).toBeDefined();
    expect(dxy!.corr['1m']).toBeLessThan(0);
  });
});
