/**
 * ai-analysis — Edge Function Supabase (Deno)
 *
 * Gera análise institucional de mercado em linguagem natural via Claude Haiku 4.5.
 * Sistema de prompt cacheado reduz custo ~90% em chamadas repetidas.
 * Suporta análises específicas por página via campo `page` no payload.
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

interface AiInsightContext {
  oiDeltaPct?: number;
  probLongFlush?: number;
  longRiskUsd?: number;
  closestLongPrice?: number;
  closestShortPrice?: number;
  ivAtm?: number;
  skew?: number;
  pcrOi?: number;
  maxPainPct?: number;
  ret1d?: number;
  cvd?: number;
  volume1dB?: number;
  vix?: number;
  dxy?: number;
  spRet1d?: number;
  yieldSpreadBp?: number;
  atr?: number;
  scenariosSummary?: string;
  nupl?: number;
  nuplZone?: string;
  etfFlow7dM?: number;
  stablecoinDelta7dPct?: number;
  opCount?: number;
  gradeACount?: number;
}

interface AiInsightPayload {
  riskScore:      number;
  riskRegime:     string;
  fearGreedValue: number;
  fearGreedLabel: string;
  fundingRate:    number;
  mtfConfluence?: string;
  mtfDirection?:  string;
  zAlerts?:       ZAlert[];
  page:           string;
  context?:       AiInsightContext;
}

function buildUserMessage(p: AiInsightPayload): string {
  const c = p.context ?? {};

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

  switch (p.page) {
    case 'derivatives':
      return `Mercado de derivativos BTC:
- Funding Rate: ${(p.fundingRate * 100).toFixed(4)}% (${p.riskRegime})
- OI Delta 24h: ${c.oiDeltaPct?.toFixed(2) ?? '—'}%
- Fear & Greed: ${p.fearGreedValue} (${p.fearGreedLabel})
- Risk Score: ${p.riskScore}/100

Análise institucional do mercado de derivativos BTC (máx 3 frases):`;

    case 'derivatives_advanced':
      return `Análise de clusters de liquidação BTC:
- Longs em risco (queda −10%): ${c.probLongFlush?.toFixed(0) ?? '—'}% — $${c.longRiskUsd ? (c.longRiskUsd / 1e9).toFixed(2) : '—'}B
- Cluster long mais próximo: $${c.closestLongPrice ? (c.closestLongPrice / 1000).toFixed(1) : '—'}K
- Cluster short mais próximo: $${c.closestShortPrice ? (c.closestShortPrice / 1000).toFixed(1) : '—'}K
- Funding: ${(p.fundingRate * 100).toFixed(4)}% | Score: ${p.riskScore}/100

Análise do risco de liquidação em cascata (máx 3 frases):`;

    case 'options':
      return `Mercado de opções BTC:
- IV ATM: ${c.ivAtm != null ? (c.ivAtm * 100).toFixed(1) : '—'}%
- Skew put/call: ${c.skew != null ? (c.skew * 100).toFixed(2) : '—'}pp
- Put/Call Ratio (OI): ${c.pcrOi?.toFixed(2) ?? '—'}
- Max Pain distância spot: ${c.maxPainPct?.toFixed(1) ?? '—'}%
- Funding: ${(p.fundingRate * 100).toFixed(4)}%

Análise institucional de opções BTC (máx 3 frases):`;

    case 'spot_flow':
      return `Fluxo spot BTC:
- Retorno 1D: ${c.ret1d != null ? (c.ret1d * 100).toFixed(2) : '—'}%
- CVD 1D: ${c.cvd != null ? (c.cvd / 1e6).toFixed(1) : '—'}M USD
- Volume 24h: $${c.volume1dB?.toFixed(2) ?? '—'}B
- Fear & Greed: ${p.fearGreedValue} | Funding: ${(p.fundingRate * 100).toFixed(4)}%

Análise institucional do fluxo spot BTC (máx 3 frases):`;

    case 'macro':
      return `Contexto macroeconômico:
- VIX: ${c.vix?.toFixed(1) ?? '—'}
- DXY: ${c.dxy?.toFixed(2) ?? '—'}
- S&P 500 1D: ${c.spRet1d != null ? (c.spRet1d * 100).toFixed(2) : '—'}%
- Yield Spread 10-2Y: ${c.yieldSpreadBp?.toFixed(0) ?? '—'}bp
- BTC Risk Score: ${p.riskScore}/100 (${p.riskRegime})

Análise do impacto macro no Bitcoin (máx 3 frases):`;

    case 'predictive':
      return `Previsão BTC 24h:
- ATR(14) diário: $${c.atr?.toFixed(0) ?? '—'}
- Cenários: ${c.scenariosSummary ?? '—'}
- Funding: ${(p.fundingRate * 100).toFixed(4)}% | F&G: ${p.fearGreedValue}
- Risk Score: ${p.riskScore}/100 (${p.riskRegime})

Análise do outlook BTC para as próximas 24h (máx 3 frases):`;

    case 'executive_report':
      return `Relatório executivo consolidado BTC:
- Risk Score: ${p.riskScore}/100 (${p.riskRegime})
- Fear & Greed: ${p.fearGreedValue} (${p.fearGreedLabel})
- NUPL: ${c.nupl?.toFixed(3) ?? '—'} (${c.nuplZone ?? '—'})
- ETF Flow 7D: ${c.etfFlow7dM != null ? `+$${c.etfFlow7dM.toFixed(0)}M` : '—'}
- Stablecoin delta 7D: ${c.stablecoinDelta7dPct != null ? `+${c.stablecoinDelta7dPct.toFixed(1)}%` : '—'}
- Funding: ${(p.fundingRate * 100).toFixed(4)}%

Síntese executiva institucional (máx 3 frases):`;

    case 'action_dashboard':
      return `Dashboard de oportunidades BTC:
- Oportunidades ativas: ${c.opCount ?? 0} (${c.gradeACount ?? 0} Grade A)
- Regime: ${p.riskRegime} | Score: ${p.riskScore}/100
- Fear & Greed: ${p.fearGreedValue} (${p.fearGreedLabel})
- Funding: ${(p.fundingRate * 100).toFixed(4)}%

Análise das oportunidades de trading identificadas (máx 3 frases):`;

    // "dashboard" e qualquer página desconhecida usam o prompt padrão
    case 'dashboard':
    default:
      return `Dados atuais de mercado Bitcoin:
- Risk Score: ${p.riskScore}/100 (regime: ${p.riskRegime})
- Fear & Greed: ${p.fearGreedValue}/100 (${p.fearGreedLabel})
- Funding Rate BTC perp: ${(p.fundingRate * 100).toFixed(4)}%
- Confluência multi-timeframe: ${p.mtfConfluence ?? '—'} (${p.mtfDirection ?? '—'})
- Alertas Z-Score: ${zSummary}

Análise institucional (máx 3 frases):`;
  }
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
