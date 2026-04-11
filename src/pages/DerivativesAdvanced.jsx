// ─── DERIVATIVES ADVANCED — Liquidation Heatmap · OI by Strike · Carry Calculator
import { useState } from 'react';
import {
  liquidationClusters, futuresBasis, termStructure,
} from '../components/data/mockDataExtended';
import { btcOptionsExtended } from '../components/data/mockData';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import AIInsightPanel from '../components/ai/AIInsightPanel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ComposedChart, Line,
} from 'recharts';

const SPOT = 84298.70;
const US10Y = 4.512;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtM(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function SectionTitle({ title, sub, badge }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{title}</div>
        {badge && <GradeBadge grade={badge} />}
        <ModeBadge mode="mock" />
      </div>
      {sub && <div style={{ fontSize: 10, color: '#475569' }}>{sub}</div>}
    </div>
  );
}

// ─── LIQ HEATMAP — Gráfico de barras horizontal duplo (longs ← | → shorts) ──
function LiqHeatmapFull() {
  const d = liquidationClusters;
  const [hover, setHover] = useState(null);

  // Ordenar por preço crescente para o gráfico
  const sorted = [...d.clusters].sort((a, b) => a.price - b.price);
  const maxVal = Math.max(...sorted.map(c => Math.max(c.longs_usd, c.shorts_usd)));

  // Prob AI: ratio longs vs shorts em risco
  const longRisk = d.total_longs_at_risk_10pct;
  const shortRisk = d.total_shorts_at_risk_10pct;
  const totalRisk = longRisk + shortRisk;
  const probLongFlush = Math.round((longRisk / totalRisk) * 100);

  // Maior ameaça imediata (cluster abaixo/acima mais próximo)
  const closestLong  = [...sorted].filter(c => c.price < SPOT).sort((a, b) => b.price - a.price)[0];
  const closestShort = [...sorted].filter(c => c.price > SPOT).sort((a, b) => a.price - b.price)[0];
  const distLong  = ((SPOT - closestLong?.price) / SPOT * 100).toFixed(1);
  const distShort = ((closestShort?.price - SPOT) / SPOT * 100).toFixed(1);

  return (
    <div>
      <SectionTitle
        title="Liquidation Cluster Heatmap"
        sub={`Spot atual: $${SPOT.toLocaleString()} · Barras VERMELHAS = longs que serão liquidados se preço CAIR · VERDES = shorts se preço SUBIR`}
        badge={d.quality}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>Longs em Risco (−10%)</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>{fmtM(longRisk)}</div>
          <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>Maior: ${(d.largest_long_cluster.price / 1000).toFixed(0)}K → {fmtM(d.largest_long_cluster.usd)}</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#10b981', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>Shorts em Risco (+10%)</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{fmtM(shortRisk)}</div>
          <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>Maior: ${(d.largest_short_cluster.price / 1000).toFixed(0)}K → {fmtM(d.largest_short_cluster.usd)}</div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>Cluster Long + Próximo</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>${(closestLong?.price / 1000).toFixed(0)}K</div>
          <div style={{ fontSize: 8, color: '#334155' }}>−{distLong}% do spot · {fmtM(closestLong?.longs_usd)}</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#10b981', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>Cluster Short + Próximo</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>${(closestShort?.price / 1000).toFixed(0)}K</div>
          <div style={{ fontSize: 8, color: '#334155' }}>+{distShort}% do spot · {fmtM(closestShort?.shorts_usd)}</div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 9, color: '#475569' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Longs liquidados (preço cai até esse nível)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Shorts liquidados (preço sobe até esse nível)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Preço Spot Atual</span>
      </div>

      {/* Gráfico horizontal duplo — cada linha é um preço, barras opostas */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Lado esquerdo — LONGS (barras crescem da direita para a esquerda) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 8, color: '#ef4444', textAlign: 'right', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>← LONGS EM RISCO (se preço cair)</div>
          {sorted.slice().reverse().map((c) => {
            const isAbove = c.price > SPOT;
            const isSpot = Math.abs(c.price - SPOT) < 200;
            const val = c.longs_usd;
            const pct = (val / maxVal) * 100;
            const isHov = hover === c.price;
            return (
              <div key={`L-${c.price}`}
                onMouseEnter={() => setHover(c.price)}
                onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, height: 22 }}>
                {/* Value label */}
                <div style={{ width: 50, textAlign: 'right', fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: isAbove ? '#1e3048' : '#ef4444', flexShrink: 0 }}>
                  {!isAbove ? fmtM(val) : ''}
                </div>
                {/* Bar fills right-to-left */}
                <div style={{ flex: 1, height: 16, background: '#0d1421', borderRadius: '3px 0 0 3px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                  {!isAbove && (
                    <div style={{ width: `${pct}%`, height: '100%', background: isHov ? '#f87171' : `rgba(239,68,68,${0.2 + pct/100*0.7})`, borderRadius: '3px 0 0 3px', boxShadow: pct > 50 ? '0 0 8px rgba(239,68,68,0.4)' : 'none' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Centro — PRICE LABELS */}
        <div style={{ width: 70, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', marginTop: 22 }}>
          {sorted.slice().reverse().map((c) => {
            const isSpot = Math.abs(c.price - SPOT) < 200;
            const isHov = hover === c.price;
            return (
              <div key={`P-${c.price}`} style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  fontSize: isSpot ? 10 : 9,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: isSpot ? 900 : isHov ? 700 : 400,
                  color: isSpot ? '#f59e0b' : isHov ? '#e2e8f0' : '#475569',
                  padding: isSpot ? '1px 5px' : '0',
                  background: isSpot ? 'rgba(245,158,11,0.1)' : 'transparent',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}>
                  ${(c.price / 1000).toFixed(0)}K{isSpot ? ' ◀▶' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Lado direito — SHORTS (barras crescem da esquerda para a direita) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 8, color: '#10b981', textAlign: 'left', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>SHORTS EM RISCO (se preço subir) →</div>
          {sorted.slice().reverse().map((c) => {
            const isAbove = c.price > SPOT;
            const val = c.shorts_usd;
            const pct = (val / maxVal) * 100;
            const isHov = hover === c.price;
            return (
              <div key={`S-${c.price}`}
                onMouseEnter={() => setHover(c.price)}
                onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, height: 22 }}>
                <div style={{ flex: 1, height: 16, background: '#0d1421', borderRadius: '0 3px 3px 0', overflow: 'hidden' }}>
                  {isAbove && (
                    <div style={{ width: `${pct}%`, height: '100%', background: isHov ? '#34d399' : `rgba(16,185,129,${0.2 + pct/100*0.7})`, borderRadius: '0 3px 3px 0', boxShadow: pct > 50 ? '0 0 8px rgba(16,185,129,0.4)' : 'none' }} />
                  )}
                </div>
                <div style={{ width: 50, fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: isAbove ? '#10b981' : '#1e3048', flexShrink: 0 }}>
                  {isAbove ? fmtM(val) : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {hover && (() => {
        const c = sorted.find(x => x.price === hover);
        if (!c) return null;
        return (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>${c.price.toLocaleString()}</span>
            <span>Longs: <strong style={{ color: '#ef4444' }}>{fmtM(c.longs_usd)}</strong></span>
            <span>Shorts: <strong style={{ color: '#10b981' }}>{fmtM(c.shorts_usd)}</strong></span>
            <span style={{ color: '#475569' }}>{c.price > SPOT ? `+${((c.price - SPOT)/SPOT*100).toFixed(1)}% acima do spot` : `−${((SPOT - c.price)/SPOT*100).toFixed(1)}% abaixo do spot`}</span>
          </div>
        );
      })()}

      {/* AI Panel */}
      <div style={{ marginTop: 16 }}>
        <AIInsightPanel
          moduleId="LIQ_CLUSTERS"
          probability={probLongFlush}
          regime={probLongFlush > 65 ? 'flush_risk' : probLongFlush > 50 ? 'caution' : 'neutral'}
          recommendation={
            probLongFlush > 65
              ? `Alta concentração de longs em risco — ${fmtM(longRisk)} seriam liquidados em queda de 10%. Reduzir exposição comprada.`
              : `Estrutura equilibrada. Maior ameaça imediata: cluster de longs em $${(closestLong?.price/1000).toFixed(0)}K (−${distLong}% do spot).`
          }
          reasoning={`Ratio longs/shorts em risco ±10%: ${probLongFlush}% / ${100 - probLongFlush}%. Cluster mais próximo de longs: $${(closestLong?.price/1000).toFixed(0)}K (${fmtM(closestLong?.longs_usd)}). Cluster mais próximo de shorts: $${(closestShort?.price/1000).toFixed(0)}K (${fmtM(closestShort?.shorts_usd)}). Short squeeze requereria rompimento de $${(closestShort?.price/1000).toFixed(0)}K com volume.`}
          actions={['Monitorar $' + (closestLong?.price/1000).toFixed(0) + 'K', 'Ver Funding Rate', 'Checar OI Delta']}
        />
      </div>
    </div>
  );
}

// ─── OI BY STRIKE ─────────────────────────────────────────────────────────────
function OIByStrike() {
  const [asset, setAsset] = useState('BTC');
  const d = btcOptionsExtended;

  // ETH mock OI (scaled down)
  const ethStrikes = d.oi_by_strike.map(s => ({
    strike: Math.round(s.strike * 0.0381), // BTC/ETH ratio ~26x, adjusted
    call_oi: Math.round(s.call_oi * 0.12),
    put_oi: Math.round(s.put_oi * 0.12),
  }));

  const strikes = asset === 'BTC' ? d.oi_by_strike : ethStrikes.map((s, i) => ({
    ...s, strike: [2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500, 3600][i] || s.strike,
  }));

  const chartData = strikes.map(s => ({
    strike: `$${(s.strike / 1000).toFixed(0)}K`,
    strikeRaw: s.strike,
    call_oi: s.call_oi,
    put_oi: -s.put_oi,   // negativo = abaixo do eixo
    net: s.call_oi - s.put_oi,
    isAtm: Math.abs(s.strike - (asset === 'BTC' ? SPOT : 3200)) < (asset === 'BTC' ? 300 : 100),
  }));

  const maxPain = asset === 'BTC' ? d.max_pain : 3200;
  const gamma = asset === 'BTC' ? d.gamma_exposure_usd : -28_000_000;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <SectionTitle
          title="Open Interest por Strike"
          sub={`${asset} Options — Calls (verde, acima) · Puts (vermelho, abaixo)`}
          badge={d.quality}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {['BTC', 'ETH'].map(a => (
            <button key={a} onClick={() => setAsset(a)} style={{
              padding: '4px 12px', borderRadius: 6,
              background: asset === a ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: `1px solid ${asset === a ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
              color: asset === a ? '#60a5fa' : '#475569',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
            }}>{a}</button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Put/Call Ratio (Vol)', value: d.put_call_ratio_vol.toFixed(2), color: '#f59e0b', sub: 'Por volume' },
          { label: 'Put/Call Ratio (OI)',  value: d.put_call_ratio_oi.toFixed(2),  color: '#a78bfa', sub: 'Por OI' },
          { label: 'Max Pain',             value: `$${(maxPain / 1000).toFixed(0)}K`, color: '#ef4444', sub: 'Maior expiração s/valor' },
          { label: 'GEX',                  value: `${(gamma / 1e6).toFixed(0)}M`,  color: gamma < 0 ? '#ef4444' : '#10b981', sub: gamma < 0 ? 'Short gamma dealer' : 'Long gamma dealer' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '9px 11px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* OI chart — bidirectional */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
          <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.abs(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10 }}
            formatter={(v, name) => [Math.abs(Number(v)).toLocaleString(), name === 'call_oi' ? 'Call OI' : 'Put OI']}
          />
          <ReferenceLine y={0} stroke="#2a3f5f" strokeWidth={1.5} />
          <ReferenceLine x={`$${(maxPain / 1000).toFixed(0)}K`} stroke="rgba(239,68,68,0.5)" strokeDasharray="4 4" label={{ value: 'Max Pain', fill: '#ef4444', fontSize: 8, position: 'insideTopRight' }} />
          <Bar dataKey="call_oi" name="Call OI" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isAtm ? '#22d3ee' : '#10b981'} fillOpacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="put_oi" name="Put OI" radius={[0, 0, 2, 2]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isAtm ? '#f97316' : '#ef4444'} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: '#334155', flexWrap: 'wrap' }}>
        <span>■ <span style={{ color: '#10b981' }}>Calls (acima)</span> — viés comprador</span>
        <span>■ <span style={{ color: '#ef4444' }}>Puts (abaixo)</span> — hedge/proteção</span>
        <span>■ <span style={{ color: '#22d3ee' }}>ATM atual</span></span>
      </div>
    </div>
  );
}

// ─── CARRY CALCULATOR ─────────────────────────────────────────────────────────
function CarryCalculator() {
  const [capital, setCapital] = useState(100000);
  const [selectedExp, setSelectedExp] = useState(1);   // index in futuresBasis.futures
  const futures = futuresBasis.futures;
  const f = futures[selectedExp];
  const term = termStructure.expirations;

  // Carry calc
  const carryReturn   = capital * (f.basis_annualized / 100) * (f.days_to_exp / 365);
  const riskFreeReturn = capital * (US10Y / 100) * (f.days_to_exp / 365);
  const netCarry      = carryReturn - riskFreeReturn;
  const carrySpread   = f.basis_annualized - US10Y;

  // Chart data — all vencimentos vs US10Y
  const chartData = futures.map(fx => ({
    expiry: fx.expiry.split('-').slice(0, 2).join('-'),
    basis:  parseFloat(fx.basis_annualized.toFixed(2)),
    spread: parseFloat((fx.basis_annualized - US10Y).toFixed(2)),
    days:   fx.days_to_exp,
    us10y:  US10Y,
  }));

  return (
    <div>
      <SectionTitle
        title="Carry Calculator — Custo de Basis por Vencimento"
        sub={`Basis anualizado vs US10Y (${US10Y}%) · Spot: $${SPOT.toLocaleString()}`}
        badge={futuresBasis.quality}
      />

      {/* Basis chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
          <XAxis dataKey="expiry" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v).toFixed(1)}%`} />
          <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10 }} formatter={(v) => [`${Number(v).toFixed(2)}%`, '']} />
          <ReferenceLine y={US10Y} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `US10Y ${US10Y}%`, fill: '#f59e0b', fontSize: 9, position: 'right' }} />
          <Bar dataKey="basis" name="Basis ann." radius={[3,3,0,0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.basis > US10Y ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
            ))}
          </Bar>
          <Line dataKey="spread" name="Spread vs RF" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Basis table */}
      <div style={{ margin: '14px 0 14px' }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>Custo de Carry por Vencimento</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {futures.map((fx, i) => {
            const spread = fx.basis_annualized - US10Y;
            const isSelected = selectedExp === i;
            return (
              <div key={i} onClick={() => setSelectedExp(i)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                borderRadius: 8, background: isSelected ? '#131e2e' : '#0d1421',
                border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
                cursor: 'pointer', transition: 'all 0.12s',
              }}>
                <div style={{ width: 90, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{fx.expiry.split('-').slice(0, 2).join(' ')}</div>
                  <div style={{ fontSize: 8, color: '#334155' }}>{fx.days_to_exp}d</div>
                </div>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Preço futuro</div>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 700 }}>${fx.price.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 8, color: '#334155' }}>Basis ann.</span>
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', fontWeight: 800 }}>{fx.basis_annualized.toFixed(2)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, fx.basis_annualized / 20 * 100)}%`, background: '#10b981', borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Spread RF</div>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: spread > 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                    {spread > 0 ? '+' : ''}{spread.toFixed(1)}pp
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive calculator */}
      <div style={{ background: '#0d1421', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>🧮 Calculadora de Carry Interativa</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Capital (USD)</label>
            <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
              style={{ background: '#111827', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '7px 10px', width: '100%', fontFamily: 'JetBrains Mono, monospace', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vencimento</label>
            <select value={selectedExp} onChange={e => setSelectedExp(Number(e.target.value))}
              style={{ background: '#111827', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '7px 10px', width: '100%', outline: 'none' }}>
              {futures.map((fx, i) => (
                <option key={i} value={i}>{fx.expiry} ({fx.days_to_exp}d)</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Retorno Carry',    value: `+$${carryReturn.toFixed(0)}`,    color: '#10b981', sub: `${f.basis_annualized.toFixed(1)}% ann. × ${f.days_to_exp}d` },
            { label: 'Custo Risk-Free',  value: `-$${riskFreeReturn.toFixed(0)}`, color: '#f59e0b', sub: `US10Y ${US10Y}% × ${f.days_to_exp}d` },
            { label: 'Net Carry',        value: `${netCarry >= 0 ? '+' : ''}$${netCarry.toFixed(0)}`, color: netCarry >= 0 ? '#10b981' : '#ef4444', sub: `Spread: ${carrySpread > 0 ? '+' : ''}${carrySpread.toFixed(1)}pp` },
          ].map(s => (
            <div key={s.label} style={{ background: '#111827', borderRadius: 8, padding: '9px 11px', border: `1px solid ${s.color}20` }}>
              <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {carrySpread > 0 && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 7, fontSize: 9, color: '#10b981' }}>
            ✅ Carry trade atrativo: basis de {f.basis_annualized.toFixed(1)}% supera a taxa livre de risco em +{carrySpread.toFixed(1)}pp. Estratégia: comprar spot + vender {f.expiry}.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TERM STRUCTURE ───────────────────────────────────────────────────────────
function TermStructurePanel() {
  const ts = termStructure;
  const maxOI = Math.max(...ts.expirations.map(e => e.oi_contracts));
  return (
    <div>
      <SectionTitle
        title="Term Structure — IV por Prazo"
        sub={`Estrutura: ${ts.structure_type} · 1W-1Y spread: +${(ts.front_back_spread * 100).toFixed(1)}pp`}
        badge={ts.quality}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ts.expirations.map((e, i) => {
          const ivDelta = e.iv_atm - e.iv_prev_day;
          const barW = (e.oi_contracts / maxOI * 100);
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7 }}>
              <div style={{ width: 28, fontSize: 10, fontWeight: 800, color: '#94a3b8', flexShrink: 0 }}>{e.label}</div>
              <div style={{ width: 40, fontSize: 9, color: '#334155', flexShrink: 0 }}>{e.days}d</div>
              <div style={{ width: 60, textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', fontWeight: 800, flexShrink: 0 }}>{(e.iv_atm * 100).toFixed(1)}%</div>
              <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: ivDelta >= 0 ? '#10b981' : '#ef4444', width: 46, flexShrink: 0 }}>
                {ivDelta >= 0 ? '+' : ''}{(ivDelta * 100).toFixed(1)}pp
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, borderRadius: 2, background: '#111827', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: '#a78bfa', opacity: 0.7 }} />
                </div>
              </div>
              <div style={{ width: 60, textAlign: 'right', fontSize: 9, color: '#475569', flexShrink: 0 }}>{e.oi_contracts.toLocaleString()} cont.</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 9, color: '#64748b', lineHeight: 1.7, padding: '9px 11px', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 7 }}>
        <span style={{ color: '#a78bfa', fontWeight: 700 }}>📊 Interpretação: </span>{ts.interpretation}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = ['Liq. Heatmap', 'OI por Strike', 'Carry Calculator', 'Term Structure'];

export function AdvancedContent() {
  const [tab, setTab] = useState(0);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Derivatives Advanced</h1>
          <ModeBadge mode="mock" />
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Liquidation Clusters · OI por Strike (BTC/ETH) · Carry Calculator · Term Structure de IV
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 18 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: '20px 22px' }}>
        {tab === 0 && <LiqHeatmapFull />}
        {tab === 1 && <OIByStrike />}
        {tab === 2 && <CarryCalculator />}
        {tab === 3 && <TermStructurePanel />}
      </div>
    </div>
  );
}