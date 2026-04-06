// ─── MARKET REGIME PAGE ───────────────────────────────────────────────────────
import { useState } from 'react';
import {
  marketRegime, regimeComponents, radarData, regimeHistory,
  regimeTransitions, exposureSuggestions,
} from '../components/data/mockDataRegime';
import { ModeBadge } from '../components/ui/DataBadge';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, borderRadius: 3, background: `linear-gradient(90deg, ${color}70, ${color})`, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, minWidth: 32, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

// ─── REGIME BADGE ─────────────────────────────────────────────────────────────
function RegimeBadge({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 8, border: `1px solid ${active ? color + '60' : '#1a2535'}`,
      background: active ? `${color}14` : 'transparent',
      color: active ? color : '#334155', cursor: 'pointer', fontSize: 11, fontWeight: active ? 800 : 400,
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

// ─── COMPONENT CARD ──────────────────────────────────────────────────────────
function ComponentCard({ c, regimeColor }) {
  const scoreColor = c.score >= 65 ? '#10b981' : c.score >= 40 ? '#f59e0b' : '#ef4444';
  const scoreLabel = c.score >= 65 ? 'Risk-On' : c.score >= 40 ? 'Neutral' : 'Risk-Off';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{c.icon} {c.label}</div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{c.raw}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#334155', marginBottom: 1 }}>SCORE</div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: scoreColor, lineHeight: 1 }}>{c.score}</div>
          <div style={{ fontSize: 7, color: scoreColor, fontWeight: 800, textTransform: 'uppercase' }}>{scoreLabel}</div>
        </div>
      </div>
      <ScoreBar score={c.score} color={scoreColor} />
      <div style={{ fontSize: 9, color: '#334155', marginTop: 5, lineHeight: 1.5 }}>{c.description}</div>
      <div style={{ fontSize: 8, color: '#1e3048', marginTop: 3 }}>Peso: {(c.weight * 100).toFixed(0)}%</div>
    </div>
  );
}

// ─── TRANSITION ROW ──────────────────────────────────────────────────────────
function TransitionRow({ t }) {
  const toColor = t.to === 'Risk-On' ? '#10b981' : t.to === 'Risk-Off' ? '#ef4444' : '#f59e0b';
  const fromColor = t.from === 'Risk-On' ? '#10b981' : t.from === 'Risk-Off' ? '#ef4444' : '#f59e0b';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #0f1a28' }}>
      <span style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace', minWidth: 42 }}>{t.date}</span>
      <span style={{ fontSize: 9, color: fromColor, fontWeight: 700 }}>{t.from}</span>
      <span style={{ fontSize: 10, color: '#334155' }}>→</span>
      <span style={{ fontSize: 9, color: toColor, fontWeight: 800 }}>{t.to}</span>
      <span style={{ fontSize: 9, color: '#475569', flex: 1 }}>{t.trigger}</span>
    </div>
  );
}

