/**
 * marketCache.ts — Cache de borda no Supabase para APIs externas
 *
 * Protege limites gratuitos (ex: CoinGecko 30 req/min) e reduz latência
 * em cold starts quando múltiplos usuários abrem o dashboard simultaneamente.
 *
 * Fluxo:
 *   1. Supabase não configurado ou IS_LIVE=false → pula cache, chama API direta.
 *   2. Lê market_cache: se fresh (age < ttlSec) → retorna JSON do banco.
 *   3. Se stale/ausente → chama API, salva no banco (fire-and-forget), retorna.
 *
 * Timeout de leitura: 2s — se banco demorar, chama API diretamente sem bloquear.
 *
 * Tabela necessária: market_cache (migration 20260507000000_market_cache.sql)
 */

import { env, IS_LIVE } from '@/lib/env';

const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

function isConfigured(): boolean {
  return !!(SB_URL && SB_KEY);
}

function authHeaders(): Record<string, string> {
  return {
    apikey:        SB_KEY ?? '',
    Authorization: `Bearer ${SB_KEY ?? ''}`,
  };
}

/** Lê do cache. Retorna value_json se fresh, null se stale/ausente/erro. */
async function getCached<T>(cacheKey: string, ttlSec: number): Promise<T | null> {
  const url = `${SB_URL}/rest/v1/market_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=value_json,updated_at&limit=1`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, { headers: authHeaders(), signal: controller.signal });
    if (!res.ok) return null;

    const rows: Array<{ value_json: T; updated_at: string }> = await res.json();
    if (!rows.length) return null;

    const ageMs = Date.now() - new Date(rows[0].updated_at).getTime();
    if (ageMs > ttlSec * 1000) return null;

    return rows[0].value_json;
  } catch {
    return null; // timeout (2s) ou erro de rede — chama API diretamente
  } finally {
    clearTimeout(tid);
  }
}

/** Salva no cache. Fire-and-forget: não bloqueia o chamador. */
function setCached(cacheKey: string, value: unknown, source: string): void {
  if (!isConfigured()) return;

  fetch(`${SB_URL}/rest/v1/market_cache`, {
    method:  'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      'Prefer':       'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      cache_key:  cacheKey,
      value_json: value,
      source,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {}); // erros silenciados — cache é best-effort
}

/**
 * withCache — wrapper transparente de cache.
 *
 * Uso:
 *   return withCache('coingecko:dominance', 300, 'coingecko', () => fetchFromApi());
 *
 * @param cacheKey  Chave única (ex: 'coingecko:dominance', 'coingecko:altcoins:20')
 * @param ttlSec    Tempo de vida em segundos (ex: 300 = 5 min, 3600 = 1 hora)
 * @param source    Nome da fonte para auditoria (ex: 'coingecko', 'binance')
 * @param fetcher   Função que chama a API real quando cache miss
 */
export async function withCache<T>(
  cacheKey: string,
  ttlSec:   number,
  source:   string,
  fetcher:  () => Promise<T>,
): Promise<T> {
  if (!IS_LIVE || !isConfigured()) return fetcher();

  try {
    const hit = await getCached<T>(cacheKey, ttlSec);
    if (hit !== null) return hit;
  } catch {
    // erro interno — prossegue para API
  }

  const result = await fetcher();
  setCached(cacheKey, result, source);
  return result;
}
