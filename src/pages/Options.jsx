import { useOptionsData } from '@/hooks/useDeribit';
import { readModuleFlag } from '@/lib/moduleFlags';
import { DisabledModuleBanner } from '@/components/ui/DisabledModuleBanner';
import { computeGex, computeMaxPain } from '@/utils/riskCalculations';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { useAiInsight } from '@/hooks/useAiInsight';
import { IS_LIVE } from '@/lib/env';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import TermStructure from '../components/options/TermStructure';
import IVRankPanel from '../components/options/IVRankPanel';
import TakerFlowPanel from '../components/options/TakerFlowPanel';
import DealerFlowPanel from '../components/options/DealerFlowPanel';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// Fallbacks for options fields without live API equivalents
const BTC_OPTIONS_FALLBACK = {
  spot: 0, iv_atm: 0, strikes: [],
  skew: 0, skew_direction: 'neutral', regime: 'normal',
  expiry: '—', expiry_hours: 0, quality: 'D',
  iv_atm_1d_delta: 0, iv_atm_1w_delta: 0, iv_atm_1m_delta: 0,
};
const BTC_OPTIONS_EXT_FALLBACK = {
  put_call_ratio_vol: 1.0, put_call_ratio_oi: 1.0, put_call_ratio_7d_avg: null,
  max_pain: 0, max_pain_distance_pct: 0, gamma_exposure_usd: 0,
  oi_by_strike: [],
};
const AI_MODULE_FALLBACK = {
  direction: 'neutral', signal: '', score: 0,
  probability: 0, confidence: 0,
  timeframe: '—', trigger: '—', analysis: '',
};
const AI_OPTIONS_FALLBACK = { modules: { options: AI_MODULE_FALLBACK } };

// ─── DATA LAYER (live > fallback) ────────────────────────────────────────────
function useOptionsPageData() {
  const { data: live } = useOptionsData();

  // Derived fields computed from live chain
  const chainSkew = live && live.chain.length > 0
    ? live.chain.reduce((acc, c) => acc + (c.put_iv - c.call_iv), 0) / live.chain.length
    : null;
  const skew_direction = chainSkew != null
    ? (chainSkew > 0.005 ? 'put_skew' : chainSkew < -0.005 ? 'call_skew' : 'neutral')
    : null;
  const regime = live
    ? (live.iv_atm < 0.35 ? 'low_vol' : live.iv_atm < 0.55 ? 'normal' : live.iv_atm < 0.80 ? 'elevated_vol' : 'crisis')
    : null;
  const nearestExpiry = live?.term_structure?.[0] ?? null;

  const btcOptions = live
    ? {
        ...BTC_OPTIONS_FALLBACK,
        spot:          live.spot,
        iv_atm:        live.iv_atm,
        strikes:       live.chain.map(c => ({ strike: c.strike, call_iv: c.call_iv, put_iv: c.put_iv })),
        skew:          chainSkew ?? BTC_OPTIONS_FALLBACK.skew,
        skew_direction: skew_direction ?? BTC_OPTIONS_FALLBACK.skew_direction,
        regime:        regime ?? BTC_OPTIONS_FALLBACK.regime,
        expiry:        nearestExpiry?.label ?? BTC_OPTIONS_FALLBACK.expiry,
        expiry_hours:  nearestExpiry ? Math.round(nearestExpiry.days_to * 24) : BTC_OPTIONS_FALLBACK.expiry_hours,
        quality:       live.quality,
      }
    : BTC_OPTIONS_FALLBACK;

  // GEX calculado da chain viva (fórmula validada em scripts/validate_gex.py)
  const gexData = live
    ? computeGex(
        live.chain.map(c => ({
          strike:  c.strike,
          call_oi: c.call_oi,
          put_oi:  c.put_oi,
          gamma:   c.call_gamma,
          call_iv: c.call_iv,
          put_iv:  c.put_iv,
        })),
        live.spot,
      )
    : null;

  // Max Pain calculado da chain viva
  const maxPain = live
    ? computeMaxPain(
        live.chain.map(c => ({ strike: c.strike, call_oi: c.call_oi, put_oi: c.put_oi, call_iv: c.call_iv, put_iv: c.put_iv })),
        live.spot,
      )
    : BTC_OPTIONS_EXT_FALLBACK.max_pain;

  const liveOiByStrike = live
    ? live.chain.map(c => ({ strike: c.strike, call_oi: c.call_oi, put_oi: c.put_oi }))
    : null;
  const livePcrVol  = live?.put_call_ratio_vol  ?? null;
  const livePcrOi   = live?.put_call_ratio_oi   ?? null;
  const liveMaxPainDistancePct = live ? ((maxPain - live.spot) / live.spot * 100) : null;

  return {
    btcOptions,
    liveGex:               gexData,
    liveMaxPain:           maxPain,
    liveChain:             live?.chain ?? null,
    liveOiByStrike,
    livePcrVol,
    livePcrOi,
    liveMaxPainDistancePct,
    hasLiveData:           !!live,
  };
}

