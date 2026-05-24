#!/usr/bin/env node
/**
 * notify-economic-calendar.mjs — Alertas do calendário econômico via Telegram
 *
 * Tipos de notificação:
 *   1. daily_summary   — 08:00 BRT: resumo do dia
 *   2. pre_5min        — 5–35 min antes do evento
 *   3. post_release    — após actual disponível
 *   4. source_failure  — falha da fonte de dados
 *
 * Anti-duplicação: tabela economic_calendar_notifications com constraints únicas.
 * Claude AI: análise pré/pós se ANTHROPIC_API_KEY disponível; fallback rule-based.
 *
 * Env obrigatórias:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Env opcionais:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *   ANTHROPIC_API_KEY, CLAUDE_MODEL (default: claude-haiku-4-5-20251001)
 */

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID          = process.env.TELEGRAM_CHAT_ID;
const ANTHROPIC_API_KEY         = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL              = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';

// ─── Utilitários de data BRT ──────────────────────────────────────────────────

/** Converte Date UTC para objeto representando wall-clock BRT (UTC-3, sem DST). */
function toBrt(utcDate) {
  return new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
}

function padTwo(n) { return String(n).padStart(2, '0'); }

function formatBrt(utcDateOrStr) {
  try {
    const brt = toBrt(new Date(utcDateOrStr));
    return `${padTwo(brt.getUTCDate())}/${padTwo(brt.getUTCMonth() + 1)} ${padTwo(brt.getUTCHours())}:${padTwo(brt.getUTCMinutes())} BRT`;
  } catch { return String(utcDateOrStr); }
}

function formatTimeBrt(utcDateOrStr) {
  try {
    const brt = toBrt(new Date(utcDateOrStr));
    return `${padTwo(brt.getUTCHours())}:${padTwo(brt.getUTCMinutes())}`;
  } catch { return '??:??'; }
}

/** Retorna a data BRT (YYYY-MM-DD) de now() para controle de daily_summary. */
function todayBrtDateStr() {
  const brt = toBrt(new Date());
  return `${brt.getUTCFullYear()}-${padTwo(brt.getUTCMonth() + 1)}-${padTwo(brt.getUTCDate())}`;
}

/** Retorna hora BRT atual (0-23) para gate do daily summary. */
function currentHourBrt() {
  return toBrt(new Date()).getUTCHours();
}

// ─── Análise AI — Claude ou rule-based ───────────────────────────────────────

