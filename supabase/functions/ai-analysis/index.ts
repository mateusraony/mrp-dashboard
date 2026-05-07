/**
 * ai-analysis — Edge Function Supabase (Deno)
 *
 * Gera análise institucional de mercado em linguagem natural via Claude Haiku 4.5.
 * Sistema de prompt cacheado reduz custo ~90% em chamadas repetidas.
 *
 * POST /functions/v1/ai-analysis
 * Body: AiInsightPayload
 * Resposta: { insight: string }
 *
 * Requer: ANTHROPIC_API_KEY no Supabase Dashboard → Settings → Edge Functions → Secrets
 */

import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZAlert {
  metric:    string;
  level:     string;
  z:         number;
  direction: string;
}

interface AiInsightPayload {
  riskScore:      number;
  riskRegime:     string;
  fearGreedValue: number;
  fearGreedLabel: string;
  fundingRate:    number;
  mtfConfluence:  string;
  mtfDirection:   string;
  zAlerts?:       ZAlert[];
}

function buildUserMessage(p: AiInsightPayload): string {
  const zSummary = p.zAlerts && p.zAlerts.length > 0
    ? p.zAlerts
        .map(a => {
          const metricLabel = a.metric === 'return' ? 'Retorno' : 'Volume';
          const levelLabel  = a.level  === 'extreme' ? 'EXTREMO' : 'ELEVADO';
          const sign        = a.z >= 0 ? '+' : '';
          return `${metricLabel} ${a.direction} ${levelLabel} (${sign}${a.z.toFixed(1)}σ)`;
        })
        .join('; ')
    : 'nenhum';

  const fundingPct = (p.fundingRate * 100).toFixed(4);

  return `Dados atuais de mercado Bitcoin:
- Risk Score: ${p.riskScore}/100 (regime: ${p.riskRegime})
- Fear & Greed: ${p.fearGreedValue}/100 (${p.fearGreedLabel})
- Funding Rate BTC perp: ${fundingPct}%
- Confluência multi-timeframe: ${p.mtfConfluence} (${p.mtfDirection})
- Alertas Z-Score: ${zSummary}

Análise institucional (máx 3 frases):`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada no Supabase Secrets' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let payload: AiInsightPayload;
  try {
    payload = await req.json() as AiInsightPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Payload JSON inválido' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 320,
    system: [
      {
        type: 'text',
        text: 'Você é um analista de mercado cripto institucional sênior. Gere análises concretas, objetivas e acionáveis em português brasileiro. Máximo 3 frases diretas. Sem disclaimers. Sem prefácio. Sem marcadores. Foco em Bitcoin. Comece diretamente com a análise.',
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserMessage(payload) }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  const insight   = textBlock?.type === 'text' ? textBlock.text.trim() : '';

  return new Response(
    JSON.stringify({ insight }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
