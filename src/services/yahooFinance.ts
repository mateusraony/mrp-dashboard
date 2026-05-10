/**
 * yahooFinance.ts — Yahoo Finance API (gratuito, sem autenticação)
 *
 * Substitui SP500 e VIX do FRED para evitar restrições de licença:
 *   S&P 500  → ticker %5EGSPC
 *   VIX      → ticker %5EVIX
 *
 * Não requer chave de API. Dados EOD (fim de dia).
 * Em caso de falha retorna [] — fetchMacroBoard trata com Promise.allSettled.
 */

import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';

// ─── Schema ───────────────────────────────────────────────────────────────────

const YahooChartSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      meta: z.object({
        regularMarketPrice: z.number(),
        previousClose:      z.number(),
        symbol:             z.string(),
      }),
      timestamp: z.array(z.number()),
      indicators: z.object({
        quote: z.array(z.object({
          close: z.array(z.number().nullable()),
        })),
      }),
    })).min(1),
    error: z.null().optional(),
  }),
});

// Yahoo Finance requer User-Agent para evitar bloqueio
const YAHOO_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)',
  'Accept':     'application/json',
};

// ─── Fetcher base ─────────────────────────────────────────────────────────────

/**
 * Busca série histórica de um ticker Yahoo Finance.
 * @param ticker  Ticker codificado para URL (ex: '%5EGSPC', '%5EVIX')
 * @param days    Janela de histórico em dias (padrão: 40)
 * @returns       Array de {date, value} ordenado por data, ou [] em caso de falha
 */
export async function fetchYahooSeries(
  ticker: string,
  days = 40,
): Promise<Array<{ date: string; value: number }>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${days}d`;

  try {
    const res  = await apiFetch(url, { headers: YAHOO_HEADERS });
    const raw  = await res.json();
    const data = YahooChartSchema.parse(raw);

    const result = data.chart.result[0];
    const closes = result.indicators.quote[0].close;

    return result.timestamp
      .map((ts, i) => ({
        date:  new Date(ts * 1_000).toISOString().slice(0, 10),
        value: closes[i] ?? 0,
      }))
      .filter(p => p.value > 0);
  } catch (err) {
    console.warn(`[yahooFinance] ${ticker} falhou:`, (err as Error).message ?? err);
    return [];
  }
}

// ─── Exportações específicas ──────────────────────────────────────────────────

/** S&P 500 Index — ticker ^GSPC */
export async function fetchSP500(days = 40): Promise<Array<{ date: string; value: number }>> {
  return fetchYahooSeries('%5EGSPC', days);
}

/** CBOE VIX — ticker ^VIX */
export async function fetchVIX(days = 40): Promise<Array<{ date: string; value: number }>> {
  return fetchYahooSeries('%5EVIX', days);
}
