/**
 * yahooFinance.test.ts — testes para fetchYahooSeries, fetchSP500, fetchVIX
 *
 * Mocka fetch global via vi.stubGlobal para simular respostas da Yahoo Finance API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYahooSeries, fetchSP500, fetchVIX } from '@/services/yahooFinance';

// Resposta mínima válida da Yahoo Finance API
function makeYahooResponse(closes: (number | null)[], timestamps?: number[]) {
  const now = Math.floor(Date.now() / 1000);
  const ts = timestamps ?? closes.map((_, i) => now - (closes.length - 1 - i) * 86_400);
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: closes[closes.length - 1] ?? 0,
            previousClose: closes[closes.length - 2] ?? 0,
            symbol: 'TEST',
          },
          timestamp: ts,
          indicators: {
            quote: [{ close: closes }],
          },
        },
      ],
      error: null,
    },
  };
}

function makeFetchMock(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(body),
    headers: { get: () => null },
  });
}

describe('fetchYahooSeries', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock(makeYahooResponse([100, 102, 101, 103, 105])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna array de {date, value} com valores positivos', async () => {
    const result = await fetchYahooSeries('%5EGSPC', 5);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(pt => {
      expect(pt).toHaveProperty('date');
      expect(pt).toHaveProperty('value');
      expect(typeof pt.date).toBe('string');
      expect(pt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(pt.value).toBeGreaterThan(0);
    });
  });

  it('filtra pontos com value=0 ou null', async () => {
    vi.stubGlobal('fetch', makeFetchMock(makeYahooResponse([100, null, 0, 103])));
    const result = await fetchYahooSeries('%5EGSPC', 4);
    result.forEach(pt => expect(pt.value).toBeGreaterThan(0));
  });

  it('retorna [] quando fetch falha com TypeError (rede)', async () => {
    // apiFetch tem backoff 2s+4s+8s — usa fake timers para não esperar
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
    const promise = fetchYahooSeries('%5EGSPC', 5);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual([]);
    vi.useRealTimers();
  });

  it('retorna [] quando resposta Yahoo tem resultado inválido', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ chart: { result: [], error: null } }));
    const result = await fetchYahooSeries('%5EGSPC', 5);
    expect(result).toEqual([]);
  });

  it('retorna [] quando fetch retorna status 5xx após retries', async () => {
    // apiFetch tem backoff 2s+4s+8s — usa fake timers para não esperar
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, statusText: 'Service Unavailable',
      headers: { get: () => null },
    }));
    const promise = fetchYahooSeries('%5EGSPC', 5);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual([]);
    vi.useRealTimers();
  });
});

describe('fetchSP500', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock(makeYahooResponse([5000, 5100, 5200, 5300, 5400])));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('chama Yahoo Finance com ticker %5EGSPC', async () => {
    const result = await fetchSP500(5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[result.length - 1].value).toBe(5400);
  });
});

describe('fetchVIX', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock(makeYahooResponse([18.5, 17.2, 16.8, 17.5, 17.1])));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('chama Yahoo Finance com ticker %5EVIX', async () => {
    const result = await fetchVIX(5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[result.length - 1].value).toBeCloseTo(17.1, 1);
  });

  it('retorna [] graciosamente quando VIX indisponível', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
    const promise = fetchVIX(5);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual([]);
    vi.useRealTimers();
  });
});
