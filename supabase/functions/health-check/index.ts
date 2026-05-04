/**
 * health-check — Edge Function Supabase (Deno)
 *
 * Valida a disponibilidade das APIs externas críticas do dashboard.
 * Persiste falhas no Supabase system_logs para monitoramento.
 *
 * GET /functions/v1/health-check
 * Resposta: { sources, failed_count, critical, timestamp }
 *
 * Critério de alerta:
 *   failed_count >= 3 → level='error' em system_logs
 *   failed_count 1-2  → level='warn'
 *   failed_count 0    → sem persistência (sistema saudável)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// APIs externas críticas verificadas neste health check
const CHECKS = [
  {
    name: 'binance_futures',
    label: 'Binance Futures',
    url: 'https://fapi.binance.com/fapi/v1/ping',
  },
  {
    name: 'coingecko',
    label: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3/ping',
  },
  {
    name: 'alternative_me',
    label: 'Alternative.me (F&G)',
    url: 'https://api.alternative.me/fng/?limit=1',
  },
  {
    name: 'gdelt',
    label: 'GDELT DOC 2.0',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=bitcoin&mode=artlist&format=json&maxrecords=1',
  },
  {
    name: 'mempool_space',
    label: 'Mempool.space',
    url: 'https://mempool.space/api/v1/fees/recommended',
  },
];

interface CheckResult {
  name:        string;
  label:       string;
  ok:          boolean;
  latency_ms:  number;
  status?:     number;
  error?:      string;
}

async function checkSource(name: string, label: string, url: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'MRP-Dashboard-HealthCheck/1.0' },
    });
    return {
      name,
      label,
      ok: res.ok,
      latency_ms: Date.now() - start,
      status: res.status,
    };
  } catch (e) {
    return {
      name,
      label,
      ok: false,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function persistToSystemLogs(
  supabaseUrl: string,
  supabaseKey: string,
  results: CheckResult[],
  failedCount: number,
): Promise<void> {
  const failed = results.filter(r => !r.ok);
  const failedNames = failed.map(r => r.name).join(', ');
  const level = failedCount >= 3 ? 'error' : 'warn';
  const message = failedCount >= 3
    ? `CRÍTICO: ${failedCount} APIs em falha simultânea — ${failedNames}`
    : `AVISO: ${failedCount} API(s) indisponível(eis) — ${failedNames}`;

  const sb = createClient(supabaseUrl, supabaseKey);
  await sb.from('system_logs').insert({
    level,
    message,
    source: 'health-check',
    detail: JSON.stringify({ results, failed_count: failedCount }),
    session_id: 'health-check-edge-fn',
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const results = await Promise.all(
    CHECKS.map(c => checkSource(c.name, c.label, c.url)),
  );

  const failedCount = results.filter(r => !r.ok).length;
  const critical    = failedCount >= 3;

  // Persiste no system_logs quando há falhas
  if (failedCount > 0) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (supabaseUrl && supabaseKey) {
      // fire-and-forget — não bloqueia a resposta
      persistToSystemLogs(supabaseUrl, supabaseKey, results, failedCount).catch(
        (e) => console.error('[health-check] persist failed:', e),
      );
    }
  }

  const payload = {
    sources:      results,
    failed_count: failedCount,
    critical,
    timestamp:    new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload), {
    status: critical ? 503 : failedCount > 0 ? 207 : 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
});
