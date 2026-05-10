/**
 * fred-proxy — Edge Function que faz proxy das chamadas ao FRED API e Yahoo Finance.
 * Resolve o CORS: o browser chama esta função, que chama as APIs no servidor.
 * FRED_API_KEY fica como secret do Supabase (não exposta no bundle frontend).
 *
 * Types suportados:
 *   observations   — FRED series/observations (requer FRED_API_KEY)
 *   release_dates  — FRED release/dates (requer FRED_API_KEY)
 *   yahoo_chart    — Yahoo Finance v8/finance/chart (sem API key, evita CORS)
 */

const FRED_BASE = 'https://api.stlouisfed.org/fred';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

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
      const data = await yahooRes.json();
      if (!yahooRes.ok) {
        console.error(`[fred-proxy] Yahoo ${yahooRes.status} | ticker=${ticker}`);
      }
      return new Response(JSON.stringify(data), {
        status:  yahooRes.ok ? 200 : yahooRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── FRED — requer API key ────────────────────────────────────────────────
    const fredApiKey = Deno.env.get('FRED_API_KEY');
    if (!fredApiKey) {
      return new Response(
        JSON.stringify({ error: 'FRED_API_KEY secret not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
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
    const data     = await fredRes.json();

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
