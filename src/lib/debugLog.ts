/**
 * debugLog.ts — Store in-memory de logs para diagnóstico em produção.
 * Intercepta window.onerror e unhandledrejection automaticamente.
 * Máximo de 100 entradas (FIFO). Não suprime os consoles originais.
 */

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  detail?: string;
  timestamp: string;
  source?: string;
}

// ─── Store interno ────────────────────────────────────────────────────────────

const MAX_ENTRIES = 100;
const _logs: LogEntry[] = [];
const _subscribers: Array<(entry: LogEntry) => void> = [];

// Referências aos consoles originais (antes de qualquer monkey-patch)
const _origError = console.error.bind(console);
const _origWarn  = console.warn.bind(console);
const _origInfo  = console.info.bind(console);

// ─── Geração de ID simples ───────────────────────────────────────────────────

let _counter = 0;
function _genId(): string {
  return `dbg-${Date.now()}-${++_counter}`;
}

// ─── Serialização de detail ──────────────────────────────────────────────────

function _serializeDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null) return undefined;
  if (detail instanceof Error) {
    return `${detail.name}: ${detail.message}${detail.stack ? `\n${detail.stack}` : ''}`;
  }
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

// ─── Adição de entrada ────────────────────────────────────────────────────────

function _addEntry(level: LogLevel, message: string, detail?: unknown, source?: string): void {
  const entry: LogEntry = {
    id:        _genId(),
    level,
    message,
    detail:    _serializeDetail(detail),
    timestamp: new Date().toISOString(),
    source,
  };

  // FIFO: remove a entrada mais antiga se atingir o limite
  if (_logs.length >= MAX_ENTRIES) {
    _logs.shift();
  }
  _logs.push(entry);

  // Notifica subscribers
  for (const cb of _subscribers) {
    try { cb(entry); } catch { /* ignora erros em callbacks */ }
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/** Registra erro e também chama console.error original. */
export function logError(message: string, detail?: unknown, source?: string): void {
  _origError(`[DebugLog][error]${source ? ` [${source}]` : ''} ${message}`, detail ?? '');
  _addEntry('error', message, detail, source);
}

/** Registra aviso e também chama console.warn original. */
export function logWarn(message: string, detail?: unknown, source?: string): void {
  _origWarn(`[DebugLog][warn]${source ? ` [${source}]` : ''} ${message}`, detail ?? '');
  _addEntry('warn', message, detail, source);
}

/** Registra informação e também chama console.info original. */
export function logInfo(message: string, detail?: unknown, source?: string): void {
  _origInfo(`[DebugLog][info]${source ? ` [${source}]` : ''} ${message}`, detail ?? '');
  _addEntry('info', message, detail, source);
}

/** Retorna cópia do array de logs (mais recente por último). */
export function getLogs(): LogEntry[] {
  return [..._logs];
}

/** Remove todos os logs do store. */
export function clearLogs(): void {
  _logs.length = 0;
}

/**
 * Assina novos logs. Retorna função de unsubscribe.
 * @example
 *   const unsub = onLogAdded((entry) => console.log(entry));
 *   // depois:
 *   unsub();
 */
export function onLogAdded(cb: (entry: LogEntry) => void): () => void {
  _subscribers.push(cb);
  return () => {
    const idx = _subscribers.indexOf(cb);
    if (idx !== -1) _subscribers.splice(idx, 1);
  };
}

// ─── Interceptação global de erros não tratados ──────────────────────────────

if (typeof window !== 'undefined') {
  // Erros síncronos não capturados
  const _prevOnerror = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = typeof message === 'string' ? message : 'Uncaught error';
    const detail = error ?? { source, lineno, colno };
    _addEntry('error', msg, detail, 'window.onerror');
    // Encadeia handler anterior se existir
    if (typeof _prevOnerror === 'function') {
      return _prevOnerror.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  // Promises rejeitadas sem .catch()
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Unhandled promise rejection';
    _addEntry('error', msg, reason, 'unhandledrejection');
  });
}
