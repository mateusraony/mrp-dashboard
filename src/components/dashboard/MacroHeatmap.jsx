// ─── MACRO CORRELATION HEATMAP ───────────────────────────────────────────────
// Grade de correlação BTC × ativos globais com timeframes 1M / 3M / 6M
// Inclui períodos de stress histórico para referência
import { useState, useMemo } from 'react';
import { btcCorrelations } from '../data/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── DADOS ESTENDIDOS: correlações por janela 1M / 3M / 6M ───────────────────
function seed(n) { return (Math.sin(n * 9301 + 49297) % 1 + 1) / 2; }

function genCorrSeries(base, vol, points, offset = 0) {
  return Array.from({ length: points }, (_, i) => {
    const s = seed(i + offset);
    const v = base + (s - 0.5) * vol * 2;
    return parseFloat(Math.min(0.99, Math.max(-0.99, v)).toFixed(2));
  });
}

const PAIRS = [
  { key: 'SPX',  label: 'S&P 500',   color: '#60a5fa', icon: '📈',
    corr: { '1m': 0.65, '3m': 0.58, '6m': 0.51 },
    series: { '1m': genCorrSeries(0.65, 0.18, 30, 1), '3m': genCorrSeries(0.58, 0.22, 90, 2), '6m': genCorrSeries(0.51, 0.26, 180, 3) },
    desc: 'Correlação positiva forte — BTC se move com o apetite de risco do equity americano.',
  },
  { key: 'DXY',  label: 'DXY',       color: '#ef4444', icon: '💵',
    corr: { '1m': -0.51, '3m': -0.47, '6m': -0.43 },
    series: { '1m': genCorrSeries(-0.51, 0.16, 30, 4), '3m': genCorrSeries(-0.47, 0.19, 90, 5), '6m': genCorrSeries(-0.43, 0.22, 180, 6) },
    desc: 'Correlação negativa — dólar forte = pressão sobre BTC e ativos de risco.',
  },
  { key: 'GOLD', label: 'Gold',      color: '#f59e0b', icon: '🥇',
    corr: { '1m': 0.24, '3m': 0.19, '6m': 0.22 },
    series: { '1m': genCorrSeries(0.24, 0.22, 30, 7), '3m': genCorrSeries(0.19, 0.25, 90, 8), '6m': genCorrSeries(0.22, 0.28, 180, 9) },
    desc: 'Correlação fraca/moderada — ambos são "stores of value" mas divergem em regime de risco.',
  },
  { key: 'US10Y',label: 'US 10Y',   color: '#a78bfa', icon: '📊',
    corr: { '1m': -0.38, '3m': -0.31, '6m': -0.29 },
    series: { '1m': genCorrSeries(-0.38, 0.19, 30, 10), '3m': genCorrSeries(-0.31, 0.22, 90, 11), '6m': genCorrSeries(-0.29, 0.24, 180, 12) },
    desc: 'Yields altos = custo de capital sobe = pressão em ativos especulativos como BTC.',
  },
  { key: 'VIX',  label: 'VIX',       color: '#f97316', icon: '🌡️',
    corr: { '1m': -0.58, '3m': -0.53, '6m': -0.49 },
    series: { '1m': genCorrSeries(-0.58, 0.17, 30, 13), '3m': genCorrSeries(-0.53, 0.20, 90, 14), '6m': genCorrSeries(-0.49, 0.23, 180, 15) },
    desc: 'VIX alto = pânico no mercado = BTC geralmente vende junto com equities em risk-off.',
  },
  { key: 'HY',   label: 'HY Bonds',  color: '#10b981', icon: '🔗',
    corr: { '1m': 0.41, '3m': 0.36, '6m': 0.33 },
    series: { '1m': genCorrSeries(0.41, 0.18, 30, 16), '3m': genCorrSeries(0.36, 0.21, 90, 17), '6m': genCorrSeries(0.33, 0.24, 180, 18) },
    desc: 'Títulos High Yield se movem com apetite a risco — correlação moderada com BTC.',
  },
];

