// ─── FONTES DE DADOS — Auditoria de Confiabilidade ────────────────────────────
// Tabela completa de todos os serviços: modo, confiança, limitações, status atual
import { useState } from 'react';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { SOURCE_REGISTRY, getRuntimeMode, getSourceSummary } from '@/utils/dataStatus';
import { DATA_MODE } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';

// ─── Legenda de grades ────────────────────────────────────────────────────────
const CONFIDENCE_LABELS = {
  A: { label: 'A — Excelente', desc: 'Fonte oficial, atualização frequente, sem proxy', color: '#10b981' },
  B: { label: 'B — Bom',       desc: 'Cálculo derivado ou atualização lenta (daily)', color: '#f59e0b' },
  C: { label: 'C — Estimado',  desc: 'Proxy ou correlação — não fonte direta',         color: '#f97316' },
  D: { label: 'D — Baixo',     desc: 'Mock, pago indisponível ou erro de API',         color: '#ef4444' },
};

const MODE_LABELS = {
  live:          { label: 'LIVE',          desc: 'API pública real funcionando',              color: '#10b981' },
  mock:          { label: 'MOCK',          desc: 'Dado de demonstração (DATA_MODE=mock)',     color: '#f59e0b' },
  estimated:     { label: 'ESTIMADO',      desc: 'Cálculo ou proxy — não fonte oficial direta', color: '#3b82f6' },
  paid_required: { label: 'PAGO',          desc: 'Requer assinatura de API paga',             color: '#f97316' },
  error:         { label: 'ERRO',          desc: 'Falha ao buscar ou key ausente',             color: '#ef4444' },
};

// ─── Componente de linha da tabela ────────────────────────────────────────────
function SourceRow({ serviceKey, entry }) {
  const runtimeMode = getRuntimeMode(serviceKey);
  const conf = entry.staticConfidence;

  return (
    <tr style={{ borderBottom: '1px solid #162032' }}>
      {/* Serviço */}
      <td style={{ padding: '11px 14px', fontSize: 12, color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {entry.name}
      </td>

      {/* Fonte + URL */}
      <td style={{ padding: '11px 14px', fontSize: 11, color: '#64748b' }}>
        {entry.url ? (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#60a5fa', textDecoration: 'none' }}
          >
            {entry.url.replace('https://', '').split('/')[0]} ↗
          </a>
        ) : (
          <span style={{ color: '#334155' }}>N/A</span>
        )}
      </td>

      {/* Gratuita? */}
      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          color: entry.free ? '#10b981' : '#ef4444',
        }}>
          {entry.free ? 'SIM' : 'NÃO'}
        </span>
      </td>

      {/* Auth? */}
      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          color: entry.authRequired ? '#f59e0b' : '#64748b',
        }}>
          {entry.authRequired ? '🔑 SIM' : '—'}
        </span>
      </td>

      {/* Frequência */}
      <td style={{ padding: '11px 14px', fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
        {entry.updateFrequency}
      </td>

      {/* Limitação */}
      <td style={{ padding: '11px 14px', fontSize: 10, color: '#475569', maxWidth: 200 }}>
        {entry.limitation ?? <span style={{ color: '#2a3f5f' }}>—</span>}
      </td>

      {/* Confiança */}
      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
          color: CONFIDENCE_LABELS[conf]?.color ?? '#64748b',
        }}>
          {conf}
        </span>
      </td>

      {/* Status atual */}
      <td style={{ padding: '11px 14px' }}>
        <DataTrustBadge
          mode={runtimeMode}
          confidence={conf}
          source={entry.name}
          sourceUrl={entry.url || undefined}
          reason={
            runtimeMode === 'error' && serviceKey === 'fred' && !isSupabaseConfigured()
              ? 'FRED_API_KEY não configurada em Supabase Secrets'
              : runtimeMode === 'mock'
              ? 'DATA_MODE=mock'
              : entry.limitation
          }
        />
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DataSources() {
  const [filterMode, setFilterMode] = useState('all');
  const summary = getSourceSummary();

  const filteredKeys = Object.keys(SOURCE_REGISTRY).filter(key => {
    if (filterMode === 'all') return true;
    return getRuntimeMode(key) === filterMode;
  });

  const summaryItems = [
    { mode: 'live',          count: summary.live,          label: 'LIVE' },
    { mode: 'estimated',     count: summary.estimated,     label: 'ESTIMADO' },
    { mode: 'paid_required', count: summary.paid_required, label: 'PAGO' },
    { mode: 'mock',          count: summary.mock,          label: 'MOCK' },
    { mode: 'error',         count: summary.error,         label: 'ERRO' },
  ];

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
          🔍 Fontes de Dados
        </h1>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          Auditoria completa de confiabilidade — LIVE · MOCK · ESTIMADO · PAGO · ERRO
        </p>
      </div>

      {/* Data Mode Banner */}
      <div style={{
        background: DATA_MODE === 'live' ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${DATA_MODE === 'live' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Modo atual do build:</span>
        <DataTrustBadge
          mode={DATA_MODE === 'live' ? 'live' : 'mock'}
          confidence={DATA_MODE === 'live' ? 'A' : 'D'}
          source="VITE_DATA_MODE"
          reason={DATA_MODE === 'mock' ? 'DATA_MODE=mock — todas as APIs retornam dados de demonstração' : undefined}
        />
        <span style={{ fontSize: 10, color: '#475569' }}>
          {DATA_MODE === 'live'
            ? 'APIs reais ativas — override via localStorage ou VITE_DATA_MODE=mock'
            : 'Mock ativo — para usar dados reais, altere em Configurações → Data Mode'}
        </span>
      </div>

      {/* Resumo */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20,
      }}>
        <button
          onClick={() => setFilterMode('all')}
          style={{
            background: filterMode === 'all' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${filterMode === 'all' ? 'rgba(59,130,246,0.4)' : '#1e3048'}`,
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, color: filterMode === 'all' ? '#60a5fa' : '#64748b',
          }}
        >
          Todos ({Object.keys(SOURCE_REGISTRY).length})
        </button>
        {summaryItems.map(({ mode, count, label }) => {
          const cfg = MODE_LABELS[mode];
          const active = filterMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setFilterMode(active ? 'all' : mode)}
              style={{
                background: active ? `${cfg.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? `${cfg.color}40` : '#1e3048'}`,
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, color: active ? cfg.color : '#64748b',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: cfg.color,
              }} />
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div style={{
        background: '#0A1220', border: '1px solid #162032', borderRadius: 12, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#07101c', borderBottom: '1px solid #162032' }}>
              {['Serviço', 'Host', 'Grátis?', 'Auth?', 'Freq.', 'Limitação', 'Confiança', 'Status Atual'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: 'left',
                  fontSize: 9, fontWeight: 700, color: '#4a6580',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredKeys.map(key => (
              <SourceRow key={key} serviceKey={key} entry={SOURCE_REGISTRY[key]} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div style={{
        marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12,
      }}>
        {/* Graus */}
        <div style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Graus de Confiança
          </div>
          {Object.entries(CONFIDENCE_LABELS).map(([grade, info]) => (
            <div key={grade} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
                color: info.color, minWidth: 16,
              }}>
                {grade}
              </span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{info.label.split(' — ')[1]}</div>
                <div style={{ fontSize: 9, color: '#475569' }}>{info.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Modos */}
        <div style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Tipos de Dado
          </div>
          {Object.entries(MODE_LABELS).map(([mode, info]) => (
            <div key={mode} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                color: info.color, minWidth: 60,
              }}>
                {info.label}
              </span>
              <div style={{ fontSize: 9, color: '#475569' }}>{info.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
