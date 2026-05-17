/**
 * useEventVolatility.ts — Volatilidade BTC ao redor de eventos macro (Binance klines).
 *
 * Para cada evento passado com `actual !== null`, busca klines 1h da Binance
 * no intervalo [eventMs - 2h, eventMs + 25h] e computa janelas de movimento.
 *
 * Ativado apenas em IS_LIVE=true. Retorna array vazio quando desativado.
 * Cache: staleTime 1h (releases passados não mudam).
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchKlinesAt } from '@/services/binance';
import {
  computeEventVolatilityRow,
  computeAvgVolatility,
  type EventVolatilityRow,
  type AvgVolatilityRow,
  type MacroEventInput,
} from '@/utils/eventVolatility';

const HOUR_MS = 3_600_000;

export interface EventVolatilityResult {
  rows:   EventVolatilityRow[];
  avg:    AvgVolatilityRow[];
  source: 'live' | 'empty';
}

/**
 * useEventVolatility — hook principal.
 *
 * @param pastEvents  eventos passados com actual !== null (tipicamente ≤10)
 */
export function useEventVolatility(pastEvents: MacroEventInput[]) {
  const eligible = pastEvents.filter(e => e.actual !== null);

  return useQuery<EventVolatilityResult>({
    queryKey: ['event-vol', eligible.map(e => `${e.code}|${e.datetime_utc}`).join(',')],
    queryFn:  async (): Promise<EventVolatilityResult> => {
      if (eligible.length === 0) return { rows: [], avg: [], source: 'empty' };

      const settled = await Promise.allSettled(
        eligible.map(async ev => {
          const eventMs = new Date(ev.datetime_utc).getTime();
          const klines  = await fetchKlinesAt(
            'BTCUSDT', '1h',
            eventMs - 2 * HOUR_MS,
            eventMs + 25 * HOUR_MS,
            30,
          );
          return computeEventVolatilityRow(ev, klines);
        }),
      );

      const rows: EventVolatilityRow[] = settled
        .filter((r): r is PromiseFulfilledResult<EventVolatilityRow | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((r): r is EventVolatilityRow => r !== null);

      return {
        rows,
        avg:    computeAvgVolatility(rows),
        source: rows.length > 0 ? 'live' : 'empty',
      };
    },
    enabled:       IS_LIVE && eligible.length > 0,
    staleTime:     60 * 60_000,   // 1 hora — dados históricos não mudam
    refetchInterval: false,
    retry:         1,
  });
}
