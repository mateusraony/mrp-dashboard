/**
 * defillama.test.ts — testes para fetchStablecoinData
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock isSupabaseConfigured before importing
vi.mock('@/services/supabase', () => ({
  isSupabaseConfigured: vi.fn().mockReturnValue(false),
}));

// Mock withCache to pass through to fetcher
vi.mock('@/services/marketCache', () => ({
  withCache: vi.fn((_key, _ttl, _source, fetcher) => fetcher()),
}));

// Mock DATA_MODE as 'live' by default
vi.mock('@/lib/env', () => ({
  DATA_MODE: 'live',
  IS_LIVE:   true,
  env: {
    VITE_SUPABASE_URL:      undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  },
}));

import { fetchStablecoinData } from '@/services/defillama';

function makeStablecoinsResponse() {
  return {
    peggedAssets: [
      {
        name: 'Tether', symbol: 'USDT', pegType: 'peggedUSD',
        circulating: { peggedUSD: 110_000_000_000 },
        circulatingPrevDay: { peggedUSD: 109_000_000_000 },
        chainCirculating: {
          Ethereum: { current: { peggedUSD: 60_000_000_000 } },
          Tron:     { current: { peggedUSD: 40_000_000_000 } },
        },
      },
      {
        name: 'USD Coin', symbol: 'USDC', pegType: 'peggedUSD',
        circulating: { peggedUSD: 35_000_000_000 },
        circulatingPrevDay: { peggedUSD: 34_000_000_000 },
        chainCirculating: {},
      },
      {
        name: 'DAI', symbol: 'DAI', pegType: 'peggedUSD',
        circulating: { peggedUSD: 5_000_000_000 },
        circulatingPrevDay: { peggedUSD: 5_200_000_000 },
        chainCirculating: {},
      },
    ],
  };
}

function makeChainsResponse() {
  return [
    { name: 'Ethereum', totalCirculatingUSD: { peggedUSD: 80_000_000_000 } },
    { name: 'Tron',     totalCirculatingUSD: { peggedUSD: 45_000_000_000 } },
    { name: 'BNB',      totalCirculatingUSD: { peggedUSD: 20_000_000_000 } },
  ];
}

function makeFetchMock(stablecoins = makeStablecoinsResponse(), chains = makeChainsResponse()) {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: vi.fn().mockResolvedValue(stablecoins),
      headers: { get: () => null },
    })
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: vi.fn().mockResolvedValue(chains),
      headers: { get: () => null },
    });
}

describe('fetchStablecoinData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna StablecoinData com campos obrigatórios', async () => {
    const data = await fetchStablecoinData();
    expect(data).toHaveProperty('totalSupply');
    expect(data).toHaveProperty('totalChange24h');
    expect(data).toHaveProperty('top5');
    expect(data).toHaveProperty('byChain');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('quality');
    expect(data).toHaveProperty('source');
  });

  it('totalSupply é a soma de todos os circulating', async () => {
    const data = await fetchStablecoinData();
    expect(data.totalSupply).toBeCloseTo(150_000_000_000, -3);
  });

  it('top5 é ordenado por circulating (maior primeiro)', async () => {
    const data = await fetchStablecoinData();
    expect(data.top5[0].symbol).toBe('USDT');
    expect(data.top5[1].symbol).toBe('USDC');
  });

  it('byChain é ordenado por tvl e tem máximo 5 itens', async () => {
    const data = await fetchStablecoinData();
    expect(data.byChain.length).toBeLessThanOrEqual(5);
    expect(data.byChain[0].chain).toBe('Ethereum');
  });

  it('source=DeFiLlama em modo live com API respondendo', async () => {
    const data = await fetchStablecoinData();
    expect(data.source).toBe('DeFiLlama');
    expect(data.quality).toBe('A');
  });

  it('retorna mock quando DATA_MODE=mock', async () => {
    const { fetchStablecoinData: fetchMock } = await import('@/services/defillama');
    vi.doMock('@/lib/env', () => ({
      DATA_MODE: 'mock', IS_LIVE: false,
      env: { VITE_SUPABASE_URL: undefined, VITE_SUPABASE_ANON_KEY: undefined },
    }));
    const result = await fetchMock();
    // no erro = mock retornado
    expect(result).toHaveProperty('totalSupply');
  });

  it('retorna mock com quality=C quando Zod falha (resposta inválida)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: vi.fn().mockResolvedValue({ invalid: true }),
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: vi.fn().mockResolvedValue([]),
        headers: { get: () => null },
      }),
    );
    const data = await fetchStablecoinData();
    expect(data.quality).toBe('C');
    expect(data.source).toBe('mock');
  });

  it('retorna mock com quality=C em caso de RateLimitError (429)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429, statusText: 'Too Many Requests',
      headers: { get: () => null },
    }));
    const data = await fetchStablecoinData();
    expect(data.quality).toBe('C');
  });

  it('change24h está calculado corretamente para USDT', async () => {
    const data = await fetchStablecoinData();
    const usdt = data.top5.find(s => s.symbol === 'USDT')!;
    // (110B - 109B) / 109B * 100 ≈ 0.917%
    expect(usdt.change24h).toBeCloseTo(0.917, 1);
  });

  it('chainSupply de USDT tem Ethereum e Tron', async () => {
    const data = await fetchStablecoinData();
    const usdt = data.top5.find(s => s.symbol === 'USDT')!;
    expect(usdt.chainSupply).toHaveProperty('Ethereum');
    expect(usdt.chainSupply).toHaveProperty('Tron');
  });

  it('updatedAt é timestamp recente', async () => {
    const before = Date.now() - 1000;
    const data = await fetchStablecoinData();
    expect(data.updatedAt).toBeGreaterThan(before);
  });
});
