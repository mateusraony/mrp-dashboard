// Reusable metric card — v2 with directional state and visual richness
export default function MetricCard({ label, value, delta, deltaLabel, unit, subValue, highlight, size = 'md', quality, valueColor, style: extraStyle }) {
  const deltaPos = delta > 0;
  const deltaColor = delta === undefined || delta === null ? '#64748b'
    : delta === 0 ? '#64748b'
    : deltaPos ? '#10b981' : '#ef4444';

  const valueFinalColor = valueColor || '#f1f5f9';

  const sizes = {
    sm: { value: 17, label: 10, sub: 10, padding: '12px 14px' },
    md: { value: 22, label: 11, sub: 11, padding: '16px 18px' },
    lg: { value: 30, label: 12, sub: 12, padding: '20px 22px' },
  };
  const sz = sizes[size] || sizes.md;

  // Directional tint on the card background
  const tintBg = deltaPos === true && delta > 0
    ? 'rgba(16,185,129,0.03)'
    : delta < 0 ? 'rgba(239,68,68,0.03)' : 'transparent';

  const leftBorderColor = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : highlight ? '#3b82f6' : '#1e2d45';

  return (
    <div style={{
      background: `linear-gradient(135deg, #131e2e 0%, #111827 100%)`,
      backgroundBlendMode: 'overlay',
      border: '1px solid #1e2d45',
      borderLeft: `3px solid ${leftBorderColor}`,
      borderRadius: 10,
      padding: sz.padding,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.3s ease',
      ...extraStyle,
    }}>
      {/* Subtle top accent for highlighted */}
      {highlight && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          opacity: 0.8,
        }} />
      )}

      {/* Label */}
      <div style={{
        fontSize: sz.label,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 7,
        fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {label}
        {quality === 'B' && <span style={{ color: '#f59e0b', fontSize: 9 }}>●</span>}
        {quality === 'C' && <span style={{ color: '#ef4444', fontSize: 9 }}>●</span>}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{
          fontSize: sz.value,
          fontWeight: 800,
          fontFamily: 'JetBrains Mono, monospace',
          color: valueFinalColor,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{ fontSize: sz.label + 1, color: '#475569', fontWeight: 500 }}>{unit}</span>
        )}
      </div>

      {/* Delta / sub */}
      {(delta !== undefined || subValue) && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          {delta !== undefined && delta !== null && (
            <span style={{
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              color: deltaColor,
              fontWeight: 600,
              background: delta > 0 ? 'rgba(16,185,129,0.1)' : delta < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
              padding: '2px 6px',
              borderRadius: 4,
            }}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '▸'} {Math.abs(delta).toFixed(2)}{deltaLabel || '%'}
            </span>
          )}
          {subValue && (
            <span style={{ fontSize: sz.sub, color: '#475569' }}>{subValue}</span>
          )}
        </div>
      )}
    </div>
  );
}