/** Análise rule-based como fallback quando Claude não disponível. */
function ruleBasedAnalysis(event) {
  const t    = (event.title ?? '').toLowerCase();
  const fNum = parseFloat(event.forecast ?? '');
  const pNum = parseFloat(event.previous ?? '');
  const aNum = parseFloat(event.actual   ?? '');
  const canF = !isNaN(fNum) && !isNaN(pNum);
  const canA = !isNaN(aNum) && !isNaN(fNum);

  // Pós-evento — compara actual vs forecast
  if (canA) {
    const surprise = aNum - fNum;
    const surprisePct = fNum !== 0 ? (surprise / Math.abs(fNum)) * 100 : 0;
    const isInflation = /\bcpi\b|consumer price|pce|core pce|inflation/.test(t);
    const isEmploy   = /nfp|nonfarm|non-farm|payroll/.test(t);
    const isFomc     = /fomc|federal open|interest rate decision|fed rate/.test(t);

    if (isFomc) {
      const dir = surprise > 0 ? 'hawkish' : surprise < 0 ? 'dovish' : 'em linha com o esperado';
      return {
        summary: `FOMC ${dir}. Surpresa: ${surprise > 0 ? '+' : ''}${surprisePct.toFixed(1)}%.`,
        btc_bias: surprise > 0 ? 'bearish' : surprise < 0 ? 'bullish' : 'neutral',
        direction: surprise > 0 ? 'down' : surprise < 0 ? 'up' : 'neutral',
        probability: surprise !== 0 ? 0.62 : 0.50,
        confidence: 0.65,
        risk_level: Math.abs(surprisePct) > 5 ? 'high' : 'medium',
        limitations: ['Análise rule-based — sem Claude disponível', 'FOMC pode ter sinalização verbal divergente do dado'],
      };
    }

    if (isInflation) {
      // Inflação acima = hawkish = bearish BTC
      const isBearish = aNum > fNum;
      return {
        summary: `${event.title}: real ${event.actual} vs previsto ${event.forecast}. ${isBearish ? 'Acima do esperado → hawkish' : 'Abaixo do esperado → dovish'}.`,
        btc_bias: isBearish ? 'bearish' : 'bullish',
        direction: isBearish ? 'down' : 'up',
        probability: 0.60 + Math.min(Math.abs(surprisePct) * 0.01, 0.12),
        confidence: 0.65,
        risk_level: Math.abs(surprisePct) > 10 ? 'high' : 'medium',
        limitations: ['Análise rule-based — sem Claude disponível'],
      };
    }

    if (isEmploy) {
      const isStrong = aNum > fNum;
      return {
        summary: `${event.title}: ${event.actual}K vs previsto ${event.forecast}K. Mercado de trabalho ${isStrong ? 'forte → hawkish' : 'fraco → possível pivot'}.`,
        btc_bias: isStrong ? 'bearish' : 'bullish',
        direction: isStrong ? 'down' : 'up',
        probability: 0.58 + Math.min(Math.abs(surprisePct) * 0.01, 0.10),
        confidence: 0.60,
        risk_level: Math.abs(surprisePct) > 15 ? 'high' : 'medium',
        limitations: ['Análise rule-based — sem Claude disponível'],
      };
    }

    // Genérico
    const isBull = aNum < fNum;
    return {
      summary: `${event.title}: real ${event.actual} vs previsto ${event.forecast}. Surpresa: ${surprise > 0 ? '+' : ''}${surprisePct.toFixed(1)}%.`,
      btc_bias: isBull ? 'bullish' : 'bearish',
      direction: isBull ? 'up' : 'down',
      probability: 0.52,
      confidence: 0.50,
      risk_level: 'medium',
      limitations: ['Análise rule-based — sem Claude disponível', 'Evento sem regra específica — use o seu próprio julgamento'],
    };
  }

  // Pré-evento — compara forecast vs previous
  if (/fomc|federal open|interest rate decision/.test(t)) {
    return { summary: 'Decisão do Fed. Manutenção esperada = neutro. Surpresa altista = bearish BTC.', btc_bias: 'neutral', direction: 'neutral', probability: 0.50, confidence: 0.55, risk_level: 'extreme', limitations: ['Pré-evento — actual não disponível'] };
  }
  if (canF) {
    if (/\bcpi\b|pce|inflation/.test(t)) {
      const rising = fNum > pNum;
      return { summary: `Previsão ${fNum} vs anterior ${pNum}. ${rising ? 'Leitura crescente — pressão hawkish' : 'Desinflação esperada — favorável para ativos de risco'}.`, btc_bias: rising ? 'bearish' : 'bullish', direction: rising ? 'down' : 'up', probability: 0.55, confidence: 0.50, risk_level: 'high', limitations: ['Pré-evento — actual não disponível'] };
    }
  }
  return { summary: 'Evento de alta importância. Monitorar resultado vs consenso.', btc_bias: 'neutral', direction: 'neutral', probability: 0.50, confidence: 0.45, risk_level: 'medium', limitations: ['Pré-evento — actual não disponível', 'Análise rule-based'] };
}

/**
 * Chama Claude API para análise pré ou pós evento.
 * Retorna null se ANTHROPIC_API_KEY não disponível ou Claude falhar.
 */
