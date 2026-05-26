/**
 * mrp-reconciler-agent — Edge Function Supabase (Deno)
 *
 * Feature B: Automação de Conciliação Financeira de Compras
 * Agente: General Ledger Reconciler
 *
 * Cruza Ordens de Compra com Lançamentos de Pagamento, detecta divergências
 * e grava status de "Divergência Contábil" na tabela mrp_payment_entries.
 *
 * POST /functions/v1/mrp-reconciler-agent
 * Body: {} (vazio — processa todas as OCs abertas)
 * Resposta: ReconciliationResult
 *
 * Requer: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoReconcRow {
  po_id:            string;
  po_number:        string;
  supplier_name:    string;
  po_status:        string;
  po_value:         number;
  total_paid:       number;
  balance_due:      number;
  divergence_count: number;
  ordered_at:       string;
  expected_at:      string | null;
  received_at:      string | null;
}

interface DivergenceItem {
  po_id:         string;
  po_number:     string;
  supplier_name: string;
  po_value:      number;
  total_paid:    number;
  gap:           number;
  type:          'underpayment' | 'overpayment' | 'missing_payment' | 'late_delivery';
  severity:      'critical' | 'warning' | 'info';
  note:          string;
}

interface ReconciliationResult {
  generated_at:       string;
  total_pos_checked:  number;
  divergences_found:  number;
  total_gap_value:    number;
  divergences:        DivergenceItem[];
  summary:            string;
}

async function fetchReconciliation(sbUrl: string, sbKey: string): Promise<PoReconcRow[]> {
  const res = await fetch(
    `${sbUrl}/rest/v1/v_mrp_po_reconciliation?select=*`,
    { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json() as Promise<PoReconcRow[]>;
}

async function flagDivergence(
  sbUrl:       string,
  sbKey:       string,
  poId:        string,
  note:        string,
): Promise<void> {
  // Atualiza o payment_entry mais recente da PO com divergence_flag = true
  await fetch(
    `${sbUrl}/rest/v1/mrp_payment_entries?po_id=eq.${poId}`,
    {
      method: 'PATCH',
      headers: {
        apikey:         sbKey,
        Authorization:  `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({
        divergence_flag: true,
        divergence_note: note,
      }),
    },
  );
}

async function clearDivergence(sbUrl: string, sbKey: string, poId: string): Promise<void> {
  await fetch(
    `${sbUrl}/rest/v1/mrp_payment_entries?po_id=eq.${poId}&divergence_flag=eq.true`,
    {
      method: 'PATCH',
      headers: {
        apikey:         sbKey,
        Authorization:  `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({
        divergence_flag: false,
        divergence_note: null,
        reconciled_at:   new Date().toISOString(),
      }),
    },
  );
}

const TOLERANCE = 0.01; // R$ 0,01 de tolerância para arredondamento

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const sbUrl = Deno.env.get('SUPABASE_URL');
  const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!sbUrl || !sbKey) {
    return new Response(
      JSON.stringify({ error: 'Variáveis de ambiente ausentes (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let rows: PoReconcRow[];
  try {
    rows = await fetchReconciliation(sbUrl, sbKey);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erro ao ler conciliação: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const divergences: DivergenceItem[] = [];
  const updatePromises: Promise<void>[] = [];

  for (const row of rows) {
    const gap = row.po_value - row.total_paid;
    const absGap = Math.abs(gap);

    // OC recebida mas com saldo devedor acima da tolerância
    if (row.po_status === 'received' && gap > TOLERANCE) {
      const note = `Pagamento insuficiente: PO ${row.po_number} valor R$${row.po_value.toFixed(2)}, pago R$${row.total_paid.toFixed(2)}, diferença R$${gap.toFixed(2)}`;
      divergences.push({
        po_id: row.po_id, po_number: row.po_number, supplier_name: row.supplier_name,
        po_value: row.po_value, total_paid: row.total_paid, gap,
        type: 'underpayment', severity: absGap > 500 ? 'critical' : 'warning', note,
      });
      updatePromises.push(flagDivergence(sbUrl, sbKey, row.po_id, note));
    }

    // Pagamento a maior (overpayment)
    else if (gap < -TOLERANCE && row.total_paid > 0) {
      const note = `Pagamento superior à OC: ${row.po_number} — excesso de R$${Math.abs(gap).toFixed(2)}`;
      divergences.push({
        po_id: row.po_id, po_number: row.po_number, supplier_name: row.supplier_name,
        po_value: row.po_value, total_paid: row.total_paid, gap,
        type: 'overpayment', severity: 'warning', note,
      });
      updatePromises.push(flagDivergence(sbUrl, sbKey, row.po_id, note));
    }

    // OC enviada sem nenhum pagamento lançado há mais de 5 dias
    else if (row.po_status === 'shipped' && row.total_paid === 0 && row.expected_at) {
      const expectedDate = new Date(row.expected_at);
      const daysPast = (Date.now() - expectedDate.getTime()) / 86_400_000;
      if (daysPast > 0) {
        const note = `OC ${row.po_number} entregue sem pagamento registrado — ${daysPast.toFixed(0)} dia(s) em atraso contábil`;
        divergences.push({
          po_id: row.po_id, po_number: row.po_number, supplier_name: row.supplier_name,
          po_value: row.po_value, total_paid: 0, gap: row.po_value,
          type: 'missing_payment', severity: 'critical', note,
        });
        updatePromises.push(flagDivergence(sbUrl, sbKey, row.po_id, note));
      }
    }

    // OC OK — limpa flags antigas se existirem
    else if (row.po_status === 'received' && Math.abs(gap) <= TOLERANCE && row.divergence_count > 0) {
      updatePromises.push(clearDivergence(sbUrl, sbKey, row.po_id));
    }
  }

  // Persiste as flags em paralelo (fire-and-forget, erros não bloqueiam resposta)
  await Promise.allSettled(updatePromises);

  const totalGap = divergences.reduce((s, d) => s + Math.abs(d.gap), 0);

  const criticalCount = divergences.filter(d => d.severity === 'critical').length;
  const warnCount     = divergences.filter(d => d.severity === 'warning').length;

  const summary = divergences.length === 0
    ? `Conciliação OK — ${rows.length} OC(s) verificada(s), nenhuma divergência encontrada.`
    : `${divergences.length} divergência(s) em ${rows.length} OC(s): ${criticalCount} crítica(s), ${warnCount} aviso(s). Exposição total: R$${totalGap.toFixed(2)}.`;

  const result: ReconciliationResult = {
    generated_at:      new Date().toISOString(),
    total_pos_checked: rows.length,
    divergences_found: divergences.length,
    total_gap_value:   totalGap,
    divergences,
    summary,
  };

  return new Response(
    JSON.stringify(result),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