const regimeLabels = {
  low_vol:      { label: 'Low Vol', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  normal:       { label: 'Normal', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  elevated_vol: { label: 'Elevated Vol', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  crisis:       { label: 'Crisis', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

function ClaudeInsight({ text, loading }) {
  if (!text && !loading) return null;
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
      <div style={{ fontSize: 8, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>✦ Claude Haiku</div>
      {loading && !text
        ? <div style={{ height: 12, borderRadius: 3, background: 'rgba(59,130,246,0.1)' }} />
        : <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>{text}</div>
      }
    </div>
  );
}

export default function Options() {
  const { btcOptions, liveGex, liveMaxPain, liveOiByStrike, livePcrVol, livePcrOi, liveMaxPainDistancePct, hasLiveData } = useOptionsPageData();
  const o = btcOptions;
  const regime = regimeLabels[o.regime] ?? regimeLabels.normal;

  // Rule-based AI analysis from live options data
  const liveAnalysis = IS_LIVE && hasLiveData
    ? computeRuleBasedAnalysis({
        options: {
          ivAtm:              o.iv_atm,
          skew:               o.skew,
          pcrVol:             livePcrVol ?? BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_vol,
          maxPainDistancePct: liveMaxPainDistancePct ?? BTC_OPTIONS_EXT_FALLBACK.max_pain_distance_pct,
        },
      })
    : null;
  const aiAnalysis = liveAnalysis ?? AI_OPTIONS_FALLBACK;

  // Claude AI insight
  const optPayload = hasLiveData ? {
    page: 'options',
    riskScore: 50,
    riskRegime: 'MODERADO',
    fearGreedValue: 50,
    fearGreedLabel: 'Neutral',
    fundingRate: 0,
    context: {
      ivAtm: o.iv_atm,
      skew: o.skew,
      pcrOi: livePcrOi,
      maxPainPct: liveMaxPainDistancePct,
    },
  } : null;
  const { data: optInsight, isLoading: optAiLoading } = useAiInsight(optPayload);

  const smileData = o.strikes.map(s => ({
    strike: s.strike / 1000,
    call: parseFloat((s.call_iv * 100).toFixed(2)),
    put: parseFloat((s.put_iv * 100).toFixed(2)),
    label: `${(s.strike / 1000).toFixed(0)}K`,
  }));

  const atmStrike = o.spot;
  const nearestStrike = o.strikes.length > 0
    ? o.strikes.reduce((prev, curr) =>
        Math.abs(curr.strike - atmStrike) < Math.abs(prev.strike - atmStrike) ? curr : prev
      )
    : null;

  if (!readModuleFlag('ENABLE_OPTIONS')) {
    return <DisabledModuleBanner moduleName="ENABLE_OPTIONS" />;
  }

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
        <ClaudeInsight text={optInsight} loading={optAiLoading} />
      </div>

      {/* Put/Call Ratio + Max Pain */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Put/Call Ratio */}
        {(() => {
          const pcrVol = livePcrVol ?? BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_vol;
          const pcrOi  = livePcrOi  ?? BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_oi;
          return (
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Put/Call Ratio</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 3 }}>Por Volume</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: pcrVol < 0.8 ? '#10b981' : pcrVol > 1.2 ? '#ef4444' : '#f59e0b' }}>
                    {pcrVol.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>Média 7d: {BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_7d_avg?.toFixed(2) ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 3 }}>Por OI</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: pcrOi < 0.8 ? '#10b981' : pcrOi > 1.2 ? '#ef4444' : '#f59e0b' }}>
                    {pcrOi.toFixed(2)}
                  </div>
                </div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 7, background: pcrVol < 1 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${pcrVol < 1 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}` }}>
                <div style={{ fontSize: 11, color: pcrVol < 1 ? '#10b981' : '#ef4444', fontWeight: 600, marginBottom: 3 }}>
                  {pcrVol < 0.8 ? '🟢 Mercado priorizando Calls — viés bullish' : pcrVol < 1.0 ? '🟡 Levemente bullish — mais calls que puts' : '🔴 Puts dominando — hedging ativo, viés bearish'}
                </div>
                <div style={{ fontSize: 10, color: '#4a5568' }}>
                  P/C &lt; 0.7 = otimismo excessivo. P/C &gt; 1.2 = medo/hedging extremo.
                </div>
              </div>
            </div>
          );
        })()}

        {/* Max Pain */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Max Pain</div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', marginBottom: 4, letterSpacing: '-0.04em' }}>
            ${liveMaxPain.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 14 }}>
            {(((liveMaxPain - o.spot) / o.spot) * 100).toFixed(2)}% {liveMaxPain < o.spot ? 'abaixo' : 'acima'} do spot atual
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600, marginBottom: 3 }}>
              O que é Max Pain?
            </div>
            <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.6 }}>
              Strike onde o maior número de opções expiram sem valor — maior prejuízo para compradores de opções.
              Preço tende a ser "atraído" para este nível próximo ao vencimento. Distância atual: {Math.abs(liveMaxPainDistancePct ?? BTC_OPTIONS_EXT_FALLBACK.max_pain_distance_pct).toFixed(1)}%.
            </div>
          </div>
          {(() => {
            const gexUsd = liveGex ? liveGex.net_gex_usd : BTC_OPTIONS_EXT_FALLBACK.gamma_exposure_usd;
            const gexColor = gexUsd < 0 ? '#ef4444' : '#10b981';
            const gexLabel = liveGex?.dealer_position === 'short_gamma' ? ' (Short GEX — dealers amplificam moves)'
              : liveGex?.dealer_position === 'long_gamma' ? ' (Long GEX — dealers amortecendo moves)'
              : gexUsd < 0 ? ' (Short GEX — dealers amplificam moves)' : ' (Long GEX — dealers amortecendo moves)';
            return (
              <div style={{ fontSize: 10, color: '#334155' }}>
                Gamma Exposure (GEX):{' '}
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: gexColor, fontWeight: 700 }}>
                  ${(gexUsd / 1e6).toFixed(0)}M
                </span>
                {gexLabel}
                {liveGex?.gamma_flip && (
                  <span style={{ color: '#a78bfa', marginLeft: 8 }}>
                    · Flip: ${liveGex.gamma_flip.toLocaleString()} ({liveGex.flip_distance_pct > 0 ? '+' : ''}{liveGex.flip_distance_pct}%)
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* OI por Strike */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>OI por Strike — Calls vs Puts</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={liveOiByStrike ?? BTC_OPTIONS_EXT_FALLBACK.oi_by_strike} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false}
              tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, n) => [v.toLocaleString() + ' contratos', n === 'call_oi' ? 'Call OI' : 'Put OI']}
              labelFormatter={v => `Strike: $${v.toLocaleString()}`}
            />
            <ReferenceLine x={liveMaxPain} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: 'Max Pain', fill: '#a78bfa', fontSize: 9 }} />
            <Bar dataKey="call_oi" fill="rgba(16,185,129,0.7)" radius={[2,2,0,0]} name="call_oi" />
            <Bar dataKey="put_oi" fill="rgba(239,68,68,0.7)" radius={[2,2,0,0]} name="put_oi" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#10b981' }}>■ Calls</span>
          <span style={{ fontSize: 11, color: '#ef4444' }}>■ Puts</span>
          <span style={{ fontSize: 11, color: '#a78bfa' }}>│ Max Pain (${(liveMaxPain / 1000).toFixed(0)}K)</span>
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

      {/* Dealer Flow — GEX / Vanna / Charm */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
          ● Dealer Flow (GEX/Vanna/Charm)
        </div>
        <DealerFlowPanel
          spot={o.spot}
          iv={o.iv_atm}
        />
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