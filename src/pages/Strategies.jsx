// ─── STRATEGIES PAGE ──────────────────────────────────────────────────────────
// Setups operacionais baseados em IV Rank, Basis, Funding, Sentiment
import { useState, useMemo } from 'react';
import { strategies, marketConditionsSummary } from '../components/data/mockDataStrategies';
import { ModeBadge } from '../components/ui/DataBadge';
import { useBtcTicker, useFearGreed } from '@/hooks/useBtcData';
import { useOptionsData } from '@/hooks/useDeribit';
import { IS_LIVE } from '@/lib/env';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const STATUS_CONFIG = {
  ACTIVE:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  label: '✅ ATIVO',   pulse: true },
  WATCH:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',   label: '👁 MONITORAR', pulse: false },
  INACTIVE: { color: '#475569', bg: 'rgba(71,85,105,0.12)',   border: 'rgba(71,85,105,0.3)',   label: '⏸ INATIVO', pulse: false },
};

const CATEGORY_CONFIG = {
  arbitrage:   { color: '#10b981', icon: '⚖️' },
  options_vol: { color: '#a78bfa', icon: '◬' },
  hedge:       { color: '#f59e0b', icon: '🛡️' },
};

const URGENCY_CONFIG = {
  HIGH:   { color: '#ef4444', label: 'ALTA' },
  MEDIUM: { color: '#f59e0b', label: 'MÉDIA' },
  LOW:    { color: '#64748b', label: 'BAIXA' },
};

function ConditionRow({ condition }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
        background: condition.met ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${condition.met ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9,
      }}>
        {condition.met ? '✓' : '✗'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: condition.met ? '#94a3b8' : '#64748b' }}>{condition.label}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: condition.met ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {condition.value}
          </span>
          <span style={{ fontSize: 10, color: '#334155' }}>{condition.detail}</span>
        </div>
      </div>
    </div>
  );
}

function ProbabilityBar({ value, label, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#475569' }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 700 }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${value * 100}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
    </div>
  );
}

