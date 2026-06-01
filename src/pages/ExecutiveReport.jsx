// ─── RELATÓRIO EXECUTIVO COMPLETO ─────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, XAxis, Tooltip,
  Cell, ReferenceLine,
} from 'recharts';
import AIInsightPanel from '../components/ai/AIInsightPanel';
import { ModeBadge } from '../components/ui/DataBadge';
import { useAiInsight } from '@/hooks/useAiInsight';
import { sendNotificationEmail } from '@/lib/notificationClient';
import { useBtcTicker, useFearGreed, useBtcOiHistory, useDominance } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useMarketRegime, useRegimeHistory } from '@/hooks/useMarketRegime';
import { useOnChainCycle, useOnChainExtended } from '@/hooks/useCoinMetrics';
import { useMacroBoard, useYieldCurve, useCreditSpread } from '@/hooks/useFred';
import { useStablecoinData } from '@/hooks/useStablecoin';
import { useEtfSummary } from '@/hooks/useSoSoValue';
import { IS_LIVE } from '@/lib/env';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import PurposeLabel from '@/components/ui/PurposeLabel';

// ─── Fallbacks — apenas dados sem API gratuita equivalente ────────────────────
// SOPR, Netflow e Whale requerem Glassnode ~$29/mês — marcados na UI
const BTC_SOPR_FALLBACK              = { value: 0, smoothed_7d: 0 };
const BTC_EXCHANGE_NETFLOW_FALLBACK  = { netflow_24h: 0, exchange_reserves: 0, reserves_delta_30d_pct: 0, netflow_7d: 0 };
const BTC_WHALE_ACTIVITY_FALLBACK    = { txs_over_1m_24h: 0, delta_1m_vs_avg: 0, txs_over_10m_24h: 0, delta_10m_vs_avg: 0 };
const BTC_OPTIONS_MOCK_FALLBACK      = { iv_atm: 0, iv_atm_1d_delta: 0, skew: 0, skew_direction: 'neutral' };
const BTC_OPTIONS_EXT_FALLBACK       = { put_call_ratio_oi: 1, max_pain: 0, max_pain_distance_pct: 0 };
const LIQUIDATIONS_24H_FALLBACK      = { total_usd: 1, longs_usd: 0 };
const LIQUIDATION_CLUSTERS_FALLBACK  = { clusters: [], spot: 0, total_longs_at_risk_10pct: 0, total_shorts_at_risk_10pct: 0 };
const FUTURES_BASIS_FALLBACK         = { futures: [], cme_basis_annualized: 0, cme_basis_prev_7d: 0 };
const BTC_FUTURES_MOCK_FALLBACK      = {
  funding_rate: 0, mark_price: 0, ret_1d: 0, ret_1w: 0, ret_1m: 0,
  open_interest_usdt: 0, oi_delta_pct: 0, oi_delta_pct_1w: 0, oi_delta_pct_1m: 0,
  long_short_ratio: 1, funding_history: [],
};
const OI_RATIO_FALLBACK              = { ratio_pct: 0, zone: '—' };
// NUPL history tem formato diferente do dado live
const BTC_NUPL_HISTORY_FALLBACK      = { '1d': [], '1w': [], '1m': [] };
const MARKET_REGIME_FALLBACK         = {
  regime: 'NEUTRAL', score: 50, confidence: 0,
  suggestion: { title: '—', rationale: 'Análise em processamento.' },
  components: [],
};

const TODAY = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
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

// ─── UI Components ────────────────────────────────────────────────────────────

