// ─── FONTES DE DADOS — Auditoria de Confiabilidade ────────────────────────────
// Tabela completa de todos os serviços: modo, confiança, limitações, status atual
import { useState } from 'react';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { SOURCE_REGISTRY, getRuntimeMode, getSourceSummary } from '@/utils/dataStatus';
import { DATA_MODE, IS_LIVE } from '@/lib/env';
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

// ─── Edge Functions registradas no projeto ────────────────────────────────────
const EDGE_FUNCTIONS = [
  {
    name: 'fred-proxy',
    purpose: 'Proxy server-side para FRED API (yields, DXY, S&P, VIX, Global Liquidity)',
    usedBy: 'Macro, GlobalMarkets',
    requiresSecret: 'FRED_API_KEY (Supabase Secret)',
  },
  {
    name: 'ai-analysis',
    purpose: 'Análise de mercado via Claude Haiku 4.5 — texto natural por página',
    usedBy: 'Dashboard, Derivatives, Options, SpotFlow, Macro, PredictivePanel, ExecutiveReport',
    requiresSecret: 'ANTHROPIC_API_KEY (Supabase Secret)',
  },
  {
    name: 'macro-actual-fetcher',
    purpose: 'Busca valores reais de CPI/NFP/GDP/PCE via FRED e grava em macro_event_schedule',
    usedBy: 'MacroCalendar (via pg_cron a cada 15min)',
    requiresSecret: 'FRED_API_KEY (Supabase Secret)',
  },
  {
    name: 'macro-alert-worker',
    purpose: 'Dispara alertas de eventos macro (CPI, FOMC, NFP) para Telegram/email',
    usedBy: 'SmartAlerts, MacroCalendar (via pg_cron a cada 5min)',
    requiresSecret: 'Nenhum (lê telegram_bot_token do banco)',
  },
  {
    name: 'send-telegram-digest',
    purpose: 'Envia digest diário do portfólio e mercado via Telegram',
    usedBy: 'Settings — horário configurável (via pg_cron diário às 11h UTC)',
    requiresSecret: 'Nenhum (lê telegram_bot_token do banco)',
  },
  {
    name: 'telegram-ping',
    purpose: 'Testa conectividade Telegram — disparado pelo botão em Settings',
    usedBy: 'Settings',
    requiresSecret: 'Nenhum (lê telegram_bot_token do banco via service_role)',
  },
  {
    name: 'health-check',
    purpose: 'Endpoint de health check da plataforma (latência, status Supabase)',
    usedBy: 'useAiHealthCheck hook — DataSources',
    requiresSecret: 'Nenhum',
  },
];

