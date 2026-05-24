#!/usr/bin/env node
/**
 * fetch-finnhub-calendar.mjs
 * Coleta eventos de alta importância via Finnhub Economic Calendar API.
 * Finnhub classifica PMI Flash, Retail Sales, Consumer Sentiment como "high" —
 * cobrindo o gap do feed ForexFactory que os classifica como "medium".
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FINNHUB_API_KEY
 * Docs: https://finnhub.io/docs/api/economic-calendar
 */

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FINNHUB_API_KEY           = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE              = 'https://finnhub.io/api/v1/calendar/economic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(date) {
  return date.toISOString().slice(0, 10);
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function generateId(event) {
  const cur  = (event.country ?? 'XX').toUpperCase();
  const slug = slugify(event.event ?? 'unknown');
  const dt   = (event.time ?? '').replace(/-/g, '').slice(0, 8);
  return `fh_${cur}_${slug}_${dt}`;
}

// Converte o campo time do Finnhub para UTC ISO string.
// Finnhub retorna "YYYY-MM-DD" — sem hora, presumimos 00:00Z.
function toUtcIso(timeStr) {
  if (!timeStr) return new Date(0).toISOString();
  // Formato "YYYY-MM-DD" ou "YYYY-MM-DD HH:MM:SS"
  const s = String(timeStr).trim();
  if (s.length === 10) return `${s}T00:00:00.000Z`;
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function toBrtIso(utcIso) {
  try {
    const ms  = new Date(utcIso).getTime() - 3 * 60 * 60 * 1000;
    return new Date(ms).toISOString().replace('Z', '-03:00');
  } catch {
    return '1970-01-01T00:00:00-03:00';
  }
}

// ─── AI Analysis (igual ao script ForexFactory) ───────────────────────────────

function generateAiAnalysis(eventName) {
  const t = (eventName ?? '').toLowerCase();
  if (/fomc|federal open|interest rate decision|fed rate/.test(t))
    return { analysis: 'Decisão do Fed. Volatilidade extrema esperada.', direction: 'neutral', probability: 0.60 };
  if (/\bcpi\b|consumer price|pce|inflation/.test(t))
    return { analysis: 'Dado de inflação. Acima do previsto=bearish BTC; abaixo=bullish.', direction: 'neutral', probability: 0.55 };
  if (/nfp|nonfarm|non.?farm|payroll/.test(t))
    return { analysis: 'NFP acima do esperado = hawkish → BTC cai. Abaixo = dovish → BTC sobe.', direction: 'neutral', probability: 0.55 };
  if (/\bgdp\b|gross domestic/.test(t))
    return { analysis: 'Crescimento forte = Fed hawkish. Crescimento fraco = dovish, favorável BTC.', direction: 'neutral', probability: 0.52 };
  if (/pmi|purchasing managers/.test(t))
    return { analysis: 'PMI acima de 50 = expansão. Abaixo = contração → risco de recessão.', direction: 'neutral', probability: 0.52 };
  if (/retail.?sales/.test(t))
    return { analysis: 'Vendas no varejo. Forte = hawkish = bearish BTC. Fraco = dovish = bullish.', direction: 'neutral', probability: 0.52 };
  if (/consumer.?sentiment|michigan|confidence/.test(t))
    return { analysis: 'Confiança do consumidor. Queda = fraqueza econômica → possível dovish Fed.', direction: 'neutral', probability: 0.51 };
  if (/initial claims|jobless claims|unemployment claims/.test(t))
    return { analysis: 'Aumento de pedidos = fraqueza do emprego → Fed dovish → BTC favorável.', direction: 'up', probability: 0.51 };
  if (/jolts|job.?opening/.test(t))
    return { analysis: 'Vagas de emprego. Queda = mercado esfriando → possivelmente dovish.', direction: 'neutral', probability: 0.50 };
  return { analysis: 'Evento macro de alta importância. Monitorar resultado vs consenso.', direction: 'neutral', probability: 0.50 };
}

// ─── Fetch Finnhub ────────────────────────────────────────────────────────────

async function fetchFinnhubWindow(from, to) {
  const url = `${FINNHUB_BASE}?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json.economicCalendar) ? json.economicCalendar : [];
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    apikey:         SUPABASE_SERVICE_ROLE_KEY,
    Authorization:  `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function upsertToSupabase(rows) {
  if (rows.length === 0) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/economic_calendar_events`, {
    method:  'POST',
    headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upsert falhou: ${res.status} — ${text}`);
  }
  return rows.length;
}

