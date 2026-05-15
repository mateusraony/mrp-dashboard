/**
 * reddit.ts — Reddit JSON API (sem autenticação, leitura pública)
 *
 * Busca posts recentes sobre Bitcoin ETF flows em r/ETFs e r/Bitcoin.
 * Rate limit: ~60 req/min (anônimo). Cache: 30min via TanStack Query.
 */

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
