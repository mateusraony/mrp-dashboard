/**
 * useAiHealthCheck — probe leve à Edge Function ai-analysis.
 * Faz uma chamada mínima ao montar (IS_LIVE + Supabase configurado).
 * Resultado exposto globalmente via módulo singleton para o header e DebugPanel.
 */

import { useEffect, useState } from 'react';
import { IS_LIVE, env } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { logInfo, logError } from '@/lib/debugLog';

export type AiHealthStatus = 'disabled' | 'loading' | 'ok' | 'error';

export interface AiHealthState {
  status:     AiHealthStatus;
  latencyMs:  number | null;
  error:      string | null;
  checkedAt:  string | null;
}

// ─── Singleton para compartilhar estado entre componentes ──────────────────────

let _state: AiHealthState = { status: 'disabled', latencyMs: null, error: null, checkedAt: null };
let _listeners: Array<(s: AiHealthState) => void> = [];

function setState(next: AiHealthState) {
  _state = next;
  _listeners.forEach(fn => fn(next));
}

function subscribe(fn: (s: AiHealthState) => void) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

// ─── Probe (chamada com payload mínimo) ────────────────────────────────────────

let _probed = false;

export async function probeAiHealth(): Promise<void> {
  if (_probed) return;
  if (!IS_LIVE || !isSupabaseConfigured()) {
    setState({ status: 'disabled', latencyMs: null, error: null, checkedAt: null });
    return;
  }
  _probed = true;
  setState({ status: 'loading', latencyMs: null, error: null, checkedAt: null });

  const baseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key     = env.VITE_SUPABASE_ANON_KEY;
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseUrl}/functions/v1/ai-analysis`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body:    JSON.stringify({ riskScore: 50, riskRegime: 'NEUTRO', fearGreedValue: 50, fearGreedLabel: 'Neutral', fundingRate: 0, page: 'health_check' }),
      signal:  AbortSignal.timeout(12_000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as Record<string, unknown>));
      const msg = `HTTP ${res.status}: ${(err.error as string | undefined) ?? res.statusText}`;
      setState({ status: 'error', latencyMs, error: msg, checkedAt: new Date().toISOString() });
      logError('Claude AI health check failed', { msg }, 'ai-health');
      return;
    }
    setState({ status: 'ok', latencyMs, error: null, checkedAt: new Date().toISOString() });
    logInfo(`Claude AI online · ${latencyMs}ms`, { latencyMs }, 'ai-health');
  } catch (e) {
    const latencyMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    setState({ status: 'error', latencyMs, error: msg, checkedAt: new Date().toISOString() });
    logError('Claude AI health check exception', { msg }, 'ai-health');
    _probed = false; // permite retry em próxima montagem
  }
}

// ─── Hook React ───────────────────────────────────────────────────────────────

export function useAiHealthCheck(): AiHealthState {
  const [state, setLocalState] = useState<AiHealthState>(_state);

  useEffect(() => {
    setLocalState(_state);
    const unsub = subscribe(setLocalState);
    probeAiHealth();
    return unsub;
  }, []);

  return state;
}
