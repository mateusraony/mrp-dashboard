/**
 * debugLog.ts — Store in-memory de logs para diagnóstico em produção.
 * Intercepta window.onerror e unhandledrejection automaticamente.
 * Máximo de 100 entradas (FIFO). Não suprime os consoles originais.
 *
 * Erros (level='error') são persistidos no Supabase via raw fetch
 * quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configurados.
 * Usa raw fetch para evitar dependência circular com services/supabase.ts.
 */

export type LogLevel = 'error' | 'warn' | 'info';

// ─── Persistência Supabase (raw fetch, sem import circular) ──────────────────

const _SUP_URL = (typeof import.meta !== 'undefined'
  ? (import.meta as Record<string, unknown>).env as Record<string, string>
  : {}) as Record<string, string>;

const _supUrl = _SUP_URL?.VITE_SUPABASE_URL ?? '';
const _supKey = _SUP_URL?.VITE_SUPABASE_ANON_KEY ?? '';

// ID único por sessão de browser para correlacionar logs
const _sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID().slice(0, 8)
  : Math.random().toString(36).slice(2, 10);

async function _persistError(entry: {
  level: string;
  message: string;
  source?: string;
  detail?: string;
}): Promise<void> {
  if (!_supUrl || !_supKey) return;
  try {
    await fetch(`${_supUrl}/rest/v1/system_logs`, {
      method: 'POST',
      headers: {
        apikey:          _supKey,
        Authorization:   `Bearer ${_supKey}`,
        'Content-Type':  'application/json',
        Prefer:          'return=minimal',
      },
      body: JSON.stringify({ ...entry, session_id: _sessionId }),
    });
  } catch {
    // Silencia falhas de persistência para evitar loop infinito
  }
}

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

/** Registra erro, chama console.error original e persiste no Supabase (fire-and-forget). */
export function logError(message: string, detail?: unknown, source?: string): void {
  _origError(`[DebugLog][error]${source ? ` [${source}]` : ''} ${message}`, detail ?? '');
  _addEntry('error', message, detail, source);
  // Persiste no Supabase de forma assíncrona (não bloqueia, não propaga erros)
  const serialized = _serializeDetail(detail);
  void _persistError({ level: 'error', message, source, detail: serialized });
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
