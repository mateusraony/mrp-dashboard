/**
 * coinmetrics.test.ts — testes para fetchOnChainCycle (modo mock)
 *
 * DATA_MODE=mock (definido em vitest.config.ts) → sem chamadas de rede.
 * Valida shape dos dados, zonas MVRV/NUPL e qualidade do dado mock.
 */

import { describe, it, expect } from 'vitest';
import { fetchOnChainCycle } from '@/services/coinmetrics';

describe('fetchOnChainCycle (mock mode)', () => {
  it('retorna objeto com todas as propriedades esperadas', async () => {
    const data = await fetchOnChainCycle();

    expect(data).toHaveProperty('mvrv_current');
    expect(data).toHaveProperty('mvrv_zscore');
    expect(data).toHaveProperty('mvrv_zone');
    expect(data).toHaveProperty('mvrv_zone_color');
    expect(data).toHaveProperty('realized_price');
    expect(data).toHaveProperty('realized_cap');
    expect(data).toHaveProperty('nupl');
    expect(data).toHaveProperty('nupl_zone');
    expect(data).toHaveProperty('nupl_zone_color');
    expect(data).toHaveProperty('nvt_current');
    expect(data).toHaveProperty('current_price');
    expect(data).toHaveProperty('history');
    expect(data).toHaveProperty('quality');
    expect(data).toHaveProperty('source');
    expect(data).toHaveProperty('updated_at');
  });

  it('valores numéricos estão dentro de ranges razoáveis', async () => {
    const data = await fetchOnChainCycle();

    // MVRV ratio histórico BTC: 0.3 – 8.0
    expect(data.mvrv_current).toBeGreaterThan(0.1);
    expect(data.mvrv_current).toBeLessThan(20);

    // Realized price > 0 e < price atual * 10
    expect(data.realized_price).toBeGreaterThan(0);
    expect(data.realized_price).toBeLessThan(data.current_price * 10);

    // NUPL entre -1 e 1
    expect(data.nupl).toBeGreaterThanOrEqual(-1);
    expect(data.nupl).toBeLessThanOrEqual(1);
  });

  it('mvrv_zone_color é um hex color válido', async () => {
    const data = await fetchOnChainCycle();
    expect(data.mvrv_zone_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('nupl_zone_color é um hex color válido', async () => {
    const data = await fetchOnChainCycle();
    expect(data.nupl_zone_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('history contém pelo menos 30 pontos', async () => {
    const data = await fetchOnChainCycle();
    expect(data.history.length).toBeGreaterThanOrEqual(30);
  });

  it('cada ponto do history tem as propriedades corretas', async () => {
    const data = await fetchOnChainCycle();
    const pt = data.history[0];

    expect(pt).toHaveProperty('date');
    expect(pt).toHaveProperty('mvrv');
    expect(pt).toHaveProperty('realized_cap');
    expect(pt).toHaveProperty('price');
    expect(pt).toHaveProperty('nupl');
    expect(pt).toHaveProperty('realized_price');
    expect(pt).toHaveProperty('nvt');
    // date no formato YYYY-MM-DD
    expect(pt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mvrv_zone é consistente com mvrv_current', async () => {
    const data = await fetchOnChainCycle();
    const mvrv = data.mvrv_current;
    const zone = data.mvrv_zone;

    if (mvrv < 1.0)       expect(zone).toBe('Fundo / Subvalorizado');
    else if (mvrv < 2.5)  expect(zone).toBe('Zona Neutra / Acumulação');
    else if (mvrv < 3.7)  expect(zone).toBe('Mercado Caro');
    else                  expect(zone).toBe('Euforia / Topo de Ciclo');
  });

  it('nupl_zone é consistente com nupl', async () => {
    const data = await fetchOnChainCycle();
    const nupl = data.nupl;
    const zone = data.nupl_zone;

    if (nupl < 0)         expect(zone).toBe('Capitulação');
    else if (nupl < 0.25) expect(zone).toBe('Esperança');
    else if (nupl < 0.5)  expect(zone).toBe('Crença / Otimismo');
    else if (nupl < 0.75) expect(zone).toBe('Ganância');
    else                  expect(zone).toBe('Euforia');
  });

  it('updated_at é um timestamp recente', async () => {
    const before = Date.now();
    const data = await fetchOnChainCycle();
    const after = Date.now();

    expect(data.updated_at).toBeGreaterThanOrEqual(before);
    expect(data.updated_at).toBeLessThanOrEqual(after);
  });
});
