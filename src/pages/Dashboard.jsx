import { useState, useEffect, useRef } from 'react';

// Inline formatters
const fmtNum = (v, d = 2) => v != null ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtPct = (v, d = 4) => v != null ? (v * 100).toFixed(d) + '%' : '—';

// Fallbacks — sem equivalente live gratuito
const BTC_FUTURES_FALLBACK = {
  mark_price: 0, index_price: 0,
  funding_rate: 0, next_funding_time: new Date(Date.now() + 8 * 3600 * 1000),
  open_interest: 0, open_interest_usdt: 0,
  oi_delta_pct: 0, oi_delta_pct_1w: 0,
  long_short_ratio: 1, top_trader_ls: 1,
};
const BTC_SPOT_FLOW_FALLBACK = { ret_1d: 0, ret_1w: 0, cvd: 0 };
const MACRO_BOARD_FALLBACK = { series: [] };
const ON_CHAIN_FALLBACK = {
  fees:    { fastestFee: 0, halfHourFee: 0, hourFee: 0, economyFee: 0 },
  mempool: { count: 0, vsize: 0 },
};
const FEAR_GREED_FALLBACK = { value: 50, label: 'Neutral', history: [] };
const RECENT_ALERTS_FALLBACK = [];
const GLOBAL_RISK_FALLBACK = { score: 50, regime: 'NEUTRAL', prob: 0, module_scores: {} };
const SOURCE_HEALTH_FALLBACK = [];
const AI_MODULE_FALLBACK = {
  direction: 'neutral', signal: '', score: 0,
  probability: 0, confidence: 0,
  timeframe: '—', trigger: '—', analysis: '',
};
const AI_OVERALL_FALLBACK = {
  recommendation: '—', direction: 'neutral', confidence: 0,
  probability_correction: 0, timeframe: '—', trigger: '—',
  rationale: '—', bull_case: '—', bear_case: '—',
};
const AI_ANALYSIS_FALLBACK = {
  model: 'mock',
  overall: AI_OVERALL_FALLBACK,
  modules: {
    derivatives: AI_MODULE_FALLBACK,
    spot:        AI_MODULE_FALLBACK,
    options:     AI_MODULE_FALLBACK,
    macro:       AI_MODULE_FALLBACK,
  },
};
import { DATA_MODE, IS_LIVE } from '@/lib/env';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { useBtcTicker, useFearGreed as useFearGreedHook } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useMacroBoard } from '@/hooks/useFred';
import { useMempoolState } from '@/hooks/useMempool';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { useAiPredictions, usePersistPrediction } from '@/hooks/useAiPredictions';
import { useAiCalibration } from '@/hooks/useAiCalibration';
import { useMtfAnalysis } from '@/hooks/useMtfAnalysis';
import { useZScoreAlerts } from '@/hooks/useZScoreAlerts';
import { useAiInsight } from '@/hooks/useAiInsight';
import { isSupabaseConfigured } from '@/services/supabase';

