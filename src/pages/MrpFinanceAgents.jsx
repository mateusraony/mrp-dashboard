/**
 * MrpFinanceAgents — Módulo de Agentes Financeiros de Supply Chain
 *
 * Página independente que agrega os 3 agentes:
 *   A) Valuation de Estoque
 *   B) Conciliação de Compras
 *   C) Risco de Fornecedores
 *
 * Não altera nenhum componente cripto existente.
 */

import { useState } from 'react';
import { RefreshCw, Package, FileCheck, ShieldAlert, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useMrpValuation }                            from '@/hooks/useMrpValuation';
import { useMrpReconciler, useTriggerReconciliation } from '@/hooks/useMrpReconciler';
import { useMrpSupplierRisk, useReevaluateSupplierRisk } from '@/hooks/useMrpSupplierRisk';

// ─── Utilitários visuais ──────────────────────────────────────────────────────

function fmt(value, decimals = 0) {
  return value == null ? '—' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

function fmtCurrency(value, currency = 'BRL', decimals = 2) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: decimals }).format(value);
}

function StaleBadge({ lastUpdated }) {
  if (!lastUpdated) return null;
  return (
    <span style={{ fontSize: 10, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      ⚠ Cache · {new Date(lastUpdated).toLocaleTimeString('pt-BR')}
    </span>
  );
}

function SectionCard({ icon: Icon, title, badge, children, loading, error }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid #162032', paddingBottom: 12 }}>
        <Icon size={18} color="#3b82f6" />
        <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15, flex: 1 }}>{title}</span>
        {badge}
        {loading && <span style={{ fontSize: 11, color: '#60a5fa' }}>Carregando...</span>}
      </div>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#ef4444', marginBottom: 12 }}>
          {error}
        </div>
      )}
      {children}
    </div>
  );
}

