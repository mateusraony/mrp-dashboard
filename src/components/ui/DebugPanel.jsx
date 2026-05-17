/**
 * DebugPanel.jsx — Painel flutuante de debug in-memory para diagnóstico em produção.
 * Abas: Logs | Claude AI. Posição: canto inferior-direito. Z-index 9999.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getLogs, clearLogs, onLogAdded } from '@/lib/debugLog';
import { useAiHealthCheck } from '@/hooks/useAiHealthCheck';

// ─── Cores por level ──────────────────────────────────────────────────────────

const LEVEL_COLOR  = { error: '#ef4444', warn: '#f59e0b', info: '#3b82f6' };
const LEVEL_BG     = { error: 'rgba(239,68,68,0.08)', warn: 'rgba(245,158,11,0.07)', info: 'rgba(59,130,246,0.06)' };
const LEVEL_BORDER = { error: 'rgba(239,68,68,0.2)',  warn: 'rgba(245,158,11,0.18)', info: 'rgba(59,130,246,0.18)' };

function fmtTs(iso) {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour12: false }); }
  catch { return iso; }
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{ padding: '6px 10px', borderBottom: '1px solid rgba(22,32,50,0.6)', cursor: entry.detail ? 'pointer' : 'default', background: expanded ? LEVEL_BG[entry.level] : 'transparent', transition: 'background 0.15s' }}
      onClick={() => entry.detail && setExpanded(e => !e)}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4a6580', flexShrink: 0, paddingTop: 1 }}>{fmtTs(entry.timestamp)}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, color: LEVEL_COLOR[entry.level], background: LEVEL_BG[entry.level], border: `1px solid ${LEVEL_BORDER[entry.level]}`, borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em', flexShrink: 0 }}>{entry.level.toUpperCase()}</span>
        {entry.source && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4a6580', flexShrink: 0 }}>{entry.source}:</span>}
        <span style={{ fontSize: 11, color: '#e2e8f0', wordBreak: 'break-word', flex: 1, minWidth: 0, lineHeight: 1.5 }}>{entry.message}</span>
        {entry.detail && <span style={{ fontSize: 9, color: '#4a6580', flexShrink: 0, paddingTop: 2 }}>{expanded ? '▲' : '▼'}</span>}
      </div>
      {expanded && entry.detail && (
        <pre style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(0,0,0,0.35)', border: `1px solid ${LEVEL_BORDER[entry.level]}`, borderRadius: 5, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
          {entry.detail}
        </pre>
      )}
    </div>
  );
}

// ─── Aba Claude AI ────────────────────────────────────────────────────────────

const AI_STATUS_CFG = {
  disabled: { color: '#4a6580', bg: 'rgba(74,101,128,0.1)',  border: 'rgba(74,101,128,0.25)',  icon: '○', label: 'Desabilitado' },
  loading:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: '◌', label: 'Verificando…' },
  ok:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',border: 'rgba(167,139,250,0.3)', icon: '✦', label: 'Online' },
  error:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  icon: '✕', label: 'Offline' },
};

const AI_PAGES = [
  'Dashboard', 'Derivativos', 'Derivativos Avançado', 'Options',
  'Spot Flow', 'Macro', 'Preditivo BTC', 'Relatório Executivo', 'Oportunidades',
];

function AiStatusTab({ aiHealth }) {
  const cfg = AI_STATUS_CFG[aiHealth.status];
  return (
    <div style={{ padding: '14px 14px', overflowY: 'auto', flex: 1 }}>
      {/* Status principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22, color: cfg.color }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>
            Claude Haiku · {cfg.label}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            {aiHealth.status === 'ok'    && `Latência: ${aiHealth.latencyMs}ms · Verificado às ${fmtTs(aiHealth.checkedAt)}`}
            {aiHealth.status === 'error' && `Erro: ${aiHealth.error}`}
            {aiHealth.status === 'loading' && 'Fazendo probe à Edge Function…'}
            {aiHealth.status === 'disabled' && 'IS_LIVE=false ou Supabase não configurado'}
          </div>
        </div>
      </div>

      {/* Métricas */}
      {aiHealth.status === 'ok' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            ['Latência', `${aiHealth.latencyMs}ms`, aiHealth.latencyMs < 3000 ? '#10b981' : '#f59e0b'],
            ['Modelo', 'Claude Haiku 4.5', '#a78bfa'],
            ['Cache', '15 min / página', '#60a5fa'],
            ['Última check', fmtTs(aiHealth.checkedAt), '#94a3b8'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7, padding: '8px 10px' }}>
              <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Páginas cobertas */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7, fontWeight: 700 }}>Páginas com Claude AI</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {AI_PAGES.map(p => (
            <span key={p} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: aiHealth.status === 'ok' ? 'rgba(167,139,250,0.1)' : '#0d1421', color: aiHealth.status === 'ok' ? '#a78bfa' : '#334155', border: `1px solid ${aiHealth.status === 'ok' ? 'rgba(167,139,250,0.25)' : '#1a2535'}`, fontFamily: 'JetBrains Mono, monospace' }}>
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* SmartAlerts note */}
      <div style={{ padding: '7px 10px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7, fontSize: 9, color: '#475569', lineHeight: 1.6 }}>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>SmartAlerts</span> usa análise rule-based (sem Claude) — sinais derivativos em tempo real.
      </div>
    </div>
  );
}

