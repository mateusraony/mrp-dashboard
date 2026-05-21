#!/usr/bin/env node
/**
 * fetch-investing-calendar.mjs — Coleta eventos High Impact via ForexFactory (faireconomy.media)
 * Sem API key. Feed JSON público, sem bloqueio de IP.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FEEDS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json?version=2',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json?version=2',
];

// ─── Parsing de data/hora ─────────────────────────────────────────────────────

/**
 * Converte data "2026-05-21" + hora "13:30:00" para Date UTC.
 * O feed faireconomy.media usa UTC.
 */
function parseToUtc(dateStr, timeStr) {
  const time = (timeStr && timeStr !== 'Tentative' && timeStr !== 'All Day')
    ? timeStr
    : '00:00:00';
  return new Date(`${dateStr}T${time}Z`);
}

function toBrtIso(utcDate) {
  const brtMs = utcDate.getTime() - 3 * 60 * 60 * 1000;
  return new Date(brtMs).toISOString().replace('Z', '-03:00');
}

// ─── Geração de ID estável ────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function generateEventId(event) {
  const utc  = parseToUtc(event.date, event.time);
  const dt   = utc.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const slug = slugify(event.title ?? 'unknown');
  const cur  = (event.country ?? 'XX').toUpperCase();
  return `ff_${cur}_${slug}_${dt}`;
}

// ─── AI Analysis (rule-based) ─────────────────────────────────────────────────

function generateAiAnalysis(event) {
  const t   = (event.title ?? '').toLowerCase();
  const frc = event.forecast ?? '';
  const prv = event.previous ?? '';
  const fNum = parseFloat(frc);
  const pNum = parseFloat(prv);
  const canCompare = !isNaN(fNum) && !isNaN(pNum);

  if (/fomc|federal open|interest rate decision|fed rate/.test(t)) {
    return { analysis: 'Decisão do Fed. Volatilidade extrema esperada. Manutenção: neutro. Alta: bearish BTC. Corte: bullish.', direction: 'neutral', probability: 0.60 };
  }
  if (/\bcpi\b|consumer price|pce|inflation/.test(t)) {
    if (canCompare) {
      if (fNum > pNum) return { analysis: 'CPI/PCE acima do anterior → pressão inflacionária → Fed hawkish → BTC cai.', direction: 'down', probability: 0.63 };
      if (fNum < pNum) return { analysis: 'CPI/PCE abaixo do anterior → desinflação → Fed dovish → BTC favorável.', direction: 'up', probability: 0.59 };
    }
    return { analysis: 'Dado de inflação. Acima do previsto=bearish BTC; abaixo=bullish.', direction: 'neutral', probability: 0.50 };
  }
  if (/nfp|nonfarm|non-farm|payroll|non farm/.test(t)) {
    return { analysis: 'NFP acima do esperado = hawkish → BTC cai. Abaixo = dovish → BTC sobe.', direction: 'neutral', probability: 0.55 };
  }
  if (/\bgdp\b|gross domestic/.test(t)) {
    return { analysis: 'Crescimento forte = Fed hawkish. Crescimento fraco = Fed dovish, favorável BTC.', direction: 'neutral', probability: 0.52 };
  }
  if (/initial claims|jobless claims|unemployment claims/.test(t)) {
    return { analysis: 'Aumento de pedidos = fraqueza do emprego → Fed dovish → BTC favorável.', direction: 'up', probability: 0.51 };
  }
  if (/jolts|job openings/.test(t)) {
    return { analysis: 'Vagas de emprego. Queda = mercado esfriando → possivelmente dovish.', direction: 'neutral', probability: 0.50 };
  }
  if (/retail sales/.test(t)) {
    return { analysis: 'Vendas no varejo. Forte = hawkish = bearish BTC. Fraco = dovish = bullish.', direction: 'neutral', probability: 0.52 };
  }
  if (/\bpmi\b|purchasing managers/.test(t)) {
    return { analysis: 'PMI acima de 50 = expansão. Abaixo = contração → risco de recessão.', direction: 'neutral', probability: 0.52 };
  }
  return { analysis: 'Evento macro de alta importância. Monitorar resultado vs consenso.', direction: 'neutral', probability: 0.50 };
}

