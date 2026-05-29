import { useState } from 'react';
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

// Fallbacks para campos sem equivalente direto na API live
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

// ─── DATA LAYER (live > Supabase cache > fallback) ────────────────────────────
function useOptionsPageData() {
  // useOptionsData select retorna { ...OptionsData, isFallback, lastUpdated }
  const { data: rawData } = useOptionsData();
  const isFallback  = rawData?.isFallback  ?? true;
  const lastUpdated = rawData?.lastUpdated ?? null;
  // "live" = temos dados com spot real (>0); inclui dados do cache Supabase
  const live = rawData && rawData.spot > 0 ? rawData : null;

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

  const dvolHistory = live?.dvol_history ?? [];
  const dvolLen = dvolHistory.length;
  const dvolLast = dvolLen > 0 ? dvolHistory[dvolLen - 1].value : null;
  const ivDelta1d = dvolLen >= 2  ? (dvolLast - dvolHistory[dvolLen - 2].value) / 100 : 0;
  const ivDelta1w = dvolLen >= 8  ? (dvolLast - dvolHistory[dvolLen - 8].value) / 100 : 0;
  const ivDelta1m = dvolLen >= 30 ? (dvolLast - dvolHistory[0].value) / 100 : 0;

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
        iv_atm_1d_delta: ivDelta1d,
        iv_atm_1w_delta: ivDelta1w,
        iv_atm_1m_delta: ivDelta1m,
      }
    : BTC_OPTIONS_FALLBACK;

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
    liveOptionsData:       live ?? null,
    liveGex:               gexData,
    liveMaxPain:           maxPain,
    liveChain:             live?.chain ?? null,
    liveOiByStrike,
    livePcrVol,
    livePcrOi,
    liveMaxPainDistancePct,
    hasLiveData:           !!live,
    isFallback:            isFallback ?? !live,
    lastUpdated:           lastUpdated ?? null,
  };
}

