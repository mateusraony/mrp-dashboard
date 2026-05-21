#!/usr/bin/env node
/**
 * notify-investing-calendar.mjs — Dispara notificações pré/pós eventos do Investing.com
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN (opcional), TELEGRAM_CHAT_ID (opcional)
 * Uso: node scripts/notify-investing-calendar.mjs
 */

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID         = process.env.TELEGRAM_CHAT_ID;

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Formata data UTC para exibição em BRT (UTC-3).
 */
function formatBrt(datetimeUtc) {
  try {
    const d = new Date(datetimeUtc);
    const brtMs = d.getTime() - 3 * 60 * 60 * 1000;
    const brt = new Date(brtMs);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(brt.getUTCDate())}/${pad(brt.getUTCMonth() + 1)} ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`;
  } catch {
    return datetimeUtc;
  }
}

/**
 * Retorna seta de comparação actual vs forecast.
 */
function compareArrow(actual, forecast) {
  const a = parseFloat(actual ?? '');
  const f = parseFloat(forecast ?? '');
  if (isNaN(a) || isNaN(f)) return '→';
  if (a > f) return '▲ Acima do previsto';
  if (a < f) return '▼ Abaixo do previsto';
  return '= Conforme previsto';
}

// ─── Mensagens Telegram ───────────────────────────────────────────────────────

function buildPreEventMessage(event) {
  const brtTime  = formatBrt(event.datetime_utc);
  const forecast = event.forecast ?? '—';
  const previous = event.previous ?? '—';
  const direction = event.ai_direction === 'up' ? '↑ bullish BTC' : event.ai_direction === 'down' ? '↓ bearish BTC' : '↔ neutro';
  const prob     = event.ai_probability != null ? `${Math.round(event.ai_probability * 100)}%` : '—';
  const currency = event.currency ?? '';

  return [
    `⏰ ALERTA MACRO — 5min`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 ${event.title}${currency ? ` (${currency})` : ''}`,
    `🕐 ${brtTime} BRT`,
    `📊 Previsão: ${forecast}`,
    `📈 Anterior: ${previous}`,
    ``,
    `🤖 AI: ${direction} (${prob}) — ${event.ai_analysis ?? ''}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `CryptoWatch Intelligence`,
  ].join('\n');
}

function buildPostEventMessage(event) {
  const actual   = event.actual ?? '—';
  const forecast = event.forecast ?? '—';
  const arrow    = compareArrow(event.actual, event.forecast);

  return [
    `🔔 RESULTADO MACRO`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 ${event.title}`,
    `✅ Atual: ${actual} | Prev: ${forecast}`,
    arrow,
    ``,
    `🤖 Análise AI: ${event.ai_analysis ?? ''}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `CryptoWatch`,
  ].join('\n');
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(token, chatId, message) {
  if (!token || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[notify-investing] Telegram falhou: ${res.status} — ${text}`);
    }
  } catch (err) {
    console.warn('[notify-investing] Erro ao enviar Telegram:', String(err));
  }
}

// ─── Supabase REST ────────────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    apikey:          SUPABASE_SERVICE_ROLE_KEY,
    Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type':  'application/json',
  };
}

/**
 * Busca eventos próximos (±20 min da janela atual) e recém-liberados (com actual, últimas 2h).
 */
async function fetchUpcomingEvents() {
  const now    = new Date();
  const from   = new Date(now.getTime() - 10 * 60 * 1000).toISOString();  // -10 min
  const to     = new Date(now.getTime() + 20 * 60 * 1000).toISOString();  // +20 min
  const from2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // -2h para pós-evento

  // Pré-eventos: próximos 20 min, sem notify_state (ou pending)
  const preUrl = `${SUPABASE_URL}/rest/v1/economic_calendar_events`
    + `?datetime_utc=gte.${from}&datetime_utc=lte.${to}`
    + `&notify_state=is.null`
    + `&order=datetime_utc.asc`;

  // Pós-eventos: últimas 2h com actual preenchido, notify_state = pre_sent ou pending
  const postUrl = `${SUPABASE_URL}/rest/v1/economic_calendar_events`
    + `?datetime_utc=gte.${from2h}&datetime_utc=lt.${now.toISOString()}`
    + `&actual=not.is.null`
    + `&notify_state=in.(pre_sent,pending)`
    + `&order=datetime_utc.asc`;

  const [preRes, postRes] = await Promise.all([
    fetch(preUrl, { headers: supabaseHeaders() }),
    fetch(postUrl, { headers: supabaseHeaders() }),
  ]);

  const preEvents  = preRes.ok  ? await preRes.json()  : [];
  const postEvents = postRes.ok ? await postRes.json() : [];

  return { preEvents, postEvents };
}

/**
 * Atualiza notify_state de um evento no Supabase.
 */
async function updateNotifyState(id, state) {
  const url = `${SUPABASE_URL}/rest/v1/economic_calendar_events?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      ...supabaseHeaders(),
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ notify_state: state }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn(`[notify-investing] updateNotifyState falhou para ${id}: ${res.status} — ${text}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[notify-investing] Telegram não configurado — notificação apenas em DB');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  notify-investing-calendar.mjs');
  console.log(`  Início: ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const { preEvents, postEvents } = await fetchUpcomingEvents();

  let preSent  = 0;
  let postSent = 0;

  // ─── Pré-eventos (5-15 min antes, notify_state IS NULL)
  for (const event of preEvents) {
    const minutesUntil = (new Date(event.datetime_utc).getTime() - Date.now()) / 60_000;

    // Só notifica se estiver entre 5 e 16 min do evento
    if (minutesUntil < 5 || minutesUntil > 16) continue;

    console.log(`  [PRÉ] ${event.title} — em ${minutesUntil.toFixed(1)}min`);

    const message = buildPreEventMessage(event);

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message);
    }

    await updateNotifyState(event.id, 'pre_sent');
    preSent++;
  }

  // ─── Pós-eventos (actual preenchido, notify_state = pre_sent ou pending)
  for (const event of postEvents) {
    console.log(`  [PÓS] ${event.title} — actual: ${event.actual}`);

    const message = buildPostEventMessage(event);

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message);
    }

    await updateNotifyState(event.id, 'post_sent');
    postSent++;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Pré-evento enviados:  ${preSent}`);
  console.log(`  Pós-evento enviados:  ${postSent}`);
  console.log(`  Status: ✅ Concluído`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ERRO FATAL:', String(err));
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});
