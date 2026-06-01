/**
 * cryptoPanic.ts — CryptoPanic: notícias com votos bullish/bearish da comunidade
 *
 * Requer VITE_CRYPTOPANIC_KEY (chave gratuita, sem cartão de crédito).
 * Se a chave não estiver configurada, retorna null — sem erro.
 * Endpoint: https://cryptopanic.com/api/v1/posts/
 * Rate limit free tier: 200 req/hora.
 */

import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';

const BASE = 'https://cryptopanic.com/api/v1';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const VotesSchema = z.object({
  negative: z.number().optional().default(0),
  positive: z.number().optional().default(0),
  important: z.number().optional().default(0),
  liked: z.number().optional().default(0),
  disliked: z.number().optional().default(0),
  lol: z.number().optional().default(0),
  toxic: z.number().optional().default(0),
  saved: z.number().optional().default(0),
  comments: z.number().optional().default(0),
});

const CryptoPanicPostSchema = z.object({
  id:           z.number(),
  title:        z.string(),
  url:          z.string(),
  source:       z.object({ title: z.string(), domain: z.string() }).optional(),
  published_at: z.string(),
  votes:        VotesSchema.optional(),
});

const CryptoPanicResponseSchema = z.object({
  results: z.array(CryptoPanicPostSchema),
});

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface CryptoPanicPost {
  id:           number;
  title:        string;
  url:          string;
  source:       string;
  published_at: string;
  bullish:      number;
  bearish:      number;
  sentiment:    number;   // -1 | 0 | 1 derivado de votos
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

export async function fetchCryptoPanicNews(): Promise<CryptoPanicPost[] | null> {
  const key = import.meta.env.VITE_CRYPTOPANIC_KEY as string | undefined;
  if (!key) return null;  // sem chave: retorna null sem lançar erro

  const url = `${BASE}/posts/?auth_token=${key}&currencies=BTC&kind=news&filter=hot&public=true`;
  const raw = await apiFetch(url);
  const parsed = CryptoPanicResponseSchema.parse(raw);

  return parsed.results.map(p => {
    const bullish = (p.votes?.positive ?? 0) + (p.votes?.liked ?? 0);
    const bearish = (p.votes?.negative ?? 0) + (p.votes?.disliked ?? 0);
    const total   = bullish + bearish;
    const sentiment = total === 0 ? 0 : bullish > bearish ? 1 : bearish > bullish ? -1 : 0;
    return {
      id:           p.id,
      title:        p.title,
      url:          p.url,
      source:       p.source?.title ?? p.source?.domain ?? 'CryptoPanic',
      published_at: p.published_at,
      bullish,
      bearish,
      sentiment,
    };
  });
}