function SectionLink({ label, page, icon, tab }) {
  return (
    <Link to={createPageUrl(page)} state={tab ? { tab } : undefined} style={{
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

function SectionCard({ title, icon, subtitle, links = [], badge = null, children }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{icon} {title}</div>
            {badge}
          </div>
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

/** Indicador de cache antigo — exibir quando isFallback=true */
function CacheBanner({ isFallback, lastUpdated, compact = false }) {
  if (!isFallback) return null;
  if (compact) return (
    <span title={lastUpdated ? `Última atualização: ${new Date(lastUpdated).toLocaleString('pt-BR')}` : 'Dado de cache'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#f59e0b', cursor: 'help' }}>
      ⚠ Cache{lastUpdated ? ` · ${new Date(lastUpdated).toLocaleDateString('pt-BR')}` : ''}
    </span>
  );
  return (
    <div style={{ marginBottom: 10, padding: '6px 12px', borderRadius: 7, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span>⚠ Exibindo último valor salvo — API temporariamente indisponível</span>
      {lastUpdated && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>{new Date(lastUpdated).toLocaleString('pt-BR')}</span>}
    </div>
  );
}

/** Banner laranja para seções com dados que requerem API paga */
function PaidDataBanner({ reason, url, provider }) {
  return (
    <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', fontSize: 10, color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span>🔒 Dados simulados — {reason}</span>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Ver planos →</a>}
    </div>
  );
}

/** Dica de Ouro colapsável — padrão SpotFlow */
function TipCard({ emoji, title, body, tag }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', borderLeft: '3px solid #3b82f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{tag}</span>}
        </div>
        <span style={{ fontSize: 12, color: '#4a5568' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.7, borderTop: '1px solid #1e2d45', paddingTop: 10 }}>{body}</div>
      )}
    </div>
  );
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
function GlobalOverview({ period, liveTicker, liveFng, liveRisk, liveMacro, liveDominance, liveYield, liveCreditSpread }) {
  const f = BTC_FUTURES_MOCK_FALLBACK;

  const sp    = liveMacro?.series?.find(s => s.id === 'SP500');
  const vix   = liveMacro?.series?.find(s => s.id === 'VIX');
  const dxy   = liveMacro?.series?.find(s => s.id === 'DXY');
  const gold  = liveMacro?.series?.find(s => s.id === 'GOLD');
  const us10y = liveMacro?.series?.find(s => s.id === 'US10Y');

  const btcPrice   = liveTicker?.mark_price ?? f.mark_price;
  const fngValue   = liveFng?.value ?? 50;
  const fngLabel   = liveFng?.label ?? 'Neutral';
  const riskScore  = liveRisk?.score ?? 50;
  const riskRegime = liveRisk?.regime ?? 'NEUTRAL';

  const btcDom = liveDominance?.btc_dominance ?? 0;
  const btcDomDelta7d = 0; // CoinGecko dominance não retorna delta — mostrar apenas valor atual

  const yieldSpreadBp = liveYield ? Math.round((liveYield.spread_10y2y) * 100) : 0;
  const yieldRegime   = yieldSpreadBp > 50 ? 'Normal' : yieldSpreadBp > 0 ? 'Flat' : 'Invertida';

  const creditData   = liveCreditSpread?.data ?? liveCreditSpread;
  const hySpreadBp   = creditData?.hy_spread_bp ?? 0;
  const hyRegime     = hySpreadBp > 500 ? 'widening' : 'stable';
  const hyDelta7dBp  = creditData?.delta_7d_bp ?? 0;

  const isStale = liveMacro?.isFallback || liveDominance?.isFallback || liveFng?.isFallback;
  const staleDate = liveMacro?.lastUpdated ?? liveFng?.lastUpdated;

  const getSpDelta  = () => period === 'Diário' ? sp?.delta_1d : period === 'Semanal' ? sp?.delta_7d : sp?.delta_30d;
  const getDxyDelta = () => period === 'Diário' ? dxy?.delta_1d : period === 'Semanal' ? dxy?.delta_7d : dxy?.delta_30d;
  const getVixDelta = () => period === 'Diário' ? vix?.delta_1d : period === 'Semanal' ? vix?.delta_7d : vix?.delta_30d;
  const getGoldDelta= () => period === 'Diário' ? gold?.delta_1d : period === 'Semanal' ? gold?.delta_7d : gold?.delta_30d;
  const getBtcRet   = () => period === 'Diário' ? f.ret_1d : period === 'Semanal' ? f.ret_1w : f.ret_1m;

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
      <CacheBanner isFallback={isStale} lastUpdated={staleDate} />
      <PurposeLabel text="Snapshot consolidado de todos os mercados — BTC, macro, regime e sentimento num único painel. Use como ponto de partida diário antes de analisar seções específicas." mb={12} />

      {/* Regime badge grande */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: `${regColor}0d`, border: `1px solid ${regColor}25` }}>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: regColor }}>{riskScore}</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: regColor }}>{riskRegime}</div>
          <div style={{ fontSize: 10, color: '#475569' }}>Score Global de Risco</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#334155' }}>Fear & Greed</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: fngValue > 60 ? '#10b981' : '#f59e0b' }}>{fngValue}</div>
          <div style={{ fontSize: 9, color: '#475569' }}>{fngLabel}</div>
        </div>
      </div>

      {/* BTC + macro grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="BTC" value={btcPrice > 0 ? `$${fmt(btcPrice, 0)}` : '—'} color="#f59e0b"
          sub={`${sign(getBtcRet() * 100)}${fmt(getBtcRet() * 100, 2)}% ${period.toLowerCase()}`} />
        <Metric label="S&P 500" value={sp?.value ? fmt(sp.value, 0) : '—'} color={col(getSpDelta())}
          sub={getSpDelta() != null ? `${sign(getSpDelta() * 100)}${fmt(getSpDelta() * 100, 1)}% ${period.toLowerCase()}` : 'FRED'} />
        <Metric label="DXY" value={dxy?.value ? fmt(dxy.value, 2) : '—'} color={col(getDxyDelta(), true)}
          sub={getDxyDelta() != null ? `${sign(getDxyDelta() * 100)}${fmt(getDxyDelta() * 100, 1)}%` : 'FRED'} />
        <Metric label="VIX" value={vix?.value ? fmt(vix.value, 1) : '—'} color={vix?.value > 25 ? '#ef4444' : vix?.value > 18 ? '#f59e0b' : '#10b981'}
          sub={getVixDelta() != null ? `${sign(getVixDelta() * 100)}${fmt(getVixDelta() * 100, 1)}%` : 'FRED'} />
        <Metric label="Gold" value={gold?.value ? `$${fmt(gold.value, 0)}` : '—'} color="#f59e0b"
          sub={getGoldDelta() != null ? `${sign(getGoldDelta() * 100)}${fmt(getGoldDelta() * 100, 1)}%` : 'FRED'} />
      </div>

      {/* Macro rates row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="US 10Y" value={us10y?.value ? `${fmt(us10y.value, 3)}%` : '—'} color={col(us10y?.delta_1d, true)}
          sub={us10y?.delta_1d_bp != null ? `${sign(us10y.delta_1d_bp)}${fmt(us10y.delta_1d_bp, 1)}bp 1D` : 'via FRED'} size={14} />
        <Metric label="Yield Spread (10-2Y)" value={liveYield ? `${yieldSpreadBp > 0 ? '+' : ''}${yieldSpreadBp}bp` : '—'}
          color={yieldSpreadBp > 0 ? '#10b981' : '#ef4444'} sub={yieldRegime} size={14} />
        <Metric label="HY Credit Spread" value={liveCreditSpread ? `${hySpreadBp}bp` : '—'}
          color={hyRegime === 'widening' ? '#ef4444' : '#10b981'}
          sub={liveCreditSpread ? `${sign(hyDelta7dBp)}${hyDelta7dBp}bp 7D` : 'via FRED'} size={14} />
        <Metric label="BTC Dominance" value={btcDom > 0 ? `${btcDom.toFixed(1)}%` : '—'} color="#60a5fa"
          sub="CoinGecko global" size={14} />
      </div>

      {/* Guia de interpretação */}
      <div style={{ padding: '10px 14px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e' }}>
        <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Como interpretar estes dados</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {[
            { icon: '🟢', cond: 'Score > 62 + VIX < 18', result: 'Ambiente Risk-On. Favorável para posições compradas em BTC.' },
            { icon: '🔴', cond: 'Score < 38 + VIX > 25', result: 'Risk-Off. Reduzir exposição, aumentar stablecoins.' },
            { icon: '⚠️', cond: 'Yield Curve invertida', result: 'Sinal histórico de recessão em 12-18m. Cautela em ativos de risco.' },
            { icon: '🔍', cond: 'Dominância BTC subindo', result: 'Capital migrando para BTC em detrimento de altcoins.' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 14, lineHeight: 1.2 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── REGIME SECTION ───────────────────────────────────────────────────────────
function RegimeSection({ period, liveRegime, regimeLoading, regimeHistoryData }) {
  const r = {
    regime:     liveRegime?.label?.toUpperCase().replace('-', '-') ?? MARKET_REGIME_FALLBACK.regime,
    score:      liveRegime?.score ?? MARKET_REGIME_FALLBACK.score,
    confidence: MARKET_REGIME_FALLBACK.confidence,
    suggestion: MARKET_REGIME_FALLBACK.suggestion,
    components: liveRegime?.components ?? MARKET_REGIME_FALLBACK.components,
  };
  const regColor = (r.regime === 'RISK-ON' || r.regime === 'Risk-On') ? '#10b981' : (r.regime === 'RISK-OFF' || r.regime === 'Risk-Off') ? '#ef4444' : '#f59e0b';
  const scoreDisplay = (IS_LIVE && regimeLoading)
    ? <span style={{ fontSize: 13, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>Carregando regime...</span>
    : <><span style={{ fontSize: 22, fontWeight: 900, color: regColor, fontFamily: 'JetBrains Mono, monospace' }}>{r.score}/100</span>
        <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 12px', borderRadius: 6, background: `${regColor}18`, color: regColor, border: `1px solid ${regColor}30` }}>{r.regime}</span>
        <span style={{ fontSize: 10, color: '#475569' }}>Conf: {r.confidence}%</span>
      </>;

  const radarData = r.components.map(c => ({ subject: c.label?.split(' ')?.[0] ?? '—', value: Math.round(c.score ?? 0), fullMark: 100 }));

  const histLen = period === 'Diário' ? 24 : period === 'Semanal' ? 7 : period === 'Mensal' ? 30 : 52;
  const hasRealHist = IS_LIVE && regimeHistoryData && regimeHistoryData.length >= 3;
  const histData = hasRealHist
    ? regimeHistoryData.slice(-histLen).map((d, i) => ({ t: i, score: d.score }))
    : Array.from({ length: histLen }, (_, i) => ({
        t: i,
        score: Math.max(0, Math.min(100, Math.round(r.score - (histLen - 1 - i) * 0.4))),
      }));

  return (
    <SectionCard
      title="Regime de Mercado"
      icon="🎯"
      subtitle="Classificação automática baseada em 6 variáveis macro + crypto"
      links={[{ label: 'Ver Regime Completo', page: 'MarketRegime', icon: '🎯' }]}
    >
      <PurposeLabel text="Classificação do ambiente atual como Risk-On, Risk-Off ou Neutral — quando Risk-On, ampliar exposição; quando Risk-Off, reduzir posições e aumentar stablecoins. Score acima de 62 = Risk-On; abaixo de 38 = Risk-Off." mb={12} />
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
function StablecoinSection({ period, liveStablecoin }) {
  // Dados via DeFiLlama (gratuito)
  const totalB    = liveStablecoin ? liveStablecoin.totalSupply / 1e9 : 0;
  const change24h = liveStablecoin?.totalChange24h ?? 0;
  const usdt      = liveStablecoin?.top5?.find(s => s.symbol === 'USDT');
  const usdc      = liveStablecoin?.top5?.find(s => s.symbol === 'USDC');
  const usdtB     = usdt ? usdt.circulating / 1e9 : 0;
  const usdcB     = usdc ? usdc.circulating / 1e9 : 0;
  const usdtMint  = usdt ? (usdt.change24h * usdt.circulating / 100) / 1e6 : 0;
  const usdcMint  = usdc ? (usdc.change24h * usdc.circulating / 100) / 1e6 : 0;
  const totalMint = usdtMint + usdcMint;
  const byChain   = liveStablecoin?.byChain?.slice(0, 5) ?? [];

  // LTH/STH: dados live via CoinMetrics
  const { data: extended } = useOnChainExtended();
  const TOTAL_SUPPLY = 19_850_000;
  const lthPct    = extended ? extended.hodl_wave_1yr_pct * 100 : 50;
  const sthPct    = extended ? (100 - lthPct) : 50;
  const lthSupply = Math.round(TOTAL_SUPPLY * lthPct / 100);
  const sthSupply = TOTAL_SUPPLY - lthSupply;

  const isStale = liveStablecoin?.isFallback;
  const staleDate = liveStablecoin?.lastUpdated;

  return (
    <SectionCard
      title="Stablecoin Flow"
      icon="💧"
      subtitle="USDT + USDC · Supply total · DeFiLlama · LTH vs STH"
      links={[{ label: 'Ver Completo', page: 'InstitutionalFlows', icon: '💧', tab: 'stablecoins' }]}
    >
      <CacheBanner isFallback={isStale} lastUpdated={staleDate} />
      <PurposeLabel text="Movimentação de stablecoins — crescimento do supply indica 'dry powder' para compras futuras; quando stablecoins migram para exchanges, indica compra iminente de BTC/cripto." mb={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="Supply Total" value={totalB > 0 ? `$${totalB.toFixed(1)}B` : '—'} color="#60a5fa"
          sub={`${sign(change24h)}${change24h.toFixed(2)}% 24h`} />
        <Metric label="USDT" value={usdtB > 0 ? `$${usdtB.toFixed(1)}B` : '—'} color="#10b981"
          sub={usdtMint !== 0 ? `Net 24h: ${sign(usdtMint)}$${Math.abs(usdtMint).toFixed(0)}M` : 'DeFiLlama'} />
        <Metric label="USDC" value={usdcB > 0 ? `$${usdcB.toFixed(1)}B` : '—'} color="#3b82f6"
          sub={usdcMint !== 0 ? `Net 24h: ${sign(usdcMint)}$${Math.abs(usdcMint).toFixed(0)}M` : 'DeFiLlama'} />
        <Metric label="Net Mint 24h" value={totalMint !== 0 ? `${sign(totalMint)}$${Math.abs(totalMint).toFixed(0)}M` : '—'}
          color={totalMint > 0 ? '#10b981' : totalMint < 0 ? '#ef4444' : '#94a3b8'} sub="USDT + USDC" />
      </div>

      {/* Supply por chain */}
      {byChain.length > 0 && (
        <>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Supply por Chain (DeFiLlama)</div>
          {byChain.map((ch, i) => {
            const maxTvl = Math.max(...byChain.map(c => c.tvl));
            const pct = maxTvl > 0 ? (ch.tvl / maxTvl) * 100 : 0;
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#8899a6', flex: 1 }}>{ch.chain}</span>
                <div style={{ flex: 2, height: 4, borderRadius: 2, background: '#1a2535' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: colors[i % colors.length], opacity: 0.7 }} />
                </div>
                <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#64748b', width: 48, textAlign: 'right' }}>${(ch.tvl / 1e9).toFixed(0)}B</span>
              </div>
            );
          })}
        </>
      )}

      {/* LTH/STH */}
      <Divider />
      <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>LTH vs STH Supply — CoinMetrics Community</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Metric label="LTH Supply" value={`${lthPct.toFixed(1)}%`} color="#10b981" sub={`${(lthSupply / 1e6).toFixed(2)}M BTC`} size={14} />
        <Metric label="LTH (Holders LP)" value="—" color="#10b981" sub="Glassnode ~$29/mo" size={14} />
        <Metric label="STH Supply" value={`${sthPct.toFixed(1)}%`} color="#f59e0b" sub={`${(sthSupply / 1e6).toFixed(2)}M BTC`} size={14} />
        <Metric label="STH em Lucro" value="—" color="#f59e0b" sub="Glassnode ~$29/mo" size={14} />
      </div>
    </SectionCard>
  );
}

// ─── DERIVATIVES SECTION ──────────────────────────────────────────────────────
function DerivativesSection({ period, liveTicker, oiHistoryData }) {
  const f = BTC_FUTURES_MOCK_FALLBACK;
  const basis = FUTURES_BASIS_FALLBACK;
  const liq = LIQUIDATION_CLUSTERS_FALLBACK;
  const fundingRate  = liveTicker?.last_funding_rate ?? f.funding_rate;
  const openInterest = liveTicker
    ? liveTicker.open_interest * liveTicker.mark_price
    : f.open_interest_usdt;
  const oiDelta1d  = liveTicker?.oi_delta_pct ?? f.oi_delta_pct;
  const fundingAnn = fundingRate * 3 * 365 * 100;
  const spotPrice  = liveTicker?.mark_price ?? 0;

  const histLen = period === 'Diário' ? 14 : period === 'Semanal' ? 21 : 30;
  const fundingHist = f.funding_history.slice(-histLen).map((h, i) => ({
    t: i,
    rate: parseFloat((h.fundingRate * 100).toFixed(4)),
  }));

  const oiHist = (IS_LIVE && oiHistoryData && oiHistoryData.length > 0)
    ? oiHistoryData.map((d, i) => ({ t: i, oi: d.oi }))
    : Array.from({ length: histLen }, (_, i) => ({
        t: i,
        oi: parseFloat(((f.open_interest_usdt / 1e9) * (0.8 + i / histLen * 0.2)).toFixed(2)),
      }));

  const liqClusters = [...liq.clusters].sort((a, b) => a.price - b.price);
  const maxLiq = Math.max(...liqClusters.map(c => Math.max(c.longs_usd, c.shorts_usd)), 1);

  // Labels dinâmicos baseados no preço atual
  const liqLongLabel  = spotPrice > 0 ? `$${((spotPrice * 0.9) / 1000).toFixed(0)}K (longs)` : '—';
  const liqSpotLabel  = spotPrice > 0 ? `↑ Spot $${(spotPrice / 1000).toFixed(1)}K` : '— Spot';
  const liqShortLabel = spotPrice > 0 ? `$${((spotPrice * 1.1) / 1000).toFixed(0)}K (shorts)` : '—';

  return (
    <SectionCard
      title="Derivativos"
      icon="⟆"
      subtitle="Funding · OI · Liquidações · Basis · Options — Binance Futures (gratuito)"
      links={[
        { label: 'Derivatives', page: 'Derivatives', icon: '⟆' },
        { label: 'Deriv. Avançado', page: 'Derivatives', icon: '⚗️' },
        { label: 'Options', page: 'Options', icon: '◬' },
      ]}
    >
      <PurposeLabel text="Termômetro da alavancagem no mercado — funding positivo extremo indica excesso de longs (risco de flush); OI crescendo com preço em alta confirma tendência; OI caindo com preço em alta indica short squeeze." mb={12} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="Funding Rate" value={liveTicker ? `${(fundingRate * 100).toFixed(4)}%` : '—'} color={fundingRate > 0.0006 ? '#f59e0b' : '#10b981'} sub={`Ann: ${fundingAnn.toFixed(1)}%`} />
        <Metric label="Open Interest" value={liveTicker ? fmtM(openInterest) : '—'} color="#60a5fa" sub={`${sign(oiDelta1d)}${oiDelta1d}% 1D`} />
        <Metric label="Basis Futuros" value="—" color="#f59e0b" sub="CoinGlass ~$29/mo" />
        <Metric label="OI/Mkt Cap" value="—" color="#94a3b8" sub="CoinGlass ~$29/mo" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="L/S Ratio" value="—" color="#94a3b8" sub="CoinGlass" size={14} />
        <Metric label="Longs Risco -10%" value={fmtM(liq.total_longs_at_risk_10pct)} color="#ef4444" sub="Liquidação cascata" size={14} />
        <Metric label="Shorts Risco +10%" value={fmtM(liq.total_shorts_at_risk_10pct)} color="#a78bfa" sub="Short squeeze" size={14} />
        <Metric label="Liq. 24h Total" value={fmtM(LIQUIDATIONS_24H_FALLBACK.total_usd)} color="#f59e0b"
          sub={`Longs: ${((LIQUIDATIONS_24H_FALLBACK.longs_usd / LIQUIDATIONS_24H_FALLBACK.total_usd) * 100).toFixed(0)}%`} size={14} />
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
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open Interest (B USD) — Binance</div>
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

      {/* Liquidation heatmap — só mostra se tiver dados */}
      {liqClusters.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clusters de Liquidação</div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
            {liqClusters.map((c, i) => {
              const isAbove = c.price > liq.spot;
              const val = isAbove ? c.shorts_usd : c.longs_usd;
              const h = Math.round((val / maxLiq) * 44) + 6;
              return (
                <div key={i} title={`$${(c.price / 1000).toFixed(0)}K: ${fmtM(val)}`}
                  style={{ flex: 1, height: h, borderRadius: 2, background: isAbove ? '#a78bfa' : '#ef4444', opacity: 0.6 + (val / maxLiq) * 0.4 }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#334155', marginTop: 2 }}>
            <span>{liqLongLabel}</span>
            <span style={{ color: '#f59e0b' }}>{liqSpotLabel}</span>
            <span>{liqShortLabel}</span>
          </div>
        </div>
      ) : (
        <PaidDataBanner reason="Clusters de liquidação precisos requerem CoinGlass" url="https://coinglass.com/pricing" provider="CoinGlass" />
      )}

      {/* Options snapshot */}
      <Divider />
      <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Options Snapshot</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <Metric label="IV ATM" value="—" color="#a78bfa" sub="Deribit via hook" size={14} />
        <Metric label="Skew" value="—" color="#94a3b8" sub="Deribit via hook" size={14} />
        <Metric label="Put/Call Ratio" value="—" color="#60a5fa" sub="CoinGlass / Deribit" size={14} />
        <Metric label="Max Pain" value="—" color="#f59e0b" sub="CoinGlass ~$29/mo" size={14} />
      </div>
    </SectionCard>
  );
}

// ─── ON-CHAIN SECTION ─────────────────────────────────────────────────────────
function OnChainSection({ period, liveOnChain }) {
  const nupl = {
    value:      liveOnChain?.nupl            ?? 0,
    zone:       liveOnChain?.nupl_zone       ?? '—',
    zone_color: liveOnChain?.nupl_zone_color ?? '#94a3b8',
    history:    BTC_NUPL_HISTORY_FALLBACK,
    delta_7d:   0,
    delta_30d:  0,
  };
  const mvrv = {
    mvrv_ratio:      liveOnChain?.mvrv_current    ?? 0,
    mvrv_zone:       liveOnChain?.mvrv_zone        ?? '—',
    mvrv_zone_color: liveOnChain?.mvrv_zone_color  ?? '#94a3b8',
    mvrv_zscore:     liveOnChain?.mvrv_zscore      ?? 0,
    realized_price:  liveOnChain?.realized_price   ?? 0,
  };

  const histKey = period === 'Diário' ? '1d' : period === 'Semanal' ? '1w' : '1m';
  const nuplHist = nupl.history[histKey] || [];

  return (
    <SectionCard
      title="On-Chain"
      icon="⛓"
      subtitle="NUPL · MVRV — CoinMetrics Community (gratuito) · SOPR/Netflow/Whale — Glassnode (pago)"
      links={[{ label: 'Ver On-Chain Completo', page: 'OnChain', icon: '⛓' }]}
    >
      <PurposeLabel text="Dados diretamente da blockchain Bitcoin — NUPL abaixo de 0 = capitulação (fundo potencial); MVRV abaixo de 1 = preço abaixo do custo médio de mercado (boa zona de acumulação); netflow negativo de exchange = retirada para custódia (bullish longo prazo)." mb={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <Metric label="NUPL" value={liveOnChain ? nupl.value.toFixed(3) : '—'} color={nupl.zone_color} sub={nupl.zone} />
        <Metric label="SOPR" value="—" color="#94a3b8" sub="Glassnode ~$29/mo" />
        <Metric label="MVRV" value={liveOnChain ? mvrv.mvrv_ratio.toFixed(2) : '—'} color={mvrv.mvrv_zone_color} sub={mvrv.mvrv_zone} />
        <Metric label="Exchange Netflow 24h" value="—" color="#94a3b8" sub="Glassnode ~$29/mo" />
      </div>

      {/* NUPL chart + Whale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>NUPL — CoinMetrics Community</div>
          {nuplHist.length > 0 ? (
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
          ) : (
            <div style={{ height: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#334155' }}>
              Histórico NUPL diário não disponível — use On-Chain completo
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Whale Transactions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0a1018', border: '1px solid rgba(249,115,22,0.15)' }}>
              <div style={{ fontSize: 8, color: '#334155' }}>Txs &gt;$1M</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>—</div>
              <div style={{ fontSize: 8, color: '#f97316' }}>Glassnode ~$29/mo</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0a1018', border: '1px solid rgba(249,115,22,0.15)' }}>
              <div style={{ fontSize: 8, color: '#334155' }}>Txs &gt;$10M</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>—</div>
              <div style={{ fontSize: 8, color: '#f97316' }}>Glassnode ~$29/mo</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Metric label="Realized Price" value={mvrv.realized_price > 0 ? `$${(mvrv.realized_price / 1000).toFixed(1)}K` : '—'} color="#8899a6" sub={mvrv.mvrv_zscore ? `MVRV Z: ${mvrv.mvrv_zscore.toFixed(2)}` : 'CoinMetrics'} size={14} />
        <Metric label="Reservas Exchange" value="—" color="#94a3b8" sub="Glassnode ~$29/mo" size={14} />
        <Metric label="Netflow 7D" value="—" color="#94a3b8" sub="Glassnode ~$29/mo" size={14} />
      </div>

      <PaidDataBanner
        reason="SOPR, Exchange Netflow e Whale Activity precisos requerem Glassnode Standard (~$29/mês). NUPL e MVRV são gratuitos via CoinMetrics Community."
        url="https://glassnode.com/pricing"
        provider="Glassnode"
      />

      {/* Guia de interpretação */}
      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e' }}>
        <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Como interpretar NUPL e MVRV</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {[
            { icon: '🔴', cond: 'NUPL > 0.75', result: 'Euforia — maioria em alto lucro. Topos históricos ocorrem aqui. Hora de reduzir posição.' },
            { icon: '🟢', cond: 'NUPL < 0', result: 'Capitulação — maioria em prejuízo. Fundos históricos ocorrem aqui. Oportunidade de acumulação.' },
            { icon: '🔴', cond: 'MVRV > 3.5', result: 'Preço muito acima do custo médio. Sobrevalorizado historicamente.' },
            { icon: '🟢', cond: 'MVRV < 1', result: 'Preço abaixo do custo médio de mercado. Zona de acumulação.' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 14, lineHeight: 1.2 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── ETF & MACRO SECTION ──────────────────────────────────────────────────────
function ETFMacroSection({ period, liveEtf }) {
  const hasEtf = !!liveEtf && liveEtf.total_aum_b > 0;
  const topFunds = liveEtf?.funds?.slice(0, 5) ?? [];
  const flowKey = period === 'Diário' ? 'flow_today_m' : period === 'Semanal' ? 'flow_7d_m' : 'flow_30d_m';
  const netKey  = period === 'Diário' ? 'net_flow_today_m' : period === 'Semanal' ? 'net_flow_7d_m' : 'net_flow_30d_m';

  return (
    <SectionCard
      title="ETF Flows"
      icon="🏦"
      subtitle={hasEtf ? `IBIT · FBTC · GBTC · AUM — SoSoValue · Dados: ${liveEtf?.date ?? 'D-1'}` : 'Configure VITE_SOSOVALUE_KEY para dados ao vivo (gratuito)'}
      links={[
        { label: 'ETF Flows', page: 'InstitutionalFlows', icon: '🏦' },
        { label: 'Macro Board', page: 'Macro', icon: '⊞' },
      ]}
    >
      <PurposeLabel text="Fluxo dos ETFs de Bitcoin — entradas consecutivas acima de $200M/dia indicam demanda institucional forte; saídas de GBTC não necessariamente indicam bearish (é rotação para ETFs mais baratos). Configure a chave gratuita SoSoValue para dados reais." mb={12} />

      {hasEtf ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <Metric label="AUM Total" value={`$${liveEtf.total_aum_b.toFixed(1)}B`} color="#60a5fa" sub="todos os ETFs BTC" />
            <Metric label={`Net Flow ${period}`} value={fmtM((liveEtf[netKey] ?? 0) * 1e6)} color={(liveEtf[netKey] ?? 0) > 0 ? '#10b981' : '#ef4444'} sub="USD" />
            <Metric label="IBIT (BlackRock)" value={`$${(liveEtf.funds[0]?.aum_b ?? 0).toFixed(1)}B`} color="#3b82f6"
              sub={`Flow: ${fmtM(((liveEtf.funds[0]?.[flowKey]) ?? 0) * 1e6)}`} />
          </div>
          {topFunds.length > 0 && (
            <div>
              <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Flow por Fundo — {period}</div>
              {topFunds.map((fund, i) => {
                const flowVal = fund[flowKey] ?? 0;
                const maxFlow = Math.max(...topFunds.map(f => Math.abs(f[flowKey] ?? 0)), 1);
                const pct = Math.abs(flowVal) / maxFlow * 100;
                const fundColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#8899a6', width: 36 }}>{fund.ticker}</span>
                    <div style={{ flex: 1, height: 10, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: flowVal >= 0 ? fundColors[i % fundColors.length] : '#ef4444', opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: flowVal >= 0 ? '#10b981' : '#ef4444', width: 64, textAlign: 'right' }}>
                      {flowVal >= 0 ? '+' : ''}${Math.abs(flowVal).toFixed(0)}M
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <Metric label="AUM Total" value="—" color="#94a3b8" sub="Requer VITE_SOSOVALUE_KEY" />
            <Metric label="Net Flow Hoje" value="—" color="#94a3b8" sub="SoSoValue free tier" />
            <Metric label="IBIT (BlackRock)" value="—" color="#94a3b8" sub="Free key em sosovalue.com" />
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
            <strong style={{ color: '#60a5fa' }}>Como ativar ETF flows gratuitos:</strong>
            {' '}Cadastre-se em{' '}
            <a href="https://sosovalue.com/developer" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>sosovalue.com/developer</a>
            {' '}→ obtenha sua chave gratuita → adicione{' '}
            <code style={{ background: '#0d1421', padding: '1px 5px', borderRadius: 3, color: '#a78bfa' }}>VITE_SOSOVALUE_KEY=sua_chave</code>
            {' '}no arquivo <code style={{ background: '#0d1421', padding: '1px 5px', borderRadius: 3, color: '#a78bfa' }}>.env.local</code>.
            O free tier permite 20 req/min — suficiente para atualização horária.
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── PERIOD SUMMARY TABLE ─────────────────────────────────────────────────────
function PeriodSummaryTable({ liveTicker, liveFng, liveOnChain, liveStablecoin, liveDominance }) {
  const fundingRate = liveTicker?.last_funding_rate ?? 0;
  const fngValue    = liveFng?.value ?? 0;
  const nupl        = liveOnChain?.nupl ?? 0;
  const stableTotal = liveStablecoin ? (liveStablecoin.totalSupply / 1e9).toFixed(1) : '—';
  const stableChg   = liveStablecoin ? `${liveStablecoin.totalChange24h > 0 ? '+' : ''}${liveStablecoin.totalChange24h.toFixed(2)}%` : '—';
  const btcDom      = liveDominance?.btc_dominance ? `${liveDominance.btc_dominance.toFixed(1)}%` : '—';

  const rows = [
    { metric: 'BTC Price', d: liveTicker?.mark_price > 0 ? `$${fmt(liveTicker.mark_price, 0)}` : '—', w: '—', m: '—', y: '—',
      dC: '#f59e0b', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
    { metric: 'Funding Rate', d: liveTicker ? `${(fundingRate * 100).toFixed(4)}%` : '—', w: '—', m: '—', y: '—',
      dC: fundingRate > 0.0006 ? '#f59e0b' : '#10b981', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
    { metric: 'Fear & Greed', d: fngValue > 0 ? `${fngValue}` : '—', w: '—', m: '—', y: '—',
      dC: fngValue > 60 ? '#10b981' : fngValue < 40 ? '#ef4444' : '#f59e0b', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
    { metric: 'NUPL', d: liveOnChain ? nupl.toFixed(3) : '—', w: '—', m: '—', y: '—',
      dC: nupl > 0.5 ? '#f59e0b' : nupl < 0 ? '#ef4444' : '#10b981', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
    { metric: 'Stablecoin Supply', d: stableTotal !== '—' ? `$${stableTotal}B` : '—', w: stableChg, m: '—', y: '—',
      dC: '#60a5fa', wC: '#10b981', mC: '#64748b', yC: '#64748b' },
    { metric: 'BTC Dominance', d: btcDom, w: '—', m: '—', y: '—',
      dC: '#60a5fa', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
    { metric: 'SOPR', d: '—', w: '—', m: '—', y: '—',
      dC: '#64748b', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
    { metric: 'ETF AUM', d: '—', w: '—', m: '—', y: '—',
      dC: '#64748b', wC: '#64748b', mC: '#64748b', yC: '#64748b' },
  ];

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>📅 Comparativo Multi-Período</div>
      <PurposeLabel text="Dados ao vivo disponíveis na coluna Diário — Semanal, Mensal e Anual requerem integrações adicionais (Glassnode, CoinGlass). Use como referência pontual." mb={10} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Métrica', 'Diário (Live)', 'Semanal', 'Mensal', 'Anual'].map(h => (
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
  { label: 'ETF Flows', page: 'InstitutionalFlows', icon: '🏦', desc: 'IBIT · FBTC · GBTC', tab: 'etf' },
  { label: 'Stablecoin', page: 'InstitutionalFlows', icon: '💧', desc: 'Mint · Burn', tab: 'stablecoins' },
  { label: 'Regime', page: 'MarketRegime', icon: '🎯', desc: 'Risk-On · Off' },
  { label: 'Macro Board', page: 'Macro', icon: '⊞', desc: 'S&P · DXY · Yields' },
  { label: 'On-Chain', page: 'OnChain', icon: '⛓', desc: 'NUPL · MVRV' },
  { label: 'Calendário', page: 'MacroCalendar', icon: '◷', desc: 'CPI · FOMC · NFP' },
  { label: 'Notícias AI', page: 'NewsIntelligence', icon: '🧠', desc: 'Sentimento' },
  { label: 'Estratégias', page: 'Opportunities', icon: '⚡', desc: 'Setups · Carry', tab: 'strategies' },
  { label: 'Preditivo', page: 'PredictivePanel', icon: '🔮', desc: 'BTC 24h' },
  { label: 'Deriv. Avançado', page: 'Derivatives', icon: '⚗️', desc: 'Liq · OI Strike', tab: 'advanced' },
  { label: 'Smart Alerts', page: 'SmartAlerts', icon: '🔔', desc: 'AI · Anomalias' },
  { label: 'Automações', page: 'Automations', icon: '⚙️', desc: 'Rules · Webhook' },
];

// ─── EMAIL SCHEDULER ──────────────────────────────────────────────────────────
function EmailScheduler({ onClose, liveTicker, liveFng, liveRisk, liveRegime, liveOnChain, liveStablecoin, liveEtf }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const btcPrice     = liveTicker?.mark_price ?? 0;
  const fundingRate  = liveTicker?.last_funding_rate ?? 0;
  const openInterest = liveTicker ? liveTicker.open_interest * liveTicker.mark_price : 0;
  const fngValue     = liveFng?.value ?? 50;
  const fngLabel     = liveFng?.label ?? 'Neutral';
  const riskScore    = liveRisk?.score ?? 50;
  const riskRegime   = liveRisk?.regime ?? 'NEUTRAL';
  const regimeScore  = liveRegime?.score ?? 50;
  const regimeLabel  = liveRegime?.label?.toUpperCase() ?? 'NEUTRAL';
  const nuplValue    = liveOnChain?.nupl ?? 0;
  const nuplZone     = liveOnChain?.nupl_zone ?? '—';
  const mvrvRatio    = liveOnChain?.mvrv_current ?? 0;
  const mvrvZone     = liveOnChain?.mvrv_zone ?? '—';
  const stableTotal  = liveStablecoin ? (liveStablecoin.totalSupply / 1e9).toFixed(1) : '—';
  const stableChg24h = liveStablecoin ? liveStablecoin.totalChange24h.toFixed(2) : '—';
  const etfAum       = liveEtf?.total_aum_b ? `$${liveEtf.total_aum_b.toFixed(1)}B` : '—';
  const etfNetToday  = liveEtf?.net_flow_today_m ? `+$${liveEtf.net_flow_today_m.toFixed(0)}M` : '—';

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
BTC: $${fmt(btcPrice, 0)}

══════════════════════════════════════════
🎯 REGIME DE MERCADO
Score: ${regimeScore}/100 · Regime: ${regimeLabel}

══════════════════════════════════════════
💧 STABLECOIN FLOW (DeFiLlama)
Supply Total: $${stableTotal}B · Var 24h: ${stableChg24h}%

══════════════════════════════════════════
⟆ DERIVATIVOS (Binance Futures)
Funding Rate: ${(fundingRate * 100).toFixed(4)}% (ann: ${(fundingRate * 3 * 365 * 100).toFixed(1)}%)
Open Interest: ${fmtM(openInterest)}

══════════════════════════════════════════
⛓ ON-CHAIN (CoinMetrics Community)
NUPL: ${nuplValue.toFixed(3)} (${nuplZone})
MVRV: ${mvrvRatio.toFixed(2)} (${mvrvZone})
SOPR / Netflow / Whale: Requerem Glassnode (~$29/mês)

══════════════════════════════════════════
🏦 ETF FLOWS (SoSoValue)
AUM Total: ${etfAum}
Net Hoje: ${etfNetToday}

══════════════════════════════════════════
Acesse: https://mrp-dashboard.onrender.com · Dados: ${IS_LIVE ? '🛰️ LIVE' : '🧪 DEMO'}
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
      </div>
    </div>
  );
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportPDF({ liveRegime = null, liveOnChain = null, liveTicker = null, liveFng = null, liveRisk = null } = {}) {
  const regimeScore = liveRegime?.score ?? 50;
  const regimeLabel = liveRegime?.label?.toUpperCase() ?? 'NEUTRAL';
  const nuplValue   = liveOnChain?.nupl ?? 0;
  const nuplZone    = liveOnChain?.nupl_zone ?? '—';
  const mvrvRatio   = liveOnChain?.mvrv_current ?? 0;
  const mvrvZone    = liveOnChain?.mvrv_zone ?? '—';
  const btcPrice    = liveTicker?.mark_price ?? 0;
  const fngValue    = liveFng?.value ?? 50;
  const fngLabel    = liveFng?.label ?? 'Neutral';
  const riskScore   = liveRisk?.score ?? 50;
  const fundingRate = liveTicker?.last_funding_rate ?? 0;
  const oi          = liveTicker ? liveTicker.open_interest * liveTicker.mark_price : 0;

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
        .notice { background: #fff8f3; border: 1px solid #f97316; padding: 8px 12px; border-radius: 4px; font-size: 10px; color: #7c4b1a; margin-top: 8px; }
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
        <div class="metric"><div class="label">Risk Score</div><div class="value">${riskScore}/100</div></div>
        <div class="metric"><div class="label">BTC Price</div><div class="value">${btcPrice > 0 ? '$' + fmt(btcPrice, 0) : '—'}</div></div>
        <div class="metric"><div class="label">Fear & Greed</div><div class="value">${fngValue}</div><div class="sub">${fngLabel}</div></div>
        <div class="metric"><div class="label">Regime</div><div class="value">${regimeLabel}</div></div>
      </div>

      <h2>⟆ Derivativos (Binance Futures — gratuito)</h2>
      <div class="grid">
        <div class="metric"><div class="label">Funding Rate</div><div class="value">${(fundingRate * 100).toFixed(4)}%</div><div class="sub">Ann: ${(fundingRate * 3 * 365 * 100).toFixed(1)}%</div></div>
        <div class="metric"><div class="label">Open Interest</div><div class="value">${oi > 0 ? fmtM(oi) : '—'}</div></div>
        <div class="metric"><div class="label">Basis/Clusters</div><div class="value">—</div><div class="sub">CoinGlass (pago)</div></div>
        <div class="metric"><div class="label">L/S Ratio</div><div class="value">—</div><div class="sub">CoinGlass (pago)</div></div>
      </div>

      <h2>⛓ On-Chain (CoinMetrics Community — gratuito)</h2>
      <div class="grid">
        <div class="metric"><div class="label">NUPL</div><div class="value">${nuplValue.toFixed(3)}</div><div class="sub">${nuplZone}</div></div>
        <div class="metric"><div class="label">MVRV</div><div class="value">${mvrvRatio.toFixed(2)}</div><div class="sub">${mvrvZone}</div></div>
        <div class="metric"><div class="label">SOPR</div><div class="value">—</div><div class="sub">Glassnode (pago)</div></div>
        <div class="metric"><div class="label">Netflow 24h</div><div class="value">—</div><div class="sub">Glassnode (pago)</div></div>
      </div>
      <div class="notice">ℹ SOPR, Exchange Netflow e Whale Activity precisos requerem Glassnode Standard (~$29/mês). NUPL e MVRV são dados gratuitos via CoinMetrics Community API.</div>

      <h2>🎯 Regime de Mercado</h2>
      <div class="grid">
        <div class="metric"><div class="label">Score</div><div class="value">${regimeScore}/100</div></div>
        <div class="metric"><div class="label">Regime</div><div class="value">${regimeLabel}</div></div>
        <div class="metric"><div class="label">Fontes</div><div class="value">6 variáveis</div><div class="sub">VIX, Yield, DXY, S&P, Funding, NUPL</div></div>
        <div class="metric"><div class="label">Dados Macro</div><div class="value">FRED</div><div class="sub">Gratuito com chave</div></div>
      </div>

      <div class="footer">
        Gerado por CryptoWatch Intelligence Suite · Dados: ${IS_LIVE ? '🛰️ LIVE' : '🧪 DEMO'} · ${new Date().toISOString()} · Não é aconselhamento financeiro.
      </div>
    </body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

// ─── DICAS DE OURO ────────────────────────────────────────────────────────────
function DicasDeOuro() {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Usar o Relatório Executivo</div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Baseado em análise institucional</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TipCard
          emoji="📊"
          title="Comece sempre pelo Regime Score"
          tag="PRIORIDADE"
          body="Antes de olhar qualquer outro indicador, veja o Regime Score (0–100). Acima de 62: ambiente favorável para posições compradas. Abaixo de 38: cautela extrema, considere reduzir exposição. Entre 38–62: neutro, espere confirmação."
        />
        <TipCard
          emoji="⛓"
          title="NUPL < 0 = zona de acumulação histórica"
          tag="ON-CHAIN"
          body="Historicamente, quando o NUPL cai abaixo de zero, mais de 50% dos detentores de BTC estão em prejuízo. Isso marca fundos de mercado bear — os ciclos de 2015, 2018 e 2022 tiveram NUPL negativo. Use como zona de DCA agressivo."
        />
        <TipCard
          emoji="💧"
          title="Stablecoin supply crescendo = munição para alta"
          tag="FLUXO"
          body="Um supply crescente de stablecoins (USDT+USDC) significa que investidores estão segurando dólares digitais, prontos para comprar ativos de risco. É o 'dry powder' do mercado. Quando esse supply começa a cair (stablecoins sendo trocadas por BTC/cripto), é sinal de compras em andamento."
        />
        <TipCard
          emoji="💸"
          title="Funding Rate annualizado acima de 50% = perigo"
          tag="DERIVATIVOS"
          body="O funding rate anualizado (taxa × 3 × 365) mostra o custo de manter posições compradas. Acima de 50% ao ano, o mercado está superalavancado — qualquer queda de preço provoca cascata de liquidações (flush de longs). Abaixo de 10%: funding saudável, mercado pode sustentar alta."
        />
        <TipCard
          emoji="🏦"
          title="ETF flows: entradas consecutivas confirmam demanda institucional"
          tag="ETF"
          body="Entradas diárias em ETFs de BTC (IBIT, FBTC) acima de $200M por 5+ dias consecutivos indicam demanda institucional real. Importante: saídas do GBTC podem ser enganosas — parte é rotação para ETFs mais baratos (não venda de BTC). Foque no fluxo líquido consolidado de todos os fundos."
        />
        <TipCard
          emoji="🌡️"
          title="VIX + Yield Curve: o barômetro macro"
          tag="MACRO"
          body="VIX abaixo de 15 = calma nos mercados tradicionais → favorável para cripto. VIX acima de 30 = pânico no mercado de ações → alta correlação BTC-SP500 aumenta (ambos caem). Yield curve invertida (10Y < 2Y) historicamente precede recessão em 12-18 meses — sinal de cautela para ativos de alto risco como BTC."
        />
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ExecutiveReport() {
  const [showEmail, setShowEmail] = useState(false);
  const [period, setPeriod] = useState('Diário');

  // Hooks de dados ao vivo
  const { data: liveTicker }                    = useBtcTicker();
  const { data: liveFng }                       = useFearGreed(1);
  const { data: liveRisk }                      = useRiskScore();
  const { data: liveRegime, isLoading: regimeLoading } = useMarketRegime();
  const { data: regimeHistoryData }             = useRegimeHistory(90);
  const { data: liveOnChain }                   = useOnChainCycle();
  const { data: oiHistoryData }                 = useBtcOiHistory();
  // Novos hooks integrados
  const { data: liveMacro }                     = useMacroBoard();
  const { data: liveYield }                     = useYieldCurve();
  const { data: liveCreditSpread }              = useCreditSpread();
  const { data: liveDominance }                 = useDominance();
  const { data: liveStablecoin }                = useStablecoinData();
  const { data: liveEtf }                       = useEtfSummary();

  // Detecção de staleness agregado
  const isStale = [liveTicker, liveFng, liveMacro, liveStablecoin]
    .some(d => d?.isFallback);
  const staleDate = [liveMacro, liveFng, liveTicker, liveStablecoin]
    .map(d => d?.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(0);

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
    : 'caution';
  const aiProbability = liveAnalysis ? Math.round(liveAnalysis.overall.confidence * 100) : 0;
  const aiRecommendation = liveAnalysis
    ? `${liveAnalysis.overall.recommendation} · Período: ${period}.`
    : `Análise em processamento — aguardando dados ao vivo.`;
  const aiReasoning = liveAnalysis
    ? `${liveAnalysis.overall.rationale} — ${liveAnalysis.overall.trigger}`
    : `Conectando às APIs — Binance Futures, Alternative.me, CoinMetrics, FRED.`;

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
      stablecoinTotalB: liveStablecoin ? liveStablecoin.totalSupply / 1e9 : null,
      etfAumB: liveEtf?.total_aum_b ?? null,
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
          <p style={{ fontSize: 11, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{TODAY}</span>
            <CacheBanner isFallback={isStale} lastUpdated={staleDate} compact />
          </p>
          <p style={{ fontSize: 10, color: '#334155', margin: '2px 0 0' }}>
            Binance Futures · Alternative.me · CoinMetrics · FRED · DeFiLlama · SoSoValue
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodSelector active={period} onChange={setPeriod} />
          <button onClick={() => setShowEmail(true)} style={{
            padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa',
          }}>📧 E-mail</button>
          <button onClick={() => exportPDF({ liveRegime, liveOnChain, liveTicker, liveFng, liveRisk })} style={{
            padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981',
          }}>📄 PDF</button>
        </div>
      </div>

      {/* Email modal */}
      {showEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <EmailScheduler onClose={() => setShowEmail(false)} liveTicker={liveTicker} liveFng={liveFng} liveRisk={liveRisk} liveRegime={liveRegime} liveOnChain={liveOnChain} liveStablecoin={liveStablecoin} liveEtf={liveEtf} />
          </div>
        </div>
      )}

      {/* Banner — Para que serve esta página */}
      <div style={{ marginBottom: 18, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>📊</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 860 }}>
              O <strong style={{ color: '#cbd5e1' }}>Relatório Executivo</strong> é o <strong style={{ color: '#cbd5e1' }}>hub central</strong> do dashboard — consolida os indicadores mais importantes de mercado numa única visão.
              {' '}Use como <strong style={{ color: '#3b82f6' }}>ponto de partida diário</strong>: "O ambiente atual favorece exposição a BTC ou cautela?"
              {' '}Se o <strong style={{ color: '#10b981' }}>Regime Score for acima de 62</strong>, o mercado está Risk-On e você pode considerar aumentar posições.
              {' '}Se <strong style={{ color: '#ef4444' }}>abaixo de 38</strong>, Risk-Off — proteja o capital.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', text: 'Visão consolidada: macro + on-chain + derivativos' },
                { icon: '🎯', text: 'Regime Score automático com 6 variáveis' },
                { icon: '⚠️', text: 'Identificar riscos antes de abrir posições' },
                { icon: '🤖', text: 'Análise AI e estratégia recomendada pelo sistema' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Global AI */}
      <div style={{ marginBottom: 14 }}>
        <AIInsightPanel
          moduleId="EXECUTIVE_REPORT"
          probability={aiProbability}
          regime={aiRegime}
          recommendation={aiRecommendation}
          reasoning={aiReasoning}
          actions={['Verificar Regime Score', 'Analisar Funding Rate', 'Monitorar VIX', 'ETF Flows IBIT']}
          insight={execInsightText}
          isLoadingInsight={execAiLoading}
          modelLabel={execInsightText ? 'claude-haiku-4-5' : undefined}
        />
      </div>

      {/* Sections */}
      <div id="exec-report-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GlobalOverview
          period={period}
          liveTicker={liveTicker}
          liveFng={liveFng}
          liveRisk={liveRisk}
          liveMacro={liveMacro}
          liveDominance={liveDominance}
          liveYield={liveYield}
          liveCreditSpread={liveCreditSpread}
        />
        <RegimeSection period={period} liveRegime={liveRegime} regimeLoading={regimeLoading} regimeHistoryData={regimeHistoryData} />
        <StablecoinSection period={period} liveStablecoin={liveStablecoin} />
        <DerivativesSection period={period} liveTicker={liveTicker} oiHistoryData={oiHistoryData} />
        <OnChainSection period={period} liveOnChain={liveOnChain} />
        <ETFMacroSection period={period} liveEtf={liveEtf} />
        <PeriodSummaryTable
          liveTicker={liveTicker}
          liveFng={liveFng}
          liveOnChain={liveOnChain}
          liveStablecoin={liveStablecoin}
          liveDominance={liveDominance}
        />
        <DicasDeOuro />
      </div>

      {/* All module links */}
      <div style={{ marginTop: 16, padding: '14px 16px', background: '#0d1421', border: '1px solid #0f1d2e', borderRadius: 12 }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Todos os Módulos</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_MODULES.map((m, i) => (
            <Link key={i} to={createPageUrl(m.page)} state={m.tab ? { tab: m.tab } : undefined} title={m.desc} style={{
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