async function claudeAnalysis(event, mode = 'pre') {
  if (!ANTHROPIC_API_KEY) return null;

  const isPost     = mode === 'post';
  const hasActual  = isPost && event.actual != null;
  const surpriseRaw = hasActual && event.forecast
    ? parseFloat(event.actual) - parseFloat(event.forecast)
    : null;
  const surprisePct = surpriseRaw != null && parseFloat(event.forecast) !== 0
    ? ((surpriseRaw / Math.abs(parseFloat(event.forecast))) * 100).toFixed(1)
    : null;

  const systemPrompt = `Você é um economista especializado em impacto macro em criptoativos.
Responda SEMPRE em JSON válido com exatamente estes campos:
{
  "summary": string (1-2 frases),
  "scenario_above_forecast": string,
  "scenario_below_forecast": string,
  "scenario_inline": string,
  "btc_bias": "bullish"|"bearish"|"neutral",
  "gold_bias": "bullish"|"bearish"|"neutral",
  "dxy_bias": "bullish"|"bearish"|"neutral",
  "spx_bias": "bullish"|"bearish"|"neutral",
  "probability_down": number (0-100),
  "probability_up": number (0-100),
  "probability_chop": number (0-100),
  "confidence": number (0-100),
  "risk_level": "low"|"medium"|"high"|"extreme",
  "trade_guidance": string,
  "do_not_trade_warning": string|null,
  "limitations": string[]
}
REGRA: probability_down + probability_up + probability_chop = 100
REGRA: confidence <= 60 se actual ausente; <= 75 se actual presente mas surpresa pequena.
REGRA: Nunca invente dados. Se algo for incerto, diga nas limitations.`;

  const userPrompt = isPost && hasActual
    ? `Evento liberado: ${event.title}
Moeda/País: ${event.currency ?? 'USD'}
Horário: ${formatBrt(event.datetime_utc)}
Previsão: ${event.forecast ?? 'N/D'}
Anterior: ${event.previous ?? 'N/D'}
Real: ${event.actual}
Surpresa: ${surpriseRaw != null ? `${surpriseRaw > 0 ? '+' : ''}${surpriseRaw} (${surprisePct > 0 ? '+' : ''}${surprisePct}%)` : 'N/D'}
Analise o impacto provável em BTC, ouro, DXY e S&P nas próximas 1-4h.`
    : `Evento iminente: ${event.title}
Moeda/País: ${event.currency ?? 'USD'}
Horário: ${formatBrt(event.datetime_utc)}
Previsão de consenso: ${event.forecast ?? 'N/D'}
Anterior: ${event.previous ?? 'N/D'}
Gere análise pré-evento com 3 cenários e orientação operacional.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 512,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[claude] API erro ${res.status}: ${txt.slice(0, 200)}`);
      return null;
    }

    const body   = await res.json();
    const text   = body?.content?.[0]?.text ?? '';
    const match  = text.match(/\{[\s\S]*\}/);
    if (!match) { console.warn('[claude] Sem JSON na resposta'); return null; }

    const parsed = JSON.parse(match[0]);

    // Validação mínima do schema
    if (typeof parsed.summary !== 'string') return null;
    if (!['bullish', 'bearish', 'neutral'].includes(parsed.btc_bias)) return null;
    const sum = (parsed.probability_down ?? 0) + (parsed.probability_up ?? 0) + (parsed.probability_chop ?? 0);
    if (Math.abs(sum - 100) > 5) return null;  // tolerância 5%

    return parsed;
  } catch (err) {
    console.warn('[claude] Falha:', String(err));
    return null;
  }
}

/** Obtém análise: tenta Claude, cai para rule-based. */
async function getAnalysis(event, mode = 'pre') {
  const claude = await claudeAnalysis(event, mode);
  if (claude) return { ...claude, source: 'claude' };

  const rb = ruleBasedAnalysis(event);
  return { ...rb, source: 'rule_based',
    scenario_above_forecast: rb.btc_bias === 'bearish' ? 'Bearish BTC' : 'Bullish BTC',
    scenario_below_forecast: rb.btc_bias === 'bullish' ? 'Bullish BTC' : 'Bearish BTC',
    scenario_inline: 'Reação mínima esperada',
    gold_bias: 'neutral', dxy_bias: 'neutral', spx_bias: 'neutral',
    probability_down: rb.direction === 'down' ? 55 : 25,
    probability_up:   rb.direction === 'up'   ? 55 : 25,
    probability_chop: 20,
    trade_guidance: 'Aguardar confirmação da direção após publicação do dado.',
    do_not_trade_warning: null,
  };
}

// ─── Formatação de mensagens Telegram ────────────────────────────────────────

function biasEmoji(bias) {
  return bias === 'bullish' ? '🟢' : bias === 'bearish' ? '🔴' : '⚪';
}

function riskEmoji(risk) {
  return { low: '🟢', medium: '🟡', high: '🔴', extreme: '💀' }[risk] ?? '⚪';
}

