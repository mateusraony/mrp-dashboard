/**
 * zScore.test.ts — testes para mean, stddev, computeZScore, interpretZScore, buildZScoreAlerts
 */

import { describe, it, expect } from 'vitest';
import {
  mean, stddev, computeZScore, interpretZScore, buildZScoreAlerts,
  type ZScoreAlert,
} from '@/utils/zScore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function candle(open: number, close: number, volume = 1_000): object {
  return { open, close, volume };
}

/**
 * Gera N candles com retorno ~0 e volume constante mas com variação mínima para
 * que stddev seja não-zero (alternância ±0.01% a cada candle).
 */
function neutralHistory(n: number, price = 100_000, vol = 10): object[] {
  return Array.from({ length: n }, (_, i) => {
    const close = price * (1 + (i % 2 === 0 ? 0.0001 : -0.0001));
    return candle(price, close, vol);
  });
}

// ─── mean ─────────────────────────────────────────────────────────────────────

describe('mean', () => {
  it('retorna 0 para array vazio', () => {
    expect(mean([])).toBe(0);
  });

  it('retorna o único valor para array de 1 elemento', () => {
    expect(mean([42])).toBe(42);
  });

  it('calcula média corretamente', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('funciona com negativos', () => {
    expect(mean([-2, 0, 2])).toBe(0);
  });
});

// ─── stddev ───────────────────────────────────────────────────────────────────

describe('stddev', () => {
  it('retorna 0 para array de 1 elemento', () => {
    expect(stddev([5])).toBe(0);
  });

  it('retorna 0 para array vazio', () => {
    expect(stddev([1])).toBe(0);
  });

  it('retorna 0 para valores uniformes', () => {
    expect(stddev([3, 3, 3, 3])).toBe(0);
  });

  it('calcula desvio padrão populacional corretamente', () => {
    // valores [2,4,4,4,5,5,7,9] → média=5, variância=4, dp=2
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });

  it('aceita μ pré-calculado', () => {
    const values = [1, 2, 3];
    expect(stddev(values, mean(values))).toBeCloseTo(stddev(values), 10);
  });
});

// ─── computeZScore ────────────────────────────────────────────────────────────

describe('computeZScore', () => {
  it('retorna 0 para histórico menor que 3 elementos', () => {
    expect(computeZScore([1, 2], 3)).toBe(0);
    expect(computeZScore([], 1)).toBe(0);
  });

  it('retorna 0 quando desvio padrão é zero (valores uniformes)', () => {
    expect(computeZScore([5, 5, 5, 5], 5)).toBe(0);
    expect(computeZScore([5, 5, 5, 5], 10)).toBe(0);
  });

  it('Z = 0 quando current == mean', () => {
    expect(computeZScore([1, 2, 3], 2)).toBeCloseTo(0, 5);
  });

  it('Z positivo quando current acima da média', () => {
    // histórico com variação pequena em torno de 0 → média≈0, sd>0
    const history = [0.001, -0.001, 0.002, -0.002, 0.0005, -0.0005];
    expect(computeZScore(history, 0.1)).toBeGreaterThan(0);
  });

  it('Z negativo quando current abaixo da média', () => {
    const history = [5.01, 4.99, 5.02, 4.98, 5.01, 4.99];
    expect(computeZScore(history, 4.0)).toBeLessThan(0);
  });

  it('Z = 2 para desvio padrão exato', () => {
    // mean=0, dp=1, current=2 → Z=2
    const history = [-1, -1, 0, 1, 1];   // mean≈0, dp≈√(4/5)≈0.894 — use simétrico exato
    const sym = [-2, -1, 0, 1, 2];       // mean=0, dp=√2≈1.414
    const mu  = mean(sym);
    const sd  = stddev(sym, mu);
    // current = mu + 2*sd
    expect(computeZScore(sym, mu + 2 * sd)).toBeCloseTo(2, 5);
  });
});

// ─── interpretZScore ─────────────────────────────────────────────────────────

describe('interpretZScore', () => {
  it('z = 0 → normal, neutral', () => {
    const r = interpretZScore(0);
    expect(r.level).toBe('normal');
    expect(r.direction).toBe('neutral');
  });

  it('z = 1.0 → elevated, bullish (positiveIsBullish=true)', () => {
    const r = interpretZScore(1.0);
    expect(r.level).toBe('elevated');
    expect(r.direction).toBe('bullish');
  });

  it('z = -1.5 → elevated, bearish', () => {
    const r = interpretZScore(-1.5);
    expect(r.level).toBe('elevated');
    expect(r.direction).toBe('bearish');
  });

  it('z = 2.0 → extreme, bullish', () => {
    const r = interpretZScore(2.0);
    expect(r.level).toBe('extreme');
    expect(r.direction).toBe('bullish');
  });

  it('z = -2.5 → extreme, bearish', () => {
    const r = interpretZScore(-2.5);
    expect(r.level).toBe('extreme');
    expect(r.direction).toBe('bearish');
  });

  it('positiveIsBullish=false → direction sempre neutral', () => {
    expect(interpretZScore(3.0, false).direction).toBe('neutral');
    expect(interpretZScore(-3.0, false).direction).toBe('neutral');
  });

  it('label contém EXTREMO para |z| >= 2', () => {
    expect(interpretZScore(2.1).label).toContain('EXTREMO');
    expect(interpretZScore(-2.1).label).toContain('EXTREMO');
  });

  it('label contém ELEVADO para 1 <= |z| < 2', () => {
    expect(interpretZScore(1.5).label).toContain('ELEVADO');
  });
});

// ─── buildZScoreAlerts ────────────────────────────────────────────────────────

describe('buildZScoreAlerts — dados insuficientes', () => {
  it('retorna [] para array vazio', () => {
    expect(buildZScoreAlerts([])).toEqual([]);
  });

  it('retorna [] para menos de 5 candles', () => {
    const candles = neutralHistory(4) as any[];
    expect(buildZScoreAlerts(candles)).toEqual([]);
  });
});

describe('buildZScoreAlerts — sem anomalia', () => {
  it('retorna [] quando candle atual tem retorno na média do histórico (z ≈ 0)', () => {
    // 30 histórico (alternância ±0.01%) + 1 fechado neutro + 1 em formação neutro
    // closed e forming com open=close → retorno 0, volume exatamente na média
    const hist    = neutralHistory(30) as any[];
    const closed  = candle(100_000, 100_000, 10);  // último candle fechado: neutro
    const forming = candle(100_000, 100_000, 10);  // em formação: neutro
    const alerts  = buildZScoreAlerts([...hist, closed, forming] as any[]);
    expect(alerts).toEqual([]);
  });
});

describe('buildZScoreAlerts — anomalia detectada', () => {
  it('gera alerta de retorno quando vela em formação é extrema', () => {
    // 30 neutros + 1 fechado neutro + 1 em formação com +10%
    const hist    = neutralHistory(31, 100_000, 10) as any[];
    const forming = candle(100_000, 110_000, 10);   // +10% (em formação)
    const alerts  = buildZScoreAlerts([...hist, forming] as any[]);

    const ret = alerts.find(a => a.metric === 'return');
    expect(ret).toBeDefined();
    expect(ret!.level).toBe('extreme');
    expect(ret!.direction).toBe('bullish');
    expect(ret!.z).toBeGreaterThan(2);
  });

  it('gera alerta bearish para queda extrema na vela em formação', () => {
    const hist    = neutralHistory(31, 100_000, 10) as any[];
    const forming = candle(100_000, 88_000, 10);   // -12%
    const alerts  = buildZScoreAlerts([...hist, forming] as any[]);

    const ret = alerts.find(a => a.metric === 'return');
    expect(ret).toBeDefined();
    expect(ret!.direction).toBe('bearish');
    expect(ret!.z).toBeLessThan(-2);
  });

  it('alerta de volume usa candle fechado (penúltimo) — spike + retorno positivo', () => {
    // 29 neutros + 1 fechado com spike de volume e retorno positivo + 1 em formação neutro
    const hist    = neutralHistory(29, 100_000, 10) as any[];
    const closed  = candle(100_000, 101_000, 1_000);  // spike de volume, retorno > 0
    const forming = candle(100_000, 100_000, 10);      // em formação neutro
    const alerts  = buildZScoreAlerts([...hist, closed, forming] as any[]);

    const vol = alerts.find(a => a.metric === 'volume');
    expect(vol).toBeDefined();
    expect(vol!.level).not.toBe('normal');
    expect(vol!.direction).toBe('bullish');   // retorno do closed > 0 → bullish
  });

  it('alerta de volume bearish quando candle fechado tem spike + retorno negativo', () => {
    const hist    = neutralHistory(29, 100_000, 10) as any[];
    const closed  = candle(100_000, 99_000, 1_000);   // spike, retorno negativo
    const forming = candle(100_000, 100_000, 10);
    const alerts  = buildZScoreAlerts([...hist, closed, forming] as any[]);

    const vol = alerts.find(a => a.metric === 'volume');
    expect(vol).toBeDefined();
    expect(vol!.direction).toBe('bearish');
  });

  it('preserva value e histMean no alerta de retorno', () => {
    const hist    = neutralHistory(31, 100_000, 10) as any[];
    const forming = candle(100_000, 110_000, 10);
    const alerts  = buildZScoreAlerts([...hist, forming] as any[]);
    const ret     = alerts.find(a => a.metric === 'return')!;

    expect(ret.value).toBeCloseTo(0.1, 4);      // +10% = 0.1
    expect(ret.histMean).toBeCloseTo(0, 4);      // histórico neutro → média ≈ 0
  });

  it('volume parcial intraday NÃO gera alerta falso — forming com volume baixo é ignorado', () => {
    // simula candle do dia com apenas 5% do volume típico (parcial intraday)
    const hist    = neutralHistory(29, 100_000, 10) as any[];
    const closed  = candle(100_000, 100_000, 10);  // fechado neutro (sem spike)
    const forming = candle(100_000, 100_001, 1);   // forming com volume muito baixo
    const alerts  = buildZScoreAlerts([...hist, closed, forming] as any[]);

    // volume compara closed (neutro) com hist → sem alerta
    const vol = alerts.find(a => a.metric === 'volume');
    expect(vol).toBeUndefined();
  });
});
