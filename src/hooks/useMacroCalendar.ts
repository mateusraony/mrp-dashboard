/**
 * useMacroCalendar.ts — Hook TanStack Query para o Calendário Macro
 *
 * Em live mode: refetch a cada 1 hora (release dates não mudam com frequência).
 * Em mock mode: sem refetch automático.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchMacroCalendarEvents } from '@/services/macroCalendarService';

export function useMacroCalendar() {
  return useQuery({
    queryKey:        ['macroCalendar', 'events'],
    queryFn:         fetchMacroCalendarEvents,
    staleTime:       30 * 60_000,                      // 30 min
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,   // 1h em live mode
    retry:           2,
    retryDelay:      (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
  });
}
