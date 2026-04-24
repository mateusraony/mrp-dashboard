/**
 * macroCalendarService.ts — Calendário Macro via FRED API + Datas FOMC estáticas
 *
 * Fontes gratuitas:
 *   - FRED (St. Louis Fed): release dates + actuals para CPI, NFP, GDP, PCE, PPI, Retail
 *   - FOMC: datas oficiais 2026 (hardcoded — Fed publica um ano de antecedência)
 *
 * Sem chave FRED → retorna conjunto mock com datas calculadas programaticamente.
 * Sem consensus: dado pago (Bloomberg). Exibido como null com motivo explícito.
 *
 * Arquitetura de consensus:
 *   IConsensusProvider.fetch() → null (provider gratuito padrão)
 *   Provider externo opcional: setar VITE_CONSENSUS_PROVIDER=trading_economics|polygon
 */

import { z } from 'zod';
import { env, DATA_MODE } from '@/lib/env';
import { logInfo, logError, logWarn } from '@/lib/debugLog';

// ─── Consensus Provider Interface ────────────────────────────────────────────

export interface ConsensusResult {
  value:    number | null;
  source:   string;        // ex: 'trading_economics', 'polygon', 'none_free_tier'
  reason:   string | null; // motivo de null, se aplicável
}

export interface IConsensusProvider {
  fetch(eventCode: string, releaseDateUtc: string): Promise<ConsensusResult>;
}

/** Provider padrão gratuito — retorna null honesto com motivo explícito. */
class FreeConsensusProvider implements IConsensusProvider {
  async fetch(_eventCode: string, _releaseDateUtc: string): Promise<ConsensusResult> {
    return { value: null, source: 'none_free_tier', reason: 'Consenso requer API paga (Bloomberg/Trading Economics)' };
  }
}

/** Factory: retorna provider externo se feature flag ativa, senão gratuito. */
function createConsensusProvider(): IConsensusProvider {
  const providerFlag = (env as Record<string, string | undefined>)['VITE_CONSENSUS_PROVIDER'];
  if (providerFlag && providerFlag !== 'none') {
    logWarn(`Consensus provider '${providerFlag}' configurado mas não implementado — usando free tier`, null, 'macroCalendar');
  }
  return new FreeConsensusProvider();
}

const consensusProvider: IConsensusProvider = createConsensusProvider();

// ─── Supabase (persistência + proxy FRED) ────────────────────────────────────

const _supUrl = env.VITE_SUPABASE_URL ?? '';
const _supKey = env.VITE_SUPABASE_ANON_KEY ?? '';

