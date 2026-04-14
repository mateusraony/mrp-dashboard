/**
 * AlertAuditPanel.jsx — Painel de auditoria de alertas e rastreio de thresholds
 *
 * Sprint 6.5 — Governance Pack
 * Exibe: feed de disparos recentes + histórico de mudanças de limiar.
 */

import { useState } from 'react';
import { useAlertEvents, useThresholdHistory } from '@/hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_COLOR = {
  binance:     '#f59e0b',
  coinmetrics: '#10b981',
  fred:        '#60a5fa',
  deribit:     '#a78bfa',
  system:      '#64748b',
};

function sourceColor(src) {
  return SOURCE_COLOR[src] ?? '#94a3b8';
}

function fmtTime(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return iso; }
}

function fmtVal(v) {
  if (typeof v !== 'number') return String(v);
  if (Math.abs(v) < 0.1) return v.toFixed(4);
  if (Math.abs(v) < 10)  return v.toFixed(3);
  return v.toFixed(2);
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EventRow({ ev }) {
  const color = sourceColor(ev.source);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      gap: 8,
      alignItems: 'center',
      padding: '9px 14px',
      borderBottom: '1px solid #162032',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
          {ev.rule_label}
        </div>
        <div style={{ fontSize: 10, color: '#4a5568' }}>
          {ev.condition} · valor:{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>
            {fmtVal(ev.value_at_fire)}
          </span>
          {' '}/ limiar:{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {fmtVal(ev.threshold)}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: 9, padding: '2px 6px', borderRadius: 4,
        background: `${color}18`, color, border: `1px solid ${color}40`,
        fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap',
      }}>
        {ev.source}
      </span>
      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>
        DISPAROU
      </span>
      <span style={{ fontSize: 10, color: '#4a5568', whiteSpace: 'nowrap' }}>
        {fmtTime(ev.fired_at)}
      </span>
    </div>
  );
}

function ThresholdRow({ ch }) {
  const delta = ch.new_value - ch.old_value;
  const up    = delta > 0;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      gap: 8,
      alignItems: 'center',
      padding: '9px 14px',
      borderBottom: '1px solid #162032',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
          {ch.rule_label}
        </div>
        <div style={{ fontSize: 10, color: '#4a5568' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {fmtVal(ch.old_value)}
          </span>
          {' → '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: up ? '#f59e0b' : '#10b981' }}>
            {fmtVal(ch.new_value)}
          </span>
          {' '}
          <span style={{ color: up ? '#f59e0b' : '#10b981' }}>
            ({up ? '+' : ''}{fmtVal(delta)})
          </span>
        </div>
      </div>
      <span style={{
        fontSize: 9, padding: '2px 6px', borderRadius: 4,
        background: 'rgba(100,116,139,0.15)', color: '#94a3b8',
        border: '1px solid #1e2d45', fontFamily: 'JetBrains Mono, monospace',
      }}>
        {ch.changed_by}
      </span>
      <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, whiteSpace: 'nowrap' }}>
        LIMIAR
      </span>
      <span style={{ fontSize: 10, color: '#4a5568', whiteSpace: 'nowrap' }}>
        {fmtTime(ch.changed_at)}
      </span>
    </div>
  );
}

// ─── Painel principal ─────────────────────────────────────────────────────────

