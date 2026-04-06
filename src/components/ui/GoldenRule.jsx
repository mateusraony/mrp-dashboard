// ─── REGRA DE OURO — Componente reutilizável ─────────────────────────────────
// Mostra o impacto histórico de eventos macro em BTC
// Use em qualquer página que mencione CPI, FOMC, NFP, PCE

const RULES = [
  { event: 'CPI acima do esperado',      impact: 'BTC médio -5.8%', dir: 'bear', icon: '📈➡🔴', note: 'Inflação acima = Fed mais hawkish = sell-off cripto' },
  { event: 'FOMC hawkish surprise',      impact: 'BTC médio -3.2%', dir: 'bear', icon: '🏦➡🔴', note: 'Tom mais duro do Fed = custo de capital sobe = saída de risco' },
  { event: 'PCE abaixo do esperado',     impact: 'BTC médio +2.8%', dir: 'bull', icon: '📉➡🟢', note: 'Inflação PCE fria = Fed mais dovish = apetite a risco sobe' },
  { event: 'NFP fraco → Fed dovish',     impact: 'BTC médio +1.8%', dir: 'bull', icon: '👷➡🟢', note: 'Emprego fraco = Fed pausará altas = liquidez permanece' },
];

export default function GoldenRule({ compact = false }) {
  if (compact) {
    return (
      <div style={{
        padding: '10px 14px',
        background: 'rgba(245,158,11,0.05)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderLeft: '3px solid #f59e0b',
        borderRadius: 8,
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12 }}>⚠️</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>Regra de Ouro — Macro → BTC</span>
          <span style={{ fontSize: 9, color: '#475569', marginLeft: 4 }}>Histórico 18 meses</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RULES.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 5,
              background: r.dir === 'bear' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              border: `1px solid ${r.dir === 'bear' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{r.event}</span>
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: r.dir === 'bear' ? '#ef4444' : '#10b981' }}>
                {r.impact}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#111827',
      border: '1px solid rgba(245,158,11,0.25)',
      borderTop: '3px solid #f59e0b',
      borderRadius: 12,
      padding: '16px 18px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>Regra de Ouro — Impacto Macro em BTC</div>
          <div style={{ fontSize: 9, color: '#475569' }}>Baseado em histórico dos últimos 18 meses · Médias de retorno 24h pós-evento</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        {RULES.map((r, i) => (
          <div key={i} style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: r.dir === 'bear' ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
            border: `1px solid ${r.dir === 'bear' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, flex: 1 }}>• {r.event}</span>
              <span style={{
                fontSize: 12, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
                color: r.dir === 'bear' ? '#ef4444' : '#10b981',
                marginLeft: 8, flexShrink: 0,
              }}>
                {r.impact}
              </span>
            </div>
            <div style={{ fontSize: 8, color: '#475569', lineHeight: 1.5 }}>{r.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}