async function logJobToSupabase(jobData) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/system_job_log`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        job_name:       'fetch-finnhub-calendar',
        status:         jobData.status,
        events_found:   jobData.total_received ?? 0,
        events_updated: jobData.total_upserted ?? 0,
        alerts_sent:    0,
        duration_ms:    jobData.duration_ms ?? 0,
        error_message:  jobData.message ?? null,
        metadata:       jobData,
      }),
    });
  } catch { /* não crítico */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FINNHUB_API_KEY) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e FINNHUB_API_KEY são obrigatórios');
  }

  const startTime = Date.now();
  const now = new Date();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  fetch-finnhub-calendar.mjs');
  console.log(`  Início: ${now.toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Janela: 14 dias atrás até 14 dias à frente
  const from = toYMD(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
  const to   = toYMD(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));

  console.log(`  Período: ${from} → ${to}`);

  let allEvents;
  try {
    allEvents = await fetchFinnhubWindow(from, to);
  } catch (err) {
    throw new Error(`Finnhub fetch falhou: ${err.message}`);
  }

  console.log(`  Total recebido: ${allEvents.length}`);

  // Breakdown por impacto
  const byImpact = allEvents.reduce((acc, e) => {
    const k = e.impact ?? 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  console.log('  [debug] Por impacto:', JSON.stringify(byImpact));

  // Filtrar apenas High Impact
  const seen = new Set();
  const highImpact = [];
  for (const e of allEvents) {
    if (String(e.impact ?? '').toLowerCase() !== 'high') continue;
    const id = generateId(e);
    if (seen.has(id)) continue;
    seen.add(id);
    highImpact.push(e);
  }

  console.log(`  High impact (únicos): ${highImpact.length}`);

  if (highImpact.length > 0) {
    console.log('  [verify] Eventos High Impact Finnhub:');
    highImpact.forEach(e => {
      const utc = toUtcIso(e.time);
      const country = (e.country ?? '??').padEnd(3);
      const name    = (e.event ?? '?').padEnd(45);
      const est     = e.estimate != null ? String(e.estimate) : '-';
      const prev    = e.prev    != null ? String(e.prev)     : '-';
      const actual  = e.actual  != null ? String(e.actual)   : '-';
      console.log(`    [HIGH] ${utc.slice(0,16)}Z ${country} | ${name} | prev="${prev}" est="${est}" actual="${actual}"`);
    });
  }

  const rows = [];
  for (const e of highImpact) {
    try {
      const utcIso    = toUtcIso(e.time);
      const ai        = generateAiAnalysis(e.event);
      const hasActual = e.actual != null && String(e.actual).trim() !== '' && String(e.actual) !== 'null';
      const utcDate   = new Date(utcIso);
      const status    = hasActual ? 'released' : utcDate < now ? 'released' : 'scheduled';

      rows.push({
        id:             generateId(e),
        source:         'finnhub.io',
        event_id:       null,
        country:        e.country ?? null,
        currency:       e.country ?? null,
        title:          e.event   ?? 'Evento desconhecido',
        datetime_utc:   utcIso,
        datetime_brt:   toBrtIso(utcIso),
        importance:     3,
        actual:         hasActual ? String(e.actual) : null,
        forecast:       e.estimate != null ? String(e.estimate) : null,
        previous:       e.prev     != null ? String(e.prev)     : null,
        unit:           e.unit     ?? null,
        status,
        ai_analysis:    ai.analysis,
        ai_probability: ai.probability,
        ai_direction:   ai.direction,
        notify_state:   null,
        raw_payload:    e,
        fetched_at:     now.toISOString(),
        source_url:     'https://finnhub.io/docs/api/economic-calendar',
      });
    } catch (err) {
      console.warn(`  [fh] Evento ignorado: "${e.event}" @ "${e.time}" — ${err.message}`);
    }
  }

  const totalUpserted = await upsertToSupabase(rows);
  const durationMs    = Date.now() - startTime;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Recebidos:   ${allEvents.length}`);
  console.log(`  High impact: ${highImpact.length}`);
  console.log(`  Upsertados:  ${totalUpserted}`);
  console.log(`  Duração:     ${durationMs}ms`);
  console.log(`  Status:      ✅ Sucesso`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await logJobToSupabase({
    status:         'success',
    source:         'finnhub',
    total_received: allEvents.length,
    total_filtered: highImpact.length,
    total_upserted: totalUpserted,
    duration_ms:    durationMs,
    period_from:    from,
    period_to:      to,
  });
}

main().catch(async (err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ERRO FATAL:', String(err));
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await logJobToSupabase({ status: 'error', message: String(err) }).catch(() => {});
  process.exit(1);
});
