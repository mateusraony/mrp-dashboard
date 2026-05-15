// ─── RELATÓRIO EXECUTIVO COMPLETO ─────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, Line, ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import AIInsightPanel from '../components/ai/AIInsightPanel';
import { ModeBadge } from '../components/ui/DataBadge';
import { useAiInsight } from '@/hooks/useAiInsight';
import { sendNotificationEmail } from '@/lib/notificationClient';
import { useBtcTicker, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useMarketRegime } from '@/hooks/useMarketRegime';
import { useOnChainCycle, useOnChainExtended } from '@/hooks/useCoinMetrics';
import { IS_LIVE } from '@/lib/env';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';

// ─── Fallbacks — dados sem API gratuita equivalente ──────────────────────────
const FEAR_GREED_FALLBACK        = { value: 50, classification: 'Neutral', label: 'Neutral' };
const GLOBAL_RISK_FALLBACK       = { score: 50, regime: 'NEUTRAL', prob: 0 };
const MACRO_BOARD_FALLBACK       = { series: [] };
const STABLECOIN_SUPPLY_FALLBACK = { total_b: 0, delta_7d_pct: 0, delta_30d_pct: 0, usdt_supply_b: 0, usdc_supply_b: 0 };
const BTC_NUPL_FALLBACK          = { value: 0, zone: '—', zone_color: '#94a3b8', history: { '1d': [], '1w': [], '1m': [] }, delta_7d: 0, delta_30d: 0 };
const BTC_SOPR_FALLBACK          = { value: 0, smoothed_7d: 0 };
const BTC_REALIZED_METRICS_FALLBACK = { mvrv_ratio: 0, mvrv_zone: '—', mvrv_zone_color: '#94a3b8', mvrv_zscore: 0, realized_price: 0 };
const BTC_EXCHANGE_NETFLOW_FALLBACK = { netflow_24h: 0, exchange_reserves: 0, reserves_delta_30d_pct: 0, netflow_7d: 0 };
const BTC_WHALE_ACTIVITY_FALLBACK   = { txs_over_1m_24h: 0, delta_1m_vs_avg: 0, txs_over_10m_24h: 0, delta_10m_vs_avg: 0 };
const BTC_CORRELATIONS_FALLBACK  = { pairs: [] };
const BTC_OPTIONS_MOCK_FALLBACK  = { iv_atm: 0, iv_atm_1d_delta: 0, skew: 0, skew_direction: 'neutral' };
const BTC_OPTIONS_EXT_FALLBACK   = { put_call_ratio_oi: 1, max_pain: 0, max_pain_distance_pct: 0 };
const LIQUIDATIONS_24H_FALLBACK  = { total_usd: 1, longs_usd: 0 };
const BTC_DOMINANCE_FALLBACK     = { value: 0, delta_7d: 0, delta_30d: 0 };
const CREDIT_SPREAD_FALLBACK     = { hy_spread_bp: 0, regime: 'stable', delta_7d_bp: 0 };
const YIELD_CURVE_SPREAD_FALLBACK = { spread_bp: 0, regime: '—' };
const BTC_FUTURES_MOCK_FALLBACK  = {
  funding_rate: 0, mark_price: 0,
  ret_1d: 0, ret_1w: 0, ret_1m: 0,
  open_interest_usdt: 0, oi_delta_pct: 0, oi_delta_pct_1w: 0, oi_delta_pct_1m: 0,
  long_short_ratio: 1, funding_history: [],
};
const LIQUIDATION_CLUSTERS_FALLBACK = { clusters: [], spot: 0, total_longs_at_risk_10pct: 0, total_shorts_at_risk_10pct: 0 };
const FUTURES_BASIS_FALLBACK     = { futures: [], cme_basis_annualized: 0, cme_basis_prev_7d: 0 };
const ETF_FLOWS_FALLBACK         = { total_aum_b: 0, net_flow_today_m: 0, net_flow_7d_m: 0, net_flow_30d_m: 0, consec_inflow_days: 0, funds: [] };
const LTH_STH_SUPPLY_FALLBACK    = { lth_pct: 50, sth_pct: 50, lth_supply: 0, sth_supply: 0, lth_profit_pct: 0, sth_profit_pct: 0 };
const OI_RATIO_FALLBACK          = { ratio_pct: 0, zone: '—' };
const MARKET_REGIME_FALLBACK     = {
  regime: 'NEUTRAL', score: 50, confidence: 0,
  suggestion: { title: '—', rationale: 'Análise em processamento.' },
  components: [],
};
const DAILY_MINT_BURN_FALLBACK      = [];
const STABLECOIN_SNAPSHOT_FALLBACK  = { total_net_24h_m: 0, sigma_vs_7d: 0, usdt: { net_24h_m: 0 }, usdc: { net_24h_m: 0 } };
const STABLECOIN_ANOMALIES_FALLBACK = [];
const SUPPLY_BY_CHAIN_FALLBACK      = [];

const TODAY = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// ─── Period tabs ───────────────────────────────────────────────────────────────
const PERIODS = ['Diário', 'Semanal', 'Mensal', 'Anual'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v, dec = 2) { return v?.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) ?? '—'; }
function fmtM(v) {
  if (!v && v !== 0) return '—';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}
function sign(v) { return v >= 0 ? '+' : ''; }
function col(v, inv = false) {
  const pos = inv ? '#ef4444' : '#10b981';
  const neg = inv ? '#10b981' : '#ef4444';
  return v > 0 ? pos : v < 0 ? neg : '#f59e0b';
}

function SectionLink({ label, page, icon }) {
  return (
    <Link to={createPageUrl(page)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, color: '#3b82f6', textDecoration: 'none',
      padding: '3px 8px', borderRadius: 5,
      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {icon} {label} →
    </Link>
  );
}

function Metric({ label, value, color = '#60a5fa', sub, size = 18 }) {
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '9px 12px' }}>
      <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon, subtitle, links = [], children }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{icon} {title}</div>
          {subtitle && <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {links.map((l, i) => <SectionLink key={i} {...l} />)}
        </div>
      </div>
      {children}
    </div>
  );
}

function PeriodDelta({ label, value, unit = '%', inv = false }) {
  const c = col(value, inv);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: c }}>
        {sign(value)}{fmt(value, 1)}{unit}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#1a2535', margin: '12px 0' }} />;
}

// ─── PERIOD SELECTOR ──────────────────────────────────────────────────────────
function PeriodSelector({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535' }}>
      {PERIODS.map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
          background: active === p ? 'rgba(59,130,246,0.18)' : 'transparent',
          color: active === p ? '#60a5fa' : '#475569',
          transition: 'all 0.15s',
        }}>{p}</button>
      ))}
    </div>
  );
}

