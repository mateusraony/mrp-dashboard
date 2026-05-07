/**
 * mtfAnalysis.test.ts — testes para frameFromKlines e computeConfluence
 */

import { describe, it, expect } from 'vitest';
import { frameFromKlines, computeConfluence, type KlineCandle, type TimeframeFrame } from '@/utils/mtfAnalysis';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function candle(open: number, close: number, volume = 1_000_000): KlineCandle {
  return { open, close, volume };
}

function frame(label: '1H' | '4H' | '1D', direction: 'bullish' | 'bearish' | 'neutral'): TimeframeFrame {
  return { label, direction, signal: '', ret: 0, volume: 0 };
}

// ─── frameFromKlines ──────────────────────────────────────────────────────────

describe('frameFromKlines', () => {
  it('retorna AGUARDANDO para array vazio', () => {
    const f = frameFromKlines([], '1H');
    expect(f.direction).toBe('neutral');
    expect(f.signal).toBe('AGUARDANDO');
    expect(f.ret).toBe(0);
  });

  it('classifica como bullish quando retorno > 0.2%', () => {
    const f = frameFromKlines([candle(100_000, 100_500)], '1H');
    expect(f.direction).toBe('bullish');
    expect(f.ret).toBeCloseTo(0.005, 4);
    expect(f.signal).toContain('BULLISH');
  });

  it('classifica como bearish quando retorno < -0.2%', () => {
    const f = frameFromKlines([candle(100_000, 99_400)], '4H');
    expect(f.direction).toBe('bearish');
    expect(f.ret).toBeCloseTo(-0.006, 4);
    expect(f.signal).toContain('BEARISH');
  });

  it('classifica como neutral para variação dentro de ±0.2%', () => {
    const f = frameFromKlines([candle(100_000, 100_100)], '1D');
    expect(f.direction).toBe('neutral');
    expect(f.signal).toContain('NEUTRO');
  });

  it('usa o último candle do array', () => {
    const f = frameFromKlines([
      candle(100_000, 99_000),  // candle anterior: bearish
      candle(99_000, 100_000),  // candle atual: bullish (mais recente)
    ], '1H');
    expect(f.direction).toBe('bullish');
  });

  it('retorna zero para open=0 sem dividir por zero', () => {
    const f = frameFromKlines([candle(0, 100)], '1H');
    expect(f.ret).toBe(0);
    expect(f.direction).toBe('neutral');
  });

  it('preserva o label correto', () => {
    expect(frameFromKlines([candle(100, 101)], '1H').label).toBe('1H');
    expect(frameFromKlines([candle(100, 101)], '4H').label).toBe('4H');
    expect(frameFromKlines([candle(100, 101)], '1D').label).toBe('1D');
  });
});

// ─── computeConfluence ────────────────────────────────────────────────────────

describe('computeConfluence — FORTE (todos concordam)', () => {
  it('3 bullish → FORTE bullish', () => {
    const result = computeConfluence([
      frame('1H', 'bullish'),
      frame('4H', 'bullish'),
      frame('1D', 'bullish'),
    ]);
    expect(result.confluence).toBe('FORTE');
    expect(result.confluenceDir).toBe('bullish');
    expect(result.bullishCount).toBe(3);
  });

  it('3 bearish → FORTE bearish', () => {
    const result = computeConfluence([
      frame('1H', 'bearish'),
      frame('4H', 'bearish'),
      frame('1D', 'bearish'),
    ]);
    expect(result.confluence).toBe('FORTE');
    expect(result.confluenceDir).toBe('bearish');
    expect(result.bearishCount).toBe(3);
  });
});

describe('computeConfluence — MODERADA (2 de 3)', () => {
  it('2 bullish + 1 bearish → MODERADA bullish', () => {
    const result = computeConfluence([
      frame('1H', 'bullish'),
      frame('4H', 'bullish'),
      frame('1D', 'bearish'),
    ]);
    expect(result.confluence).toBe('MODERADA');
    expect(result.confluenceDir).toBe('bullish');
  });

  it('2 bearish + 1 neutral → MODERADA bearish', () => {
    const result = computeConfluence([
      frame('1H', 'bearish'),
      frame('4H', 'bearish'),
      frame('1D', 'neutral'),
    ]);
    expect(result.confluence).toBe('MODERADA');
    expect(result.confluenceDir).toBe('bearish');
  });

  it('2 bullish + 1 neutral → MODERADA bullish', () => {
    const result = computeConfluence([
      frame('1H', 'bullish'),
      frame('4H', 'neutral'),
      frame('1D', 'bullish'),
    ]);
    expect(result.confluence).toBe('MODERADA');
    expect(result.confluenceDir).toBe('bullish');
  });
});

describe('computeConfluence — FRACA (nenhum consenso)', () => {
  it('1 bullish + 1 bearish + 1 neutral → FRACA neutral', () => {
    const result = computeConfluence([
      frame('1H', 'bullish'),
      frame('4H', 'bearish'),
      frame('1D', 'neutral'),
    ]);
    expect(result.confluence).toBe('FRACA');
    expect(result.confluenceDir).toBe('neutral');
  });

  it('3 neutral → FRACA neutral', () => {
    const result = computeConfluence([
      frame('1H', 'neutral'),
      frame('4H', 'neutral'),
      frame('1D', 'neutral'),
    ]);
    expect(result.confluence).toBe('FRACA');
    expect(result.confluenceDir).toBe('neutral');
  });
});

describe('computeConfluence — contagens', () => {
  it('retorna contagens corretas por direção', () => {
    const result = computeConfluence([
      frame('1H', 'bullish'),
      frame('4H', 'bearish'),
      frame('1D', 'neutral'),
    ]);
    expect(result.bullishCount).toBe(1);
    expect(result.bearishCount).toBe(1);
    expect(result.neutralCount).toBe(1);
  });

  it('preserva o array de frames original', () => {
    const frames = [
      frame('1H', 'bullish'),
      frame('4H', 'bullish'),
      frame('1D', 'bearish'),
    ];
    const result = computeConfluence(frames);
    expect(result.frames).toBe(frames);
  });
});
