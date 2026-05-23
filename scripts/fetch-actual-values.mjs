#!/usr/bin/env node
/**
 * fetch-actual-values.mjs
 * Preenche o campo `actual` em economic_calendar_events para eventos já liberados
 * usando FRED API (St. Louis Fed) — cobre USD, GBP, AUD e CAD via séries OECD/FRED.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FRED_API_KEY
 *
 * Executa como GitHub Action a cada hora. Seguro rodar várias vezes (idempotente).
 */

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FRED_API_KEY              = process.env.FRED_API_KEY;
const FRED_BASE                 = 'https://api.stlouisfed.org/fred';

// ─── Mapeamento evento → série FRED ──────────────────────────────────────────
// transform:
//   'direct'      = usar valor diretamente como string
//   'direct_pct'  = valor já é %, formatar com 1 decimal + "%"
//   'mom_pct'     = calcular variação m/m % a partir da série de nível
//   'yoy_pct'     = calcular variação a/a % a partir da série de nível
//   'mom_abs_k'   = variação absoluta mensal em milhares → "23K"
//   'raw_k'       = valor absoluto ÷ 1000 → "220K" (ex: initial claims)

const SERIES_MAP = [
  // ── USD ────────────────────────────────────────────────────────────────────
  { currency: 'USD', title: /unemployment.?claims/i,
    series: 'ICSA', transform: 'raw_k' },                    // initial claims

  { currency: 'USD', title: /nonfarm.?payroll|non.?farm|^nfp/i,
    series: 'PAYEMS', transform: 'mom_abs_k' },              // NFP net change

  { currency: 'USD', title: /\bcpi\b.*m\/m/i,
    series: 'CPALTT01USM657N', transform: 'direct_pct' },    // US CPI m/m % (FRED direto)

  { currency: 'USD', title: /\bcpi\b.*y\/y/i,
    series: 'CPALTT01USM659N', transform: 'direct_pct' },    // US CPI y/y %

  { currency: 'USD', title: /core.*cpi.*m\/m|cpi.*core.*m\/m/i,
    series: 'CPILFESL', transform: 'mom_pct' },              // Core CPI nível → m/m

  { currency: 'USD', title: /retail.?sales.*m\/m/i,
    series: 'RSXFS', transform: 'mom_pct' },                 // Retail Sales nível → m/m

  { currency: 'USD', title: /philly.?fed|philadelphia.?fed/i,
    series: 'PHIL', transform: 'direct' },                   // Philly Fed index

  { currency: 'USD', title: /\bgdp\b.*q\/q/i,
    series: 'A191RL1Q225SBEA', transform: 'direct_pct' },    // GDP q/q %

  { currency: 'USD', title: /\bpce\b.*price.*m\/m/i,
    series: 'CPALTT01USM657N', transform: 'direct_pct' },    // PCE proxy via CPI m/m

  { currency: 'USD', title: /jolts|job.?opening/i,
    series: 'JTSJOL', transform: 'raw_k' },                  // JOLTS em milhares

  { currency: 'USD', title: /ism.?manufacturing|manufacturing.?pmi/i,
    series: 'NAPM', transform: 'direct' },                   // ISM Manufacturing

  { currency: 'USD', title: /ism.?services|services.?pmi|non.?manufacturing/i,
    series: 'NMFCI', transform: 'direct' },                  // ISM Services

  // ── GBP ────────────────────────────────────────────────────────────────────
  { currency: 'GBP', title: /\bcpi\b.*y\/y/i,
    series: 'CPALTT01GBM659N', transform: 'direct_pct' },    // UK CPI y/y %

  { currency: 'GBP', title: /\bcpi\b.*m\/m/i,
    series: 'CPALTT01GBM657N', transform: 'direct_pct' },    // UK CPI m/m %

  { currency: 'GBP', title: /claimant.?count/i,
    series: 'ICCLAIMGBRNSA', transform: 'mom_abs_k' },       // UK claimant count change

  { currency: 'GBP', title: /average.?earnings|earnings.?index/i,
    series: 'LCEAXUKSAM', transform: 'direct_pct' },         // UK Average Earnings

  { currency: 'GBP', title: /retail.?sales.*m\/m/i,
    series: 'RTSM0NSGBM657N', transform: 'direct_pct' },     // UK Retail Sales m/m %

  { currency: 'GBP', title: /gdp.*m\/m|gdp.*q\/q/i,
    series: 'CLVMNACSCAB1GQGB', transform: 'mom_pct' },      // UK GDP

  // ── AUD ────────────────────────────────────────────────────────────────────
  { currency: 'AUD', title: /unemployment.?rate/i,
    series: 'LRUNTTTTAUM156S', transform: 'direct_pct' },    // AUS unemployment %

  { currency: 'AUD', title: /employment.?change/i,
    series: 'LFEMTTTTAUM647S', transform: 'mom_abs_k' },     // AUS employment change

  { currency: 'AUD', title: /\bcpi\b.*q\/q/i,
    series: 'CPALTT01AUQ657N', transform: 'direct_pct' },    // AUS CPI q/q %

  // ── CAD ────────────────────────────────────────────────────────────────────
  { currency: 'CAD', title: /\bcpi\b.*m\/m/i,
    series: 'CPALTT01CAM657N', transform: 'direct_pct' },    // CAD CPI m/m %

  { currency: 'CAD', title: /\bcpi\b.*y\/y/i,
    series: 'CPALTT01CAM659N', transform: 'direct_pct' },    // CAD CPI y/y %

  // ── JPY ────────────────────────────────────────────────────────────────────
  { currency: 'JPY', title: /\bcpi\b.*y\/y/i,
    series: 'CPALTT01JPM659N', transform: 'direct_pct' },    // JPN CPI y/y %
];