// ─── GLOBAL OVERVIEW ──────────────────────────────────────────────────────────
function GlobalOverview({ period, liveTicker, liveFng, liveRisk }) {
  const f = BTC_FUTURES_MOCK_FALLBACK;
  const sp = MACRO_BOARD_FALLBACK.series.find(s => s.id === 'SP500');
  const vix = MACRO_BOARD_FALLBACK.series.find(s => s.id === 'VIX');
  const dxy = MACRO_BOARD_FALLBACK.series.find(s => s.id === 'DXY');
  const gold = MACRO_BOARD_FALLBACK.series.find(s => s.id === 'GOLD');
  const us10y = MACRO_BOARD_FALLBACK.series.find(s => s.id === 'US10Y');

  // Merge live data over mock where available
  const btcPrice = liveTicker?.mark_price ?? f.mark_price;
  const btcRet1d = f.ret_1d; // only mock has historical returns
  const fngValue = liveFng?.value ?? FEAR_GREED_FALLBACK.value;
  const fngLabel = liveFng?.label ?? FEAR_GREED_FALLBACK.classification;
  const riskScore = liveRisk?.score ?? GLOBAL_RISK_FALLBACK.score;
  const riskRegime = liveRisk?.regime ?? GLOBAL_RISK_FALLBACK.regime;
  const riskProb = GLOBAL_RISK_FALLBACK.prob; // live RiskScoreResult has no probability field

  const getSpDelta = () => period === 'Diário' ? sp?.delta_1d : period === 'Semanal' ? sp?.delta_7d : sp?.delta_30d;
  const getDxyDelta = () => period === 'Diário' ? dxy?.delta_1d : period === 'Semanal' ? dxy?.delta_7d : dxy?.delta_30d;
  const getVixDelta = () => period === 'Diário' ? vix?.delta_1d : period === 'Semanal' ? vix?.delta_7d : vix?.delta_30d;
  const getGoldDelta = () => period === 'Diário' ? gold?.delta_1d : period === 'Semanal' ? gold?.delta_7d : gold?.delta_30d;
  const getBtcRet = () => period === 'Diário' ? f.ret_1d : period === 'Semanal' ? f.ret_1w : f.ret_1m;

  // riskRegime can be 'RISK-ON'/'RISK-OFF'/'NEUTRAL' (mock) or 'SAUDÁVEL'/'MODERADO'/'RISCO ELEVADO' (live)
  const regColor = (riskRegime === 'RISK-ON' || riskRegime === 'SAUDÁVEL') ? '#10b981'
    : (riskRegime === 'RISK-OFF' || riskRegime === 'RISCO ELEVADO') ? '#ef4444'
    : '#f59e0b';

  return (
    <SectionCard
      title="Visão Global do Mercado"
      icon="◈"
      subtitle={`Snapshot consolidado — período: ${period}`}
      links={[{ label: 'Dashboard', page: 'Dashboard', icon: '◈' }, { label: 'Macro Board', page: 'Macro', icon: '⊞' }]}
    >
      {/* Regime badge grande */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: `${regColor}0d`, border: `1px solid ${regColor}25` }}>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: regColor }}>{riskScore}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: regColor }}>{riskRegime}</div>
          <div style={{ fontSize: 10, color: '#475569' }}>Score Global · Prob. squeeze: {riskProb}%</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#334155' }}>Fear & Greed</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: fngValue > 60 ? '#10b981' : '#f59e0b' }}>{fngValue}</div>
          <div style={{ fontSize: 9, color: '#475569' }}>{fngLabel}</div>
        </div>
      </div>

      {/* BTC + macro grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="BTC" value={`$${fmt(btcPrice, 0)}`} color="#f59e0b"
          sub={`${sign(getBtcRet() * 100)}${fmt(getBtcRet() * 100, 2)}% ${period.toLowerCase()}`} />
        <Metric label="S&P 500" value={fmt(sp?.value, 0)} color={col(getSpDelta())}
          sub={`${sign(getSpDelta() * 100)}${fmt(getSpDelta() * 100, 1)}% ${period.toLowerCase()}`} />
        <Metric label="DXY" value={fmt(dxy?.value, 2)} color={col(getDxyDelta(), true)}
          sub={`${sign(getDxyDelta() * 100)}${fmt(getDxyDelta() * 100, 1)}%`} />
        <Metric label="VIX" value={fmt(vix?.value, 1)} color={vix?.value > 25 ? '#ef4444' : vix?.value > 18 ? '#f59e0b' : '#10b981'}
          sub={`${sign(getVixDelta() * 100)}${fmt(getVixDelta() * 100, 1)}%`} />
        <Metric label="Gold" value={`$${fmt(gold?.value, 0)}`} color="#f59e0b"
          sub={`${sign(getGoldDelta() * 100)}${fmt(getGoldDelta() * 100, 1)}%`} />
      </div>

      {/* Macro rates row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="US 10Y" value={`${fmt(us10y?.value, 3)}%`} color={col(us10y?.delta_1d, true)} sub={`${sign(us10y?.delta_1d_bp)}${fmt(us10y?.delta_1d_bp, 1)}bp 1D`} size={14} />
        <Metric label="Yield Spread (10-2Y)" value={`${fmt(YIELD_CURVE_SPREAD_FALLBACK.spread_bp, 1)}bp`} color={YIELD_CURVE_SPREAD_FALLBACK.spread_bp > 0 ? '#10b981' : '#ef4444'} sub={YIELD_CURVE_SPREAD_FALLBACK.regime} size={14} />
        <Metric label="HY Credit Spread" value={`${CREDIT_SPREAD_FALLBACK.hy_spread_bp}bp`} color={CREDIT_SPREAD_FALLBACK.regime === 'widening' ? '#ef4444' : '#10b981'} sub={`${sign(CREDIT_SPREAD_FALLBACK.delta_7d_bp)}${CREDIT_SPREAD_FALLBACK.delta_7d_bp}bp 7D`} size={14} />
        <Metric label="BTC Dominance" value={`${BTC_DOMINANCE_FALLBACK.value}%`} color="#60a5fa" sub={`${sign(BTC_DOMINANCE_FALLBACK.delta_7d)}${fmt(BTC_DOMINANCE_FALLBACK.delta_7d, 1)}pp 7D`} size={14} />
      </div>

      {/* Correlações rápidas */}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e' }}>
        <div style={{ fontSize: 9, color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Correlações BTC</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {BTC_CORRELATIONS_FALLBACK.pairs.map((p, i) => {
            const corrVal = period === 'Diário' ? p.corr_1d : period === 'Semanal' ? p.corr_1w : p.corr_1m;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 9, color: '#475569' }}>{p.label}</span>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: corrVal > 0 ? '#10b981' : '#ef4444' }}>
                  {corrVal > 0 ? '+' : ''}{fmt(corrVal, 2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── REGIME SECTION ───────────────────────────────────────────────────────────
function RegimeSection({ period, liveRegime, regimeLoading }) {
  const r = {
    regime:     liveRegime?.label?.toUpperCase().replace('-', '-') ?? MARKET_REGIME_FALLBACK.regime,
    score:      liveRegime?.score ?? MARKET_REGIME_FALLBACK.score,
    confidence: MARKET_REGIME_FALLBACK.confidence,  // sem equivalente live
    suggestion: MARKET_REGIME_FALLBACK.suggestion,  // sem equivalente live
    components: liveRegime?.components ?? MARKET_REGIME_FALLBACK.components,
  };
  const regColor = (r.regime === 'RISK-ON' || r.regime === 'Risk-On') ? '#10b981' : (r.regime === 'RISK-OFF' || r.regime === 'Risk-Off') ? '#ef4444' : '#f59e0b';
  // Em modo live, enquanto o regime ainda está carregando, não exibir score stale
  const scoreDisplay = (IS_LIVE && regimeLoading)
    ? <span style={{ fontSize: 13, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>Carregando regime...</span>
    : <><span style={{ fontSize: 22, fontWeight: 900, color: regColor, fontFamily: 'JetBrains Mono, monospace' }}>{r.score}/100</span>
        <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 12px', borderRadius: 6, background: `${regColor}18`, color: regColor, border: `1px solid ${regColor}30` }}>{r.regime}</span>
        <span style={{ fontSize: 10, color: '#475569' }}>Conf: {r.confidence}%</span>
      </>;

  const radarData = r.components.map(c => ({ subject: c.label.split(' ')[0], value: Math.round(c.score), fullMark: 100 }));

  // Simulated history based on period
  const histLen = period === 'Diário' ? 24 : period === 'Semanal' ? 7 : period === 'Mensal' ? 30 : 52;
  const histData = Array.from({ length: histLen }, (_, i) => ({
    t: i,
    score: Math.round(r.score - (histLen - i) * 0.3 + (Math.sin(i * 0.4) * 8)),
  }));

  return (
    <SectionCard
      title="Regime de Mercado"
      icon="🎯"
      subtitle="Classificação automática baseada em 6 variáveis macro + crypto"
      links={[{ label: 'Ver Regime Completo', page: 'MarketRegime', icon: '🎯' }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 16, alignItems: 'flex-start' }}>
        <ResponsiveContainer width="100%" height={150}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1e2d45" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: '#475569' }} />
            <Radar dataKey="value" stroke={regColor} fill={regColor} fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {scoreDisplay}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {r.components.slice(0, 6).map((c, i) => (
              <div key={i} style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
                <div style={{ fontSize: 8, color: '#334155' }}>{c.label}</div>
                <div style={{ height: 3, borderRadius: 2, background: '#1a2535', marginTop: 4 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${c.score}%`, background: c.score > 60 ? '#10b981' : c.score > 40 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#64748b', marginTop: 2 }}>{Math.round(c.score)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score histórico — {period}</div>
          <ResponsiveContainer width="100%" height={55}>
            <AreaChart data={histData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <defs><linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={regColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={regColor} stopOpacity={0} />
              </linearGradient></defs>
              <XAxis dataKey="t" hide />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
              <ReferenceLine y={65} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.3} />
              <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.3} />
              <Area dataKey="score" stroke={regColor} fill="url(#regGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Divider />

      {/* Regime suggestion */}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0a1018', border: `1px solid ${regColor}20` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: regColor, marginBottom: 4 }}>💡 Estratégia Recomendada — {r.regime}</div>
        <div style={{ fontSize: 10, color: '#8899a6', lineHeight: 1.6 }}>{r.suggestion?.rationale?.slice(0, 280)}...</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {r.suggestion?.actions?.slice(0, 4).map((a, i) => (
            <span key={i} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: `${regColor}10`, color: regColor, border: `1px solid ${regColor}20` }}>{a}</span>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── STABLECOIN SECTION ───────────────────────────────────────────────────────
function StablecoinSection({ period }) {
  const s = STABLECOIN_SUPPLY_FALLBACK;
  const snap = STABLECOIN_SNAPSHOT_FALLBACK;

  // LTH/STH: dados live via CoinMetrics (mesmo cálculo do LthSthCard.jsx)
  const { data: extended } = useOnChainExtended();
  const TOTAL_SUPPLY = 19_850_000;
  const lthPct    = extended ? extended.hodl_wave_1yr_pct * 100 : LTH_STH_SUPPLY_FALLBACK.lth_pct;
  const sthPct    = extended ? (100 - lthPct) : LTH_STH_SUPPLY_FALLBACK.sth_pct;
  const lthSupply = extended ? Math.round(TOTAL_SUPPLY * lthPct / 100) : LTH_STH_SUPPLY_FALLBACK.lth_supply;
  const sthSupply = extended ? TOTAL_SUPPLY - lthSupply : LTH_STH_SUPPLY_FALLBACK.sth_supply;

  const days = period === 'Diário' ? 7 : period === 'Semanal' ? 14 : 30;
  const chartData = DAILY_MINT_BURN_FALLBACK.slice(-days).map((h, i) => ({
    dia: h.label,
    mint: parseFloat((h.usdt_mint + h.usdc_mint).toFixed(1)),
    burn: parseFloat((h.usdt_burn + h.usdc_burn).toFixed(1)),
    net: h.total_net,
  }));

  const delta = period === 'Diário' ? s.delta_7d_pct : period === 'Semanal' ? s.delta_7d_pct : s.delta_30d_pct;

  return (
    <SectionCard
      title="Stablecoin Flow"
      icon="💧"
      subtitle="USDT + USDC · Mint/Burn · Supply por chain · Anomalias"
      links={[{ label: 'Ver Completo', page: 'StablecoinFlow', icon: '💧' }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="Supply Total" value={`$${s.total_b.toFixed(1)}B`} color="#60a5fa" sub={`${sign(delta)}${delta.toFixed(1)}% ${period.toLowerCase()}`} />
        <Metric label="USDT" value={`$${s.usdt_supply_b.toFixed(1)}B`} color="#10b981" sub={`Net 24h: +$${snap.usdt.net_24h_m.toFixed(0)}M`} />
        <Metric label="USDC" value={`$${s.usdc_supply_b.toFixed(1)}B`} color="#3b82f6" sub={`Net 24h: +$${snap.usdc.net_24h_m.toFixed(0)}M`} />
        <Metric label="Net Mint 24h" value={`$${snap.total_net_24h_m.toFixed(0)}M`} color={snap.total_net_24h_m > 0 ? '#10b981' : '#ef4444'} sub={`σ vs 7D: ${snap.sigma_vs_7d > 0 ? '+' : ''}${snap.sigma_vs_7d}%`} />
      </div>

      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 7, fill: '#334155' }} axisLine={false} tickLine={false} interval={Math.floor(days / 6)} />
          <YAxis tick={{ fontSize: 7, fill: '#334155' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
          <ReferenceLine y={0} stroke="#1e2d45" />
          <Bar dataKey="mint" fill="#10b981" fillOpacity={0.6} radius={[2, 2, 0, 0]} name="Mint" />
          <Bar dataKey="burn" fill="#ef4444" fillOpacity={0.6} radius={[0, 0, 2, 2]} name="Burn" />
          <Line dataKey="net" stroke="#60a5fa" strokeWidth={2} dot={false} name="Net" />
        </ComposedChart>
      </ResponsiveContainer>

      <Divider />

      {/* Supply by chain + anomalies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Supply por Chain</div>
          {SUPPLY_BY_CHAIN_FALLBACK.map((ch, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#8899a6', flex: 1 }}>{ch.chain}</span>
              <div style={{ flex: 2, height: 4, borderRadius: 2, background: '#1a2535' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${ch.share_pct}%`, background: ch.color, opacity: 0.7 }} />
              </div>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#64748b', width: 38, textAlign: 'right' }}>${ch.total_b.toFixed(0)}B</span>
              <span style={{ fontSize: 8, color: '#334155', width: 32, textAlign: 'right' }}>{ch.share_pct}%</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Anomalias Detectadas</div>
          {STABLECOIN_ANOMALIES_FALLBACK.map((a, i) => (
            <div key={i} style={{ marginBottom: 7, padding: '7px 10px', borderRadius: 7, background: '#0a1018', border: `1px solid ${a.severity === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: a.severity === 'HIGH' ? '#ef4444' : '#f59e0b' }}>{a.severity}</span>
                <span style={{ fontSize: 8, color: '#334155' }}>{a.token}</span>
              </div>
              <div style={{ fontSize: 9, color: '#8899a6', lineHeight: 1.4 }}>{a.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* LTH/STH */}
      <Divider />
      <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>LTH vs STH Supply</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Metric label="LTH Supply" value={`${lthPct.toFixed(1)}%`} color="#10b981" sub={`${(lthSupply / 1e6).toFixed(2)}M BTC`} size={14} />
        <Metric label="LTH em Lucro" value={`${LTH_STH_SUPPLY_FALLBACK.lth_profit_pct}%`} color="#10b981" sub="Long-Term Holders" size={14} />
        <Metric label="STH Supply" value={`${sthPct.toFixed(1)}%`} color="#f59e0b" sub={`${(sthSupply / 1e6).toFixed(2)}M BTC`} size={14} />
        <Metric label="STH em Lucro" value={`${LTH_STH_SUPPLY_FALLBACK.sth_profit_pct}%`} color={LTH_STH_SUPPLY_FALLBACK.sth_profit_pct > 60 ? '#f59e0b' : '#ef4444'} sub="Short-Term Holders" size={14} />
      </div>
    </SectionCard>
  );
}

// ─── DERIVATIVES SECTION ──────────────────────────────────────────────────────
function DerivativesSection({ period, liveTicker }) {
  const f = BTC_FUTURES_MOCK_FALLBACK;
  const basis = FUTURES_BASIS_FALLBACK;
  const liq = LIQUIDATION_CLUSTERS_FALLBACK;
  const fundingRate = liveTicker?.last_funding_rate ?? f.funding_rate;
  const openInterest = liveTicker
    ? liveTicker.open_interest * liveTicker.mark_price
    : f.open_interest_usdt;
  const oiDelta1d = liveTicker?.oi_delta_pct ?? f.oi_delta_pct;
  const fundingAnn = fundingRate * 3 * 365 * 100;
  const carrySpread = (basis.futures[1]?.basis_annualized || 0) - 4.512;

  const histLen = period === 'Diário' ? 14 : period === 'Semanal' ? 21 : 30;
  const fundingHist = f.funding_history.slice(-histLen).map((h, i) => ({
    t: i,
    rate: parseFloat((h.fundingRate * 100).toFixed(4)),
  }));

  const oiHist = Array.from({ length: histLen }, (_, i) => ({
    t: i,
    oi: parseFloat(((f.open_interest_usdt / 1e9) * (0.8 + i / histLen * 0.2 + (Math.sin(i) * 0.02))).toFixed(2)),
  }));

  const liqClusters = [...LIQUIDATION_CLUSTERS_FALLBACK.clusters].sort((a, b) => a.price - b.price);
  const maxLiq = Math.max(...liqClusters.map(c => Math.max(c.longs_usd, c.shorts_usd)));

  return (
    <SectionCard
      title="Derivativos"
      icon="⟆"
      subtitle="Funding · OI · Liquidações · Basis · Carry Trade · Options"
      links={[
        { label: 'Derivatives', page: 'Derivatives', icon: '⟆' },
        { label: 'Deriv. Avançado', page: 'DerivativesAdvanced', icon: '⚗️' },
        { label: 'Options', page: 'Options', icon: '◬' },
      ]}
    >
      {/* Top metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="Funding Rate" value={`${(fundingRate * 100).toFixed(4)}%`} color={fundingRate > 0.0006 ? '#f59e0b' : '#10b981'} sub={`Ann: ${fundingAnn.toFixed(1)}%`} />
        <Metric label="Open Interest" value={fmtM(openInterest)} color="#60a5fa" sub={`+${oiDelta1d}% 1D · +${f.oi_delta_pct_1w}% 1W`} />
        <Metric label="Basis Jun26" value={`${basis.futures[1]?.basis_annualized?.toFixed(1)}%`} color="#10b981" sub={`Carry vs US10Y: +${carrySpread.toFixed(1)}pp`} />
        <Metric label="OI/Mkt Cap" value={`${OI_RATIO_FALLBACK.ratio_pct.toFixed(2)}%`} color={OI_RATIO_FALLBACK.ratio_pct > 1.2 ? '#f59e0b' : '#10b981'} sub={OI_RATIO_FALLBACK.zone} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="L/S Ratio" value={f.long_short_ratio.toFixed(2)} color={f.long_short_ratio > 1 ? '#10b981' : '#ef4444'} sub="Global accounts" size={14} />
        <Metric label="Longs Risco -10%" value={fmtM(liq.total_longs_at_risk_10pct)} color="#ef4444" sub="Liquidação cascata" size={14} />
        <Metric label="Shorts Risco +10%" value={fmtM(liq.total_shorts_at_risk_10pct)} color="#a78bfa" sub="Short squeeze" size={14} />
        <Metric label="Liq. 24h Total" value={fmtM(LIQUIDATIONS_24H_FALLBACK.total_usd)} color="#f59e0b" sub={`Longs: ${((LIQUIDATIONS_24H_FALLBACK.longs_usd / LIQUIDATIONS_24H_FALLBACK.total_usd) * 100).toFixed(0)}%`} size={14} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Funding Rate — {period}</div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={fundingHist} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="t" hide />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} formatter={v => [`${v}%`, 'Funding']} />
              <ReferenceLine y={0} stroke="#1e2d45" />
              <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                {fundingHist.map((e, i) => <Cell key={i} fill={e.rate > 0.06 ? '#f59e0b' : e.rate > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Interest (B USD) — {period}</div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={oiHist} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <defs><linearGradient id="oiG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient></defs>
              <XAxis dataKey="t" hide />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
              <Area dataKey="oi" stroke="#3b82f6" fill="url(#oiG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Liquidation heatmap mini */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, color: '#334155', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clusters de Liquidação</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
          {liqClusters.map((c, i) => {
            const isAbove = c.price > LIQUIDATION_CLUSTERS_FALLBACK.spot;
            const val = isAbove ? c.shorts_usd : c.longs_usd;
            const h = Math.round((val / maxLiq) * 44) + 6;
            const clr = isAbove ? '#a78bfa' : '#ef4444';
            return (
              <div key={i} title={`$${(c.price / 1000).toFixed(0)}K: ${fmtM(val)}`} style={{ flex: 1, height: h, borderRadius: 2, background: clr, opacity: 0.6 + (val / maxLiq) * 0.4 }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#334155', marginTop: 2 }}>
          <span>$78K (longs)</span>
          <span style={{ color: '#f59e0b' }}>↑ Spot $84.3K</span>
          <span>$92K (shorts)</span>
        </div>
      </div>

      {/* Basis curve */}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e' }}>
        <div style={{ fontSize: 9, color: '#334155', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Basis Anualizado por Vencimento</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {basis.futures.map((ft, i) => (
            <div key={i} style={{ background: '#111827', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#334155' }}>{ft.expiry.split('-').slice(0, 2).join(' ')}</div>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{ft.basis_annualized.toFixed(1)}%</div>
              <div style={{ fontSize: 7, color: '#475569' }}>{ft.days_to_exp}d</div>
            </div>
          ))}
          <div style={{ background: '#111827', borderRadius: 6, padding: '6px 10px', textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: 8, color: '#334155' }}>CME (inst.)</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>{basis.cme_basis_annualized}%</div>
            <div style={{ fontSize: 7, color: '#475569' }}>prev 7d: {basis.cme_basis_prev_7d}%</div>
          </div>
        </div>
      </div>

      <Divider />

      {/* Options quick */}
      <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Options Snapshot</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Metric label="IV ATM" value={`${(BTC_OPTIONS_MOCK_FALLBACK.iv_atm * 100).toFixed(1)}%`} color="#a78bfa" sub={`+${(BTC_OPTIONS_MOCK_FALLBACK.iv_atm_1d_delta * 100).toFixed(1)}pp 1D`} size={14} />
        <Metric label="Skew" value={`${(BTC_OPTIONS_MOCK_FALLBACK.skew * 100).toFixed(1)}pp`} color={BTC_OPTIONS_MOCK_FALLBACK.skew < 0 ? '#ef4444' : '#10b981'} sub={BTC_OPTIONS_MOCK_FALLBACK.skew_direction} size={14} />
        <Metric label="Put/Call Ratio" value={BTC_OPTIONS_EXT_FALLBACK.put_call_ratio_oi.toFixed(2)} color="#60a5fa" sub="por OI" size={14} />
        <Metric label="Max Pain" value={`$${(BTC_OPTIONS_EXT_FALLBACK.max_pain / 1000).toFixed(0)}K`} color="#f59e0b" sub={`${BTC_OPTIONS_EXT_FALLBACK.max_pain_distance_pct.toFixed(1)}% do spot`} size={14} />
      </div>
    </SectionCard>
  );
}

// ─── ON-CHAIN SECTION ─────────────────────────────────────────────────────────
function OnChainSection({ period, liveOnChain }) {
  const nupl = {
    value:      liveOnChain?.nupl            ?? BTC_NUPL_FALLBACK.value,
    zone:       liveOnChain?.nupl_zone       ?? BTC_NUPL_FALLBACK.zone,
    zone_color: liveOnChain?.nupl_zone_color ?? BTC_NUPL_FALLBACK.zone_color,
    history:    BTC_NUPL_FALLBACK.history,   // mantém histórico mock (formato diferente)
    delta_7d:   BTC_NUPL_FALLBACK.delta_7d,  // sem equivalente live
    delta_30d:  BTC_NUPL_FALLBACK.delta_30d, // sem equivalente live
  };
  const sopr = BTC_SOPR_FALLBACK; // sem API gratuita — permanece mock
  const mvrv = {
    mvrv_ratio:      liveOnChain?.mvrv_current    ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_ratio,
    mvrv_zone:       liveOnChain?.mvrv_zone        ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_zone,
    mvrv_zone_color: liveOnChain?.mvrv_zone_color  ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_zone_color,
    mvrv_zscore:     liveOnChain?.mvrv_zscore      ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_zscore,
    realized_price:  liveOnChain?.realized_price   ?? BTC_REALIZED_METRICS_FALLBACK.realized_price,
  };
  const netflow = BTC_EXCHANGE_NETFLOW_FALLBACK;
  const whale = BTC_WHALE_ACTIVITY_FALLBACK;

  const histKey = period === 'Diário' ? '1d' : period === 'Semanal' ? '1w' : '1m';
  const nuplHist = nupl.history[histKey] || nupl.history['1w'];

  return (
    <SectionCard
      title="On-Chain"
      icon="⛓"
      subtitle="NUPL · SOPR · MVRV · Exchange Netflow · Whales · Hash Rate"
      links={[{ label: 'Ver On-Chain Completo', page: 'OnChain', icon: '⛓' }]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="NUPL" value={nupl.value.toFixed(3)} color={nupl.zone_color} sub={nupl.zone} />
        <Metric label="SOPR" value={sopr.value.toFixed(3)} color={sopr.value > 1 ? '#10b981' : '#ef4444'} sub={`7D avg: ${sopr.smoothed_7d.toFixed(3)}`} />
        <Metric label="MVRV" value={mvrv.mvrv_ratio.toFixed(2)} color={mvrv.mvrv_zone_color} sub={mvrv.mvrv_zone} />
        <Metric label="Exchange Netflow 24h" value={`${netflow.netflow_24h > 0 ? '+' : ''}${(netflow.netflow_24h / 1000).toFixed(1)}K BTC`} color={netflow.netflow_24h < 0 ? '#10b981' : '#ef4444'} sub={netflow.netflow_24h < 0 ? '← Acumulação' : '→ Venda'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>NUPL — {period}</div>
          <ResponsiveContainer width="100%" height={65}>
            <AreaChart data={nuplHist} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <defs><linearGradient id="nuplG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={nupl.zone_color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={nupl.zone_color} stopOpacity={0} />
              </linearGradient></defs>
              <XAxis dataKey="t" hide />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
              <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Area dataKey="v" stroke={nupl.zone_color} fill="url(#nuplG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Whale Transactions 24h</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0a1018', border: '1px solid #0f1d2e' }}>
              <div style={{ fontSize: 8, color: '#334155' }}>Txs &gt;$1M</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>{whale.txs_over_1m_24h.toLocaleString()}</div>
              <div style={{ fontSize: 8, color: col(whale.delta_1m_vs_avg) }}>{sign(whale.delta_1m_vs_avg)}{whale.delta_1m_vs_avg.toFixed(1)}% vs avg</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0a1018', border: '1px solid #0f1d2e' }}>
              <div style={{ fontSize: 8, color: '#334155' }}>Txs &gt;$10M</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa' }}>{whale.txs_over_10m_24h}</div>
              <div style={{ fontSize: 8, color: col(whale.delta_10m_vs_avg) }}>{sign(whale.delta_10m_vs_avg)}{whale.delta_10m_vs_avg.toFixed(1)}% vs avg</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Metric label="Realized Price" value={`$${(mvrv.realized_price / 1000).toFixed(1)}K`} color="#8899a6" sub={`MVRV Z: ${mvrv.mvrv_zscore.toFixed(2)}`} size={14} />
        <Metric label="Reservas Exchange" value={`${(netflow.exchange_reserves / 1e6).toFixed(2)}M BTC`} color={netflow.exchange_reserves < 2_400_000 ? '#10b981' : '#f59e0b'} sub={`${sign(netflow.reserves_delta_30d_pct)}${netflow.reserves_delta_30d_pct.toFixed(1)}% 30D`} size={14} />
        <Metric label="Netflow 7D" value={`${netflow.netflow_7d > 0 ? '+' : ''}${(netflow.netflow_7d / 1000).toFixed(0)}K BTC`} color={netflow.netflow_7d < 0 ? '#10b981' : '#ef4444'} sub="Saída = acumulação" size={14} />
      </div>
    </SectionCard>
  );
}

// ─── ETF & MACRO SECTION ──────────────────────────────────────────────────────
function ETFMacroSection({ period }) {
  const etf = ETF_FLOWS_FALLBACK;
  const topFunds = etf.funds.slice(0, 5);

  const flowKey = period === 'Diário' ? 'flow_today_m' : period === 'Semanal' ? 'flow_7d_m' : 'flow_30d_m';
  const netKey = period === 'Diário' ? 'net_flow_today_m' : period === 'Semanal' ? 'net_flow_7d_m' : 'net_flow_30d_m';

  return (
    <SectionCard
      title="ETF Flows & Macro"
      icon="🏦"
      subtitle="IBIT · FBTC · GBTC · AUM · Flows institucionais"
      links={[
        { label: 'ETF Flows', page: 'ETFFlows', icon: '🏦' },
        { label: 'Macro Board', page: 'Macro', icon: '⊞' },
        { label: 'Calendário', page: 'Calendar', icon: '◷' },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="AUM Total" value={`$${etf.total_aum_b.toFixed(1)}B`} color="#60a5fa" sub={`${etf.consec_inflow_days}d consecutivos entrada`} />
        <Metric label={`Net Flow ${period}`} value={fmtM(etf[netKey] * 1e6)} color={etf[netKey] > 0 ? '#10b981' : '#ef4444'} sub="USD" />
        <Metric label="IBIT (BlackRock)" value={`$${etf.funds[0].aum_b.toFixed(1)}B`} color="#3b82f6" sub={`Flow: ${fmtM((etf.funds[0][flowKey] || 0) * 1e6)}`} />
      </div>

      {/* Fund bars */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Flow por Fundo — {period}</div>
        {topFunds.map((fund, i) => {
          const flowVal = (fund[flowKey] || 0);
          const maxFlow = Math.max(...topFunds.map(f => Math.abs(f[flowKey] || 0)));
          const pct = maxFlow > 0 ? Math.abs(flowVal) / maxFlow * 100 : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#8899a6', width: 36 }}>{fund.ticker}</span>
              <div style={{ flex: 1, height: 10, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: flowVal >= 0 ? fund.color : '#ef4444', opacity: 0.8 }} />
              </div>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: flowVal >= 0 ? '#10b981' : '#ef4444', width: 64, textAlign: 'right' }}>
                {flowVal >= 0 ? '+' : ''}${Math.abs(flowVal).toFixed(0)}M
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── PERIOD SUMMARY TABLE ─────────────────────────────────────────────────────
function PeriodSummaryTable() {
  const f = BTC_FUTURES_MOCK_FALLBACK;
  const rows = [
    { metric: 'BTC Price', d: `+${fmt(f.ret_1d * 100, 2)}%`, w: `+${fmt(f.ret_1w * 100, 2)}%`, m: `${fmt(f.ret_1m * 100, 2)}%`, y: '+124.8%', dC: col(f.ret_1d), wC: col(f.ret_1w), mC: col(f.ret_1m), yC: '#10b981' },
    { metric: 'Open Interest', d: `+${f.oi_delta_pct}%`, w: `+${f.oi_delta_pct_1w}%`, m: `+${f.oi_delta_pct_1m}%`, y: '+284%', dC: col(f.oi_delta_pct), wC: col(f.oi_delta_pct_1w), mC: col(f.oi_delta_pct_1m), yC: '#10b981' },
    { metric: 'Stablecoin Supply', d: '+0.3%', w: `+${STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct.toFixed(1)}%`, m: `+${STABLECOIN_SUPPLY_FALLBACK.delta_30d_pct.toFixed(1)}%`, y: '+42%', dC: '#10b981', wC: '#10b981', mC: '#10b981', yC: '#10b981' },
    { metric: 'NUPL', d: `+${BTC_NUPL_FALLBACK.delta_7d.toFixed(3)}`, w: `+${BTC_NUPL_FALLBACK.delta_7d.toFixed(3)}`, m: `+${BTC_NUPL_FALLBACK.delta_30d.toFixed(3)}`, y: '+0.22', dC: '#10b981', wC: '#10b981', mC: '#10b981', yC: '#10b981' },
    { metric: 'Funding Rate', d: '0.0712%', w: '0.0524%', m: '0.0398%', y: '~0.02%', dC: '#f59e0b', wC: '#f59e0b', mC: '#10b981', yC: '#10b981' },
    { metric: 'ETF AUM', d: '+$284.6M', w: '+$1.84B', m: '+$8.42B', y: '+$112B', dC: '#10b981', wC: '#10b981', mC: '#10b981', yC: '#10b981' },
    { metric: 'BTC Dominance', d: `+${fmt(BTC_DOMINANCE_FALLBACK.delta_7d / 7, 2)}pp`, w: `+${fmt(BTC_DOMINANCE_FALLBACK.delta_7d, 2)}pp`, m: `+${fmt(BTC_DOMINANCE_FALLBACK.delta_30d, 2)}pp`, y: '+12pp', dC: '#60a5fa', wC: '#60a5fa', mC: '#60a5fa', yC: '#60a5fa' },
    { metric: 'VIX', d: '+1.6%', w: `+${fmt(MACRO_BOARD_FALLBACK.series.find(s => s.id === 'VIX')?.delta_7d * 100, 1)}%`, m: `+${fmt(MACRO_BOARD_FALLBACK.series.find(s => s.id === 'VIX')?.delta_30d * 100, 1)}%`, y: '—', dC: '#ef4444', wC: '#ef4444', mC: '#ef4444', yC: '#f59e0b' },
  ];

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 14 }}>📅 Comparativo Multi-Período</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Métrica', 'Diário', 'Semanal', 'Mensal', 'Anual'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Métrica' ? 'left' : 'center', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #1a2535' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(26,37,53,0.5)' }}>
                <td style={{ padding: '7px 10px', fontSize: 11, color: '#8899a6', fontWeight: 600 }}>{row.metric}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: row.dC, fontWeight: 700 }}>{row.d}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: row.wC, fontWeight: 700 }}>{row.w}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: row.mC, fontWeight: 700 }}>{row.m}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: row.yC, fontWeight: 700 }}>{row.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ALL MODULE LINKS ─────────────────────────────────────────────────────────
const ALL_MODULES = [
  { label: 'Overview', page: 'Dashboard', icon: '◈', desc: 'Visão geral' },
  { label: 'Derivatives', page: 'Derivatives', icon: '⟆', desc: 'Futuros & Funding' },
  { label: 'Spot Flow', page: 'SpotFlow', icon: '⟴', desc: 'CVD & Volume' },
  { label: 'Options', page: 'Options', icon: '◬', desc: 'IV & Greeks' },
  { label: 'ETF Flows', page: 'ETFFlows', icon: '🏦', desc: 'IBIT · FBTC · GBTC' },
  { label: 'Stablecoin', page: 'StablecoinFlow', icon: '💧', desc: 'Mint · Burn' },
  { label: 'Regime', page: 'MarketRegime', icon: '🎯', desc: 'Risk-On · Off' },
  { label: 'Macro Board', page: 'Macro', icon: '⊞', desc: 'S&P · DXY · Yields' },
  { label: 'On-Chain', page: 'OnChain', icon: '⛓', desc: 'NUPL · MVRV' },
  { label: 'Calendário', page: 'Calendar', icon: '◷', desc: 'CPI · FOMC · NFP' },
  { label: 'Notícias AI', page: 'NewsIntelligence', icon: '🧠', desc: 'Sentimento' },
  { label: 'Estratégias', page: 'Strategies', icon: '⚡', desc: 'Setups · Carry' },
  { label: 'Preditivo', page: 'PredictivePanel', icon: '🔮', desc: 'BTC 24h' },
  { label: 'Deriv. Avançado', page: 'DerivativesAdvanced', icon: '⚗️', desc: 'Liq · OI Strike' },
  { label: 'Smart Alerts', page: 'SmartAlerts', icon: '🔔', desc: 'AI · Anomalias' },
  { label: 'Automações', page: 'Automations', icon: '⚙️', desc: 'Rules · Webhook' },
];

// ─── EMAIL SCHEDULER ──────────────────────────────────────────────────────────
function EmailScheduler({ onClose, liveTicker, liveFng, liveRisk, liveRegime, liveOnChain }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const f = BTC_FUTURES_MOCK_FALLBACK;
  const btcPrice = liveTicker?.mark_price ?? f.mark_price;
  const fundingRate = liveTicker?.last_funding_rate ?? f.funding_rate;
  const openInterest = (liveTicker?.open_interest != null)
    ? liveTicker.open_interest * liveTicker.mark_price
    : f.open_interest_usdt;
  const fngValue = liveFng?.value ?? FEAR_GREED_FALLBACK.value;
  const fngLabel = liveFng?.label ?? FEAR_GREED_FALLBACK.classification;
  const riskScore = liveRisk?.score ?? GLOBAL_RISK_FALLBACK.score;
  const riskRegime = liveRisk?.regime ?? GLOBAL_RISK_FALLBACK.regime;
  // regime live-with-fallback para o email
  const emailRegimeScore = liveRegime?.score ?? MARKET_REGIME_FALLBACK.score;
  const emailRegimeLabel = liveRegime?.label?.toUpperCase().replace('-', '-') ?? MARKET_REGIME_FALLBACK.regime;
  // on-chain live-with-fallback para o email
  const emailNuplValue = liveOnChain?.nupl ?? BTC_NUPL_FALLBACK.value;
  const emailNuplZone  = liveOnChain?.nupl_zone ?? BTC_NUPL_FALLBACK.zone;
  const emailMvrvRatio = liveOnChain?.mvrv_current ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_ratio;
  const emailMvrvZone  = liveOnChain?.mvrv_zone ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_zone;

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    await sendNotificationEmail({
      to: email,
      subject: `📊 Relatório Executivo CryptoWatch — ${new Date().toLocaleDateString('pt-BR')}`,
      body: `
Olá,

Segue o Relatório Executivo do CryptoWatch — ${new Date().toLocaleString('pt-BR')}

══════════════════════════════════════════
🌐 VISÃO GLOBAL
Regime: ${riskRegime} · Score: ${riskScore}/100
Fear & Greed: ${fngValue} (${fngLabel})
BTC: $${fmt(btcPrice, 0)} | 1D: ${sign(f.ret_1d * 100)}${fmt(f.ret_1d * 100, 2)}% | 1W: ${sign(f.ret_1w * 100)}${fmt(f.ret_1w * 100, 2)}%

══════════════════════════════════════════
🎯 REGIME DE MERCADO
Score: ${emailRegimeScore}/100 · Confiança: ${MARKET_REGIME_FALLBACK.confidence}%
Regime: ${emailRegimeLabel}
Estratégia: ${MARKET_REGIME_FALLBACK.suggestion?.title || '—'}

══════════════════════════════════════════
💧 STABLECOIN FLOW
Supply Total: $${STABLECOIN_SUPPLY_FALLBACK.total_b.toFixed(1)}B
7D: ${sign(STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct)}${STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct.toFixed(1)}% | 30D: ${sign(STABLECOIN_SUPPLY_FALLBACK.delta_30d_pct)}${STABLECOIN_SUPPLY_FALLBACK.delta_30d_pct.toFixed(1)}%
USDT: $${STABLECOIN_SUPPLY_FALLBACK.usdt_supply_b.toFixed(1)}B | USDC: $${STABLECOIN_SUPPLY_FALLBACK.usdc_supply_b.toFixed(1)}B

══════════════════════════════════════════
⟆ DERIVATIVOS
Funding Rate: ${(fundingRate * 100).toFixed(4)}% (ann: ${(fundingRate * 3 * 365 * 100).toFixed(1)}%)
Open Interest: $${(openInterest / 1e9).toFixed(2)}B
  1D: +${f.oi_delta_pct}% | 1W: +${f.oi_delta_pct_1w}% | 1M: +${f.oi_delta_pct_1m}%
Basis Jun26: ${FUTURES_BASIS_FALLBACK.futures[1]?.basis_annualized.toFixed(1)}% vs US10Y 4.5%
Longs em risco (−10%): $${(LIQUIDATION_CLUSTERS_FALLBACK.total_longs_at_risk_10pct / 1e9).toFixed(2)}B

══════════════════════════════════════════
⛓ ON-CHAIN
NUPL: ${emailNuplValue.toFixed(3)} (${emailNuplZone})
SOPR: ${BTC_SOPR_FALLBACK.value.toFixed(3)}
MVRV: ${emailMvrvRatio.toFixed(2)} (${emailMvrvZone})
Exchange Netflow 24h: ${BTC_EXCHANGE_NETFLOW_FALLBACK.netflow_24h > 0 ? '+' : ''}${BTC_EXCHANGE_NETFLOW_FALLBACK.netflow_24h.toLocaleString()} BTC

══════════════════════════════════════════
🏦 ETF FLOWS
AUM Total: $${ETF_FLOWS_FALLBACK.total_aum_b.toFixed(1)}B
Net Hoje: +$${ETF_FLOWS_FALLBACK.net_flow_today_m.toFixed(0)}M
Net 7D: +$${ETF_FLOWS_FALLBACK.net_flow_7d_m.toFixed(0)}M
${ETF_FLOWS_FALLBACK.consec_inflow_days} dias consecutivos de entrada

══════════════════════════════════════════
Acesse: https://app.cryptowatch.io · Dados: ${IS_LIVE ? '🛰️ LIVE' : '🧪 DEMO'}
CryptoWatch Intelligence Suite
      `.trim(),
    });
    setSent(true);
    setSending(false);
  };

  if (sent) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>E-mail enviado!</div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>Relatório enviado para {email}</div>
      <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 7, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', cursor: 'pointer', fontSize: 12 }}>Fechar</button>
    </div>
  );

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>📧 Enviar Relatório</div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 18 }}>Envie o relatório executivo por e-mail agora</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>E-mail de destino</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
            style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '8px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, background: 'transparent', border: '1px solid #1a2535', color: '#475569', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
          <button onClick={handleSend} disabled={!email || sending} style={{
            padding: '8px 20px', borderRadius: 7,
            background: email && !sending ? 'rgba(59,130,246,0.15)' : '#0d1421',
            border: `1px solid ${email && !sending ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
            color: email && !sending ? '#60a5fa' : '#334155', cursor: email && !sending ? 'pointer' : 'default', fontSize: 11, fontWeight: 700,
          }}>{sending ? 'Enviando...' : '📧 Enviar Agora'}</button>
        </div>
        <div style={{ fontSize: 9, color: '#475569', padding: '7px 9px', background: 'rgba(30,48,72,0.4)', border: '1px solid #162032', borderRadius: 6 }}>
          Agendamento automático disponível em versão futura.
        </div>
      </div>
    </div>
  );
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportPDF({ liveRegime = null, liveOnChain = null } = {}) {
  const f = BTC_FUTURES_MOCK_FALLBACK;
  // live-with-fallback para variáveis usadas no template HTML
  const pdfRegimeScore = liveRegime?.score ?? MARKET_REGIME_FALLBACK.score;
  const pdfRegimeLabel = liveRegime?.label?.toUpperCase().replace('-', '-') ?? MARKET_REGIME_FALLBACK.regime;
  const pdfNuplValue   = liveOnChain?.nupl           ?? BTC_NUPL_FALLBACK.value;
  const pdfNuplZone    = liveOnChain?.nupl_zone       ?? BTC_NUPL_FALLBACK.zone;
  const pdfMvrvRatio   = liveOnChain?.mvrv_current    ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_ratio;
  const pdfMvrvZone    = liveOnChain?.mvrv_zone       ?? BTC_REALIZED_METRICS_FALLBACK.mvrv_zone;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html><head>
      <title>Relatório Executivo CryptoWatch — ${new Date().toLocaleDateString('pt-BR')}</title>
      <style>
        body { font-family: 'Courier New', monospace; background: #fff; color: #111; padding: 28px; font-size: 11px; }
        h1 { color: #1d4ed8; font-size: 18px; margin-bottom: 4px; }
        h2 { color: #1e3a5f; font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #dde; padding-bottom: 4px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
        .metric { border: 1px solid #dde; border-radius: 6px; padding: 8px 10px; }
        .label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; }
        .value { font-size: 15px; font-weight: bold; color: #111; }
        .sub { font-size: 8px; color: #888; margin-top: 2px; }
        .ai { background: #f0f7ff; border: 1px solid #c7d9f0; padding: 10px 12px; border-radius: 6px; margin-top: 10px; font-size: 10px; line-height: 1.5; }
        .tag { display: inline-block; font-size: 8px; padding: 2px 7px; border-radius: 3px; background: #e8f0fe; color: #1d4ed8; margin: 2px 3px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { text-align: left; padding: 5px 8px; border-bottom: 2px solid #dde; color: #666; font-size: 9px; text-transform: uppercase; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        .footer { margin-top: 24px; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>
      <h1>📊 CryptoWatch — Relatório Executivo Diário</h1>
      <p style="color:#666;font-size:10px;margin:0 0 20px">${TODAY}</p>

      <h2>🌐 Visão Global</h2>
      <div class="grid">
        <div class="metric"><div class="label">Regime Global</div><div class="value">${GLOBAL_RISK_FALLBACK.regime}</div><div class="sub">Score: ${GLOBAL_RISK_FALLBACK.score}/100</div></div>
        <div class="metric"><div class="label">BTC Price</div><div class="value">$${fmt(f.mark_price, 0)}</div><div class="sub">1D: ${sign(f.ret_1d * 100)}${fmt(f.ret_1d * 100, 2)}%</div></div>
        <div class="metric"><div class="label">Fear & Greed</div><div class="value">${FEAR_GREED_FALLBACK.value}</div><div class="sub">${FEAR_GREED_FALLBACK.classification}</div></div>
        <div class="metric"><div class="label">BTC Dominance</div><div class="value">${BTC_DOMINANCE_FALLBACK.value}%</div><div class="sub">7D: ${sign(BTC_DOMINANCE_FALLBACK.delta_7d)}${fmt(BTC_DOMINANCE_FALLBACK.delta_7d, 1)}pp</div></div>
      </div>

      <h2>🎯 Regime de Mercado</h2>
      <div class="grid">
        <div class="metric"><div class="label">Score</div><div class="value">${pdfRegimeScore}/100</div></div>
        <div class="metric"><div class="label">Regime</div><div class="value">${pdfRegimeLabel}</div></div>
        <div class="metric"><div class="label">Confiança</div><div class="value">${MARKET_REGIME_FALLBACK.confidence}%</div></div>
        <div class="metric"><div class="label">VIX</div><div class="value">${MACRO_BOARD_FALLBACK.series.find(s => s.id === 'VIX')?.value.toFixed(1)}</div></div>
      </div>
      <div class="ai">💡 ${MARKET_REGIME_FALLBACK.suggestion?.rationale?.slice(0, 300) || 'Análise em processamento.'}...</div>

      <h2>💧 Stablecoin Flow</h2>
      <div class="grid">
        <div class="metric"><div class="label">Supply Total</div><div class="value">$${STABLECOIN_SUPPLY_FALLBACK.total_b.toFixed(1)}B</div><div class="sub">7D: ${sign(STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct)}${STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct.toFixed(1)}%</div></div>
        <div class="metric"><div class="label">USDT</div><div class="value">$${STABLECOIN_SUPPLY_FALLBACK.usdt_supply_b.toFixed(1)}B</div></div>
        <div class="metric"><div class="label">USDC</div><div class="value">$${STABLECOIN_SUPPLY_FALLBACK.usdc_supply_b.toFixed(1)}B</div></div>
        <div class="metric"><div class="label">Net Mint 24h</div><div class="value">+$${STABLECOIN_SNAPSHOT_FALLBACK.total_net_24h_m.toFixed(0)}M</div></div>
      </div>

      <h2>⟆ Derivativos</h2>
      <div class="grid">
        <div class="metric"><div class="label">Funding Rate</div><div class="value">${(f.funding_rate * 100).toFixed(4)}%</div><div class="sub">Ann: ${(f.funding_rate * 3 * 365 * 100).toFixed(1)}%</div></div>
        <div class="metric"><div class="label">Open Interest</div><div class="value">$${(f.open_interest_usdt / 1e9).toFixed(2)}B</div><div class="sub">+${f.oi_delta_pct}% 1D</div></div>
        <div class="metric"><div class="label">Basis Jun26</div><div class="value">${FUTURES_BASIS_FALLBACK.futures[1]?.basis_annualized.toFixed(1)}%</div><div class="sub">vs US10Y 4.5%</div></div>
        <div class="metric"><div class="label">Longs em Risco −10%</div><div class="value">$${(LIQUIDATION_CLUSTERS_FALLBACK.total_longs_at_risk_10pct / 1e9).toFixed(2)}B</div></div>
      </div>

      <h2>⛓ On-Chain</h2>
      <div class="grid">
        <div class="metric"><div class="label">NUPL</div><div class="value">${pdfNuplValue.toFixed(3)}</div><div class="sub">${pdfNuplZone}</div></div>
        <div class="metric"><div class="label">SOPR</div><div class="value">${BTC_SOPR_FALLBACK.value.toFixed(3)}</div></div>
        <div class="metric"><div class="label">MVRV</div><div class="value">${pdfMvrvRatio.toFixed(2)}</div><div class="sub">${pdfMvrvZone}</div></div>
        <div class="metric"><div class="label">Netflow 24h</div><div class="value">${BTC_EXCHANGE_NETFLOW_FALLBACK.netflow_24h > 0 ? '+' : ''}${(BTC_EXCHANGE_NETFLOW_FALLBACK.netflow_24h / 1000).toFixed(1)}K BTC</div></div>
      </div>

      <h2>🏦 ETF Flows</h2>
      <div class="grid">
        <div class="metric"><div class="label">AUM Total</div><div class="value">$${ETF_FLOWS_FALLBACK.total_aum_b.toFixed(1)}B</div></div>
        <div class="metric"><div class="label">Net Hoje</div><div class="value">+$${ETF_FLOWS_FALLBACK.net_flow_today_m.toFixed(0)}M</div></div>
        <div class="metric"><div class="label">Net 7D</div><div class="value">+$${ETF_FLOWS_FALLBACK.net_flow_7d_m.toFixed(0)}M</div></div>
        <div class="metric"><div class="label">Dias Consecutivos</div><div class="value">${ETF_FLOWS_FALLBACK.consec_inflow_days}d entrada</div></div>
      </div>

      <h2>📅 Comparativo Multi-Período</h2>
      <table>
        <tr><th>Métrica</th><th>Diário</th><th>Semanal</th><th>Mensal</th><th>Anual</th></tr>
        <tr><td>BTC Price</td><td>${sign(f.ret_1d * 100)}${fmt(f.ret_1d * 100, 2)}%</td><td>${sign(f.ret_1w * 100)}${fmt(f.ret_1w * 100, 2)}%</td><td>${fmt(f.ret_1m * 100, 2)}%</td><td>+124.8%</td></tr>
        <tr><td>Open Interest</td><td>+${f.oi_delta_pct}%</td><td>+${f.oi_delta_pct_1w}%</td><td>+${f.oi_delta_pct_1m}%</td><td>+284%</td></tr>
        <tr><td>Stablecoin Supply</td><td>+0.3%</td><td>${sign(STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct)}${STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct.toFixed(1)}%</td><td>${sign(STABLECOIN_SUPPLY_FALLBACK.delta_30d_pct)}${STABLECOIN_SUPPLY_FALLBACK.delta_30d_pct.toFixed(1)}%</td><td>+42%</td></tr>
        <tr><td>NUPL</td><td>+${BTC_NUPL_FALLBACK.delta_7d.toFixed(3)}</td><td>+${BTC_NUPL_FALLBACK.delta_7d.toFixed(3)}</td><td>+${BTC_NUPL_FALLBACK.delta_30d.toFixed(3)}</td><td>+0.22</td></tr>
      </table>

      <div class="footer">
        Gerado por CryptoWatch Intelligence Suite · Dados: ${IS_LIVE ? '🛰️ LIVE' : '🧪 DEMO'} · ${new Date().toISOString()} · Não é aconselhamento financeiro.
      </div>
    </body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ExecutiveReport() {
  const [showEmail, setShowEmail] = useState(false);
  const [period, setPeriod] = useState('Diário');
  const { data: liveTicker } = useBtcTicker();
  const { data: liveFng } = useFearGreed(1);
  const { data: liveRisk } = useRiskScore();
  const { data: liveRegime, isLoading: regimeLoading } = useMarketRegime();
  const { data: liveOnChain } = useOnChainCycle();

  const liveAnalysis = useMemo(() => {
    if (!IS_LIVE || (!liveTicker && !liveFng)) return null;
    return computeRuleBasedAnalysis({
      derivatives: liveTicker ? { fundingRate: liveTicker.last_funding_rate, oiDeltaPct: liveTicker.oi_delta_pct } : undefined,
      spot: liveTicker ? { ret1d: (liveTicker.price_change_pct ?? 0) / 100, cvd1d: 0, volume1dUsdt: liveTicker.volume_24h_usdt ?? 0, price: liveTicker.mark_price } : undefined,
      macro: liveFng ? { fngValue: liveFng.value, fngLabel: liveFng.label, riskScore: liveRisk?.score ?? 50, riskRegime: liveRisk?.regime ?? 'MODERADO' } : undefined,
    });
  }, [liveTicker, liveFng, liveRisk]);

  const aiRegime = liveAnalysis
    ? (liveAnalysis.overall.direction.startsWith('bull') ? 'risk_on' : liveAnalysis.overall.direction.startsWith('bear') ? 'risk_off' : 'caution')
    : (GLOBAL_RISK_FALLBACK.regime === 'RISK-ON' ? 'risk_on' : GLOBAL_RISK_FALLBACK.regime === 'RISK-OFF' ? 'risk_off' : 'caution');
  const aiProbability = liveAnalysis ? Math.round(liveAnalysis.overall.confidence * 100) : GLOBAL_RISK_FALLBACK.prob;
  const aiRecommendation = liveAnalysis
    ? `${liveAnalysis.overall.recommendation} · Período: ${period}.`
    : `Score global ${GLOBAL_RISK_FALLBACK.score}/100 — ${GLOBAL_RISK_FALLBACK.regime}. Período analisado: ${period}. Funding elevado + OI crescente + stablecoin expansivo = atenção a flush de longs.`;
  const aiReasoning = liveAnalysis
    ? `${liveAnalysis.overall.rationale} — ${liveAnalysis.overall.trigger}`
    : `Regime ${GLOBAL_RISK_FALLBACK.regime} confirmado por supply stablecoin +${STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct.toFixed(1)}% 7D e ETF inflows positivos ($${ETF_FLOWS_FALLBACK.net_flow_7d_m.toFixed(0)}M semana). Contrapeso: VIX ${MACRO_BOARD_FALLBACK.series.find(s => s.id === 'VIX')?.value.toFixed(1)} e funding ${(BTC_FUTURES_MOCK_FALLBACK.funding_rate * 100).toFixed(4)}% persistente — prob. flush longs 62%. Carry trade atrativo (+${((FUTURES_BASIS_FALLBACK.futures[1]?.basis_annualized || 0) - 4.512).toFixed(1)}pp vs US10Y).`;

  // Claude AI insight
  const execPayload = (liveTicker || liveFng) ? {
    page: 'executive_report',
    riskScore: liveRisk?.score ?? 50,
    riskRegime: liveRisk?.regime ?? 'MODERADO',
    fearGreedValue: liveFng?.value ?? 50,
    fearGreedLabel: liveFng?.label ?? 'Neutral',
    fundingRate: liveTicker?.last_funding_rate ?? 0,
    context: {
      nupl: liveOnChain?.nupl,
      nuplZone: liveOnChain?.nupl_zone,
      etfFlow7dM: ETF_FLOWS_FALLBACK.net_flow_7d_m,
      stablecoinDelta7dPct: STABLECOIN_SUPPLY_FALLBACK.delta_7d_pct,
    },
  } : null;
  const { data: execInsightText, isLoading: execAiLoading } = useAiInsight(execPayload);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
              📊 Relatório Executivo
            </h1>
            <ModeBadge mode={IS_LIVE && (liveTicker || liveFng) ? 'live' : 'mock'} />
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{TODAY}</p>
          <p style={{ fontSize: 10, color: '#334155', margin: '2px 0 0' }}>
            Overview · Regime · Stablecoin · Derivativos · On-Chain · ETF Flows · AI Insights
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodSelector active={period} onChange={setPeriod} />
          <button onClick={() => setShowEmail(true)} style={{
            padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa',
          }}>📧 E-mail</button>
          <button onClick={() => exportPDF({ liveRegime, liveOnChain })} style={{
            padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981',
          }}>📄 PDF</button>
        </div>
      </div>

      {/* Email modal */}
      {showEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <EmailScheduler onClose={() => setShowEmail(false)} liveTicker={liveTicker} liveFng={liveFng} liveRisk={liveRisk} liveRegime={liveRegime} liveOnChain={liveOnChain} />
          </div>
        </div>
      )}

      {/* Global AI */}
      <div style={{ marginBottom: 14 }}>
        <AIInsightPanel
          moduleId="EXECUTIVE_REPORT"
          probability={aiProbability}
          regime={aiRegime}
          recommendation={aiRecommendation}
          reasoning={aiReasoning}
          actions={['Reduzir Leverage', 'Monitorar VIX 25+', 'Carry Jun26', 'ETF Flows IBIT']}
          insight={execInsightText}
          isLoadingInsight={execAiLoading}
          modelLabel={execInsightText ? 'claude-haiku-4-5' : undefined}
        />
      </div>

      {/* Sections */}
      <div id="exec-report-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GlobalOverview period={period} liveTicker={liveTicker} liveFng={liveFng} liveRisk={liveRisk} />
        <RegimeSection period={period} liveRegime={liveRegime} regimeLoading={regimeLoading} />
        <StablecoinSection period={period} />
        <DerivativesSection period={period} liveTicker={liveTicker} />
        <OnChainSection period={period} liveOnChain={liveOnChain} />
        <ETFMacroSection period={period} />
        <PeriodSummaryTable />
      </div>

      {/* All module links */}
      <div style={{ marginTop: 16, padding: '14px 16px', background: '#0d1421', border: '1px solid #0f1d2e', borderRadius: 12 }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Todos os Módulos</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_MODULES.map((m, i) => (
            <Link key={i} to={createPageUrl(m.page)} title={m.desc} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: '#475569', textDecoration: 'none',
              padding: '4px 10px', borderRadius: 5,
              background: '#111827', border: '1px solid #1a2535',
              fontWeight: 500, transition: 'all 0.12s',
            }}>
              {m.icon} {m.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 9, color: '#1e3048', fontFamily: 'JetBrains Mono, monospace' }}>
          CryptoWatch Intelligence Suite · {IS_LIVE ? '🛰️ LIVE' : '🧪 MOCK'} · {new Date().toISOString().slice(0, 19)}Z
        </div>
        <div style={{ fontSize: 9, color: '#1e3048' }}>Não é aconselhamento financeiro.</div>
      </div>
    </div>
  );
}