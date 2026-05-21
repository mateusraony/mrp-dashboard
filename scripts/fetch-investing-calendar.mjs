#!/usr/bin/env node
/**
 * fetch-investing-calendar.mjs — Coleta eventos do Investing.com (3 estrelas apenas)
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Uso: node scripts/fetch-investing-calendar.mjs
 */

import * as cheerio from 'cheerio';

// ─── Constantes ───────────────────────────────────────────────────────────────
const INVESTING_CALENDAR_URL =
  'https://sbimport.investing.com/economic-calendar/service/getCalendarFilteredData';

const INVESTING_HOME_URL = 'https://www.investing.com/economic-calendar/';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language':  'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer':          'https://www.investing.com/economic-calendar/',
};

// ─── Utilitários de data ──────────────────────────────────────────────────────

/**
 * Converte string no formato "YYYY/MM/DD HH:MM:SS" para objeto Date UTC.
 */
function parseDatetimeToUtc(str) {
  // Investing.com usa "2026/05/21 13:30:00" (já UTC quando timeZone=8)
  const normalized = str.replace(/\//g, '-').replace(' ', 'T') + 'Z';
  return new Date(normalized);
}

/**
 * Converte Data UTC para string ISO com offset -03:00 (BRT).
 */
function toBrtIso(utcDate) {
  const brtMs = utcDate.getTime() - 3 * 60 * 60 * 1000;
  const brt = new Date(brtMs);
  return brt.toISOString().replace('Z', '-03:00');
}

/**
 * Formata data para o padrão aceito pela API do Investing.com (YYYY-MM-DD).
 */
function formatDateForInvesting(date) {
  return date.toISOString().slice(0, 10);
}

// ─── Geração de análise AI (rule-based) ──────────────────────────────────────

/**
 * Gera análise, direção e probabilidade para um evento macro.
 * Lógica idêntica ao investingCalendarParser.ts do frontend.
 */
function generateAiAnalysis(event) {
  const t   = (event.title   ?? '').toLowerCase();
  const frc = event.forecast ?? '';
  const prv = event.previous ?? '';

  const fNum = parseFloat(frc);
  const pNum = parseFloat(prv);
  const canCompare = !isNaN(fNum) && !isNaN(pNum);

  // FOMC / Interest Rate decision
  if (/fomc|federal open|interest rate decision|fed rate/.test(t)) {
    return {
      analysis:    'Decisão do Fed. Volatilidade extrema esperada. Manutenção: neutro. Alta: bearish BTC. Corte: bullish.',
      direction:   'neutral',
      probability: 0.60,
    };
  }

  // CPI / PCE / Inflation
  if (/\bcpi\b|consumer price|pce|inflation|infla/.test(t)) {
    if (canCompare) {
      if (fNum > pNum) {
        return { analysis: 'CPI/PCE acima do anterior → pressão inflacionária → Fed hawkish → BTC cai.', direction: 'down', probability: 0.63 };
      }
      if (fNum < pNum) {
        return { analysis: 'CPI/PCE abaixo do anterior → desaceleração inflacionária → Fed dovish → BTC favorável.', direction: 'up', probability: 0.59 };
      }
    }
    return { analysis: 'Dado de inflação. Monitorar resultado vs consenso: acima=bearish BTC, abaixo=bullish.', direction: 'neutral', probability: 0.50 };
  }

  // NFP / Non-Farm Payroll
  if (/nfp|nonfarm|non-farm|payroll|non farm/.test(t)) {
    return {
      analysis:    'NFP acima do esperado = hawkish → BTC cai. Abaixo = dovish → BTC sobe.',
      direction:   'neutral',
      probability: 0.55,
    };
  }

  // GDP / PIB
  if (/\bgdp\b|gross domestic|pib|produto interno/.test(t)) {
    return {
      analysis:    'Crescimento forte = Fed hawkish. Crescimento fraco = Fed dovish, favorável BTC.',
      direction:   'up',
      probability: 0.52,
    };
  }

  // Initial Jobless Claims / Unemployment
  if (/initial claims|jobless claims|unemployment claims/.test(t)) {
    return {
      analysis:    'Aumento de pedidos = fraqueza do emprego → Fed dovish → BTC favorável.',
      direction:   'up',
      probability: 0.51,
    };
  }

  // JOLTS / Job Openings
  if (/jolts|job openings|vagas/.test(t)) {
    return { analysis: 'Vagas de emprego. Queda = mercado esfriando → possivelmente dovish.', direction: 'neutral', probability: 0.50 };
  }

  // Padrão
  return {
    analysis:    'Evento macro de alta importância. Monitorar resultado vs consenso.',
    direction:   'neutral',
    probability: 0.50,
  };
}

// ─── Cookies ──────────────────────────────────────────────────────────────────

/**
 * Faz GET na página inicial do Investing.com para obter cookies de sessão.
 */
async function getInitialCookies() {
  try {
    const res = await fetchWithRetry(INVESTING_HOME_URL, {
      method:  'GET',
      headers: { ...DEFAULT_HEADERS },
    });
    const cookieHeader = res.headers.get('set-cookie') ?? '';
    return cookieHeader;
  } catch (err) {
    console.warn('[fetch-investing] Aviso: não foi possível obter cookies iniciais:', String(err));
    return '';
  }
}

// ─── Fetch com retry ──────────────────────────────────────────────────────────

/**
 * Fetch com retry automático para 5xx/erros de rede.
 * Lança imediatamente em 429 (rate limit).
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  const delays = [1000, 2000, 4000];
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(tid);

      if (res.status === 429) {
        throw new Error('Rate limit (429) — abortando sem retry');
      }
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          console.warn(`[fetch-investing] Status ${res.status} na tentativa ${attempt + 1}. Aguardando ${delays[attempt]}ms...`);
          await new Promise(r => setTimeout(r, delays[attempt]));
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        throw new Error(`HTTP ${res.status} após ${maxRetries} tentativas`);
      }

      return res;
    } catch (err) {
      clearTimeout(tid);
      if (err.message?.includes('429')) throw err;
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`[fetch-investing] Erro de rede na tentativa ${attempt + 1}: ${String(err)}. Aguardando ${delays[attempt] ?? 4000}ms...`);
        await new Promise(r => setTimeout(r, delays[attempt] ?? 4000));
      }
    }
  }

  throw lastError ?? new Error('Fetch falhou após todas as tentativas');
}

// ─── Fetch do calendário ──────────────────────────────────────────────────────

/**
 * Faz POST para a API do Investing.com e retorna o HTML dos eventos.
 */
async function fetchCalendarHtml(dateFrom, dateTo, cookies) {
  const body = new URLSearchParams({
    'country[]': '5',   // USA
    dateFrom,
    dateTo,
    timeZone:    '8',   // UTC (timeZone=8 no sistema do Investing = UTC)
    timeFilter:  'timeRemain',
    currentTab:  'custom',
    limit_from:  '0',
  });

  const headers = {
    ...DEFAULT_HEADERS,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const res = await fetchWithRetry(INVESTING_CALENDAR_URL, {
    method:  'POST',
    headers,
    body:    body.toString(),
  });

  const json = await res.json();
  // A API retorna { data: "<html>...", timeframe: "..." }
  return typeof json === 'object' && json !== null && 'data' in json
    ? String(json.data)
    : String(json);
}

// ─── Parser de importância ────────────────────────────────────────────────────

/**
 * Conta ícones de touro preenchidos para determinar a importância (1-3).
 */
function parseImportance($, $row) {
  // Tenta data-importance primeiro
  const dataImp = $row.attr('data-importance');
  if (dataImp) {
    const n = parseInt(dataImp, 10);
    if (!isNaN(n) && n >= 1 && n <= 3) return n;
  }

  // Conta ícones preenchidos: ícone bull não-vazio
  const $sentimentTd = $row.find('td.sentiment');
  const filled = $sentimentTd.find('i').filter((_, el) => {
    const cls = $(el).attr('class') ?? '';
    return !cls.includes('Empty') && !cls.includes('empty');
  }).length;

  if (filled >= 3) return 3;
  if (filled === 2) return 2;
  return 1;
}

// ─── Parser de eventos ────────────────────────────────────────────────────────

/**
 * Parseia o HTML retornado pela API do Investing.com.
 * Filtra apenas eventos com importância === 3 (3 estrelas).
 */
function parseEvents(html) {
  const $ = cheerio.load(html);
  const events = [];

  $('tr.js-event-item').each((_, rowEl) => {
    const $row = $(rowEl);

    const importance = parseImportance($, $row);
    if (importance !== 3) return;

    // ID do evento
    const eventId = $row.attr('event_attr_id') ?? $row.attr('id') ?? '';

    // Data/hora (formato "YYYY/MM/DD HH:MM:SS" UTC)
    const rawDatetime = $row.attr('data-event-datetime') ?? '';
    let utcDate;
    try {
      utcDate = parseDatetimeToUtc(rawDatetime);
      if (isNaN(utcDate.getTime())) throw new Error('Data inválida');
    } catch {
      return; // Pula evento com data inválida
    }

    // Moeda / país
    const currency = $row.find('td.flagCur').text().trim() || null;

    // Título
    const title = $row.find('td.event a').first().text().trim()
      || $row.find('td.event').first().text().trim()
      || 'Evento sem título';

    // Actual / Forecast / Previous
    const actual   = $row.find('td.actual').text().trim()   || null;
    const forecast = $row.find('td.fore').text().trim()     || null;
    const previous = $row.find('td.prev').text().trim()     || null;

    const brtIso = toBrtIso(utcDate);
    const dateSlug = utcDate.toISOString().slice(0, 10).replace(/-/g, '');
    const id = `inv_${eventId}_${dateSlug}`;

    const ai = generateAiAnalysis({ title, forecast, previous, currency });

    const status = actual ? 'released' : 'scheduled';

    events.push({
      id,
      source:         'investing.com',
      event_id:       eventId || null,
      country:        'US',
      currency:       currency || 'USD',
      title,
      datetime_utc:   utcDate.toISOString(),
      datetime_brt:   brtIso,
      importance:     3,
      actual:         actual   || null,
      forecast:       forecast || null,
      previous:       previous || null,
      unit:           null,
      status,
      ai_analysis:    ai.analysis,
      ai_probability: ai.probability,
      ai_direction:   ai.direction,
      notify_state:   null,
      raw_payload:    null,
      fetched_at:     new Date().toISOString(),
      source_url:     'https://br.investing.com/economic-calendar',
    });
  });

  return events;
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

/**
 * Faz upsert dos eventos no Supabase via REST API.
 */
async function upsertToSupabase(events) {
  if (events.length === 0) return 0;

  const SUPABASE_URL           = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const url = `${SUPABASE_URL}/rest/v1/economic_calendar_events?on_conflict=id`;

  const res = await fetchWithRetry(url, {
    method:  'POST',
    headers: {
      apikey:          SUPABASE_SERVICE_ROLE_KEY,
      Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(events),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upsert falhou: ${res.status} — ${text}`);
  }

  return events.length;
}

// ─── Log de job ───────────────────────────────────────────────────────────────

/**
 * Registra resultado do job no Supabase (fire-and-forget).
 */
async function logJobToSupabase(jobData) {
  const SUPABASE_URL           = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/system_job_log`, {
      method:  'POST',
      headers: {
        apikey:         SUPABASE_SERVICE_ROLE_KEY,
        Authorization:  `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer':       'return=minimal',
      },
      body: JSON.stringify({
        job_name:       'fetch-investing-calendar',
        status:         jobData.status,
        events_found:   jobData.total_received ?? 0,
        events_updated: jobData.total_upserted ?? 0,
        alerts_sent:    0,
        duration_ms:    jobData.duration_ms ?? 0,
        error_message:  jobData.message ?? null,
        metadata:       jobData,
      }),
    });
  } catch {
    // fire-and-forget — não propaga
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Validar variáveis de ambiente
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  }

  // 2. Período: hoje-2 até hoje+7
  const now = new Date();
  const dateFromObj = new Date(now);
  dateFromObj.setDate(dateFromObj.getDate() - 2);
  const dateToObj = new Date(now);
  dateToObj.setDate(dateToObj.getDate() + 7);

  const dateFrom = formatDateForInvesting(dateFromObj);
  const dateTo   = formatDateForInvesting(dateToObj);
  const startTime = Date.now();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  fetch-investing-calendar.mjs');
  console.log(`  Período: ${dateFrom} → ${dateTo}`);
  console.log(`  Início:  ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 3. Obter cookies de sessão
  const cookies = await getInitialCookies();

  // 4. Buscar HTML do calendário
  const html = await fetchCalendarHtml(dateFrom, dateTo, cookies);

  // 5. Validar resposta
  if (html.length < 200) {
    throw new Error('Resposta muito curta — possível bloqueio do Investing.com');
  }

  // 6. Contar total de linhas recebidas
  const $ = cheerio.load(html);
  const totalReceived = $('tr.js-event-item').length;
  console.log(`  Eventos recebidos (todas importâncias): ${totalReceived}`);

  // 7. Parsear e filtrar apenas importância 3
  const events = parseEvents(html);
  const totalFiltered = events.length;
  console.log(`  Eventos filtrados (3 estrelas):         ${totalFiltered}`);

  // 8. Avisar se nenhum evento encontrado (não é erro crítico fora do horário)
  if (totalFiltered === 0) {
    console.warn('  Aviso: nenhum evento de alta importância encontrado no período.');
  }

  // 9. Upsert no Supabase
  const totalUpserted = await upsertToSupabase(events);

  const durationMs = Date.now() - startTime;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Recebidos:  ${totalReceived}`);
  console.log(`  Filtrados:  ${totalFiltered}`);
  console.log(`  Upsertados: ${totalUpserted}`);
  console.log(`  Duração:    ${durationMs}ms`);
  console.log(`  Status:     ✅ Sucesso`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 10. Registrar job no Supabase
  await logJobToSupabase({
    status:         'success',
    date_from:      dateFrom,
    date_to:        dateTo,
    total_received: totalReceived,
    total_filtered: totalFiltered,
    total_upserted: totalUpserted,
    duration_ms:    durationMs,
  });
}

main().catch(async (err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ERRO FATAL:', String(err));
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await logJobToSupabase({
    status:  'error',
    message: String(err),
  }).catch(() => {});

  process.exit(1);
});
