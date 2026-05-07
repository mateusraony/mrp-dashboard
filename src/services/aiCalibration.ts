/**
 * aiCalibration.ts — calibra pesos dos módulos de análise com base no track record.
 *
 * Algoritmo:
 *   1. Lê previsões com outcome resolvido (HIT/MISS/PARTIAL) do histórico.
 *   2. Para cada módulo, conta quantas vezes a direção do módulo previu corretamente
 *      o movimento de preço (positivo = bullish; negativo = bearish).
 *   3. Converte acurácia → peso com piso 10% e teto 40%, normaliza para soma 1.0.
 *   4. Abaixo de MIN_CALIBRATION_SAMPLES retorna DEFAULT_WEIGHTS (equiponderado).
 */

import type { AiPrediction } from '@/services/aiPredictions';
import { type Direction, type ModuleWeights, DEFAULT_WEIGHTS } from '@/utils/ruleBasedAnalysis';

export const MIN_CALIBRATION_SAMPLES = 20;
const WEIGHT_FLOOR = 0.10;
const WEIGHT_CEIL  = 0.40;

const MODULES = ['derivatives', 'spot', 'options', 'macro'] as const;
type ModuleName = typeof MODULES[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModuleAccuracyEntry {
  correct:  number;
  total:    number;
  accuracy: number;  // 0–1
}

export interface ModuleAccuracy {
  derivatives: ModuleAccuracyEntry;
  spot:        ModuleAccuracyEntry;
  options:     ModuleAccuracyEntry;
  macro:       ModuleAccuracyEntry;
}

export interface CalibrationResult {
  weights:      ModuleWeights;
  accuracy:     ModuleAccuracy;
  sampleCount:  number;
  isCalibrated: boolean;  // false quando abaixo de MIN_CALIBRATION_SAMPLES
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyEntry(): ModuleAccuracyEntry {
  return { correct: 0, total: 0, accuracy: 0.5 };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function moduleDirection(snapshot: Record<string, unknown>, mod: ModuleName): Direction | null {
  const entry = snapshot[mod] as { direction?: Direction } | undefined;
  return entry?.direction ?? null;
}

/**
 * Retorna true se a direção do módulo previu corretamente o movimento de preço.
 * Retorna null se o módulo estava neutro (ignorar na contagem).
 */
function isModuleCorrect(dir: Direction, priceWentUp: boolean): boolean | null {
  if (dir === 'bullish' || dir === 'bullish_bias') return priceWentUp;
  if (dir === 'bearish' || dir === 'bearish_bias') return !priceWentUp;
  return null;
}

// ─── Calibração ───────────────────────────────────────────────────────────────

/**
 * computeCalibrationWeights — calcula pesos calibrados a partir do histórico.
 * Função pura: não faz I/O, fácil de testar.
 */
export function computeCalibrationWeights(predictions: AiPrediction[]): CalibrationResult {
  const accuracy: ModuleAccuracy = {
    derivatives: emptyEntry(),
    spot:        emptyEntry(),
    options:     emptyEntry(),
    macro:       emptyEntry(),
  };

  const evaluated = predictions.filter(
    p => p.outcome !== 'PENDING' && p.outcome_ret_pct != null && p.modules_snapshot != null,
  );

  if (evaluated.length < MIN_CALIBRATION_SAMPLES) {
    return { weights: DEFAULT_WEIGHTS, accuracy, sampleCount: evaluated.length, isCalibrated: false };
  }

  // Conta acertos e tentativas por módulo
  for (const pred of evaluated) {
    const priceWentUp = (pred.outcome_ret_pct ?? 0) > 0;
    const snapshot = pred.modules_snapshot as Record<string, unknown>;

    for (const mod of MODULES) {
      const dir = moduleDirection(snapshot, mod);
      if (!dir) continue;
      const correct = isModuleCorrect(dir, priceWentUp);
      if (correct === null) continue;  // neutro — não conta
      accuracy[mod].total++;
      if (correct) accuracy[mod].correct++;
    }
  }

  // Calcula taxa de acerto por módulo (fallback 0.5 se sem amostras)
  for (const mod of MODULES) {
    const { correct, total } = accuracy[mod];
    accuracy[mod].accuracy = total > 0 ? correct / total : 0.5;
  }

  // Aplica piso/teto e normaliza para soma = 1.0
  const clamped = {} as Record<ModuleName, number>;
  for (const mod of MODULES) {
    clamped[mod] = clamp(accuracy[mod].accuracy, WEIGHT_FLOOR, WEIGHT_CEIL);
  }
  const total = MODULES.reduce((sum, mod) => sum + clamped[mod], 0);

  const weights = MODULES.reduce((acc, mod) => {
    acc[mod] = parseFloat((clamped[mod] / total).toFixed(4));
    return acc;
  }, {} as ModuleWeights);

  return { weights, accuracy, sampleCount: evaluated.length, isCalibrated: true };
}
