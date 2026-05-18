/**
 * apiHealthMonitor.ts — Monitoramento de saúde das APIs externas.
 *
 * Rastreia quais fontes de dados estão em estado de falha.
 * Quando ≥3 fontes falham simultaneamente → dispara alerta crítico
 * via logError() que persiste automaticamente no Supabase system_logs.
 *
 * Throttle: máximo 1 log crítico por 30 minutos para evitar spam quando
 * APIs persistentemente falhas causam oscilações no contador.
 *
 * Uso:
 *   reportApiFailure('binance_futures')  // chamado pelo query-client ao detectar erro
 *   reportApiRecovery('binance_futures') // chamado ao sucesso
 *   getFailedCount()                     // número de fontes em falha agora
 */

import { logError, logWarn, logInfo } from './debugLog';

const CRITICAL_THRESHOLD      = 3;
const CRITICAL_LOG_INTERVAL   = 30 * 60 * 1000; // 30 min entre logs críticos

// Set de fontes atualmente em falha (sem duplicatas)
const _failedSources = new Set<string>();

// Throttle: timestamp do último logError crítico
let _lastCriticalLogAt = 0;

/**
 * Reporta falha de uma fonte de dados.
 * - Se ≥3 fontes falharam e passaram 30 min do último log → logError crítico
 * - Caso contrário → logWarn local (não persiste no Supabase)
 */
export function reportApiFailure(source: string): void {
  _failedSources.add(source);
  const count = _failedSources.size;

  if (count >= CRITICAL_THRESHOLD) {
    const now = Date.now();
    if (now - _lastCriticalLogAt > CRITICAL_LOG_INTERVAL) {
      _lastCriticalLogAt = now;
      logError(
        `CRÍTICO: ${count} APIs em fallback simultâneo`,
        { sources: Array.from(_failedSources), count },
        'health-monitor',
      );
    }
  } else {
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
