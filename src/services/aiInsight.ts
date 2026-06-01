/**
 * aiInsight.ts — cliente para a Edge Function ai-analysis
 *
 * Chama o endpoint Supabase que gera análise em linguagem natural via Claude Haiku 4.5.
 * Requer VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY configurados.
 */

import { env } from '@/lib/env';

export interface AiInsightPayload {
  riskScore:      number;
  riskRegime:     string;
  fearGreedValue: number;
  fearGreedLabel: string;
  fundingRate?:   number;
  mtfConfluence?: string;
  mtfDirection?:  string;
  zAlerts?: Array<{
    metric:    string;
    level:     string;
    z:         number;
    direction: string;
  }>;
  page: string;
  context?: {
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
    calendarEventsToday?: Array<{
      title:     string;
      actual:    string | null;
      forecast:  string | null;
      currency:  string;
      surprise?: string;
    }>;
    calendarUpcoming?: Array<{
      title:        string;
      datetime_brt: string | null;
      forecast:     string | null;
      previous:     string | null;
      currency:     string;
    }>;
  };
}

export async function fetchAiInsight(payload: AiInsightPayload): Promise<string> {
  const baseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key     = env.VITE_SUPABASE_ANON_KEY;

  if (!baseUrl || !key) {
    throw new Error('Supabase não configurado — defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
  }

  const res = await fetch(`${baseUrl}/functions/v1/ai-analysis`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body:   JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const detail = (err.error as string | undefined) ?? res.statusText;
    if (res.status === 503) throw new Error('AI_MISSING_KEY'); // ANTHROPIC_API_KEY ausente — não retentar
    if (res.status === 401) throw new Error('Chave Anthropic inválida ou expirada. Verifique ANTHROPIC_API_KEY nos Secrets do Supabase.');
    if (res.status === 429) throw new Error('Limite de requisições Anthropic atingido. Tente novamente em alguns segundos.');
    if (res.status === 504) throw new Error('Timeout ao chamar Anthropic. Verifique conectividade da Edge Function.');
    // Anthropic retorna 400 "credit balance too low" — nossa Edge Function mapeia para 502
    const detailLower = detail.toLowerCase();
    if (detailLower.includes('credit balance') || detailLower.includes('too low') || detailLower.includes('purchase credits')) {
      throw new Error('CREDITS_EXHAUSTED');
    }
    throw new Error(`AI insight error ${res.status}: ${detail}`);
  }

  const data = await res.json() as { insight?: string };
  if (!data.insight) throw new Error('Resposta vazia da Edge Function ai-analysis');
  return data.insight;
}
