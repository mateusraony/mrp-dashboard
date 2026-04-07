// ─── DASHBOARD DE AÇÕES ───────────────────────────────────────────────────────
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import {
  tradeOpportunities, performanceHistory, performanceStats, pnlChartData,
} from '../components/data/mockDataActionDashboard';
import { globalRisk, fearGreed, btcFutures } from '../components/data/mockData';
import { marketRegime } from '../components/data/mockDataRegime';
import AIInsightPanel from '../components/ai/AIInsightPanel';
import { ModeBadge } from '../components/ui/DataBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_STYLE = {
  LONG:      { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  SHORT:     { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  HEDGE:     { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  ARBITRAGE: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
};

const STATUS_STYLE = {
  active:   { color: '#10b981', label: '● Ativa' },
  watching: { color: '#f59e0b', label: '◎ Monitorando' },
  closed:   { color: '#475569', label: '✓ Encerrada' },
};

const GRADE_STYLE = {
  A: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  B: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  C: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
};

function TypeBadge({ type }) {
  const s = TYPE_STYLE[type] || TYPE_STYLE.LONG;
  return (
    <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: '0.05em' }}>
      {type}
    </span>
  );
}

function GradeBadge({ grade }) {
  const s = GRADE_STYLE[grade] || GRADE_STYLE.B;
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      Grade {grade}
    </span>
  );
}

function PnlBadge({ pct }) {
  if (pct === null) return <span style={{ fontSize: 10, color: '#334155' }}>—</span>;
  const pos = pct >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: pos ? '#10b981' : '#ef4444' }}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function StatCard({ label, value, color = '#60a5fa', sub }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '12px 14px' }}>
      <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── OPPORTUNITY CARD ─────────────────────────────────────────────────────────
