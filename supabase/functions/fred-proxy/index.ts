/**
 * fred-proxy — Edge Function que faz proxy das chamadas ao FRED API, Yahoo Finance,
 * Binance Futures API e GDELT.
 * Resolve o CORS: o browser chama esta função, que chama as APIs no servidor.
 * FRED_API_KEY fica como secret do Supabase (não exposta no bundle frontend).
 *
 * Types suportados:
 *   observations   — FRED series/observations (requer FRED_API_KEY)
 *   release_dates  — FRED release/dates (requer FRED_API_KEY)
 *   yahoo_chart    — Yahoo Finance v8/finance/chart (sem API key, evita CORS)
 *   binance_fapi   — Binance Futures API (fapi.binance.com) — sem API key, evita CORS
 *   gdelt          — GDELT DOC 2.0 API — sem API key, evita CORS
 */

const FRED_BASE    = 'https://api.stlouisfed.org/fred';
const YAHOO_BASE   = 'https://query1.finance.yahoo.com/v8/finance/chart';
const BINANCE_FAPI = 'https://fapi.binance.com';
const GDELT_BASE   = 'https://api.gdeltproject.org/api/v2/doc/doc';

// ── RSS helpers ──────────────────────────────────────────────────────────────
function extractCDATAOrText(chunk: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = chunk.match(re);
  if (!m) return '';
  const inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cdata ? cdata[1] : inner).trim();
}

interface RSSItem { id: string; title: string; url: string; published_at: string; source: string }