// Edge Function que faz proxy server-side para o FRED API (resolve CORS)
const FRED_PROXY = _supUrl ? `${_supUrl}/functions/v1/fred-proxy` : null;

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
    const now = new Date();
    const rows = events.map(e => ({
      event_code:       e.code,
      release_time_utc: e.datetime_utc,
      // Deriva status do timestamp UTC completo para evitar que eventos de hoje
      // sejam marcados como 'released' antes de sua hora real de publicação.
      status:           new Date(e.datetime_utc) <= now ? 'released' : 'scheduled',
      previous:         parsePrevToNumeric(e.previous),
      actual:           e.actual ? parsePrevToNumeric(e.actual) : null,
      consensus:        null,
      unit:             e.unit,
      source:           e.source,
      raw_payload:      e,
    }));
    const res = await fetch(
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
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logError('MacroCalendar persist failed', new Error(`HTTP ${res.status}: ${body}`), 'macro');
    } else {
      logInfo('MacroCalendar persist ok', { count: rows.length }, 'macro');
    }
  } catch (err) {
    logError('MacroCalendar persist exception', err instanceof Error ? err : new Error(String(err)), 'macro');
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
  actual:               string | null;   // preenchido após release (via DB ou FRED)
  actual_source:        string | null;   // ex: 'FRED:CPIAUCSL:2026-04-10', null=pendente
  consensus:            null;
  consensus_label:      string;          // 'N/D (fonte gratuita)' ou provider name
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

// ─── DB fetchers (actuals + alert preferences) ───────────────────────────────

/**
 * Busca valores actual já preenchidos pelo macro-actual-fetcher na tabela
 * macro_event_schedule. Retorna map: "<event_code>|<release_time_utc>" → { actual, source }.
 * Chamada fire-and-forget pelo fetchMacroCalendarEvents para enriquecer dados locais.
 */
async function fetchActualsFromDb(): Promise<Map<string, { actual: number; source: string }>> {
  const map = new Map<string, { actual: number; source: string }>();
  if (!_supUrl || !_supKey) return map;

  try {
    const res = await fetch(
      `${_supUrl}/rest/v1/macro_event_schedule?select=event_code,release_time_utc,actual,actual_source&actual=not.is.null&limit=100`,
      {
        headers: {
          apikey:        _supKey,
          Authorization: `Bearer ${_supKey}`,
        },
      },
    );
    if (!res.ok) return map;
    const rows = await res.json() as Array<{
      event_code: string; release_time_utc: string; actual: number; actual_source: string;
    }>;
    for (const row of rows) {
      const key = `${row.event_code}|${row.release_time_utc}`;
      map.set(key, { actual: row.actual, source: row.actual_source ?? 'DB' });
    }
  } catch {
    // falha silenciosa — actuals ficam null, UI mostra "—"
  }
  return map;
}

/**
 * Busca preferências de alerta do usuário de macro_alert_preferences.
 * Retorna map: event_code → { alert_enabled, alert_minutes_before }.
 */
export async function fetchAlertPreferences(
  sentinel: string,
): Promise<Map<string, { alert_enabled: boolean; alert_minutes_before: number }>> {
  const map = new Map<string, { alert_enabled: boolean; alert_minutes_before: number }>();
  if (!_supUrl || !_supKey || !sentinel) return map;

  try {
    const res = await fetch(
      `${_supUrl}/rest/v1/macro_alert_preferences?user_sentinel=eq.${sentinel}&select=event_code,alert_enabled,alert_minutes_before`,
      {
        headers: {
          apikey:        _supKey,
          Authorization: `Bearer ${_supKey}`,
        },
      },
    );
    if (!res.ok) return map;
    const rows = await res.json() as Array<{
      event_code: string; alert_enabled: boolean; alert_minutes_before: number;
    }>;
    for (const row of rows) {
      map.set(row.event_code, {
        alert_enabled:        row.alert_enabled,
        alert_minutes_before: row.alert_minutes_before,
      });
    }
  } catch {
    // falha silenciosa — alertas ficam com defaults
  }
  return map;
}

/**
 * Persiste (upsert) preferência de alerta de um evento específico.
 * Chamado pelo toggle no MacroCalendar.jsx.
 */
export async function upsertAlertPreference(
  sentinel:           string,
  eventCode:          string,
  alertEnabled:       boolean,
  alertMinutesBefore: number = 30,
): Promise<void> {
  if (!_supUrl || !_supKey || !sentinel) return;
  try {
    await fetch(
      `${_supUrl}/rest/v1/macro_alert_preferences?on_conflict=user_sentinel,event_code`,
      {
        method:  'POST',
        headers: {
          apikey:         _supKey,
          Authorization:  `Bearer ${_supKey}`,
          'Content-Type': 'application/json',
          Prefer:         'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([{
          user_sentinel:        sentinel,
          event_code:           eventCode,
          alert_enabled:        alertEnabled,
          alert_minutes_before: alertMinutesBefore,
        }]),
      },
    );
  } catch (err) {
    logError('upsertAlertPreference failed', err instanceof Error ? err : new Error(String(err)), 'macro');
  }
}

// ─── FRED fetchers ────────────────────────────────────────────────────────────

