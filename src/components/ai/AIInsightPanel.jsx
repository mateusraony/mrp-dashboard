// ─── AI INSIGHT PANEL — Componente reutilizável para todos os módulos
// Exibe: Regime atual · Probabilidade · Recomendação · Raciocínio
// Preparado para integração futura com Supabase (campo module_id + snapshot)

export default function AIInsightPanel({ moduleId, title = '', probability, regime, recommendation, reasoning, actions = [], compact = false, insight = undefined, isLoadingInsight = false, modelLabel = undefined }) {
  const regimeMap = {
    bullish:      { label: '▲ BULLISH',       color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
    bearish:      { label: '▼ BEARISH',       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
    caution:      { label: '⚠ CAUTELA',       color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)' },
    neutral:      { label: '◆ NEUTRO',        color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
    risk_on:      { label: '🟢 RISK-ON',      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
    risk_off:     { label: '🔴 RISK-OFF',     color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
    squeeze_risk: { label: '⚡ SQUEEZE RISK', color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)' },
    flush_risk:   { label: '💥 FLUSH RISK',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
  };

  const r = regimeMap[regime] || regimeMap.neutral;
  const probColor = probability >= 70 ? '#ef4444' : probability >= 50 ? '#f59e0b' : '#10b981';

  // compact = versão inline para widgets menores
  if (compact) {
    return (
      <div style={{
        background: r.bg, border: `1px solid ${r.border}`,
        borderRadius: 8, padding: '9px 12px',
        borderLeft: `3px solid ${r.color}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase' }}>Prob.</span>
            <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: probColor }}>{probability}%</span>
          </div>
        </div>
        {isLoadingInsight && !insight
          ? <div style={{ height: 14, borderRadius: 4, background: 'rgba(59,130,246,0.08)', animation: 'pulse 1.5s infinite', marginBottom: 4 }} />
          : <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{insight || recommendation}</div>
        }
        {reasoning && <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>{reasoning}</div>}
        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            {actions.map((a, i) => (
              <span key={i} style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 4,
                background: 'rgba(59,130,246,0.08)', color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600,
              }}>→ {a}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 8, color: '#1e3048', fontFamily: 'JetBrains Mono, monospace' }}>
          🤖 Modelo: {modelLabel || 'mock_quant_v1'} · {moduleId}
          {isLoadingInsight && ' · ✦ analisando...'}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1421 0%, #111827 100%)',
      border: `1px solid ${r.border}`,
      borderRadius: 12, padding: '16px 18px',
      borderLeft: `4px solid ${r.color}`,
      boxShadow: `0 0 20px ${r.color}08`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 600 }}>
            🤖 AI ANALYSIS · {moduleId}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, display: 'inline-block',
            background: r.bg, color: r.color, border: `1px solid ${r.border}`,
          }}>{r.label}</div>
        </div>
        {/* Probability meter */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>PROBABILIDADE</div>
          <div style={{
            fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
            color: probColor, lineHeight: 1, letterSpacing: '-0.04em',
            textShadow: `0 0 20px ${probColor}44`,
          }}>{probability}%</div>
        </div>
      </div>

      {/* Probability bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confiança do modelo</span>
          <span style={{ fontSize: 9, color: probColor, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{probability}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${probability}%`,
            background: `linear-gradient(90deg, ${probColor}88, ${probColor})`,
            transition: 'width 0.8s ease',
          }} />
        </div>
      </div>

      {/* Recommendation */}
      <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(226,232,240,0.03)', border: '1px solid #1a2535', borderRadius: 8 }}>
        <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 700 }}>📋 RECOMENDAÇÃO</div>
        {isLoadingInsight && !insight
          ? <div style={{ height: 14, borderRadius: 4, background: 'rgba(59,130,246,0.08)', animation: 'pulse 1.5s infinite', marginBottom: 4 }} />
          : <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.5 }}>{insight || recommendation}</div>
        }
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7, marginBottom: actions.length > 0 ? 10 : 0 }}>
          {reasoning}
        </div>
      )}

      {/* Action chips */}
      {actions.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, fontWeight: 700 }}>AÇÕES SUGERIDAS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {actions.map((a, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 5,
                background: 'rgba(59,130,246,0.08)', color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.18)', fontWeight: 600,
              }}>→ {a}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 8, color: '#1e3048', fontFamily: 'JetBrains Mono, monospace', borderTop: '1px solid #0f1d2e', paddingTop: 8 }}>
        🤖 Modelo: {modelLabel || 'mock_quant_v1'} · {moduleId}
        {isLoadingInsight && ' · ✦ analisando...'}
      </div>
    </div>
  );
}