// Períodos históricos de stress
const STRESS_EVENTS = [
  { id: 'covid', label: 'COVID Crash', date: 'Mar 2020', corrSPX: 0.91, corrDXY: -0.82, corrVIX: -0.88, corrGOLD: 0.12, corrUS10Y: 0.21, corrHY: 0.84, note: 'Correlação máxima com equities — sell-off generalizado de ativos de risco.' },
  { id: 'luna',  label: 'LUNA/UST',    date: 'Mai 2022', corrSPX: 0.78, corrDXY: -0.71, corrVIX: -0.74, corrGOLD: 0.08, corrUS10Y: -0.44, corrHY: 0.62, note: 'Contágio interno do crypto + Fed hawkish elevaram correlação com macro.' },
  { id: 'ftx',   label: 'FTX Collapse',date: 'Nov 2022', corrSPX: 0.42, corrDXY: -0.35, corrVIX: -0.41, corrGOLD: 0.18, corrUS10Y: -0.28, corrHY: 0.38, note: 'Evento interno ao crypto — correlação macro reduziu, crise idiossincrática.' },
  { id: 'svb',   label: 'SVB Crisis',  date: 'Mar 2023', corrSPX: -0.18, corrDXY: -0.52, corrVIX: 0.21, corrGOLD: 0.74, corrUS10Y: 0.58, corrHY: -0.22, note: 'BTC se descolou do S&P e subiu como hedge vs crise bancária — comportamento Gold-like.' },
];

function corrColor(v) {
  if (v >= 0.7) return '#10b981';
  if (v >= 0.4) return '#06b6d4';
  if (v >= 0.1) return '#64748b';
  if (v >= -0.1) return '#94a3b8';
  if (v >= -0.4) return '#f59e0b';
  if (v >= -0.7) return '#f97316';
  return '#ef4444';
}

function corrBg(v) {
  const abs = Math.abs(v);
  if (abs >= 0.7) return v >= 0 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)';
  if (abs >= 0.4) return v >= 0 ? 'rgba(6,182,212,0.12)' : 'rgba(249,115,22,0.12)';
  return 'rgba(100,116,139,0.08)';
}

function CorrCell({ value, size = 52 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: corrBg(value),
      border: `1px solid ${corrColor(value)}30`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      cursor: 'default',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: corrColor(value), lineHeight: 1 }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </div>
    </div>
  );
}

const TIMEFRAMES = [
  { key: '1m', label: '1M', points: 30, xLabel: i => `D${i + 1}` },
  { key: '3m', label: '3M', points: 90, xLabel: i => `W${Math.floor(i / 7) + 1}` },
  { key: '6m', label: '6M', points: 180, xLabel: i => `M${Math.floor(i / 30) + 1}` },
];

