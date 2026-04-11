import { btcOptions, btcOptionsExtended, aiAnalysis } from '../components/data/mockData';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import TermStructure from '../components/options/TermStructure';
import IVRankPanel from '../components/options/IVRankPanel';
import TakerFlowPanel from '../components/options/TakerFlowPanel';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const regimeLabels = {
  low_vol:      { label: 'Low Vol', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  normal:       { label: 'Normal', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  elevated_vol: { label: 'Elevated Vol', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  crisis:       { label: 'Crisis', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function Options() {
  const o = btcOptions;
  const regime = regimeLabels[o.regime];

  const smileData = o.strikes.map(s => ({
    strike: s.strike / 1000,
    call: parseFloat((s.call_iv * 100).toFixed(2)),
    put: parseFloat((s.put_iv * 100).toFixed(2)),
    label: `${(s.strike / 1000).toFixed(0)}K`,
  }));

  const atmStrike = o.spot;
  const nearestStrike = o.strikes.reduce((prev, curr) =>
    Math.abs(curr.strike - atmStrike) < Math.abs(prev.strike - atmStrike) ? curr : prev
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          BTC Options
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          Deribit · {o.expiry} · {o.expiry_hours}h to expiry · <ModeBadge /> <GradeBadge grade={o.quality} />
        </p>
      </div>

      {/* Top metrics — IV ATM com Δ1D/1W/1M */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'IV ATM', value: `${(o.iv_atm * 100).toFixed(1)}%`, color: o.iv_atm > 0.6 ? '#f59e0b' : '#10b981' },
          { label: 'IV ATM Δ 1D', value: `${o.iv_atm_1d_delta > 0 ? '+' : ''}${(o.iv_atm_1d_delta * 100).toFixed(1)}pp`, color: o.iv_atm_1d_delta > 0 ? '#ef4444' : '#10b981' },
          { label: 'IV ATM Δ 1W', value: `${o.iv_atm_1w_delta > 0 ? '+' : ''}${(o.iv_atm_1w_delta * 100).toFixed(1)}pp`, color: o.iv_atm_1w_delta > 0 ? '#ef4444' : '#10b981' },
          { label: 'IV ATM Δ 1M', value: `${o.iv_atm_1m_delta > 0 ? '+' : ''}${(o.iv_atm_1m_delta * 100).toFixed(1)}pp`, color: o.iv_atm_1m_delta > 0 ? '#ef4444' : '#10b981' },
          { label: 'Put/Call Skew', value: `${(o.skew * 100).toFixed(1)}pp`, sub: o.skew_direction === 'put_skew' ? '▲ Put fear' : '▼ Call greed', color: o.skew < 0 ? '#ef4444' : '#10b981' },
          { label: 'Regime', value: regime.label, color: regime.color },
          { label: 'BTC Spot', value: `$${o.spot.toLocaleString()}`, color: '#e2e8f0' },
          { label: 'Hours to Exp', value: `${o.expiry_hours}h`, color: '#e2e8f0', sub: o.expiry },
        ].map((m, i) => (
          <div key={i} style={{
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: m.color }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Vol Smile */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader
            title="Volatility Smile"
            subtitle={`ATM IV: ${(o.iv_atm * 100).toFixed(1)}% · Strikes ±5% from spot`}
            grade={o.quality}
          />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={smileData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4a5568' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} tickLine={false}
                tickFormatter={v => v.toFixed(0) + '%'} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
                formatter={(v, n) => [Number(v).toFixed(2) + '%', n === 'call' ? 'Call IV' : 'Put IV']}
              />
              <ReferenceLine x={`${Math.round(o.spot / 1000)}K`} stroke="#2a3f5f" strokeDasharray="4 4" label={{ value: 'ATM', fill: '#4a5568', fontSize: 10 }} />
              <Line type="monotone" dataKey="call" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="call" />
              <Line type="monotone" dataKey="put" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="put" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#10b981' }}>── Calls</span>
            <span style={{ fontSize: 11, color: '#ef4444' }}>── Puts</span>
            <span style={{ fontSize: 11, color: '#4a5568' }}>│ ATM</span>
          </div>
        </div>

        {/* Skew analysis */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader title="Skew Analysis" subtitle="Put IV − Call IV per strike" grade={o.quality} />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={smileData.map(s => ({ ...s, skew: parseFloat((s.put - s.call).toFixed(3)) }))}
              margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4a5568' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#4a5568' }} tickLine={false}
                tickFormatter={v => v.toFixed(1) + '%'} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => [Number(v).toFixed(2) + '%', 'Skew (Put-Call)']}
              />
              <ReferenceLine y={0} stroke="#2a3f5f" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="skew" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, padding: 12, background: '#0D1421', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: o.skew < 0 ? '#ef4444' : '#10b981', fontWeight: 600, marginBottom: 4 }}>
              {o.skew < 0 ? '🔴 Put Skew — Hedging demand elevated' : '🟢 Call Skew — Bullish positioning'}
            </div>
            <div style={{ fontSize: 11, color: '#4a5568' }}>
              Average skew {o.expiry}: {o.skew > 0 ? '+' : ''}{(o.skew * 100).toFixed(2)}pp.{' '}
              {o.skew < -0.02
                ? 'Market paying up for downside protection. Consistent with risk-off sentiment.'
                : o.skew < 0
                ? 'Mild put premium — cautious sentiment but not extreme.'
                : 'Call premium — market leaning bullish for near-term expiry.'}
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🤖 AI Analysis — Options</div>
        <AIModuleCard module={aiAnalysis.modules.options} title="Options" icon="◬" />
      </div>

      {/* Put/Call Ratio + Max Pain */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Put/Call Ratio */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Put/Call Ratio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 3 }}>Por Volume</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: btcOptionsExtended.put_call_ratio_vol < 0.8 ? '#10b981' : btcOptionsExtended.put_call_ratio_vol > 1.2 ? '#ef4444' : '#f59e0b' }}>
                {btcOptionsExtended.put_call_ratio_vol.toFixed(2)}
              </div>
              <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>Média 7d: {btcOptionsExtended.put_call_ratio_7d_avg.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 3 }}>Por OI</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: btcOptionsExtended.put_call_ratio_oi < 0.8 ? '#10b981' : btcOptionsExtended.put_call_ratio_oi > 1.2 ? '#ef4444' : '#f59e0b' }}>
                {btcOptionsExtended.put_call_ratio_oi.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 7, background: btcOptionsExtended.put_call_ratio_vol < 1 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${btcOptionsExtended.put_call_ratio_vol < 1 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}` }}>
            <div style={{ fontSize: 11, color: btcOptionsExtended.put_call_ratio_vol < 1 ? '#10b981' : '#ef4444', fontWeight: 600, marginBottom: 3 }}>
              {btcOptionsExtended.put_call_ratio_vol < 0.8 ? '🟢 Mercado priorizando Calls — viés bullish' : btcOptionsExtended.put_call_ratio_vol < 1.0 ? '🟡 Levemente bullish — mais calls que puts' : '🔴 Puts dominando — hedging ativo, viés bearish'}
            </div>
            <div style={{ fontSize: 10, color: '#4a5568' }}>
              P/C &lt; 0.7 = otimismo excessivo. P/C &gt; 1.2 = medo/hedging extremo.
            </div>
          </div>
        </div>

        {/* Max Pain */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Max Pain</div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', marginBottom: 4, letterSpacing: '-0.04em' }}>
            ${btcOptionsExtended.max_pain.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 14 }}>
            {btcOptionsExtended.max_pain_distance_pct.toFixed(2)}% {btcOptionsExtended.max_pain_distance_pct < 0 ? 'abaixo' : 'acima'} do spot atual
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600, marginBottom: 3 }}>
              O que é Max Pain?
            </div>
            <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.6 }}>
              Strike onde o maior número de opções expiram sem valor — maior prejuízo para compradores de opções. 
              Preço tende a ser "atraído" para este nível próximo ao vencimento. Distância atual: {Math.abs(btcOptionsExtended.max_pain_distance_pct).toFixed(1)}%.
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#334155' }}>
            Gamma Exposure (GEX):{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: btcOptionsExtended.gamma_exposure_usd < 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
              ${(btcOptionsExtended.gamma_exposure_usd / 1e6).toFixed(0)}M
            </span>
            {btcOptionsExtended.gamma_exposure_usd < 0 ? ' (Short GEX — dealers amplificam moves)' : ' (Long GEX — dealers amortecendo moves)'}
          </div>
        </div>
      </div>

      {/* OI por Strike */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>OI por Strike — Calls vs Puts</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={btcOptionsExtended.oi_by_strike} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false}
              tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, n) => [v.toLocaleString() + ' contratos', n === 'call_oi' ? 'Call OI' : 'Put OI']}
              labelFormatter={v => `Strike: $${v.toLocaleString()}`}
            />
            <ReferenceLine x={84000} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: 'Max Pain', fill: '#a78bfa', fontSize: 9 }} />
            <Bar dataKey="call_oi" fill="rgba(16,185,129,0.7)" radius={[2,2,0,0]} name="call_oi" />
            <Bar dataKey="put_oi" fill="rgba(239,68,68,0.7)" radius={[2,2,0,0]} name="put_oi" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#10b981' }}>■ Calls</span>
          <span style={{ fontSize: 11, color: '#ef4444' }}>■ Puts</span>
          <span style={{ fontSize: 11, color: '#a78bfa' }}>│ Max Pain ($81K)</span>
        </div>
      </div>

      {/* Term Structure */}
      <div style={{ marginBottom: 16 }}>
        <TermStructure />
      </div>

      {/* IV Rank + Taker Flow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <IVRankPanel />
        <TakerFlowPanel />
      </div>

      {/* Strikes table */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Strike Matrix</div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>
            mark_iv per strike — filtered ±5% from spot ${o.spot.toLocaleString()}
          </div>
        </div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Strike</th>
              <th style={{ textAlign: 'right' }}>Call IV</th>
              <th style={{ textAlign: 'right' }}>Put IV</th>
              <th style={{ textAlign: 'right' }}>Skew (P-C)</th>
              <th style={{ textAlign: 'right' }}>Dist from ATM</th>
            </tr>
          </thead>
          <tbody>
            {o.strikes.map((s, i) => {
              const dist = ((s.strike - o.spot) / o.spot * 100).toFixed(2);
              const skew = ((s.put_iv - s.call_iv) * 100).toFixed(2);
              const isAtm = Math.abs(s.strike - o.spot) < 1000;
              return (
                <tr key={i} style={{ background: isAtm ? 'rgba(59,130,246,0.06)' : undefined }}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: isAtm ? 700 : 400 }}>
                    ${s.strike.toLocaleString()} {isAtm && <span style={{ fontSize: 10, color: '#3b82f6' }}>← ATM</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
                    {(s.call_iv * 100).toFixed(2)}%
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>
                    {(s.put_iv * 100).toFixed(2)}%
                  </td>
                  <td style={{
                    textAlign: 'right', fontFamily: 'JetBrains Mono, monospace',
                    color: parseFloat(skew) > 0 ? '#ef4444' : '#10b981',
                  }}>
                    {parseFloat(skew) > 0 ? '+' : ''}{skew}pp
                  </td>
                  <td style={{
                    textAlign: 'right', fontFamily: 'JetBrains Mono, monospace',
                    color: parseFloat(dist) > 0 ? '#10b981' : '#ef4444',
                  }}>
                    {parseFloat(dist) > 0 ? '+' : ''}{dist}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}