/**
 * apiClient.ts — fetch wrapper centralizado com retry exponencial e detecção de 429
 *
 * Comportamento por status HTTP:
 *   429 → lança RateLimitError imediatamente (sem retry — esperar não resolve rate limit)
 *   5xx → retry com backoff: 2s → 4s → 8s (máx 3 tentativas)
 *   Erro de rede (TypeError) → retry com mesmo backoff
 *   Qualquer outro erro → lança imediatamente
 *
 * Uso:
 *   import { apiFetch, RateLimitError } from '@/lib/apiClient';
 *   const res = await apiFetch('https://api.example.com/data');
 *   // em vez de: const res = await fetch('https://api.example.com/data');
 */

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000];

/** Lançado quando a API retorna HTTP 429. Inclui retryAfterMs se o header estiver presente. */
export class RateLimitError extends Error {
  constructor(
    public readonly url:          string,
    public readonly retryAfterMs: number | undefined,
  ) {
    const hint = retryAfterMs ? ` (retry-after: ${retryAfterMs}ms)` : '';
    super(`Rate limit hit: ${url}${hint}`);
    this.name = 'RateLimitError';
  }
}

function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds * 1_000 : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * apiFetch — substituto direto de fetch() com retry e 429 handling.
 *
 * @param url     URL para buscar
 * @param options Mesmas opções do fetch nativo
 * @returns       Response com status 2xx
 * @throws        RateLimitError em 429 · Error em falha persistente após retries
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.status === 429) {
        throw new RateLimitError(url, parseRetryAfter(res.headers));
      }

      if (res.status >= 500) {
        // 5xx: servidor com problema temporário — vale retry
        lastError = new Error(`HTTP ${res.status}: ${url}`);
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw lastError;
      }

      return res;
    } catch (err) {
      // Relança RateLimitError sem retry
      if (err instanceof RateLimitError) throw err;

      // TypeError = erro de rede (offline, DNS, CORS) — vale retry
      if (err instanceof TypeError) {
        lastError = err;
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw lastError;
      }

      // Qualquer outro erro (ex: Error de status acima) — relança
      throw err;
    }
  }

  throw lastError ?? new Error(`apiFetch failed: ${url}`);
}
