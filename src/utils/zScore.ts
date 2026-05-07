/**
 * zScore.ts — cálculo e interpretação de Z-score para alertas estatísticos
 *
 * Funções puras, sem I/O. Usadas para detectar leituras anômalas
 * (retorno diário, volume) comparadas com os últimos 30 candles.
 */

export type ZScoreLevel = 'extreme' | 'elevated' | 'normal';
export type ZScoreDirection = 'bullish' | 'bearish' | 'neutral';

export interface ZScoreInterpretation {
  level:     ZScoreLevel;
  direction: ZScoreDirection;
  label:     string;   // e.g. "EXTREMO ▲" | "ELEVADO ▼" | "NORMAL"
}

export interface ZScoreAlert {
  metric:    'return' | 'volume';
  label:     string;       // "Retorno 1D" | "Volume 1D"
  z:         number;       // e.g. 2.3
  level:     ZScoreLevel;
  direction: ZScoreDirection;
  value:     number;       // valor atual (retorno decimal ou volume USD)
  histMean:  number;       // média histórica
}

// Thresholds
const EXTREME_Z  = 2.0;
const ELEVATED_Z = 1.0;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stddev(values: number[], mu?: number): number {
  if (values.length < 2) return 0;
  const m = mu ?? mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calcula o Z-score de `current` em relação à distribuição de `history`.
 * Retorna 0 se histórico insuficiente (< 3 pontos) ou desvio padrão zero.
 */
export function computeZScore(history: number[], current: number): number {
  if (history.length < 3) return 0;
  const mu = mean(history);
  const sd = stddev(history, mu);
  if (sd === 0) return 0;
  return (current - mu) / sd;
}

export function interpretZScore(z: number, positiveIsBullish = true): ZScoreInterpretation {
  const absZ = Math.abs(z);

  let level: ZScoreLevel;
  if (absZ >= EXTREME_Z)  level = 'extreme';
  else if (absZ >= ELEVATED_Z) level = 'elevated';
  else level = 'normal';

  let direction: ZScoreDirection;
  if (positiveIsBullish) {
    direction = z > 0 ? 'bullish' : z < 0 ? 'bearish' : 'neutral';
  } else {
    direction = 'neutral';
  }

  const levelLabel = level === 'extreme' ? 'EXTREMO' : level === 'elevated' ? 'ELEVADO' : 'NORMAL';
  const dirLabel   = direction === 'bullish' ? ' ▲' : direction === 'bearish' ? ' ▼' : '';
  const label      = `${levelLabel}${dirLabel}`;

  return { level, direction, label };
}

/**
 * Constrói alertas Z-score a partir de um array de candles 1D.
 * Espera pelo menos 4 candles (3 histórico + 1 atual).
 * Retorna apenas alertas com level !== 'normal'.
 */
export function buildZScoreAlerts(candles: Array<{ open: number; close: number; volume: number }>): ZScoreAlert[] {
  if (candles.length < 4) return [];

  const history = candles.slice(0, -1);  // todos exceto o último (em formação)
  const current = candles[candles.length - 1];

  // Retorno: (close - open) / open
  const histReturns = history.map(c => c.open > 0 ? (c.close - c.open) / c.open : 0);
  const currReturn  = current.open > 0 ? (current.close - current.open) / current.open : 0;
  const retZ        = computeZScore(histReturns, currReturn);

  // Volume em USD (volume * close como proxy)
  const histVolumes = history.map(c => c.volume * c.close);
  const currVolume  = current.volume * current.close;
  const volZ        = computeZScore(histVolumes, currVolume);

  const alerts: ZScoreAlert[] = [];

  const retInterp = interpretZScore(retZ, true);
  if (retInterp.level !== 'normal') {
    alerts.push({
      metric:    'return',
      label:     'Retorno 1D',
      z:         retZ,
      level:     retInterp.level,
      direction: retInterp.direction,
      value:     currReturn,
      histMean:  mean(histReturns),
    });
  }

  // Volume: z positivo = volume alto (amplifica direção do retorno)
  const volDirection: ZScoreDirection =
    Math.abs(volZ) >= ELEVATED_Z
      ? (currReturn >= 0 ? 'bullish' : 'bearish')
      : 'neutral';
  const volInterp = interpretZScore(volZ, false);
  if (volInterp.level !== 'normal') {
    alerts.push({
      metric:    'volume',
      label:     'Volume 1D',
      z:         volZ,
      level:     volInterp.level,
      direction: volDirection,
      value:     currVolume,
      histMean:  mean(histVolumes),
    });
  }

  return alerts;
}
