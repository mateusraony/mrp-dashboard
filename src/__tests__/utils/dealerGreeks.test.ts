/**
 * dealerGreeks.test.ts — testes para computeGreeks e computeContractGreeks
 *
 * Valida Black-Scholes 2ª ordem: Delta, Gamma, Vanna, Charm, GEX,
 * VannaExposure e CharmExposure. Sem chamadas de rede.
 */

import { describe, it, expect } from 'vitest';
import { computeGreeks, computeContractGreeks } from '@/utils/riskCalculations';

const BASE: Parameters<typeof computeGreeks>[0] = {
  spot: 85_000,
  strike: 85_000,
  timeToExpiry: 30 / 365,
  riskFreeRate: 0.045,
  iv: 0.65,
  optionType: 'call',
};

// ─── computeGreeks ────────────────────────────────────────────────────────────

describe('computeGreeks', () => {
  it('retorna null para T <= 0', () => {
    expect(computeGreeks({ ...BASE, timeToExpiry: 0 })).toBeNull();
  });

  it('retorna null para T negativo', () => {
    expect(computeGreeks({ ...BASE, timeToExpiry: -1 })).toBeNull();
  });

  it('retorna null para iv <= 0', () => {
    expect(computeGreeks({ ...BASE, iv: 0 })).toBeNull();
  });

  it('retorna null para spot <= 0', () => {
    expect(computeGreeks({ ...BASE, spot: 0 })).toBeNull();
  });

  it('retorna null para strike <= 0', () => {
    expect(computeGreeks({ ...BASE, strike: 0 })).toBeNull();
  });

  it('delta call ATM está entre 0.4 e 0.7', () => {
    const g = computeGreeks(BASE)!;
    expect(g.delta).toBeGreaterThan(0.4);
    expect(g.delta).toBeLessThan(0.7);
  });

  it('delta put ATM está entre -0.7 e -0.3', () => {
    const g = computeGreeks({ ...BASE, optionType: 'put' })!;
    expect(g.delta).toBeGreaterThan(-0.7);
    expect(g.delta).toBeLessThan(-0.3);
  });

  it('delta call deep ITM próximo de 1', () => {
    const g = computeGreeks({ ...BASE, strike: 50_000 })!;
    expect(g.delta).toBeGreaterThan(0.9);
    expect(g.delta).toBeLessThanOrEqual(1.0);
  });

  it('delta call deep OTM próximo de 0', () => {
    const g = computeGreeks({ ...BASE, strike: 200_000 })!;
    expect(g.delta).toBeGreaterThanOrEqual(0);
    expect(g.delta).toBeLessThan(0.1);
  });

  it('gamma é positivo para calls', () => {
    expect(computeGreeks(BASE)!.gamma).toBeGreaterThan(0);
  });

  it('gamma é positivo para puts (mesmo sinal — put e call têm mesmo gamma BS)', () => {
    expect(computeGreeks({ ...BASE, optionType: 'put' })!.gamma).toBeGreaterThan(0);
  });

  it('paridade put-call: delta_call - delta_put = 1 (identidade BS exata)', () => {
    const callDelta = computeGreeks({ ...BASE, optionType: 'call' })!.delta;
    const putDelta  = computeGreeks({ ...BASE, optionType: 'put' })!.delta;
    // delta_call - delta_put = N(d1) - (N(d1) - 1) = 1 (sempre exato)
    expect(callDelta - putDelta).toBeCloseTo(1, 10);
  });

  it('vanna é um número finito', () => {
    const g = computeGreeks(BASE)!;
    expect(isFinite(g.vanna)).toBe(true);
  });

  it('charm é um número finito', () => {
    const g = computeGreeks(BASE)!;
    expect(isFinite(g.charm)).toBe(true);
  });

  it('retorna objeto com todas as propriedades esperadas', () => {
    const g = computeGreeks(BASE)!;
    expect(g).toHaveProperty('delta');
    expect(g).toHaveProperty('gamma');
    expect(g).toHaveProperty('vanna');
    expect(g).toHaveProperty('charm');
  });
});

// ─── computeContractGreeks ────────────────────────────────────────────────────

describe('computeContractGreeks', () => {
  it('retorna null quando inputs são inválidos (T=0)', () => {
    expect(computeContractGreeks({ ...BASE, timeToExpiry: 0 }, 1000)).toBeNull();
  });

  it('gex call é positivo', () => {
    const cg = computeContractGreeks(BASE, 1000)!;
    expect(cg.gex).toBeGreaterThan(0);
  });

  it('gex put é negativo', () => {
    const cg = computeContractGreeks({ ...BASE, optionType: 'put' }, 1000)!;
    expect(cg.gex).toBeLessThan(0);
  });

  it('strike correto no resultado', () => {
    const cg = computeContractGreeks(BASE, 500)!;
    expect(cg.strike).toBe(85_000);
  });

  it('oi correto no resultado', () => {
    const cg = computeContractGreeks(BASE, 500)!;
    expect(cg.oi).toBe(500);
  });

  it('optionType correto no resultado para call', () => {
    const cg = computeContractGreeks(BASE, 100)!;
    expect(cg.optionType).toBe('call');
  });

  it('optionType correto no resultado para put', () => {
    const cg = computeContractGreeks({ ...BASE, optionType: 'put' }, 100)!;
    expect(cg.optionType).toBe('put');
  });

  it('vannaExposure é um número finito', () => {
    const cg = computeContractGreeks(BASE, 1000)!;
    expect(isFinite(cg.vannaExposure)).toBe(true);
  });

  it('charmExposure é um número finito', () => {
    const cg = computeContractGreeks(BASE, 1000)!;
    expect(isFinite(cg.charmExposure)).toBe(true);
  });

  it('gex escala linearmente com OI', () => {
    const cg1 = computeContractGreeks(BASE, 100)!;
    const cg2 = computeContractGreeks(BASE, 200)!;
    expect(cg2.gex / cg1.gex).toBeCloseTo(2, 5);
  });

  it('contractSize = 2 dobra o gex vs default 1', () => {
    const cg1 = computeContractGreeks(BASE, 100, 1.0)!;
    const cg2 = computeContractGreeks(BASE, 100, 2.0)!;
    expect(cg2.gex / cg1.gex).toBeCloseTo(2, 5);
  });

  it('contém todas as propriedades de ContractGreeks', () => {
    const cg = computeContractGreeks(BASE, 100)!;
    expect(cg).toHaveProperty('delta');
    expect(cg).toHaveProperty('gamma');
    expect(cg).toHaveProperty('vanna');
    expect(cg).toHaveProperty('charm');
    expect(cg).toHaveProperty('strike');
    expect(cg).toHaveProperty('optionType');
    expect(cg).toHaveProperty('oi');
    expect(cg).toHaveProperty('gex');
    expect(cg).toHaveProperty('vannaExposure');
    expect(cg).toHaveProperty('charmExposure');
  });
});
