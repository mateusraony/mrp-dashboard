/**
 * mrp-valuation-agent — Edge Function Supabase (Deno)
 *
 * Feature A: Previsão de Custos e Valuation de Estoque
 * Agente: Model Builder / Valuation Reviewer
 *
 * Lê estoque + produtos do Supabase, simula 3 cenários de variação de mercado
 * e gera análise em linguagem natural via Claude.
 *
 * POST /functions/v1/mrp-valuation-agent
 * Body: { currency?: "BRL" | "USD" }
 * Resposta: ValuationResult
 *
 * Requer: ANTHROPIC_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InventoryRow {
  sku:                  string;
  product_name:         string;
  category:             string;
  unit:                 string;
  cost_price:           number;
  sale_price:           number | null;
  margin_pct:           number | null;
  quantity:             number;
  reorder_point:        number;
  below_reorder:        boolean;
  supplier_name:        string | null;
  avg_lead_time_days:   number | null;
  supplier_risk_score:  number | null;
  supplier_risk_label:  string | null;
}

interface ScenarioLine {
  sku:             string;
  product_name:    string;
  quantity:        number;
  unit:            string;
  current_cost:    number;
  current_value:   number;
  pessimist_cost:  number;
  pessimist_value: number;
  neutral_value:   number;
  optimist_value:  number;
  margin_impact:   number | null;
}

interface ValuationResult {
  generated_at:       string;
  currency:           string;
  total_inventory_value: number;
  scenarios: {
    pessimist:  number;
    neutral:    number;
    optimist:   number;
    variation_pct: { pessimist: number; optimist: number };
  };
  items_below_reorder: number;
  lines:  ScenarioLine[];
  ai_analysis: string;
}

// Variações de mercado simuladas por categoria de insumo
const SCENARIO_DELTAS: Record<string, [number, number, number]> = {
  raw_material: [-0.15, 0.0,  +0.12],
  chemical:     [-0.10, 0.0,  +0.08],
  electronics:  [-0.08, 0.0,  +0.20],
  packaging:    [-0.05, 0.0,  +0.05],
  produto:      [-0.12, 0.0,  +0.10],
  default:      [-0.10, 0.0,  +0.10],
};

function getDeltas(category: string): [number, number, number] {
  return SCENARIO_DELTAS[category] ?? SCENARIO_DELTAS['default'];
}

async function fetchInventory(sbUrl: string, sbKey: string): Promise<InventoryRow[]> {
  const res = await fetch(
    `${sbUrl}/rest/v1/v_mrp_inventory_status?select=*`,
    { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json() as Promise<InventoryRow[]>;
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
          max_tokens: 400,
          system:     'Você é um analista financeiro especializado em supply chain e valuation de estoques industriais. Gere análises concretas e acionáveis em português brasileiro. Sem disclaimers. Sem prefácio. Foque em riscos e oportunidades de custo.',
          messages:   [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        if (attempt === 3) return `[Erro Anthropic ${res.status}: ${err.slice(0, 100)}]`;
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

  if (!anthropicKey || !sbUrl || !sbKey) {
    return new Response(
      JSON.stringify({ error: 'Variáveis de ambiente ausentes (ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let currency = 'BRL';
  try { const body = await req.json(); currency = body?.currency ?? 'BRL'; } catch { /* usa default */ }

  let rows: InventoryRow[];
  try {
    rows = await fetchInventory(sbUrl, sbKey);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erro ao ler estoque: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Nenhum item de estoque encontrado. Execute a migration de seed.' }),
      { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Calcular cenários
  const lines: ScenarioLine[] = rows.map(r => {
    const [dPess, , dOpt] = getDeltas(r.category);
    const currentValue   = r.quantity * r.cost_price;
    const pessimistCost  = r.cost_price * (1 + dPess);
    const optimistCost   = r.cost_price * (1 + dOpt);

    return {
      sku:             r.sku,
      product_name:    r.product_name,
      quantity:        r.quantity,
      unit:            r.unit,
      current_cost:    r.cost_price,
      current_value:   currentValue,
      pessimist_cost:  pessimistCost,
      pessimist_value: r.quantity * pessimistCost,
      neutral_value:   currentValue,
      optimist_value:  r.quantity * optimistCost,
      margin_impact:   r.margin_pct !== null
        ? r.margin_pct * (1 + dPess)  // margem no cenário pessimista
        : null,
    };
  });

  const totalCurrent  = lines.reduce((s, l) => s + l.current_value, 0);
  const totalPessimist = lines.reduce((s, l) => s + l.pessimist_value, 0);
  const totalNeutral  = totalCurrent;
  const totalOptimist = lines.reduce((s, l) => s + l.optimist_value, 0);
  const belowReorder  = rows.filter(r => r.below_reorder).length;

  // Prompt para Claude
  const topItems = lines
    .sort((a, b) => b.current_value - a.current_value)
    .slice(0, 5)
    .map(l => `  • ${l.product_name} (${l.sku}): valor atual ${currency} ${l.current_value.toFixed(0)} | pessimista ${currency} ${l.pessimist_value.toFixed(0)} | otimista ${currency} ${l.optimist_value.toFixed(0)}`)
    .join('\n');

  const prompt = `Análise de valuation de estoque industrial:
- Total atual: ${currency} ${totalCurrent.toFixed(0)}
- Cenário pessimista (pressão de custos): ${currency} ${totalPessimist.toFixed(0)} (${((totalPessimist/totalCurrent - 1)*100).toFixed(1)}%)
- Cenário otimista (deflação de insumos): ${currency} ${totalOptimist.toFixed(0)} (+${((totalOptimist/totalCurrent - 1)*100).toFixed(1)}%)
- Itens abaixo do ponto de reposição: ${belowReorder}/${rows.length}

Top 5 itens por valor:
${topItems}

Em 4-5 frases: qual é o risco principal de custo de reposição, quais insumos merecem atenção imediata, e qual estratégia de compra é recomendada dado o cenário atual.`;

  const aiAnalysis = await callClaude(anthropicKey, prompt);

  const result: ValuationResult = {
    generated_at: new Date().toISOString(),
    currency,
    total_inventory_value: totalCurrent,
    scenarios: {
      pessimist:  totalPessimist,
      neutral:    totalNeutral,
      optimist:   totalOptimist,
      variation_pct: {
        pessimist: (totalPessimist / totalCurrent - 1) * 100,
        optimist:  (totalOptimist  / totalCurrent - 1) * 100,
      },
    },
    items_below_reorder: belowReorder,
    lines,
    ai_analysis: aiAnalysis,
  };

  return new Response(
    JSON.stringify(result),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
