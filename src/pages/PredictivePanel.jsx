// ─── PREDICTIVE PANEL — BTC 24h Price Projection ────────────────────────────
import { useState, useMemo } from 'react';
import {
  scenarios24h, breakoutTable, institutionalPressure, pricePaths,
} from '../components/data/mockDataPredictive';
import { ModeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from 'recharts';
import { useBtcTicker, useKlines, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { IS_LIVE } from '@/lib/env';

const SPOT_FALLBACK = 84298.70;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtK(v) { return `$${(v / 1000).toFixed(1)}K`; }

function ProbBar({ value, color, showPct = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      {showPct && <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 800, minWidth: 32, textAlign: 'right' }}>{value}%</span>}
    </div>
  );
}

// ─── SCENARIO CARD ────────────────────────────────────────────────────────────
function ScenarioCard({ s, selected, onSelect }) {
  const isBull = s.direction === 'bull';
  const isBear = s.direction === 'bear';
  return (
    <div onClick={() => onSelect(s.id)} style={{
      background: selected ? '#131e2e' : '#111827',
      border: `1px solid ${selected ? s.color + '60' : '#1e2d45'}`,
      borderLeft: `4px solid ${s.color}`,
      borderRadius: 11, padding: '12px 14px', cursor: 'pointer',
      transition: 'all 0.13s',
      boxShadow: selected ? `0 0 20px ${s.color}10` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', marginBottom: 2 }}>{s.label}</div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>
            {isBull ? '↑' : isBear ? '↓' : '→'} {s.target_pct > 0 ? '+' : ''}{s.target_pct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{fmtK(s.target_price)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>PROBABILIDADE</div>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color, lineHeight: 1 }}>{s.prob}%</div>
        </div>
      </div>
      <ProbBar value={s.prob} color={s.color} />
      <div style={{ marginTop: 8, fontSize: 9, color: '#334155', lineHeight: 1.5 }}>{s.trigger}</div>
    </div>
  );
}

// ─── BREAKOUT ROW ─────────────────────────────────────────────────────────────
function BreakoutRow({ b, spotPrice: rowSpot = SPOT_FALLBACK }) {
  const isNow   = b.side === 'now';
  const isUp    = b.side === 'up';
  const distPct = Math.abs((b.price - rowSpot) / rowSpot * 100);
  return (
    <tr style={{ borderBottom: '1px solid #0f1a28', background: isNow ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
      <td style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isNow && <span style={{ fontSize: 10, color: isUp ? '#10b981' : '#ef4444' }}>{isUp ? '▲' : '▼'}</span>}
          <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: isNow ? '#f59e0b' : '#e2e8f0', fontWeight: isNow ? 900 : 700 }}>{b.label}</span>
          {isNow && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 800 }}>← SPOT</span>}
        </div>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
        {!isNow && <span style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{distPct.toFixed(1)}%</span>}
      </td>
      <td style={{ padding: '8px 12px' }}>
        {!isNow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${b.prob_touch}%`, background: b.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: b.color, fontWeight: 800, minWidth: 28, textAlign: 'right' }}>{b.prob_touch}%</span>
          </div>
        )}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
        {!isNow && (
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{b.prob_close}%</span>
        )}
      </td>
      <td style={{ padding: '8px 12px', maxWidth: 200 }}>
        <span style={{ fontSize: 9, color: '#334155', lineHeight: 1.4 }}>{b.drivers}</span>
      </td>
    </tr>
  );
}

// ─── PATH CHART ───────────────────────────────────────────────────────────────
function PathChart({ selected, spotPrice: chartSpot = SPOT_FALLBACK }) {
  const data = pricePaths.timestamps.map((t, i) => ({
    t,
    bull:    pricePaths.bull[i],
    neutral: pricePaths.neutral[i],
    bear:    pricePaths.bear[i],
    spot:    chartSpot,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} interval={5} />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10 }}
          formatter={(v, name) => [`$${v.toLocaleString()}`, name]} />
        <ReferenceLine y={chartSpot} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'SPOT', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
        <Area type="monotone" dataKey="bull"    name="Bull"    stroke="#10b981" strokeWidth={selected === 'bull_strong' || selected === 'bull_mild' ? 2.5 : 1.5} fill="url(#bullGrad)"    dot={false} strokeOpacity={selected && !['bull_strong','bull_mild'].includes(selected) ? 0.3 : 1} />
        <Line  type="monotone" dataKey="neutral" name="Neutro" stroke="#f59e0b" strokeWidth={selected === 'neutral' ? 2.5 : 1.5}                                 dot={false} strokeOpacity={selected && selected !== 'neutral' ? 0.3 : 1} strokeDasharray="4 4" />
        <Area type="monotone" dataKey="bear"    name="Bear"    stroke="#ef4444" strokeWidth={selected === 'bear_mild' || selected === 'bear_strong' ? 2.5 : 1.5} fill="url(#bearGrad)" dot={false} strokeOpacity={selected && !['bear_mild','bear_strong'].includes(selected) ? 0.3 : 1} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── INSTITUTIONAL PRESSURE ───────────────────────────────────────────────────
function InstitutionalPanel() {
  const ip = institutionalPressure;
  const scoreColor = ip.overall_score >= 65 ? '#10b981' : ip.overall_score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Pressão Institucional de Compra</div>
            <DataTrustBadge
              mode="paid_required"
              confidence="C"
              source="Glassnode/Bloomberg"
              reason="ETF inflows e stablecoin flows requerem API paga"
            />
          </div>
          <div style={{ fontSize: 9, color: '#334155' }}>Score composto baseado em ETF, stablecoin, CME, VIX e funding</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: scoreColor, lineHeight: 1, letterSpacing: '-0.04em' }}>{ip.overall_score.toFixed(0)}</div>
          <div style={{ fontSize: 8, color: '#334155' }}>/ 100</div>
        </div>
      </div>
      {ip.components.map((c, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#475569' }}>{c.label}</span>
              <span style={{ fontSize: 8, color: c.signal === 'bullish' ? '#10b981' : c.signal === 'bearish' ? '#ef4444' : '#f59e0b', fontWeight: 800, background: c.signal === 'bullish' ? 'rgba(16,185,129,0.1)' : c.signal === 'bearish' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', borderRadius: 3, padding: '1px 5px' }}>
                {c.signal.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontWeight: 700 }}>
              {typeof c.value === 'number' ? (c.value < 1 ? c.value.toFixed(4) : c.value.toFixed(1)) : c.value}{c.unit ? ` ${c.unit}` : ''}
            </span>
          </div>
          <ProbBar value={c.score} color={c.color} showPct={false} />
        </div>
      ))}
      <div style={{ marginTop: 10, fontSize: 10, color: '#64748b', lineHeight: 1.7, padding: '9px 11px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 7 }}>
        {ip.interpretation}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TABS = ['Cenários', 'Trajetórias', 'Prob. Rompimento', 'Pressão Institucional'];

export default function PredictivePanel() {
  const [tab, setTab]         = useState(0);
  const [selected, setSelected] = useState('bull_mild');

  // ── Live data hooks ────────────────────────────────────────────────────
  const { data: ticker }    = useBtcTicker();
  const { data: klines }    = useKlines('1d', 30);
  const { data: fng }       = useFearGreed(1);
  const { data: riskScore } = useRiskScore();

  // ── ATR(14): média de (high - low) dos últimos 14 candles diários ──────
  const atr14 = useMemo(() => {
    if (!klines || klines.length < 14) return null;
    return klines.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;
  }, [klines]);

  const spotPrice = ticker?.mark_price ?? null;

  // ── Cenários com preços live (substituem mock quando disponíveis) ───────
  const liveScenarioPrices = useMemo(() => {
    if (!spotPrice || !atr14) return null;
    return {
      bull_strong: spotPrice + atr14 * 2.5,
      bull_mild:   spotPrice + atr14 * 0.5,
      neutral:     spotPrice,
      bear_mild:   spotPrice - atr14 * 1.5,
      bear_strong: spotPrice - atr14 * 3.5,
    };
  }, [spotPrice, atr14]);

  // ── Análise direcional baseada em regras ────────────────────────────────
  const liveAnalysis = useMemo(() => {
    if (!IS_LIVE || !ticker || !fng) return null;
    return computeRuleBasedAnalysis({
      derivatives: {
        fundingRate: ticker.last_funding_rate,
        oiDeltaPct:  ticker.oi_delta_pct,
      },
      macro: {
        fngValue:   fng.value,
        fngLabel:   fng.label,
        riskScore:  riskScore?.score ?? 50,
        riskRegime: riskScore?.regime ?? 'MODERADO',
      },
    });
  }, [ticker, fng, riskScore]);

  // ── Cenários com preços mesclados (live quando disponível) ─────────────
  const scenarios = useMemo(() => {
    if (!liveScenarioPrices) return scenarios24h;
    const SPOT = spotPrice;
    return scenarios24h.map(s => {
      const liveTarget = liveScenarioPrices[s.id];
      if (liveTarget === undefined || liveTarget === null) return s;
      const target_pct = parseFloat(((liveTarget - SPOT) / SPOT * 100).toFixed(1));
      return { ...s, target_price: liveTarget, target_pct };
    });
  }, [liveScenarioPrices, spotPrice]);

  const SPOT = spotPrice ?? SPOT_FALLBACK;
  const selectedScenario = scenarios.find(s => s.id === selected);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Painel Preditivo BTC 24H</h1>
          <ModeBadge mode={IS_LIVE && spotPrice ? 'live' : 'mock'} />
          <span style={{ fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>🧠 AI-Quantitative</span>
          {liveAnalysis && (() => {
            const d = liveAnalysis.overall.direction;
            const isBull = d === 'bullish' || d === 'bullish_bias';
            const isBear = d === 'bearish' || d === 'bearish_bias';
            const c = isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b';
            const score = Math.round(liveAnalysis.overall.confidence * 100);
            return (
              <span style={{
                fontSize: 9, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                color: c,
                background: `${c}1a`,
                border: `1px solid ${c}4d`,
                borderRadius: 4, padding: '2px 8px',
              }}>
                {isBull ? '↑ BULL' : isBear ? '↓ BEAR' : '→ NEUTRO'} · conf {score}%
              </span>
            );
          })()}
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Projeção baseada em correlações históricas, fluxo de stablecoin, pressão institucional e VIX · Spot: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', fontWeight: 700 }}>${SPOT.toLocaleString()}</span>
          {atr14 && <span style={{ marginLeft: 8, color: '#334155' }}>· ATR(14): <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>${Math.round(atr14).toLocaleString()}</span></span>}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      {/* ── CENÁRIOS ── */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
          {/* Scenario cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scenarios.map(s => (
              <ScenarioCard key={s.id} s={s} selected={selected === s.id} onSelect={setSelected} />
            ))}
          </div>

          {/* Selected detail */}
          {selectedScenario && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Summary */}
              <div style={{ background: '#111827', border: `1px solid ${selectedScenario.color}30`, borderLeft: `4px solid ${selectedScenario.color}`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: selectedScenario.color, marginBottom: 10 }}>{selectedScenario.label}</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>TARGET</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: selectedScenario.color, lineHeight: 1 }}>
                    {fmtK(selectedScenario.target_price)}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {selectedScenario.target_pct > 0 ? '+' : ''}{selectedScenario.target_pct.toFixed(1)}% vs spot
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 5 }}>GATILHO</div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>{selectedScenario.trigger}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 5 }}>DRIVERS</div>
                  {selectedScenario.drivers.map(d => (
                    <div key={d} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: selectedScenario.color, flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: 9, color: '#475569' }}>{d}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 7 }}>
                  <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>⚠️ RISCO</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{selectedScenario.risk}</div>
                </div>
              </div>

              {/* Confidence */}
              <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Confiança do Modelo</div>
                <ProbBar value={Math.round(selectedScenario.confidence * 100)} color={selectedScenario.color} />
                <div style={{ fontSize: 9, color: '#334155', marginTop: 6 }}>
                  Baseado em correlação histórica 30D ({(0.68).toFixed(2)} SPX), stablecoin lag ~12h, VIX {(22.14).toFixed(1)}, funding {(0.0712).toFixed(4)}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TRAJETÓRIAS ── */}
      {tab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Trajetórias de Preço Simuladas — Próximas 24h</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Clique em um cenário para destacar sua trajetória correspondente</div>
            {/* Scenario selector pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {scenarios.map(s => (
                <button key={s.id} onClick={() => setSelected(s.id)} style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: selected === s.id ? `${s.color}18` : 'transparent',
                  border: `1px solid ${selected === s.id ? s.color + '50' : '#1a2535'}`,
                  color: selected === s.id ? s.color : '#475569',
                  cursor: 'pointer', fontSize: 9, fontWeight: 700,
                }}>{s.label} ({s.prob}%)</button>
              ))}
            </div>
            <PathChart selected={selected} spotPrice={SPOT} />
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { color: '#10b981', label: 'Bull (alta)' },
                { color: '#f59e0b', label: 'Neutral (lateral)' },
                { color: '#ef4444', label: 'Bear (queda)' },
                { color: '#f59e0b', label: 'Spot atual', dash: true },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2, background: l.color, borderTop: l.dash ? '2px dashed' : undefined, borderColor: l.color }} />
                  <span style={{ fontSize: 9, color: '#475569' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario summary table */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f1a28' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Resumo dos Cenários</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2535' }}>
                  {['Cenário', 'Target', 'Variação', 'Prob.', 'Confiança'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenarios.map(s => (
                  <tr key={s.id} onClick={() => setSelected(s.id)} style={{ borderBottom: '1px solid #0f1a28', cursor: 'pointer', background: selected === s.id ? '#131e2e' : 'transparent' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 20, background: s.color, borderRadius: 2 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{s.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{fmtK(s.target_price)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: s.color, fontWeight: 800 }}>
                      {s.target_pct > 0 ? '+' : ''}{s.target_pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${s.prob}%`, background: s.color }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: s.color, fontWeight: 800 }}>{s.prob}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{Math.round(s.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PROB. ROMPIMENTO ── */}
      {tab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 9 }}>
            <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>🎯 Metodologia: </span>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              Probabilidade de toque calculada com base em clusters de liquidação, correlação SPX 0.68, pressão institucional (ETF +$284M, stablecoin +$421M) e regime atual (Neutral, 58pts). Lag stablecoin ~12h incluído.
            </span>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f1a28', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Tabela de Probabilidade de Rompimento — Próximas 24H</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 9, color: '#334155' }}>
                <span>■ <span style={{ color: '#10b981' }}>Upside</span></span>
                <span>■ <span style={{ color: '#ef4444' }}>Downside</span></span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2535', background: '#0d1421' }}>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nível</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Distância</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prob. Toque 24H</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prob. Fechamento</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Drivers</th>
                </tr>
              </thead>
              <tbody>
                {breakoutTable.map(b => <BreakoutRow key={b.price} b={b} spotPrice={SPOT} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRESSÃO INSTITUCIONAL ── */}
      {tab === 3 && <InstitutionalPanel />}
    </div>
  );
}