export default function MacroHeatmap() {
  const [tf, setTf] = useState('1m');
  const [selectedPair, setSelectedPair] = useState(null);
  const [stressEvent, setStressEvent] = useState(null);
  const [tab, setTab] = useState('heatmap'); // 'heatmap' | 'chart' | 'stress'

  const tfCfg = TIMEFRAMES.find(t => t.key === tf);

  const chartData = useMemo(() => {
    const pairs = selectedPair ? PAIRS.filter(p => p.key === selectedPair) : PAIRS;
    return Array.from({ length: tfCfg.points }, (_, i) => {
      const pt = { t: i, label: tfCfg.xLabel(i) };
      pairs.forEach(p => { pt[p.key] = p.series[tf][i]; });
      return pt;
    });
  }, [tf, selectedPair]);

  const displayPairs = selectedPair ? PAIRS.filter(p => p.key === selectedPair) : PAIRS;

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #0f1d2e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🗺️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Macro Heatmap — Correlações BTC</div>
            <div style={{ fontSize: 9, color: '#334155' }}>Pearson rolling · BTC × Ativos Globais · Períodos de stress incluídos</div>
          </div>
        </div>
        {/* TF selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TIMEFRAMES.map(t => (
            <button key={t.key} onClick={() => setTf(t.key)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: tf === t.key ? 'rgba(167,139,250,0.15)' : 'rgba(30,45,69,0.5)',
              color: tf === t.key ? '#a78bfa' : '#475569',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #0f1d2e', padding: '0 18px' }}>
        {[
          { id: 'heatmap', label: '⊞ Grade' },
          { id: 'chart',   label: '📈 Histórico' },
          { id: 'stress',  label: '⚠ Stress' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: tab === t.id ? 700 : 400,
            background: 'transparent',
            color: tab === t.id ? '#a78bfa' : '#475569',
            borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
            transition: 'all 0.12s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '16px 18px' }}>

        {/* ── HEATMAP TAB ── */}
        {tab === 'heatmap' && (
          <>
            {/* Correlation grid */}
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
                <thead>
                  <tr>
                    <th style={{ width: 90, fontSize: 9, color: '#334155', textAlign: 'left', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ativo</th>
                    <th style={{ fontSize: 9, color: '#334155', textAlign: 'center', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>1M</th>
                    <th style={{ fontSize: 9, color: '#334155', textAlign: 'center', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>3M</th>
                    <th style={{ fontSize: 9, color: '#334155', textAlign: 'center', paddingBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>6M</th>
                    <th style={{ fontSize: 9, color: '#334155', textAlign: 'left', paddingBottom: 6, paddingLeft: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Interpretação</th>
                  </tr>
                </thead>
                <tbody>
                  {PAIRS.map(p => (
                    <tr key={p.key} onClick={() => setSelectedPair(sp => sp === p.key ? null : p.key)}
                      style={{ cursor: 'pointer', opacity: selectedPair && selectedPair !== p.key ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                      <td style={{ padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 12 }}>{p.icon}</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{p.label}</div>
                          </div>
                        </div>
                      </td>
                      {['1m', '3m', '6m'].map(t => (
                        <td key={t} style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <CorrCell value={p.corr[t]} />
                        </td>
                      ))}
                      <td style={{ padding: '4px 0 4px 12px', fontSize: 10, color: '#475569', lineHeight: 1.5, maxWidth: 280 }}>
                        {p.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #0f1d2e' }}>
              <span style={{ fontSize: 9, color: '#334155', marginRight: 4, alignSelf: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Escala:</span>
              {[
                { range: '≥ +0.70', label: 'Alta +', color: '#10b981' },
                { range: '+0.40 a +0.70', label: 'Moderada +', color: '#06b6d4' },
                { range: '±0.10', label: 'Sem corr.', color: '#94a3b8' },
                { range: '−0.40 a −0.70', label: 'Moderada −', color: '#f97316' },
                { range: '≤ −0.70', label: 'Alta −', color: '#ef4444' },
              ].map(z => (
                <div key={z.range} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: z.color, opacity: 0.8 }} />
                  <span style={{ fontSize: 9, color: '#334155' }}><span style={{ color: z.color, fontFamily: 'JetBrains Mono, monospace' }}>{z.range}</span> {z.label}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: '#1e3048', marginTop: 8 }}>
              💡 Clique em um ativo para focar · Correlação de Pearson rolling — 0 = sem relação, ±1 = máxima correlação/inversa
            </div>
          </>
        )}

        {/* ── CHART TAB ── */}
        {tab === 'chart' && (
          <>
            {/* Pair selector pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {PAIRS.map(p => (
                <button key={p.key} onClick={() => setSelectedPair(sp => sp === p.key ? null : p.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
                  border: `1px solid ${selectedPair === p.key ? p.color + '60' : '#1a2535'}`,
                  background: selectedPair === p.key ? `${p.color}15` : 'transparent',
                  color: selectedPair === p.key ? p.color : '#475569',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.12s',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedPair === p.key ? p.color : '#334155', flexShrink: 0 }} />
                  {p.label}
                  <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>{p.corr[tf] >= 0 ? '+' : ''}{p.corr[tf].toFixed(2)}</span>
                </button>
              ))}
              {selectedPair && (
                <button onClick={() => setSelectedPair(null)} style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid #1a2535', background: 'transparent', color: '#334155', cursor: 'pointer', fontSize: 10 }}>
                  ✕ Limpar
                </button>
              )}
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false}
                  interval={tf === '1m' ? 4 : tf === '3m' ? 13 : 29} />
                <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
                <ReferenceLine y={0.7} stroke="rgba(16,185,129,0.2)" strokeDasharray="2 4" />
                <ReferenceLine y={-0.7} stroke="rgba(239,68,68,0.2)" strokeDasharray="2 4" />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [`${v >= 0 ? '+' : ''}${v?.toFixed(2)}`, name]} />
                {displayPairs.map(p => (
                  <Line key={p.key} type="monotone" dataKey={p.key} name={p.label} stroke={p.color}
                    strokeWidth={selectedPair === p.key ? 2.5 : 1.5} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Selected pair detail */}
            {selectedPair && (() => {
              const p = PAIRS.find(x => x.key === selectedPair);
              return (
                <div style={{ marginTop: 12, padding: '10px 13px', background: `${p.color}08`, border: `1px solid ${p.color}20`, borderRadius: 9, fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.icon} {p.label}</span><br />{p.desc}
                </div>
              );
            })()}
          </>
        )}

        {/* ── STRESS TAB ── */}
        {tab === 'stress' && (
          <>
            <div style={{ fontSize: 10, color: '#334155', marginBottom: 14 }}>
              Como as correlações do BTC com ativos globais se comportaram em períodos históricos de stress — útil para avaliar o regime atual.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {STRESS_EVENTS.map(ev => (
                <div key={ev.id} onClick={() => setStressEvent(se => se === ev.id ? null : ev.id)}
                  style={{
                    background: stressEvent === ev.id ? 'rgba(167,139,250,0.06)' : '#0d1421',
                    border: `1px solid ${stressEvent === ev.id ? 'rgba(167,139,250,0.35)' : '#1a2535'}`,
                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{ev.label}</span>
                    <span style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>{ev.date}</span>
                  </div>
                  {/* Mini correlation grid for this event */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                    {[
                      { k: 'SPX', label: 'S&P', v: ev.corrSPX },
                      { k: 'DXY', label: 'DXY', v: ev.corrDXY },
                      { k: 'VIX', label: 'VIX', v: ev.corrVIX },
                      { k: 'GOLD', label: 'Gold', v: ev.corrGOLD },
                      { k: 'US10Y', label: '10Y', v: ev.corrUS10Y },
                      { k: 'HY', label: 'HY', v: ev.corrHY },
                    ].map(c => (
                      <div key={c.k} style={{
                        background: corrBg(c.v), border: `1px solid ${corrColor(c.v)}25`,
                        borderRadius: 6, padding: '4px 8px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 8, color: '#475569', marginBottom: 1 }}>{c.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: corrColor(c.v) }}>
                          {c.v >= 0 ? '+' : ''}{c.v.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.6 }}>{ev.note}</div>
                </div>
              ))}
            </div>

            {/* Comparação atual vs stress */}
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>📊 Regime Atual vs Stress Histórico</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                {PAIRS.map(p => {
                  const curr = p.corr['1m'];
                  const svb = STRESS_EVENTS.find(e => e.id === 'svb');
                  const stressRef = svb[`corr${p.key === 'US10Y' ? 'US10Y' : p.key.charAt(0) + p.key.slice(1).toLowerCase()}`] || 0;
                  const diff = curr - stressRef;
                  return (
                    <div key={p.key} style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#334155', marginBottom: 3 }}>{p.icon} {p.label}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: corrColor(curr) }}>
                          {curr >= 0 ? '+' : ''}{curr.toFixed(2)}
                        </span>
                        <span style={{ fontSize: 9, color: '#1e3048', fontFamily: 'JetBrains Mono, monospace' }}>atual</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}