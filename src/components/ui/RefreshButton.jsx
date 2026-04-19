/**
 * RefreshButton — Botão de atualização com animação orbital.
 *
 * Design: anel giratório + pulso de brilho durante loading,
 * ícone morphing (sync → check) ao concluir, ripple no clique.
 */
import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Injeta CSS global uma única vez
let _styleInjected = false;
function injectStyles() {
  if (_styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes mrp-spin   { to { transform: rotate(360deg); } }
    @keyframes mrp-pulse  { 0%,100% { opacity:0.25; transform:scale(1); } 50% { opacity:0.65; transform:scale(1.12); } }
    @keyframes mrp-ripple { 0% { transform:scale(0.7); opacity:0.6; } 100% { transform:scale(2.6); opacity:0; } }
    @keyframes mrp-pop    { 0% { transform:scale(0.5); } 65% { transform:scale(1.18); } 100% { transform:scale(1); } }
    @keyframes mrp-fadein { from { opacity:0; transform:translateY(2px); } to { opacity:1; transform:translateY(0); } }
    @keyframes mrp-dots   { 0%,80%,100% { opacity:0.3; } 40% { opacity:1; } }
    .mrp-btn-refresh:hover:not(:disabled) { border-color: rgba(96,165,250,0.7) !important; background: rgba(59,130,246,0.14) !important; }
    .mrp-btn-refresh:active:not(:disabled) { transform: scale(0.92); }
    .mrp-btn-refresh { transition: border-color 0.25s, background 0.25s, transform 0.1s; }
  `;
  document.head.appendChild(el);
  _styleInjected = true;
}

/**
 * @param {Object} props
 * @param {() => Promise<void> | void} props.onRefresh - Callback para buscar dados
 * @param {boolean} props.isLoading - Estado de carregamento vindo do hook
 * @param {number} [props.lastUpdated] - Timestamp (ms) da última atualização
 * @param {string} [props.label] - Tooltip/aria-label
 * @param {'sm'|'md'} [props.size] - Tamanho do botão
 */
export function RefreshButton({
  onRefresh,
  isLoading = false,
  lastUpdated = 0,
  label = 'Atualizar dados',
  size = 'md',
}) {
  injectStyles();

  const [done, setDone]     = useState(false);
  const [ripple, setRipple] = useState(false);
  const timerRef = useRef(null);

  // Quando isLoading vai de true → false, anima checkmark
  const wasLoading = useRef(false);
  useEffect(() => {
    if (wasLoading.current && !isLoading) {
      setDone(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDone(false), 2400);
    }
    wasLoading.current = isLoading;
  }, [isLoading]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = async () => {
    if (isLoading) return;
    setRipple(true);
    setTimeout(() => setRipple(false), 700);
    setDone(false);
    await onRefresh?.();
  };

  const dim = size === 'sm' ? 30 : 34;
  const iconSize = size === 'sm' ? 12 : 14;

  const borderColor = done    ? 'rgba(16,185,129,0.6)'
                    : isLoading ? 'rgba(59,130,246,0.5)'
                    : 'rgba(59,130,246,0.32)';
  const bg          = done    ? 'rgba(16,185,129,0.10)'
                    : isLoading ? 'rgba(59,130,246,0.08)'
                    : 'rgba(10,18,32,0.85)';

  const timeLabel = lastUpdated > 0
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Timestamp */}
      {timeLabel && (
        <span style={{
          fontSize: 10, color: '#334155',
          fontFamily: 'JetBrains Mono, monospace',
          animation: 'mrp-fadein 0.3s ease',
          whiteSpace: 'nowrap',
        }}>
          {timeLabel}
        </span>
      )}

      {/* Botão */}
      <button
        onClick={handleClick}
        disabled={isLoading}
        title={label}
        aria-label={label}
        className="mrp-btn-refresh"
        style={{
          position: 'relative',
          width: dim, height: dim,
          borderRadius: '50%',
          border: `1.5px solid ${borderColor}`,
          background: bg,
          cursor: isLoading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          outline: 'none',
          flexShrink: 0,
          overflow: 'visible',
        }}
      >
        {/* Anel orbital giratório */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#3b82f6',
            borderRightColor: 'rgba(96,165,250,0.28)',
            animation: 'mrp-spin 0.85s linear infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Segundo anel (counter-rotate, mais sutil) */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '1px solid transparent',
            borderBottomColor: 'rgba(96,165,250,0.18)',
            animation: 'mrp-spin 1.6s linear infinite reverse',
            pointerEvents: 'none',
          }} />
        )}

        {/* Halo de pulso */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: -12,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            animation: 'mrp-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Halo verde quando done */}
        {done && (
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
            animation: 'mrp-pulse 1.2s ease-in-out 1',
            pointerEvents: 'none',
          }} />
        )}

        {/* Ripple ao clicar */}
        {ripple && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'rgba(59,130,246,0.3)',
            animation: 'mrp-ripple 0.65s ease-out forwards',
            pointerEvents: 'none',
          }} />
        )}

        {/* Ícone */}
        <svg
          width={iconSize} height={iconSize}
          viewBox="0 0 24 24" fill="none"
          stroke={done ? '#10b981' : '#60a5fa'}
          strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            transition: 'stroke 0.3s',
            animation: done ? 'mrp-pop 0.35s ease-out' : 'none',
            opacity: isLoading ? 0.55 : 1,
            flexShrink: 0,
          }}
        >
          {done ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </>
          )}
        </svg>
      </button>

      {/* "carregando..." text */}
      {isLoading && (
        <span style={{
          fontSize: 10,
          color: '#3b82f6',
          fontFamily: 'JetBrains Mono, monospace',
          animation: 'mrp-fadein 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <span>buscando</span>
          {[0, 0.2, 0.4].map((delay, i) => (
            <span key={i} style={{
              display: 'inline-block',
              animation: `mrp-dots 1.2s ${delay}s ease-in-out infinite`,
            }}>.</span>
          ))}
        </span>
      )}
    </div>
  );
}
