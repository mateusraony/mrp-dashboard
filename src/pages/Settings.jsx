import { useState } from 'react';
import { THRESHOLDS, sourceHealth } from '../components/data/mockData';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';

function SettingRow({ label, value, description, type = 'text', options }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0',
      borderBottom: '1px solid rgba(30,45,69,0.5)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: '#4a5568' }}>{description}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {type === 'select' ? (
          <select value={v} onChange={e => setV(e.target.value)} style={{
            background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
            color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'toggle' ? (
          <div
            onClick={() => setV(v => !v)}
            style={{
              width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
              background: v ? '#3b82f6' : '#1e2d45',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: v ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
        ) : (
          <input
            type={type}
            value={v}
            onChange={e => setV(e.target.value)}
            style={{
              background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
              color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace', width: 120,
            }}
          />
        )}
        <button
          onClick={handleSave}
          style={{
            background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)',
            color: saved ? '#10b981' : '#60a5fa',
            border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.25)'}`,
            borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {saved ? '✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d45',
      borderRadius: 12, padding: '16px 20px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

export default function Settings() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Settings
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: '#4a5568', margin: 0 }}>
            Configuration · Persistent via Supabase ·
          </p>
          <ModeBadge />
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>POST /admin/settings</span>
        </div>
      </div>

      {/* Auth note */}
      <div style={{
        marginBottom: 16, padding: '10px 14px',
        background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8, fontSize: 11, color: '#4a5568',
      }}>
        <strong style={{ color: '#f59e0b' }}>Security:</strong>{' '}
        In production, /admin/settings requires header{' '}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>X-TICK-TOKEN</span>.
        Changes are persisted to Supabase <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>settings</span> table.
      </div>

      {/* Data Mode */}
      <Section title="📡 Data Mode">
        <SettingRow
          label="DATA_MODE"
          value="mock"
          type="select"
          options={['mock', 'live']}
          description="Switch between mock data and live API calls"
        />
        <SettingRow
          label="CRYPTO_SYMBOLS"
          value="BTCUSDT"
          description="Comma-separated symbols to monitor (Binance USDⓈ-M Futures)"
        />
      </Section>

      {/* Modules */}
      <Section title="🔧 Module Toggles">
        {[
          ['ENABLE_OPTIONS', true, 'Deribit options data (IV, skew, smile)'],
          ['ENABLE_SPOT_FLOW', true, 'Binance Spot CVD and taker flow'],
          ['ENABLE_ONCHAIN', true, 'mempool.space on-chain data'],
          ['ENABLE_NEWS', true, 'GDELT news feed'],
          ['ENABLE_FEAR_GREED', true, 'Alternative.me Fear & Greed Index'],
          ['ENABLE_COINMETRICS', false, 'CoinMetrics community (optional, may be slow)'],
        ].map(([k, v, d]) => (
          <SettingRow key={k} label={k} value={v} type="toggle" description={d} />
        ))}
      </Section>

      {/* Reports */}
      <Section title="📨 Reports & Telegram">
        <SettingRow
          label="REPORT_TIMES"
          value="08:00,21:00"
          description="Daily report times in BRT (comma-separated HH:MM)"
        />
        <SettingRow
          label="TELEGRAM_CHAT_ID"
          value="[hidden]"
          type="password"
          description="Telegram chat/channel ID"
        />
        <SettingRow
          label="TIMEZONE"
          value="America/Sao_Paulo"
          description="System timezone for scheduling"
        />
      </Section>

      {/* Thresholds */}
      <Section title="⚡ Alert Thresholds">
        {Object.entries(THRESHOLDS).map(([k, v]) => (
          <SettingRow
            key={k}
            label={k}
            value={String(v)}
            type="number"
            description={
              k === 'RISK_ALERT_SCORE' ? 'Score to trigger SQUEEZE/FLUSH alerts' :
              k === 'GLOBAL_RISKOFF_SCORE' ? 'Global score below this = RISK-OFF alert' :
              k === 'GLOBAL_RISKON_SCORE' ? 'Global score above this = RISK-ON alert' :
              k === 'MACRO_EVENT_LEAD_HOURS' ? 'Hours before Tier-1 event to alert' :
              k === 'EVAL_WINDOW_MIN' ? 'Window to evaluate alert outcome (minutes)' :
              k === 'FUNDING_REF' ? 'Funding rate normalization reference' :
              k === 'OI_REF_PCT' ? 'OI delta % normalization reference' :
              undefined
            }
          />
        ))}
      </Section>

      {/* FRED Series */}
      <Section title="📊 FRED Macro Series">
        <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 10 }}>
          FRED series IDs fetched daily. Data is not intraday.
        </div>
        {[
          ['SP500', 'SP500', 'S&P 500 Index'],
          ['USD_INDEX', 'DTWEXBGS', 'USD Broad Index (proxy DXY)'],
          ['GOLD', 'GOLDAMGBD228NLBM', 'Gold USD LBMA AM'],
          ['VIX', 'VIXCLS', 'CBOE VIX'],
          ['US10Y', 'DGS10', 'US 10-Year Treasury Yield'],
          ['US2Y', 'DGS2', 'US 2-Year Treasury Yield'],
        ].map(([k, v, d]) => (
          <SettingRow key={k} label={k} value={v} description={d} />
        ))}
      </Section>

      {/* Source health read-only */}
      <div style={{
        background: '#111827', border: '1px solid #1e2d45',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📡 Source Health (read-only)</div>
        </div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Source</th>
              <th style={{ textAlign: 'right' }}>Latency</th>
              <th style={{ textAlign: 'right' }}>Staleness</th>
              <th style={{ textAlign: 'right' }}>Fail 24h</th>
              <th style={{ textAlign: 'right' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {sourceHealth.map(s => (
              <tr key={s.source}>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>{s.source}</td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#4a5568' }}>
                  {s.latency_ms ? `${s.latency_ms}ms` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#4a5568' }}>
                  {s.staleness_sec ? (s.staleness_sec < 60 ? `${s.staleness_sec}s` : `${Math.round(s.staleness_sec/60)}m`) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: s.fail_count_24h > 0 ? '#ef4444' : '#4a5568' }}>
                  {s.fail_count_24h}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <GradeBadge grade={s.grade} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}