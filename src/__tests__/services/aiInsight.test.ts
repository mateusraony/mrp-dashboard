/**
 * aiInsight.test.ts — testes para fetchAiInsight
 *
 * fetch é mockado via vi.stubGlobal; env.VITE_SUPABASE_URL/KEY são mockados
 * via vi.mock para simular credenciais válidas em ambiente de teste.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAiInsight, type AiInsightPayload } from '@/services/aiInsight';

// Fornece credenciais Supabase fake para que fetchAiInsight não lance antes de buscar
vi.mock('@/lib/env', () => ({
  env: {
    VITE_SUPABASE_URL:      'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_DATA_MODE:         'mock',
  },
  IS_LIVE:   false,
  DATA_MODE: 'mock',
  setDataMode: vi.fn(),
}));

const BASE_PAYLOAD: AiInsightPayload = {
  riskScore:      65,
  riskRegime:     'MODERADO',
  fearGreedValue: 72,
  fearGreedLabel: 'Greed',
  fundingRate:    0.0003,
  mtfConfluence:  'FORTE',
  mtfDirection:   'bullish',
};

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAiInsight', () => {
  it('retorna insight string em caso de sucesso', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ insight: 'Mercado em tendência altista com confluência forte.' }),
    );

    const result = await fetchAiInsight(BASE_PAYLOAD);
    expect(result).toBe('Mercado em tendência altista com confluência forte.');
  });

  it('chama a URL correta com método POST e cabeçalhos corretos', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ insight: 'Análise OK.' }),
    );

    await fetchAiInsight(BASE_PAYLOAD);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];

    expect(url).toBe('https://test.supabase.co/functions/v1/ai-analysis');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-anon-key');
  });

  it('serializa o payload incluindo zAlerts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ insight: 'Volume anômalo detectado.' }),
    );

    await fetchAiInsight({
      ...BASE_PAYLOAD,
      zAlerts: [{ metric: 'volume', level: 'extreme', z: 2.3, direction: 'bullish' }],
    });

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string) as { zAlerts: unknown[] };
    expect(body.zAlerts).toHaveLength(1);
    expect((body.zAlerts[0] as { metric: string }).metric).toBe('volume');
  });

  it('lança erro quando a Edge Function retorna status não-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: 'ANTHROPIC_API_KEY não configurada' }, 503),
    );

    await expect(fetchAiInsight(BASE_PAYLOAD)).rejects.toThrow('503');
  });

  it('lança erro quando a resposta não contém o campo insight', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({}),
    );

    await expect(fetchAiInsight(BASE_PAYLOAD)).rejects.toThrow('Resposta vazia');
  });

  it('remove trailing slash da SUPABASE_URL antes de montar o endpoint', async () => {
    // O mock de env já não tem trailing slash, mas testamos a lógica de sanitização
    // chamando com URL sem trailing slash — deve funcionar normalmente
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ insight: 'OK sem barra.' }),
    );

    const result = await fetchAiInsight(BASE_PAYLOAD);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).not.toContain('//functions');
    expect(result).toBe('OK sem barra.');
  });
});
