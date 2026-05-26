/**
 * MrpFinanceAgents — Supply Chain Intelligence
 * Redesenhado para clareza: linguagem simples, ação em destaque, AI primeiro.
 */

import { useState } from 'react';
import {
  RefreshCw, Package, FileCheck, ShieldAlert,
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  ArrowRight, Clock, Truck, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useMrpValuation }                               from '@/hooks/useMrpValuation';
import { useMrpReconciler, useTriggerReconciliation }    from '@/hooks/useMrpReconciler';
import { useMrpSupplierRisk, useReevaluateSupplierRisk } from '@/hooks/useMrpSupplierRisk';

// ─── Formatação ───────────────────────────────────────────────────────────────

function R$(v, dec = 0) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}
function N(v, dec = 0) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}
function pct(v, dec = 1) {
  if (v == null) return '—';
  return `${v > 0 ? '+' : ''}${N(v, dec)}%`;
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

function StatusDot({ level }) {
  const map = { ok: '#10b981', warn: '#f59e0b', bad: '#ef4444', info: '#3b82f6' };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: map[level] ?? '#4a6580', flexShrink: 0 }} />;
}

function LoadingShimmer() {
  return (
    <div style={{ padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #162032', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <p style={{ color: '#4a6580', fontSize: 13, margin: 0 }}>Consultando agente AI…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Não foi possível carregar os dados</p>
        <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}

// Caixa de análise do Claude — protagonista da página
function AiBox({ text, loading }) {
  if (loading) return null;
  if (!text) return null;
  const isErr = text.startsWith('[Erro') || text.startsWith('[ANTHROPIC') || text.startsWith('[Análise');
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Zap size={14} color="#60a5fa" />
        <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.08em' }}>O QUE A IA RECOMENDA</span>
      </div>
      <p style={{ color: isErr ? '#f59e0b' : '#e2e8f0', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{text}</p>
    </div>
  );
}

function RefreshBtn({ onClick, loading, label = 'Atualizar' }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#162032', border: '1px solid #1e3048', borderRadius: 8, padding: '7px 14px', color: loading ? '#4a6580' : '#94a3b8', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer' }}>
      <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
      {loading ? 'Aguarde…' : label}
    </button>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={18} color="#3b82f6" />
        <h2 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      {subtitle && <p style={{ color: '#4a6580', fontSize: 12, margin: '4px 0 0 26px' }}>{subtitle}</p>}
    </div>
  );
}

function Timestamp({ iso }) {
  if (!iso) return null;
  return <p style={{ color: '#4a6580', fontSize: 10, textAlign: 'right', margin: '12px 0 0' }}>Atualizado às {new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>;
}

// ─── Tab A: Estoque ───────────────────────────────────────────────────────────

function EstoqueTab() {
  const { data: state, isLoading, refetch } = useMrpValuation();
  const [showTable, setShowTable] = useState(false);
  const d = state?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <SectionTitle
          icon={Package}
          title="Quanto vale seu estoque?"
          subtitle="Simulamos o que acontece com seus custos se os preços de mercado mudarem."
        />
        <RefreshBtn onClick={() => refetch()} loading={isLoading} />
      </div>

      {isLoading && <LoadingShimmer />}
      {!isLoading && state?.debugError && <ErrorBanner message={state.debugError} />}

      {!isLoading && d && (
        <>
          {/* Análise AI primeiro */}
          <AiBox text={d.ai_analysis} />

          {/* 3 cenários — explicados em linguagem simples */}
          <p style={{ color: '#4a6580', fontSize: 11, marginBottom: 10 }}>
            Se os preços de reposição dos insumos…
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              {
                label: '📉 Subirem (pior caso)',
                desc:  'Custos inflacionados em média 10–15%',
                value: d.scenarios.pessimist,
                delta: d.scenarios.variation_pct.pessimist,
                border: '#ef444440',
                color: '#ef4444',
              },
              {
                label: '➡️ Ficarem estáveis',
                desc:  'Valor atual mantido',
                value: d.scenarios.neutral,
                delta: 0,
                border: '#f59e0b40',
                color: '#f59e0b',
              },
              {
                label: '📈 Caírem (melhor caso)',
                desc:  'Deflação de insumos 5–20%',
                value: d.scenarios.optimist,
                delta: d.scenarios.variation_pct.optimist,
                border: '#10b98140',
                color: '#10b981',
              },
            ].map(s => (
              <Card key={s.label} style={{ padding: '14px 16px', border: `1px solid ${s.border}` }}>
                <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 6px', fontWeight: 600 }}>{s.label}</p>
                <p style={{ color: '#4a6580', fontSize: 10, margin: '0 0 10px' }}>{s.desc}</p>
                <p style={{ color: s.color, fontSize: 20, fontWeight: 700, margin: '0 0 2px', fontFamily: 'JetBrains Mono, monospace' }}>{R$(s.value)}</p>
                {s.delta !== 0 && <p style={{ color: s.color, fontSize: 11, margin: 0 }}>{pct(s.delta)} vs hoje</p>}
              </Card>
            ))}
          </div>

          {/* Alertas de estoque crítico */}
          {d.items_below_reorder > 0 && (
            <Card style={{ padding: '14px 18px', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color="#ef4444" />
                <div>
                  <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>
                    {d.items_below_reorder} produto{d.items_below_reorder > 1 ? 's precisam' : ' precisa'} de reposição agora
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>
                    O estoque atual está abaixo do mínimo necessário. Faça pedido ao fornecedor o quanto antes.
                  </p>
                </div>
              </div>
              {/* Quais itens */}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {d.lines.filter(l => l.current_value < l.pessimist_value && l.quantity <= (d.lines.find(x => x.sku === l.sku)?.reorder_point ?? Infinity)).slice(0, 5).map(l => (
                  <div key={l.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#070B14', borderRadius: 6 }}>
                    <ArrowRight size={11} color="#ef4444" />
                    <span style={{ color: '#f1f5f9', fontSize: 12, flex: 1 }}>{l.product_name}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{N(l.quantity, 1)} {l.unit} restantes</span>
                  </div>
                ))}
                {/* Fallback: lista todos abaixo reorder quando a lógica acima não retorna */}
                {d.lines.filter(l => l.current_value < l.pessimist_value && l.quantity <= (d.lines.find(x => x.sku === l.sku)?.reorder_point ?? Infinity)).length === 0 &&
                  d.lines.slice(0, d.items_below_reorder).map(l => (
                    <div key={l.sku} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#070B14', borderRadius: 6 }}>
                      <ArrowRight size={11} color="#ef4444" />
                      <span style={{ color: '#f1f5f9', fontSize: 12, flex: 1 }}>{l.product_name}</span>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>{N(l.quantity, 1)} {l.unit}</span>
                    </div>
                  ))
                }
              </div>
            </Card>
          )}

          {/* Tabela colapsável */}
          <button
            onClick={() => setShowTable(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#60a5fa', fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 8 }}
          >
            {showTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showTable ? 'Ocultar' : 'Ver'} todos os {d.lines.length} itens do estoque
          </button>

          {showTable && (
            <Card style={{ overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#0A1220' }}>
                      {['Produto', 'Estoque', 'Custo unitário', 'Valor hoje', 'Se subir ↑', 'Se cair ↓'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', color: '#4a6580', fontWeight: 600, textAlign: h === 'Produto' ? 'left' : 'right', whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => (
                      <tr key={l.sku} style={{ borderTop: '1px solid #162032', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '9px 14px', color: '#f1f5f9' }}>
                          <span style={{ display: 'block' }}>{l.product_name}</span>
                          <span style={{ color: '#4a6580', fontSize: 9, fontFamily: 'monospace' }}>{l.sku}</span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', textAlign: 'right' }}>{N(l.quantity, 1)} {l.unit}</td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>{R$(l.current_cost, 2)}</td>
                        <td style={{ padding: '9px 14px', color: '#f1f5f9', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{R$(l.current_value)}</td>
                        <td style={{ padding: '9px 14px', color: '#ef4444', textAlign: 'right', fontFamily: 'monospace' }}>{R$(l.pessimist_value)}</td>
                        <td style={{ padding: '9px 14px', color: '#10b981', textAlign: 'right', fontFamily: 'monospace' }}>{R$(l.optimist_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Timestamp iso={d.generated_at} />
        </>
      )}
    </div>
  );
}

// ─── Tab B: Compras ───────────────────────────────────────────────────────────

const TIPO_TEXTO = {
  underpayment:    { label: 'Pagamento a menor',   action: 'Regularize o saldo devedor com o fornecedor ou emita nota de ajuste.' },
  overpayment:     { label: 'Pagamento a maior',   action: 'Solicite crédito ou devolução do valor excedente ao fornecedor.' },
  missing_payment: { label: 'Pagamento não feito', action: 'Nenhum pagamento foi registrado. Verifique se o boleto foi emitido.' },
  late_delivery:   { label: 'Entrega atrasada',    action: 'Contate o fornecedor para confirmar o status da entrega.' },
};

function ComprasTab() {
  const { data: state, isLoading }      = useMrpReconciler();
  const { mutate: rodar, isPending }    = useTriggerReconciliation();
  const d = state?.data;
  const ok = d?.divergences_found === 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <SectionTitle
          icon={FileCheck}
          title="As compras foram pagas corretamente?"
          subtitle="Comparamos automaticamente cada ordem de compra com os pagamentos registrados."
        />
        <RefreshBtn onClick={() => rodar()} loading={isPending || isLoading} label="Verificar agora" />
      </div>

      {(isLoading || isPending) && <LoadingShimmer />}
      {!isLoading && !isPending && state?.debugError && <ErrorBanner message={state.debugError} />}

      {!isLoading && !isPending && d && (
        <>
          {/* Resultado principal — destaque máximo */}
          <Card style={{ padding: '20px 24px', border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {ok
                ? <CheckCircle size={32} color="#10b981" />
                : <AlertTriangle size={32} color="#ef4444" />
              }
              <div>
                <p style={{ color: ok ? '#10b981' : '#ef4444', fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
                  {ok
                    ? `Tudo certo — ${d.total_pos_checked} compras conferem`
                    : `${d.divergences_found} problema${d.divergences_found > 1 ? 's' : ''} encontrado${d.divergences_found > 1 ? 's' : ''}`
                  }
                </p>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                  {ok
                    ? 'Todos os pagamentos batem com os valores das ordens de compra.'
                    : `Valor total em aberto: ${R$(d.total_gap_value, 2)} — veja abaixo o que precisa de ação.`
                  }
                </p>
              </div>
            </div>
          </Card>

          {/* Problemas — explicados em linguagem simples */}
          {d.divergences.map(div => {
            const tipo = TIPO_TEXTO[div.type] ?? { label: div.type, action: '' };
            const isUrgent = div.severity === 'critical';
            return (
              <Card key={div.po_id} style={{ padding: '16px 20px', marginBottom: 12, borderLeft: `4px solid ${isUrgent ? '#ef4444' : '#f59e0b'}`, border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                {/* Linha título */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 700 }}>{tipo.label}</span>
                  {isUrgent && (
                    <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>URGENTE</span>
                  )}
                  <span style={{ fontSize: 11, color: '#4a6580', marginLeft: 'auto' }}>
                    Pedido {div.po_number} · {div.supplier_name}
                  </span>
                </div>

                {/* Comparação visual */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  {[
                    { label: 'Valor do pedido', value: R$(div.po_value, 2), color: '#f1f5f9' },
                    { label: 'Valor pago',       value: R$(div.total_paid, 2), color: div.total_paid < div.po_value ? '#ef4444' : '#f59e0b' },
                    { label: 'Diferença',        value: R$(Math.abs(div.gap), 2), color: '#f59e0b' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#070B14', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ color: '#4a6580', fontSize: 10, margin: '0 0 4px' }}>{m.label}</p>
                      <p style={{ color: m.color, fontSize: 15, fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* O que fazer */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(59,130,246,0.05)', borderRadius: 6, padding: '8px 12px' }}>
                  <ArrowRight size={13} color="#60a5fa" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}><b style={{ color: '#60a5fa' }}>Ação recomendada:</b> {tipo.action}</p>
                </div>
              </Card>
            );
          })}

          <Timestamp iso={d.generated_at} />
        </>
      )}
    </div>
  );
}

// ─── Tab C: Fornecedores ──────────────────────────────────────────────────────

const RISCO_CONFIG = {
  Baixo:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  emoji: '🟢', desc: 'Fornecedor confiável' },
  Moderado: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', emoji: '🟡', desc: 'Atenção recomendada' },
  Alto:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', emoji: '🟠', desc: 'Risco elevado' },
  Crítico:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  emoji: '🔴', desc: 'Ação urgente necessária' },
};

function PorQueEsseScore({ s }) {
  const motivos = [];
  if (s.on_time_rate_pct < 90)      motivos.push(`entrega atrasada em ${N(100 - s.on_time_rate_pct, 0)}% dos pedidos`);
  if (s.avg_lead_time > 14)         motivos.push(`prazo médio de entrega longo (${s.avg_lead_time} dias)`);
  if (s.spend_share_pct > 40)       motivos.push(`concentração alta de gastos (${N(s.spend_share_pct, 0)}% do total)`);
  if (s.cancelled_pos > 0)          motivos.push(`${s.cancelled_pos} pedido(s) cancelado(s)`);
  if (s.country === 'CN' || s.country === 'IN') motivos.push('fornecedor no exterior aumenta risco logístico');
  if (!motivos.length)              motivos.push('histórico positivo, sem alertas');
  return (
    <p style={{ color: '#4a6580', fontSize: 11, margin: '6px 0 0', lineHeight: 1.5 }}>
      <b style={{ color: '#94a3b8' }}>Por que esse score:</b> {motivos.join('; ')}.
    </p>
  );
}

function FornecedoresTab() {
  const { data: state, isLoading }      = useMrpSupplierRisk();
  const { mutate: reavaliar, isPending } = useReevaluateSupplierRisk();
  const d = state?.data;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <SectionTitle
          icon={ShieldAlert}
          title="Seus fornecedores são confiáveis?"
          subtitle="Calculamos o risco de cada fornecedor com base em histórico de entregas, prazo e concentração de gastos."
        />
        <RefreshBtn onClick={() => reavaliar()} loading={isPending || isLoading} label="Reavaliar" />
      </div>

      {(isLoading || isPending) && <LoadingShimmer />}
      {!isLoading && !isPending && state?.debugError && <ErrorBanner message={state.debugError} />}

      {!isLoading && !isPending && d && (
        <>
          {/* Análise AI */}
          <AiBox text={d.ai_analysis} />

          {/* Resumo rápido */}
          {d.high_risk_count > 0 && (
            <Card style={{ padding: '14px 18px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <AlertTriangle size={16} color="#ef4444" />
                <p style={{ color: '#f1f5f9', fontSize: 13, margin: 0 }}>
                  <b style={{ color: '#ef4444' }}>{d.high_risk_count} fornecedor{d.high_risk_count > 1 ? 'es precisam' : ' precisa'} de atenção</b>
                  {' '}— considere diversificar ou buscar alternativas.
                </p>
              </div>
            </Card>
          )}

          {/* Cards de fornecedores — ordenados por risco */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {d.suppliers.map(s => {
              const cfg = RISCO_CONFIG[s.risk_label] ?? RISCO_CONFIG['Moderado'];
              const barPct = Math.min(100, s.risk_score);
              return (
                <Card key={s.supplier_id} style={{ padding: '16px 20px', borderLeft: `4px solid ${cfg.color}`, border: `1px solid ${cfg.border}` }}>
                  {/* Cabeçalho */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700, margin: 0 }}>{s.name}</p>
                      <p style={{ color: '#4a6580', fontSize: 11, margin: '1px 0 0' }}>{cfg.desc} · {s.category} · {s.country}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: cfg.color, fontSize: 22, fontWeight: 800, margin: 0, fontFamily: 'monospace', lineHeight: 1 }}>{N(s.risk_score)}</p>
                      <p style={{ color: '#4a6580', fontSize: 9, margin: '2px 0 0' }}>de 100</p>
                    </div>
                  </div>

                  {/* Barra de risco */}
                  <div style={{ height: 5, background: '#162032', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: cfg.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>

                  {/* Métricas simples */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 8 }}>
                    {[
                      { icon: '✅', label: 'Pontualidade', value: `${N(s.on_time_rate_pct, 0)}%`, warn: s.on_time_rate_pct < 90 },
                      { icon: '🚚', label: 'Prazo médio', value: `${s.avg_lead_time} dias`, warn: s.avg_lead_time > 14 },
                      { icon: '📦', label: 'Pedidos', value: `${s.total_pos} (${s.late_pos} atras.)`, warn: s.late_pos > 0 },
                      { icon: '💰', label: 'Gasto', value: R$(s.total_spend), warn: s.spend_share_pct > 40 },
                    ].map(m => (
                      <div key={m.label} style={{ background: '#070B14', borderRadius: 6, padding: '7px 10px' }}>
                        <p style={{ color: '#4a6580', fontSize: 10, margin: '0 0 2px' }}>{m.icon} {m.label}</p>
                        <p style={{ color: m.warn ? '#f59e0b' : '#94a3b8', fontSize: 12, fontWeight: 600, margin: 0 }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  <PorQueEsseScore s={s} />
                </Card>
              );
            })}
          </div>

          <Timestamp iso={d.generated_at} />
        </>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'estoque',       label: 'Estoque',    icon: Package,    sub: 'Valor e riscos de reposição' },
  { id: 'compras',       label: 'Compras',    icon: FileCheck,  sub: 'Pagamentos conferem?' },
  { id: 'fornecedores',  label: 'Fornecedores', icon: Truck,    sub: 'Quem é confiável?' },
];

export default function MrpFinanceAgents() {
  const [activeTab, setActiveTab] = useState('estoque');

  // Pré-carrega todos os 3 hooks para que o status no header seja atualizado
  const { data: valState }  = useMrpValuation();
  const { data: reconcState } = useMrpReconciler();
  const { data: riskState } = useMrpSupplierRisk();

  // Pontos de status rápido no header
  const stockAlert    = valState?.data?.items_below_reorder ?? 0;
  const divergences   = reconcState?.data?.divergences_found ?? 0;
  const highRisk      = riskState?.data?.high_risk_count ?? 0;

  return (
    <div style={{ padding: '20px 24px', minHeight: '100vh', background: '#070B14', color: '#f1f5f9', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={20} color="#3b82f6" />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Inteligência de Supply Chain</h1>
        </div>
        <p style={{ color: '#4a6580', fontSize: 13, margin: '0 0 16px' }}>
          Agentes AI que monitoram seu estoque, conferem suas compras e avaliam o risco dos seus fornecedores — em tempo real.
        </p>

        {/* Barra de status geral */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { dot: stockAlert > 0 ? 'bad' : 'ok',  text: stockAlert > 0 ? `${stockAlert} item(s) em falta` : 'Estoque OK' },
            { dot: divergences > 0 ? 'bad' : 'ok', text: divergences > 0 ? `${divergences} divergência(s) financeira(s)` : 'Compras OK' },
            { dot: highRisk > 0 ? 'warn' : 'ok',   text: highRisk > 0 ? `${highRisk} fornecedor(es) em alerta` : 'Fornecedores OK' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d1421', border: '1px solid #162032', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#94a3b8' }}>
              <StatusDot level={s.dot} />
              {s.text}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 28 }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                background: active ? 'rgba(59,130,246,0.12)' : '#0d1421',
                border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : '#162032'}`,
                borderRadius: 10, padding: '12px 16px',
                color: active ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon size={14} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{t.label}</span>
              </div>
              <span style={{ fontSize: 10, color: active ? '#60a5fa' : '#4a6580', paddingLeft: 21 }}>{t.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {activeTab === 'estoque'      && <EstoqueTab />}
      {activeTab === 'compras'      && <ComprasTab />}
      {activeTab === 'fornecedores' && <FornecedoresTab />}
    </div>
  );
}
