/**
 * macroCalendarService.ts — Calendário Macro via FRED API + Datas FOMC estáticas
 *
 * Fontes gratuitas:
 *   - FRED (St. Louis Fed): release dates + actuals para CPI, NFP, GDP, PCE, PPI, Retail
 *   - FOMC: datas oficiais 2026 (hardcoded — Fed publica um ano de antecedência)
 *
 * Sem chave FRED → retorna conjunto mock com datas calculadas programaticamente.
 * Sem consensus: dado pago (Bloomberg). Exibido como null/—.
 */

import { z } from 'zod';
import { env, DATA_MODE } from '@/lib/env';
import { logInfo, logError, logWarn } from '@/lib/debugLog';

const FRED_BASE = 'https://api.stlouisfed.org/fred';

// ─── Persistência Supabase (raw fetch — sem import circular) ─────────────────

const _env = (typeof import.meta !== 'undefined'
  ? (import.meta as Record<string, unknown>).env
  : {}) as Record<string, string>;

const _supUrl = _env?.VITE_SUPABASE_URL ?? '';
const _supKey = _env?.VITE_SUPABASE_ANON_KEY ?? '';

/** Converte string formatada ("+ 0.3%", "+185K", "4.25%") para numeric ou null. */
function parsePrevToNumeric(prev: string | null): number | null {
  if (!prev) return null;
  const cleaned = prev.replace(/[^0-9.\-+]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Persiste eventos macro em macro_event_schedule (upsert idempotente por
 * event_code + release_time_utc). Fire-and-forget — não bloqueia a UI.
 */
async function persistMacroSchedule(events: MacroCalendarEvent[]): Promise<void> {
  if (!_supUrl || !_supKey || events.length === 0) return;
  try {
    const rows = events.map(e => ({
      event_code:       e.code,
      release_time_utc: e.datetime_utc,
      status:           e.status,
      previous:         parsePrevToNumeric(e.previous),
      actual:           e.actual ? parsePrevToNumeric(e.actual) : null,
      consensus:        null,
      unit:             e.unit,
      source:           e.source,
      raw_payload:      e,
    }));
    await fetch(
      `${_supUrl}/rest/v1/macro_event_schedule?on_conflict=event_code,release_time_utc`,
      {
        method:  'POST',
        headers: {
          apikey:         _supKey,
          Authorization:  `Bearer ${_supKey}`,
          'Content-Type': 'application/json',
          Prefer:         'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
      },
    );
  } catch {
    // Silencia falhas de persistência para não impactar a UI
  }
}

// ─── Datas FOMC 2026 (Fed Reserve — federalreserve.gov/monetarypolicy/fomccalendars.htm) ─
const FOMC_2026: Array<{ date: string; time_et: string; note: string }> = [
  { date: '2026-01-28', time_et: '14:00', note: 'FOMC + Coletiva Powell' },
  { date: '2026-03-18', time_et: '14:00', note: 'FOMC + SEP + Coletiva' },
  { date: '2026-05-06', time_et: '14:00', note: 'FOMC + Coletiva' },
  { date: '2026-06-17', time_et: '14:00', note: 'FOMC + SEP + Coletiva' },
  { date: '2026-07-29', time_et: '14:00', note: 'FOMC + Coletiva' },
  { date: '2026-09-16', time_et: '14:00', note: 'FOMC + SEP + Coletiva' },
  { date: '2026-11-04', time_et: '14:00', note: 'FOMC + Coletiva' },
  { date: '2026-12-16', time_et: '14:00', note: 'FOMC + SEP + Coletiva' },
];

// ─── Catálogo de eventos com mapeamento FRED ──────────────────────────────────

interface CatalogEntry {
  code:                string;
  name:                string;
  agency:              string;
  tier:                1 | 2;
  fred_release_id:     number | null;
  fred_series:         string | null;
  unit:                string;
  release_time_et:     string;
  btc_impact_hist_avg: number;
  description:         string;
  mom_computed:        boolean; // true = valor é índice, calcular variação MoM
}

const CATALOG: CatalogEntry[] = [
  {
    code: 'US_CPI', name: 'CPI (MoM)', agency: 'BLS', tier: 1,
    fred_release_id: 10, fred_series: 'CPIAUCSL',
    unit: '%', release_time_et: '08:30',
    btc_impact_hist_avg: -2.5, mom_computed: true,
    description: 'Inflação ao consumidor. Mais impactante para o Fed e BTC.',
  },
  {
    code: 'US_NFP', name: 'Nonfarm Payrolls', agency: 'BLS', tier: 1,
    fred_release_id: 50, fred_series: 'PAYEMS',
    unit: 'K', release_time_et: '08:30',
    btc_impact_hist_avg: -1.8, mom_computed: true,
    description: 'Empregos não-agrícolas criados. Indicador líder do mercado de trabalho.',
  },
  {
    code: 'US_UNEMPLOYMENT', name: 'Unemployment Rate', agency: 'BLS', tier: 2,
    fred_release_id: 50, fred_series: 'UNRATE',
    unit: '%', release_time_et: '08:30',
    btc_impact_hist_avg: 0.8, mom_computed: false,
    description: 'Taxa de desemprego. Publicado junto com NFP.',
  },
  {
    code: 'US_GDP', name: 'GDP (QoQ)', agency: 'BEA', tier: 1,
    fred_release_id: 53, fred_series: 'A191RL1Q225SBEA',
    unit: '%', release_time_et: '08:30',
    btc_impact_hist_avg: 1.2, mom_computed: false,
    description: 'PIB dos EUA (variação trimestral anualizada). Publicação: fim de cada trimestre.',
  },
  {
    code: 'US_PCE', name: 'PCE Price Index (MoM)', agency: 'BEA', tier: 2,
    fred_release_id: 54, fred_series: 'PCEPI',
    unit: '%', release_time_et: '08:30',
    btc_impact_hist_avg: -1.9, mom_computed: true,
    description: 'Indicador de inflação preferido do Federal Reserve.',
  },
  {
    code: 'US_PPI', name: 'PPI (MoM)', agency: 'BLS', tier: 2,
    fred_release_id: 62, fred_series: 'PPIACO',
    unit: '%', release_time_et: '08:30',
    btc_impact_hist_avg: -1.1, mom_computed: true,
    description: 'Inflação ao produtor — antecede CPI em ~30 dias.',
  },
  {
    code: 'US_RETAIL', name: 'Retail Sales (MoM)', agency: 'Census', tier: 2,
    fred_release_id: 226, fred_series: 'RSXFS',
    unit: '%', release_time_et: '08:30',
    btc_impact_hist_avg: 0.6, mom_computed: true,
    description: 'Vendas no varejo — proxy de consumo e crescimento econômico.',
  },
];

// ─── Schemas Zod ──────────────────────────────────────────────────────────────

const ReleaseDatesSchema = z.object({
  release_dates: z.array(z.object({
    release_id: z.number(),
    date:       z.string(),
  })).default([]),
});

const ObservationSchema = z.object({
  date:  z.string(),
  value: z.string(),
});

const ObservationsResponseSchema = z.object({
  observations: z.array(ObservationSchema).default([]),
});

// ─── Tipo exportado ───────────────────────────────────────────────────────────

export interface MacroCalendarEvent {
  id:                   string;
  code:                 string;
  title:                string;
  agency:               string;
  tier:                 1 | 2;
  datetime_utc:         string;
  datetime_brt:         string;
  status:               'scheduled' | 'released';
  previous:             string | null;   // último valor real formatado
  actual:               string | null;   // null até release
  consensus:            null;            // não disponível em fontes gratuitas
  unit:                 string;
  btc_impact_hist_avg:  number;
  description:          string;
  alert_enabled:        boolean;
  alert_minutes_before: number;
  source:               'FRED' | 'FOMC_STATIC' | 'MOCK';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna o N-ésimo domingo de um dado mês/ano (1-indexed).
 * Usado para calcular as fronteiras exatas do horário de verão dos EUA.
 */
function nthSunday(year: number, month: number, n: number): Date {
  const d = new Date(year, month - 1, 1);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // primeiro domingo
  d.setDate(d.getDate() + (n - 1) * 7);            // N-ésimo domingo
  return d;
}

/**
 * Retorna o offset ET→UTC em horas (4 = EDT, 5 = EST).
 * DST começa no 2º domingo de março e termina no 1º domingo de novembro.
 */
function getEtOffsetHours(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dstStart = nthSunday(year, 3, 2);   // 2º domingo de março (spring forward)
  const dstEnd   = nthSunday(year, 11, 1);  // 1º domingo de novembro (fall back)
  const current  = new Date(year, month - 1, day);
  return current >= dstStart && current < dstEnd ? 4 : 5;
}

/**
 * Converte data (YYYY-MM-DD) + horário ET para UTC e BRT ISO strings.
 *
 * P1 fix: datetime_brt usa offset "-03:00" explícito (não "Z") para que
 * new Date(datetime_brt) preserve o instante UTC correto quando usado em
 * contagens regressivas e cálculos de alerta no componente.
 *
 * P2 fix: offset ET calculado via fronteiras reais do DST (2º domingo/março,
 * 1º domingo/novembro) em vez de aproximação por número do mês.
 */
function etToBrt(dateStr: string, timeEt: string): { utc: string; brt: string } {
  const etToUtcHours = getEtOffsetHours(dateStr);
  const [hr, mn] = timeEt.split(':').map(Number);
  // Trata o horário ET como se fosse UTC para obter um timestamp base,
  // depois adiciona o offset para converter para UTC real.
  const etAsUtcMs = new Date(
    `${dateStr}T${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}:00Z`,
  ).getTime();
  const utcMs = etAsUtcMs + etToUtcHours * 3_600_000;

  // BRT = UTC-3: subtrai 3h para obter o horário de parede em Brasília,
  // depois serializa com offset "-03:00" para que new Date(brt) retorne
  // o instante UTC correto (não 3h adiantado).
  const brtWallMs = utcMs - 3 * 3_600_000;
  const brtIso = new Date(brtWallMs).toISOString().replace(/Z$/, '-03:00');

  return {
    utc: new Date(utcMs).toISOString(),
    brt: brtIso,
  };
}

/**
 * Formata o valor anterior para exibição, baseado no tipo de evento.
 */
function formatPrevious(
  code:         string,
  observations: Array<{ date: string; value: number }>,
  momComputed:  boolean,
): string | null {
  if (observations.length === 0) return null;

  const latest = observations[observations.length - 1];
  const prev   = observations.length >= 2 ? observations[observations.length - 2] : null;

  if (momComputed && prev) {
    if (code === 'US_NFP') {
      const addK = Math.round(latest.value - prev.value);
      return `${addK > 0 ? '+' : ''}${addK}K`;
    }
    const mom = ((latest.value - prev.value) / Math.abs(prev.value)) * 100;
    return `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`;
  }

  switch (code) {
    case 'US_UNEMPLOYMENT': return `${latest.value.toFixed(1)}%`;
    case 'US_GDP':          return `${latest.value >= 0 ? '+' : ''}${latest.value.toFixed(1)}%`;
    case 'US_FOMC':         return `${latest.value.toFixed(2)}%`;
    default:                return `${latest.value.toFixed(2)}`;
  }
}

// ─── FRED fetchers ────────────────────────────────────────────────────────────

async function fetchReleaseDates(releaseId: number, apiKey: string): Promise<string[]> {
  const params = new URLSearchParams({
    release_id:                         String(releaseId),
    api_key:                            apiKey,
    file_type:                          'json',
    sort_order:                         'desc',
    include_release_dates_with_no_data: 'true',
    limit:                              '24',
  });

  const res = await fetch(`${FRED_BASE}/release/dates?${params}`);
  if (!res.ok) throw new Error(`FRED release/dates ${res.status}: release_id=${releaseId}`);

  const raw    = await res.json();
  const parsed = ReleaseDatesSchema.parse(raw);
  const today  = new Date().toISOString().slice(0, 10);

  return parsed.release_dates
    .map(d => d.date)
    .filter(d => d >= today)
    .reverse() // asc
    .slice(0, 4); // próximas 4 datas
}

async function fetchObservations(
  seriesId: string,
  apiKey:   string,
  limit = 3,
): Promise<Array<{ date: string; value: number }>> {
  const params = new URLSearchParams({
    series_id:  seriesId,
    api_key:    apiKey,
    file_type:  'json',
    sort_order: 'desc',
    limit:      String(limit),
  });

  const res = await fetch(`${FRED_BASE}/series/observations?${params}`);
  if (!res.ok) return [];

  const raw    = await res.json();
  const parsed = ObservationsResponseSchema.parse(raw);

  return parsed.observations
    .filter(o => o.value !== '.' && !isNaN(parseFloat(o.value)))
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse(); // oldest first
}

// ─── Mock fallback (quando sem FRED key ou DATA_MODE=mock) ────────────────────

function buildMockEvents(): MacroCalendarEvent[] {
  const now     = new Date();
  const today   = now.toISOString().slice(0, 10);
  const events: MacroCalendarEvent[] = [];

  // CPI: ~segundo/terceiro mês, dia 10–15
  for (let m = 0; m <= 2; m++) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() + m);
    d.setDate(12);
    if (d.toISOString().slice(0, 10) < today) continue;
    const dateStr = d.toISOString().slice(0, 10);
    const { utc, brt } = etToBrt(dateStr, '08:30');
    events.push({
      id: `mock-cpi-${m}`, code: 'US_CPI', title: 'CPI (MoM)',
      agency: 'BLS', tier: 1, datetime_utc: utc, datetime_brt: brt,
      status: 'scheduled', previous: '+0.3%', actual: null, consensus: null,
      unit: '%', btc_impact_hist_avg: -2.5,
      description: 'Inflação ao consumidor.',
      alert_enabled: false, alert_minutes_before: 30, source: 'MOCK',
    });
  }

  // FOMC: próximas 3 datas
  for (const fomc of FOMC_2026.filter(f => f.date >= today).slice(0, 3)) {
    const { utc, brt } = etToBrt(fomc.date, '14:00');
    events.push({
      id: `mock-fomc-${fomc.date}`, code: 'US_FOMC',
      title: 'FOMC Interest Rate Decision',
      agency: 'Fed', tier: 1, datetime_utc: utc, datetime_brt: brt,
      status: 'scheduled', previous: '4.25%', actual: null, consensus: null,
      unit: '%', btc_impact_hist_avg: -3.2,
      description: fomc.note,
      alert_enabled: false, alert_minutes_before: 30, source: 'MOCK',
    });
  }

  // NFP: ~primeiro sábado do mês seguinte
  for (let m = 0; m <= 1; m++) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() + m + 1);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1); // primeira sexta
    const dateStr = d.toISOString().slice(0, 10);
    if (dateStr < today) continue;
    const { utc, brt } = etToBrt(dateStr, '08:30');
    events.push({
      id: `mock-nfp-${m}`, code: 'US_NFP', title: 'Nonfarm Payrolls',
      agency: 'BLS', tier: 1, datetime_utc: utc, datetime_brt: brt,
      status: 'scheduled', previous: '+185K', actual: null, consensus: null,
      unit: 'K', btc_impact_hist_avg: -1.8,
      description: 'Empregos não-agrícolas criados.',
      alert_enabled: false, alert_minutes_before: 30, source: 'MOCK',
    });
  }

  events.sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc));
  return events;
}