function StrategyCard({ strategy, isSelected, onClick }) {
  const status = STATUS_CONFIG[strategy.status];
  const cat = CATEGORY_CONFIG[strategy.category];
  const urgency = URGENCY_CONFIG[strategy.urgency];
  const condPct = (strategy.conditions_met / strategy.conditions_total) * 100;

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? `${status.color}08` : 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: `1px solid ${isSelected ? status.border : '#1e2d45'}`,
        borderLeft: `4px solid ${status.color}`,
        borderRadius: 12, padding: '16px 18px', marginBottom: 10,
        cursor: 'pointer', transition: 'all 0.15s',
        opacity: strategy.status === 'INACTIVE' ? 0.7 : 1,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
              background: status.bg, color: status.color, border: `1px solid ${status.border}`,
            }}>
              {status.label}
            </span>
            <span style={{ fontSize: 10, color: cat.color, background: `${cat.color}12`, border: `1px solid ${cat.color}25`, borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
              {cat.icon} {strategy.category_label}
            </span>
            {strategy.recommended && (
              <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 3, padding: '2px 6px', fontWeight: 700 }}>
                ⭐ RECOMENDADO
              </span>
            )}
            <span style={{ fontSize: 9, color: urgency.color, background: `${urgency.color}12`, border: `1px solid ${urgency.color}25`, borderRadius: 3, padding: '2px 6px', fontWeight: 600 }}>
              Urgência: {urgency.label}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>{strategy.name}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#334155', marginBottom: 2 }}>PROB. HIST.</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: status.color, lineHeight: 1 }}>
            {Math.round(strategy.probability_historical * 100)}%
          </div>
        </div>
      </div>

      {/* Conditions meter */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Condições: {strategy.conditions_met}/{strategy.conditions_total}
          </span>
          <span style={{ fontSize: 9, color: condPct === 100 ? '#10b981' : condPct > 50 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
            {Math.round(condPct)}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${condPct}%`,
            background: condPct === 100 ? '#10b981' : condPct > 50 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
      </div>

      {/* Status reason */}
      <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{strategy.status_reason}</div>
    </div>
  );
}

function StrategyDetail({ strategy }) {
  if (!strategy) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#334155', fontSize: 12 }}>
      ← Selecione uma estratégia para ver o setup completo
    </div>
  );

  const status = STATUS_CONFIG[strategy.status];
  const cat = CATEGORY_CONFIG[strategy.category];

  return (
    <div style={{ padding: '0 0 20px' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>{status.label}</span>
          <span style={{ fontSize: 10, color: cat.color, background: `${cat.color}12`, border: `1px solid ${cat.color}25`, borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>{cat.icon} {strategy.category_label}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{strategy.name}</div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{strategy.status_reason}</div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Prob + Risk */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#0d1421', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Performance Histórica</div>
            <ProbabilityBar value={strategy.probability_historical} label="Probabilidade de sucesso" color={status.color} />
            <div style={{ marginTop: 10, fontSize: 10, color: '#64748b' }}>
              Profit Factor: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontWeight: 700 }}>{strategy.profit_factor.toFixed(1)}:1</span>
            </div>
          </div>
          <div style={{ background: '#0d1421', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Condições de Entrada</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: strategy.conditions_met === strategy.conditions_total ? '#10b981' : '#f59e0b', lineHeight: 1, marginBottom: 4 }}>
              {strategy.conditions_met}/{strategy.conditions_total}
            </div>
            <div style={{ fontSize: 9, color: '#334155' }}>condições ativas</div>
          </div>
        </div>

        {/* Conditions */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Checklist de Condições</div>
          {strategy.conditions.map((c, i) => <ConditionRow key={i} condition={c} />)}
        </div>

        {/* Setup */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Setup Operacional</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[strategy.entry.leg1, strategy.entry.leg2].map((leg, i) => (
              <div key={i} style={{
                background: '#0d1421', borderRadius: 8, padding: '10px 12px',
                border: `1px solid ${leg.action === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderLeft: `3px solid ${leg.action === 'BUY' ? '#10b981' : '#ef4444'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: leg.action === 'BUY' ? '#10b981' : '#ef4444',
                    background: leg.action === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${leg.action === 'BUY' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 4, padding: '2px 7px',
                  }}>{leg.action}</span>
                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{leg.instrument}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: '#64748b' }}>
                  <span>Preço: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{leg.price}</span></span>
                  <span>Tamanho: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{leg.sizing}</span></span>
                </div>
              </div>
            ))}
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 7, padding: '8px 12px', fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>
              Resultado líquido esperado: {strategy.entry.carry_earned_ann}
            </div>
          </div>
        </div>

        {/* Exit rules */}
        <div style={{ background: '#0d1421', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Regras de Saída</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>🎯 Alvo: <span style={{ color: '#10b981' }}>{strategy.exit.trigger}</span></div>
            <div style={{ fontSize: 10, color: '#64748b' }}>🛑 Stop: <span style={{ color: '#ef4444' }}>{strategy.exit.stop}</span></div>
            <div style={{ fontSize: 10, color: '#64748b' }}>⏱ Max hold: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{strategy.exit.max_hold}</span></div>
          </div>
        </div>

        {/* Explanation */}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, marginBottom: 6 }}>🤖 Racional Quantitativo</div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>{strategy.explanation}</div>
        </div>

        {/* Risk warnings */}
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 8 }}>⚠️ Riscos</div>
          {strategy.risk_warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 10, color: '#64748b', marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: '#ef4444' }}>•</span>
              {w}
            </div>
          ))}
        </div>

        {/* PnL chart if available */}
        {strategy.history_pnl && (
          <div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>P&L Simulado (backtested)</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={strategy.history_pnl} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="day" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
                  formatter={(v) => [v, 'P&L %']}
                />
                <ReferenceLine y={0} stroke="#2a3f5f" />
                <Line type="monotone" dataKey="pnl" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export function StrategiesContent() {
  const [selectedStrategy, setSelectedStrategy] = useState(strategies[0]);
  const [filter, setFilter] = useState('Todos');

  const { data: ticker } = useBtcTicker();
  const { data: fng } = useFearGreed(1);
  const { data: optionsData } = useOptionsData();

  // Live market conditions merged over mock fallback
  const mc = useMemo(() => ({
    ...marketConditionsSummary,
    funding_rate:  ticker ? ticker.last_funding_rate * 100 : marketConditionsSummary.funding_rate,
    iv_rank:       optionsData ? Math.round(optionsData.iv_atm * 100) : marketConditionsSummary.iv_rank,
    sentiment:     fng ? fng.label : marketConditionsSummary.sentiment,
  }), [ticker, fng, optionsData]);

  const filtered = filter === 'Todos' ? strategies
    : filter === 'ACTIVE' ? strategies.filter(s => s.status === 'ACTIVE')
    : filter === 'WATCH' ? strategies.filter(s => s.status === 'WATCH')
    : strategies.filter(s => s.category === filter);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
            Estratégias Operacionais
          </h1>
          <ModeBadge mode={IS_LIVE && ticker ? 'live' : 'mock'} />
          <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
            {mc.active_setups} ATIVOS
          </span>
          <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
            {mc.watch_setups} MONITORANDO
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
          Setups gerados por engine quantitativa · baseados em IV Rank, Basis, Funding Rate, Sentiment e On-Chain · Não é recomendação de investimento.
        </p>
      </div>

      {/* Market conditions bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16,
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid #1e2d45', borderRadius: 12, padding: 14,
      }}>
        <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', gridColumn: '1 / -1', marginBottom: 8 }}>
          ⚡ Condições de Mercado Atuais
        </div>
        {Object.entries(mc.conditions).map(([key, cond]) => (
          <div key={key} style={{ background: '#0d1421', borderRadius: 8, padding: '10px 12px', border: `1px solid ${cond.color}18` }}>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cond.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: cond.color }}>
              {typeof cond.value === 'number' ? (cond.value < 1 ? (cond.value > 0 ? '+' : '') + cond.value.toFixed(4) + '%' : cond.value.toFixed(2)) : cond.value}
            </div>
            <div style={{
              marginTop: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              color: cond.color,
            }}>
              {cond.status.replace('_', ' ')}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['Todos', 'ACTIVE', 'WATCH', 'arbitrage', 'options_vol', 'hedge'].map(f => {
          const labels = { Todos: 'Todos', ACTIVE: '✅ Ativos', WATCH: '👁 Monitorar', arbitrage: '⚖️ Arbitragem', options_vol: '◬ Options Vol', hedge: '🛡️ Hedge' };
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 10, padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
              background: filter === f ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
              color: filter === f ? '#60a5fa' : '#475569',
              border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : '#1e2d45'}`,
              fontWeight: filter === f ? 700 : 400,
            }}>{labels[f]}</button>
          );
        })}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 16, alignItems: 'start' }}>
        {/* Strategy list */}
        <div>
          {filtered.map(s => (
            <StrategyCard
              key={s.id}
              strategy={s}
              isSelected={selectedStrategy?.id === s.id}
              onClick={() => setSelectedStrategy(selectedStrategy?.id === s.id ? null : s)}
            />
          ))}
        </div>

        {/* Detail panel */}
        <div style={{
          background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
          border: '1px solid #1e2d45', borderRadius: 14,
          position: 'sticky', top: 20, maxHeight: '90vh', overflowY: 'auto',
        }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2d45' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>📋 Setup Detalhado</div>
          </div>
          <StrategyDetail strategy={selectedStrategy} />
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        marginTop: 20, padding: '10px 14px',
        background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)',
        borderRadius: 8, fontSize: 10, color: '#475569', lineHeight: 1.6,
      }}>
        ⚠️ <strong style={{ color: '#64748b' }}>Aviso:</strong> Estratégias geradas por modelo quantitativo com dados mock. Probabilidades históricas são baseadas em backtests que não garantem performance futura. Não constitui recomendação de investimento. Consulte um profissional qualificado.
      </div>
    </div>
  );
}