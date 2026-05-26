/**
 * useMacroCalendarSummary.ts — Hook para o botão "Resumo AI" do Calendário Macro
 *
 * Recebe os eventos já carregados pelo componente pai e dispara a Edge Function
 * ai-analysis com page='macro_calendar' apenas quando o usuário solicita.
 *
 * Estado `requested` começa false e vira true ao chamar `request()`.
 * O cache de 30 minutos é identificado por timeBucket para evitar chamadas repetidas
 * ao mesmo "slot de tempo".
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type InvestingCalendarEvent } from '@/services/investingCalendarService';
import { fetchAiInsight } from '@/services/aiInsight';

// ─── Helpers de data (BRT = UTC-3) ────────────────────────────────────────────

/** Retorna o início do dia atual em BRT como string ISO (meia-noite UTC-3). */
function getBrtDayStart(): Date {
  const now = new Date();
  // Converte para BRT subtraindo 3h, pega o início do dia em UTC, depois soma 3h de volta
  const brtOffset = 3 * 60 * 60 * 1000;
  const brtNow    = new Date(now.getTime() - brtOffset);
  const brtMidnight = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()));
  // Converte o início do dia BRT de volta para UTC
  return new Date(brtMidnight.getTime() + brtOffset);
}

/** Retorna o fim do dia atual em BRT. */
function getBrtDayEnd(): Date {
  return new Date(getBrtDayStart().getTime() + 24 * 60 * 60 * 1000);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMacroCalendarSummary(events: InvestingCalendarEvent[]) {
  const [requested, setRequested] = useState(false);
  const queryClient = useQueryClient();

  // Bucket de 30 minutos — muda o queryKey a cada 30 min, forçando refetch natural
  const timeBucket = Math.floor(Date.now() / (30 * 60_000));

  const query = useQuery({
    queryKey: ['macro-calendar-summary', timeBucket],
    enabled: requested && events.length > 0,
    staleTime: 30 * 60_000,
    retry: 1,

    queryFn: async (): Promise<string> => {
      const now       = new Date();
      const dayStart  = getBrtDayStart();
      const dayEnd    = getBrtDayEnd();

      // Eventos liberados hoje (BRT): status 'released' ou actual preenchido
      const calendarEventsToday = events
        .filter(e => {
          const dt = new Date(e.datetime_utc);
          return dt >= dayStart && dt < dayEnd && (e.status === 'released' || e.actual !== null);
        })
        .map(e => ({
          title:    e.title,
          actual:   e.actual,
          forecast: e.forecast,
          currency: e.currency ?? '—',
          // Surpresa simples: se actual e forecast são números, calcula a diferença
          surprise: (e.actual != null && e.forecast != null)
            ? (() => {
                const a = parseFloat(e.actual.replace('%', '').replace(',', '.'));
                const f = parseFloat(e.forecast.replace('%', '').replace(',', '.'));
                if (!isNaN(a) && !isNaN(f)) {
                  const diff = a - f;
                  return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`;
                }
                return undefined;
              })()
            : undefined,
        }));

      // Próximos 5 eventos futuros ordenados por datetime_utc ASC
      const calendarUpcoming = events
        .filter(e => new Date(e.datetime_utc) > now)
        .sort((a, b) => new Date(a.datetime_utc).getTime() - new Date(b.datetime_utc).getTime())
        .slice(0, 5)
        .map(e => ({
          title:        e.title,
          datetime_brt: e.datetime_brt,
          forecast:     e.forecast,
          previous:     e.previous,
          currency:     e.currency ?? '—',
        }));

      return fetchAiInsight({
        // Campos obrigatórios do payload — valores neutros pois o prompt macro_calendar
        // não os utiliza, mas a interface exige que estejam presentes
        riskScore:      0,
        riskRegime:     '—',
        fearGreedValue: 0,
        fearGreedLabel: '—',
        fundingRate:    0,
        page:           'macro_calendar',
        context: {
          calendarEventsToday,
          calendarUpcoming,
        },
      });
    },
  });

  /** Solicita o resumo pela primeira vez (ativa o useQuery). */
  const request = useCallback(() => {
    setRequested(true);
  }, []);

  /** Força um novo resumo invalidando o cache da query. */
  const refresh = useCallback(() => {
    setRequested(true);
    queryClient.invalidateQueries({ queryKey: ['macro-calendar-summary', timeBucket] });
  }, [queryClient, timeBucket]);

  return {
    summary:       query.data ?? null,
    isLoading:     query.isLoading || query.isFetching,
    isError:       query.isError,
    error:         query.error instanceof Error ? query.error.message : null,
    dataUpdatedAt: query.dataUpdatedAt,
    request,
    refresh,
  };
}
