/**
 * useMacroCalendar.ts — Hook TanStack Query para o Calendário Macro
 *
 * Em live mode: refetch a cada 1 hora (release dates não mudam com frequência).
 * Em mock mode: sem refetch automático.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import {
  fetchMacroCalendarEvents,
  fetchAlertPreferences,
  upsertAlertPreference,
} from '@/services/macroCalendarService';

// Sentinel UUID anônimo — persiste em localStorage para identificar o usuário sem auth real
const SENTINEL_KEY = 'mrp_user_sentinel';
function getUserSentinel(): string {
  let s = localStorage.getItem(SENTINEL_KEY);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(SENTINEL_KEY, s);
  }
  return s;
}

// ─── Hook principal: eventos do calendário ────────────────────────────────────

export function useMacroCalendar() {
  return useQuery({
    queryKey:        ['macroCalendar', 'events'],
    queryFn:         fetchMacroCalendarEvents,
    staleTime:       30 * 60_000,
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           2,
    retryDelay:      (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
  });
}

// ─── Hook de preferências de alerta (persistido em Supabase) ─────────────────

export function useMacroAlertPreferences() {
  const sentinel = getUserSentinel();
  return useQuery({
    queryKey:  ['macroAlertPrefs', sentinel],
    queryFn:   () => fetchAlertPreferences(sentinel),
    staleTime: 5 * 60_000,
    retry:     1,
  });
}

// ─── Mutation: toggle de alerta com persistência imediata ────────────────────

export function useToggleMacroAlert() {
  const qc       = useQueryClient();
  const sentinel = getUserSentinel();

  return useMutation({
    mutationFn: async ({
      eventCode,
      alertEnabled,
      alertMinutesBefore = 30,
    }: {
      eventCode:          string;
      alertEnabled:       boolean;
      alertMinutesBefore?: number;
    }) => {
      await upsertAlertPreference(sentinel, eventCode, alertEnabled, alertMinutesBefore);
      return { eventCode, alertEnabled, alertMinutesBefore };
    },

    // Optimistic update: atualiza cache local imediatamente
    onMutate: async ({ eventCode, alertEnabled, alertMinutesBefore = 30 }) => {
      await qc.cancelQueries({ queryKey: ['macroAlertPrefs', sentinel] });

      const prev = qc.getQueryData<Map<string, { alert_enabled: boolean; alert_minutes_before: number }>>(
        ['macroAlertPrefs', sentinel],
      );

      qc.setQueryData<Map<string, { alert_enabled: boolean; alert_minutes_before: number }>>(
        ['macroAlertPrefs', sentinel],
        (old) => {
          const next = new Map(old ?? []);
          next.set(eventCode, { alert_enabled: alertEnabled, alert_minutes_before: alertMinutesBefore });
          return next;
        },
      );

      return { prev };
    },

    // Rollback em caso de erro
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['macroAlertPrefs', sentinel], ctx.prev);
      }
    },

    // Refetch para garantir sincronismo com DB
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['macroAlertPrefs', sentinel] });
    },
  });
}
