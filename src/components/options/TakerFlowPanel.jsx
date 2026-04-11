// ─── OPTIONS TAKER FLOW PANEL ─────────────────────────────────────────────────
// Buy Call / Sell Call / Buy Put / Sell Put premium flows
import { optionsTakerFlow } from '../../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../ui/DataBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

function fmt(v) { return `$${v.toFixed(1)}M`; }

export default function TakerFlowPanel() {
  const d = optionsTakerFlow;

  const bullBearPct = ((d.bull_bear_index + 1) / 2 * 100);
  const bbColor = d.bull_bear_index > 0.1 ? '#10b981' : d.bull_bear_index < -0.1 ? '#ef4444' : '#f59e0b';

  const flowItems = [
    { label: 'Buy Call',  value: d.buy_call_premium_m,  color: '#10b981', icon: '↑', desc: 'Aposta bullish / long gamma' },
    { label: 'Sell Call', value: -d.sell_call_premium_m, color: '#60a5fa', icon: '↓', desc: 'Monetizar carry / cap upside' },
    { label: 'Buy Put',   value: -d.buy_put_premium_m,   color: '#ef4444', icon: '↑', desc: 'Hedge / proteção downside' },
    { label: 'Sell Put',  value: d.sell_put_premium_m,  color: '#a78bfa', icon: '↓', desc: 'Sell vol / coletar prêmio' },
  ];

  const comboData = d.combo_strategies.map(s => ({
    name: s.name,
    value: Math.abs(s.premium_net_m),
    raw: s.premium_net_m,
    color: s.color,
  }));

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 14, padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Options Taker Flow</div>
            <ModeBadge mode="mock" />
            <GradeBadge grade={d.quality} />
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>Premium líquido 24h · Buy vs Sell por tipo · Deribit</div>
        </div>
      </div>

      {/* Bull-Bear Index */}
      <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#0d1421', border: `1px solid ${bbColor}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Bull-Bear Index
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: bbColor }}>
            {d.bull_bear_index > 0 ? '+' : ''}{d.bull_bear_index.toFixed(3)}
          </span>
        </div>
        <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4,
          background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)' }}>
          <div style={{
            position: 'absolute', top: -2, left: `${bullBearPct}%`,
            transform: 'translateX(-50%)',
            width: 6, height: 14, borderRadius: 3, background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
          <span>-1 Extremo Bear</span><span>0 Neutro</span><span>+1 Extremo Bull</span>
        </div>
      </div>

      {/* Flow grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {flowItems.map((item, i) => (
          <div key={i} style={{
            background: '#0d1421', borderRadius: 9, padding: '10px 12px',
            border: `1px solid ${item.color}15`,
          }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: item.color }}>
              {fmt(Math.abs(item.value))}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Net summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
          <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>Net Call Premium</div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
            +{fmt(d.net_call_premium_m)}
          </span>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>Mais compradores que vendedores</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>Net Put Premium</div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>
            +{fmt(d.net_put_premium_m)}
          </span>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>Hedging ativo — proteção comprada</div>
        </div>
      </div>

      {/* Combo strategies */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Combo Strategies — Net Premium 24h
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={comboData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, n, props) => [`${props.payload.raw > 0 ? '+' : '-'}$${Number(v).toFixed(1)}M`, 'Net Premium']}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {comboData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Signal */}
      <div style={{
        padding: '9px 11px', borderRadius: 8,
        background: 'rgba(30,45,69,0.4)', border: '1px solid #1e2d45',
        fontSize: 10, color: '#64748b', lineHeight: 1.6,
      }}>
        {d.signal}
      </div>
    </div>
  );
}