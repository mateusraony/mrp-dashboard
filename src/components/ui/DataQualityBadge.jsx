/**
 * DataQualityBadge.jsx — Badge compacto de qualidade de dado por fonte
 *
 * Score 0–100 calculado por 4 fatores ponderados:
 *   freshness    (40%): quão recente é o dado
 *   completeness (30%): % de campos não-nulos
 *   consistency  (20%): ausência de NaN/Infinity
 *   fallback     (10%): se usa dado live ou mock fallback
 *
 * Renderização compacta: [●] 94 · FRED
 * Tooltip ao hover: breakdown dos 4 fatores
 */
import { useState, useRef } from 'react';

// ─── Utilitário exportado ─────────────────────────────────────────────────────

/**
 * computeDataQualityScore — calcula score 0–100 para um dado.
 *
 * @param freshness_ms   — idade do dado em milissegundos (Date.now() - updated_at)
 * @param total_fields   — total de campos no objeto retornado
 * @param null_fields    — quantos desses campos são null/undefined
 * @param is_fallback    — true se usando mock/fallback ao invés de dado live
 */
export function computeDataQualityScore({
  freshness_ms = 0,
  total_fields = 1,
  null_fields  = 0,
  is_fallback  = false,
}) {
  // freshness: 100 = <5min, 80 = <1h, 60 = <24h, 40 = <48h, 0 = stale
  let freshScore;
  if      (freshness_ms < 5 * 60_000)       freshScore = 100; // < 5 min
  else if (freshness_ms < 60 * 60_000)      freshScore = 80;  // < 1h
  else if (freshness_ms < 24 * 3_600_000)   freshScore = 60;  // < 24h
  else if (freshness_ms < 48 * 3_600_000)   freshScore = 40;  // < 48h
  else                                        freshScore = 0;

  // completeness: % de campos não-nulos
  const safeTotal = Math.max(total_fields, 1);
  const complScore = Math.round(((safeTotal - null_fields) / safeTotal) * 100);

  // consistency: 100 por padrão; 0 se NaN/Infinity detectado
  // (chamador passa 0 se detectar valores inválidos)
  // Aqui apenas recebemos como parâmetro via props.consistency
  const consScore = 100; // default — ver DataQualityBadge para override

  // fallback: live = 100, mock = 40
  const fallbackScore = is_fallback ? 40 : 100;

  return Math.round(
    freshScore   * 0.40 +
    complScore   * 0.30 +
    consScore    * 0.20 +
    fallbackScore * 0.10,
  );
}

// ─── Mapeamento de score → grade visual ──────────────────────────────────────

function gradeFromScore(score) {
  if (score >= 80) return { grade: 'A', color: '#10b981', label: 'A' };
  if (score >= 60) return { grade: 'B', color: '#f59e0b', label: 'B' };
  if (score >= 40) return { grade: 'C', color: '#f97316', label: 'C' };
  return            { grade: 'D', color: '#ef4444', label: 'D' };
}

// ─── Tooltip interno ──────────────────────────────────────────────────────────

function QualityTooltip({ visible, pos, freshness, completeness, consistency, fallback_active, score, grade }) {
  if (!visible) return null;

  const factors = [
    { label: 'Freshness',    weight: '40%', value: freshness,   max: 100, desc: freshness >= 80 ? 'Recente (<1h)' : freshness >= 60 ? 'Recente (<24h)' : 'Stale (>24h)' },
    { label: 'Completeness', weight: '30%', value: completeness, max: 100, desc: `${completeness}% campos preenchidos` },
    { label: 'Consistency',  weight: '20%', value: consistency,  max: 100, desc: consistency === 100 ? 'Sem NaN/Infinity' : 'Valores inconsistentes detectados' },
    { label: 'Fallback',     weight: '10%', value: fallback_active ? 40 : 100, max: 100, desc: fallback_active ? 'Usando mock/fallback' : 'Dado live' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 220,
        background: '#0d1421',
        border: '1px solid #2a3f5f',
        borderRadius: 10,
        padding: '12px 14px',
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>Data Quality Score</span>
        <span style={{
          fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
          color: grade.color,
        }}>
          {score} · {grade.grade}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {factors.map(f => {
          const pct = Math.min(100, f.value);
          const barColor = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
          return (
            <div key={f.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: '#64748b' }}>
                  {f.label} <span style={{ color: '#334155' }}>({f.weight})</span>
                </span>
                <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: barColor, fontWeight: 700 }}>
                  {pct}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#1e2d45' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: barColor }} />
              </div>
              <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{f.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * DataQualityBadge — exibe score compacto [●] 94 · FRED
 *
 * Props:
 *   freshness       — 0–100 (100 = dado <5min, 0 = stale)
 *   completeness    — 0–100 (% de campos preenchidos)
 *   consistency     — 0–100 (100 = sem NaN/Infinity; 0 = inválido)
 *   fallback_active — boolean (true = usando mock; false = dado live)
 *   source          — string da fonte (ex: 'FRED', 'CoinMetrics')
 */
export function DataQualityBadge({
  freshness       = 100,
  completeness    = 100,
  consistency     = 100,
  fallback_active = false,
  source          = '',
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  // Calcular score ponderado
  const score = Math.round(
    freshness        * 0.40 +
    completeness     * 0.30 +
    consistency      * 0.20 +
    (fallback_active ? 40 : 100) * 0.10,
  );

  const grade = gradeFromScore(score);

  const show = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top:  rect.bottom + window.scrollY + 6,
      left: Math.min(rect.left + window.scrollX - 80, window.innerWidth - 240),
    });
    setVisible(true);
  };

  const hide = () => setVisible(false);

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
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          color: grade.color,
          background: `${grade.color}12`,
          border: `1px solid ${grade.color}30`,
          borderRadius: 5,
          padding: '2px 7px',
          cursor: 'help',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {/* Pontinho colorido */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: grade.color,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: `0 0 4px ${grade.color}80`,
        }} />
        {score}
        {source && (
          <span style={{ color: `${grade.color}99`, fontWeight: 500, marginLeft: 2 }}>
            · {source}
          </span>
        )}
      </span>

      <QualityTooltip
        visible={visible}
        pos={pos}
        freshness={freshness}
        completeness={completeness}
        consistency={consistency}
        fallback_active={fallback_active}
        score={score}
        grade={grade}
      />
    </>
  );
}

export default DataQualityBadge;
