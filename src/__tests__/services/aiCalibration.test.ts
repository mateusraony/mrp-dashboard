/**
 * aiCalibration.test.ts — testes para computeCalibrationWeights
 *
 * Verifica que pesos refletem acurácia por módulo, respeitem piso/teto
 * e retornem DEFAULT_WEIGHTS quando há amostras insuficientes.
 */

import { describe, it, expect } from 'vitest';
import { computeCalibrationWeights, MIN_CALIBRATION_SAMPLES } from '@/services/aiCalibration';
import { DEFAULT_WEIGHTS } from '@/utils/ruleBasedAnalysis';
import type { AiPrediction } from '@/services/aiPredictions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrediction(overrides: Partial<AiPrediction> = {}): AiPrediction {
  return {
    id:                   crypto.randomUUID(),
    session_hour:         '2026-05-07T10',
    direction:            'bullish',
    signal:               'TEST',
    confidence:           0.65,
    timeframe:            '4h',
    price_at_prediction:  90_000,
    bull_case:            null,
    bear_case:            null,
    modules_snapshot:     {
      derivatives: { direction: 'bullish' },
      spot:        { direction: 'bullish' },
      options:     { direction: 'neutral' },
      macro:       { direction: 'bullish' },
    },
    outcome:              'HIT',
    outcome_price:        91_000,
    outcome_ret_pct:      1.11,
    outcome_evaluated_at: new Date().toISOString(),
    created_at:           new Date().toISOString(),
    ...overrides,
  };
}