function buildDailySummaryMessage(events) {
  const date = formatBrt(new Date()).split(' ')[0]; // DD/MM
  const lines = [
    `📅 <b>Calendário Econômico — ${date}</b>`,
    `<b>Eventos de Alta Importância ★★★</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  for (const ev of events) {
    const flag = {
      USD:'🇺🇸',EUR:'🇪🇺',GBP:'🇬🇧',JPY:'🇯🇵',
      CAD:'🇨🇦',AUD:'🇦🇺',CHF:'🇨🇭',
    }[ev.currency ?? ''] ?? '🌐';
    lines.push(
      `\n${flag} <b>${formatTimeBrt(ev.datetime_utc)} BRT</b> — ${ev.title}`,
      `   Previsão: ${ev.forecast ?? '—'} | Anterior: ${ev.previous ?? '—'}`,
    );
  }

  lines.push(
    `━━━━━━━━━━━━━━━━━━━━`,
    `⚠ Evitar posições novas 5–10min antes de cada evento, salvo setup confirmado.`,
    `Fonte: ForexFactory · CryptoWatch Intelligence`,
  );
  return lines.join('\n');
}

function buildPreEventMessage(event, analysis) {
  const flag = {
    USD:'🇺🇸',EUR:'🇪🇺',GBP:'🇬🇧',JPY:'🇯🇵',
    CAD:'🇨🇦',AUD:'🇦🇺',CHF:'🇨🇭',
  }[event.currency ?? ''] ?? '🌐';

  const probUp   = analysis.probability_up   ?? 0;
  const probDown = analysis.probability_down ?? 0;
  const probChop = analysis.probability_chop ?? 0;
  const conf     = analysis.confidence       ?? 0;
  const aiTag    = analysis.source === 'claude' ? '🤖 Claude AI' : '📐 Análise Heurística';

  const lines = [
    `⏰ <b>ALERTA MACRO — 5 MINUTOS</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `${flag} <b>${event.title}</b> (${event.currency ?? '—'})`,
    `🕐 ${formatTimeBrt(event.datetime_utc)} BRT`,
    `📊 Previsão: <code>${event.forecast ?? '—'}</code> | Anterior: <code>${event.previous ?? '—'}</code>`,
    ``,
    `${riskEmoji(analysis.risk_level)} <b>Risco:</b> ${analysis.risk_level?.toUpperCase() ?? '?'}`,
    ``,
    `${aiTag} (confiança: ${conf}%)`,
    `${analysis.summary}`,
    ``,
    `<b>Cenários:</b>`,
    `▲ Acima: ${analysis.scenario_above_forecast ?? '—'}`,
    `▼ Abaixo: ${analysis.scenario_below_forecast ?? '—'}`,
    `= Linha: ${analysis.scenario_inline ?? '—'}`,
    ``,
    `<b>Probabilidades BTC:</b>`,
    `🔴 Baixa: ${probDown}% | 🟢 Alta: ${probUp}% | ⚪ Lateral: ${probChop}%`,
    ``,
    `<b>BTC</b> ${biasEmoji(analysis.btc_bias)} | <b>DXY</b> ${biasEmoji(analysis.dxy_bias)} | <b>Ouro</b> ${biasEmoji(analysis.gold_bias)} | <b>S&P</b> ${biasEmoji(analysis.spx_bias)}`,
    ``,
    analysis.do_not_trade_warning ? `⛔ ${analysis.do_not_trade_warning}` : `📋 ${analysis.trade_guidance ?? ''}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<i>Primeiro candle pós-notícia pode ser armadilha. Aguardar confirmação.</i>`,
    `<a href="https://www.forexfactory.com/calendar">ForexFactory ↗</a> · CryptoWatch`,
  ];

  if (analysis.limitations?.length) {
    lines.push(`<i>⚠ ${analysis.limitations.slice(0, 2).join(' · ')}</i>`);
  }

  return lines.join('\n');
}

