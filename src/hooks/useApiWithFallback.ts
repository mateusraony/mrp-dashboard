/**
 * Hook genérico: tenta API real, fallback para cache Supabase com timestamp.
 * Em falha: loga no debugLog com motivo, retorna último valor conhecido.
 */
import { useState, useEffect, useRef } from 'react';
import { withSWR } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';

export interface ApiWithFallbackResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;          // true = dado vem do cache, API falhou
  lastUpdated: Date | null;  // quando o dado foi capturado
  error: string | null;
}

export function useApiWithFallback<T>(
  cacheKey: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
  validate?: (v: unknown) => boolean,
  refreshIntervalMs = 60_000,
): ApiWithFallbackResult<T> {
  const [state, setState] = useState<ApiWithFallbackResult<T>>({
    data: null,
    isLoading: true,
    isStale: false,
    lastUpdated: null,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const result = await withSWR(cacheKey, ttlSec, 'api', fetcher, validate ? (v) => (validate(v) ? (v as T) : null) : undefined);
      setState({
        data: result,
        isLoading: false,
        isStale: false,
        lastUpdated: new Date(),
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(`[${cacheKey}] API falhou — usando cache Supabase. Motivo: ${msg}`, err, 'useApiWithFallback');
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStale: true,
        error: msg,
      }));
    }
  }

  useEffect(() => {
    load();
    if (refreshIntervalMs > 0) {
      timerRef.current = setInterval(load, refreshIntervalMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return state;
}