// ─── DATA LAYER (live > mock fallback) ───────────────────────────────────────
function useDashboardLiveData() {
  const { data: ticker,    isError: tickerError } = useBtcTicker();
  const { data: fng,       isError: fngError }    = useFearGreedHook();
  const { data: riskScore, isError: riskError }   = useRiskScore();
  return {
    ticker:     ticker ?? null,
    fng:        fng    ?? null,
    riskScore:  riskScore ?? null,
    btcFutures: ticker ? { ...BTC_FUTURES_FALLBACK, mark_price: ticker.mark_price, index_price: ticker.mark_price, funding_rate: ticker.last_funding_rate, oi_delta_pct: ticker.oi_delta_pct, open_interest: ticker.open_interest, open_interest_usdt: ticker.open_interest * ticker.mark_price } : BTC_FUTURES_FALLBACK,
    fearGreed:  fng    ? { ...FEAR_GREED_FALLBACK, value: fng.value, label: fng.label, classification: fng.label } : FEAR_GREED_FALLBACK,
    errors: { ticker: tickerError, fng: fngError, risk: riskError },
  };
}
import RiskMeter from '../components/ui/RiskMeter';
import GoldenRule from '../components/ui/GoldenRule';
import { ModeBadge, SourceRow } from '../components/ui/DataBadge';
import AIAnalysisPanel from '../components/ui/AIAnalysisPanel';
import { HelpIcon } from '../components/ui/Tooltip';
import ExtraSignals from '../components/dashboard/ExtraSignals';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// ─── MINI STAT ────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color = '#f1f5f9', big = false, help }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        {label}{help && <HelpIcon title={help.title} content={help.content} width={260} />}
      </div>
      <div style={{ fontSize: big ? 18 : 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── DELTA PILL ───────────────────────────────────────────────────────────────
function DeltaPill({ value, suffix = '%', isYield = false, compact = false }) {
  const v = isYield ? value : value;
  const pos = v >= 0;
  const color = pos ? '#10b981' : '#ef4444';
  return (
    <span style={{
      fontSize: compact ? 9 : 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
      color, background: `${color}12`, border: `1px solid ${color}28`,
      borderRadius: 4, padding: compact ? '1px 5px' : '2px 6px', whiteSpace: 'nowrap',
    }}>
      {pos ? '+' : ''}{v.toFixed(isYield ? 1 : 2)}{suffix}
    </span>
  );
}

// ─── SECTION TITLE ────────────────────────────────────────────────────────────
function SectionTitle({ icon, label, sub = '', action = null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
        }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── FEAR & GREED ─────────────────────────────────────────────────────────────
function FearGreedGauge({ liveValue, fngError }) {
  const hasError = fngError && DATA_MODE === 'live';
  const v = (!hasError && liveValue != null) ? liveValue : FEAR_GREED_FALLBACK.value;
  const zones = [
    { label: 'Extreme Fear', max: 25, color: '#60a5fa' },
    { label: 'Fear',         max: 45, color: '#10b981' },
    { label: 'Neutral',      max: 55, color: '#94a3b8' },
    { label: 'Greed',        max: 75, color: '#f59e0b' },
    { label: 'Ext. Greed',   max: 100, color: '#ef4444' },
  ];
  const zone = zones.find(z => v <= z.max) || zones[zones.length - 1];
  const color = hasError ? '#4a5568' : zone.color;

  return (
    <div style={{ background: '#111827', border: `1px solid ${color}25`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
          Fear &amp; Greed Index
        </span>
        <DataTrustBadge
          mode={hasError ? 'error' : IS_LIVE ? 'live' : 'mock'}
          confidence={hasError ? 'D' : IS_LIVE ? 'A' : 'D'}
          source="Alternative.me"
          sourceUrl="https://api.alternative.me/fng/"
          updatedAt={Date.now()}
          reason={hasError ? 'Alternative.me API indisponível' : !IS_LIVE ? 'DATA_MODE=mock' : undefined}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
        <div style={{
          fontSize: 52, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
          color, lineHeight: 1, letterSpacing: '-0.05em',
          textShadow: `0 0 30px ${color}55`,
        }}>{hasError ? '***' : v}</div>
        <div style={{ paddingBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 2 }}>
            {hasError ? 'Dados indisponíveis' : zone.label}
          </div>
          {!hasError && v > 65 && <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600 }}>⚠ Risco de reversão</div>}
          {!hasError && v < 35 && <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 600 }}>⚠ Possível capitulação</div>}
          {hasError && <div style={{ fontSize: 9, color: '#4a5568', fontWeight: 600 }}>Verifique o Debug Log</div>}
        </div>
      </div>
      {/* Gauge bar */}
      <div style={{ position: 'relative', height: 6, borderRadius: 3, marginBottom: 4, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #60a5fa 0%, #10b981 25%, #94a3b8 45%, #f59e0b 65%, #ef4444 100%)' }} />
        <div style={{
          position: 'absolute', top: -2, left: `${v}%`, transform: 'translateX(-50%)',
          width: 3, height: 10, borderRadius: 2, background: '#fff',
          boxShadow: '0 0 6px rgba(255,255,255,0.9)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155', marginBottom: 14 }}>
        <span>0 — Medo</span><span>50</span><span>100 — Ganância</span>
      </div>
      {/* 7d bars */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 32 }}>
        {FEAR_GREED_FALLBACK.history.map((hv, i) => {
          const hz = zones.find(z => hv <= z.max) || zones[zones.length-1];
          const isLast = i === FEAR_GREED_FALLBACK.history.length - 1;
          return (
            <div key={i} title={`${hv}`} style={{
              flex: 1, height: `${(hv / 100) * 32}px`,
              borderRadius: '2px 2px 0 0',
              background: isLast ? hz.color : `${hz.color}50`,
              border: isLast ? `1px solid ${hz.color}` : 'none',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#2d3d52', marginTop: 3 }}>
        <span>7d atrás</span><span>hoje</span>
      </div>
    </div>
  );
}

// ─── BTC SNAPSHOT ─────────────────────────────────────────────────────────────
function BTCSnapshot({ liveData, tickerError }) {
  const err = tickerError && DATA_MODE === 'live';
  const fr = liveData ?? BTC_FUTURES_FALLBACK;
  const fundingColor = err ? '#4a5568' : (fr.funding_rate > 0.0005 ? '#ef4444' : fr.funding_rate > 0 ? '#f59e0b' : '#10b981');
  const oiColor = err ? '#4a5568' : '#f59e0b';
  const priceStr   = err ? '***' : `$${fmtNum(fr.mark_price, 0)}`;
  const fundingStr = err ? '***' : fmtPct(fr.funding_rate, 4);
  const oiStr      = err ? '***' : `$${(fr.open_interest_usdt / 1e9).toFixed(2)}B`;

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
          BTC · Snapshot de Mercado
        </span>
        <DataTrustBadge
          mode={err ? 'error' : IS_LIVE ? 'live' : 'mock'}
          confidence={err ? 'D' : IS_LIVE ? 'A' : 'D'}
          source="Binance Futures"
          sourceUrl="https://fapi.binance.com"
          updatedAt={Date.now()}
          reason={err ? 'Binance Futures API indisponível' : !IS_LIVE ? 'DATA_MODE=mock' : undefined}
        />
      </div>

      {/* Price */}
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1a2535' }}>
        <div style={{ fontSize: 9, color: '#334155', marginBottom: 3 }}>MARK PRICE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: err ? '#4a5568' : '#f1f5f9', letterSpacing: '-0.03em' }}>
            {priceStr}
          </span>
          <DeltaPill value={BTC_SPOT_FLOW_FALLBACK.ret_1d * 100} suffix="% 1D" />
          <DeltaPill value={BTC_SPOT_FLOW_FALLBACK.ret_1w * 100} suffix="% 1W" compact />
        </div>
      </div>

      {/* Key metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
        <Stat label="Funding Rate" value={fundingStr} color={fundingColor} big
          sub={err ? '—' : `${fr.funding_rate > 0 ? 'Longs pagam' : 'Shorts pagam'} · ${Math.round((fr.next_funding_time.getTime() - Date.now()) / 3600000)}h`}
          help={{ title: 'Funding Rate', content: 'Taxa paga entre longs e shorts a cada 8h. Acima de +0.07% = mercado sobrecomprado — sinal de risco para flush.' }} />
        <Stat label="Open Interest" value={oiStr} color={oiColor} big
          sub={<span style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <DeltaPill value={fr.oi_delta_pct} suffix="% 1D" compact />
            <DeltaPill value={fr.oi_delta_pct_1w} suffix="% 1W" compact />
          </span>}
          help={{ title: 'Open Interest', content: 'Total de contratos futuros abertos. OI crescendo + funding positivo = risco de flush.' }} />
        <Stat label="Long/Short Ratio" value={fr.long_short_ratio.toFixed(2)} color="#60a5fa" big
          sub={`Top traders: ${fr.top_trader_ls.toFixed(2)}`}
          help={{ title: 'L/S Ratio', content: 'Proporção de posições longas vs curtas. >1.5 com funding alto = posicionamento perigoso.' }} />
        <Stat label="CVD Intraday" value={`+${(BTC_SPOT_FLOW_FALLBACK.cvd/1000).toFixed(1)}K`} color="#10b981" big
          sub="Taker Buy > Sell"
          help={{ title: 'CVD', content: 'Diferença acumulada entre volume comprador e vendedor. Positivo = agressores compradores dominando.' }} />
      </div>
    </div>
  );
}

// ─── MACRO MINI CARDS ─────────────────────────────────────────────────────────
const MACRO_ICONS = { SP500: '📈', DXY: '💵', GOLD: '🥇', VIX: '🌡️', US10Y: '📊', US2Y: '📉' };

function MacroRow() {
  const { data: liveMacro, isError: macroError } = useMacroBoard();
  const err = macroError && DATA_MODE === 'live';
  const series = liveMacro?.series ?? MACRO_BOARD_FALLBACK.series;
  const invertColors = { DXY: true, VIX: true };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
      {series.map(s => {
        const d1raw = s.format === 'yield' ? s.delta_1d_bp : s.delta_1d * 100;
        const invert = invertColors[s.id];
        const posRaw = d1raw >= 0;
        const pos = invert ? !posRaw : posRaw;
        const color = pos ? '#10b981' : '#ef4444';
        const d1disp = s.format === 'yield' ? `${d1raw >= 0 ? '+' : ''}${d1raw.toFixed(1)}bp` : `${d1raw >= 0 ? '+' : ''}${d1raw.toFixed(2)}%`;
        const valStr = s.format === 'yield' ? s.value.toFixed(3) + '%' : fmtNum(s.value, s.id === 'VIX' || s.id === 'DXY' ? 2 : 0) + (s.unit ? ` ${s.unit}` : '');

        return (
          <div key={s.id} style={{
            background: '#111827', border: `1px solid ${color}20`,
            borderTop: `3px solid ${color}`,
            borderRadius: 10, padding: '12px 13px',
          }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{s.icon ?? MACRO_ICONS[s.id] ?? '📊'}</span> {s.name}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: err ? '#4a5568' : '#f1f5f9', letterSpacing: '-0.02em', marginBottom: 5 }}>
              {err ? '***' : valStr}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 3, padding: '1px 5px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                {d1disp} <span style={{ opacity: 0.6 }}>1D</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ALERT CARD ───────────────────────────────────────────────────────────────
const alertCfg = {
  SQUEEZE_WATCH: { color: '#f59e0b', icon: '⚡', label: 'Squeeze Watch' },
  FLUSH_RISK:    { color: '#ef4444', icon: '🔥', label: 'Flush Risk' },
  MACRO_EVENT:   { color: '#60a5fa', icon: '📅', label: 'Macro Event' },
  OPTIONS_VOL:   { color: '#a78bfa', icon: '📊', label: 'Options Vol' },
};

function AlertRow({ alert }) {
  const c = alertCfg[alert.type] || alertCfg.MACRO_EVENT;
  const urgency = alert.score >= 70 ? 'HIGH' : alert.score >= 55 ? 'MED' : 'LOW';
  const urgColors = { HIGH: '#ef4444', MED: '#f59e0b', LOW: '#64748b' };
  const uc = urgColors[urgency];
  const mins = Math.round((Date.now() - alert.created_at.getTime()) / 60000);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderBottom: '1px solid #0d1421',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: `${c.color}14`, border: `1px solid ${c.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>{c.icon}</div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 3, lineHeight: 1.3 }}>{alert.title}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: c.color, background: `${c.color}12`, border: `1px solid ${c.color}25`, borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>{c.label}</span>
          <span style={{ fontSize: 9, color: uc, background: `${uc}12`, border: `1px solid ${uc}25`, borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>{urgency}</span>
          {Object.entries(alert.metrics).slice(0, 2).map(([k, v]) => (
            <span key={k} style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{k}: <span style={{ color: '#94a3b8' }}>{v}</span></span>
          ))}
        </div>
      </div>
      {/* Score + time */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: c.color, lineHeight: 1 }}>{alert.score}</div>
        <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{mins}m ago</div>
      </div>
    </div>
  );
}

// ─── DATA QUALITY STRIP ───────────────────────────────────────────────────────
function DataQualityStrip() {
  const [open, setOpen] = useState(false);
  const ok = SOURCE_HEALTH_FALLBACK.filter(s => s.grade === 'A').length;
  const warn = SOURCE_HEALTH_FALLBACK.filter(s => s.grade !== 'A').length;

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12 }}>🛰️</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', flex: 1, textAlign: 'left' }}>Saúde das Fontes de Dados</span>
        <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{ok} OK</span>
        {warn > 0 && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{warn} ⚠</span>}
        <ModeBadge />
        <span style={{ fontSize: 10, color: '#334155' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ borderTop: '1px solid #1a2535' }}>{SOURCE_HEALTH_FALLBACK.map(s => <SourceRow key={s.source} source={s} />)}</div>}
    </div>
  );
}