// ─── Painel principal ─────────────────────────────────────────────────────────

export default function DebugPanel() {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs]         = useState(() => getLogs());
  const [unreadErrors, setUnreadErrors] = useState(0);
  const listRef = useRef(null);
  const aiHealth = useAiHealthCheck();

  useEffect(() => {
    const unsub = onLogAdded((entry) => {
      setLogs(getLogs());
      if (!open && entry.level === 'error') setUnreadErrors(n => n + 1);
    });
    return unsub;
  }, [open]);

  const handleOpen  = useCallback(() => { setOpen(true);  setUnreadErrors(0); setLogs(getLogs()); }, []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleClear = useCallback(() => { clearLogs(); setLogs([]); setUnreadErrors(0); }, []);
  const handleCopyAll = useCallback(() => {
    const text = getLogs().map(e => `[${e.timestamp}] [${e.level.toUpperCase()}]${e.source ? ` ${e.source}:` : ''} ${e.message}${e.detail ? `\n${e.detail}` : ''}`).join('\n---\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  useEffect(() => {
    if (open && activeTab === 'logs' && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, activeTab, logs.length]);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const aiStatusColor = { ok: '#a78bfa', error: '#ef4444', loading: '#f59e0b', disabled: '#4a6580' }[aiHealth.status];

  const TABS = [
    { id: 'logs', label: `Logs${logs.length > 0 ? ` (${logs.length})` : ''}` },
    { id: 'ai',   label: 'Claude AI' },
  ];

  return (
    <>
      {/* ── BOTÃO FLUTUANTE ──────────────────────────────────────────────── */}
      <button
        onClick={open ? handleClose : handleOpen}
        title="Debug Log"
        aria-label="Abrir painel de debug"
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, width: 42, height: 42, borderRadius: '50%', background: 'rgba(7,11,20,0.92)', border: '1px solid #1e2d45', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d45'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)'; }}
      >
        <span role="img" aria-hidden="true">🐛</span>
        {unreadErrors > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid #070B14' }}>
            {unreadErrors > 99 ? '99+' : unreadErrors}
          </span>
        )}
        {/* Ponto de status AI (canto inferior-esquerdo do botão) */}
        {aiHealth.status !== 'disabled' && (
          <span style={{ position: 'absolute', bottom: 1, left: 1, width: 10, height: 10, borderRadius: '50%', background: aiStatusColor, border: '1.5px solid #070B14' }} title={`Claude AI: ${aiHealth.status}`} />
        )}
      </button>

      {/* ── PAINEL ───────────────────────────────────────────────────────── */}
      {open && (
        <div style={{ position: 'fixed', bottom: 72, right: 20, zIndex: 9999, width: 400, maxHeight: 460, display: 'flex', flexDirection: 'column', background: '#070B14', border: '1px solid #1e2d45', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #1e2d45', flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.01em' }}>
              Debug {errorCount > 0 && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 400 }}>· {errorCount} err</span>}
            </span>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ fontSize: 10, padding: '2px 9px', borderRadius: 5, border: `1px solid ${activeTab === t.id ? 'rgba(59,130,246,0.4)' : '#1a2535'}`, background: activeTab === t.id ? 'rgba(59,130,246,0.12)' : 'transparent', color: activeTab === t.id ? '#60a5fa' : '#4a6580', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t.id === 'ai' && aiHealth.status !== 'disabled' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: aiStatusColor, flexShrink: 0 }} />}
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            {activeTab === 'logs' && logs.length > 0 && (
              <>
                <button onClick={handleCopyAll} title="Copiar todos" style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>Copiar</button>
                <button onClick={handleClear} title="Limpar" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>Limpar</button>
              </>
            )}
            <button onClick={handleClose} style={{ background: 'transparent', color: '#4a6580', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }} onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; }} onMouseLeave={e => { e.currentTarget.style.color = '#4a6580'; }}>✕</button>
          </div>

          {/* Conteúdo */}
          {activeTab === 'logs' ? (
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {logs.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#4a6580', fontFamily: 'JetBrains Mono, monospace' }}>Nenhum log registrado.</div>
              ) : (
                [...logs].reverse().map(entry => <LogRow key={entry.id} entry={entry} />)
              )}
            </div>
          ) : (
            <AiStatusTab aiHealth={aiHealth} />
          )}
        </div>
      )}
    </>
  );
}
