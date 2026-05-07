// ─── AI ANALYSIS PANEL — v2 Professional ───────────────────────────────────
import { ModeBadge } from './DataBadge';

const directionConfig = {
  bullish:       { label: '▲ BULLISH',      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
  bearish:       { label: '▼ BEARISH',      color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
  bearish_bias:  { label: '↘ CAUTELA BEAR', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)' },
  bullish_bias:  { label: '↗ VIÉS BULL',    color: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)' },
  neutral:       { label: '◆ NEUTRO',       color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
};

function ProbBar({ label, value, color }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${Math.round(value * 100)}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <span style={{
          fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
          color, fontWeight: 800, minWidth: 38, textAlign: 'right',
        }}>
          {Math.round(value * 100)}%
        </span>
      </div>
    </div>
  );
}

export function AIModuleCard({ module, title, icon }) {
  const dir = directionConfig[module.direction] || directionConfig.neutral;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: `1px solid ${dir.border}`,
      borderRadius: 12, padding: 18,
      borderLeft: `4px solid ${dir.color}`,
      boxShadow: `0 0 16px ${dir.color}08`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {icon} {title}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
            padding: '4px 9px', borderRadius: 5, display: 'inline-block',
            background: dir.bg, color: dir.color, border: `1px solid ${dir.border}`,
          }}>
            {module.signal}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#334155', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>SCORE</div>
          <div style={{
            fontSize: 30, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
            color: dir.color, lineHeight: 1, letterSpacing: '-0.04em',
            textShadow: `0 0 20px ${dir.color}44`,
          }}>{module.score}</div>
        </div>
      </div>

      {/* Prob + Conf */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <ProbBar label="Probabilidade" value={module.probability} color={dir.color} />
        <ProbBar label="Confiança" value={module.confidence} color="#475569" />
      </div>

      {/* Timeframe */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 5,
          background: 'rgba(59,130,246,0.08)', color: '#60a5fa',
          border: '1px solid rgba(59,130,246,0.2)',
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
        }}>⏱ {module.timeframe}</span>
        <ModeBadge />
      </div>

      {/* Trigger */}
      <div style={{
        marginBottom: 10, padding: '9px 11px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.18)',
        borderRadius: 8,
      }}>
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          🎯 GATILHO DE ATIVAÇÃO
        </div>
        <div style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6 }}>
          {module.trigger}
        </div>
      </div>

      {/* Analysis */}
      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
        {module.analysis}
      </div>
    </div>
  );
}

export default function AIAnalysisPanel({ analysis, compact = false }) {
  const dir = directionConfig[analysis.overall.direction] || directionConfig.neutral;

  const OverallCard = () => (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: `1px solid ${dir.border}`,
      borderRadius: 14, padding: 22,
      borderLeft: `4px solid ${dir.color}`,
      boxShadow: `0 0 24px ${dir.color}0a`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🤖 AI · {analysis.model} · {analysis.overall.timeframe}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: dir.color, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {analysis.overall.recommendation}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 6,
            background: dir.bg, color: dir.color, border: `1px solid ${dir.border}`,
            fontWeight: 700, letterSpacing: '0.04em',
          }}>{dir.label}</span>
          <ModeBadge />
        </div>
      </div>

      {/* Prob + Conf */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <ProbBar label="Prob. Correção" value={analysis.overall.probability_correction} color={dir.color} />
        <ProbBar label="Confiança do Modelo" value={analysis.overall.confidence} color="#475569" />
      </div>

      {/* Trigger */}
      <div style={{
        marginBottom: 14, padding: '10px 13px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.18)',
        borderRadius: 9,
      }}>
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          🎯 GATILHO PARA DECISÃO
        </div>
        <div style={{ fontSize: 12, color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6 }}>
          {analysis.overall.trigger}
        </div>
      </div>

      {/* Rationale */}
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 14 }}>
        {analysis.overall.rationale}
      </div>

      {/* Bull / Bear */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ padding: '11px 13px', borderRadius: 9, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, marginBottom: 5 }}>🟢 BULL CASE</div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{analysis.overall.bull_case}</div>
        </div>
        <div style={{ padding: '11px 13px', borderRadius: 9, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 5 }}>🔴 BEAR CASE</div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{analysis.overall.bear_case}</div>
        </div>
      </div>
    </div>
  );

  if (compact) return <OverallCard />;

  return (
    <div>
      <div style={{ marginBottom: 16 }}><OverallCard /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <AIModuleCard module={analysis.modules.derivatives} title="Derivatives" icon="⟆" />
        <AIModuleCard module={analysis.modules.spot} title="Spot Flow" icon="⟴" />
        <AIModuleCard module={analysis.modules.options} title="Options" icon="◬" />
        <AIModuleCard module={analysis.modules.macro} title="Macro Board" icon="⊞" />
      </div>
    </div>
  );
}