// ─── Fetch com retry ──────────────────────────────────────────────────────────

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const delays = [1000, 2000, 4000];
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(tid);
      if (res.status === 429) throw new Error('Rate limit (429)');
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          console.warn(`[ff] Status ${res.status} tentativa ${attempt + 1}. Aguardando ${delays[attempt]}ms...`);
          await new Promise(r => setTimeout(r, delays[attempt]));
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        throw new Error(`HTTP ${res.status} após ${maxRetries} tentativas`);
      }
      return res;
    } catch (err) {
      clearTimeout(tid);
      if (String(err).includes('429')) throw err;
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`[ff] Erro tentativa ${attempt + 1}: ${String(err)}. Aguardando ${delays[attempt] ?? 4000}ms...`);
        await new Promise(r => setTimeout(r, delays[attempt] ?? 4000));
      }
    }
  }
  throw lastError;
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
    // não crítico
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }

  const startTime = Date.now();
  const now = new Date();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  fetch-investing-calendar.mjs (via ForexFactory/faireconomy.media)');
  console.log(`  Início: ${now.toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Busca esta semana + próxima semana em paralelo
  const results = await Promise.allSettled(
    FEEDS.map(url => fetchWithRetry(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
      return r.json();
    }))
  );

  const allEvents = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allEvents.push(...result.value);
      console.log(`  Feed ${i + 1}: ${result.value.length} eventos`);
    } else {
      console.warn(`  Feed ${i + 1}: falhou — ${result.reason}`);
    }
  }

  if (allEvents.length === 0) {
    throw new Error('Nenhum feed retornou dados válidos');
  }

  const totalReceived = allEvents.length;
  console.log(`  Total recebido (todas importâncias): ${totalReceived}`);

  // Deduplicar por ID (feeds podem sobrepor dias)
  const seen = new Set();
  const highImpact = allEvents.filter(e => {
    if (e.impact !== 'High') return false;
    const id = generateEventId(e);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`  High impact (únicos):                ${highImpact.length}`);

  if (highImpact.length === 0) {
    console.warn('  Aviso: nenhum evento High impact no período.');
  }

  const rows = highImpact.map(e => {
    const utcDate   = parseToUtc(e.date, e.time);
    const ai        = generateAiAnalysis(e);
    const hasActual = e.actual != null && String(e.actual).trim() !== '';
    const status    = hasActual ? 'released' : 'scheduled';

    return {
      id:             generateEventId(e),
      source:         'forexfactory.com',
      event_id:       null,
      country:        e.country ?? null,
      currency:       e.country ?? null,  // FF usa o código da moeda no campo country
      title:          e.title   ?? 'Evento desconhecido',
      datetime_utc:   utcDate.toISOString(),
      datetime_brt:   toBrtIso(utcDate),
      importance:     3,
      actual:         hasActual ? String(e.actual) : null,
      forecast:       e.forecast ? String(e.forecast) : null,
      previous:       e.previous ? String(e.previous) : null,
      unit:           null,
      status,
      ai_analysis:    ai.analysis,
      ai_probability: ai.probability,
      ai_direction:   ai.direction,
      notify_state:   null,
      raw_payload:    e,
      fetched_at:     new Date().toISOString(),
      source_url:     'https://www.forexfactory.com/calendar',
    };
  });

  const totalUpserted = await upsertToSupabase(rows);
  const durationMs    = Date.now() - startTime;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Recebidos:  ${totalReceived}`);
  console.log(`  High impact: ${highImpact.length}`);
  console.log(`  Upsertados: ${totalUpserted}`);
  console.log(`  Duração:    ${durationMs}ms`);
  console.log(`  Status:     ✅ Sucesso`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await logJobToSupabase({
    status:         'success',
    source:         'forexfactory',
    total_received: totalReceived,
    total_filtered: highImpact.length,
    total_upserted: totalUpserted,
    duration_ms:    durationMs,
  });
}

main().catch(async (err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ERRO FATAL:', String(err));
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await logJobToSupabase({ status: 'error', message: String(err) }).catch(() => {});
  process.exit(1);
});
