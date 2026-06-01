/**
 * wikiPageviews.ts — Wikipedia Pageviews da página do Bitcoin
 *
 * API pública da Wikimedia, sem autenticação, CORS-friendly.
 * Lag: ~24h (dado do dia anterior disponível no dia seguinte).
 * Endpoint: https://wikimedia.org/api/rest_v1/metrics/pageviews/...
 *
 * Usado como métrica de "atenção ao Bitcoin" — picos correlacionam
 * com movimentos de preço e aumento de interesse de novos usuários.
 */

import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';

const BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const WikiItemSchema = z.object({
  project:   z.string(),
  article:   z.string(),
  timestamp: z.string(),  // YYYYMMDDHH00
  views:     z.number(),
});

const WikiResponseSchema = z.object({
  items: z.array(WikiItemSchema),
});

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface WikiPageviewPoint {
  date:  string;  // YYYY-MM-DD
  views: number;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export async function fetchBtcWikiPageviews(days = 7): Promise<WikiPageviewPoint[]> {
  const end   = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const url = `${BASE}/per-article/en.wikipedia/all-access/all-agents/Bitcoin/daily/${formatDate(start)}/${formatDate(end)}`;
  const raw = await apiFetch(url);
  const parsed = WikiResponseSchema.parse(raw);
  return parsed.items.map(item => ({
    date:  `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}-${item.timestamp.slice(6, 8)}`,
    views: item.views,
  }));
}