// ─── Fetcher principal ────────────────────────────────────────────────────────

/**
 * fetchMacroCalendarEvents
 *
 * Em mock mode ou sem VITE_FRED_API_KEY → retorna eventos mock com datas calculadas.
 * Em live mode com chave → busca FRED release dates + últimas observações.
 *
 * Eventos FOMC sempre vêm de datas estáticas 2026 (hardcoded, mais confiável que FRED).
 */
export async function fetchMacroCalendarEvents(): Promise<MacroCalendarEvent[]> {
  const apiKey = env.VITE_FRED_API_KEY;

  if (DATA_MODE === 'mock' || !apiKey) {
    if (!apiKey && DATA_MODE === 'live') {
      logWarn('VITE_FRED_API_KEY ausente — usando mock para MacroCalendar', null, 'macroCalendar');
    }
    return buildMockEvents();
  }

  const today  = new Date().toISOString().slice(0, 10);
  const events: MacroCalendarEvent[] = [];

  // ── FOMC: sempre usa datas estáticas (mais confiável) ────────────────────
  const fedFundsObs = await fetchObservations('FEDFUNDS', apiKey, 2).catch(() => []);
  const fedFundsPrev = formatPrevious('US_FOMC', fedFundsObs, false);

  for (const fomc of FOMC_2026.filter(f => f.date >= today)) {
    const { utc, brt } = etToBrt(fomc.date, fomc.time_et);
    events.push({
      id:                   `fomc-${fomc.date}`,
      code:                 'US_FOMC',
      title:                'FOMC Interest Rate Decision',
      agency:               'Fed',
      tier:                 1,
      datetime_utc:         utc,
      datetime_brt:         brt,
      status:               'scheduled',
      previous:             fedFundsPrev,
      actual:               null,
      consensus:            null,
      unit:                 '%',
      btc_impact_hist_avg:  -3.2,
      description:          fomc.note,
      alert_enabled:        false,
      alert_minutes_before: 30,
      source:               'FOMC_STATIC',
    });
  }

  // ── Eventos FRED: busca release dates + observações em paralelo ──────────
  const fredCatalog = CATALOG.filter(c => c.fred_release_id !== null);

  const results = await Promise.allSettled(
    fredCatalog.map(async (cat) => {
      const [releaseDates, observations] = await Promise.all([
        fetchReleaseDates(cat.fred_release_id!, apiKey),
        fetchObservations(cat.fred_series!, apiKey, 3),
      ]);
      return { cat, releaseDates, observations };
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      logError('FRED event fetch failed', result.reason, 'macroCalendar');
      continue;
    }

    const { cat, releaseDates, observations } = result.value;
    const previous = formatPrevious(cat.code, observations, cat.mom_computed);

    for (const dateStr of releaseDates) {
      const { utc, brt } = etToBrt(dateStr, cat.release_time_et);
      events.push({
        id:                   `${cat.code}-${dateStr}`,
        code:                 cat.code,
        title:                cat.name,
        agency:               cat.agency,
        tier:                 cat.tier,
        datetime_utc:         utc,
        datetime_brt:         brt,
        status:               dateStr <= today ? 'released' : 'scheduled',
        previous,
        actual:               null,
        consensus:            null,
        unit:                 cat.unit,
        btc_impact_hist_avg:  cat.btc_impact_hist_avg,
        description:          cat.description,
        alert_enabled:        false,
        alert_minutes_before: 30,
        source:               'FRED',
      });
    }
  }

  events.sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc));

  logInfo('MacroCalendar fetched', { count: events.length, source: 'FRED' }, 'macroCalendar');

  // Persiste eventos no pipeline bronze em background — não bloqueia a UI
  void persistMacroSchedule(events);

  return events;
}