// ─── SUGGESTION CARD ─────────────────────────────────────────────────────────
function SuggestionCard({ s }) {
  const dirColor = s.direction === '↑' ? '#10b981' : s.direction === '↓' ? '#ef4444' : '#f59e0b';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: dirColor, lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{s.direction}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{s.action}</div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginTop: 3 }}>{s.detail}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>CONF.</div>
          <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: dirColor }}>{(s.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${s.confidence * 100}%`, background: dirColor, borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ─── RADAR CUSTOM TOOLTIP ─────────────────────────────────────────────────────
function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { metric, value } = payload[0]?.payload || {};
  const label = value >= 65 ? 'Risk-On' : value >= 40 ? 'Neutral' : 'Risk-Off';
  const color = value >= 65 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{metric}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, color, fontSize: 16 }}>{value}</div>
      <div style={{ fontSize: 9, color, fontWeight: 700 }}>{label}</div>
    </div>
  );
}

// ─── HISTORY CHART TOOLTIP ────────────────────────────────────────────────────
function HistTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value;
  const regime = score >= 62 ? 'Risk-On' : score <= 38 ? 'Risk-Off' : 'Neutral';
  const color  = regime === 'Risk-On' ? '#10b981' : regime === 'Risk-Off' ? '#ef4444' : '#f59e0b';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, color }}>{score}</div>
      <div style={{ fontSize: 9, color, fontWeight: 700 }}>{regime}</div>
    </div>
  );
}

const REGIME_TABS = ['Radar & Score', 'Histórico', 'Transições', 'Sugestões AI'];

export default function MarketRegime() {
  const rm = marketRegime;
  const [tab, setTab] = useState(0);
  const suggestions = exposureSuggestions[rm.label];

  // Gradiente dinâmico baseado no score para o gráfico de histórico
  const histColor = rm.score >= 62 ? '#10b981' : rm.score <= 38 ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Regime de Mercado</h1>
          <ModeBadge mode="mock" />
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Classificação automática Risk-On / Risk-Off / Neutral · Yield Curve · DXY · VIX · Funding · NUPL
        </p>
      </div>

      {/* ── REGIME HERO ── */}
      <div style={{
        background: rm.bg, border: `1px solid ${rm.border}`,
        borderLeft: `5px solid ${rm.color}`,
        borderRadius: 14, padding: '20px 24px', marginBottom: 16,
        display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
        boxShadow: `0 0 40px ${rm.color}0a`,
      }}>
        {/* Score display */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Score Global</div>
          <div style={{
            fontSize: 72, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
            color: rm.color, lineHeight: 1, letterSpacing: '-0.05em',
            textShadow: `0 0 40px ${rm.color}40`,
          }}>{rm.score}</div>
          <div style={{ fontSize: 9, color: '#334155' }}>/ 100</div>
        </div>

        {/* Regime labels */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: rm.color, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1 }}>
            {rm.label}
          </div>
          {/* Sub-scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 340 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>RISK-ON STRENGTH</span>
                <span style={{ fontSize: 9, color: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{rm.risk_on_score}</span>
              </div>
              <ScoreBar score={rm.risk_on_score} color="#10b981" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>NEUTRAL STRENGTH</span>
                <span style={{ fontSize: 9, color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{rm.neutral_score}</span>
              </div>
              <ScoreBar score={rm.neutral_score} color="#f59e0b" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>RISK-OFF STRENGTH</span>
                <span style={{ fontSize: 9, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{rm.risk_off_score}</span>
              </div>
              <ScoreBar score={rm.risk_off_score} color="#ef4444" />
            </div>
          </div>
        </div>

        {/* Quick suggestion */}
        <div style={{ background: `${rm.color}0a`, border: `1px solid ${rm.color}25`, borderRadius: 10, padding: '14px 16px', maxWidth: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: rm.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>💡 AI Suggestion</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4 }}>{suggestions.label}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>Ver detalhes na aba Sugestões AI</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 16 }}>
        {REGIME_TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>

      {/* ── RADAR & SCORE ── */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Radar */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Radar de Regime</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Score por componente · 100 = Risk-On máximo · 0 = Risk-Off máximo</div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="rgba(30,45,69,0.8)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#1e3048' }} tickCount={5} />
                <Radar name="Score" dataKey="value" stroke={rm.color} fill={rm.color} fillOpacity={0.15} strokeWidth={2} dot={{ fill: rm.color, r: 4 }} />
                {/* Risk-On baseline */}
                <Radar name="Risk-On (62)" dataKey={() => 62} stroke="rgba(16,185,129,0.2)" fill="transparent" strokeDasharray="4 4" strokeWidth={1} dot={false} />
                <Tooltip content={<RadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
            {/* Thresholds legend */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2, background: 'rgba(16,185,129,0.4)' }} />
                <span style={{ fontSize: 8, color: '#334155' }}>Risk-On (62)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2, background: rm.color }} />
                <span style={{ fontSize: 8, color: '#334155' }}>Atual</span>
              </div>
            </div>
          </div>

          {/* Components */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>Componentes do Regime</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {regimeComponents.map(c => <ComponentCard key={c.key} c={c} regimeColor={rm.color} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {tab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Score de Regime — Últimos 90 Dias</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>
              Score composto ponderado · &gt;62 = Risk-On · 38–62 = Neutral · &lt;38 = Risk-Off
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={regimeHistory} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="regimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={histColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={histColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={14} />
                <YAxis domain={[0, 100]} ticks={[0, 38, 62, 100]} tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip content={<HistTooltip />} />
                {/* Zone bands */}
                <ReferenceLine y={62} stroke="rgba(16,185,129,0.35)" strokeDasharray="4 4" label={{ value: 'Risk-On', fill: '#10b981', fontSize: 9, position: 'right' }} />
                <ReferenceLine y={38} stroke="rgba(239,68,68,0.35)" strokeDasharray="4 4" label={{ value: 'Risk-Off', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                <Area type="monotone" dataKey="score" stroke={histColor} strokeWidth={2} fill="url(#regimeGrad)" dot={false} activeDot={{ r: 4, fill: histColor }} />
                {/* Transition markers */}
                {regimeTransitions.map(t => (
                  <ReferenceLine key={t.id} x={regimeHistory[t.idx]?.label}
                    stroke={t.to === 'Risk-On' ? '#10b981' : t.to === 'Risk-Off' ? '#ef4444' : '#f59e0b'}
                    strokeDasharray="2 2" strokeWidth={1.5} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 9, color: '#1e3048', marginTop: 6 }}>
              Linhas verticais = transições de regime · Zona verde = Risk-On · Zona vermelha = Risk-Off
            </div>
          </div>

          {/* Regime distribution */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Distribuição de Regime nos Últimos 90D</div>
            {(() => {
              const on  = regimeHistory.filter(d => d.regime === 'Risk-On').length;
              const off = regimeHistory.filter(d => d.regime === 'Risk-Off').length;
              const neu = regimeHistory.filter(d => d.regime === 'Neutral').length;
              const total = regimeHistory.length;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
                  {[
                    { label: 'Risk-On', count: on, color: '#10b981' },
                    { label: 'Neutral', count: neu, color: '#f59e0b' },
                    { label: 'Risk-Off', count: off, color: '#ef4444' },
                  ].map(r => (
                    <div key={r.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: r.color, fontWeight: 700 }}>{r.label}</span>
                        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{r.count}d ({(r.count / total * 100).toFixed(0)}%)</span>
                      </div>
                      <ScoreBar score={Math.round(r.count / total * 100)} color={r.color} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TRANSIÇÕES ── */}
      {tab === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Transições de Regime Recentes (90D)</div>
            {regimeTransitions.map(t => <TransitionRow key={t.date} t={t} />)}
          </div>
          {/* What triggers transitions */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Gatilhos Típicos de Transição</div>
            {[
              { from: 'Neutral', to: 'Risk-On', triggers: ['CPI abaixo do esperado', 'Fed dovish surprise', 'VIX caindo abaixo de 16', 'DXY −2% no mês', 'S&P > ATH'], color: '#10b981' },
              { from: 'Risk-On', to: 'Neutral', triggers: ['VIX subindo para 20-25', 'Funding positivo extremo', 'NUPL acima de 0.65', 'DXY estabilizando'], color: '#f59e0b' },
              { from: 'Neutral', to: 'Risk-Off', triggers: ['CPI acima do esperado', 'Fed hawkish', 'VIX > 28', 'DXY +3% no mês', 'Yield invertendo'], color: '#ef4444' },
            ].map(g => (
              <div key={g.from + g.to} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, color: '#475569' }}>{g.from}</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>→</span>
                  <span style={{ fontSize: 10, color: g.color, fontWeight: 800 }}>{g.to}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {g.triggers.map(tr => (
                    <span key={tr} style={{ fontSize: 9, color: '#475569', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 4, padding: '2px 7px' }}>{tr}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUGESTÕES AI ── */}
      {tab === 3 && (
        <div>
          {/* Regime summary */}
          <div style={{ background: rm.bg, border: `1px solid ${rm.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: rm.color }}>Regime: {rm.label} (Score: {rm.score})</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{suggestions.label}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.7 }}>
              Com base nos componentes do regime atual — Yield Curve +{(28.1).toFixed(1)}bp, DXY −3.4% no mês, VIX em {(22.14).toFixed(1)}, Funding +0.071%, NUPL 0.48 — o modelo classifica o ambiente como <strong style={{ color: rm.color }}>{rm.label}</strong>. As sugestões abaixo refletem ajustes de exposição calibrados para este regime. Todas são sugestões quantitativas, não recomendações de investimento.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {suggestions.suggestions.map(s => <SuggestionCard key={s.action} s={s} />)}
          </div>

          {/* Other regimes preview */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Como a exposição muda em outros regimes:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {Object.entries(exposureSuggestions)
                .filter(([k]) => k !== rm.label)
                .map(([label, data]) => {
                  const color = label === 'Risk-On' ? '#10b981' : label === 'Risk-Off' ? '#ef4444' : '#f59e0b';
                  return (
                    <div key={label} style={{ background: '#111827', border: `1px solid ${color}20`, borderRadius: 10, padding: '12px 14px', opacity: 0.65 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>{data.label}</div>
                      {data.suggestions.slice(0, 2).map(s => (
                        <div key={s.action} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, color: s.direction === '↑' ? '#10b981' : s.direction === '↓' ? '#ef4444' : '#f59e0b', fontWeight: 900, lineHeight: 1 }}>{s.direction}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{s.action}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '10px 13px', background: 'rgba(30,45,69,0.3)', border: '1px solid #1a2535', borderRadius: 8, fontSize: 9, color: '#334155', lineHeight: 1.7 }}>
            ⚠️ Sugestões baseadas em modelo quantitativo com dados históricos. Não constituem recomendação de investimento. Sempre valide com análise fundamental e considere seu perfil de risco pessoal.
          </div>
        </div>
      )}
    </div>
  );
}