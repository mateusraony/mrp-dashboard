/**
 * macro-actual-fetcher — Edge Function Supabase (Deno)
 *
 * Job agendado (pg_cron a cada 15 min) que:
 *   1. Consulta v_macro_actual_pending → eventos released sem actual
 *   2. Busca o valor real no FRED via série da série associada
 *   3. Atualiza macro_event_schedule.actual, actual_source, actual_updated_at
 *   4. Registra execução em system_job_log
 *
 * Requer secrets Supabase:
 *   FRED_API_KEY          — chave FRED St. Louis (gratuita: fred.stlouisfed.org/docs/api/api_key.html)
 *   SUPABASE_URL          — injetado automaticamente
 *   SUPABASE_SERVICE_ROLE_KEY — injetado automaticamente
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Séries FRED que exigem cálculo MoM (são índices, não variações diretas)
const MOM_SERIES = new Set(['CPIAUCSL', 'PCEPI', 'PPIACO', 'RSXFS', 'PAYEMS']);

interface PendingEvent {
  id:              string;
  event_code:      string;
  release_time_utc: string;
  fred_series:     string | null;
  retry_count:     number;
  event_name:      string;
}

interface FredObservation {
  date:  string;
  value: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', correlationId: string, msg: string, data?: unknown) {
  console.log(JSON.stringify({ level, correlationId, msg, data, ts: new Date().toISOString() }));
}

async function fetchFredObservations(
  seriesId: string,
  releaseDateUtc: string,
  fredApiKey: string,
): Promise<{ value: number | null; date: string | null; error: string | null }> {
  // Busca as 3 observações mais recentes até a data de release
  const releaseDate = releaseDateUtc.slice(0, 10);

  const params = new URLSearchParams({
    series_id:    seriesId,
    api_key:      fredApiKey,
    file_type:    'json',
    sort_order:   'desc',
    limit:        '3',
    observation_end: releaseDate,
  });

  const url = `${FRED_BASE}/series/observations?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { value: null, date: null, error: `FRED HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json() as { observations: FredObservation[] };
    const valid = (data.observations ?? [])
      .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
      .reverse();

    if (valid.length === 0) {
      return { value: null, date: null, error: 'FRED retornou 0 observações válidas' };
    }

    const latest = valid[valid.length - 1];
    const prev   = valid.length >= 2 ? valid[valid.length - 2] : null;

    // Para séries de índice: calcula variação MoM
    if (MOM_SERIES.has(seriesId) && prev) {
      const latestVal = parseFloat(latest.value);
      const prevVal   = parseFloat(prev.value);

      if (seriesId === 'PAYEMS') {
        // NFP: variação absoluta em milhares
        const value = Math.round(latestVal - prevVal);
        return { value, date: latest.date, error: null };
      }
      // Outros: variação percentual MoM
      const value = parseFloat((((latestVal - prevVal) / Math.abs(prevVal)) * 100).toFixed(2));
      return { value, date: latest.date, error: null };
    }

    // Séries de nível direto (UNRATE, GDP, FEDFUNDS)
    return { value: parseFloat(parseFloat(latest.value).toFixed(2)), date: latest.date, error: null };
  } catch (err) {
    return { value: null, date: null, error: String(err) };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const correlationId = crypto.randomUUID();
  const startMs = Date.now();

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const fredApiKey     = Deno.env.get('FRED_API_KEY') ?? '';

  const sb = createClient(supabaseUrl, serviceKey);

  log('INFO', correlationId, 'macro-actual-fetcher iniciado');

  // Registra início do job
  const { data: jobRow } = await sb
    .from('system_job_log')
    .insert({
      job_name:       'macro-actual-fetcher',
      correlation_id: correlationId,
      status:         'started',
    })
    .select('id')
    .single();

  const jobId = jobRow?.id as string | undefined;

  try {
    if (!fredApiKey) {
      log('WARN', correlationId, 'FRED_API_KEY ausente — job abortado');
      await sb.from('system_job_log').update({
        status:         'error',
        error_message:  'FRED_API_KEY secret não configurado',
        duration_ms:    Date.now() - startMs,
      }).eq('id', jobId!);

      return new Response(
        JSON.stringify({ status: 'error', reason: 'FRED_API_KEY not configured', correlationId }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Busca eventos released sem actual
    const { data: pending, error: pendingErr } = await sb
      .from('v_macro_actual_pending')
      .select('*')
      .limit(20);

    if (pendingErr) throw new Error('Erro ao consultar v_macro_actual_pending: ' + pendingErr.message);

    const events = (pending ?? []) as PendingEvent[];
    log('INFO', correlationId, `Eventos pendentes encontrados: ${events.length}`);

    let updated = 0;
    let errors  = 0;

    for (const event of events) {
      if (!event.fred_series) {
        // FOMC: sem série FRED para actual automático — marcar como sem fonte
        log('INFO', correlationId, `${event.event_code}: sem fred_series, pulando`);
        await sb.from('macro_event_schedule').update({
          retry_count: Math.min((event.retry_count ?? 0) + 1, 5),
          last_error:  'Sem fred_series configurada (FOMC/manual only)',
          updated_at:  new Date().toISOString(),
        }).eq('id', event.id);
        continue;
      }

      log('INFO', correlationId, `Buscando actual de ${event.event_code} (${event.fred_series})`);

      const { value, date, error } = await fetchFredObservations(
        event.fred_series,
        event.release_time_utc,
        fredApiKey,
      );

      if (error || value === null) {
        errors++;
        log('WARN', correlationId, `Falha ao buscar actual de ${event.event_code}`, { error });

        await sb.from('macro_event_schedule').update({
          retry_count: Math.min((event.retry_count ?? 0) + 1, 5),
          last_error:  error ?? 'Valor null retornado pelo FRED',
          updated_at:  new Date().toISOString(),
        }).eq('id', event.id);
        continue;
      }

      const { error: updateErr } = await sb
        .from('macro_event_schedule')
        .update({
          actual:           value,
          actual_source:    `FRED:${event.fred_series}:${date}`,
          actual_updated_at: new Date().toISOString(),
          status:           'released',
          retry_count:      0,
          last_error:       null,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', event.id);

      if (updateErr) {
        errors++;
        log('ERROR', correlationId, `Falha ao atualizar ${event.event_code}`, { error: updateErr.message });
      } else {
        updated++;
        log('INFO', correlationId, `${event.event_code}: actual=${value} (data FRED: ${date})`);
      }
    }

    const duration = Date.now() - startMs;
    const status   = errors > 0 && updated === 0 ? 'error' : errors > 0 ? 'partial' : 'success';

    await sb.from('system_job_log').update({
      status,
      events_found:   events.length,
      events_updated: updated,
      duration_ms:    duration,
      error_message:  errors > 0 ? `${errors} erros de ${events.length} eventos` : null,
      metadata:       { fredApiKeyPresent: true },
    }).eq('id', jobId!);

    log('INFO', correlationId, `Job concluído`, { status, updated, errors, duration });

    return new Response(
      JSON.stringify({ status, correlationId, eventsFound: events.length, updated, errors, durationMs: duration }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', correlationId, 'Erro crítico no job', { error: msg });

    await sb.from('system_job_log').update({
      status:         'error',
      error_message:  msg,
      duration_ms:    Date.now() - startMs,
    }).eq('id', jobId!).catch(() => null);

    return new Response(
      JSON.stringify({ status: 'error', error: msg, correlationId }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
