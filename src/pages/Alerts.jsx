import { recentAlerts, globalRisk } from '../components/data/mockData';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { formatDistanceToNow } from 'date-fns';

const typeConfig = {
  RISK_ON:      { emoji: '🟢', color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  RISK_OFF:     { emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  SQUEEZE_WATCH:{ emoji: '⚡', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  FLUSH_RISK:   { emoji: '🌊', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  MACRO_EVENT:  { emoji: '📅', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  OPTIONS_VOL:  { emoji: '📊', color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
};

function AlertDetail({ alert }) {
  const c = typeConfig[alert.type] || typeConfig.MACRO_EVENT;

  return (
    <div style={{
      background: '#111827',
      border: `1px solid ${c.border}`,
      borderRadius: 12, padding: '16px 18px', marginBottom: 12,
      borderLeft: `3px solid ${c.color}`,
    }}>
      {/* Line 1: emoji + title + badges */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>{c.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            {alert.title}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#4a5568', flexShrink: 0 }}>
          {formatDistanceToNow(alert.created_at, { addSuffix: true })}
        </div>
      </div>

      {/* Line 2: badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <ModeBadge mode="mock" />
        <GradeBadge grade={alert.grade} />
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 4,
          background: c.bg, color: c.color, border: `1px solid ${c.border}`,
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
        }}>{alert.type}</span>
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 4,
          background: '#0D1421', color: '#4a5568',
          border: '1px solid #1e2d45',
          fontFamily: 'JetBrains Mono, monospace',
        }}>{alert.asset}</span>
      </div>

      {/* Line 3: Score / Prob / Conf */}
      <div style={{
        display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10,
        padding: '8px 12px', borderRadius: 8,
        background: '#0D1421', border: '1px solid #1e2d45',
      }}>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>SCORE</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: c.color }}>
            {alert.score}
            <span style={{ fontSize: 11, color: '#4a5568', fontWeight: 400 }}>/100</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>PROB</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
            {Math.round(alert.prob * 100)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>CONF</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>
            {Math.round(alert.conf * 100)}%
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {/* Score bar */}
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 4 }}>RISK BAR</div>
          <div style={{ height: 6, width: 120, borderRadius: 3, background: '#1e2d45' }}>
            <div style={{
              height: '100%', borderRadius: 3, width: `${alert.score}%`,
              background: c.color, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Metrics */}
      {Object.keys(alert.metrics).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(alert.metrics).map(([k, v]) => (
            <div key={k} style={{
              background: '#0D1421', border: '1px solid #1e2d45',
              borderRadius: 6, padding: '6px 10px',
            }}>
              <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#8899a6', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer: run_id + dedupe + cooldown */}
      <div style={{ borderTop: '1px solid #1e2d45', paddingTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f' }}>
          run: {alert.run_id}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f' }}>
          cooldown: {alert.cooldown_min}min
        </span>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          key: {alert.dedupe_key}
        </span>
      </div>
    </div>
  );
}

export default function Alerts() {
  const allAlertTypes = Object.entries(typeConfig);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Alerts
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3 }}>
          Telegram alerts · Deduplicated · Anti-spam cooldown · <ModeBadge />
        </p>
      </div>

      {/* Alert types reference */}
      <div style={{
        marginBottom: 20, background: '#111827', border: '1px solid #1e2d45',
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Alert Types
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allAlertTypes.map(([type, c]) => (
            <div key={type} style={{
              padding: '4px 10px', borderRadius: 6,
              background: c.bg, color: c.color, border: `1px solid ${c.border}`,
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            }}>
              {c.emoji} {type}
            </div>
          ))}
        </div>
      </div>

      {/* Current global state */}
      <div style={{
        marginBottom: 20, padding: '12px 16px',
        background: globalRisk.regime === 'NEUTRAL' ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, marginBottom: 4 }}>
          Current Global State: {globalRisk.regime} · Score {globalRisk.score}/100 · Prob {globalRisk.prob}%
        </div>
        <div style={{ fontSize: 11, color: '#4a5568' }}>
          {globalRisk.score >= 65
            ? 'RISK-ON threshold not reached — no RISK-ON alert triggered'
            : globalRisk.score <= 35
            ? '🔴 RISK-OFF threshold reached — alert would be triggered'
            : 'Neutral zone — monitoring for threshold crossings'}{' '}
          (RISKON ≥ 65, RISKOFF ≤ 35)
        </div>
      </div>

      {/* Alert list */}
      <SectionHeader title="Recent Alerts" subtitle="Last cycle" icon="◎" />
      {recentAlerts.map(a => <AlertDetail key={a.id} alert={a} />)}

      {/* Cooldown note */}
      <div style={{
        marginTop: 16, padding: '10px 14px',
        background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)',
        borderRadius: 8, fontSize: 11, color: '#4a5568',
      }}>
        <strong style={{ color: '#60a5fa' }}>Deduplication:</strong>{' '}
        Each alert has a <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>dedupe_key</span>{' '}
        = (alert_type + asset + reason_bucket). Cooldown default 60min prevents spam.
        Beta-Bernoulli calibration adjusts probability over time based on outcomes.
      </div>
    </div>
  );
}