function buildPostEventMessage(event, analysis) {
  const hasActual = event.actual != null && event.actual !== '';

  if (!hasActual) {
    return [
      `🔔 <b>EVENTO MACRO — RESULTADO PENDENTE</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📅 ${event.title}`,
      `🕐 ${formatBrt(event.datetime_utc)}`,
      ``,
      `⚠ <b>Valor real ainda não disponível na fonte automática.</b>`,
      `A fonte gratuita (ForexFactory) pode demorar para publicar o actual.`,
      `Verifique: <a href="https://www.forexfactory.com/calendar">ForexFactory ↗</a>`,
      ``,
      `Não gerar leitura final. Aguardar confirmação.`,
      `CryptoWatch Intelligence`,
    ].join('\n');
  }

  const fNum = parseFloat(event.forecast ?? '');
  const aNum = parseFloat(event.actual   ?? '');
  const surpriseRaw  = !isNaN(fNum) && !isNaN(aNum) ? aNum - fNum : null;
  const surprisePct  = surpriseRaw != null && fNum !== 0
    ? ((surpriseRaw / Math.abs(fNum)) * 100).toFixed(1)
    : null;
  const arrowLabel   = surpriseRaw === null ? '→ N/D'
    : surpriseRaw > 0  ? '▲ Acima do previsto'
    : surpriseRaw < 0  ? '▼ Abaixo do previsto'
    : '= Conforme previsto';

  const conf     = analysis.confidence       ?? 0;
  const probUp   = analysis.probability_up   ?? 0;
  const probDown = analysis.probability_down ?? 0;
  const aiTag    = analysis.source === 'claude' ? '🤖 Claude AI' : '📐 Análise Heurística';

  const lines = [
    `✅ <b>RESULTADO MACRO PUBLICADO</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 <b>${event.title}</b>`,
    `🕐 ${formatBrt(event.datetime_utc)}`,
    ``,
    `<b>Real:</b> <code>${event.actual}</code> | <b>Prev:</b> <code>${event.forecast ?? '—'}</code> | <b>Ant:</b> <code>${event.previous ?? '—'}</code>`,
    surprisePct != null
      ? `<b>Surpresa:</b> ${surpriseRaw > 0 ? '+' : ''}${surpriseRaw?.toFixed(2)} (${surprisePct > 0 ? '+' : ''}${surprisePct}%)`
      : '',
    `${arrowLabel}`,
    ``,
    `${aiTag} (confiança: ${conf}%)`,
    `${analysis.summary}`,
    ``,
    `<b>BTC</b> ${biasEmoji(analysis.btc_bias)} | 🔴 ${probDown}% baixa | 🟢 ${probUp}% alta`,
    ``,
    analysis.trade_guidance ? `📋 ${analysis.trade_guidance}` : '',
    analysis.do_not_trade_warning ? `⛔ ${analysis.do_not_trade_warning}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `CryptoWatch Intelligence`,
  ].filter(l => l !== '');

  return lines.join('\n');
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    apikey:          SUPABASE_SERVICE_ROLE_KEY,
    Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type':  'application/json',
  };
}

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supabaseHeaders() });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Supabase GET ${path} ${res.status}: ${t.slice(0,200)}`); }
  return res.json();
}

