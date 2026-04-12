/**
 * deribit.ts — Deribit Public API (sem autenticação)
 *
 * Endpoints usados (todos públicos, gratuitos):
 *   Base: https://www.deribit.com/api/v2/public
 *   - get_index_price          — preço spot BTC/USD
 *   - get_historical_volatility — IV histórica (DVOL proxy)
 *   - get_book_summary_by_currency — resumo de todos os contratos de opções
 *   - get_instruments           — lista de instrumentos ativos
 *
 * Regra de mock: idem binance.ts — mock NÃO substitui live com falha.
 *
 * Nota: em prod, uso de WebSocket via /api/v2/ws pode substituir
 * polling para IV em tempo real. Implementar em Fase 4+.
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import { btcOptions, btcOptionsExtended } from '@/components/data/mockData';

const BASE = 'https://www.deribit.com/api/v2/public';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const DeribitResponseSchema = <T extends z.ZodTypeAny>(resultSchema: T) =>
  z.object({
    result: resultSchema,
    usIn:   z.number().optional(),
    usOut:  z.number().optional(),
  });

const IndexPriceSchema = DeribitResponseSchema(
  z.object({ index_price: z.coerce.number() }),
);

const BookSummaryEntrySchema = z.object({
  instrument_name:       z.string(),
  underlying_price:      z.coerce.number().optional(),
  mark_iv:               z.coerce.number().optional(),
  bid_iv:                z.coerce.number().optional(),
  ask_iv:                z.coerce.number().optional(),
  open_interest:         z.coerce.number(),
  volume:                z.coerce.number(),
  creation_timestamp:    z.coerce.number().optional(),
  last:                  z.coerce.number().optional(),
  delta:                 z.coerce.number().optional(),
  gamma:                 z.coerce.number().optional(),
  theta:                 z.coerce.number().optional(),
  vega:                  z.coerce.number().optional(),
  underlying_index:      z.string().optional(),
});
const BookSummarySchema = DeribitResponseSchema(z.array(BookSummaryEntrySchema));

const HistVolEntrySchema = z.tuple([z.number(), z.coerce.number()]); // [timestamp_ms, iv]
const HistVolSchema = DeribitResponseSchema(z.array(HistVolEntrySchema));

// ─── Shapes exportadas ────────────────────────────────────────────────────────

export interface OptionsStrike {
  strike:   number;
  call_iv:  number;
  put_iv:   number;
  call_oi:  number;
  put_oi:   number;
  call_delta?: number;
  put_delta?:  number;
  call_gamma?: number;
  put_gamma?:  number;
}

export interface OptionsExpiry {
  label:    string;   // ex: 'BTC-28MAR26'
  days_to:  number;   // dias até expiração
  atm_iv:   number;   // IV ATM desta expiry (0–1)
  strikes:  OptionsStrike[];
}

export interface OptionsData {
  spot:               number;
  iv_atm:             number;   // IV ATM da expiry mais próxima (0–1)
  dvol_history:       Array<{ timestamp: number; value: number }>;
  term_structure:     Array<{ label: string; days_to: number; atm_iv: number }>;
  chain:              OptionsStrike[];      // cadeia da expiry mais próxima
  put_call_ratio_oi:  number;
  put_call_ratio_vol: number;
  max_pain:           number;
  gamma_exposure_usd: number;
  quality:            'A' | 'B' | 'C';
}

// ─── Mock transformer ─────────────────────────────────────────────────────────

function mockOptionsData(): OptionsData {
  // Estrutura a termo simulada com 5 expiries
  const termStructure = [
    { label: 'BTC-31JAN26', days_to: 7,   atm_iv: btcOptions.iv_atm + 0.02 },
    { label: 'BTC-28FEB26', days_to: 35,  atm_iv: btcOptions.iv_atm + 0.01 },
    { label: 'BTC-28MAR26', days_to: 63,  atm_iv: btcOptions.iv_atm },
    { label: 'BTC-27JUN26', days_to: 153, atm_iv: btcOptions.iv_atm - 0.02 },
    { label: 'BTC-25DEC26', days_to: 358, atm_iv: btcOptions.iv_atm - 0.04 },
  ];

  // Cadeia combinando btcOptions.strikes + btcOptionsExtended.oi_by_strike
  const chain: OptionsStrike[] = btcOptions.strikes.map((s, i) => {
    const oi = btcOptionsExtended.oi_by_strike[i] ?? { call_oi: 1000, put_oi: 1000 };
    return {
      strike:    s.strike,
      call_iv:   s.call_iv,
      put_iv:    s.put_iv,
      call_oi:   oi.call_oi,
      put_oi:    oi.put_oi,
      call_delta: s.strike < btcOptions.spot ? 0.8 : 0.2,
      put_delta:  s.strike < btcOptions.spot ? -0.2 : -0.8,
    };
  });

  // Histórico DVOL simulado (30 dias)
  const dvol_history = Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (29 - i) * 86_400_000,
    value:     btcOptions.iv_atm + (Math.random() - 0.5) * 0.08 - i * 0.002,
  })).map(d => ({ ...d, value: Math.max(0.2, Math.min(1.5, d.value)) }));

  return {
    spot:               btcOptions.spot,
    iv_atm:             btcOptions.iv_atm,
    dvol_history,
    term_structure:     termStructure,
    chain,
    put_call_ratio_oi:  btcOptionsExtended.put_call_ratio_oi,
    put_call_ratio_vol: btcOptionsExtended.put_call_ratio_vol,
    max_pain:           btcOptionsExtended.max_pain,
    gamma_exposure_usd: btcOptionsExtended.gamma_exposure_usd,
    quality:            'B',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deribit API error ${res.status}: ${url}`);
  const data = await res.json();
  return schema.parse(data);
}

/**
 * Extrai a data de expiração de um nome de instrumento Deribit.
 * ex: 'BTC-28MAR26-90000-C' → '28MAR26'
 */
