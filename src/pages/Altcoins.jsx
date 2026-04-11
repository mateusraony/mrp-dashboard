// ─── ALTCOINS — Dominância · Rotação · Alt Season ─────────────────────────────
import {
  altSeasonIndex, ethDominance, topAltcoins, sectorRotation,
  dominanceHistory, seasonPhases,
} from '../components/data/mockDataAltcoins';
import { btcDominance } from '../components/data/mockData';
import { ModeBadge } from '../components/ui/DataBadge';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function retColor(v) {
  return v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#64748b';
}
function retFmt(v) {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// ─── ALT SEASON GAUGE ─────────────────────────────────────────────────────────
function AltSeasonGauge({ index }) {
  const { value, change_7d } = index;
  const phase = value >= 75 ? seasonPhases[0] : value >= 25 ? seasonPhases[1] : seasonPhases[2];
  const pct = value; // 0-100

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: `1px solid ${phase.color}30`,
      borderRadius: 14, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>
            Alt Season Index
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: phase.color, lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: 11, color: phase.color, fontWeight: 700, marginTop: 4 }}>{phase.label}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 4 }}>7 dias</div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: retColor(change_7d) }}>
            {change_7d > 0 ? '+' : ''}{change_7d}
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 8, marginBottom: 4 }}>30 dias</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: retColor(index.change_30d) }}>
            {index.change_30d > 0 ? '+' : ''}{index.change_30d}
          </div>
        </div>
      </div>

      {/* Gauge bar */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)' }}>
          <div style={{ height: '100%', width: '100%', background: 'transparent' }} />
        </div>
        {/* Needle */}
        <div style={{
          position: 'absolute', top: -4,
          left: `${pct}%`, transform: 'translateX(-50%)',
          width: 4, height: 20, borderRadius: 2,
          background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.6)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155', marginBottom: 12 }}>
        <span>0 — BTC Season</span><span>50 — Mixed</span><span>100 — Alt Season</span>
      </div>

      {/* Phase legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {seasonPhases.map(p => (
          <div key={p.label} style={{
            background: p.active ? `${p.color}10` : '#0a1018',
            border: `1px solid ${p.active ? p.color + '40' : '#0f1d2e'}`,
            borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: p.color, marginBottom: 3 }}>{p.label} ({p.range})</div>
            <div style={{ fontSize: 8, color: '#334155', lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, padding: '7px 10px', borderRadius: 6, background: `${phase.color}08`, border: `1px solid ${phase.color}20`, fontSize: 10, color: phase.color }}>
        {index.signal}
      </div>
    </div>
  );
}

// ─── DOMINANCE CARDS ──────────────────────────────────────────────────────────
function DominanceCard({ label, value, delta7d, delta30d, color }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>{label} Dominance</div>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1 }}>
        {value.toFixed(1)}%
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 8, color: '#334155' }}>7d</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: retColor(delta7d) }}>{delta7d > 0 ? '+' : ''}{delta7d.toFixed(1)}pp</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#334155' }}>30d</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: retColor(delta30d) }}>{delta30d > 0 ? '+' : ''}{delta30d.toFixed(1)}pp</div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Altcoins() {
  const domChartData = dominanceHistory.slice(-30).map((d, i) => ({
    day: i + 1,
    BTC: d.btc,
    ETH: d.eth,
    Others: d.others,
  }));

  const sectorData = sectorRotation.map(s => ({
    ...s,
    flowColor: s.capital_flow_7d_b >= 0 ? '#10b981' : '#ef4444',
    retColor: retColor(s.ret_7d),
  }));

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Altcoins & Rotação</h1>
          <ModeBadge mode="mock" />
          <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
            NOVO
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Alt Season Index · BTC/ETH Dominância · Top Alts vs BTC · Rotação Setorial
        </p>
      </div>

      {/* Row 1: Gauge + Dominance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 14, marginBottom: 16 }}>
        <AltSeasonGauge index={altSeasonIndex} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <DominanceCard
            label="BTC" value={btcDominance.value}
            delta7d={btcDominance.delta_7d} delta30d={btcDominance.delta_30d}
            color="#f59e0b"
          />
          <DominanceCard
            label="ETH" value={ethDominance.value}
            delta7d={ethDominance.delta_7d} delta30d={ethDominance.delta_30d}
            color="#627eea"
          />
          <div style={{
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px', flex: 1,
          }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Outperformers</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#64748b', lineHeight: 1 }}>
              {altSeasonIndex.top_outperformers}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>de 100 alts superam BTC em 90d</div>
          </div>
        </div>
      </div>

      {/* Row 2: Dominance chart + Sector Rotation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Dominance 30d */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Dominância — 30 dias</div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12 }}>BTC · ETH · Others</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={domChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 8, fill: '#334155' }} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#334155' }} tickLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, borderRadius: 6 }}
                formatter={(v, name) => [`${Number(v).toFixed(2)}%`, name]}
              />
              <Line type="monotone" dataKey="BTC" stroke="#f59e0b" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="ETH" stroke="#627eea" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="Others" stroke="#475569" dot={false} strokeWidth={1} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sector Rotation */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Rotação Setorial — 7d</div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12 }}>Retorno vs fluxo de capital</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sectorData} layout="vertical" margin={{ top: 4, right: 50, left: 40, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 8, fill: '#334155' }} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, borderRadius: 6 }}
                formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Retorno 7d']}
              />
              <ReferenceLine x={0} stroke="#1e2d45" />
              <Bar dataKey="ret_7d" radius={[0, 3, 3, 0]}>
                {sectorData.map((entry, i) => (
                  <Cell key={i} fill={entry.ret_7d >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Alts Table */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Top Altcoins — Performance vs BTC</div>
          <div style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>90d lookback · vs BTC retornos relativos</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['#', 'Ativo', 'Setor', 'M.Cap', 'Ret 7d', 'Ret 30d', 'Ret 90d', 'vs BTC 7d', 'vs BTC 30d'].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 12px', textAlign: i <= 1 ? 'left' : 'right',
                    fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAltcoins.map(alt => (
                <tr key={alt.symbol}
                  style={{ borderBottom: '1px solid rgba(30,45,69,0.4)', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '9px 12px', color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>{alt.rank}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: alt.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{alt.symbol}</div>
                        <div style={{ fontSize: 9, color: '#475569' }}>{alt.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#0d1421', color: '#475569', border: '1px solid #1a2535' }}>{alt.sector}</span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                    ${alt.mcap_b.toFixed(1)}B
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: retColor(alt.ret_7d) }}>
                    {retFmt(alt.ret_7d)}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: retColor(alt.ret_30d) }}>
                    {retFmt(alt.ret_30d)}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: retColor(alt.ret_90d) }}>
                    {retFmt(alt.ret_90d)}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: retColor(alt.vs_btc_7d) }}>
                    {retFmt(alt.vs_btc_7d)}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: retColor(alt.vs_btc_30d) }}>
                    {retFmt(alt.vs_btc_30d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
