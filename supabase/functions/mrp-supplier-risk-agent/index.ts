/**
 * mrp-supplier-risk-agent — Edge Function Supabase (Deno)
 *
 * Feature C: Score de Risco de Fornecedores da Cadeia de Suprimentos
 * Agente: Market Researcher (simulando integração MCP com Moody's / D&B)
 *
 * Calcula "Supply Risk Score" (0–100) para cada fornecedor com base em:
 *   - Taxa de pontualidade (on_time_rate_pct)
 *   - Prazo médio de entrega vs benchmark
 *   - Histórico de POs: atrasos, cancelamentos, OCs abertas
 *   - Concentração de gasto (single-supplier risk)
 * Grava o score em mrp_suppliers.risk_score e chama Claude para insight.
 *
 * POST /functions/v1/mrp-supplier-risk-agent
 * Body: {} (processa todos os fornecedores ativos)
 * Resposta: SupplierRiskResult
 *
 * Requer: ANTHROPIC_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupplierRow {
  id:                  string;
  name:                string;
  country:             string;
  category:            string;
  avg_lead_time_days:  number;
  on_time_rate_pct:    number;
  active:              boolean;
}

interface PoRow {
  supplier_id:  string;
  status:       string;
  total_value:  number;
  ordered_at:   string;
  expected_at:  string | null;
  received_at:  string | null;
}

interface SupplierRiskLine {
  supplier_id:       string;
  name:              string;
  country:           string;
  category:          string;
  risk_score:        number;
  risk_label:        'Baixo' | 'Moderado' | 'Alto' | 'Crítico';
  on_time_rate_pct:  number;
  avg_lead_time:     number;
  total_pos:         number;
  late_pos:          number;
  cancelled_pos:     number;
  total_spend:       number;
  spend_share_pct:   number;
  score_breakdown: {
    punctuality:    number;
    lead_time:      number;
    cancellation:   number;
    concentration:  number;
    geo_risk:       number;
  };
}

interface SupplierRiskResult {
  generated_at:       string;
  suppliers_analyzed: number;
  high_risk_count:    number;
  total_spend:        number;
  suppliers:          SupplierRiskLine[];
  ai_analysis:        string;
}

const GEO_RISK: Record<string, number> = {
  BR: 5, US: 5, DE: 5, JP: 5, KR: 8,
  CN: 15, IN: 12, MX: 10,
};
const LEAD_TIME_BENCHMARK = 10; // dias — abaixo é bom, acima penaliza

function calcRiskScore(
  supplier: SupplierRow,
  totalPos: number,
  latePos: number,
  cancelledPos: number,
  spendShare: number,
): SupplierRiskLine['score_breakdown'] & { total: number } {
  // Pontualidade: 40 pontos — 100% on-time = 0, 0% = 40
  const punctuality = Math.round(((100 - supplier.on_time_rate_pct) / 100) * 40);

  // Lead time: 20 pontos — benchmark 10 dias
  const leadTimeDelta = supplier.avg_lead_time_days - LEAD_TIME_BENCHMARK;
  const leadTime = Math.min(20, Math.max(0, Math.round((leadTimeDelta / LEAD_TIME_BENCHMARK) * 20)));

  // Cancelamentos: 15 pontos
  const cancelRate = totalPos > 0 ? cancelledPos / totalPos : 0;
  const cancellation = Math.round(cancelRate * 15);

  // Concentração de gasto: 15 pontos — acima de 60% de share é crítico
  const concentration = spendShare > 60 ? 15 : spendShare > 40 ? 10 : spendShare > 20 ? 5 : 0;

  // Risco geográfico: 10 pontos
  const geoRisk = Math.min(10, GEO_RISK[supplier.country] ?? 8);

  const total = Math.min(100, punctuality + leadTime + cancellation + concentration + geoRisk);
  return { punctuality, lead_time: leadTime, cancellation, concentration, geo_risk: geoRisk, total };
}

function riskLabel(score: number): 'Baixo' | 'Moderado' | 'Alto' | 'Crítico' {
  if (score < 20) return 'Baixo';
  if (score < 45) return 'Moderado';
  if (score < 70) return 'Alto';
  return 'Crítico';
}

async function fetchSuppliers(sbUrl: string, sbKey: string): Promise<SupplierRow[]> {
  const res = await fetch(
    `${sbUrl}/rest/v1/mrp_suppliers?active=eq.true&select=id,name,country,category,avg_lead_time_days,on_time_rate_pct,active`,
    { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
  );
  if (!res.ok) throw new Error(`Supabase suppliers: ${res.status}`);
  return res.json() as Promise<SupplierRow[]>;
}

async function fetchPos(sbUrl: string, sbKey: string): Promise<PoRow[]> {
  const res = await fetch(
    `${sbUrl}/rest/v1/mrp_purchase_orders?select=supplier_id,status,total_value,ordered_at,expected_at,received_at`,
    { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
  );
  if (!res.ok) throw new Error(`Supabase POs: ${res.status}`);
  return res.json() as Promise<PoRow[]>;
}

async function updateSupplierRisk(
  sbUrl:  string, sbKey: string,
  id:     string, score: number, label: string,
): Promise<void> {
  await fetch(
    `${sbUrl}/rest/v1/mrp_suppliers?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey:         sbKey,
        Authorization:  `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ risk_score: score, risk_label: label, risk_updated_at: new Date().toISOString() }),
    },
  );
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 450,
          system:     'Você é um analista de risco de supply chain sênior. Gere análises concretas e acionáveis em português. Sem disclaimers. Foque em ações práticas de mitigação.',
          messages:   [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        if (attempt === 3) return `[Erro Anthropic ${res.status}]`;
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      const data = await res.json() as { content: Array<{ type: string; text?: string }> };
      return data.content.find(b => b.type === 'text')?.text?.trim() ?? '';
    } catch (err) {
      if (attempt === 3) return `[Erro de rede: ${err instanceof Error ? err.message : String(err)}]`;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  return '[Análise indisponível]';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const sbUrl        = Deno.env.get('SUPABASE_URL');
  const sbKey        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!sbUrl || !sbKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let suppliers: SupplierRow[];
  let pos: PoRow[];
  try {
    [suppliers, pos] = await Promise.all([fetchSuppliers(sbUrl, sbKey), fetchPos(sbUrl, sbKey)]);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erro ao ler dados: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const totalSpend = pos.reduce((s, p) => s + p.total_value, 0);

  const lines: SupplierRiskLine[] = [];
  const updatePromises: Promise<void>[] = [];

  for (const s of suppliers) {
    const sPos      = pos.filter(p => p.supplier_id === s.id);
    const totalPos  = sPos.length;
    const latePos   = sPos.filter(p => {
      if (!p.expected_at || !p.received_at) return false;
      return new Date(p.received_at) > new Date(p.expected_at);
    }).length;
    const cancelledPos = sPos.filter(p => p.status === 'cancelled').length;
    const spend        = sPos.reduce((sum, p) => sum + p.total_value, 0);
    const spendShare   = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;

    const breakdown = calcRiskScore(s, totalPos, latePos, cancelledPos, spendShare);
    const score     = breakdown.total;
    const label     = riskLabel(score);

    lines.push({
      supplier_id:      s.id,
      name:             s.name,
      country:          s.country,
      category:         s.category,
      risk_score:       score,
      risk_label:       label,
      on_time_rate_pct: s.on_time_rate_pct,
      avg_lead_time:    s.avg_lead_time_days,
      total_pos:        totalPos,
      late_pos:         latePos,
      cancelled_pos:    cancelledPos,
      total_spend:      spend,
      spend_share_pct:  spendShare,
      score_breakdown:  { punctuality: breakdown.punctuality, lead_time: breakdown.lead_time, cancellation: breakdown.cancellation, concentration: breakdown.concentration, geo_risk: breakdown.geo_risk },
    });

    updatePromises.push(updateSupplierRisk(sbUrl, sbKey, s.id, score, label));
  }

  await Promise.allSettled(updatePromises);

  lines.sort((a, b) => b.risk_score - a.risk_score);
  const highRisk = lines.filter(l => l.risk_score >= 45);

  // Prompt Claude
  const topRisk = lines.slice(0, 4).map(l =>
    `  • ${l.name} [${l.country}]: Score ${l.risk_score}/100 (${l.risk_label}) — pontualidade ${l.on_time_rate_pct}%, prazo médio ${l.avg_lead_time}d, share de gasto ${l.spend_share_pct.toFixed(1)}%`
  ).join('\n');

  const aiAnalysis = anthropicKey
    ? await callClaude(anthropicKey, `Análise de risco de fornecedores da cadeia de suprimentos:
- Total de fornecedores avaliados: ${lines.length}
- Fornecedores Alto/Crítico risco: ${highRisk.length}
- Gasto total analisado: R$${totalSpend.toFixed(0)}

Top fornecedores por risco:
${topRisk}

Em 4-5 frases: identifique os riscos mais críticos de ruptura de fornecimento, qual fornecedor requer ação imediata, e qual estratégia de diversificação ou contingência é recomendada.`)
    : '[ANTHROPIC_API_KEY não configurada — análise AI indisponível]';

  const result: SupplierRiskResult = {
    generated_at:       new Date().toISOString(),
    suppliers_analyzed: lines.length,
    high_risk_count:    highRisk.length,
    total_spend:        totalSpend,
    suppliers:          lines,
    ai_analysis:        aiAnalysis,
  };

  return new Response(
    JSON.stringify(result),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