export function AlertAuditPanel() {
  const [view, setView] = useState('events'); // 'events' | 'thresholds'
  const { data: events = [],     isLoading: evLoading     } = useAlertEvents(30);
  const { data: thresholds = [], isLoading: thLoading     } = useThresholdHistory();

  const isLoading = view === 'events' ? evLoading : thLoading;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
            Auditoria &amp; Governança
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            Rastreio de disparos · Histórico de limiares · Lineage de dados
          </div>
        </div>
        <div style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 4,
          background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
          border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'JetBrains Mono, monospace',
        }}>
          Sprint 6.5 — Governance
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #162032' }}>
        {[
          { id: 'events',     label: `Disparos (${events.length})` },
          { id: 'thresholds', label: `Limiares (${thresholds.length})` },
          { id: 'lineage',    label: 'Data Lineage' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              padding: '7px 14px', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: view === t.id ? 700 : 400, background: 'transparent',
              color: view === t.id ? '#60a5fa' : '#475569',
              borderBottom: view === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed de Disparos */}
      {view === 'events' && (
        <div style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto auto',
            gap: 8, padding: '8px 14px', background: '#070B14',
            fontSize: 10, color: '#2a3f5f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px solid #162032',
          }}>
            <span>Regra</span>
            <span>Fonte</span>
            <span>Status</span>
            <span>Quando</span>
          </div>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#4a5568', fontSize: 12 }}>
              Carregando eventos...
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#4a5568', fontSize: 12 }}>
              Nenhum evento registrado ainda.
            </div>
          ) : (
            events.map((ev, i) => <EventRow key={ev.id ?? i} ev={ev} />)
          )}
        </div>
      )}

      {/* Histórico de Limiares */}
      {view === 'thresholds' && (
        <div style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto auto',
            gap: 8, padding: '8px 14px', background: '#070B14',
            fontSize: 10, color: '#2a3f5f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px solid #162032',
          }}>
            <span>Regra</span>
            <span>Por</span>
            <span>Tipo</span>
            <span>Quando</span>
          </div>
          {thLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#4a5568', fontSize: 12 }}>
              Carregando histórico...
            </div>
          ) : thresholds.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#4a5568', fontSize: 12 }}>
              Nenhuma mudança de limiar registrada.
            </div>
          ) : (
            thresholds.map((ch, i) => <ThresholdRow key={ch.id ?? i} ch={ch} />)
          )}
        </div>
      )}

      {/* Data Lineage */}
      {view === 'lineage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { source: 'Binance Futures', endpoint: '/fapi/v1/forceOrders, /fapi/v1/fundingRate', feeds: 'Liquidações, Funding Rate, OI', latency: '<5s', key: false, quality: 'A' },
            { source: 'CoinMetrics Community', endpoint: '/v4/timeseries/asset-metrics', feeds: 'MVRV, NUPL, CDD, HODL, Dormancy', latency: '~1h', key: false, quality: 'A' },
            { source: 'FRED API', endpoint: '/series/observations', feeds: 'WALCL, RRPONTSYD, WTREGEN, DFII10', latency: '~4h', key: true, quality: 'A' },
            { source: 'Mempool.space', endpoint: '/api/v1/mining/hashrate, /api/mempool', feeds: 'Hashrate, Mempool, Fees', latency: '<30s', key: false, quality: 'A' },
            { source: 'Bybit V5', endpoint: '/v5/market/tickers, /v5/market/funding/history', feeds: 'Funding, Mark Price, OI', latency: '<30s', key: false, quality: 'A' },
            { source: 'OKX V5', endpoint: '/api/v5/public/funding-rate, /v5/market/ticker', feeds: 'Funding, Preço', latency: '<30s', key: false, quality: 'A' },
            { source: 'Alternative.me', endpoint: '/fng/', feeds: 'Fear & Greed Index', latency: '~1h', key: false, quality: 'B' },
            { source: 'Deribit', endpoint: '/api/v2/public/*', feeds: 'IV ATM, Term Structure, Options', latency: '<30s', key: false, quality: 'A' },
            { source: 'Supabase', endpoint: 'gvhkjfsngxrnjavstsju.supabase.co', feeds: 'Alert Rules, Portfolio, Settings', latency: '<500ms', key: true, quality: 'A' },
          ].map(row => (
            <div key={row.source} style={{
              background: '#0d1421', border: '1px solid #162032', borderRadius: 8,
              padding: '10px 14px', display: 'grid',
              gridTemplateColumns: '160px 1fr auto auto',
              gap: 12, alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{row.source}</div>
                <div style={{ fontSize: 9, color: '#4a5568', marginTop: 2, display: 'flex', gap: 6 }}>
                  {row.key && (
                    <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>🔑 key</span>
                  )}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>⚡ {row.latency}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{row.feeds}</div>
                <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.endpoint}
                </div>
              </div>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 4,
                background: row.quality === 'A' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                color: row.quality === 'A' ? '#10b981' : '#f59e0b',
                border: `1px solid ${row.quality === 'A' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
              }}>
                {row.quality}
              </span>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#10b981', boxShadow: '0 0 4px #10b981',
                display: 'inline-block',
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