// ─── MEMPOOL ──────────────────────────────────────────────────────────────────
function MempoolRow() {
  const { data: liveMempool } = useMempoolState();
  // Live: MempoolData shape (snake_case). Mock: onChain.fees/mempool shape (camelCase).
  const fastest  = liveMempool?.fees.fastest_fee   ?? ON_CHAIN_FALLBACK.fees.fastestFee;
  const halfHour = liveMempool?.fees.half_hour_fee  ?? ON_CHAIN_FALLBACK.fees.halfHourFee;
  const hour     = liveMempool?.fees.hour_fee       ?? ON_CHAIN_FALLBACK.fees.hourFee;
  const economy  = liveMempool?.fees.economy_fee    ?? ON_CHAIN_FALLBACK.fees.economyFee;
  const txCount  = liveMempool?.tx_count            ?? ON_CHAIN_FALLBACK.mempool.count;
  const vsize    = liveMempool?.vsize_bytes          ?? ON_CHAIN_FALLBACK.mempool.vsize;
  const items = [
    { label: 'Fastest', value: fastest,  unit: 'sat/vB', color: '#ef4444' },
    { label: '½ Hour',  value: halfHour, unit: 'sat/vB', color: '#f59e0b' },
    { label: '1 Hour',  value: hour,     unit: 'sat/vB', color: '#10b981' },
    { label: 'Economy', value: economy,  unit: 'sat/vB', color: '#64748b' },
    { label: 'Txs',     value: txCount.toLocaleString(), unit: 'unconf', color: '#60a5fa' },
    { label: 'Mempool', value: `${(vsize/1e6).toFixed(1)}`, unit: 'MB', color: '#a78bfa' },
  ];
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ fontSize: 12 }}>⛓️</div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginRight: 4 }}>Mempool</span>
      {items.map(m => (
        <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 3, padding: '4px 10px', background: '#0d1421', borderRadius: 6, border: '1px solid #1a2535' }}>
          <span style={{ fontSize: 9, color: '#334155' }}>{m.label}:</span>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: m.color }}>{m.value}</span>
          <span style={{ fontSize: 8, color: '#334155' }}>{m.unit}</span>
        </div>
      ))}
    </div>
  );
}