function AiInsight({ text }) {
  if (!text) return null;
  const isError = text.startsWith('[Erro') || text.startsWith('[Análise');
  return (
    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, padding: '10px 14px', marginTop: 12 }}>
      <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em' }}>
        ANÁLISE AI · CLAUDE
      </div>
      <p style={{ fontSize: 12, color: isError ? '#f59e0b' : '#94a3b8', lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
}

// ─── Feature A: Valuation ─────────────────────────────────────────────────────

function ValuationPanel() {
  const { data: state, isLoading, refetch } = useMrpValuation();
  const d = state?.data;

  return (
    <SectionCard
      icon={Package}
      title="Valuation de Estoque — Cenários de Custo"
      loading={isLoading}
      error={state?.debugError ?? undefined}
      badge={state?.isFallback ? <StaleBadge lastUpdated={state.lastUpdated} /> : null}
    >
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => refetch()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#162032', border: '1px solid #1e3048', borderRadius: 6, padding: '5px 12px', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {d && (
        <>
          {/* Sumário de cenários */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Valor Atual', value: d.total_inventory_value, color: '#f1f5f9', icon: Minus },
              { label: 'Pessimista', value: d.scenarios.pessimist, color: '#ef4444', icon: TrendingDown, pct: d.scenarios.variation_pct.pessimist },
              { label: 'Neutro', value: d.scenarios.neutral, color: '#f59e0b', icon: Minus },
              { label: 'Otimista', value: d.scenarios.optimist, color: '#10b981', icon: TrendingUp, pct: d.scenarios.variation_pct.optimist },
            ].map(s => (
              <div key={s.label} style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#4a6580', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {fmtCurrency(s.value, d.currency)}
                </div>
                {s.pct !== undefined && (
                  <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>
                    {s.pct > 0 ? '+' : ''}{fmt(s.pct, 1)}%
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Alerta abaixo do ponto de reposição */}
          {d.items_below_reorder > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '7px 12px', fontSize: 11, color: '#ef4444', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} /> {d.items_below_reorder} item(ns) abaixo do ponto de reposição — reabastecimento urgente
            </div>
          )}

          {/* Tabela de itens */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #162032' }}>
                  {['SKU', 'Produto', 'Qtd', 'Custo Atual', 'Valor Atual', 'Pessimista', 'Otimista'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4a6580', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.lines.map(l => (
                  <tr key={l.sku} style={{ borderBottom: '1px solid rgba(22,32,50,0.5)' }}>
                    <td style={{ padding: '7px 10px', color: '#60a5fa', fontFamily: 'monospace', fontSize: 10 }}>{l.sku}</td>
                    <td style={{ padding: '7px 10px', color: '#f1f5f9' }}>{l.product_name}</td>
                    <td style={{ padding: '7px 10px', color: '#94a3b8', textAlign: 'right' }}>{fmt(l.quantity, 1)} {l.unit}</td>
                    <td style={{ padding: '7px 10px', color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(l.current_cost, d.currency)}</td>
                    <td style={{ padding: '7px 10px', color: '#f1f5f9', textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(l.current_value, d.currency)}</td>
                    <td style={{ padding: '7px 10px', color: '#ef4444', textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(l.pessimist_value, d.currency)}</td>
                    <td style={{ padding: '7px 10px', color: '#10b981', textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(l.optimist_value, d.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AiInsight text={d.ai_analysis} />
          <div style={{ fontSize: 10, color: '#4a6580', marginTop: 10, textAlign: 'right' }}>
            Gerado em {new Date(d.generated_at).toLocaleString('pt-BR')}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Feature B: Reconciliação ─────────────────────────────────────────────────

const SEVERITY_COLOR = { critical: '#ef4444', warning: '#f59e0b', info: '#60a5fa' };
const TYPE_LABEL = {
  underpayment:    'Pagamento Insuficiente',
  overpayment:     'Pagamento a Maior',
  missing_payment: 'Sem Pagamento',
  late_delivery:   'Entrega Atrasada',
};

function ReconciliationPanel() {
  const { data: state, isLoading } = useMrpReconciler();
  const { mutate: triggerNow, isPending } = useTriggerReconciliation();
  const d = state?.data;

  return (
    <SectionCard
      icon={FileCheck}
      title="Conciliação Financeira — Ordens de Compra vs Pagamentos"
      loading={isLoading}
      error={state?.debugError ?? undefined}
      badge={state?.isFallback ? <StaleBadge lastUpdated={state.lastUpdated} /> : null}
    >
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => triggerNow()}
          disabled={isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#162032', border: '1px solid #1e3048', borderRadius: 6, padding: '5px 12px', color: '#94a3b8', fontSize: 11, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1 }}
        >
          <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Conciliando...' : 'Conciliar Agora'}
        </button>
      </div>

      {d && (
        <>
          {/* Sumário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'OCs Verificadas', value: fmt(d.total_pos_checked), color: '#f1f5f9' },
              { label: 'Divergências', value: fmt(d.divergences_found), color: d.divergences_found > 0 ? '#ef4444' : '#10b981' },
              { label: 'Exposição Total', value: fmtCurrency(d.total_gap_value), color: d.total_gap_value > 0 ? '#f59e0b' : '#10b981' },
            ].map(m => (
              <div key={m.label} style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#4a6580', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: m.color, fontFamily: 'JetBrains Mono, monospace' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Status geral */}
          <div style={{ background: d.divergences_found === 0 ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)', border: `1px solid ${d.divergences_found === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 6, padding: '7px 12px', fontSize: 11, color: d.divergences_found === 0 ? '#10b981' : '#ef4444', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {d.divergences_found === 0 ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
            {d.summary}
          </div>

          {/* Lista de divergências */}
          {d.divergences.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.divergences.map(div => (
                <div key={div.po_id} style={{ background: '#0A1220', border: `1px solid ${SEVERITY_COLOR[div.severity]}30`, borderLeft: `3px solid ${SEVERITY_COLOR[div.severity]}`, borderRadius: 6, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600 }}>{div.po_number}</span>
                    <span style={{ fontSize: 10, background: `${SEVERITY_COLOR[div.severity]}20`, color: SEVERITY_COLOR[div.severity], borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                      {div.severity.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{TYPE_LABEL[div.type]}</span>
                    <span style={{ fontSize: 10, color: '#4a6580', marginLeft: 'auto' }}>{div.supplier_name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>OC: <b style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{fmtCurrency(div.po_value)}</b></span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Pago: <b style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{fmtCurrency(div.total_paid)}</b></span>
                    <span style={{ fontSize: 11, color: '#f59e0b' }}>Gap: <b style={{ fontFamily: 'monospace' }}>{fmtCurrency(Math.abs(div.gap))}</b></span>
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{div.note}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: '#4a6580', marginTop: 10, textAlign: 'right' }}>
            Gerado em {new Date(d.generated_at).toLocaleString('pt-BR')}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Feature C: Risco de Fornecedores ────────────────────────────────────────

const RISK_COLOR = { Baixo: '#10b981', Moderado: '#f59e0b', Alto: '#f97316', Crítico: '#ef4444' };

function ScoreBar({ score, max = 100 }) {
  const pct = (score / max) * 100;
  const color = score < 20 ? '#10b981' : score < 45 ? '#f59e0b' : score < 70 ? '#f97316' : '#ef4444';
  return (
    <div style={{ width: '100%', height: 6, background: '#162032', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
    </div>
  );
}

function SupplierRiskPanel() {
  const { data: state, isLoading } = useMrpSupplierRisk();
  const { mutate: reevaluate, isPending } = useReevaluateSupplierRisk();
  const d = state?.data;

  return (
    <SectionCard
      icon={ShieldAlert}
      title="Score de Risco de Fornecedores"
      loading={isLoading}
      error={state?.debugError ?? undefined}
      badge={state?.isFallback ? <StaleBadge lastUpdated={state.lastUpdated} /> : null}
    >
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => reevaluate()}
          disabled={isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#162032', border: '1px solid #1e3048', borderRadius: 6, padding: '5px 12px', color: '#94a3b8', fontSize: 11, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1 }}
        >
          <RefreshCw size={12} /> {isPending ? 'Avaliando...' : 'Reavaliar'}
        </button>
      </div>

      {d && (
        <>
          {/* Sumário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Fornecedores', value: fmt(d.suppliers_analyzed), color: '#f1f5f9' },
              { label: 'Alto/Crítico Risco', value: fmt(d.high_risk_count), color: d.high_risk_count > 0 ? '#ef4444' : '#10b981' },
              { label: 'Gasto Total', value: fmtCurrency(d.total_spend), color: '#f1f5f9' },
            ].map(m => (
              <div key={m.label} style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#4a6580', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: m.color, fontFamily: 'JetBrains Mono, monospace' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Lista de fornecedores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.suppliers.map(s => (
              <div key={s.supplier_id} style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 10, color: '#4a6580' }}>{s.country}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: RISK_COLOR[s.risk_label] }}>{s.risk_label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: RISK_COLOR[s.risk_label], fontFamily: 'monospace', minWidth: 32, textAlign: 'right' }}>{fmt(s.risk_score)}</span>
                </div>

                <ScoreBar score={s.risk_score} />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 8, fontSize: 10, color: '#4a6580' }}>
                  <span>Pontualidade: <b style={{ color: s.on_time_rate_pct < 90 ? '#f59e0b' : '#94a3b8' }}>{fmt(s.on_time_rate_pct, 1)}%</b></span>
                  <span>Lead time: <b style={{ color: '#94a3b8' }}>{s.avg_lead_time}d</b></span>
                  <span>OCs: <b style={{ color: '#94a3b8' }}>{s.total_pos}</b> ({s.late_pos} atrasadas)</span>
                  <span>Share: <b style={{ color: s.spend_share_pct > 40 ? '#f59e0b' : '#94a3b8' }}>{fmt(s.spend_share_pct, 1)}%</b></span>
                  <span>Gasto: <b style={{ color: '#94a3b8' }}>{fmtCurrency(s.total_spend)}</b></span>
                </div>

                {/* Breakdown de score */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                  {Object.entries(s.score_breakdown).map(([key, val]) => (
                    <span key={key} style={{ fontSize: 9, background: '#162032', borderRadius: 4, padding: '2px 6px', color: val > 10 ? '#f59e0b' : '#4a6580' }}>
                      {key.replace('_', ' ')}: {val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <AiInsight text={d.ai_analysis} />
          <div style={{ fontSize: 10, color: '#4a6580', marginTop: 10, textAlign: 'right' }}>
            Gerado em {new Date(d.generated_at).toLocaleString('pt-BR')}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'valuation',      label: 'Valuation de Estoque', icon: Package },
  { id: 'reconciliation', label: 'Conciliação',          icon: FileCheck },
  { id: 'supplier_risk',  label: 'Risco de Fornecedores', icon: ShieldAlert },
];

export default function MrpFinanceAgents() {
  const [activeTab, setActiveTab] = useState('valuation');

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#070B14', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0, marginBottom: 4 }}>
          Agentes Financeiros — Supply Chain
        </h1>
        <p style={{ fontSize: 13, color: '#4a6580', margin: 0 }}>
          Valuation de estoque · Conciliação de compras · Score de risco de fornecedores
        </p>
        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#4a6580', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 20, padding: '3px 10px' }}>
          <Info size={10} color="#60a5fa" /> Módulo independente — dados via Supabase + Claude AI
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: active ? '#3b82f6' : '#0d1421',
                border: `1px solid ${active ? '#3b82f6' : '#162032'}`,
                borderRadius: 8, padding: '7px 16px',
                color: active ? '#fff' : '#94a3b8',
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {activeTab === 'valuation'      && <ValuationPanel />}
      {activeTab === 'reconciliation' && <ReconciliationPanel />}
      {activeTab === 'supplier_risk'  && <SupplierRiskPanel />}
    </div>
  );
}
