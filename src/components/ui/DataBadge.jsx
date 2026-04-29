// DataBadge — v2 — shows 🧪 MOCK / 🛰️ LIVE + Grade A/B/C
import { DATA_MODE } from '@/lib/env';

export function ModeBadge({ mode = DATA_MODE }) {
  if (mode === 'live') {
    return (
      <span style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        background: 'rgba(16,185,129,0.1)', color: '#10b981',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: 5, padding: '2px 8px', letterSpacing: '0.06em',
        fontWeight: 600, whiteSpace: 'nowrap',
      }}>
        🛰️ LIVE
      </span>
    );
  }
  return (
    <span style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 5, padding: '2px 8px', letterSpacing: '0.06em',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      🧪 MOCK
    </span>
  );
}

export function GradeBadge({ grade }) {
  const styles = {
    A: { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.25)', label: 'A' },
    B: { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.25)', label: '🟡 B' },
    C: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.25)',  label: '🔴 C' },
  };
  const s = styles[grade] || styles['C'];
  return (
    <span style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 5, padding: '2px 7px', letterSpacing: '0.05em',
      fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export function SourceRow({ source }) {
  const gradeColor = source.grade === 'A' ? '#10b981' : source.grade === 'B' ? '#f59e0b' : '#ef4444';
  const hasFails = source.fail_count_24h > 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 16px',
      borderBottom: '1px solid rgba(26,37,53,0.8)',
      transition: 'background 0.15s',
    }}>
      {/* Source name + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: hasFails ? '#ef4444' : '#10b981',
          boxShadow: hasFails ? '0 0 6px #ef4444' : '0 0 6px #10b98188',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
          color: '#64748b', fontWeight: 500,
        }}>
          {source.source}
        </span>
      </div>

      {/* Right side stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {source.latency_ms && (
          <span style={{ fontSize: 10, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
            {source.latency_ms}ms
          </span>
        )}
        {source.staleness_sec && (
          <span style={{ fontSize: 10, color: '#334155' }}>
            {source.staleness_sec < 60 ? `${source.staleness_sec}s` : `${Math.round(source.staleness_sec / 60)}m`} ago
          </span>
        )}
        {hasFails && (
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
            {source.fail_count_24h}✕
          </span>
        )}
        <GradeBadge grade={source.grade} />
      </div>
    </div>
  );
}