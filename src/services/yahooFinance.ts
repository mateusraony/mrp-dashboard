/**
 * yahooFinance.ts — Yahoo Finance API (gratuito, sem autenticação)
 *
 * Substitui SP500 e VIX do FRED para evitar restrições de licença:
 *   S&P 500  → ticker %5EGSPC
 *   VIX      → ticker %5EVIX
 *
 * Arquitetura de acesso:
 *   - Em produção (Supabase configurado): rota via fred-proxy Edge Function
 *     com type='yahoo_chart' para evitar bloqueio de CORS do browser.
 *   - Em dev local sem Supabase: chamada direta (pode funcionar, ou falha
 *     graciosamente retornando []).
 */

import { z } from 'zod';
import { env } from '@/lib/env';

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

// ─── Proxy / fetch ────────────────────────────────────────────────────────────

/**
 * Busca dados Yahoo Finance via Supabase Edge Function (server-side, sem CORS).
 * Fallback: chamada direta quando Supabase não configurado (dev local).
 */
async function fetchYahooRaw(ticker: string, days: number): Promise<unknown> {
  const baseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key     = env.VITE_SUPABASE_ANON_KEY;

  if (baseUrl && key) {
    // Produção: proxy server-side via fred-proxy (evita CORS)
    const res = await fetch(`${baseUrl}/functions/v1/fred-proxy`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body:   JSON.stringify({ type: 'yahoo_chart', params: { ticker, days: String(days) } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`fred-proxy yahoo_chart ${res.status}: ${ticker}`);
    return res.json();
  }

  // Dev local sem Supabase: tenta chamada direta
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${days}d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Yahoo direct HTTP ${res.status}: ${ticker}`);
  return res.json();
}

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
  try {
    const raw  = await fetchYahooRaw(ticker, days);
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
