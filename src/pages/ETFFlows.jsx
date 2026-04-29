// ─── ETF FLOWS PAGE ───────────────────────────────────────────────────────────
// Bitcoin Spot ETF capital flows — BlackRock, Fidelity, ARK, Grayscale, etc.
import { useState } from 'react';
import { etfFlows } from '../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

function fmt(v, decimals = 1) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(decimals)}B`;
  return `$${v.toFixed(decimals)}M`;
}

function FlowBadge({ value }) {
  const pos = value >= 0;
  return (
    <span style={{
      fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
      color: pos ? '#10b981' : '#ef4444',
      background: pos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${pos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      borderRadius: 5, padding: '2px 7px',
    }}>
      {pos ? '+' : ''}{fmt(value)}
    </span>
  );
}

function SummaryCard({ label, value, sub, color = '#e2e8f0' }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function ETFContent() {
  const [sortBy, setSortBy] = useState('aum');
  const d = etfFlows;

  const sorted = [...d.funds].sort((a, b) => {
    if (sortBy === 'aum') return b.aum_b - a.aum_b;
    if (sortBy === 'today') return b.flow_today_m - a.flow_today_m;
    if (sortBy === '7d') return b.flow_7d_m - a.flow_7d_m;
    return b.flow_30d_m - a.flow_30d_m;
  });

  const totalNet = d.funds.reduce((s, f) => s + f.flow_today_m, 0);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
            Bitcoin Spot ETF Flows
          </h1>
          <DataTrustBadge mode="paid_required" confidence="D" source="Bloomberg/BitMEX Research" reason="ETF flows requerem Bloomberg Terminal ou BitMEX Research (~$99/mês)" />
          <GradeBadge grade={d.quality} />
          <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
            {d.consec_inflow_days} dias consecutivos de entrada
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
          Fontes: Bloomberg, SEC 13F, ETF.com · Dados D-1 (último dia útil). Principal driver de demand institucional desde jan/2024.
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <SummaryCard
          label="AUM Total"
          value={`$${d.total_aum_b.toFixed(1)}B`}
          sub={`+${((d.total_aum_b - d.total_aum_prev_30d_b) / d.total_aum_prev_30d_b * 100).toFixed(1)}% em 30d`}
          color="#60a5fa"
        />
        <SummaryCard
          label="Flow Hoje"
          value={`${totalNet >= 0 ? '+' : ''}$${Math.abs(totalNet).toFixed(0)}M`}
          sub={totalNet >= 0 ? '↑ Entrada líquida' : '↓ Saída líquida'}
          color={totalNet >= 0 ? '#10b981' : '#ef4444'}
        />
        <SummaryCard
          label="Flow 7D"
          value={`+$${(d.net_flow_7d_m / 1000).toFixed(2)}B`}
          sub="Acumulado semana"
          color="#10b981"
        />
        <SummaryCard
          label="Flow 30D"
          value={`+$${(d.net_flow_30d_m / 1000).toFixed(2)}B`}
          sub="Acumulado mês"
          color="#10b981"
        />
        <SummaryCard
          label="N° de ETFs"
          value={d.funds.length.toString()}
          sub="produtos ativos"
          color="#a78bfa"
        />
        <SummaryCard
          label="Dominância IBIT"
          value={`${(d.funds.find(f => f.ticker === 'IBIT').aum_b / d.total_aum_b * 100).toFixed(1)}%`}
          sub="BlackRock (maior)"
          color="#3b82f6"
        />
      </div>

      {/* Flow chart 30 dias */}
      <div style={{
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid #1e2d45', borderRadius: 14, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Flows Diários — Últimos 30 dias</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Entrada (verde) vs Saída (vermelho) · USD Milhões</div>
          </div>
          <DataTrustBadge mode="paid_required" confidence="D" source="Bloomberg/BitMEX Research" reason="ETF flows requerem Bloomberg Terminal ou BitMEX Research (~$99/mês)" />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={d.history_daily} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} tickFormatter={v => `$${v}M`} />
            <Tooltip
              contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }}
              formatter={(v, n) => [`$${Math.abs(Number(v)).toFixed(1)}M`, n === 'inflow' ? 'Entrada' : n === 'outflow' ? 'Saída' : 'Net']}
            />
            <ReferenceLine y={0} stroke="#2a3f5f" />
            <Bar dataKey="net" radius={[2, 2, 0, 0]}>
              {d.history_daily.map((entry, index) => (
                <Cell key={index} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela de ETFs */}
      <div style={{
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid #1e2d45', borderRadius: 14, overflow: 'hidden', marginBottom: 20,
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #1e2d45',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Fundos por Emissor</div>
            <div style={{ fontSize: 11, color: '#475569' }}>AUM, flows e concentração por produto</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['aum', 'today', '7d', '30d'].map(k => (
              <button key={k} onClick={() => setSortBy(k)} style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                background: sortBy === k ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: sortBy === k ? '#60a5fa' : '#475569',
                border: `1px solid ${sortBy === k ? 'rgba(59,130,246,0.4)' : '#1e2d45'}`,
                fontWeight: sortBy === k ? 700 : 400,
              }}>
                {k === 'aum' ? 'AUM' : k === 'today' ? 'Hoje' : k === '7d' ? '7D' : '30D'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['ETF', 'Emissor', 'AUM', 'Flow Hoje', 'Flow 7D', 'Flow 30D', 'Dominância'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: h === 'ETF' || h === 'Emissor' ? 'left' : 'right',
                    fontSize: 10, color: '#475569', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((fund, i) => (
                <tr key={fund.ticker} style={{
                  borderBottom: '1px solid rgba(30,45,69,0.5)',
                  background: i === 0 ? 'rgba(59,130,246,0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: fund.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{fund.ticker}</div>
                        <div style={{ fontSize: 10, color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fund.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#64748b' }}>{fund.issuer}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                    ${fund.aum_b.toFixed(1)}B
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FlowBadge value={fund.flow_today_m} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FlowBadge value={fund.flow_7d_m} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FlowBadge value={fund.flow_30d_m} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <div style={{ width: 60, height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${(fund.aum_b / d.total_aum_b * 100).toFixed(1)}%`,
                          background: fund.color,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', minWidth: 38, textAlign: 'right' }}>
                        {(fund.aum_b / d.total_aum_b * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #1e2d45', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#334155' }}>
            Total AUM: <span style={{ color: '#60a5fa', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>${d.total_aum_b.toFixed(1)}B</span>
          </span>
          <span style={{ fontSize: 10, color: '#334155' }}>
            Net Flow Total Hoje: <span style={{ color: totalNet >= 0 ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
              {totalNet >= 0 ? '+' : ''}${Math.abs(totalNet).toFixed(1)}M
            </span>
          </span>
        </div>
      </div>

      {/* Signal */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(16,185,129,0.06)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 12,
        fontSize: 12, color: '#94a3b8', lineHeight: 1.7,
      }}>
        <span style={{ color: '#10b981', fontWeight: 700 }}>📡 Sinal ETF: </span>
        {d.signal}
      </div>
    </div>
  );
}