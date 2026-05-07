/**
 * apiClient.test.ts — testes para apiFetch e RateLimitError
 *
 * fetch é mockado via vi.stubGlobal para controlar respostas sem rede real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, RateLimitError } from '@/lib/apiClient';

// Cria uma Response fake com o status informado
function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RateLimitError', () => {
  it('instancia com url e retryAfterMs undefined', () => {
    const err = new RateLimitError('https://api.example.com', undefined);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.url).toBe('https://api.example.com');
    expect(err.retryAfterMs).toBeUndefined();
    expect(err.name).toBe('RateLimitError');
  });

  it('instancia com retryAfterMs quando informado', () => {
    const err = new RateLimitError('https://api.example.com', 5_000);
    expect(err.retryAfterMs).toBe(5_000);
    expect(err.message).toContain('retry-after: 5000ms');
  });
});

describe('apiFetch — resposta 2xx', () => {
  it('retorna a Response em 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200)));
    const res = await apiFetch('https://api.example.com/data');
    expect(res.status).toBe(200);
  });

  it('retorna a Response em 201', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(201)));
    const res = await apiFetch('https://api.example.com/data');
    expect(res.status).toBe(201);
  });
});

describe('apiFetch — 429 Rate Limit', () => {
  it('lança RateLimitError imediatamente em 429 sem retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(429));
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('https://api.example.com')).rejects.toBeInstanceOf(RateLimitError);
    // Sem retry — fetch chamado apenas 1 vez
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('inclui retryAfterMs quando header Retry-After presente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeResponse(429, { 'Retry-After': '30' })
    ));

    const err = await apiFetch('https://api.example.com').catch(e => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBe(30_000);
  });

  it('retryAfterMs undefined quando Retry-After ausente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(429)));
    const err = await apiFetch('https://api.example.com').catch(e => e);
    expect((err as RateLimitError).retryAfterMs).toBeUndefined();
  });
});

describe('apiFetch — 5xx retry com backoff', () => {
  it('retenta em 503 e retorna 200 na segunda tentativa', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal('fetch', mockFetch);

    const promise = apiFetch('https://api.example.com');
    // Avança o timer para o primeiro delay (2s)
    await vi.advanceTimersByTimeAsync(2_000);
    const res = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it('lança após esgotar todos os retries em 500 persistente', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(500));
    vi.stubGlobal('fetch', mockFetch);

    // Registra o expect.rejects antes de avançar timers para evitar unhandled rejection
    const assertion = expect(apiFetch('https://api.example.com')).rejects.toThrow('HTTP 500');
    await vi.advanceTimersByTimeAsync(2_000 + 4_000 + 8_000);
    await assertion;

    // 1 tentativa inicial + 3 retries = 4 chamadas
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe('apiFetch — erro de rede', () => {
  it('retenta em TypeError (falha de rede) e retorna 200 na segunda tentativa', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal('fetch', mockFetch);

    const promise = apiFetch('https://api.example.com');
    await vi.advanceTimersByTimeAsync(2_000);
    const res = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it('lança após esgotar retries em TypeError persistente', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network offline'));
    vi.stubGlobal('fetch', mockFetch);

    // Registra o expect.rejects antes de avançar timers para evitar unhandled rejection
    const assertion = expect(apiFetch('https://api.example.com')).rejects.toThrow('Network offline');
    await vi.advanceTimersByTimeAsync(2_000 + 4_000 + 8_000);
    await assertion;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
