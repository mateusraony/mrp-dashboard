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

// Sem dependência de npm — chamada direta à API Anthropic via fetch (mais estável no Deno)

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

interface CalendarEventToday {
  title:    string;
  actual:   string | null;
  forecast: string | null;
  currency: string;
  surprise?: string;
}

interface CalendarEventUpcoming {
  title:        string;
  datetime_brt: string | null;
  forecast:     string | null;
  previous:     string | null;
  currency:     string;
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
  calendarEventsToday?: CalendarEventToday[];
  calendarUpcoming?:   CalendarEventUpcoming[];
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

    case 'macro_calendar': {
      const today = (c.calendarEventsToday ?? []);
      const upcoming = (c.calendarUpcoming ?? []);

      const todayLines = today.length > 0
        ? today.map(e => {
            const actualStr = e.actual != null ? e.actual : 'aguardando resultado';
            const forecastStr = e.forecast != null ? ` (consenso: ${e.forecast})` : '';
            const surpriseStr = e.surprise ? ` | surpresa: ${e.surprise}` : '';
            return `  • [${e.currency}] ${e.title}: ${actualStr}${forecastStr}${surpriseStr}`;
          }).join('\n')
        : '  (nenhum evento liberado hoje)';

      const upcomingLines = upcoming.length > 0
        ? upcoming.map(e => {
            const time = e.datetime_brt ?? 'horário indefinido';
            const forecastStr = e.forecast != null ? ` | consenso: ${e.forecast}` : '';
            const prevStr = e.previous != null ? ` | anterior: ${e.previous}` : '';
            return `  • [${e.currency}] ${e.title} — ${time}${forecastStr}${prevStr}`;
          }).join('\n')
        : '  (nenhum evento agendado nas próximas 48h)';

      return `Calendário macroeconômico:

Liberados hoje:
${todayLines}

Próximos eventos (48h):
${upcomingLines}

Faça um resumo macro em 4-5 frases em português: o que saiu hoje e como surpreendeu (se houver), o viés macro resultante (hawkish/dovish/neutro), qual o próximo evento mais crítico e em que horário, e qual a orientação para o Bitcoin dado esse contexto. Seja honesto quando actual ainda não foi divulgado.`;
    }

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
  console.log('[ai-analysis] apiKey present:', !!apiKey, 'length:', apiKey?.length ?? 0);
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

  // Health probe: verifica que a função está ativa e a API key existe sem chamar o Claude.
  if (payload.page === 'health_check') {
    return new Response(
      JSON.stringify({ insight: 'ok' }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const model = 'claude-haiku-4-5-20251001';
  console.log('[ai-analysis] calling Anthropic, page:', payload.page, 'model:', model);

  let anthropicRes: Response;
  try {
    // Timeout explícito: Deno fetch não tem timeout por padrão.
    // Supabase mata a function após ~30s com um 502 genérico sem log.
    // Com AbortSignal de 12s, o erro aparece no log antes disso.
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      signal:  AbortSignal.timeout(12_000),
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: payload.page === 'macro_calendar' ? 480 : 320,
        system:     'Você é um analista de mercado cripto institucional sênior. Gere análises concretas, objetivas e acionáveis em português brasileiro. Máximo 3 frases diretas. Sem disclaimers. Sem prefácio. Sem marcadores. Foco em Bitcoin. Comece diretamente com a análise.',
        messages:   [{ role: 'user', content: buildUserMessage(payload) }],
      }),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const errMsg = isTimeout ? 'timeout de 12s ao chamar Anthropic' : (err instanceof Error ? err.message : String(err));
    console.error('[ai-analysis] fetch error:', errMsg);
    return new Response(
      JSON.stringify({ error: `Erro de rede ao chamar Anthropic: ${errMsg}` }),
      { status: 504, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text().catch(() => '');
    console.error('[ai-analysis] Anthropic error:', anthropicRes.status, errBody.slice(0, 300));
    // Repassa o status real da Anthropic para o cliente poder distinguir
    // 401 (chave inválida), 429 (rate limit), 500 (erro Anthropic).
    // Mapeia para 502 apenas para erros inesperados.
    const clientStatus = [401, 429, 500, 529].includes(anthropicRes.status)
      ? anthropicRes.status
      : 502;
    return new Response(
      JSON.stringify({ error: `Anthropic API ${anthropicRes.status}: ${errBody.slice(0, 200)}` }),
      { status: clientStatus, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const anthropicData = await anthropicRes.json() as {
    content: Array<{ type: string; text?: string }>;
  };
  const insight = anthropicData.content.find(b => b.type === 'text')?.text?.trim() ?? '';

  return new Response(
    JSON.stringify({ insight }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