// ─── AI TRACK RECORD (novo componente) ────────────────────────────────────────
const AI_HISTORY = [
  { date: '2026-03-28', signal: 'CAUTION — REDUCE LONGS', direction: 'bearish_bias', outcome: 'HIT', outcome_desc: 'BTC caiu de $84.3K para $81.2K em 36h', confidence: 0.71, prob: 0.62, pct_move: -3.7 },
  { date: '2026-03-21', signal: 'RISK-ON — HOLD LONGS', direction: 'bullish', outcome: 'HIT', outcome_desc: 'BTC subiu de $78K para $84.3K em 7 dias', confidence: 0.68, prob: 0.65, pct_move: 8.1 },
  { date: '2026-03-12', signal: 'MACRO RISCO — HAWKISH CPI', direction: 'bearish', outcome: 'HIT', outcome_desc: 'BTC caiu -6.2% nas 48h pós CPI acima do esperado', confidence: 0.82, prob: 0.74, pct_move: -6.2 },
  { date: '2026-03-05', signal: 'NEUTRO — ESPERAR', direction: 'neutral', outcome: 'MISS', outcome_desc: 'BTC subiu +4.1% contrariando previsão neutra', confidence: 0.55, prob: 0.50, pct_move: 4.1 },
  { date: '2026-02-20', signal: 'SQUEEZE RISK ELEVADO', direction: 'bearish_bias', outcome: 'HIT', outcome_desc: 'Flush de $81K → $74K em 12h, $312M liquidados', confidence: 0.78, prob: 0.69, pct_move: -8.6 },
];

