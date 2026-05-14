/**
 * marketCache.test.ts — testes para withCache e withSWR
 *
 * O módulo @/lib/env é mockado para fornecer IS_LIVE=true e credenciais
 * Supabase fictícias, permitindo testar os caminhos de cache sem rede real.
 * O global fetch é mockado em cada teste para simular respostas do Supabase.
 *
 * Como vi.mock é hoistado, isConfigured() retorna true neste arquivo —
 * o comportamento em produção sem credenciais é coberto pelo teste de isConfigured.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoistado automaticamente pelo Vitest — afeta todos os testes neste arquivo
vi.mock('@/lib/env', () => ({
  IS_LIVE:   true,
  DATA_MODE: 'live',
  env: {
    VITE_SUPABASE_URL:      'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

import {
  withCache,
  withSWR,
  isConfigured,
  _pendingRefreshes,
} from '@/services/marketCache';

// ─── isConfigured ──────────────────────────────────────────────────────────────────────────────

describe('isConfigured', () => {
  it('retorna true quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidos', () => {
    expect(isConfigured()).toBe(true);
  });
});

// ─── withCache — IS_LIVE=true, fetch mockado ────────────────────────────────────────────────

describe('withCache — IS_LIVE=true (com cache mockado)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('chama o fetcher quando cache miss (Supabase retorna array vazio)', async () => {
    const expected = { btc_dominance: 63.5, total_mcap_usd: 3e12 };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })   // GET — miss
      .mockResolvedValue({ ok: true, json: async () => ({}) }),     // POST save
    );
    const fetcher = vi.fn().mockResolvedValue(expected);

    const result = await withCache('wc:miss', 300, 'test', fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });

  it('retorna cache hit sem chamar fetcher quando dado é fresh', async () => {
    const cached = { btc_dominance: 60 };
    const freshUpdatedAt = new Date().toISOString();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValue({
        ok:   true,
        json: async () => [{ value_json: cached, updated_at: freshUpdatedAt }],
      }),
    );
    const fetcher = vi.fn();

    const result = await withCache('wc:hit', 300, 'test', fetcher);

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });

  it('retorna o valor do fetcher sem modificação em cache miss', async () => {
    const data = { a: 1, b: 'hello', c: [1, 2, 3] };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const result = await withCache('wc:value', 60, 'test', async () => data);
    expect(result).toEqual(data);
  });

  it('funciona com fetcher que retorna array', async () => {
    const arr = [{ id: 'btc', current_price: 95000 }];
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const result = await withCache('wc:arr', 300, 'coingecko', async () => arr);
    expect(result).toEqual(arr);
  });

  it('propaga erro do fetcher quando fetcher lança', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValue({ ok: true, json: async () => [] }),
    );
    const fetcher = vi.fn().mockRejectedValue(new Error('API error 429'));
    await expect(withCache('wc:fail', 300, 'test', fetcher)).rejects.toThrow('API error 429');
  });

  it('aplica validate ao cache hit e rejeita dado inválido (trata como miss)', async () => {
    const cached = { value: 'bad' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok:   true,
        json: async () => [{ value_json: cached, updated_at: new Date().toISOString() }],
      })
      .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const expected = { value: 42 };
    const validate = vi.fn().mockReturnValue(null);  // rejeita o cache
    const fetcher = vi.fn().mockResolvedValue(expected);

    const result = await withCache('wc:validate', 300, 'test', fetcher, validate);

    expect(validate).toHaveBeenCalledWith(cached);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });
});

// ─── withSWR — testes de comportamento SWR ─────────────────────────────────────────────────

describe('withSWR — cache miss chama fetcher e retorna dado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _pendingRefreshes.clear();
  });

  it('cache miss → chama fetcher e retorna dado', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })   // GET — miss
      .mockResolvedValue({ ok: true, json: async () => ({}) }),     // POST save
    );
    const expected = { price: 95000 };
    const fetcher = vi.fn().mockResolvedValue(expected);

    const result = await withSWR('swr:miss', 300, 'test', fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });
});

describe('withSWR — cache hit retorna dado sem chamar fetcher bloqueante', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _pendingRefreshes.clear();
  });

  it('cache hit → retorna dado do cache imediatamente', async () => {
    const cachedValue = { price: 90000 };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok:   true,
        json: async () => [{ value_json: cachedValue, updated_at: new Date().toISOString() }],
      })
      .mockResolvedValue({
        ok:   true,
        json: async () => [{ value_json: cachedValue, updated_at: new Date().toISOString() }],
      }),
    );
    const fetcher = vi.fn().mockResolvedValue({ price: 91000 });

    const result = await withSWR('swr:hit', 300, 'test', fetcher);

    // Retorna imediatamente o dado do cache — fetcher NÃO é chamado de forma bloqueante
    expect(result).toEqual(cachedValue);
    // A primeira chamada ao fetch foi a leitura do Supabase (GET) com a chave correta
    expect((vi.mocked(fetch).mock.calls[0][0] as string)).toContain('swr%3Ahit');
  });
});

describe('withSWR — background refresh deduplicado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _pendingRefreshes.clear();
  });

  it('duas chamadas simultâneas com hit disparam fetcher apenas 1x no background', async () => {
    const cachedValue = { price: 88000 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => [{ value_json: cachedValue, updated_at: new Date().toISOString() }],
    }));

    let fetcherCalls = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      fetcherCalls++;
      return { price: 89000 };
    });

    // Duas chamadas simultâneas — ambas devem retornar o cache imediatamente
    const [r1, r2] = await Promise.all([
      withSWR('swr:dedup', 300, 'test', fetcher),
      withSWR('swr:dedup', 300, 'test', fetcher),
    ]);

    expect(r1).toEqual(cachedValue);
    expect(r2).toEqual(cachedValue);

    // Aguarda o background refresh completar
    const pending = _pendingRefreshes.get('swr:dedup');
    if (pending) await pending;

    // Graças à dedupliccação, fetcher chamado no máximo 1x no background
    expect(fetcherCalls).toBeLessThanOrEqual(1);
  });
});

describe('withSWR — só salva no Supabase se dado mudou', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _pendingRefreshes.clear();
  });

  it('não faz POST no Supabase quando dado do fetcher é igual ao cache', async () => {
    const cachedValue = { price: 87000 };
    const postCalls: string[] = [];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        postCalls.push(url as string);
      }
      return Promise.resolve({
        ok:   true,
        json: async () => [{ value_json: cachedValue, updated_at: new Date().toISOString() }],
      });
    }));

    // Fetcher retorna exatamente o mesmo valor que está no cache
    const fetcher = vi.fn().mockResolvedValue(cachedValue);

    await withSWR('swr:nowrite', 300, 'test', fetcher);

    // Aguarda o background refresh completar
    const pending = _pendingRefreshes.get('swr:nowrite');
    if (pending) await pending;

    // Nenhum POST porque o dado não mudou
    expect(postCalls).toHaveLength(0);
  });
});
