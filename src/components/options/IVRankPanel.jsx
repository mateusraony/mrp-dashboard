// ─── IV RANK / IV PERCENTILE PANEL ───────────────────────────────────────────
import { ivRank } from '../../components/data/mockDataExtended';
import { GradeBadge } from '../ui/DataBadge';
import { HelpIcon } from '../ui/Tooltip';
import MiniTimeChart from '../dashboard/MiniTimeChart';

const IVR_ZONES = [
  { min: 0,  max: 25,  label: 'Muito Barata',  color: '#10b981', bg: 'rgba(16,185,129,0.12)', action: 'Comprar volatilidade (long vol)' },
  { min: 25, max: 50,  label: 'Barata',         color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  action: 'Levemente favorável para long vol' },
  { min: 50, max: 75,  label: 'Neutra',         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  action: 'Estratégias direcionais preferíveis' },
  { min: 75, max: 100, label: 'Cara',           color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   action: 'Vender volatilidade (short vol / spreads)' },
];

export default function IVRankPanel() {
  const d = ivRank;
  const zone = IVR_ZONES.find(z => d.iv_rank >= z.min && d.iv_rank < z.max) || IVR_ZONES[2];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderTop: `3px solid ${zone.color}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
          IV Rank / IV Percentile
          <HelpIcon
            title="IV Rank (IVR)"
            content="IVR = (IV atual - IV mínima 52 semanas) / (IV máxima - IV mínima). 0% = IV no mínimo histórico. 100% = IV no máximo histórico. IVR < 25 = vol barata (comprar). IVR > 75 = vol cara (vender). Gauge definitivo de 'volatilidade cara ou barata'."
            width={300}
          />
        </div>
        <GradeBadge grade={d.quality} />
      </div>

      {/* Main value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 40, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: zone.color, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {d.iv_rank.toFixed(1)}
        </span>
        <div>
          <span style={{ fontSize: 12, color: '#64748b' }}>IVR</span>
          <div style={{
            fontSize: 11, fontWeight: 700, color: zone.color,
            background: zone.bg, border: `1px solid ${zone.color}30`,
            borderRadius: 5, padding: '2px 8px', marginTop: 3, display: 'inline-block',
          }}>
            {zone.label}
          </div>
        </div>
      </div>

      {/* IVR gauge bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4,
          background: 'linear-gradient(90deg, #10b981 0%, #60a5fa 25%, #f59e0b 50%, #ef4444 100%)' }}>
          <div style={{
            position: 'absolute', top: -2, left: `${d.iv_rank}%`,
            transform: 'translateX(-50%)',
            width: 6, height: 14, borderRadius: 3, background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
          <span>0 — Muito Barata</span><span>25</span><span>50</span><span>75</span><span>100 — Cara</span>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'IV Atual', value: `${(d.iv_current * 100).toFixed(1)}%`, color: zone.color },
          { label: 'IV Min 52w', value: `${(d.iv_52w_low * 100).toFixed(1)}%`, color: '#10b981' },
          { label: 'IV Max 52w', value: `${(d.iv_52w_high * 100).toFixed(1)}%`, color: '#ef4444' },
          { label: 'IV Percentile', value: `${d.iv_percentile.toFixed(1)}%`, color: '#94a3b8' },
          { label: 'IV Avg 30d', value: `${(d.iv_30d_avg * 100).toFixed(1)}%`, color: '#475569' },
          { label: 'IV Avg 90d', value: `${(d.iv_90d_avg * 100).toFixed(1)}%`, color: '#475569' },
        ].map((item, i) => (
          <div key={i} style={{ background: '#0d1421', borderRadius: 7, padding: '7px 9px', border: '1px solid #1a2535' }}>
            <div style={{ fontSize: 8, color: '#334155', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <MiniTimeChart data={d.history} color={zone.color} height={60} formatter={v => v.toFixed(1) + ' IVR'} />

      {/* Action */}
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 7,
        background: zone.bg, border: `1px solid ${zone.color}25`,
        fontSize: 10, lineHeight: 1.6,
      }}>
        <span style={{ color: zone.color, fontWeight: 700 }}>💡 Estratégia: </span>
        <span style={{ color: '#64748b' }}>{zone.action}. {d.signal}</span>
      </div>
    </div>
  );
}