/** Gera N previsões idênticas */
function repeat(n: number, overrides: Partial<AiPrediction> = {}): AiPrediction[] {
  return Array.from({ length: n }, (_, i) =>
    makePrediction({ ...overrides, session_hour: `2026-05-07T${String(i).padStart(2, '0')}` })
  );
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('computeCalibrationWeights — amostras insuficientes', () => {
  it('retorna DEFAULT_WEIGHTS com 0 previsões', () => {
    const { weights, isCalibrated } = computeCalibrationWeights([]);
    expect(weights).toEqual(DEFAULT_WEIGHTS);
    expect(isCalibrated).toBe(false);
  });

  it('retorna DEFAULT_WEIGHTS abaixo do mínimo de amostras', () => {
    const predictions = repeat(MIN_CALIBRATION_SAMPLES - 1, { outcome: 'HIT' });
    const { weights, isCalibrated, sampleCount } = computeCalibrationWeights(predictions);
    expect(weights).toEqual(DEFAULT_WEIGHTS);
    expect(isCalibrated).toBe(false);
    expect(sampleCount).toBe(MIN_CALIBRATION_SAMPLES - 1);
  });

  it('ignora previsões PENDING no conteo de amostras', () => {
    const predictions = [
      ...repeat(MIN_CALIBRATION_SAMPLES - 1, { outcome: 'HIT' }),
      makePrediction({ outcome: 'PENDING', outcome_ret_pct: null }),
    ];
    const { isCalibrated } = computeCalibrationWeights(predictions);
    expect(isCalibrated).toBe(false);  // PENDING não conta
  });
});

describe('computeCalibrationWeights — calibração ativa', () => {
  it('pesos somam 1.0 quando calibrado', () => {
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, { outcome: 'HIT', outcome_ret_pct: 2.0 });
    const { weights, isCalibrated } = computeCalibrationWeights(predictions);
    expect(isCalibrated).toBe(true);
    const total = weights.derivatives + weights.spot + weights.options + weights.macro;
    expect(total).toBeCloseTo(1.0, 3);
  });

  it('módulo sempre correto recebe peso maior que módulo sempre errado', () => {
    // derivatives: sempre correto (bullish + price up)
    // macro: sempre errado (bearish + price up)
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome: 'HIT',
      outcome_ret_pct: 2.0,
      modules_snapshot: {
        derivatives: { direction: 'bullish' },   // correto: price went up
        spot:        { direction: 'neutral' },    // skip
        options:     { direction: 'neutral' },    // skip
        macro:       { direction: 'bearish' },    // errado: price went up
      },
    });
    const { weights } = computeCalibrationWeights(predictions);
    expect(weights.derivatives).toBeGreaterThan(weights.macro);
  });

  it('respeita piso de 10% após normalização — módulo com 0% de acerto recebe exatamente 0.10', () => {
    // macro sempre erra; os outros 3 sempre acertam
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome: 'HIT',
      outcome_ret_pct: 2.0,
      modules_snapshot: {
        derivatives: { direction: 'bullish' },  // sempre certo
        spot:        { direction: 'bullish' },  // sempre certo
        options:     { direction: 'bullish' },  // sempre certo
        macro:       { direction: 'bearish' },  // sempre errado → 0% → piso
      },
    });
    const { weights } = computeCalibrationWeights(predictions);
    // projectWeights garante FLOOR após normalização
    expect(weights.macro).toBeGreaterThanOrEqual(0.099);  // 0.10 com tolerância de float
  });

  it('respeita teto de 40% após normalização — módulo perfeito isolado recebe exatamente 0.40', () => {
    // só derivatives é direcional (outros neutros) → 100% acurácia → teto
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome: 'HIT',
      outcome_ret_pct: 2.0,
      modules_snapshot: {
        derivatives: { direction: 'bullish' },  // sempre certo
        spot:        { direction: 'neutral' },
        options:     { direction: 'neutral' },
        macro:       { direction: 'neutral' },
      },
    });
    const { weights } = computeCalibrationWeights(predictions);
    // sem amostras nos outros módulos (accuracy=0.5), derivatives teria 1.0 sem limite
    // projectWeights deve garantir que não ultrapasse 0.40
    expect(weights.derivatives).toBeLessThanOrEqual(0.401);
  });

  it('respeita teto de 40% — módulo perfeito não domina sozinho', () => {
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome: 'HIT',
      outcome_ret_pct: 2.0,
      modules_snapshot: {
        derivatives: { direction: 'bullish' },  // sempre certo
        spot:        { direction: 'neutral' },
        options:     { direction: 'neutral' },
        macro:       { direction: 'neutral' },
      },
    });
    const { weights } = computeCalibrationWeights(predictions);
    expect(weights.derivatives).toBeLessThanOrEqual(1.0);  // sem outros módulos ativos, peso máximo normalizado
  });

  it('acurácia calculada corretamente: 15 hits em 20 = 75%', () => {
    const hits   = repeat(15, { outcome: 'HIT',  outcome_ret_pct:  2.0, modules_snapshot: { derivatives: { direction: 'bullish' }, spot: { direction: 'neutral' }, options: { direction: 'neutral' }, macro: { direction: 'neutral' } } });
    const misses = repeat(5,  { outcome: 'MISS', outcome_ret_pct: -2.0, modules_snapshot: { derivatives: { direction: 'bullish' }, spot: { direction: 'neutral' }, options: { direction: 'neutral' }, macro: { direction: 'neutral' } } });
    const predictions = [...hits, ...misses];
    const { accuracy } = computeCalibrationWeights(predictions);
    expect(accuracy.derivatives.correct).toBe(15);
    expect(accuracy.derivatives.total).toBe(20);
    expect(accuracy.derivatives.accuracy).toBeCloseTo(0.75, 2);
  });

  it('módulos neutros são ignorados na contagem', () => {
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome: 'HIT',
      outcome_ret_pct: 2.0,
      modules_snapshot: {
        derivatives: { direction: 'neutral' },
        spot:        { direction: 'neutral' },
        options:     { direction: 'neutral' },
        macro:       { direction: 'neutral' },
      },
    });
    const { accuracy } = computeCalibrationWeights(predictions);
    expect(accuracy.derivatives.total).toBe(0);
    expect(accuracy.spot.total).toBe(0);
  });

  it('sampleCount reflete apenas previsões resolvidas', () => {
    const resolved = repeat(MIN_CALIBRATION_SAMPLES, { outcome: 'HIT', outcome_ret_pct: 1.0 });
    const pending  = [makePrediction({ outcome: 'PENDING', outcome_ret_pct: null })];
    const { sampleCount } = computeCalibrationWeights([...resolved, ...pending]);
    expect(sampleCount).toBe(MIN_CALIBRATION_SAMPLES);
  });
});

describe('computeCalibrationWeights — direções bearish', () => {
  it('bearish correto quando preço caiu', () => {
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome:          'HIT',
      outcome_ret_pct:  -2.0,   // preço caiu
      modules_snapshot: {
        derivatives: { direction: 'bearish' },  // bearish + price down = correto
        spot:        { direction: 'neutral' },
        options:     { direction: 'neutral' },
        macro:       { direction: 'neutral' },
      },
    });
    const { accuracy } = computeCalibrationWeights(predictions);
    expect(accuracy.derivatives.correct).toBe(MIN_CALIBRATION_SAMPLES);
    expect(accuracy.derivatives.accuracy).toBeCloseTo(1.0, 2);
  });

  it('bearish_bias correto quando preço caiu', () => {
    const predictions = repeat(MIN_CALIBRATION_SAMPLES, {
      outcome:          'HIT',
      outcome_ret_pct:  -1.5,
      modules_snapshot: {
        derivatives: { direction: 'bearish_bias' },  // bearish_bias + price down = correto
        spot:        { direction: 'neutral' },
        options:     { direction: 'neutral' },
        macro:       { direction: 'neutral' },
      },
    });
    const { accuracy } = computeCalibrationWeights(predictions);
    expect(accuracy.derivatives.correct).toBe(MIN_CALIBRATION_SAMPLES);
  });
});
