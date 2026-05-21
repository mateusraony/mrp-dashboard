/**
 * useInvestingCalendar.ts — Hook para eventos do Investing.com armazenados no Supabase
 *
 * Segue padrão DataState<T> obrigatório do CLAUDE.md:
 *   Fluxo 1 (online): withCache → isFallback=false
 *   Fluxo 2 (offline): getStaleCache → isFallback=true
 *
 * Os dados são coletados pelo GitHub Action a cada 30min nos dias úteis.
 * TTL de cache: 300s (5 min) — suficiente para evitar requisições excessivas.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { withCache, getStaleCache } from '@/services/marketCache';
import { logError } from '@/lib/debugLog';
import { reportApiFailure, reportApiRecovery } from '@/lib/apiHealthMonitor';
import {
  fetchInvestingCalendarEvents,
  type InvestingCalendarEvent,
} from '@/services/investingCalendarService';
import { type DataState } from '@/hooks/useBtcData';

// ─── queryFn compartilhada ────────────────────────────────────────────────────

async function queryFn(): Promise<DataState<InvestingCalendarEvent[]>> {
  try {
    const data = await withCache(
      'investing-calendar:events',
      300,
      'investing_calendar',
      fetchInvestingCalendarEvents,
    );
    reportApiRecovery('investing_calendar');
    return {
      data,
      lastUpdated: new Date().toISOString(),
      isFallback:  false,
      debugError:  null,
    };
  } catch (err) {
    logError('Investing calendar fetch failed', { error: String(err) }, 'investing-calendar');
    reportApiFailure('investing_calendar');

    const stale = await getStaleCache<InvestingCalendarEvent[]>('investing-calendar:events');
    if (stale) {
      return {
        data:        stale.value,
        lastUpdated: stale.updatedAt.toISOString(),
        isFallback:  true,
        debugError:  String(err),
      };
    }

    return {
      data:        null,
      lastUpdated: null,
      isFallback:  true,
      debugError:  String(err),
    };
  }
}

const QUERY_OPTIONS = {
  queryKey:      ['investingCalendar', 'events'] as const,
  queryFn,
  staleTime:     5 * 60_000,
  refetchInterval: IS_LIVE ? 5 * 60_000 : (false as const),
  retry:         2,
  retryDelay:    (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
};

// ─── useInvestingCalendar — retorna só o array (uso padrão) ───────────────────

/**
 * Retorna o array de eventos do Investing.com.
 * Retorna [] quando dados indisponíveis.
 */
export function useInvestingCalendar() {
  return useQuery<DataState<InvestingCalendarEvent[]>, Error, InvestingCalendarEvent[]>({
    ...QUERY_OPTIONS,
    select: (state) => state.data ?? [],
  });
}

// ─── useInvestingCalendarState — retorna DataState completo ──────────────────

/**
 * Retorna o DataState completo com isFallback, lastUpdated e debugError.
 * Útil para exibir indicadores visuais de staleness.
 */
export function useInvestingCalendarState() {
  return useQuery<DataState<InvestingCalendarEvent[]>, Error, DataState<InvestingCalendarEvent[]>>({
    ...QUERY_OPTIONS,
    select: (state) => state,
  });
}
