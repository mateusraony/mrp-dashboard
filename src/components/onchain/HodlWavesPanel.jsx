/**
 * HodlWavesPanel.jsx — Distribuição de Supply BTC por Tempo de Detenção
 *
 * Painel visual de HODL Waves com barra horizontal em CSS puro (sem Recharts)
 * para evitar aumento de bundle. Usa dados de useOnChainExtended().
 *
 * Coortes derivadas (proxies — SplyAdr1yrPlus CoinMetrics Community):
 *   - Muito Long Term (>2yr):  hodl_pct * 0.45
 *   - Long Term (1-2yr):       hodl_pct * 0.55
 *   - Mid Term (6m-1yr):       active_pct * 0.35
 *   - Short Term (1-6m):       active_pct * 0.35
 *   - Active (<1m):            active_pct * 0.30
 */

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const COHORT_COLORS = ['#10b981', '#34d399', '#60a5fa', '#93c5fd', '#f59e0b'];

/** Interpreta dormancy baseado no valor proxy (CDD / AdrActCnt) */
function dormancyLabel(value) {
  if (value > 10_000) return { label: 'Muito Alto', color: '#ef4444' };
  if (value > 5_000)  return { label: 'Alto',       color: '#f59e0b' };
  if (value > 1_000)  return { label: 'Médio',      color: '#94a3b8' };
  return                     { label: 'Baixo',       color: '#10b981' };
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function HodlWavesPanel({ liveExtended }) {
  // Valores base com fallback razoável para ciclo atual
  const hodlPct  = liveExtended?.hodl_wave_1yr_pct ?? 0.705;  // fração (0-1)
  const activePct = 1 - hodlPct;                               // complemento
  const dormancy = liveExtended?.dormancy_value    ?? 9.4;
  const quality  = liveExtended?.quality           ?? 'B';
  const source   = liveExtended?.source            ?? 'mock';

  // Coortes derivadas (aproximações proporcionais)
  const cohorts = [
    {
      label: 'Muito Long Term (>2yr)',
      pct:   hodlPct * 0.45,
      color: COHORT_COLORS[0],
    },
    {
      label: 'Long Term (1-2yr)',
      pct:   hodlPct * 0.55,
      color: COHORT_COLORS[1],
    },
    {
      label: 'Mid Term (6m-1yr)',
      pct:   activePct * 0.35,
      color: COHORT_COLORS[2],
    },
    {
      label: 'Short Term (1-6m)',
      pct:   activePct * 0.35,
      color: COHORT_COLORS[3],
    },
    {
      label: 'Active (<1m)',
      pct:   activePct * 0.30,
      color: COHORT_COLORS[4],
    },
  ];

  const dorm = dormancyLabel(dormancy);
  const isLive = source !== 'mock';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45',
      borderTop: '3px solid #10b981',
      borderRadius: 12,
      padding: '16px 18px',
      gridColumn: '1 / -1',  // ocupa largura total na grid
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
            HODL Waves — Distribuição de Supply por Tempo de Detenção
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, color: '#64748b',
              background: 'rgba(100,116,139,0.1)',
              border: '1px solid rgba(100,116,139,0.2)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              proxy — SplyAdr1yrPlus CoinMetrics Community
            </span>
            {isLive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#10b981' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                CoinMetrics · Grátis · Qualidade {quality}
              </span>
            )}
          </div>
        </div>

        {/* Dormancy badge */}
        <div style={{
          background: 'rgba(30,45,69,0.5)',
          border: `1px solid ${dorm.color}30`,
          borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 100,
        }}>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            Dormancy Proxy
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: dorm.color }}>
            {dormancy >= 1000
              ? `${(dormancy / 1000).toFixed(1)}K`
              : dormancy.toFixed(1)}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700, color: dorm.color,
            background: `${dorm.color}15`,
            border: `1px solid ${dorm.color}30`,
            borderRadius: 4, padding: '1px 6px', marginTop: 3,
          }}>
            {dorm.label}
          </div>
        </div>
      </div>

      {/* Label percentuais topo */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#4a6580', marginBottom: 2 }}>
          <span style={{ color: '#10b981', fontWeight: 600 }}>
            HODL &gt;1yr: {(hodlPct * 100).toFixed(1)}%
          </span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>
            Ativo &lt;1yr: {(activePct * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Barra horizontal stacked — CSS Flexbox */}
      <div style={{
        display: 'flex',
        height: 28,
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 12,
        border: '1px solid #1e2d45',
      }}>
        {cohorts.map((c, i) => (
          <div
            key={i}
            title={`${c.label}: ${(c.pct * 100).toFixed(2)}%`}
            style={{
              width: `${c.pct * 100}%`,
              background: c.color,
              opacity: 0.85,
              position: 'relative',
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.15s',
              minWidth: c.pct * 100 > 5 ? undefined : 0,
            }}
          >
            {/* Mostra % dentro do segmento apenas se largo o suficiente */}
            {c.pct * 100 > 8 && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#0d1421',
                fontFamily: 'JetBrains Mono, monospace',
                textShadow: '0 0 4px rgba(255,255,255,0.3)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                {(c.pct * 100).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
        {cohorts.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 2,
              background: c.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 9, color: '#64748b' }}>
              {c.label}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color: c.color,
            }}>
              {(c.pct * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Nota metodológica */}
      <div style={{
        marginTop: 12, padding: '6px 10px',
        borderRadius: 6, background: 'rgba(30,45,69,0.4)',
        border: '1px solid #1e2d45', fontSize: 9, color: '#4a6580', lineHeight: 1.6,
      }}>
        As coortes são aproximações proporcionais derivadas de SplyAdr1yrPlus (CoinMetrics Community).
        Para granularidade exata por coorte (1d, 1w, 1m, 3m, 6m, 1-2yr, 2-3yr, 3-5yr, 5yr+),
        é necessário o endpoint pago da CoinMetrics ou Glassnode.
      </div>
    </div>
  );
}
