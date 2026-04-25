/**
 * macro-alert-worker — Edge Function Supabase (Deno)
 *
 * Job agendado (pg_cron a cada 5 min) que:
 *   1. Busca eventos macro com alert habilitado e release dentro da janela de disparo
 *   2. Deduplica por chave (event_code|release_time_utc|window|chat_id)
 *   3. Envia mensagem Telegram
 *   4. Registra delivery em telegram_delivery_log
 *   5. Registra execução em system_job_log
 *
 * Requer secrets Supabase:
 *   SUPABASE_URL              — injetado automaticamente
 *   SUPABASE_SERVICE_ROLE_KEY — injetado automaticamente
 *   (bot token e chat_id lidos de user_settings)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Janelas de disparo suportadas (minutos antes do evento)
const ALERT_WINDOWS = [60, 30, 15] as const;
type AlertWindow = typeof ALERT_WINDOWS[number];

interface AlertPreference {
  event_code:           string;
  alert_enabled:        boolean;
  alert_minutes_before: number;
}

interface ScheduledEvent {
  id:               string;
  event_code:       string;
  release_time_utc: string;
  status:           string;
  previous:         number | null;
  actual:           number | null;
  consensus:        number | null;
  unit:             string | null;
}

interface EventCatalog {
  code:                string;
  name:                string;
  agency:              string;
  tier:                number;
  btc_impact_hist_avg: number;
}

interface TelegramSettings {
  telegram_enabled:   boolean;
  telegram_chat_id:   string | null;
  telegram_bot_token: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', correlationId: string, msg: string, data?: unknown) {
  console.log(JSON.stringify({ level, correlationId, msg, data, ts: new Date().toISOString() }));
}

function buildAlertMessage(
  event:   ScheduledEvent,
  catalog: EventCatalog,
  windowMinutes: number,
): string {
  const now      = new Date();
  const releaseDate = new Date(event.release_time_utc);
  const brtTime  = releaseDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const brtDate  = releaseDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

  const unit = event.unit ?? '';
  const prevFmt = event.previous !== null ? `${event.previous}${unit}` : '—';
  const consFmt = event.consensus !== null ? `${event.consensus}${unit}` : 'N/D (sem fonte gratuita)';
  const impactSign = catalog.btc_impact_hist_avg >= 0 ? '+' : '';

  return [
    `🚨 *MACRO ALERT — ${windowMinutes}min*`,
    `━━━━━━━━━━━━━━━━━━`,
    `📅 *${catalog.name}* (Tier-${catalog.tier})`,
    `🏛 ${catalog.agency}`,
    `🕐 ${brtTime} BRT (${brtDate})`,
    ``,
    `📊 *Consenso:* ${consFmt}`,
    `📈 *Anterior:* ${prevFmt}`,
    ``,
    `🤖 *Impacto histórico BTC:*`,
    `• Avg: ${impactSign}${catalog.btc_impact_hist_avg}%`,
    ``,
    `🔗 [Abrir Dashboard](https://mrp-dashboard.onrender.com/MacroCalendar)`,
    ``,
    `_CryptoWatch Intelligence · ${now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT_`,
  ].join('\n');
}

async function sendTelegramMessage(
  token:  string,
  chatId: string,
  text:   string,
): Promise<{ ok: boolean; msgId?: number; status: number; errorBody?: string; latencyMs: number }> {
  const t0 = Date.now();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:                  chatId,
        text,
        parse_mode:               'Markdown',
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      return { ok: false, status: res.status, errorBody: errorBody.slice(0, 500), latencyMs };
    }

    const body = await res.json() as { ok: boolean; result?: { message_id: number } };
    return {
      ok:        body.ok === true,
      msgId:     body.result?.message_id,
      status:    res.status,
      latencyMs,
    };
  } catch (err) {
    return { ok: false, status: 0, errorBody: String(err), latencyMs: Date.now() - t0 };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const correlationId = crypto.randomUUID();
  const startMs = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  log('INFO', correlationId, 'macro-alert-worker iniciado');

  const { data: jobRow } = await sb
    .from('system_job_log')
    .insert({ job_name: 'macro-alert-worker', correlation_id: correlationId, status: 'started' })
    .select('id')
    .single();
  const jobId = jobRow?.id as string | undefined;

  try {
    // 1. Lê configurações Telegram
    const { data: settings } = await sb
      .from('user_settings')
      .select('telegram_enabled, telegram_chat_id, telegram_bot_token')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const cfg: TelegramSettings = {
      telegram_enabled:   settings?.telegram_enabled   ?? false,
      telegram_chat_id:   settings?.telegram_chat_id   ?? null,
      telegram_bot_token: settings?.telegram_bot_token ?? null,
    };

    if (!cfg.telegram_enabled || !cfg.telegram_chat_id || !cfg.telegram_bot_token) {
      log('INFO', correlationId, 'Telegram desabilitado ou não configurado — skip');
      await sb.from('system_job_log').update({
        status: 'success', duration_ms: Date.now() - startMs, alerts_sent: 0,
        metadata: { reason: 'telegram_not_configured' },
      }).eq('id', jobId!);

      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'Telegram não configurado', correlationId }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Carrega preferências de alerta habilitadas
    const { data: prefs } = await sb
      .from('macro_alert_preferences')
      .select('event_code, alert_enabled, alert_minutes_before')
      .eq('alert_enabled', true);

    const enabledCodes = new Set((prefs ?? []).map((p: AlertPreference) => p.event_code));

    if (enabledCodes.size === 0) {
      log('INFO', correlationId, 'Nenhum alerta habilitado — skip');
      await sb.from('system_job_log').update({
        status: 'success', duration_ms: Date.now() - startMs, alerts_sent: 0,
      }).eq('id', jobId!);

      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'Nenhum alerta configurado', correlationId }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Busca eventos na janela de próximas 65min (cobre todas as janelas de alerta)
    const now     = new Date();
    const maxAhead = new Date(now.getTime() + 65 * 60_000);

    const { data: upcoming } = await sb
      .from('macro_event_schedule')
      .select('id, event_code, release_time_utc, status, previous, actual, consensus, unit')
      .in('event_code', [...enabledCodes])
      .eq('status', 'scheduled')
      .gte('release_time_utc', now.toISOString())
      .lte('release_time_utc', maxAhead.toISOString());

    const events = (upcoming ?? []) as ScheduledEvent[];
    log('INFO', correlationId, `Eventos em janela de alerta: ${events.length}`);

    // 4. Carrega catálogo de eventos
    const { data: catalogRows } = await sb
      .from('macro_event_catalog')
      .select('code, name, agency, tier, btc_impact_hist_avg');

    const catalog = new Map<string, EventCatalog>(
      (catalogRows ?? []).map((c: EventCatalog) => [c.code, c]),
    );

    let alertsSent = 0;
    let alertsSkipped = 0;

    // 5. Para cada evento, verifica qual janela de disparo se aplica
    for (const event of events) {
      const releaseMs = new Date(event.release_time_utc).getTime();
      const minutesLeft = Math.round((releaseMs - now.getTime()) / 60_000);

      const matchedWindow = ALERT_WINDOWS.find(w => Math.abs(minutesLeft - w) <= 3) as AlertWindow | undefined;
      if (!matchedWindow) continue;

      const deliveryKey = `${event.event_code}|${event.release_time_utc}|${matchedWindow}m|${cfg.telegram_chat_id}`;

      // Verifica deduplicação
      const { data: existing } = await sb
        .from('telegram_delivery_log')
        .select('id')
        .eq('delivery_key', deliveryKey)
        .maybeSingle();

      if (existing) {
        alertsSkipped++;
        log('INFO', correlationId, `Dedup — alerta já enviado: ${deliveryKey}`);
        continue;
      }

      const cat = catalog.get(event.event_code);
      if (!cat) {
        log('WARN', correlationId, `Catálogo não encontrado para: ${event.event_code}`);
        continue;
      }

      const message = buildAlertMessage(event, cat, matchedWindow);
      const result  = await sendTelegramMessage(cfg.telegram_bot_token, cfg.telegram_chat_id, message);

      // Registra no delivery log (independente de sucesso/falha)
      await sb.from('telegram_delivery_log').upsert({
        delivery_key:     deliveryKey,
        event_code:       event.event_code,
        release_time_utc: event.release_time_utc,
        window_label:     `alert_${matchedWindow}m`,
        chat_id:          cfg.telegram_chat_id,
        status:           result.ok ? 'sent' : 'failed',
        telegram_msg_id:  result.msgId ?? null,
        telegram_status:  result.status,
        error_message:    result.errorBody ?? null,
        latency_ms:       result.latencyMs,
        payload_preview:  message.slice(0, 200),
      }, { onConflict: 'delivery_key' });

      if (result.ok) {
        alertsSent++;
        log('INFO', correlationId, `Alerta enviado: ${event.event_code} (${matchedWindow}min antes)`, {
          msgId: result.msgId, latencyMs: result.latencyMs,
        });
      } else {
        log('ERROR', correlationId, `Falha ao enviar alerta: ${event.event_code}`, {
          status: result.status, error: result.errorBody,
        });
      }
    }

    const duration = Date.now() - startMs;
    await sb.from('system_job_log').update({
      status:         'success',
      events_found:   events.length,
      alerts_sent:    alertsSent,
      duration_ms:    duration,
      metadata:       { alertsSkipped },
    }).eq('id', jobId!);

    log('INFO', correlationId, 'Worker concluído', { alertsSent, alertsSkipped, duration });

    return new Response(
      JSON.stringify({ status: 'success', correlationId, eventsChecked: events.length, alertsSent, alertsSkipped, durationMs: duration }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', correlationId, 'Erro crítico no worker', { error: msg });

    await sb.from('system_job_log').update({
      status: 'error', error_message: msg, duration_ms: Date.now() - startMs,
    }).eq('id', jobId!).catch(() => null);

    return new Response(
      JSON.stringify({ status: 'error', error: msg, correlationId }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