const regimeLabels = {
  low_vol:      { label: 'Low Vol',      color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  normal:       { label: 'Normal',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  elevated_vol: { label: 'Elevated Vol', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  crisis:       { label: 'Crisis',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

// ─── Tooltip educativo ────────────────────────────────────────────────────────
function Tip({ children, text }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'help' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, opacity: 0.7 }}>?</span>
      {open && (
        <span style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
          background: '#0d1421', border: '1px solid #1e3048', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.6,
          width: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          whiteSpace: 'normal', pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Accordion de dica ────────────────────────────────────────────────────────
function TipCard({ emoji, title, body, tag }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10,
        padding: '12px 14px', cursor: 'pointer',
        borderLeft: '3px solid #a78bfa',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && (
            <span style={{ fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
              {tag}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#4a5568' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.7, borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
          {body}
        </div>
      )}
    </div>
  );
}

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

// ─── Label educativo de seção ─────────────────────────────────────────────────
function SectionPurpose({ text }) {
  return (
    <div style={{ fontSize: 10, color: '#475569', marginTop: 2, marginBottom: 10, lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

export default function Options() {
  const {
    btcOptions, liveOptionsData, liveGex, liveMaxPain,
    liveOiByStrike, livePcrVol, livePcrOi, liveMaxPainDistancePct,
    hasLiveData, isFallback, lastUpdated,
  } = useOptionsPageData();
  const o = btcOptions;
  const regime = regimeLabels[o.regime] ?? regimeLabels.normal;

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

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          BTC Options
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          Deribit · {o.expiry} · {o.expiry_hours}h to expiry · <ModeBadge /> <GradeBadge grade={o.quality} />
        </p>
      </div>

      {/* ── Banner "Para que serve" ── */}
      <div style={{
        marginBottom: 20, padding: '16px 20px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.07) 0%, rgba(59,130,246,0.05) 100%)',
        border: '1px solid rgba(167,139,250,0.2)',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>◬</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
              Para que serve esta página?
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 860 }}>
              Opções são contratos que dão o <strong>direito — sem obrigação</strong> — de comprar (<strong>call</strong>)
              ou vender (<strong>put</strong>) BTC a um preço específico (<strong>strike</strong>) em uma data futura (<strong>vencimento</strong>).
              O mercado de opções revela a <strong>distribuição de probabilidade implícita</strong> sobre o preço futuro do BTC —
              algo que spot e futuros <em>não mostram diretamente</em>.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', text: 'Ver se o mercado compra proteção (puts) ou aposta em alta (calls) via PCR' },
                { icon: '✅', text: 'Identificar strikes com grande concentração de posições (Max Pain, OI)' },
                { icon: '✅', text: 'Avaliar se a volatilidade implícita está cara ou barata (IV Rank) antes de operar' },
                { icon: '✅', text: 'Entender como dealers irão se comportar via Gamma Exposure (GEX)' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner de cache Supabase (quando API offline) ── */}
      {isFallback && (
        <div style={{
          marginBottom: 16, padding: '7px 14px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8,
        }}>
          <span>⚠ API Deribit indisponível — exibindo último valor salvo no Supabase</span>
          {lastUpdated && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              Última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      )}

      {/* ── Top metrics — IV ATM com Δ1D/1W/1M ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          {
            label: <Tip text="Volatilidade Implícita ATM: preço que o mercado cobra por incerteza. IV < 35% é historicamente baixa para BTC; > 80% indica crise.">IV ATM</Tip>,
            value: `${(o.iv_atm * 100).toFixed(1)}%`,
            color: o.iv_atm > 0.6 ? '#f59e0b' : '#10b981',
          },
          {
            label: <Tip text="Variação em pontos percentuais da IV ATM vs ontem. Positivo = volatilidade subindo (medo crescente).">IV ATM Δ 1D</Tip>,
            value: `${o.iv_atm_1d_delta > 0 ? '+' : ''}${(o.iv_atm_1d_delta * 100).toFixed(1)}pp`,
            color: o.iv_atm_1d_delta > 0 ? '#ef4444' : '#10b981',
          },
          {
            label: <Tip text="Variação da IV ATM vs há 7 dias. Tendência de volatilidade na semana.">IV ATM Δ 1W</Tip>,
            value: `${o.iv_atm_1w_delta > 0 ? '+' : ''}${(o.iv_atm_1w_delta * 100).toFixed(1)}pp`,
            color: o.iv_atm_1w_delta > 0 ? '#ef4444' : '#10b981',
          },
          {
            label: <Tip text="Variação da IV ATM vs há 30 dias. Tendência estrutural de volatilidade no mês.">IV ATM Δ 1M</Tip>,
            value: `${o.iv_atm_1m_delta > 0 ? '+' : ''}${(o.iv_atm_1m_delta * 100).toFixed(1)}pp`,
            color: o.iv_atm_1m_delta > 0 ? '#ef4444' : '#10b981',
          },
          {
            label: <Tip text="Diferença entre IV das puts e calls ATM. Positivo = puts mais caras (medo/hedging). Negativo = calls mais caras (euforia/bull).">Put/Call Skew</Tip>,
            value: `${(o.skew * 100).toFixed(1)}pp`,
            sub: o.skew_direction === 'put_skew' ? '▲ Put fear' : o.skew_direction === 'call_skew' ? '▼ Call greed' : '— Neutro',
            color: o.skew < 0 ? '#ef4444' : '#10b981',
          },
          {
            label: <Tip text="Regime de volatilidade atual: Low Vol (<35%), Normal (35–55%), Elevated (55–80%), Crisis (>80%). Determina quais estratégias de opções fazem sentido.">Regime</Tip>,
            value: regime.label,
            color: regime.color,
          },
          {
            label: 'BTC Spot',
            value: `$${o.spot.toLocaleString()}`,
            color: '#e2e8f0',
          },
          {
            label: <Tip text="Tempo restante até o vencimento da cadeia mais próxima analisada no Deribit. Quanto menor o tempo, maior a influência do Max Pain.">Hours to Exp</Tip>,
            value: `${o.expiry_hours}h`,
            color: '#e2e8f0',
            sub: o.expiry,
          },
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

      {/* ── Charts: Vol Smile + Skew ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Volatility Smile */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader
            title="Volatility Smile"
            subtitle={`ATM IV: ${(o.iv_atm * 100).toFixed(1)}% · Strikes ±5% from spot`}
            grade={o.quality}
          />
          <SectionPurpose text="Mostra como a volatilidade implícita varia por strike — revela onde o mercado enxerga maior risco de movimento." />
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
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 7, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#475569', lineHeight: 1.7 }}>
            <strong style={{ color: '#94a3b8' }}>Sorriso normal:</strong> calls e puts ATM com IV similar — mercado equilibrado.{' '}
            <strong style={{ color: '#94a3b8' }}>Skew para puts (asa direita mais alta):</strong> mercado pagando prêmio por proteção de queda.{' '}
            <strong style={{ color: '#94a3b8' }}>Skew para calls (asa esquerda mais alta):</strong> euforia — antecipação de alta explosiva.
          </div>
        </div>

        {/* Skew analysis */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader title="Skew Analysis" subtitle="Put IV − Call IV por strike" grade={o.quality} />
          <SectionPurpose text="Puts mais caras que calls = mercado comprando proteção contra queda. Calls mais caras = euforia, aposta em alta rápida." />
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
              Skew médio {o.expiry}: {o.skew > 0 ? '+' : ''}{(o.skew * 100).toFixed(2)}pp.{' '}
              {o.skew < -0.02
                ? 'Mercado pagando mais por proteção downside. Consistente com risk-off.'
                : o.skew < 0
                ? 'Leve prêmio em puts — sentimento cauteloso mas não extremo.'
                : 'Prêmio em calls — mercado com viés bullish para o vencimento próximo.'}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Analysis ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          Análise Options
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>
          Sinal calculado por regras de threshold (IV ATM · skew · P/C ratio · max pain) — não por modelo de linguagem. Claude Haiku exibido abaixo quando configurado.
        </div>
        <AIModuleCard module={aiAnalysis.modules.options} title="Options" icon="◬" />
        <ClaudeInsight text={optInsight} loading={optAiLoading} />
      </div>

      {/* ── Put/Call Ratio + Max Pain ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* Put/Call Ratio */}
        {(() => {
          const pcrVol = livePcrVol ?? BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_vol;
          const pcrOi  = livePcrOi  ?? BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_oi;
          return (
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>Put/Call Ratio</div>
              <SectionPurpose text="Razão entre o volume de puts e calls negociadas. Abaixo de 1.0 é bullish (mais calls). Acima de 1.2 = hedging extremo — potencial sinal contrarian de reversão bullish." />
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

              {/* Tabela de interpretação */}
              <div style={{ marginBottom: 12, borderRadius: 7, overflow: 'hidden', border: '1px solid #1e2d45' }}>
                {[
                  { range: 'PCR < 0.7',    label: 'Otimismo excessivo',        color: '#10b981', bg: 'rgba(16,185,129,0.04)',  note: 'Possível topo de curto prazo' },
                  { range: 'PCR 0.7–1.0',  label: 'Leve bullish',              color: '#60a5fa', bg: 'rgba(59,130,246,0.04)',  note: 'Mais calls que puts' },
                  { range: 'PCR 1.0–1.2',  label: 'Leve bearish',              color: '#f59e0b', bg: 'rgba(245,158,11,0.04)', note: 'Hedging crescendo' },
                  { range: 'PCR > 1.2',    label: 'Medo extremo',              color: '#ef4444', bg: 'rgba(239,68,68,0.04)',  note: 'Potencial contrarian buy' },
                ].map((row, i) => {
                  const isCurrent = (
                    (row.range === 'PCR < 0.7'   && pcrVol < 0.7) ||
                    (row.range === 'PCR 0.7–1.0' && pcrVol >= 0.7 && pcrVol < 1.0) ||
                    (row.range === 'PCR 1.0–1.2' && pcrVol >= 1.0 && pcrVol < 1.2) ||
                    (row.range === 'PCR > 1.2'   && pcrVol >= 1.2)
                  );
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: isCurrent ? row.bg : 'transparent',
                      borderLeft: isCurrent ? `3px solid ${row.color}` : '3px solid transparent',
                      borderBottom: i < 3 ? '1px solid #1e2d45' : undefined,
                    }}>
                      <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: row.color, minWidth: 72 }}>{row.range}</span>
                      <span style={{ fontSize: 10, color: isCurrent ? row.color : '#64748b', fontWeight: isCurrent ? 700 : 400, flex: 1 }}>{row.label}</span>
                      <span style={{ fontSize: 9, color: '#334155' }}>{row.note}</span>
                    </div>
                  );
                })}
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>Max Pain</div>
          <SectionPurpose text="Strike onde a maioria das opções expira sem valor — ponto de atração gravitacional no vencimento. Especialmente relevante nas últimas 48h antes do vencimento." />
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
              Strike onde o maior número de opções expira sem valor — maior prejuízo para compradores de opções.
              O preço tende a ser "atraído" para este nível próximo ao vencimento. Distância atual:{' '}
              <strong style={{ color: '#a78bfa' }}>{Math.abs(liveMaxPainDistancePct ?? BTC_OPTIONS_EXT_FALLBACK.max_pain_distance_pct).toFixed(1)}%</strong>.
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>
              {Math.abs(liveMaxPainDistancePct ?? 0) > 3
                ? `⚡ Distância > 3% — market makers têm incentivo para pressionar o preço em direção ao Max Pain nas próximas horas.`
                : `✓ Spot próximo ao Max Pain — menor pressão direcional de dealers até o vencimento.`}
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

      {/* ── OI por Strike ── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>OI por Strike — Calls vs Puts</div>
        <SectionPurpose text="Barras mostram concentração de contratos abertos por preço. Strikes com alto OI funcionam como suporte (puts) e resistência (calls) implícitos de mercado." />
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

      {/* ── Term Structure ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>
          <strong style={{ color: '#94a3b8' }}>Term Structure:</strong> Curva de volatilidade implícita ao longo dos vencimentos — revela eventos específicos precificados e o perfil de risco temporal do mercado.
        </div>
        <TermStructure optionsData={liveOptionsData} />
      </div>

      {/* ── IV Rank + Taker Flow ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>
            <strong style={{ color: '#94a3b8' }}>IV Rank:</strong> Percentil histórico da volatilidade atual — &lt;25% = IV barata (considerar comprar vol), &gt;75% = IV cara (considerar vender vol / spreads).
          </div>
          <IVRankPanel optionsData={liveOptionsData} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>
            <strong style={{ color: '#94a3b8' }}>Taker Flow:</strong> Fluxo de compradores vs vendedores de opções — quem está pagando prêmio e quem está recebendo. Bull-Bear Index derivado do PCR real da Deribit.
          </div>
          <TakerFlowPanel optionsData={liveOptionsData} />
        </div>
      </div>

      {/* ── Dealer Flow — GEX / Vanna / Charm ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
          ● Dealer Flow (GEX/Vanna/Charm)
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>
          <strong style={{ color: '#94a3b8' }}>GEX:</strong> mede se market makers estão amplificando (negativo / Short Gamma) ou amortecendo (positivo / Long Gamma) os movimentos do BTC. Crucial para entender a dinâmica de volatilidade intraday.
        </div>
        <DealerFlowPanel
          spot={o.spot}
          iv={o.iv_atm}
        />
      </div>

      {/* ── Dicas de Ouro ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          🏆 Dicas de Ouro — Como Ler o Mercado de Opções BTC
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 12 }}>
          Clique em cada dica para expandir · Estratégias usadas por traders institucionais
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="🧲"
            title="Max Pain como nível de gravidade no vencimento"
            tag="EXPIRAÇÃO"
            body={
              <span>
                Próximo ao vencimento (últimas 48h), market makers têm incentivo econômico para manter o preço perto do Max Pain — onde o maior número de opções expira sem valor, maximizando os prêmios recebidos pelos vendedores.
                <br /><br />
                <strong>Como usar:</strong> Se o BTC estiver a mais de 3% do Max Pain com menos de 48h para o vencimento, observe pressão latente em direção a esse nível. Não é uma regra absoluta, mas é um viés estatisticamente relevante.
                <br /><br />
                <strong>Atenção:</strong> Em momentos de alta volatilidade (crise, notícias macro), o mercado pode ignorar completamente o Max Pain.
              </span>
            }
          />
          <TipCard
            emoji="🌡"
            title="IV Rank < 25% → considerar comprar volatilidade"
            tag="ENTRY"
            body={
              <span>
                Quando o IV Rank está abaixo de 25%, a volatilidade implícita está no quartil mais barato dos últimos 12 meses. Estratégias de compra de vol (straddles, long calls/puts) ficam estruturalmente mais atrativas.
                <br /><br />
                <strong>Lógica:</strong> Volatilidade mean-reverts. IV barata tende a voltar para a média — especialmente antes de eventos conhecidos (FOMC, earnings de ETF, halvings).
                <br /><br />
                <strong>Risco:</strong> "Barato pode ficar mais barato." Aguarde confirmação de catalisador antes de entrar. O theta (custo do tempo) corrói posições de long vol rapidamente.
              </span>
            }
          />
          <TipCard
            emoji="⚡"
            title="GEX negativo = dealers Short Gamma = moves amplificados"
            tag="RISCO"
            body={
              <span>
                Quando o Gamma Exposure (GEX) é negativo, dealers precisam <strong>comprar quando o preço sobe</strong> e <strong>vender quando cai</strong> para rebalancear seus hedges — o oposto do que estabilizaria o mercado.
                <br /><br />
                <strong>Consequências práticas:</strong> Volatilidade intraday maior, moves pró-tendência mais violentos, stop loss mais amplos necessários, liquidações em cascata mais prováveis.
                <br /><br />
                <strong>GEX positivo</strong> (Long Gamma) é o oposto: dealers amortecem — vendem na alta, compram na baixa. Moves menores, range-bound natural.
              </span>
            }
          />
          <TipCard
            emoji="🔄"
            title="Put Skew extremo (+5pp) = sinal contrarian bullish"
            tag="CONTRARIAN"
            body={
              <span>
                Quando puts estão muito mais caras que calls (skew positivo elevado), significa que grandes players já compraram proteção. O mercado está "hedgeado".
                <br /><br />
                <strong>Lógica contrarian:</strong> Quando todo mundo já está protegido, quem resta para vender? A pressão de compra de puts alivia. Historicamente, put skew extremo precede reversões bullish nas semanas seguintes.
                <br /><br />
                <strong>Não confundir:</strong> Skew alto pode persistir durante quedas prolongadas. Use como <em>confirmação adicional</em> junto com outros indicadores, não como sinal isolado.
              </span>
            }
          />
          <TipCard
            emoji="📊"
            title="PCR > 1.3 = capitulação de hedgers → potencial reversão"
            tag="REVERSAL"
            body={
              <span>
                Put/Call Ratio acima de 1.3 significa que há muito mais puts que calls sendo negociadas. O "smart money" e investidores institucionais já estão protegidos.
                <br /><br />
                <strong>Por que é contrarian:</strong> Quando todos já compraram proteção, o risco downside marginal diminui. Os vendedores de puts (quem recebe o prêmio) geralmente são players sofisticados que acreditam que o downside é limitado.
                <br /><br />
                <strong>Confirmação:</strong> PCR acima de 1.3 + Fear &amp; Greed abaixo de 20 + spot acima de suporte técnico = setup de reversão com maior probabilidade histórica.
              </span>
            }
          />
        </div>
      </div>

      {/* ── Strike Matrix ── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Strike Matrix</div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>
            mark_iv por strike — filtrado ±5% do spot ${o.spot.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
            <strong style={{ color: '#94a3b8' }}>Como usar:</strong> Tabela completa de IV por strike — identifique assimetrias (put IV muito acima da call IV no mesmo strike = put skew local). A coluna "Skew (P-C)" positiva indica prêmio de proteção naquele nível.
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