async function supabasePost(table, body, prefer = 'return=minimal') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...supabaseHeaders(), Prefer: prefer },
    body:    JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Supabase POST ${table} ${res.status}: ${t.slice(0,200)}`); }
  return prefer.includes('return=') && !prefer.includes('minimal') ? res.json() : null;
}

async function supabasePatch(table, filter, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method:  'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); console.warn(`Supabase PATCH ${table} ${res.status}: ${t.slice(0,200)}`); }
}

/** Verifica se notificação já foi enviada (anti-duplicação). */
async function notificationAlreadySent(eventId, notificationType, dateBrt = null) {
  try {
    let filter = `notification_type=eq.${notificationType}&status=eq.sent`;
    if (notificationType === 'daily_summary' && dateBrt) {
      filter += `&notification_date_brt=eq.${dateBrt}`;
    } else if (eventId) {
      filter += `&event_id=eq.${encodeURIComponent(eventId)}`;
    }
    const rows = await supabaseGet(`economic_calendar_notifications?${filter}&limit=1`);
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.warn('[notify] Erro ao verificar anti-dup:', String(err));
    return false; // permite envio se verificação falhar
  }
}

/** Registra notificação no banco para anti-duplicação. */
async function recordNotification(eventId, notificationType, dateBrt, payload, telegramMsgId = null) {
  try {
    const row = {
      event_id:              eventId ?? null,
      notification_type:     notificationType,
      notification_date_brt: dateBrt ?? null,
      sent_at:               new Date().toISOString(),
      channel:               'telegram',
      status:                'sent',
      telegram_message_id:   telegramMsgId ? String(telegramMsgId) : null,
      payload:               payload ?? null,
    };
    // ON CONFLICT — ignora duplicata silenciosamente
    await fetch(`${SUPABASE_URL}/rest/v1/economic_calendar_notifications`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body:    JSON.stringify(row),
    });
  } catch (err) {
    console.warn('[notify] Erro ao registrar notificação:', String(err));
  }
}

/** Busca eventos do dia (BRT) com importância alta. */
async function fetchTodaysEvents() {
  const now   = new Date();
  const brt   = toBrt(now);
  const todayBrt = `${brt.getUTCFullYear()}-${padTwo(brt.getUTCMonth() + 1)}-${padTwo(brt.getUTCDate())}`;
  // BRT midnight em UTC = BRT dia às 00:00 → UTC +3h
  const startUtc = new Date(`${todayBrt}T03:00:00.000Z`).toISOString();
  const endUtc   = new Date(`${todayBrt}T26:59:59.999Z`).toISOString(); // 26h = +3h próximo dia
  const realEnd  = new Date(new Date(`${todayBrt}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

  const filter = `datetime_utc=gte.${startUtc}&datetime_utc=lt.${realEnd}&importance=eq.3&order=datetime_utc.asc`;
  return supabaseGet(`economic_calendar_events?${filter}&limit=30`);
}

/** Busca eventos próximos (±40 min) para alerta pré. */
async function fetchUpcomingEvents() {
  const now  = new Date();
  const from = new Date(now.getTime() -  2 * 60 * 1000).toISOString(); // -2 min tolerância
  const to   = new Date(now.getTime() + 40 * 60 * 1000).toISOString(); // +40 min
  const filter = `datetime_utc=gte.${from}&datetime_utc=lte.${to}&importance=eq.3&order=datetime_utc.asc`;
  return supabaseGet(`economic_calendar_events?${filter}&limit=20`);
}

