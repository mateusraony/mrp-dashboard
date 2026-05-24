/**
 * investingCalendarService.ts — Lê eventos do Investing.com armazenados no Supabase
 *
 * Os dados são coletados pelo GitHub Action scripts/fetch-investing-calendar.mjs
 * e persistidos na tabela economic_calendar_events (apenas importância 3 ★★★).
 *
 * Leitura pública via anon key — sem service_role necessário.
 */

import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { logWarn } from '@/lib/debugLog';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface InvestingCalendarEvent {
  id:           string;
  source:       string;
  event_id:     string | null;
  country:      string | null;
  currency:     string | null;
  title:        string;
  datetime_utc: string;
  datetime_brt: string | null;
  importance:   number;
  actual:       string | null;
  forecast:     string | null;
  previous:     string | null;
  unit:         string | null;
  status:       'scheduled' | 'released' | 'revised' | 'failed';
  ai_analysis:  string | null;
  ai_probability: number | null;
  ai_direction: 'up' | 'down' | 'neutral' | null;
  notify_state: 'pending' | 'pre_sent' | 'post_sent' | null;
  fetched_at:   string;
  source_url:   string | null;
  created_at:   string;
  updated_at:   string;
}

export interface InvestingCalendarMeta {
  lastFetchedAt:  string | null;
  totalEvents:    number;
  upcomingCount:  number;
  releasedCount:  number;
  fetchStatus:    'live' | 'stale' | 'empty';
}

// ─── Schema Zod ───────────────────────────────────────────────────────────────

const InvestingEventSchema = z.object({
  id:             z.string(),
  source:         z.string().default('investing.com'),
  event_id:       z.string().nullable().optional().transform(v => v ?? null),
  country:        z.string().nullable().optional().transform(v => v ?? null),
  currency:       z.string().nullable().optional().transform(v => v ?? null),
  title:          z.string(),
  datetime_utc:   z.string(),
  datetime_brt:   z.string().nullable().optional().transform(v => v ?? null),
  importance:     z.number().int().min(1).max(3).default(3),
  actual:         z.string().nullable().optional().transform(v => v ?? null),
  forecast:       z.string().nullable().optional().transform(v => v ?? null),
  previous:       z.string().nullable().optional().transform(v => v ?? null),
  unit:           z.string().nullable().optional().transform(v => v ?? null),
  status:         z.enum(['scheduled', 'released', 'revised', 'failed']).default('scheduled'),
  ai_analysis:    z.string().nullable().optional().transform(v => v ?? null),
  ai_probability: z.number().nullable().optional().transform(v => v ?? null),
  ai_direction:   z.enum(['up', 'down', 'neutral']).nullable().optional().transform(v => v ?? null),
  notify_state:   z.enum(['pending', 'pre_sent', 'post_sent']).nullable().optional().transform(v => v ?? null),
  fetched_at:     z.string(),
  source_url:     z.string().nullable().optional().transform(v => v ?? null),
  created_at:     z.string(),
  updated_at:     z.string(),
});

const InvestingEventsArraySchema = z.array(InvestingEventSchema);

// ─── Helpers de URL ───────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const key = env.VITE_SUPABASE_ANON_KEY ?? '';
  return {
    apikey:        key,
    Authorization: `Bearer ${key}`,
    Accept:        'application/json',
  };
}

function getSupabaseUrl(): string {
  const url = env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL não configurado');
  return url;
}

// ─── fetchInvestingCalendarEvents ─────────────────────────────────────────────

/**
 * Busca eventos econômicos do Supabase (últimas 3 semanas + próximas 3 semanas).
 * Fontes: ForexFactory (USD/EUR/GBP/JPY/NZD/CNY) + IBGE/BCB (BRL).
 * Inclui importance 2 e 3 — filtro de importância na query.
 * Ordenado por datetime_utc ASC. Máximo 300 eventos.
 */
export async function fetchInvestingCalendarEvents(): Promise<InvestingCalendarEvent[]> {
  const supabaseUrl = getSupabaseUrl();
  // 21 dias atrás → 21 dias à frente garante cobertura de 3 semanas passadas + 3 futuras
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const ceiling = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${supabaseUrl}/rest/v1/economic_calendar_events`
    + `?datetime_utc=gte.${encodeURIComponent(cutoff)}`
    + `&datetime_utc=lte.${encodeURIComponent(ceiling)}`
    + `&importance=gte.2`
    + `&order=datetime_utc.asc`
    + `&limit=300`;

  const res = await apiFetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404) {
      logWarn('economic_calendar_events: tabela não encontrada (404) — migração pendente', null, 'investing-calendar');
      return [];
    }
    throw new Error(`Supabase economic_calendar_events falhou: ${res.status} — ${text}`);
  }

  const raw: unknown = await res.json();

  const parsed = InvestingEventsArraySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Schema inválido em economic_calendar_events: ${parsed.error.message}`);
  }

  // Retorna importance >= 2: inclui eventos ★★ e ★★★ de todas as fontes
  return (parsed.data as InvestingCalendarEvent[]).filter(e => e.importance >= 2);
}

// ─── fetchInvestingCalendarMeta ───────────────────────────────────────────────

/**
 * Retorna metadados sobre a última coleta: quando foi, quantos eventos, etc.
 */
export async function fetchInvestingCalendarMeta(): Promise<InvestingCalendarMeta> {
  const supabaseUrl = getSupabaseUrl();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${supabaseUrl}/rest/v1/economic_calendar_events`
    + `?datetime_utc=gte.${encodeURIComponent(cutoff)}`
    + `&order=fetched_at.desc`
    + `&limit=50`
    + `&select=datetime_utc,status,fetched_at`;

  const res = await apiFetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    return {
      lastFetchedAt: null,
      totalEvents:   0,
      upcomingCount: 0,
      releasedCount: 0,
      fetchStatus:   'empty',
    };
  }

  const rows: Array<{ datetime_utc: string; status: string; fetched_at: string }> =
    await res.json().catch(() => []);

  if (rows.length === 0) {
    return {
      lastFetchedAt: null,
      totalEvents:   0,
      upcomingCount: 0,
      releasedCount: 0,
      fetchStatus:   'empty',
    };
  }

  const lastFetchedAt = rows[0]?.fetched_at ?? null;
  const totalEvents   = rows.length;
  const upcomingCount = rows.filter(r => new Date(r.datetime_utc) > now).length;
  const releasedCount = rows.filter(r => r.status === 'released').length;

  // "stale" se a última coleta foi há mais de 2h
  const ageMs = lastFetchedAt ? now.getTime() - new Date(lastFetchedAt).getTime() : Infinity;
  const fetchStatus: 'live' | 'stale' | 'empty' =
    totalEvents === 0 ? 'empty' : ageMs > 2 * 60 * 60 * 1000 ? 'stale' : 'live';

  return { lastFetchedAt, totalEvents, upcomingCount, releasedCount, fetchStatus };
}