// Eventos sem valor numérico — pular silenciosamente
const NO_ACTUAL = /meeting.?minutes|speaks?|testimony|press.?confer|statement|hearing|speech|report hearings?/i;

// ─── FRED API ─────────────────────────────────────────────────────────────────

async function fetchFredSeries(seriesId, observationEnd, limit = 15) {
  const params = new URLSearchParams({
    series_id:       seriesId,
    api_key:         FRED_API_KEY,
    file_type:       'json',
    sort_order:      'desc',
    limit:           String(limit),
    observation_end: observationEnd.slice(0, 10),
  });
  const res = await fetch(`${FRED_BASE}/series/observations?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`FRED ${seriesId} HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const obs = (json.observations ?? [])
    .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
    .reverse(); // cronológico
  return obs;
}

function applyTransform(obs, transform, seriesId) {
  if (obs.length === 0) return null;
  const latest = obs[obs.length - 1];
  const lv = parseFloat(latest.value);

  switch (transform) {
    case 'direct':
      return String(parseFloat(lv.toFixed(2)));

    case 'direct_pct':
      return `${parseFloat(lv.toFixed(1))}%`;

    case 'raw_k': {
      // ICSA, JOLTS: valores absolutos em unidades → dividir por 1000
      const inK = lv >= 1000 ? Math.round(lv / 1000) : Math.round(lv); // já pode estar em K
      return `${inK}K`;
    }

    case 'mom_pct': {
      if (obs.length < 2) return null;
      const pv = parseFloat(obs[obs.length - 2].value);
      if (pv === 0) return null;
      const pct = ((lv - pv) / Math.abs(pv)) * 100;
      return `${parseFloat(pct.toFixed(1))}%`;
    }

    case 'yoy_pct': {
      // Precisa de 13 observações para comparar com mesmo mês do ano anterior
      if (obs.length < 13) return null;
      const pv = parseFloat(obs[obs.length - 13].value);
      if (pv === 0) return null;
      const pct = ((lv - pv) / Math.abs(pv)) * 100;
      return `${parseFloat(pct.toFixed(1))}%`;
    }

    case 'mom_abs_k': {
      // NFP, Employment Change: variação absoluta mensal → "23K"
      if (obs.length < 2) return null;
      const pv = parseFloat(obs[obs.length - 2].value);
      const diff = lv - pv;
      // PAYEMS retorna em milhares? Não — retorna em unidades (ex: 158,000,000)
      // LFEMTTTTAUM647S retorna em milhares
      const isMillions = seriesId === 'PAYEMS';
      const inK = isMillions
        ? Math.round(diff / 1000)   // PAYEMS: 158M → diff em unidades → /1000 para K
        : Math.round(diff);          // LFEMTTTTAUM647S: já em milhares
      const sign = inK > 0 ? '+' : '';
      return `${sign}${inK}K`;
    }

    default:
      return null;
  }
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function sbHeaders() {
  return {
    apikey:         SUPABASE_SERVICE_ROLE_KEY,
    Authorization:  `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function getPendingEvents() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/economic_calendar_events`
    + `?actual=is.null`
    + `&status=eq.released`
    + `&datetime_utc=gte.${encodeURIComponent(cutoff)}`
    + `&order=datetime_utc.asc`
    + `&limit=50`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase query falhou: ${res.status} — ${txt}`);
  }
  return res.json();
}

async function updateActual(id, actual, source) {
  const url = `${SUPABASE_URL}/rest/v1/economic_calendar_events?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body:    JSON.stringify({ actual, source_url: source, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PATCH ${id} falhou: ${res.status} — ${txt}`);
  }
}

async function logJob(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/system_job_log`, {
    method:  'POST',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body:    JSON.stringify({
      job_name:       'fetch-actual-values',
      status:         data.status,
      events_found:   data.found ?? 0,
      events_updated: data.updated ?? 0,
      duration_ms:    data.durationMs ?? 0,
      error_message:  data.error ?? null,
      metadata:       data,
    }),
  }).catch(() => {});
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  if (!FRED_API_KEY)  throw new Error('FRED_API_KEY é obrigatório — gerar em https://fred.stlouisfed.org/docs/api/api_key.html');

  const t0  = Date.now();
  const now = new Date();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  fetch-actual-values.mjs');
  console.log(`  Início: ${now.toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const pending = await getPendingEvents();
  console.log(`  Eventos released sem actual: ${pending.length}`);

  let updated = 0, skipped = 0, errors = 0;

  for (const event of pending) {
    const { id, title, currency, datetime_utc } = event;

    // Pular eventos sem valor numérico (atas, discursos)
    if (NO_ACTUAL.test(title)) {
      console.log(`  [skip] ${title} (${currency}) — sem valor numérico`);
      skipped++;
      continue;
    }

    // Encontrar série FRED correspondente
    const mapping = SERIES_MAP.find(m => m.currency === currency && m.title.test(title));
    if (!mapping) {
      console.log(`  [skip] ${title} (${currency}) — sem mapeamento FRED`);
      skipped++;
      continue;
    }

    console.log(`  [fetch] ${title} (${currency}) → FRED:${mapping.series}`);

    try {
      // Para YoY precisamos de 15 obs; para os demais, 3 são suficientes
      const limit = mapping.transform === 'yoy_pct' ? 15 : 3;
      const obs   = await fetchFredSeries(mapping.series, datetime_utc, limit);

      if (obs.length === 0) {
        console.warn(`  [warn] FRED:${mapping.series} — 0 observações para ${datetime_utc.slice(0,10)}`);
        skipped++;
        continue;
      }

      const actual = applyTransform(obs, mapping.transform, mapping.series);
      if (actual === null) {
        console.warn(`  [warn] transform "${mapping.transform}" retornou null para ${mapping.series}`);
        skipped++;
        continue;
      }

      await updateActual(id, actual, `FRED:${mapping.series}:${obs[obs.length-1].date}`);
      console.log(`  [ok]   ${title} → actual="${actual}" (FRED:${mapping.series}:${obs[obs.length-1].date})`);
      updated++;

      // Rate limit: ~10 req/s permitido pelo FRED
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.warn(`  [err]  ${title} (${mapping.series}): ${String(err).slice(0, 120)}`);
      errors++;
    }
  }

  const durationMs = Date.now() - t0;
  const status = errors > 0 && updated === 0 ? 'error' : errors > 0 ? 'partial' : 'success';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Encontrados: ${pending.length}  |  Atualizados: ${updated}  |  Skipped: ${skipped}  |  Erros: ${errors}`);
  console.log(`  Duração:     ${durationMs}ms`);
  console.log(`  Status:      ${status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌'} ${status}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await logJob({ status, found: pending.length, updated, skipped, errors, durationMs });
}

main().catch(async err => {
  console.error('ERRO FATAL:', String(err));
  await fetch(`${SUPABASE_URL}/rest/v1/system_job_log`, {
    method:  'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ job_name: 'fetch-actual-values', status: 'error', error_message: String(err), events_found: 0, events_updated: 0, duration_ms: 0 }),
  }).catch(() => {});
  process.exit(1);
});
