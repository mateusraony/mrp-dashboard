/**
 * DataTrustBadge.tsx — Badge de confiança e proveniência de dado
 *
 * Exibe: ● MODE · X  (X = confidence A/B/C/D)
 * Hover: tooltip com source, URL, idade do dado, reason
 *
 * Distinto do DataQualityBadge (score numérico 0–100):
 * este badge comunica a ORIGEM e o TIPO do dado.
 */
import { useState, useRef, useCallback } from 'react';
import type { DataMode, DataConfidence } from '@/types/dataStatus';

// ─── Configuração visual por mode ─────────────────────────────────────────────

const MODE_CONFIG: Record<DataMode, { color: string; label: string }> = {
  live:          { color: '#10b981', label: 'LIVE' },
  mock:          { color: '#f59e0b', label: 'MOCK' },
  estimated:     { color: '#3b82f6', label: 'ESTIMADO' },
  paid_required: { color: '#f97316', label: 'PAGO' },
  error:         { color: '#ef4444', label: 'ERRO' },
};

// ─── Formatação de tempo relativo ─────────────────────────────────────────────

function relativeTime(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt;
  if (diffMs < 60_000)       return `${Math.round(diffMs / 1000)}s atrás`;
  if (diffMs < 3_600_000)    return `${Math.round(diffMs / 60_000)}min atrás`;
  if (diffMs < 86_400_000)   return `${Math.round(diffMs / 3_600_000)}h atrás`;
  return `${Math.round(diffMs / 86_400_000)}d atrás`;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  visible: boolean;
  pos: { top: number; left: number };
  mode: DataMode;
  source: string;
  sourceUrl?: string;
  updatedAt?: number;
  reason?: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function TrustTooltip({ visible, pos, mode, source, sourceUrl, updatedAt, reason, onMouseEnter, onMouseLeave }: TooltipProps) {
  if (!visible) return null;
  const cfg = MODE_CONFIG[mode];

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 240,
        background: '#0d1421',
        border: '1px solid #2a3f5f',
        borderRadius: 10,
        padding: '12px 14px',
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>Origem do Dado</span>
        <span style={{
          fontSize: 10, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
          color: cfg.color,
          background: `${cfg.color}18`,
          border: `1px solid ${cfg.color}40`,
          borderRadius: 4,
          padding: '1px 6px',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Fonte */}
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: '#4a6580' }}>Fonte: </span>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
          >
            {source} ↗
          </a>
        ) : (
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{source}</span>
        )}
      </div>

      {/* Atualizado */}
      {updatedAt != null && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#4a6580' }}>Atualizado: </span>
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
            {relativeTime(updatedAt)}
          </span>
        </div>
      )}

      {/* Reason */}
      {reason && (
        <div style={{
          marginTop: 8,
          borderTop: '1px solid #1e3048',
          paddingTop: 8,
          fontSize: 9,
          color: '#94a3b8',
          lineHeight: 1.5,
        }}>
          {reason}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export interface DataTrustBadgeProps {
  mode: DataMode;
  confidence: DataConfidence;
  source: string;
  sourceUrl?: string;
  updatedAt?: number;
  reason?: string;
}

export function DataTrustBadge({
  mode,
  confidence,
  source,
  sourceUrl,
  updatedAt,
  reason,
}: DataTrustBadgeProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfg = MODE_CONFIG[mode];

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const show = useCallback(() => {
    cancelHide();
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top:  rect.bottom + window.scrollY + 6,
      left: Math.min(rect.left + window.scrollX - 60, window.innerWidth - 260),
    });
    setVisible(true);
  }, [cancelHide]);

  // Delay hide so the user can move the cursor from badge into the tooltip
  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          color: cfg.color,
          background: `${cfg.color}12`,
          border: `1px solid ${cfg.color}30`,
          borderRadius: 4,
          padding: '2px 6px',
          cursor: 'help',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          letterSpacing: '0.03em',
        }}
      >
        {/* Dot — pulsa apenas em live */}
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: cfg.color,
            display: 'inline-block',
            flexShrink: 0,
            boxShadow: `0 0 4px ${cfg.color}80`,
            animation: mode === 'live' ? 'dtb-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        {cfg.label}
        <span style={{ color: `${cfg.color}99`, fontWeight: 600 }}>· {confidence}</span>
      </span>

      {/* Injetar keyframe de pulse uma vez */}
      <style>{`
        @keyframes dtb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      <TrustTooltip
        visible={visible}
        pos={pos}
        mode={mode}
        source={source}
        sourceUrl={sourceUrl}
        updatedAt={updatedAt}
        reason={reason}
        onMouseEnter={cancelHide}
        onMouseLeave={hide}
      />
    </>
  );
}

export default DataTrustBadge;
