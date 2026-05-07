// ─── ALTCOINS — Dominância · Rotação · Alt Season ─────────────────────────────
import { useAltcoinsData } from '../hooks/useAltcoins';
import { useDominance } from '../hooks/useBtcData';
import { SECTOR_MAP } from '../services/altcoins';
import { IS_LIVE } from '../lib/env';
import { ModeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ─── Static config ────────────────────────────────────────────────────────────
const SEASON_PHASES = [
  { label: 'Alt Season', range: '75-100', color: '#10b981', desc: '75%+ das alts superam BTC em 90d' },
  { label: 'Neutro',     range: '25-74',  color: '#f59e0b', desc: 'Mercado sem tendência clara' },
  { label: 'BTC Season', range: '0-24',   color: '#3b82f6', desc: 'BTC dominando retornos' },
];

const COIN_COLORS = {
  ETH: '#627eea', SOL: '#9945ff', BNB: '#f0b90b', XRP: '#008cff',
  ADA: '#0033ad', AVAX: '#e84142', DOT: '#e6007a', MATIC: '#8247e5',
  LINK: '#2a5ada', UNI: '#ff007a', ATOM: '#6f4cff', NEAR: '#00ec97',
  OP: '#ff0420', ARB: '#12aaff', DOGE: '#c2a633', SHIB: '#ffa409',
  LDO: '#00a3ff', APT: '#3ddfcd', SUI: '#4da2ff', TON: '#0088cc',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function retColor(v) { return v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#64748b'; }
function retFmt(v)   { return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`; }

// ─── ALT SEASON GAUGE ─────────────────────────────────────────────────────────
function AltSeasonGauge({ index }) {
  const { value, phase, signal, alts_above_btc, total_alts } = index;
  const cfg = value >= 75 ? SEASON_PHASES[0] : value >= 25 ? SEASON_PHASES[1] : SEASON_PHASES[2];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: `1px solid ${cfg.color}30`, borderRadius: 14, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>
            Alt Season Index
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: cfg.color, lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, marginTop: 4 }}>{cfg.label}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 4 }}>Acima do BTC</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: cfg.color }}>
            {alts_above_btc}/{total_alts}
          </div>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>alts superam BTC em 90d</div>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 6 }}>
        <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(90deg, #3b82f6 0%, #f59e0b 50%, #10b981 100%)' }} />
        <div style={{
          position: 'absolute', top: -4, left: `${value}%`, transform: 'translateX(-50%)',
          width: 4, height: 20, borderRadius: 2, background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.6)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155', marginBottom: 12 }}>
        <span>0 — BTC Season</span><span>50 — Mixed</span><span>100 — Alt Season</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {SEASON_PHASES.map(p => {
          const active = (phase === 'altseason' && p.label === 'Alt Season') ||
                         (phase === 'bitcoin' && p.label === 'BTC Season') ||
                         (phase === 'neutral' && p.label === 'Neutro');
          return (
            <div key={p.label} style={{
              background: active ? `${p.color}10` : '#0a1018',
              border: `1px solid ${active ? p.color + '40' : '#0f1d2e'}`,
              borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: p.color, marginBottom: 3 }}>{p.label} ({p.range})</div>
              <div style={{ fontSize: 8, color: '#334155', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, padding: '7px 10px', borderRadius: 6, background: `${cfg.color}08`, border: `1px solid ${cfg.color}20`, fontSize: 10, color: cfg.color }}>
        {signal}
      </div>
    </div>
  );
}

// ─── DOMINANCE CARD ───────────────────────────────────────────────────────────
function DominanceCard({ label, value, color }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>{label} Dominance</div>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1 }}>
        {(value ?? 0).toFixed(1)}%
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Altcoins() {
  const { data, isLoading } = useAltcoinsData(50);
  const { data: dominance } = useDominance();

  if (isLoading || !data) {
    return <div style={{ color: '#475569', fontSize: 12, padding: 24 }}>Carregando dados de altcoins...</div>;
  }

  const { altSeasonIndex, sectorRotation, alts, btcRet7d, btcRet30d } = data;

  const tableAlts = alts
    .filter(a => a.symbol !== 'BTC')
    .slice(0, 30)
    .map((a, i) => ({
      rank:       i + 1,
      symbol:     a.symbol,
      name:       a.name,
      color:      COIN_COLORS[a.symbol] ?? '#64748b',
      sector:     SECTOR_MAP[a.symbol] ?? 'Other',
      mcap_b:     a.market_cap / 1e9,
      ret_7d:     a.price_change_percentage_7d,
      ret_30d:    a.price_change_percentage_30d,
      ret_90d:    a.price_change_percentage_90d,
      vs_btc_7d:  a.price_change_percentage_7d  - btcRet7d,
      vs_btc_30d: a.price_change_percentage_30d - btcRet30d,
    }));

  const domData = [
    { name: 'BTC',    value: dominance?.btc_dominance    ?? 0, fill: '#f59e0b' },
    { name: 'ETH',    value: dominance?.eth_dominance    ?? 0, fill: '#627eea' },
    { name: 'Others', value: dominance?.others_dominance ?? 0, fill: '#475569' },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Altcoins & Rotação</h1>
          <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
          {(!IS_LIVE || !data) && <DataTrustBadge mode="mock" confidence="D" source="Demo" reason="Alt Season Index simulado — dados estáticos de exemplo" />}
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Alt Season Index · BTC/ETH Dominância · Top Alts vs BTC · Rotação Setorial
        </p>
      </div>

      {/* Row 1: Gauge + Dominance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, marginBottom: 16 }}>
        <AltSeasonGauge index={altSeasonIndex} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <DominanceCard label="BTC" value={dominance?.btc_dominance} color="#f59e0b" />
          <DominanceCard label="ETH" value={dominance?.eth_dominance} color="#627eea" />
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px', flex: 1 }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 700 }}>Outperformers</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#64748b', lineHeight: 1 }}>
              {altSeasonIndex.alts_above_btc}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>de {altSeasonIndex.total_alts} alts superam BTC em 90d</div>
          </div>
        </div>
      </div>

      {/* Row 2: Dominance dist + Sector Rotation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Dominância — Distribuição Atual</div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12 }}>BTC · ETH · Others</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={domData} layout="vertical" margin={{ top: 4, right: 60, left: 40, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 8, fill: '#334155' }} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 65]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, borderRadius: 6 }} formatter={v => [`${Number(v).toFixed(2)}%`, 'Dominância']} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {domData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Rotação Setorial — 7d</div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12 }}>Retorno ponderado por market cap</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sectorRotation} layout="vertical" margin={{ top: 4, right: 50, left: 40, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 8, fill: '#334155' }} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, borderRadius: 6 }} formatter={v => [`${Number(v).toFixed(1)}%`, 'Retorno 7d']} />
              <ReferenceLine x={0} stroke="#1e2d45" />
              <Bar dataKey="ret_7d" radius={[0, 3, 3, 0]}>
                {sectorRotation.map((s, i) => <Cell key={i} fill={s.ret_7d >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
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
                  <th key={i} style={{ padding: '9px 12px', textAlign: i <= 1 ? 'left' : 'right', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableAlts.map(alt => (
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
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>${alt.mcap_b.toFixed(1)}B</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: retColor(alt.ret_7d) }}>{retFmt(alt.ret_7d)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: retColor(alt.ret_30d) }}>{retFmt(alt.ret_30d)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: retColor(alt.ret_90d) }}>{retFmt(alt.ret_90d)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: retColor(alt.vs_btc_7d) }}>{retFmt(alt.vs_btc_7d)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: retColor(alt.vs_btc_30d) }}>{retFmt(alt.vs_btc_30d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
