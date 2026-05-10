/**
 * marketCache.test.ts — testes para withCache e withSWR
 *
 * Ambiente padrão: VITE_DATA_MODE=mock, sem VITE_SUPABASE_URL.
 * Isso significa IS_LIVE=false e isConfigured()=false → withCache/withSWR
 * chamam o fetcher diretamente sem tocar no Supabase.
 *
 * Testes withSWR mocam IS_LIVE=true + fetch global para simular respostas
 * do Supabase sem rede real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withCache, isConfigured } from '@/services/marketCache';

describe('isConfigured', () => {
  it('retorna false quando VITE_SUPABASE_URL não está definido', () => {
    // Em ambiente de teste não há VITE_SUPABASE_URL
    expect(isConfigured()).toBe(false);
  });
});

describe('withCache — IS_LIVE=false (modo mock)', () => {
  it('chama o fetcher diretamente quando não configurado', async () => {
    const expected = { btc_dominance: 63.5, total_mcap_usd: 3e12 };
    const fetcher = vi.fn().mockResolvedValue(expected);

    const result = await withCache('test:key', 300, 'test', fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toBe(expected);
  });

  it('retorna o valor do fetcher sem modificação', async () => {
    const data = { a: 1, b: 'hello', c: [1, 2, 3] };
    const result = await withCache('test:key2', 60, 'test', async () => data);
    expect(result).toEqual(data);
  });

  it('funciona com fetcher que retorna array', async () => {
    const arr = [{ id: 'btc', current_price: 95000 }];
    const result = await withCache('test:altcoins', 300, 'coingecko', async () => arr);
    expect(result).toEqual(arr);
  });

  it('propaga erro do fetcher quando fetcher lança', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('API error 429'));
    await expect(withCache('test:fail', 300, 'test', fetcher)).rejects.toThrow('API error 429');
  });

  it('ignora o parâmetro validate quando cache é pulado (IS_LIVE=false)', async () => {
    const expected = { value: 42 };
    const validate = vi.fn().mockReturnValue(null);
    const fetcher = vi.fn().mockResolvedValue(expected);

    const result = await withCache('test:validate', 300, 'test', fetcher, validate);

    // validate nunca chamado porque não há cache hit em modo mock
    expect(validate).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });
});