// ─── Painel de Edge Functions ─────────────────────────────────────────────────
function EdgeFunctionsPanel() {
  const supabaseOk = isSupabaseConfigured();

  const getStatus = () => {
    if (!supabaseOk) return { label: 'Supabase não configurado', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' };
    if (!IS_LIVE) return { label: 'Modo mock — não chamadas', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' };
    return { label: 'Configuradas — não confirmado via health check', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' };
  };

  const status = getStatus();

  return (
    <div style={{ background: '#0A1220', border: '1px solid #162032', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ background: '#07101c', borderBottom: '1px solid #162032', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>Edge Functions Supabase</span>
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 10 }}>7 funções registradas no projeto</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          padding: '3px 8px', borderRadius: 4,
          color: status.color, background: status.bg, border: `1px solid ${status.border}`,
        }}>
          {status.label}
        </span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {EDGE_FUNCTIONS.map((fn) => (
          <div key={fn.name} style={{
            display: 'grid', gridTemplateColumns: '180px 1fr 1fr',
            padding: '10px 16px', borderBottom: '1px solid #0d1a26', gap: 16, alignItems: 'start',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>
                {fn.name}
              </div>
              <div style={{ fontSize: 9, color: '#334155', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                🔑 {fn.requiresSecret}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
              {fn.purpose}
            </div>
            <div style={{ fontSize: 9, color: '#334155' }}>
              <span style={{ color: '#4a6580' }}>Usado por: </span>{fn.usedBy}
            </div>
          </div>
        ))}
      </div>
      {!supabaseOk && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.05)', borderTop: '1px solid rgba(239,68,68,0.15)', fontSize: 10, color: '#f87171' }}>
          ⚠️ Supabase não configurado — nenhuma Edge Function pode ser chamada. Configure <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>VITE_SUPABASE_URL</code> e <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>VITE_SUPABASE_ANON_KEY</code> em <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>.env.local</code>.
        </div>
      )}
      {supabaseOk && IS_LIVE && (
        <div style={{ padding: '10px 16px', background: 'rgba(148,163,184,0.04)', borderTop: '1px solid #162032', fontSize: 10, color: '#475569' }}>
          ℹ️ "Não confirmado" significa que o Supabase está configurado, mas o status de deploy de cada função não é verificado em tempo real nesta página. Use o Supabase Dashboard para confirmar o deploy.
        </div>
      )}
    </div>
  );
}

// ─── Painel de Ambiente Atual ─────────────────────────────────────────────────
function EnvironmentPanel() {
  const supabaseOk = isSupabaseConfigured();
  const storedMode = typeof localStorage !== 'undefined' ? localStorage.getItem('mrp_data_mode') : null;
  const buildMode = import.meta.env.VITE_DATA_MODE ?? 'live';
  const hasLocalOverride = storedMode !== null && storedMode !== buildMode;

  return (
    <div style={{
      background: '#0A1220', border: '1px solid #162032', borderRadius: 12,
      padding: '14px 16px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Ambiente Atual
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>

        {/* Data Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Modo de dados</div>
          <DataTrustBadge
            mode={DATA_MODE === 'live' ? 'live' : 'mock'}
            confidence={DATA_MODE === 'live' ? 'A' : 'D'}
            source="VITE_DATA_MODE"
            reason={DATA_MODE === 'mock' ? 'Todas as APIs retornam dados de demonstração' : undefined}
          />
          <div style={{ fontSize: 9, color: '#334155' }}>
            Build: <code style={{ color: '#64748b' }}>{buildMode}</code>
            {hasLocalOverride && (
              <span style={{ color: '#f59e0b', marginLeft: 6 }}>
                · Override localStorage: <code style={{ color: '#fbbf24' }}>{storedMode}</code>
              </span>
            )}
            {!hasLocalOverride && storedMode && (
              <span style={{ color: '#475569', marginLeft: 6 }}>· localStorage: {storedMode} (igual ao build)</span>
            )}
            {!storedMode && (
              <span style={{ color: '#334155', marginLeft: 6 }}>· localStorage: não definido</span>
            )}
          </div>
        </div>

        {/* Supabase */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supabase</div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: supabaseOk ? '#10b981' : '#ef4444',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: supabaseOk ? '#10b981' : '#ef4444', display: 'inline-block' }} />
            {supabaseOk ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}
          </span>
          <div style={{ fontSize: 9, color: '#334155' }}>
            {supabaseOk
              ? 'Persistência de alertas, portfólio, settings e cache ativa'
              : 'Sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY — Edge Functions e persistência indisponíveis'}
          </div>
        </div>

        {/* SoSoValue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SoSoValue (ETF)</div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: getRuntimeMode('sosovalue') === 'live' ? '#10b981' : '#f97316',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: getRuntimeMode('sosovalue') === 'live' ? '#10b981' : '#f97316', display: 'inline-block' }} />
            {getRuntimeMode('sosovalue') === 'live' ? 'CHAVE CONFIGURADA' : 'CHAVE AUSENTE'}
          </span>
          <div style={{ fontSize: 9, color: '#334155' }}>
            {getRuntimeMode('sosovalue') === 'live'
              ? 'ETF flows reais via SoSoValue API'
              : 'VITE_SOSOVALUE_KEY ausente — ETF flows em modo demonstração'}
          </div>
        </div>

      </div>
    </div>
  );
}

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

      {/* Ambiente Atual */}
      <EnvironmentPanel />

      {/* Edge Functions */}
      <EdgeFunctionsPanel />

      {/* Título da seção de APIs externas */}
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>APIs Externas</span>
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 10 }}>
          {Object.keys(SOURCE_REGISTRY).length} fontes registradas · Filtrar por status:
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