// Chama o FRED via Edge Function proxy (resolve CORS do browser → servidor)
async function fredProxy(type: 'observations' | 'release_dates', params: Record<string, string>) {
  if (!FRED_PROXY) throw new Error('Supabase URL não configurado — fredProxy indisponível');
  const res = await fetch(FRED_PROXY, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: _supKey },
    body:    JSON.stringify({ type, params }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`fred-proxy ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchReleaseDates(releaseId: number): Promise<string[]> {
  const raw = await fredProxy('release_dates', {
    release_id:                         String(releaseId),
    sort_order:                         'desc',
    include_release_dates_with_no_data: 'true',
    limit:                              '12',
  });
  const parsed = ReleaseDatesSchema.parse(raw);
  // Inclui 45 dias passados (releases publicados recentemente com actual real)
  // mais todos os próximos até ~90 dias à frente.
  const cutoff = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);

  return parsed.release_dates
    .map((d: { date: string }) => d.date)
    .filter((d: string) => d >= cutoff)
    .reverse()          // ascendente para exibição cronológica
    .slice(0, 6);       // 1-2 passados + 3-4 futuros
}

async function fetchObservations(
  seriesId: string,
  limit = 3,
): Promise<Array<{ date: string; value: number }>> {
  const raw = await fredProxy('observations', {
    series_id:  seriesId,
    sort_order: 'desc',
    limit:      String(limit),
  });
  const parsed = ObservationsResponseSchema.parse(raw);

  return parsed.observations
    .filter((o: { value: string; date: string }) => o.value !== '.' && !isNaN(parseFloat(o.value)))
    .map((o: { value: string; date: string }) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();
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
      status: 'scheduled', previous: '+0.3%', actual: null, actual_source: null, consensus: null, consensus_label: 'N/D (fonte gratuita)',
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
      status: 'scheduled', previous: '4.25%', actual: null, actual_source: null, consensus: null, consensus_label: 'N/D (fonte gratuita)',
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
      status: 'scheduled', previous: '+185K', actual: null, actual_source: null, consensus: null, consensus_label: 'N/D (fonte gratuita)',
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
/** Constrói eventos FOMC a partir das datas estáticas 2026. */
async function buildFomcEvents(
  actualsDb: Map<string, { actual: number; source: string }>,
): Promise<MacroCalendarEvent[]> {
  const today   = new Date().toISOString().slice(0, 10);
  // Inclui FOMC dos últimos 45 dias para mostrar decisões passadas recentes
  const cutoff  = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const fedFundsObs = await fetchObservations('FEDFUNDS', 4).catch(() => []);
  const fedFundsPrev = formatPrevious('US_FOMC', fedFundsObs, false);

  return FOMC_2026.filter(f => f.date >= cutoff).map(fomc => {
    const { utc, brt } = etToBrt(fomc.date, fomc.time_et);
    const dbActual = actualsDb.get(`US_FOMC|${utc}`);
    return {
      id:                   `fomc-${fomc.date}`,
      code:                 'US_FOMC',
      title:                'FOMC Interest Rate Decision',
      agency:               'Fed',
      tier:                 1 as const,
      datetime_utc:         utc,
      datetime_brt:         brt,
      // Compara instante UTC completo para não marcar como released antes das 14h ET
      status:               utc <= new Date().toISOString() ? 'released' as const : 'scheduled' as const,
      previous:             fedFundsPrev,
      // FEDFUNDS mensal tem delay: usamos como indicador de taxa após a decisão
      actual:               dbActual ? String(dbActual.actual) : null,
      actual_source:        dbActual?.source ?? null,
      consensus:            null,
      consensus_label:      'N/D (fonte gratuita)',
      unit:                 '%',
      btc_impact_hist_avg:  -3.2,
      description:          fomc.note,
      alert_enabled:        false,
      alert_minutes_before: 30,
      source:               'FOMC_STATIC',
    };
  });
}

export async function fetchMacroCalendarEvents(): Promise<MacroCalendarEvent[]> {
  if (DATA_MODE === 'mock') {
    return buildMockEvents();
  }

  if (!FRED_PROXY) {
    logWarn('Supabase URL ausente — MacroCalendar usa mock', null, 'macroCalendar');
    return buildMockEvents();
  }

  const today     = new Date().toISOString().slice(0, 10);

  // Busca actuals já preenchidos pelo worker (DB tem precedência sobre FRED direto)
  const actualsDb = await fetchActualsFromDb();

  const fomcEvents = await buildFomcEvents(actualsDb);
  const events: MacroCalendarEvent[] = [...fomcEvents];

  // ── Consensus provider (gratuito retorna null honesto) ───────────────────
  // Pré-fetcha para todos os códigos de uma vez se provider externo for impl.
  // Por ora, cada evento recebe o label padrão sem chamada extra.
  const consensusDefault = await consensusProvider.fetch('__probe__', today).catch(
    () => ({ value: null, source: 'none_free_tier', reason: null } as ConsensusResult),
  );
  const consensusLabel = consensusDefault.source === 'none_free_tier'
    ? 'N/D (fonte gratuita)'
    : consensusDefault.source;

  // ── Eventos FRED via proxy Edge Function ─────────────────────────────────
  const fredCatalog = CATALOG.filter(c => c.fred_release_id !== null);

  const results = await Promise.allSettled(
    fredCatalog.map(async (cat) => {
      // 4 observações: permite derivar actual do FRED para eventos released
      // sem depender do worker server-side.
      const [releaseDates, observations] = await Promise.all([
        fetchReleaseDates(cat.fred_release_id!),
        fetchObservations(cat.fred_series!, 4),
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

    for (const dateStr of releaseDates) {
      const { utc, brt } = etToBrt(dateStr, cat.release_time_et);
      // Compara instante UTC completo para não marcar como released antes do horário real
      const isReleased = utc <= new Date().toISOString();
      const dbActual = actualsDb.get(`${cat.code}|${utc}`);

      let actual: string | null = null;
      let previous: string | null = null;
      let actualSource: string | null = null;

      if (dbActual) {
        // DB tem precedência — preenchido pelo worker server-side
        actual       = String(dbActual.actual);
        actualSource = dbActual.source;
        // previous = observações disponíveis antes deste release
        const obsAtRelease = observations.filter(o => o.date <= dateStr);
        previous = obsAtRelease.length >= 2
          ? formatPrevious(cat.code, obsAtRelease.slice(0, -1), cat.mom_computed)
          : null;
      } else if (isReleased) {
        // Filtra obs disponíveis NA DATA do release para cada evento individual.
        // Sem isso, múltiplos released na janela 45d receberiam todos o obs[-1] mais recente.
        const obsAtRelease = observations.filter(o => o.date <= dateStr);
        if (obsAtRelease.length >= 2) {
          actual       = formatPrevious(cat.code, obsAtRelease, cat.mom_computed);
          actualSource = `FRED:${cat.fred_series}:client`;
          previous     = formatPrevious(cat.code, obsAtRelease.slice(0, -1), cat.mom_computed);
        } else if (obsAtRelease.length === 1) {
          actual       = formatPrevious(cat.code, obsAtRelease, cat.mom_computed);
          actualSource = `FRED:${cat.fred_series}:client`;
        }
      } else {
        // Scheduled: actual ainda não existe, previous é o mais recente disponível
        previous = formatPrevious(cat.code, observations, cat.mom_computed);
      }

      events.push({
        id:                   `${cat.code}-${dateStr}`,
        code:                 cat.code,
        title:                cat.name,
        agency:               cat.agency,
        tier:                 cat.tier,
        datetime_utc:         utc,
        datetime_brt:         brt,
        status:               isReleased ? 'released' : 'scheduled',
        previous,
        actual,
        actual_source:        actualSource,
        consensus:            null,
        consensus_label:      consensusLabel,
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
