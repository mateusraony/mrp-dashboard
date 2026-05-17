/**
 * sosovalue.ts — SoSoValue API v1
 *
 * Fornece dados reais de flows de Bitcoin Spot ETFs (AUM, flows diários,
 * histórico de 30 dias) por fundo (IBIT, FBTC, GBTC, etc.)
 *
 * Base URL:  https://openapi.sosovalue.com
 * Auth:      header x-soso-api-key: <key>
 * Free tier: 20 req/min — sem paginação forçada em low-volume
 *
 * Registro gratuito: https://sosovalue.com/developer
 *   1. Clique em "Get API Key"
 *   2. Crie uma conta (e-mail + senha)
 *   3. Acesse o painel → copie a API Key gerada
 *   4. Adicione ao .env.local: VITE_SOSOVALUE_KEY=sua_chave_aqui
 *
 * Documentação oficial: https://sosovalue.gitbook.io/soso-value-api-doc
 */

import { z } from 'zod';
import { env, DATA_MODE } from '@/lib/env';
import { logInfo, logError } from '@/lib/debugLog';

const BASE = 'https://openapi.sosovalue.com';

function getKey(): string | null {
  return env.VITE_SOSOVALUE_KEY ?? null;
}

async function sosoFetch<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  const key = getKey();
  if (!key) {
    logError('SoSoValue', new Error('VITE_SOSOVALUE_KEY não configurada — adicione ao .env.local'), 'sosovalue');
    return null;
  }

  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'x-soso-api-key': key },
    signal: AbortSignal.timeout(8_000),
  });

  if (res.status === 401 || res.status === 403) {
    logError('SoSoValue', new Error(`Auth inválida (${res.status}) — verifique VITE_SOSOVALUE_KEY`), 'sosovalue');
    return null;
  }
  if (!res.ok) {
    throw new Error(`SoSoValue HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  // A API SoSoValue envolve resultados em { code, msg, data }
  const payload = (json?.data !== undefined) ? json.data : json;

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    logError('SoSoValue', new Error(`Schema inválido: ${parsed.error.message}`), 'sosovalue');
    return null;
  }
  return parsed.data;
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface EtfFundData {
  ticker:        string;
  name:          string;
  issuer:        string;
  aum_b:         number;   // AUM em USD bilhões
  flow_today_m:  number;   // flow do dia em USD milhões (positivo = entrada)
  flow_7d_m:     number;
  flow_30d_m:    number;
  btc_holdings:  number;   // BTC custodiados
}

export interface EtfSummary {
  date:             string;
  total_aum_b:      number;
  net_flow_today_m: number;
  net_flow_7d_m:    number;
  net_flow_30d_m:   number;
  funds:            EtfFundData[];
}

export interface EtfDailyFlow {
  date:    string;   // YYYY-MM-DD
  inflow:  number;   // USD milhões
  outflow: number;
  net:     number;
}

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

// Schema para um fundo individual na resposta da API
// Os campos podem variar — mapeamos o que recebemos
const FundItemSchema = z.object({
  ticker:            z.string().optional(),
  shortName:         z.string().optional(),
  issuer:            z.string().optional(),
  // AUM pode vir como número ou string
  totalAum:          z.union([z.number(), z.string()]).optional(),
  fundAum:           z.union([z.number(), z.string()]).optional(),
  // Flows: a API pode usar diferentes nomes de campo
  netInflow:         z.union([z.number(), z.string()]).optional(),
  netInflowDaily:    z.union([z.number(), z.string()]).optional(),
  netInflow7d:       z.union([z.number(), z.string()]).optional(),
  netInflow30d:      z.union([z.number(), z.string()]).optional(),
  btcHolding:        z.union([z.number(), z.string()]).optional(),
  // Campos alternativos que podem existir
  symbol:            z.string().optional(),
  name:              z.string().optional(),
  flow:              z.union([z.number(), z.string()]).optional(),
  aum:               z.union([z.number(), z.string()]).optional(),
}).passthrough();

const FundListSchema = z.array(FundItemSchema);

// Schema para histórico diário
const DailyFlowItemSchema = z.object({
  date:       z.string().optional(),
  dateStr:    z.string().optional(),
  // Diferentes nomes possíveis para flows
  netInflow:  z.union([z.number(), z.string()]).optional(),
  inflow:     z.union([z.number(), z.string()]).optional(),
  outflow:    z.union([z.number(), z.string()]).optional(),
  net:        z.union([z.number(), z.string()]).optional(),
}).passthrough();

const DailyFlowListSchema = z.array(DailyFlowItemSchema);

// ─── Funções de mapeamento ────────────────────────────────────────────────────

const TICKER_COLORS: Record<string, string> = {
  IBIT: '#3b82f6', FBTC: '#10b981', ARKB: '#f59e0b',
  BITB: '#a78bfa', GBTC: '#ef4444', HODL: '#06b6d4', BTCO: '#ec4899',
};

function toNum(v: number | string | undefined, divisor = 1): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n / divisor;
}

function mapFund(item: z.infer<typeof FundItemSchema>): EtfFundData {
  const ticker = item.ticker ?? item.symbol ?? '';
  // AUM pode vir em bilhões ou milhões — normaliza para bilhões
  const rawAum = item.totalAum ?? item.fundAum ?? item.aum ?? 0;
  const aumRaw = toNum(rawAum);
  // Heurística: se AUM > 1000 assumimos que está em milhões, converter para bilhões
  const aum_b = aumRaw > 1000 ? aumRaw / 1000 : aumRaw;

  return {
    ticker,
    name:         item.shortName ?? item.name ?? ticker,
    issuer:       item.issuer ?? '',
    aum_b,
    flow_today_m: toNum(item.netInflowDaily ?? item.netInflow ?? item.flow),
    flow_7d_m:    toNum(item.netInflow7d),
    flow_30d_m:   toNum(item.netInflow30d),
    btc_holdings: toNum(item.btcHolding),
  };
}

function mapDailyFlow(item: z.infer<typeof DailyFlowItemSchema>): EtfDailyFlow {
  const net   = toNum(item.net ?? item.netInflow);
  const infl  = toNum(item.inflow ?? (net >= 0 ? net : 0));
  const outfl = toNum(item.outflow ?? (net < 0 ? -net : 0));
  const dateStr = item.date ?? item.dateStr ?? '';
  // Formata para dd/MM se vier como YYYY-MM-DD
  const formatted = dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
    ? dateStr.slice(8) + '/' + dateStr.slice(5, 7)
    : dateStr;
  return { date: formatted, inflow: infl, outflow: outfl, net };
}

// ─── Fetchers principais ──────────────────────────────────────────────────────

/**
 * fetchEtfFundList — lista de todos os Bitcoin Spot ETFs com flows do dia.
 *
 * Endpoint tentado: GET /api/v1/etf/us-btc-spot/list
 * Se retornar erro de rota, a API pode usar outro path —
 * verifique https://sosovalue.gitbook.io/soso-value-api-doc após obter sua chave.
 */
export async function fetchEtfFundList(): Promise<EtfFundData[] | null> {
  if (DATA_MODE === 'mock') return null;

  try {
    const funds = await sosoFetch('/api/v1/etf/us-btc-spot/list', FundListSchema);
    if (!funds || funds.length === 0) return null;
    const mapped = funds.map(mapFund).filter(f => f.ticker);
    // Injeta cores baseadas em ticker conhecido
    return mapped.map(f => ({ ...f, color: TICKER_COLORS[f.ticker] ?? '#94a3b8' } as EtfFundData & { color: string }));
  } catch (err) {
    logError('SoSoValue fundList', err instanceof Error ? err : new Error(String(err)), 'sosovalue');
    return null;
  }
}

/**
 * fetchEtfFlowHistory — histórico diário de flows (últimos 30 dias).
 *
 * Endpoint tentado: GET /api/v1/etf/us-btc-spot/net-inflow-history?days=30
 */
export async function fetchEtfFlowHistory(days = 30): Promise<EtfDailyFlow[] | null> {
  if (DATA_MODE === 'mock') return null;

  try {
    const history = await sosoFetch(
      `/api/v1/etf/us-btc-spot/net-inflow-history?days=${days}`,
      DailyFlowListSchema,
    );
    if (!history || history.length === 0) return null;
    logInfo('SoSoValue history', { days: history.length }, 'sosovalue');
    return history.map(mapDailyFlow);
  } catch (err) {
    logError('SoSoValue history', err instanceof Error ? err : new Error(String(err)), 'sosovalue');
    return null;
  }
}

/**
 * fetchEtfSummary — dados agregados: AUM total, flows hoje/7d/30d + lista de fundos.
 * Combina fetchEtfFundList em uma única chamada quando possível.
 */
export async function fetchEtfSummary(): Promise<EtfSummary | null> {
  if (DATA_MODE === 'mock') return null;

  const funds = await fetchEtfFundList();
  if (!funds || funds.length === 0) return null;

  const total_aum_b      = funds.reduce((s, f) => s + f.aum_b, 0);
  const net_flow_today_m = funds.reduce((s, f) => s + f.flow_today_m, 0);
  const net_flow_7d_m    = funds.reduce((s, f) => s + f.flow_7d_m, 0);
  const net_flow_30d_m   = funds.reduce((s, f) => s + f.flow_30d_m, 0);

  logInfo('SoSoValue summary', { funds: funds.length, aum_b: total_aum_b.toFixed(1) }, 'sosovalue');

  return {
    date: new Date().toISOString().slice(0, 10),
    total_aum_b,
    net_flow_today_m,
    net_flow_7d_m,
    net_flow_30d_m,
    funds,
  };
}
