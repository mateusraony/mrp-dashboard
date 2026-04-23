/**
 * send-telegram-digest — Edge Function Supabase (Deno)
 *
 * Envia resumo diário de mercado via Telegram Bot API.
 * Chamada via pg_cron (diariamente) ou manualmente via HTTP POST.
 *
 * Melhorias desta versão:
 *   - Logs estruturados JSON com correlation_id
 *   - Validação explícita de token/chat_id com mensagem de erro humana
 *   - Registro em telegram_delivery_log (auditoria + dedup diário)
 *   - Registro em system_job_log (saúde de jobs)
 *   - Resposta estruturada padronizada
 *
 * Requer:
 *   SUPABASE_URL              — injetado automaticamente
 *   SUPABASE_SERVICE_ROLE_KEY — injetado automaticamente
 *   (telegram_bot_token e telegram_chat_id lidos de user_settings)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TelegramSettings {
  telegram_enabled:   boolean;
  telegram_chat_id:   string | null;
  telegram_bot_token: string | null;
  telegram_schedule:  string;
}

interface MarketSnapshot {
  btc_price:    number;
  funding_rate: number;
  fear_greed:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', correlationId: string, msg: string, data?: unknown) {
  console.log(JSON.stringify({ level, correlationId, msg, data, ts: new Date().toISOString() }));
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtFunding(f: number): string {
  const sign  = f >= 0 ? '+' : '';
  const emoji = Math.abs(f) > 0.05 ? '🔴' : f >= 0 ? '🟢' : '🟡';
  return `${emoji} ${sign}${f.toFixed(4)}%/8h`;
}

function fmtFng(v: number): string {
  if (v >= 75) return `${v} 🔴 Extreme Greed`;
  if (v >= 55) return `${v} 🟡 Greed`;
  if (v >= 45) return `${v} ⚪ Neutral`;
  if (v >= 25) return `${v} 🟡 Fear`;
  return `${v} 🔴 Extreme Fear`;
}

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const [tickerRes, fundingRes, fngRes] = await Promise.allSettled([
    fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT', { signal: AbortSignal.timeout(8_000) }),
    fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',  { signal: AbortSignal.timeout(8_000) }),
    fetch('https://api.alternative.me/fng/?limit=1',                        { signal: AbortSignal.timeout(8_000) }),
  ]);

  let btc_price    = 0;
  let funding_rate = 0;
  let fear_greed   = 50;

  if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
    const d = await tickerRes.value.json() as { lastPrice?: string };
    btc_price = parseFloat(d.lastPrice ?? '0');
  }
  if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
    const d = await fundingRes.value.json() as { lastFundingRate?: string };
    funding_rate = parseFloat(d.lastFundingRate ?? '0') * 100;
  }
  if (fngRes.status === 'fulfilled' && fngRes.value.ok) {
    const d = await fngRes.value.json() as { data?: Array<{ value: string }> };
    fear_greed = parseInt(d.data?.[0]?.value ?? '50', 10);
  }

  return { btc_price, funding_rate, fear_greed };
}

function buildDigestMessage(snap: MarketSnapshot, schedule: string): string {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  return [
    `📊 *MRP Dashboard — Resumo Diário*`,
    `_${dateStr} · ${timeStr} BRT_`,
    ``,
    `💰 *BTC* ${snap.btc_price > 0 ? fmtPrice(snap.btc_price) : 'N/A'}`,
    `📈 *Funding* ${fmtFunding(snap.funding_rate)}`,
    `🧠 *Fear & Greed* ${fmtFng(snap.fear_greed)}`,
    ``,
    `🔗 [Abrir Dashboard](https://mrp-dashboard.onrender.com)`,
    ``,
    `_Agendado: ${schedule} UTC · Via MRP Dashboard_`,
  ].join('\n');
}

async function sendTelegram(
  token:  string,
  chatId: string,
  text:   string,
): Promise<{ ok: boolean; msgId?: number; httpStatus: number; errorBody?: string; latencyMs: number }> {
  const t0  = Date.now();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false }),
    signal:  AbortSignal.timeout(12_000),
  });

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    return { ok: false, httpStatus: res.status, errorBody: errorBody.slice(0, 500), latencyMs };
  }

  const body = await res.json() as { ok: boolean; result?: { message_id: number } };
  return { ok: body.ok === true, msgId: body.result?.message_id, httpStatus: res.status, latencyMs };
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

  log('INFO', correlationId, 'send-telegram-digest iniciado');

  const { data: jobRow } = await sb
    .from('system_job_log')
    .insert({ job_name: 'send-telegram-digest', correlation_id: correlationId, status: 'started' })
    .select('id')
    .single();
  const jobId = jobRow?.id as string | undefined;

  try {
    // Lê configurações do Telegram
    const { data: settings, error: settingsError } = await sb
      .from('user_settings')
      .select('telegram_enabled, telegram_chat_id, telegram_bot_token, telegram_schedule')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      log('ERROR', correlationId, 'Erro ao ler user_settings', { error: settingsError.message });
      await sb.from('system_job_log').update({
        status: 'error', error_message: settingsError.message, duration_ms: Date.now() - startMs,
      }).eq('id', jobId!);

      return new Response(
        JSON.stringify({ ok: false, error: 'Erro ao ler configurações: ' + settingsError.message, correlationId }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const cfg: TelegramSettings = {
      telegram_enabled:   settings?.telegram_enabled   ?? false,
      telegram_chat_id:   settings?.telegram_chat_id   ?? null,
      telegram_bot_token: settings?.telegram_bot_token ?? null,
      telegram_schedule:  settings?.telegram_schedule  ?? '11:00',
    };

    // Validações explícitas com mensagem humana
    if (!cfg.telegram_enabled) {
      log('INFO', correlationId, 'Telegram desabilitado — skip');
      await sb.from('system_job_log').update({ status: 'success', duration_ms: Date.now() - startMs, alerts_sent: 0 }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: true, status: 'skipped', reason: 'Telegram desabilitado nas configurações', correlationId }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!cfg.telegram_bot_token) {
      const msg = 'Bot Token não configurado. Vá em Configurações → Telegram → Bot Token e insira o token criado via @BotFather.';
      log('WARN', correlationId, msg);
      await sb.from('system_job_log').update({ status: 'error', error_message: msg, duration_ms: Date.now() - startMs }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: false, error: msg, correlationId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!cfg.telegram_chat_id) {
      const msg = 'Chat ID não configurado. Envie /start para o seu bot, então use @userinfobot para obter seu chat_id.';
      log('WARN', correlationId, msg);
      await sb.from('system_job_log').update({ status: 'error', error_message: msg, duration_ms: Date.now() - startMs }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: false, error: msg, correlationId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Dedup diário: um digest por chat por dia
    const todayKey = `digest|${new Date().toISOString().slice(0, 10)}|${cfg.telegram_chat_id}`;
    const { data: existingDelivery } = await sb
      .from('telegram_delivery_log')
      .select('id, status, created_at')
      .eq('delivery_key', todayKey)
      .maybeSingle();

    if (existingDelivery?.status === 'sent') {
      log('INFO', correlationId, 'Digest já enviado hoje — dedup', { key: todayKey });
      await sb.from('system_job_log').update({ status: 'success', duration_ms: Date.now() - startMs, alerts_sent: 0 }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: true, status: 'skipped', reason: 'Digest já enviado hoje', correlationId }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Busca dados de mercado
    const snapshot = await fetchMarketSnapshot();
    log('INFO', correlationId, 'Market snapshot', snapshot);

    const message = buildDigestMessage(snapshot, cfg.telegram_schedule);
    const result  = await sendTelegram(cfg.telegram_bot_token, cfg.telegram_chat_id, message);

    const duration = Date.now() - startMs;

    // Registra no delivery log
    await sb.from('telegram_delivery_log').upsert({
      delivery_key:    todayKey,
      window_label:    'digest',
      chat_id:         cfg.telegram_chat_id,
      status:          result.ok ? 'sent' : 'failed',
      telegram_msg_id: result.msgId ?? null,
      telegram_status: result.httpStatus,
      error_message:   result.errorBody ?? null,
      latency_ms:      result.latencyMs,
      payload_preview: message.slice(0, 200),
    }, { onConflict: 'delivery_key' });

    if (!result.ok) {
      let hint = 'Verifique as configurações do bot.';
      if (result.errorBody?.includes('chat not found'))
        hint = 'Chat não encontrado. Envie /start ao bot e então atualize o Chat ID.';
      else if (result.errorBody?.includes('Forbidden'))
        hint = 'Bot sem permissão. O usuário deve iniciar a conversa com /start.';
      else if (result.errorBody?.includes('Unauthorized'))
        hint = 'Token inválido. Recrie o bot com @BotFather e atualize o token.';

      log('ERROR', correlationId, 'Telegram retornou erro', {
        status: result.httpStatus, body: result.errorBody, latencyMs: result.latencyMs,
      });

      await sb.from('system_job_log').update({
        status: 'error', error_message: `Telegram HTTP ${result.httpStatus}: ${result.errorBody?.slice(0, 200)}`,
        duration_ms: duration, alerts_sent: 0,
      }).eq('id', jobId!);

      return new Response(
        JSON.stringify({
          ok:             false,
          status:         'failed',
          telegram_status: result.httpStatus,
          telegram_error:  result.errorBody,
          hint,
          correlationId,
          latency_ms:     result.latencyMs,
        }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    log('INFO', correlationId, 'Digest enviado com sucesso', { msgId: result.msgId, latencyMs: result.latencyMs });

    await sb.from('system_job_log').update({
      status: 'success', alerts_sent: 1, duration_ms: duration,
      metadata: { btc_price: snapshot.btc_price, fear_greed: snapshot.fear_greed },
    }).eq('id', jobId!);

    return new Response(
      JSON.stringify({
        ok:         true,
        status:     'sent',
        message_id: result.msgId,
        btc_price:  snapshot.btc_price,
        correlationId,
        timestamp:  new Date().toISOString(),
        latency_ms: result.latencyMs,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', correlationId, 'Erro crítico no digest', { error: msg });

    await sb.from('system_job_log').update({
      status: 'error', error_message: msg, duration_ms: Date.now() - startMs,
    }).eq('id', jobId!).catch(() => null);

    return new Response(
      JSON.stringify({ ok: false, error: msg, correlationId }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
