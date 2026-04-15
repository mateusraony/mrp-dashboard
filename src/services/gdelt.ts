/**
 * gdelt.ts — GDELT DOC 2.0 API
 *
 * API pública, sem autenticação, sem limite estrito.
 * Endpoint: https://api.gdeltproject.org/api/v2/doc/doc
 *
 * Documentação: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

import { z } from 'zod';
import { DATA_MODE } from '@/lib/env';
import { logInfo, logError } from '@/lib/debugLog';

const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GdeltArticleSchema = z.object({
  title:       z.string(),
  url:         z.string().url(),
  seendate:    z.string(),
  socialimage: z.string().optional().nullable(),
  domain:      z.string(),
  language:    z.string().optional(),
});

const GdeltResponseSchema = z.object({
  articles: z.array(GdeltArticleSchema).default([]),
});

export type GdeltArticle = z.infer<typeof GdeltArticleSchema>;

// ─── Tipos enriquecidos ───────────────────────────────────────────────────────

export interface GdeltArticleEnriched extends GdeltArticle {
  /** -1 negativo | 0 neutro | 1 positivo */
  sentiment:       -1 | 0 | 1;
  sentiment_label: 'Positivo' | 'Negativo' | 'Neutro';
  /** ISO string convertida de seendate */
  published_at:    string;
}

// ─── Palavras-chave de sentimento ────────────────────────────────────────────

const POSITIVE_KEYWORDS = [
  'rally', 'surge', 'bullish', 'adoption', 'ath', 'gain', 'rise', ' up ',
  'record', 'breakthrough', 'approval', 'growth', 'all-time high', 'soar',
];

const NEGATIVE_KEYWORDS = [
  'crash', 'drop', 'bearish', 'ban', 'hack', 'loss', 'fall', ' down ',
  'fear', 'plunge', 'sell-off', 'lawsuit', 'collapse', 'decline', 'slump',
];

function detectSentiment(title: string): { sentiment: -1 | 0 | 1; sentiment_label: 'Positivo' | 'Negativo' | 'Neutro' } {
  const lower = title.toLowerCase();

  const posHits = POSITIVE_KEYWORDS.filter(kw => lower.includes(kw)).length;
  const negHits = NEGATIVE_KEYWORDS.filter(kw => lower.includes(kw)).length;

  if (posHits > negHits) {
    return { sentiment: 1, sentiment_label: 'Positivo' };
  }
  if (negHits > posHits) {
    return { sentiment: -1, sentiment_label: 'Negativo' };
  }
  return { sentiment: 0, sentiment_label: 'Neutro' };
}

// ─── Conversão de seendate ────────────────────────────────────────────────────

/**
 * Converte formato GDELT "20260415T123000Z" → ISO string "2026-04-15T12:30:00.000Z"
 */
function parseGdeltDate(seendate: string): string {
  try {
    // Formato: "YYYYMMDDTHHmmssZ"
    const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (!m) {
      // Tenta ISO padrão como fallback
      return new Date(seendate).toISOString();
    }
    const [, yr, mo, dy, hr, mn, sc] = m;
    return new Date(`${yr}-${mo}-${dy}T${hr}:${mn}:${sc}Z`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── Enriquecimento ───────────────────────────────────────────────────────────

function enrichArticle(article: GdeltArticle): GdeltArticleEnriched {
  const { sentiment, sentiment_label } = detectSentiment(article.title);
  return {
    ...article,
    sentiment,
    sentiment_label,
    published_at: parseGdeltDate(article.seendate),
  };
}

// ─── Fetcher principal ────────────────────────────────────────────────────────

/**
 * fetchGdeltNews — Busca artigos recentes via GDELT DOC 2.0
 *
 * Em DATA_MODE=mock → retorna array vazio (a UI exibe "Ative o modo LIVE")
 * Em DATA_MODE=live → chama a API, valida com Zod, retorna artigos enriquecidos
 */
export async function fetchGdeltNews(
  query: string = 'bitcoin crypto',
): Promise<GdeltArticleEnriched[]> {
  if (DATA_MODE === 'mock') {
    return [];
  }

  const params = new URLSearchParams({
    query:      query,
    mode:       'artlist',
    format:     'json',
    maxrecords: '25',
    sort:       'DateDesc',
  });

  const url = `${BASE}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`GDELT API error ${res.status}: ${res.statusText}`);
    logError('GDELT fetch failed', err, 'gdelt');
    throw err;
  }

  const raw: unknown = await res.json();
  const parsed = GdeltResponseSchema.parse(raw);

  // Filtra para inglês e português (lang=english | portuguese)
  const filtered = parsed.articles.filter(a => {
    if (!a.language) return true;
    const lang = a.language.toLowerCase();
    return lang === 'english' || lang === 'portuguese';
  });

  const enriched = filtered.map(enrichArticle);

  logInfo('GDELT fetch', { count: enriched.length, query }, 'gdelt');

  return enriched;
}