function AITrackRecord({ predictions = [], isConfigured = false }) {
  // When Supabase is configured, show real data (or empty state if none yet).
  // Only fall back to AI_HISTORY demo data when Supabase is not set up.
  const useDemo = !isConfigured || !IS_LIVE;
  const displayData = predictions.length > 0 ? predictions : (useDemo ? AI_HISTORY : []);
  const resolved = displayData.filter(h => h.outcome !== 'PENDING');
  const hits = resolved.filter(h => h.outcome === 'HIT').length;
  const acc = resolved.length > 0 ? ((hits / resolved.length) * 100).toFixed(0) : '—';

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a2535', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>AI — Track Record</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 10, color: '#334155' }}>Histórico de previsões vs resultado real</span>
            {useDemo
              ? <DataTrustBadge mode="mock" confidence="D" source="Demo" reason="Histórico simulado — predições de exemplo para demonstração" />
              : <DataTrustBadge mode={predictions.length > 0 ? 'live' : 'estimated'} confidence={predictions.length > 0 ? 'A' : 'B'} source="Supabase" reason={predictions.length > 0 ? 'Predições reais persistidas no banco de dados' : 'Banco configurado — primeiras predições sendo geradas'} />
            }
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', lineHeight: 1 }}>{acc}{acc !== '—' ? '%' : ''}</div>
          <div style={{ fontSize: 9, color: '#334155' }}>{hits}/{resolved.length} resolvidos</div>
        </div>
      </div>
      {/* Empty state when Supabase is configured but no predictions yet */}
      {!useDemo && displayData.length === 0 && (
        <div style={{ padding: '28px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Primeiras previsões sendo geradas...</div>
          <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
            O sistema de IA começará a persistir predições automaticamente a cada hora.<br />
            Retorne em breve para ver o histórico real.
          </div>
        </div>
      )}
      {/* Rows */}
      {displayData.map((h, i) => {
        const isPending = h.outcome === 'PENDING';
        const hit = h.outcome === 'HIT';
        const oc = isPending ? '#64748b' : hit ? '#10b981' : '#ef4444';
        // pct_move comes from AI_HISTORY; outcome_ret_pct from AiPrediction DB rows
        const pctMove = h.pct_move ?? h.outcome_ret_pct ?? 0;
        const mc = pctMove >= 0 ? '#10b981' : '#ef4444';
        const dirCfg = {
          bearish_bias: { label: '↘ CAUTELA', color: '#f59e0b' },
          bullish_bias: { label: '↗ OTIMISMO', color: '#60a5fa' },
          bearish: { label: '▼ BEARISH', color: '#ef4444' },
          bullish: { label: '▲ BULLISH', color: '#10b981' },
          neutral: { label: '◆ NEUTRO', color: '#64748b' },
        };
        const dc = dirCfg[h.direction] || dirCfg.neutral;
        // outcome description: use stored field (AI_HISTORY) or synthesize from DB row
        const outcomeDesc = h.outcome_desc
          ?? (isPending
            ? 'Aguardando avaliação (4h+ após previsão)…'
            : h.outcome_ret_pct != null
              ? `Retorno realizado: ${h.outcome_ret_pct >= 0 ? '+' : ''}${h.outcome_ret_pct}%`
              : 'Resultado registrado');
        // date: AI_HISTORY has h.date; DB rows have h.created_at
        const dateLabel = h.date ?? (h.created_at ? h.created_at.slice(0, 10) : '—');
        return (
          <div key={h.id ?? i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 18px',
            borderBottom: i < displayData.length - 1 ? '1px solid #0d1421' : 'none',
          }}>
            {/* Status */}
            <div style={{
              flexShrink: 0, marginTop: 2,
              width: 20, height: 20, borderRadius: 10,
              background: `${oc}15`, border: `1px solid ${oc}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: oc, fontWeight: 900,
            }}>{isPending ? '…' : hit ? '✓' : '✗'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>{dateLabel}</span>
                <span style={{ fontSize: 9, color: dc.color, background: `${dc.color}10`, border: `1px solid ${dc.color}25`, borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>{dc.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{h.signal}</span>
              </div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{outcomeDesc}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 9, color: '#334155' }}>Conf: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{Math.round((h.confidence ?? 0) * 100)}%</span></span>
                {!isPending && <span style={{ fontSize: 9, color: mc, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{pctMove >= 0 ? '+' : ''}{pctMove}%</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { ticker: liveTicker, fng: liveFng, riskScore: liveRiskScore, btcFutures: _btcLive, fearGreed: _fngLive, errors: liveErrors } = useDashboardLiveData();

  // Pesos calibrados por histórico de previsões (fallback: equiponderado)
  const { data: calibration } = useAiCalibration();

  // Confluência multi-timeframe (1H / 4H / 1D)
  const mtf = useMtfAnalysis();

  // Alertas estatísticos Z-score (retorno e volume 1D)
  const zAlerts = useZScoreAlerts();

  // Rule-based AI analysis — all four modules, live data when available
  const liveAnalysis = IS_LIVE && (liveTicker != null || liveFng != null)
    ? computeRuleBasedAnalysis({
        derivatives: liveTicker ? {
          fundingRate: liveTicker.last_funding_rate,
          oiDeltaPct:  liveTicker.oi_delta_pct,
          openInterest: liveTicker.open_interest,
        } : undefined,
        spot: liveTicker ? {
          ret1d:         (liveTicker.price_change_pct ?? 0) / 100,
          cvd1d:         0,
          volume1dUsdt:  liveTicker.volume_24h_usdt ?? 0,
          price:         liveTicker.mark_price,
        } : undefined,
        macro: liveFng ? {
          fngValue:   liveFng.value,
          fngLabel:   liveFng.label,
          riskScore:  liveRiskScore?.score ?? 50,
          riskRegime: liveRiskScore?.regime ?? 'MODERADO',
        } : undefined,
      }, calibration?.weights)
    : null;
  const aiAnalysis = liveAnalysis ?? AI_ANALYSIS_FALLBACK;

  // ── Sprint 8.2: AI Track Record persistence ──────────────────────────────────
  const persistMutation = usePersistPrediction();
  const { predictions } = useAiPredictions(liveTicker?.mark_price);
  const lastPersistedHour = useRef('');

  useEffect(() => {
    if (!IS_LIVE || !liveAnalysis || !liveTicker) return;
    const hour = new Date().toISOString().slice(0, 13);
    if (hour === lastPersistedHour.current) return;
    lastPersistedHour.current = hour;
    persistMutation.mutate({
      overall: liveAnalysis.overall,
      price:   liveTicker.mark_price,
      modules: liveAnalysis.modules,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAnalysis, liveTicker]);

  const [lastUpdate, setLastUpdate] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setLastUpdate(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  // Usa Risk Score live se disponível; fallback para globalRisk do mock
  const activeScore  = liveRiskScore?.score  ?? GLOBAL_RISK_FALLBACK.score;
  const activeRegime = liveRiskScore
    ? (liveRiskScore.regime === 'RISCO ELEVADO' ? 'RISK-OFF' : liveRiskScore.regime === 'SAUDÁVEL' ? 'RISK-ON' : 'NEUTRAL')
    : GLOBAL_RISK_FALLBACK.regime;
  const regimeColor = activeRegime === 'RISK-ON' ? '#10b981' : activeRegime === 'RISK-OFF' ? '#ef4444' : '#f59e0b';

  // Análise em linguagem natural via Claude Haiku (AI Etapa 4) — 15min cache
  const aiInsightPayload = (IS_LIVE && liveTicker)
    ? {
        page:           'dashboard',
        riskScore:      activeScore,
        riskRegime:     activeRegime,
        fearGreedValue: _fngLive?.value ?? FEAR_GREED_FALLBACK.value,
        fearGreedLabel: _fngLive?.label ?? FEAR_GREED_FALLBACK.label,
        fundingRate:    liveTicker.last_funding_rate,
        mtfConfluence:  mtf.confluence,
        mtfDirection:   mtf.confluenceDir,
        zAlerts:        zAlerts.slice(0, 2).map(a => ({ metric: a.metric, level: a.level, z: a.z, direction: a.direction })),
      }
    : null;
  const { data: haiku, isLoading: haikuLoading } = useAiInsight(aiInsightPayload);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>

      {/* ── TOPO: Regime bar ── */}
      <div style={{
        background: `linear-gradient(90deg, ${regimeColor}12 0%, transparent 100%)`,
        border: `1px solid ${regimeColor}25`, borderRadius: 12,
        padding: '10px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: regimeColor, boxShadow: `0 0 8px ${regimeColor}` }} className="live-dot" />
          <span style={{ fontSize: 11, fontWeight: 800, color: regimeColor, letterSpacing: '0.08em' }}>{activeRegime}</span>
        </div>
        <div style={{ fontSize: 11, color: '#475569' }}>
          Risk Score: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: regimeColor, fontWeight: 700 }}>{activeScore}/100</span>
        </div>
        <div style={{ fontSize: 11, color: '#475569' }}>
          Prob. Evento: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9', fontWeight: 700 }}>{GLOBAL_RISK_FALLBACK.prob}%</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Resumo rápido de qualidade de dados — visível no topo para novos usuários */}
        {IS_LIVE
          ? <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 5, padding: '2px 8px', fontWeight: 700, letterSpacing: '0.02em' }}>
              {SOURCE_HEALTH_FALLBACK.filter(s => s.grade === 'A').length} fontes ao vivo · {SOURCE_HEALTH_FALLBACK.filter(s => s.grade === 'B').length} estimadas · {SOURCE_HEALTH_FALLBACK.filter(s => ['C','D'].includes(s.grade)).length} mock
            </span>
          : <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 5, padding: '2px 8px', fontWeight: 700, letterSpacing: '0.02em' }}>
              DEMO — todos os dados são simulados
            </span>
        }
        <div style={{ fontSize: 10, color: '#334155' }}>
          Updated {lastUpdate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT
        </div>
        <ModeBadge />
      </div>

      {/* ── ZONA A: Risk + F&G + BTC ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
        <RiskMeter
          score={activeScore}
          prob={GLOBAL_RISK_FALLBACK.prob}
          regime={activeRegime}
          moduleScores={liveRiskScore?.module_scores ?? GLOBAL_RISK_FALLBACK.module_scores}
        />
        <FearGreedGauge liveValue={_fngLive?.value} fngError={liveErrors.fng} />
        <BTCSnapshot liveData={_btcLive} tickerError={liveErrors.ticker} />
      </div>

      {/* ── Regra de Ouro ── */}
      <GoldenRule compact />

      {/* ── ZONA B: Macro Board ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle icon="⊞" label="Macro Board" sub="FRED Daily — S&P 500 · DXY · Gold · VIX · US Yields"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DataTrustBadge
                mode={IS_LIVE ? (isSupabaseConfigured() ? 'live' : 'error') : 'mock'}
                confidence={IS_LIVE && isSupabaseConfigured() ? 'A' : 'D'}
                source="FRED API"
                sourceUrl="https://api.stlouisfed.org/fred"
                reason={!isSupabaseConfigured() && IS_LIVE ? 'Supabase não configurado — dados FRED indisponíveis' : !IS_LIVE ? 'DATA_MODE=mock' : undefined}
              />
              <Link to={createPageUrl('Macro')} style={{ fontSize: 11, color: '#475569', textDecoration: 'none', border: '1px solid #1e2d45', padding: '3px 9px', borderRadius: 5 }}>Ver Detalhes →</Link>
            </div>
          } />
        <MacroRow />
      </div>

      {/* ── ZONA C: Sinais extras ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle icon="📡" label="Market Signals" sub="BTC Dominance · Liquidações · Stablecoins · Correlações · Yield Curve · Credit Spread"
          action={null} />
        <ExtraSignals />
      </div>

      {/* ── ZONA D: AI Analysis + Track Record (2 cols) ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle icon="🤖" label="AI Analysis & Previsões" sub="Análise automática baseada em todos os módulos · Com histórico de acertos" />

        {/* Confluência Multi-Timeframe — sempre visível (AGUARDANDO enquanto klines carregam) */}
        <div style={{ marginBottom: 14, background: '#0d1421', border: '1px solid #162032', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.3 }}>Confluência Multi-Timeframe</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                background: mtf.confluence === 'FORTE' ? 'rgba(16,185,129,0.15)' : mtf.confluence === 'MODERADA' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                color:      mtf.confluence === 'FORTE' ? '#10b981'              : mtf.confluence === 'MODERADA' ? '#f59e0b'              : '#94a3b8',
                border: `1px solid ${mtf.confluence === 'FORTE' ? 'rgba(16,185,129,0.3)' : mtf.confluence === 'MODERADA' ? 'rgba(245,158,11,0.3)' : 'rgba(100,116,139,0.3)'}`,
              }}>
                {mtf.confluence}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                background: mtf.confluenceDir === 'bullish' ? 'rgba(16,185,129,0.12)' : mtf.confluenceDir === 'bearish' ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
                color:      mtf.confluenceDir === 'bullish' ? '#10b981'               : mtf.confluenceDir === 'bearish' ? '#ef4444'               : '#94a3b8',
              }}>
                {mtf.confluenceDir.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {mtf.frames.map(f => (
                <div key={f.label} style={{
                  flex: 1, background: '#111827', borderRadius: 8, padding: '10px 12px',
                  border: `1px solid ${f.direction === 'bullish' ? 'rgba(16,185,129,0.25)' : f.direction === 'bearish' ? 'rgba(239,68,68,0.25)' : '#1e2d45'}`,
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: f.direction === 'bullish' ? '#10b981' : f.direction === 'bearish' ? '#ef4444' : '#94a3b8',
                  }}>{f.signal}</div>
                  <div style={{ fontSize: 11, color: '#4a6580', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    {f.ret !== 0 ? `${f.ret >= 0 ? '+' : ''}${(f.ret * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

        {/* Alertas Estatísticos Z-Score */}
        {zAlerts.length > 0 && (
          <div style={{ marginBottom: 14, background: '#0d1421', border: '1px solid #162032', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.3, marginBottom: 10 }}>
              Alertas Estatísticos — Z-Score
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {zAlerts.map(a => (
                <div key={a.metric} style={{
                  flex: '1 1 200px', background: '#111827', borderRadius: 8, padding: '10px 14px',
                  border: `1px solid ${a.direction === 'bullish' ? 'rgba(16,185,129,0.25)' : a.direction === 'bearish' ? 'rgba(239,68,68,0.25)' : '#1e2d45'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{a.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: a.level === 'extreme' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color:      a.level === 'extreme' ? '#ef4444'              : '#f59e0b',
                      border: `1px solid ${a.level === 'extreme' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                      {a.level === 'extreme' ? 'EXTREMO' : 'ELEVADO'}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                    color: a.direction === 'bullish' ? '#10b981' : a.direction === 'bearish' ? '#ef4444' : '#94a3b8',
                  }}>
                    {a.z >= 0 ? '+' : ''}{a.z.toFixed(2)}σ
                  </div>
                  <div style={{ fontSize: 11, color: '#4a6580', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                    {a.metric === 'return'
                      ? `${a.value >= 0 ? '+' : ''}${(a.value * 100).toFixed(2)}% · média ${(a.histMean * 100).toFixed(2)}%`
                      : `$${(a.value / 1e9).toFixed(1)}B · média $${(a.histMean / 1e9).toFixed(1)}B`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Análise AI — Claude Haiku 4.5 — só mostra quando IS_LIVE + Supabase configurado */}
        {(haiku || haikuLoading) && (
          <div style={{ marginBottom: 14, background: '#0d1421', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Análise Natural — Claude Haiku</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                border: '1px solid rgba(139,92,246,0.3)', letterSpacing: '0.06em',
              }}>AI · 15min cache</span>
            </div>
            {haikuLoading
              ? <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#a78bfa',
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                  <span style={{ fontSize: 11, color: '#475569', marginLeft: 6 }}>Gerando análise…</span>
                </div>
              : <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.65, margin: 0 }}>{haiku}</p>
            }
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 14 }}>
          <AIAnalysisPanel analysis={aiAnalysis} compact={true} />
          <AITrackRecord predictions={predictions} isConfigured={isSupabaseConfigured()} />
        </div>
      </div>

      {/* ── ZONA E: Alertas ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle icon="◎" label="Alertas Recentes"
          action={<Link to={createPageUrl('Alerts')} style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', padding: '3px 9px', borderRadius: 5, fontWeight: 600 }}>Ver todos →</Link>} />
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
          {RECENT_ALERTS_FALLBACK.map(a => <AlertRow key={a.id} alert={a} />)}
        </div>
      </div>

      {/* ── ZONA F: Mempool + Data Quality ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MempoolRow />
        <DataQualityStrip />
      </div>
    </div>
  );
}