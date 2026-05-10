/**
 * marketCache.ts — Cache de borda no Supabase para APIs externas
 *
 * Protege limites gratuitos (ex: CoinGecko 30 req/min) e reduz latência
 * em cold starts quando múltiplos usuários abrem o dashboard simultaneamente.
 *
 * withCache — fluxo clássico (bloqueante):
 *   1. Supabase não configurado ou IS_LIVE=false → pula cache, chama API direta.
 *   2. Lê market_cache: se fresh (age < ttlSec) → retorna JSON do banco.
 *   3. Se stale/ausente → chama API, salva no banco (fire-and-forget), retorna.
 *
 * withSWR — Stale-While-Revalidate:
 *   1. Cache miss → chama API (bloqueante), salva, retorna.
 *   2. Cache hit (mesmo stale) → retorna IMEDIATAMENTE + refresh em background.
 *   3. Background refresh é deduplicado e silencioso.
 *
 * Timeout de leitura: 2s — se banco demorar, chama API diretamente sem bloquear.
 *
 * Segurança: o parâmetro `validate` permite rejeitar cache hits mal-formados
 * ou potencialmente envenenados antes de retorná-los ao chamador.
 *
 * Tabela necessária: market_cache (migration 20260507000000_market_cache.sql)
 */

import { env, IS_LIVE } from '@/lib/env';

const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

export function isConfigured(): boolean {
  return !!(SB_URL && SB_KEY);
}

function authHeaders(): Record<string, string> {
  return {
    apikey:        SB_KEY ?? '',
    Authorization: `Bearer ${SB_KEY ?? ''}`,
  };
}

/** Lê do cache. Retorna a row completa se encontrada, null se ausente/erro. */
async function getCachedRow<T>(
  cacheKey: string,
): Promise<{ value_json: T; updated_at: string } | null> {
  const url = `${SB_URL}/rest/v1/market_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=value_json,updated_at&limit=1`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, { headers: authHeaders(), signal: controller.signal });
    if (!res.ok) return null;

    const rows: Array<{ value_json: T; updated_at: string }> = await res.json();
    return rows.length ? rows[0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

/** Lê do cache. Retorna value_json se fresh, null se stale/ausente/erro. */
async function getCached<T>(cacheKey: string, ttlSec: number): Promise<T | null> {
  const row = await getCachedRow<T>(cacheKey);
  if (!row) return null;

  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > ttlSec * 1000) return null;

  return row.value_json;
}

/**
 * Salva no cache. Fire-and-forget: não bloqueia o chamador.
 *
 * Usa ?on_conflict=cache_key para que o PostgREST use o índice UNIQUE
 * de cache_key como alvo do ON CONFLICT — sem isso cada write insere
 * uma nova linha e falha silenciosamente na segunda chamada.
 */
function setCached(cacheKey: string, value: unknown, source: string): void {
  if (!isConfigured()) return;

  fetch(`${SB_URL}/rest/v1/market_cache?on_conflict=cache_key`, {
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
      fetched_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

/**
 * withCache — wrapper transparente de cache (bloqueante).
 *
 * @param cacheKey  Chave única (ex: 'coingecko:dominance', 'coingecko:altcoins:20')
 * @param ttlSec    Tempo de vida em segundos (ex: 300 = 5 min, 3600 = 1 hora)
 * @param source    Nome da fonte para auditoria (ex: 'coingecko', 'binance')
 * @param fetcher   Função que chama a API real quando cache miss
 * @param validate  Validador opcional: recebe o valor bruto do cache e retorna T
 *                  ou null se inválido. Previne que dados envenenados (escrita
 *                  maliciosa via anon key) sejam retornados ao chamador.
 */
export async function withCache<T>(
  cacheKey:  string,
  ttlSec:    number,
  source:    string,
  fetcher:   () => Promise<T>,
  validate?: (v: unknown) => T | null,
): Promise<T> {
  if (!IS_LIVE || !isConfigured()) return fetcher();

  try {
    const hit = await getCached<T>(cacheKey, ttlSec);
    if (hit !== null) {
      if (validate) {
        const safe = validate(hit);
        if (safe !== null) return safe;
      } else {
        return hit;
      }
    }
  } catch {
    // erro interno — prossegue para API
  }

  const result = await fetcher();
  setCached(cacheKey, result, source);
  return result;
}

// Mapa de refreshes em andamento para deduplicação
const pendingRefreshes = new Map<string, Promise<void>>();

/**
 * scheduleRefresh — dispara um refresh em background de forma deduplicada.
 * Nunca lança exceção para o chamador. Compara JSON antes de salvar.
 */
function scheduleRefresh<T>(
  cacheKey: string,
  source:   string,
  fetcher:  () => Promise<T>,
  validate?: (v: unknown) => T | null,
): void {
  if (pendingRefreshes.has(cacheKey)) return;

  const work = (async (): Promise<void> => {
    try {
      const fresh = await fetcher();

      if (validate) {
        const safe = validate(fresh);
        if (safe === null) return;
      }

      const existing = await getCachedRow<T>(cacheKey);
      if (existing && JSON.stringify(existing.value_json) === JSON.stringify(fresh)) return;

      setCached(cacheKey, fresh, source);
    } catch {
      // refresh silencioso — nunca propaga erro
    } finally {
      pendingRefreshes.delete(cacheKey);
    }
  })();

  pendingRefreshes.set(cacheKey, work);
}

/**
 * withSWR — Stale-While-Revalidate com Supabase como cache de borda.
 *
 * Retorna dados do Supabase imediatamente (mesmo stale) e dispara
 * refresh em background para manter o cache sempre atualizado.
 *
 * Diferente de withCache: sempre retorna cache (se existir), nunca bloqueia.
 *
 * @param cacheKey  Chave única do cache
 * @param ttlSec    TTL em segundos (usado apenas para cache miss — sem cache dispara fetch bloqueante)
 * @param source    Nome da fonte para auditoria
 * @param fetcher   Função que chama a API real
 * @param validate  Validador opcional contra envenenamento de cache
 */
export async function withSWR<T>(
  cacheKey:  string,
  ttlSec:    number,
  source:    string,
  fetcher:   () => Promise<T>,
  validate?: (v: unknown) => T | null,
): Promise<T> {
  void ttlSec; // SWR retorna cache mesmo stale; TTL presente apenas para assinatura compatível

  if (!IS_LIVE || !isConfigured()) return fetcher();

  try {
    const row = await getCachedRow<T>(cacheKey);

    if (row !== null) {
      let value: T = row.value_json;

      if (validate) {
        const safe = validate(row.value_json);
        if (safe === null) {
          // dado envenenado — trata como miss
          const result = await fetcher();
          setCached(cacheKey, result, source);
          return result;
        }
        value = safe;
      }

      scheduleRefresh(cacheKey, source, fetcher, validate);
      return value;
    }
  } catch {
    // erro lendo cache — prossegue para API
  }

  const result = await fetcher();
  setCached(cacheKey, result, source);
  return result;
}

export { pendingRefreshes as _pendingRefreshes };
