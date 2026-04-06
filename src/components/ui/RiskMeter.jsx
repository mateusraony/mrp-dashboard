// Global risk score gauge — v2 professional redesign
import { HelpIcon } from './Tooltip';

export default function RiskMeter({ score, prob, regime, moduleScores }) {
  const regimeColor = regime === 'RISK-ON' ? '#10b981' : regime === 'RISK-OFF' ? '#ef4444' : '#f59e0b';
  const regimeBg = regime === 'RISK-ON' ? 'rgba(16,185,129,0.08)' : regime === 'RISK-OFF' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
  const regimeBorder = regime === 'RISK-ON' ? 'rgba(16,185,129,0.25)' : regime === 'RISK-OFF' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
  const regimeGlow = regime === 'RISK-ON' ? '0 0 24px rgba(16,185,129,0.12)' : regime === 'RISK-OFF' ? '0 0 24px rgba(239,68,68,0.12)' : '0 0 24px rgba(245,158,11,0.12)';

  const needlePos = Math.min(Math.max(score, 0), 100);

  const moduleLabels = { futures: 'Futures', spot: 'Spot', options: 'Options', macro: 'Macro' };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: `1px solid ${regimeBorder}`,
      borderRadius: 14,
      padding: '20px 20px 18px',
      boxShadow: regimeGlow,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle corner glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${regimeColor}, transparent)`,
        opacity: 0.5,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            Global Risk Score
            <HelpIcon title="Global Risk Score" content="Pontuação composta (0–100): Derivatives 35% + Macro 30% + Spot 25% + Options 10%. Acima de 65 = Risk-Off (reduzir longs). Abaixo de 35 = Risk-On. Calculado via função sigmoid sobre os scores de cada módulo." width={270} />
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>Composite — all modules</div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 6,
          background: regimeBg, color: regimeColor, border: `1px solid ${regimeBorder}`,
          letterSpacing: '0.06em',
        }}>
          {regime}
        </span>
      </div>

      {/* Score + Prob row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 18 }}>
        <div>
          <div style={{
            fontSize: 64,
            fontWeight: 900,
            fontFamily: 'JetBrains Mono, monospace',
            color: regimeColor,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            textShadow: `0 0 30px ${regimeColor}44`,
          }}>
            {score}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>/ 100</div>
        </div>
        <div style={{ paddingBottom: 6 }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center' }}>
            Prob. Evento
            <HelpIcon title="Probabilidade de Evento de Risco" content="Probabilidade estimada (%) de ocorrência do evento de risco principal (ex.: long flush, spike de volatilidade) dentro das próximas 4-24h, calculada pela sigmoid do score composto." width={260} />
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            color: regimeColor, lineHeight: 1,
          }}>
            {prob}%
          </div>
        </div>
      </div>

      {/* Gauge bar */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{
          height: 10, borderRadius: 5,
          background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)',
          position: 'relative',
        }}>
          {/* Needle */}
          <div style={{
            position: 'absolute',
            top: -5,
            left: `${needlePos}%`,
            transform: 'translateX(-50%)',
            width: 4, height: 20,
            background: '#fff',
            borderRadius: 2,
            boxShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 4px rgba(0,0,0,0.8)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>Risk-On</span>
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>Neutral</span>
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Risk-Off</span>
        </div>
      </div>

      {/* Module scores */}
      {moduleScores && (
        <div style={{ borderTop: '1px solid #1a2535', paddingTop: 14, marginTop: 6 }}>
          <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
            Breakdown por Módulo
          </div>
          {Object.entries(moduleScores).map(([k, v]) => {
            const barColor = v > 65 ? '#ef4444' : v > 50 ? '#f59e0b' : '#10b981';
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#64748b', width: 56, flexShrink: 0, fontWeight: 500 }}>
                  {moduleLabels[k] || k}
                </span>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#1a2535' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${v}%`,
                    background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{
                  fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
                  color: barColor, fontWeight: 700, width: 28, textAlign: 'right',
                }}>{v}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}