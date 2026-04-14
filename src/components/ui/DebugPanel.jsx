/**
 * DebugPanel.jsx — Painel flutuante de debug in-memory para diagnóstico em produção.
 * Posição: canto inferior-direito. Z-index 9999. Não interfere no layout.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getLogs, clearLogs, onLogAdded } from '@/lib/debugLog';

// ─── Cores por level ─────────────────────────────────────────────────────────

const LEVEL_COLOR = {
  error: '#ef4444',
  warn:  '#f59e0b',
  info:  '#3b82f6',
};

const LEVEL_BG = {
  error: 'rgba(239,68,68,0.08)',
  warn:  'rgba(245,158,11,0.07)',
  info:  'rgba(59,130,246,0.06)',
};

const LEVEL_BORDER = {
  error: 'rgba(239,68,68,0.2)',
  warn:  'rgba(245,158,11,0.18)',
  info:  'rgba(59,130,246,0.18)',
};

// ─── Formata timestamp para exibição compacta ─────────────────────────────────

function fmtTs(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour12: false });
  } catch {
    return iso;
  }
}

// ─── Entrada individual do log ────────────────────────────────────────────────

function LogRow({ entry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        padding: '6px 10px',
        borderBottom: '1px solid rgba(22,32,50,0.6)',
        cursor: entry.detail ? 'pointer' : 'default',
        background: expanded ? LEVEL_BG[entry.level] : 'transparent',
        transition: 'background 0.15s',
      }}
      onClick={() => entry.detail && setExpanded(e => !e)}
      title={entry.detail ? 'Clique para expandir/recolher' : undefined}
    >
      {/* Linha principal */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Timestamp */}
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#4a6580',
          flexShrink: 0,
          paddingTop: 1,
        }}>
          {fmtTs(entry.timestamp)}
        </span>

        {/* Level badge */}
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          fontWeight: 700,
          color: LEVEL_COLOR[entry.level],
          background: LEVEL_BG[entry.level],
          border: `1px solid ${LEVEL_BORDER[entry.level]}`,
          borderRadius: 3,
          padding: '1px 5px',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}>
          {entry.level.toUpperCase()}
        </span>

        {/* Source */}
        {entry.source && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: '#4a6580',
            flexShrink: 0,
          }}>
            {entry.source}:
          </span>
        )}

        {/* Message */}
        <span style={{
          fontSize: 11,
          color: '#e2e8f0',
          wordBreak: 'break-word',
          flex: 1,
          minWidth: 0,
          lineHeight: 1.5,
        }}>
          {entry.message}
        </span>

        {/* Expand indicator */}
        {entry.detail && (
          <span style={{ fontSize: 9, color: '#4a6580', flexShrink: 0, paddingTop: 2 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Detail expandido */}
      {expanded && entry.detail && (
        <pre style={{
          marginTop: 6,
          padding: '6px 8px',
          background: 'rgba(0,0,0,0.35)',
          border: `1px solid ${LEVEL_BORDER[entry.level]}`,
          borderRadius: 5,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#94a3b8',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          overflowX: 'auto',
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          {entry.detail}
        </pre>
      )}
    </div>
  );
}

// ─── Painel principal ─────────────────────────────────────────────────────────

export default function DebugPanel() {
  const [open, setOpen]   = useState(false);
  const [logs, setLogs]   = useState(() => getLogs());
  // Contagem de erros não lidos desde a última abertura do painel
  const [unreadErrors, setUnreadErrors] = useState(0);
  const listRef = useRef(null);

  // Inscreve no emitter para atualizar a lista em tempo real
  useEffect(() => {
    const unsub = onLogAdded((entry) => {
      setLogs(getLogs());
      if (!open && entry.level === 'error') {
        setUnreadErrors(n => n + 1);
      }
    });
    return unsub;
  }, [open]);

  // Ao abrir, zera os unread e recarrega logs
  const handleOpen = useCallback(() => {
    setOpen(true);
    setUnreadErrors(0);
    setLogs(getLogs());
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleClear = useCallback(() => {
    clearLogs();
    setLogs([]);
    setUnreadErrors(0);
  }, []);

  const handleCopyAll = useCallback(() => {
    const text = getLogs()
      .map(e =>
        `[${e.timestamp}] [${e.level.toUpperCase()}]${e.source ? ` ${e.source}:` : ''} ${e.message}${e.detail ? `\n${e.detail}` : ''}`
      )
      .join('\n---\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  // Scroll para o fim ao abrir ou ao adicionar novos logs (se já aberto)
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, logs.length]);

  const errorCount = logs.filter(l => l.level === 'error').length;

  return (
    <>
      {/* ── BOTÃO FLUTUANTE ──────────────────────────────────────────────── */}
      <button
        onClick={open ? handleClose : handleOpen}
        title="Debug Log"
        aria-label="Abrir painel de debug"
        style={{
          position:     'fixed',
          bottom:       20,
          right:        20,
          zIndex:       9999,
          width:        42,
          height:       42,
          borderRadius: '50%',
          background:   'rgba(7,11,20,0.92)',
          border:       '1px solid #1e2d45',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     18,
          boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          transition:   'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#1e2d45';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
        }}
      >
        {/* Ícone de bug */}
        <span role="img" aria-hidden="true">🐛</span>

        {/* Badge de erros não lidos */}
        {unreadErrors > 0 && (
          <span style={{
            position:   'absolute',
            top:        -4,
            right:      -4,
            minWidth:   17,
            height:     17,
            borderRadius: 9,
            background: '#ef4444',
            color:      '#fff',
            fontSize:   9,
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding:    '0 3px',
            border:     '1.5px solid #070B14',
          }}>
            {unreadErrors > 99 ? '99+' : unreadErrors}
          </span>
        )}
      </button>

      {/* ── PAINEL ───────────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position:   'fixed',
            bottom:     72,
            right:      20,
            zIndex:     9999,
            width:      380,
            maxHeight:  420,
            display:    'flex',
            flexDirection: 'column',
            background: '#070B14',
            border:     '1px solid #1e2d45',
            borderRadius: 12,
            boxShadow:  '0 8px 40px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(12px)',
            overflow:   'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            padding:        '10px 12px',
            borderBottom:   '1px solid #1e2d45',
            flexShrink:     0,
            background:     'rgba(0,0,0,0.3)',
          }}>
            {/* Título + contagem */}
            <span style={{
              fontSize:     12,
              fontWeight:   700,
              color:        '#e2e8f0',
              flex:         1,
              fontFamily:   'JetBrains Mono, monospace',
              letterSpacing: '-0.01em',
            }}>
              Debug Log
              {logs.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, color: '#4a6580', fontWeight: 400 }}>
                  ({logs.length}{errorCount > 0 ? `, ${errorCount} err` : ''})
                </span>
              )}
            </span>

            {/* Botão Copiar todos */}
            {logs.length > 0 && (
              <button
                onClick={handleCopyAll}
                title="Copiar todos os logs como texto"
                style={{
                  background:   'rgba(59,130,246,0.08)',
                  color:        '#60a5fa',
                  border:       '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 5,
                  padding:      '3px 8px',
                  fontSize:     10,
                  cursor:       'pointer',
                  fontFamily:   'JetBrains Mono, monospace',
                }}
              >
                Copiar todos
              </button>
            )}

            {/* Botão Limpar */}
            {logs.length > 0 && (
              <button
                onClick={handleClear}
                title="Limpar todos os logs"
                style={{
                  background:   'rgba(239,68,68,0.08)',
                  color:        '#ef4444',
                  border:       '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 5,
                  padding:      '3px 8px',
                  fontSize:     10,
                  cursor:       'pointer',
                  fontFamily:   'JetBrains Mono, monospace',
                }}
              >
                Limpar
              </button>
            )}

            {/* Botão Fechar */}
            <button
              onClick={handleClose}
              title="Fechar painel"
              style={{
                background:   'transparent',
                color:        '#4a6580',
                border:       'none',
                cursor:       'pointer',
                fontSize:     14,
                lineHeight:   1,
                padding:      '2px 4px',
                borderRadius: 4,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4a6580'; }}
            >
              ✕
            </button>
          </div>

          {/* Lista de logs */}
          <div
            ref={listRef}
            style={{
              flex:       1,
              overflowY:  'auto',
              overflowX:  'hidden',
            }}
          >
            {logs.length === 0 ? (
              <div style={{
                padding:   '24px 16px',
                textAlign: 'center',
                fontSize:  12,
                color:     '#4a6580',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                Nenhum log registrado.
              </div>
            ) : (
              // Exibe do mais recente para o mais antigo
              [...logs].reverse().map(entry => (
                <LogRow key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
