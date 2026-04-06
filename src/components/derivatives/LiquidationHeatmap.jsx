// ─── LIQUIDATION HEATMAP COMPONENT ───────────────────────────────────────────
// Visualiza clusters de liquidação por faixa de preço
import { liquidationClusters } from '../../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../ui/DataBadge';

function fmt(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

export default function LiquidationHeatmap() {
  const d = liquidationClusters;
  const allItems = d.clusters;
  const maxLong = Math.max(...allItems.map(c => c.longs_usd));
  const maxShort = Math.max(...allItems.map(c => c.shorts_usd));
  const maxVal = Math.max(maxLong, maxShort);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 14, padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Liquidation Clusters</div>
            <ModeBadge mode="mock" />
            <GradeBadge grade={d.quality} />
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            Onde estão as ordens de liquidação acumuladas · Spot: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>${d.spot.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '3px 8px' }}>
            ■ Longs em Risco
          </span>
          <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 5, padding: '3px 8px' }}>
            ■ Shorts em Risco
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        {allItems.map((cluster, i) => {
          const isAboveSpot = cluster.price > d.spot;
          const isSpotLevel = Math.abs(cluster.price - d.spot) < 200;
          const longPct = (cluster.longs_usd / maxVal) * 100;
          const shortPct = (cluster.shorts_usd / maxVal) * 100;
          const displayVal = isAboveSpot ? cluster.shorts_usd : cluster.longs_usd;
          const displayPct = isAboveSpot ? shortPct : longPct;
          const color = isAboveSpot ? '#10b981' : '#ef4444';
          const intensity = Math.min(0.9, 0.2 + (displayPct / 100) * 0.7);

          return (
            <div key={cluster.price} style={{ marginBottom: 4, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Price label */}
                <div style={{
                  width: 80, textAlign: 'right', flexShrink: 0,
                  fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                  color: isSpotLevel ? '#60a5fa' : '#475569',
                  fontWeight: isSpotLevel ? 700 : 400,
                }}>
                  ${(cluster.price / 1000).toFixed(0)}K
                  {isSpotLevel && <span style={{ fontSize: 9, color: '#60a5fa', marginLeft: 4 }}>← SPOT</span>}
                </div>

                {/* Bar */}
                <div style={{ flex: 1, position: 'relative', height: 20 }}>
                  {/* Background */}
                  <div style={{
                    height: '100%', borderRadius: 3, background: '#0d1421',
                    border: isSpotLevel ? '1px solid rgba(59,130,246,0.3)' : '1px solid #0d1421',
                  }} />
                  {/* Fill */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    height: '100%', borderRadius: 3,
                    width: `${displayPct}%`,
                    background: `rgba(${isAboveSpot ? '16,185,129' : '239,68,68'}, ${intensity})`,
                    transition: 'width 0.5s ease',
                    boxShadow: displayPct > 60 ? `0 0 8px rgba(${isAboveSpot ? '16,185,129' : '239,68,68'}, 0.4)` : 'none',
                  }} />
                  {/* Value label inside bar */}
                  {displayPct > 20 && (
                    <div style={{
                      position: 'absolute', top: '50%', left: 8,
                      transform: 'translateY(-50%)',
                      fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
                      color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                    }}>
                      {fmt(displayVal)}
                    </div>
                  )}
                </div>

                {/* Value outside */}
                {displayPct <= 20 && (
                  <div style={{
                    width: 70, fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
                    color, fontWeight: 600,
                  }}>
                    {fmt(displayVal)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Spot line indicator */}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e2d45', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', flexWrap: 'wrap', gap: 4 }}>
          <span>Longs em risco se -10%: <span style={{ color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>${(d.total_longs_at_risk_10pct / 1e9).toFixed(2)}B</span></span>
          <span>Shorts em risco se +10%: <span style={{ color: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>${(d.total_shorts_at_risk_10pct / 1e9).toFixed(2)}B</span></span>
        </div>
      </div>
    </div>
  );
}