function OpportunityCard({ op, onSelect, selected }) {
  const statusS = STATUS_STYLE[op.status];
  const isSelected = selected?.id === op.id;

  return (
    <div
      onClick={() => onSelect(isSelected ? null : op)}
      style={{
        background: '#111827',
        border: `1px solid ${isSelected ? 'rgba(59,130,246,0.5)' : '#1e2d45'}`,
        borderLeft: `3px solid ${TYPE_STYLE[op.type]?.color || '#60a5fa'}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: isSelected ? '0 0 0 1px rgba(59,130,246,0.2)' : 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <TypeBadge type={op.type} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{op.asset}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>{op.strategy}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <GradeBadge grade={op.ai_grade} />
          <span style={{ fontSize: 9, color: statusS.color, fontWeight: 700 }}>{statusS.label}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
        {op.entry && <div><div style={{ fontSize: 8, color: '#334155' }}>Entrada</div><div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>${op.entry.toLocaleString()}</div></div>}
        {op.target && <div><div style={{ fontSize: 8, color: '#334155' }}>Alvo</div><div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>${op.target.toLocaleString()}</div></div>}
        {op.stop && <div><div style={{ fontSize: 8, color: '#334155' }}>Stop</div><div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>${op.stop.toLocaleString()}</div></div>}
        {op.rr && <div><div style={{ fontSize: 8, color: '#334155' }}>R/R</div><div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa' }}>1:{op.rr}</div></div>}
        {op.basis_ann && <div><div style={{ fontSize: 8, color: '#334155' }}>Basis Ann.</div><div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{op.basis_ann}%</div></div>}
        <div><div style={{ fontSize: 8, color: '#334155' }}>Prob.</div><div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>{Math.round(op.probability * 100)}%</div></div>
        <div><div style={{ fontSize: 8, color: '#334155' }}>P&L</div><PnlBadge pct={op.pnl_pct} /></div>
        <div><div style={{ fontSize: 8, color: '#334155' }}>Horizonte</div><div style={{ fontSize: 10, color: '#64748b' }}>{op.timeframe}</div></div>
      </div>

      {/* Source */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {op.tags.map(t => (
            <span key={t} style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.15)' }}>{t}</span>
          ))}
        </div>
        <span style={{ fontSize: 9, color: '#334155' }}>Fonte: {op.source}</span>
      </div>

      {/* Expanded rationale */}
      {isSelected && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 7, background: '#0a1018', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>🤖 Análise AI</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.65 }}>{op.rationale}</div>
        </div>
      )}
    </div>
  );
}

// ─── PERFORMANCE PANEL ────────────────────────────────────────────────────────
function PerformancePanel() {
  const st = performanceStats;
  const regColor = globalRisk.regime === 'RISK-ON' ? '#10b981' : globalRisk.regime === 'RISK-OFF' ? '#ef4444' : '#f59e0b';

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        <StatCard label="Win Rate" value={`${st.win_rate.toFixed(0)}%`} color="#10b981" sub={`${performanceHistory.filter(h=>h.result==='WIN').length} de ${st.total_trades} trades`} />
        <StatCard label="PnL Médio" value={`${st.avg_pnl_pct > 0 ? '+' : ''}${st.avg_pnl_pct.toFixed(2)}%`} color={st.avg_pnl_pct > 0 ? '#10b981' : '#ef4444'} sub="Por trade" />
        <StatCard label="PnL Acumulado" value={`+${st.cumulative_pnl_pct.toFixed(1)}%`} color="#60a5fa" sub="Todas as operações" />
        <StatCard label="Max Drawdown" value={`${st.max_drawdown.toFixed(2)}%`} color="#ef4444" sub={`Sharpe: ${st.sharpe_ratio}`} />
      </div>

      {/* Cumulative chart */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>P&L Acumulado por Trade</div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={pnlChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} formatter={v => [`${v.toFixed(2)}%`, 'Cumul.']} />
            <ReferenceLine y={0} stroke="#1e2d45" />
            <Area dataKey="cumulative" stroke="#10b981" fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trade PnL bars */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>P&L por Trade</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={pnlChartData} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} formatter={v => [`${v > 0 ? '+' : ''}${v.toFixed(2)}%`, 'P&L']} />
            <ReferenceLine y={0} stroke="#1e2d45" />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {pnlChartData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* History table */}
      <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Histórico de Operações</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {performanceHistory.map(h => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7 }}>
            <TypeBadge type={h.type} />
            <span style={{ flex: 1, fontSize: 10, color: '#8899a6' }}>{h.strategy}</span>
            <span style={{ fontSize: 9, color: '#334155', width: 60 }}>{h.date.slice(5)}</span>
            <span style={{ fontSize: 9, color: '#475569', width: 44 }}>{h.duration}</span>
            <GradeBadge grade={h.ai_grade} />
            <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', width: 52, textAlign: 'right', color: h.pnl_pct >= 0 ? '#10b981' : '#ef4444' }}>
              {h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct.toFixed(2)}%
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: h.result === 'WIN' ? '#10b981' : '#ef4444' }}>{h.result}</span>
          </div>
        ))}
      </div>

      {/* Grade accuracy */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ fontSize: 9, color: '#334155', marginBottom: 4 }}>Win Rate — Grade A</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{st.grade_a_win_rate}%</div>
          <div style={{ fontSize: 8, color: '#475569' }}>Sinais de alta qualidade</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 9, color: '#334155', marginBottom: 4 }}>Win Rate — Grade B</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b' }}>{st.grade_b_win_rate}%</div>
          <div style={{ fontSize: 8, color: '#475569' }}>Sinais moderados</div>
        </div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = ['Oportunidades', 'Performance'];

export function ActionsContent() {
  const [tab, setTab] = useState('Oportunidades');
  const [selected, setSelected] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const regColor = globalRisk.regime === 'RISK-ON' ? '#10b981' : globalRisk.regime === 'RISK-OFF' ? '#ef4444' : '#f59e0b';

  const filtered = tradeOpportunities.filter(op => {
    const typeOk = typeFilter === 'ALL' || op.type === typeFilter;
    const statusOk = statusFilter === 'ALL' || op.status === statusFilter;
    return typeOk && statusOk;
  });

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
              ⚡ Dashboard de Ações
            </h1>
            <ModeBadge mode="mock" />
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
            Feed de oportunidades · AI-driven · Performance em tempo real
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: `${regColor}12`, color: regColor, border: `1px solid ${regColor}30`, fontWeight: 700 }}>
            {globalRisk.regime} · {globalRisk.score}/100
          </span>
          <Link to={createPageUrl('Automations')} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 7, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', textDecoration: 'none', fontWeight: 700 }}>
            ⚙️ Automações
          </Link>
          <Link to={createPageUrl('ExecutiveReport')} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', textDecoration: 'none', fontWeight: 700 }}>
            📊 Relatório
          </Link>
        </div>
      </div>

      {/* Global AI */}
      <div style={{ marginBottom: 14 }}>
        <AIInsightPanel
          moduleId="ACTION_DASHBOARD"
          probability={globalRisk.prob}
          regime={globalRisk.regime === 'RISK-ON' ? 'risk_on' : 'caution'}
          recommendation={`${filtered.length} oportunidades ativas. ${tradeOpportunities.filter(o => o.ai_grade === 'A').length} com Grade A. Win rate histórico: ${performanceStats.win_rate.toFixed(0)}% · PnL acum: +${performanceStats.cumulative_pnl_pct.toFixed(1)}%.`}
          reasoning={`Regime ${globalRisk.regime} com score ${globalRisk.score}/100. F&G ${fearGreed.value} (${fearGreed.classification}). Funding ${(btcFutures.funding_rate * 100).toFixed(4)}% — oportunidades de carry e flush em evidência. Grade A = Win rate 100% histórico.`}
          actions={['Ver Carry Trade', 'Monitorar Flush', 'Checar Hedge', 'Ver Arbitragem']}
          compact
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: tab === t ? 800 : 500,
            background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent',
            color: tab === t ? '#60a5fa' : '#475569',
            transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Oportunidades' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtros:</span>
            {['ALL', 'LONG', 'SHORT', 'HEDGE', 'ARBITRAGE'].map(f => (
              <button key={f} onClick={() => setTypeFilter(f)} style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: typeFilter === f ? 'rgba(59,130,246,0.12)' : 'transparent',
                borderColor: typeFilter === f ? 'rgba(59,130,246,0.4)' : '#1a2535',
                color: typeFilter === f ? '#60a5fa' : '#475569',
              }}>{f}</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#1a2535' }} />
            {['ALL', 'active', 'watching'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: statusFilter === f ? 'rgba(59,130,246,0.12)' : 'transparent',
                borderColor: statusFilter === f ? 'rgba(59,130,246,0.4)' : '#1a2535',
                color: statusFilter === f ? '#60a5fa' : '#475569',
              }}>{f === 'ALL' ? 'Todos Status' : f === 'active' ? 'Ativa' : 'Monitorando'}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#334155' }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(op => (
              <OpportunityCard key={op.id} op={op} onSelect={setSelected} selected={selected} />
            ))}
          </div>
        </div>
      )}

      {tab === 'Performance' && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 14 }}>📈 Performance do Sistema AI</div>
          <PerformancePanel />
        </div>
      )}

      {/* Footer links */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Relatório Executivo', page: 'ExecutiveReport', icon: '📊' },
          { label: 'Automações',          page: 'Automations',     icon: '⚙️' },
          { label: 'Smart Alerts',        page: 'SmartAlerts',     icon: '🔔' },
          { label: 'Derivatives',         page: 'Derivatives',     icon: '⟆' },
          { label: 'On-Chain',            page: 'OnChain',         icon: '⛓' },
          { label: 'Regime',              page: 'MarketRegime',    icon: '🎯' },
        ].map((l, i) => (
          <Link key={i} to={createPageUrl(l.page)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#3b82f6', textDecoration: 'none', padding: '3px 9px', borderRadius: 5, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600 }}>
            {l.icon} {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}