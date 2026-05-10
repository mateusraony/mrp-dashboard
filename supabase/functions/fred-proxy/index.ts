/**
 * fred-proxy — Edge Function que faz proxy das chamadas ao FRED API.
 * Resolve o CORS: o browser chama esta função, que chama o FRED no servidor.
 * FRED_API_KEY fica como secret do Supabase (não exposta no bundle frontend).
 */

const FRED_BASE = 'https://api.stlouisfed.org/fred';

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
    const fredApiKey = Deno.env.get('FRED_API_KEY');
    if (!fredApiKey) {
      return new Response(
        JSON.stringify({ error: 'FRED_API_KEY secret not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json() as { type: string; params: Record<string, string> };
    const { type, params } = body;

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