function parseRSSItems(xml: string, sourceName: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < 20) {
    const chunk = m[1];
    const title = extractCDATAOrText(chunk, 'title');
    const link  = extractCDATAOrText(chunk, 'link') || extractCDATAOrText(chunk, 'guid');
    const pub   = extractCDATAOrText(chunk, 'pubDate');
    if (!title || !link) continue;
    let iso = new Date().toISOString();
    try { if (pub) iso = new Date(pub).toISOString(); } catch { /* keep default */ }
    items.push({ id: link, title, url: link, published_at: iso, source: sourceName });
  }
  return items;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json() as { type: string; params: Record<string, string> };
    const { type, params } = body;

    // ── Yahoo Finance — sem necessidade de API key ───────────────────────────
    if (type === 'yahoo_chart') {
      const { ticker, days = '35' } = params;
      if (!ticker) {
        return new Response(
          JSON.stringify({ error: 'param ticker obrigatório para yahoo_chart' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      const url = `${YAHOO_BASE}/${ticker}?interval=1d&range=${days}d`;
      const yahooRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
        signal: AbortSignal.timeout(15_000),
      });
      const yahooText = await yahooRes.text();
      let data: unknown;
      try {
        data = JSON.parse(yahooText);
      } catch {
        console.error(`[fred-proxy] Yahoo non-JSON ${yahooRes.status} | ticker=${ticker} | body=${yahooText.slice(0, 100)}`);
        return new Response(
          JSON.stringify({ error: `Yahoo Finance error ${yahooRes.status}: resposta não é JSON válido` }),
          { status: yahooRes.status >= 400 ? yahooRes.status : 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      if (!yahooRes.ok) {
        console.error(`[fred-proxy] Yahoo ${yahooRes.status} | ticker=${ticker}`);
      }
      return new Response(JSON.stringify(data), {
        status:  yahooRes.ok ? 200 : yahooRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Binance Futures API — sem API key, evita CORS do browser ────────────
    if (type === 'binance_fapi') {
      const { endpoint } = params;
      if (!endpoint || !endpoint.startsWith('/')) {
        return new Response(
          JSON.stringify({ error: 'param endpoint obrigatório para binance_fapi (ex: /fapi/v1/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1)' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      const url = `${BINANCE_FAPI}${endpoint}`;
      const binRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
        signal: AbortSignal.timeout(10_000),
      });
      const binText = await binRes.text();
      let data: unknown;
      try {
        data = JSON.parse(binText);
      } catch {
        console.error(`[fred-proxy] Binance non-JSON ${binRes.status} | endpoint=${endpoint} | body=${binText.slice(0, 100)}`);
        return new Response(
          JSON.stringify({ error: `Binance FAPI error ${binRes.status}: resposta não é JSON válido` }),
          { status: binRes.status >= 400 ? binRes.status : 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      if (!binRes.ok) {
        console.error(`[fred-proxy] Binance ${binRes.status} | endpoint=${endpoint}`);
      }
      return new Response(JSON.stringify(data), {
        status:  binRes.ok ? 200 : binRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── GDELT DOC 2.0 API — sem API key, evita CORS do browser ─────────────
    if (type === 'gdelt') {
      const queryParams = new URLSearchParams(params);
      const url = `${GDELT_BASE}?${queryParams.toString()}`;
      const gdeltRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
        signal: AbortSignal.timeout(8_000),   // 8s — fail fast before client times out
      });
      if (!gdeltRes.ok) {
        console.error(`[fred-proxy] GDELT ${gdeltRes.status}`);
        return new Response(
          JSON.stringify({ error: `GDELT API error ${gdeltRes.status}` }),
          { status: gdeltRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      // GDELT retorna JSON mas o Content-Type pode ser text/plain — forçar parse
      const text = await gdeltRes.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = { articles: [] };
      }
      return new Response(JSON.stringify(data), {
        status:  200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── CryptoCompare News — sem API key, evita CORS do browser ─────────────
    if (type === 'cryptocompare_news') {
      const ccRes = await fetch(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=20',
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!ccRes.ok) {
        console.error(`[fred-proxy] CryptoCompare news ${ccRes.status}`);
        return new Response(
          JSON.stringify({ Data: [] }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      const ccData = await ccRes.json();
      return new Response(JSON.stringify(ccData), {
        status:  200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Crypto RSS News — CoinTelegraph / Decrypt feeds públicos, sem API key ──
    if (type === 'crypto_rss') {
      const rssSources = [
        { url: 'https://cointelegraph.com/rss',  name: 'CoinTelegraph' },
        { url: 'https://decrypt.co/feed',         name: 'Decrypt' },
        { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk' },
      ];
      for (const src of rssSources) {
        try {
          const rssRes = await fetch(src.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
            signal: AbortSignal.timeout(10_000),
          });
          if (!rssRes.ok) { console.error(`[fred-proxy] RSS ${src.name} ${rssRes.status}`); continue; }
          const xml   = await rssRes.text();
          const items = parseRSSItems(xml, src.name);
          if (items.length > 0) {
            return new Response(JSON.stringify({ items }), {
              status:  200,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) { console.error(`[fred-proxy] RSS ${src.name} error: ${String(e)}`); }
      }
      return new Response(JSON.stringify({ items: [] }), {
        status:  200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── Messari News — sem API key, 1000 req/dia free, fallback de último recurso
    if (type === 'messari_news') {
      const messariRes = await fetch('https://data.messari.io/api/v1/news', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mrp-dashboard/1.0)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!messariRes.ok) {
        console.error(`[fred-proxy] Messari news ${messariRes.status}`);
        return new Response(
          JSON.stringify({ data: [] }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      const messariData = await messariRes.json();
      return new Response(JSON.stringify(messariData), {
        status:  200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── FRED — requer API key ────────────────────────────────────────────────
    const fredApiKey = Deno.env.get('FRED_API_KEY');
    if (!fredApiKey) {
      return new Response(
        JSON.stringify({ error: 'FRED_API_KEY secret not configured' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const searchParams = new URLSearchParams({
      ...params,
      api_key:   fredApiKey,
      file_type: 'json',
    });

    let endpoint = '';
    if (type === 'observations') {
      endpoint = `${FRED_BASE}/series/observations?${searchParams}`;
    } else if (type === 'release_dates') {
      endpoint = `${FRED_BASE}/release/dates?${searchParams}`;
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown type: ${type}` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const fredRes  = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
    const fredText = await fredRes.text();
    let data: unknown;
    try {
      data = JSON.parse(fredText);
    } catch {
      console.error(`[fred-proxy] FRED non-JSON ${fredRes.status} | type=${type} | body=${fredText.slice(0, 100)}`);
      return new Response(
        JSON.stringify({ error: `FRED error ${fredRes.status}: resposta não é JSON válido` }),
        { status: fredRes.status >= 400 ? fredRes.status : 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!fredRes.ok) {
      const preview = JSON.stringify(data).slice(0, 400);
      console.error(`[fred-proxy] FRED ${fredRes.status} | type=${type} | params=${JSON.stringify(params)} | body=${preview}`);
    }

    return new Response(JSON.stringify(data), {
      status:  fredRes.ok ? 200 : fredRes.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
