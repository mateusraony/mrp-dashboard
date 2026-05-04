/**
 * apiHealthMonitor.ts — Monitoramento de saúde das APIs externas.
 *
 * Rastreia quais fontes de dados estão em estado de falha.
 * Quando ≥3 fontes falham simultaneamente → dispara alerta crítico
 * via logError() que persiste automaticamente no Supabase system_logs.
 *
 * Uso:
 *   reportApiFailure('binance_futures')  // chamado pelo query-client ao detectar erro
 *   reportApiRecovery('binance_futures') // chamado ao sucesso
 *   getFailedCount()                     // número de fontes em falha agora
 */

import { logError, logWarn, logInfo } from './debugLog';

const CRITICAL_THRESHOLD = 3;

// Set de fontes atualmente em falha (sem duplicatas)
const _failedSources = new Set<string>();

// Evita spam de logError crítico: só loga quando o conjunto muda de estado
let _lastCriticalSize = 0;

/**
 * Reporta falha de uma fonte de dados.
 * - Se ≥3 fontes falharam → logError crítico (persiste no Supabase)
 * - Caso contrário → logWarn local
 */
export function reportApiFailure(source: string): void {
  _failedSources.add(source);
  const count = _failedSources.size;

  if (count >= CRITICAL_THRESHOLD && count !== _lastCriticalSize) {
    _lastCriticalSize = count;
    logError(
      `CRÍTICO: ${count} APIs em fallback simultâneo`,
      { sources: Array.from(_failedSources), count },
      'health-monitor',
    );
  } else if (count < CRITICAL_THRESHOLD) {
    logWarn(`API em fallback: ${source}`, { total_failed: count }, 'health-monitor');
  }
}

/**
 * Reporta recuperação de uma fonte de dados.
 * Loga info quando o sistema sai do estado crítico.
 */
export function reportApiRecovery(source: string): void {
  const wasAboveThreshold = _failedSources.size >= CRITICAL_THRESHOLD;
  _failedSources.delete(source);
  const count = _failedSources.size;

  if (wasAboveThreshold && count < CRITICAL_THRESHOLD) {
    _lastCriticalSize = count;
    logInfo(
      `Sistema saiu do estado crítico: ${count} fonte(s) em falha`,
      { sources: Array.from(_failedSources) },
      'health-monitor',
    );
  }
}

/** Retorna cópia das fontes atualmente com falha. */
export function getFailedSources(): string[] {
  return Array.from(_failedSources);
}

/** Retorna número de fontes com falha. */
export function getFailedCount(): number {
  return _failedSources.size;
}

/** true quando ≥3 fontes estão em falha. */
export function isCritical(): boolean {
  return _failedSources.size >= CRITICAL_THRESHOLD;
}
