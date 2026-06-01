/**
 * reddit.ts — Reddit JSON API (sem autenticação, leitura pública)
 *
 * Busca posts recentes sobre Bitcoin ETF flows em r/ETFs e r/Bitcoin,
 * e top posts de r/Bitcoin com análise de sentimento por título.
 * Rate limit: ~60 req/min (anônimo). Cache: 30min via TanStack Query.
 */

import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';
import { IS_LIVE } from '@/lib/env';

export interface RedditPost {
  title:       string;
  url:         string;
  permalink:   string;
  subreddit:   string;
  score:       number;
  created_utc: number;
  thumbnail:   string;
}

interface RedditChild {
  data: {
    title:       string;
    url:         string;
    permalink:   string;
    subreddit:   string;
    score:       number;
    created_utc: number;
    thumbnail:   string;
    is_self:     boolean;
    stickied:    boolean;
  };
}

const MOCK_POSTS: RedditPost[] = [
  { title: 'IBIT breaks $50B AUM — BlackRock ETF milestone', url: '#', permalink: '#', subreddit: 'ETFs', score: 342, created_utc: Date.now() / 1000 - 3600, thumbnail: '' },
  { title: 'Bitcoin ETF flows tracker — weekly update (r/Bitcoin)', url: '#', permalink: '#', subreddit: 'Bitcoin', score: 218, created_utc: Date.now() / 1000 - 7200, thumbnail: '' },
  { title: 'Why institutional inflows into BTC ETFs matter for price discovery', url: '#', permalink: '#', subreddit: 'ETFs', score: 97, created_utc: Date.now() / 1000 - 14400, thumbnail: '' },
];

async function fetchSubredditPosts(subreddit: string, query: string, limit = 5): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=new&t=week&limit=${limit}&type=link`;
  const res = await apiFetch(url, { headers: { 'User-Agent': 'mrp-dashboard/1.0' } });
  const json = await res.json() as { data?: { children?: RedditChild[] } };
  const children = json?.data?.children ?? [];
  return children
    .filter(c => !c.data.stickied)
    .map(c => ({
      title:       c.data.title,
      url:         c.data.url,
      permalink:   `https://www.reddit.com${c.data.permalink}`,
      subreddit:   c.data.subreddit,
      score:       c.data.score,
      created_utc: c.data.created_utc,
      thumbnail:   c.data.thumbnail ?? '',
    }));
}

// ─── r/Bitcoin Sentiment ──────────────────────────────────────────────────────
// Keywords de sentimento para análise de títulos (mesmo padrão do GDELT)

const POSITIVE_KWS = [
  'bullish','moon','ath','buy','hodl','rally','pump','surge','breakout',
  'adoption','accumulate','green','uptrend','recovery','highs','gained',
  'milestone','record','launch','wins',
];

const NEGATIVE_KWS = [
  'bearish','crash','dump','sell','fear','ban','hack','scam','bubble',
  'drop','fall','collapse','panic','liquidation','loss','regulatory',
  'warning','risk','bear','down','correction','decline',
];

const RedditBitcoinPostSchema = z.object({
  title:          z.string(),
  score:          z.number(),
  num_comments:   z.number(),
  permalink:      z.string(),
  author:         z.string(),
  upvote_ratio:   z.number().optional(),
});

const RedditBitcoinResponseSchema = z.object({
  data: z.object({
    children: z.array(z.object({ data: RedditBitcoinPostSchema })),
  }),
});

export interface RedditBitcoinPost {
  title:           string;
  score:           number;
  comments:        number;
  url:             string;
  author:          string;
  sentiment:       number;           // -1 | 0 | 1
  sentiment_label: 'bearish' | 'neutral' | 'bullish';
  upvote_ratio:    number;
}

function detectBitcoinSentiment(title: string): { sentiment: number; label: 'bearish' | 'neutral' | 'bullish' } {
  const t = title.toLowerCase();
  const pos = POSITIVE_KWS.filter(k => t.includes(k)).length;
  const neg = NEGATIVE_KWS.filter(k => t.includes(k)).length;
  if (pos > neg) return { sentiment: 1, label: 'bullish' };
  if (neg > pos) return { sentiment: -1, label: 'bearish' };
  return { sentiment: 0, label: 'neutral' };
}

export async function fetchRedditBitcoinPosts(limit = 25): Promise<RedditBitcoinPost[]> {
  const url = `https://www.reddit.com/r/Bitcoin/top.json?t=day&limit=${limit}`;
  const raw = await apiFetch(url, {
    headers: { 'User-Agent': 'MRPDashboard/2.0 (mrp-dashboard.onrender.com)' },
  });
  const parsed = RedditBitcoinResponseSchema.parse(raw);
  return parsed.data.children.map(({ data: p }) => {
    const { sentiment, label } = detectBitcoinSentiment(p.title);
    return {
      title:           p.title,
      score:           p.score,
      comments:        p.num_comments,
      url:             `https://reddit.com${p.permalink}`,
      author:          p.author,
      sentiment,
      sentiment_label: label,
      upvote_ratio:    p.upvote_ratio ?? 0.5,
    };
  });
}

/** Agrega posts em score 0-100 de sentimento para uso no gauge composto. */
export function redditPostsToScore(posts: RedditBitcoinPost[]): number {
  if (posts.length === 0) return 50;
  const avg = posts.reduce((s, p) => s + p.sentiment, 0) / posts.length;
  return Math.round(Math.max(0, Math.min(100, 50 + avg * 35)));
}

// ─── ETF Posts (função original mantida) ──────────────────────────────────────

export async function fetchEtfRedditPosts(): Promise<RedditPost[]> {
  if (!IS_LIVE) return MOCK_POSTS;

  try {
    const [etfPosts, btcPosts] = await Promise.all([
      fetchSubredditPosts('ETFs', 'bitcoin ETF inflow outflow IBIT FBTC', 4),
      fetchSubredditPosts('Bitcoin', 'ETF inflow outflow BlackRock institutional', 3),
    ]);
    const all = [...etfPosts, ...btcPosts]
      .sort((a, b) => b.created_utc - a.created_utc)
      .slice(0, 7);
    return all.length > 0 ? all : MOCK_POSTS;
  } catch {
    return MOCK_POSTS;
  }
}