/** Busca eventos recém-liberados (actual disponível, últimas 3h). */
async function fetchRecentlyReleasedEvents() {
  const now  = new Date();
  const from = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const filter = `datetime_utc=gte.${from}&datetime_utc=lt.${now.toISOString()}&actual=not.is.null&importance=eq.3&order=datetime_utc.asc`;
  return supabaseGet(`economic_calendar_events?${filter}&limit=20`);
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[telegram] Não configurado — mensagem não enviada.');
    return null;
  }
  // Truncar para evitar erro 400 do Telegram (máx 4096 chars)
  const safeText = text.length > 4000 ? text.slice(0, 3990) + '…' : text;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: safeText, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[telegram] Erro ${res.status}: ${t.slice(0, 200)}`);
      return null;
    }
    const body = await res.json();
    return body?.result?.message_id ?? null;
  } catch (err) {
    console.warn('[telegram] Falha na chamada:', String(err));
    return null;
  }
}

// ─── Etapas do job ─────────────────────────────────────────────────────────────

async function runDailySummary() {
  const hourBrt = currentHourBrt();
  // Janela: entre 07:55 (04:55 UTC) e 09:05 (06:05 UTC)
  if (hourBrt < 7 || hourBrt > 9) {
    console.log(`[daily] Fora da janela (hora BRT: ${hourBrt}). Pulando.`);
    return 0;
  }

  const todayBrt = todayBrtDateStr();
  const alreadySent = await notificationAlreadySent(null, 'daily_summary', todayBrt);
  if (alreadySent) {
    console.log(`[daily] Já enviado hoje (${todayBrt}). Pulando.`);
    return 0;
  }

  const events = await fetchTodaysEvents();
  if (!Array.isArray(events) || events.length === 0) {
    console.log('[daily] Nenhum evento ★★★ hoje.');
    // Registrar como skipped para evitar recheck desnecessário
    await recordNotification(null, 'daily_summary', todayBrt, { events: 0 });
    return 0;
  }

  const msg   = buildDailySummaryMessage(events);
  const msgId = await sendTelegramMessage(msg);
  await recordNotification(null, 'daily_summary', todayBrt, { events_count: events.length, event_titles: events.map(e => e.title) }, msgId);
  console.log(`[daily] ✅ Enviado — ${events.length} eventos · msg_id=${msgId}`);
  return 1;
}

async function runPreEventAlerts() {
  const events = await fetchUpcomingEvents();
  if (!Array.isArray(events)) return 0;

  let sent = 0;
  for (const event of events) {
    const minutesUntil = (new Date(event.datetime_utc).getTime() - Date.now()) / 60_000;
    if (minutesUntil < 4 || minutesUntil > 35) continue;

    const alreadySent = await notificationAlreadySent(event.id, 'pre_5min');
    if (alreadySent) { console.log(`[pre] Já enviado: ${event.title}`); continue; }

    console.log(`[pre] ${event.title} — em ${minutesUntil.toFixed(1)}min — gerando análise...`);
    const analysis = await getAnalysis(event, 'pre');
    const msg      = buildPreEventMessage(event, analysis);
    const msgId    = await sendTelegramMessage(msg);

    await recordNotification(event.id, 'pre_5min', null, { analysis_source: analysis.source, minutes_until: minutesUntil.toFixed(1) }, msgId);
    // Atualiza notify_state no evento para rastreamento legado
    await supabasePatch('economic_calendar_events', `id=eq.${encodeURIComponent(event.id)}`, { notify_state: 'pre_sent' });
    sent++;
  }
  return sent;
}

async function runPostReleaseAlerts() {
  const events = await fetchRecentlyReleasedEvents();
  if (!Array.isArray(events)) return 0;

  let sent = 0;
  for (const event of events) {
    const alreadySent = await notificationAlreadySent(event.id, 'post_release');
    if (alreadySent) { console.log(`[post] Já enviado: ${event.title}`); continue; }

    console.log(`[post] ${event.title} — actual: ${event.actual ?? 'AUSENTE'}`);
    const analysis = await getAnalysis(event, 'post');
    const msg      = buildPostEventMessage(event, analysis);
    const msgId    = await sendTelegramMessage(msg);

    await recordNotification(event.id, 'post_release', null, {
      actual:          event.actual,
      analysis_source: analysis.source,
      btc_bias:        analysis.btc_bias,
    }, msgId);
    await supabasePatch('economic_calendar_events', `id=eq.${encodeURIComponent(event.id)}`, { notify_state: 'post_sent' });
    sent++;
  }
  return sent;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }

  const startTime = Date.now();
  const nowIso    = new Date().toISOString();
  const hourBrt   = currentHourBrt();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  notify-economic-calendar.mjs');
  console.log(`  Início: ${nowIso} | hora BRT: ${hourBrt}h`);
  console.log(`  Claude: ${ANTHROPIC_API_KEY ? `sim (${CLAUDE_MODEL})` : 'não — fallback rule-based'}`);
  console.log(`  Telegram: ${TELEGRAM_BOT_TOKEN ? 'configurado' : 'não configurado'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const [dailySent, preSent, postSent] = await Promise.all([
    runDailySummary(),
    runPreEventAlerts(),
    runPostReleaseAlerts(),
  ]);

  const durationMs = Date.now() - startTime;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Daily summary:   ${dailySent}`);
  console.log(`  Pré-evento:      ${preSent}`);
  console.log(`  Pós-evento:      ${postSent}`);
  console.log(`  Duração:         ${durationMs}ms`);
  console.log(`  Status:          ✅ Concluído`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Log no system_job_log
  try {
    await supabasePost('system_job_log', {
      job_name:       'notify-economic-calendar',
      status:         'success',
      alerts_sent:    dailySent + preSent + postSent,
      duration_ms:    durationMs,
      metadata: { daily_sent: dailySent, pre_sent: preSent, post_sent: postSent, hour_brt: hourBrt, claude_available: !!ANTHROPIC_API_KEY },
    });
  } catch { /* não crítico */ }
}

main().catch(async (err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ERRO FATAL:', String(err));
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/system_job_log`, {
      method:  'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ job_name: 'notify-economic-calendar', status: 'error', error_message: String(err) }),
    });
  } catch { /* ignorar */ }
  process.exit(1);
});