function parseDaysToExpiry(instrumentName: string): number {
  // ex: BTC-28MAR26-90000-C
  const parts = instrumentName.split('-');
  if (parts.length < 2) return 0;
  const dateStr = parts[1]; // '28MAR26'
  if (!/^\d{1,2}[A-Z]{3}\d{2}$/.test(dateStr)) return 0;

  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const day   = parseInt(dateStr.slice(0, -5), 10);
  const month = months[dateStr.slice(-5, -2)] ?? 0;
  const year  = 2000 + parseInt(dateStr.slice(-2), 10);
  const exp   = new Date(year, month, day, 8, 0, 0, 0); // Deribit expira às 08:00 UTC
  return Math.max(0, Math.round((exp.getTime() - Date.now()) / 86_400_000));
}

/**
 * Calcula GEX aproximado a partir da cadeia de opções.
 * GEX = Σ (gamma × OI × spot²) para calls - puts
 * Negativo = dealer short gamma = volatilidade esperada maior
 */
function calculateGex(chain: OptionsStrike[], spot: number): number {
  return chain.reduce((acc, s) => {
    const callGamma = s.call_gamma ?? 0;
    const putGamma  = s.put_gamma  ?? 0;
    return acc + (callGamma * s.call_oi - putGamma * s.put_oi) * spot * spot;
  }, 0);
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * fetchOptionsData — IV, term structure, options chain, GEX, PCR
 *
 * Fluxo live:
 * 1. get_index_price (spot BTC)
 * 2. get_book_summary_by_currency (todos os contratos de opções BTC)
 * 3. Agrupa por expiry → term structure
 * 4. Extrai a expiry mais próxima como "chain principal"
 * 5. Calcula PCR (put/call ratio) e GEX a partir dos dados agregados
 *
 * Cache recomendado: 60s (dados mudam frequentemente mas não ms a ms)
 */
export async function fetchOptionsData(): Promise<OptionsData> {
  if (DATA_MODE === 'mock') return mockOptionsData();

  // 1. Spot price
  const indexData = await safeFetch(
    `${BASE}/get_index_price?index_name=btc_usd`,
    IndexPriceSchema,
  );
  const spot = indexData.result.index_price;

  // 2. Book summary de todas as opções BTC
  const bookData = await safeFetch(
    `${BASE}/get_book_summary_by_currency?currency=BTC&kind=option`,
    BookSummarySchema,
  );
  const entries = bookData.result;

  // 3. Agrupa por expiry label (ex: 'BTC-28MAR26')
  const expiryMap = new Map<string, typeof entries>();
  for (const e of entries) {
    // ex: BTC-28MAR26-90000-C → chave = BTC-28MAR26
    const parts = e.instrument_name.split('-');
    if (parts.length < 4) continue;
    const key = `${parts[0]}-${parts[1]}`;
    if (!expiryMap.has(key)) expiryMap.set(key, []);
    expiryMap.get(key)!.push(e);
  }

  // 4. Constrói term structure ordenada por days_to
  const termStructure = Array.from(expiryMap.entries())
    .map(([label, instruments]) => {
      const atmIv = instruments
        .filter(i => i.mark_iv != null)
        .reduce((sum, i, _, arr) => sum + (i.mark_iv ?? 0) / arr.length, 0);
      return {
        label,
        days_to: parseDaysToExpiry(instruments[0]?.instrument_name ?? ''),
        atm_iv:  atmIv / 100, // Deribit retorna em %, converter para decimal
      };
    })
    .filter(e => e.days_to > 0)
    .sort((a, b) => a.days_to - b.days_to)
    .slice(0, 8); // máximo 8 expiries

  // 5. Cadeia da expiry mais próxima
  const nearestLabel = termStructure[0]?.label ?? '';
  const nearestInstruments = expiryMap.get(nearestLabel) ?? [];

  const strikeMap = new Map<number, { c?: typeof entries[0]; p?: typeof entries[0] }>();
  for (const inst of nearestInstruments) {
    const parts = inst.instrument_name.split('-');
    const strike = parseFloat(parts[2] ?? '0');
    const side   = parts[3]; // 'C' ou 'P'
    if (!strike) continue;
    if (!strikeMap.has(strike)) strikeMap.set(strike, {});
    if (side === 'C') strikeMap.get(strike)!.c = inst;
    if (side === 'P') strikeMap.get(strike)!.p = inst;
  }

  const chain: OptionsStrike[] = Array.from(strikeMap.entries())
    .sort(([a], [b]) => a - b)
    .filter(([s]) => s >= spot * 0.7 && s <= spot * 1.4) // filtro: ±40% do spot
    .map(([strike, { c, p }]) => ({
      strike,
      call_iv:    (c?.mark_iv  ?? 0) / 100,
      put_iv:     (p?.mark_iv  ?? 0) / 100,
      call_oi:    c?.open_interest ?? 0,
      put_oi:     p?.open_interest ?? 0,
      call_delta: c?.delta ?? undefined,
      put_delta:  p?.delta ?? undefined,
      call_gamma: c?.gamma ?? undefined,
      put_gamma:  p?.gamma ?? undefined,
    }));

  // 6. Métricas agregadas
  const totalCallOi = chain.reduce((s, k) => s + k.call_oi, 0);
  const totalPutOi  = chain.reduce((s, k) => s + k.put_oi, 0);
  const totalCallVol = nearestInstruments
    .filter(i => i.instrument_name.endsWith('-C'))
    .reduce((s, i) => s + i.volume, 0);
  const totalPutVol = nearestInstruments
    .filter(i => i.instrument_name.endsWith('-P'))
    .reduce((s, i) => s + i.volume, 0);

  // Max pain: strike onde o valor total de todas as opções é mínimo
  let maxPainStrike = spot;
  let minTotalValue = Infinity;
  for (const { strike } of chain) {
    const tv = chain.reduce((acc, k) => {
      const callVal = Math.max(0, k.strike - strike) * k.call_oi;
      const putVal  = Math.max(0, strike - k.strike) * k.put_oi;
      return acc + callVal + putVal;
    }, 0);
    if (tv < minTotalValue) { minTotalValue = tv; maxPainStrike = strike; }
  }

  const gex = calculateGex(chain, spot);

  return {
    spot,
    iv_atm:             termStructure[0]?.atm_iv ?? 0,
    dvol_history:       [], // DVOL histórico requer endpoint separado — simplificado aqui
    term_structure:     termStructure,
    chain,
    put_call_ratio_oi:  totalCallOi > 0 ? totalPutOi / totalCallOi : 1,
    put_call_ratio_vol: totalCallVol > 0 ? totalPutVol / totalCallVol : 1,
    max_pain:           maxPainStrike,
    gamma_exposure_usd: gex,
    quality:            'A',
  };
}

/**
 * fetchDvolHistory — Histórico do índice DVOL (Deribit Volatility)
 * Atualiza a cada hora no máximo.
 *
 * @param days número de dias de histórico (padrão 30)
 */
export async function fetchDvolHistory(days = 30): Promise<Array<{ timestamp: number; value: number }>> {
  if (DATA_MODE === 'mock') {
    // Usa IV ATM + variação aleatória para simular DVOL
    return Array.from({ length: days }, (_, i) => ({
      timestamp: Date.now() - (days - 1 - i) * 86_400_000,
      value:     Math.round((btcOptions.iv_atm + (Math.random() - 0.5) * 0.1) * 100 * 10) / 10,
    }));
  }

  const endTs   = Date.now();
  const startTs = endTs - days * 86_400_000;

  const data = await safeFetch(
    `${BASE}/get_volatility_index_data?currency=BTC&start_timestamp=${startTs}&end_timestamp=${endTs}&resolution=1D`,
    DeribitResponseSchema(
      z.object({
        data: z.array(z.tuple([
          z.coerce.number(), // timestamp
          z.coerce.number(), // open
          z.coerce.number(), // high
          z.coerce.number(), // low
          z.coerce.number(), // close
        ])),
      }),
    ),
  );

  return data.result.data.map(([ts, , , , close]) => ({
    timestamp: ts,
    value:     close, // DVOL em pontos (0–100+)
  }));
}
