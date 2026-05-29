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
import { useBtcTicker, useFearGreed as useFearGreedHook, useKlines } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { getFailedCount, getFailedSources } from '@/lib/apiHealthMonitor';
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
  // Fetch 9 days to have ≥8 history bars (current day + 8 previous)
  const { data: fng,       isError: fngError }    = useFearGreedHook(9);
  const { data: riskScore, isError: riskError }   = useRiskScore();
  // Klines diárias — 8 candles para calcular retorno 1W e CVD
  const { data: klines7d } = useKlines('1d', 8);
  return {
    ticker:     ticker ?? null,
    fng:        fng    ?? null,
    riskScore:  riskScore ?? null,
    klines7d:   klines7d ?? [],
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
import PurposeLabel from '@/components/ui/PurposeLabel';

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

// ─── TIP CARD (dica expansível) ───────────────────────────────────────────────
function TipCard({ emoji, title, body, tag }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10,
        padding: '12px 14px', cursor: 'pointer',
        borderLeft: '3px solid #3b82f6',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && (
            <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
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

// ─── FEAR & GREED ─────────────────────────────────────────────────────────────
function FearGreedGauge({ liveValue, fngError, liveHistory }) {
  const hasError = fngError && DATA_MODE === 'live';
  const v = (!hasError && liveValue != null) ? liveValue : FEAR_GREED_FALLBACK.value;
  // Usa histórico live se disponível; fallback para array vazio (barra não renderiza)
  const historyData = (!hasError && liveHistory && liveHistory.length > 0)
    ? liveHistory.slice(-8).map(h => h.value)
    : FEAR_GREED_FALLBACK.history;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
      <PurposeLabel text="Índice 0-100 do sentimento do mercado — abaixo de 20 = medo extremo (potencial fundo); acima de 80 = ganância extrema (potencial topo)." />
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
        {historyData.length > 0
          ? historyData.map((hv, i) => {
              const hz = zones.find(z => hv <= z.max) || zones[zones.length-1];
              const isLast = i === historyData.length - 1;
              return (
                <div key={i} title={`${hv}`} style={{
                  flex: 1, height: `${(hv / 100) * 32}px`,
                  borderRadius: '2px 2px 0 0',
                  background: isLast ? hz.color : `${hz.color}50`,
                  border: isLast ? `1px solid ${hz.color}` : 'none',
                }} />
              );
            })
          : <div style={{ flex: 1, fontSize: 9, color: '#334155', alignSelf: 'center' }}>histórico indisponível</div>
        }
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#2d3d52', marginTop: 3 }}>
        <span>7d atrás</span><span>hoje</span>
      </div>
    </div>
  );
}

// ─── BTC SNAPSHOT ─────────────────────────────────────────────────────────────
function BTCSnapshot({ liveData, tickerError, spotFlow = null }) {
  const err = tickerError && DATA_MODE === 'live';
  const fr = liveData ?? BTC_FUTURES_FALLBACK;
  const ret1d = spotFlow?.ret_1d ?? null;
  const ret1w = spotFlow?.ret_1w ?? null;
  const cvd   = spotFlow?.cvd   ?? null;
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
      <PurposeLabel text="Preço spot atual do Bitcoin nas principais exchanges — variações de 5%+ em 24h indicam evento relevante; desvio entre exchanges sinaliza arbitragem." mt={4} mb={10} />

      {/* Price */}
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1a2535' }}>
        <div style={{ fontSize: 9, color: '#334155', marginBottom: 3 }}>MARK PRICE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: err ? '#4a5568' : '#f1f5f9', letterSpacing: '-0.03em' }}>
            {priceStr}
          </span>
          {ret1d !== null
            ? <DeltaPill value={ret1d * 100} suffix="% 1D" />
            : <span style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>1D —</span>
          }
          {ret1w !== null
            ? <DeltaPill value={ret1w * 100} suffix="% 1W" compact />
            : <span style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>1W —</span>
          }
        </div>
      </div>

      {/* Key metrics grid */}
      <PurposeLabel text="Funding Rate: taxa paga entre longs e shorts nos futuros perpétuos — positivo = longs pagam (mercado alavancado para cima); negativo = shorts pagam (capitulação de bears). Open Interest: total de contratos em aberto — aumento com alta de preço = tendência forte; queda com alta = alerta de divergência." mb={10} />
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
        <Stat
          label="CVD 7d"
          value={cvd !== null ? `${cvd >= 0 ? '+' : ''}${(cvd / 1000).toFixed(1)}K` : '—'}
          color={cvd !== null ? (cvd >= 0 ? '#10b981' : '#ef4444') : '#4a5568'}
          big
          sub={cvd !== null ? (cvd >= 0 ? 'Taker Buy > Sell' : 'Taker Sell > Buy') : 'klines indisponíveis'}
          help={{ title: 'CVD 7d', content: 'Diferença acumulada entre volume comprador e vendedor nos últimos 7 candles diários. Positivo = agressores compradores dominando.' }}
        />
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
  // Usa apiHealthMonitor para contar fontes em falha em tempo real
  const [failedCount, setFailedCount] = useState(getFailedCount);
  const [failedSources, setFailedSources] = useState(getFailedSources);
  useEffect(() => {
    const interval = setInterval(() => {
      setFailedCount(getFailedCount());
      setFailedSources(getFailedSources());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // fontes conhecidas do sistema (todas as integradas)
  const KNOWN_SOURCES = ['binance_futures', 'alternative_me', 'coingecko', 'mempool', 'fred', 'deribit'];
  const failed = failedCount;
  const ok = Math.max(0, KNOWN_SOURCES.length - failed);

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12 }}>🛰️</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', flex: 1, textAlign: 'left' }}>Saúde das Fontes de Dados</span>
        <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{ok} OK</span>
        {failed > 0 && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{failed} ⚠</span>}
        <ModeBadge />
        <span style={{ fontSize: 10, color: '#334155' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && failedSources.length > 0 && (
        <div style={{ borderTop: '1px solid #1a2535', padding: '10px 16px' }}>
          {failedSources.map(s => (
            <SourceRow key={s} source={{ source: s, grade: 'D', label: s }} />
          ))}
        </div>
      )}
      {open && failedSources.length === 0 && (
        <div style={{ borderTop: '1px solid #1a2535', padding: '10px 16px', fontSize: 11, color: '#10b981' }}>
          Todas as fontes operacionais
        </div>
      )}
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>AI — Track Record</div>
          <PurposeLabel text="Histórico de acertos e erros das previsões da IA — acurácia acima de 60% indica modelo calibrado; use o histórico para avaliar a confiabilidade dos sinais atuais." mt={2} mb={4} />
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
      {/* Banner demo — aparece quando Supabase não está configurado */}
      {useDemo && (
        <div style={{
          margin: '0 18px 12px', marginTop: 10, padding: '6px 12px', borderRadius: 6,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 10, color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>⚠</span>
          <span>
            <strong>Dados de demonstração</strong> — predições simuladas para exemplo.
            Configure o Supabase para ver o histórico real de previsões.
          </span>
        </div>
      )}
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
  const { ticker: liveTicker, fng: liveFng, riskScore: liveRiskScore, klines7d, btcFutures: _btcLive, fearGreed: _fngLive, errors: liveErrors } = useDashboardLiveData();

  // Stale detection: usamos as mesmas query keys — TanStack Query deduplica (sem requests extras)
  const { data: macroForStale }   = useMacroBoard();
  const { data: mempoolForStale } = useMempoolState();

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
  // Acompanha saúde das fontes de dados em tempo real (polling 5s)
  const [liveFailedCount, setLiveFailedCount] = useState(() => getFailedCount());
  useEffect(() => {
    const t = setInterval(() => {
      setLastUpdate(new Date());
      setLiveFailedCount(getFailedCount());
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Contagem de fontes live/falhas para o banner de status
  const KNOWN_SOURCES_COUNT = 6; // binance_futures, alternative_me, coingecko, mempool, fred, deribit
  const liveOkCount = Math.max(0, KNOWN_SOURCES_COUNT - liveFailedCount);

  // Detecta se alguma fonte primária está servindo dado do cache Supabase (fallback)
  const isAnyStale = !!(liveTicker?.isFallback || liveFng?.isFallback || macroForStale?.isFallback || mempoolForStale?.isFallback);
  const staleDate  = liveTicker?.lastUpdated ?? liveFng?.lastUpdated ?? macroForStale?.lastUpdated ?? mempoolForStale?.lastUpdated ?? null;

  // Calcula retorno 1W e CVD a partir das klines diárias (quando disponíveis)
  const spotFlowLive = (() => {
    if (!liveTicker) return null;
    const ret1d = (liveTicker.price_change_pct ?? 0) / 100;
    if (!klines7d || klines7d.length < 2) {
      return { ret_1d: ret1d, ret_1w: null, cvd: null };
    }
    const oldest = klines7d[0];
    const newest = klines7d[klines7d.length - 1];
    const ret1w = oldest.close > 0 ? (newest.close - oldest.close) / oldest.close : null;
    // CVD: soma de (takerBuy - takerSell) em cada candle
    const cvd = klines7d.reduce((acc, k) => {
      const takerSell = k.volume - k.taker_buy;
      return acc + (k.taker_buy - takerSell);
    }, 0);
    return { ret_1d: ret1d, ret_1w: ret1w, cvd };
  })();

  // Usa Risk Score live se disponível; fallback para globalRisk do mock
  const activeScore  = liveRiskScore?.score  ?? GLOBAL_RISK_FALLBACK.score;
  const activeRegime = liveRiskScore
    ? (liveRiskScore.regime === 'RISCO ELEVADO' ? 'RISK-OFF' : liveRiskScore.regime === 'SAUDÁVEL' ? 'RISK-ON' : 'NEUTRAL')
    : GLOBAL_RISK_FALLBACK.regime;
  const regimeColor = activeRegime === 'RISK-ON' ? '#10b981' : activeRegime === 'RISK-OFF' ? '#ef4444' : '#f59e0b';
  // Prob. de evento de risco: derivada do score (score/100 como proxy linear)
  const activeProb = Math.round(activeScore);

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
          Prob. Evento: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9', fontWeight: 700 }}>{activeProb}%</span>
        </div>
        <div style={{ flex: 1 }} />
        {/* Resumo rápido de qualidade de dados — visível no topo para novos usuários */}
        {IS_LIVE
          ? <span style={{ fontSize: 10, color: liveFailedCount > 0 ? '#f59e0b' : '#10b981', background: liveFailedCount > 0 ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)', border: `1px solid ${liveFailedCount > 0 ? 'rgba(245,158,11,0.22)' : 'rgba(16,185,129,0.22)'}`, borderRadius: 5, padding: '2px 8px', fontWeight: 700, letterSpacing: '0.02em' }}>
              {liveOkCount} fontes ao vivo{liveFailedCount > 0 ? ` · ${liveFailedCount} em fallback` : ''}
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

      {/* ── BANNER: Para que serve esta página ── */}
      <div style={{
        marginBottom: 16, padding: '16px 20px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(16,185,129,0.05) 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>🎯</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
              Para que serve esta página?
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              O <strong style={{ color: '#cbd5e1' }}>Dashboard</strong> é o seu{' '}
              <strong style={{ color: '#cbd5e1' }}>centro de comando</strong> — uma visão completa e integrada
              do estado do mercado BTC em um único painel. Em vez de abrir 10 telas diferentes, aqui você vê em
              segundos se o mercado está saudável ou em risco, o sentimento dos traders, os principais indicadores
              macro e os sinais da IA.{' '}
              <strong style={{ color: '#3b82f6' }}>Use diariamente para responder:</strong>{' '}
              "Devo estar mais exposto ou mais protegido agora?"
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '🌡️', text: 'Risk Score 0–100: nível de perigo global do mercado' },
                { icon: '😱', text: 'Fear & Greed: sentimento atual dos traders' },
                { icon: '🌐', text: 'Macro Board: como o cenário global está impactando o BTC' },
                { icon: '🤖', text: 'Análise AI: síntese automática com histórico de acertos' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER: Último valor salvo (fallback de cache) ── */}
      {isAnyStale && staleDate && (
        <div style={{
          marginBottom: 16, padding: '7px 14px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 10, color: '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>⚠ Usando último valor salvo — uma ou mais APIs estão temporariamente indisponíveis</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
            Último salvo: {new Date(staleDate).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {/* ── ZONA A: Risk + F&G + BTC ── */}
      <SectionTitle icon="🌡️" label="Visão Geral" sub="Risk Score · Fear &amp; Greed · BTC Snapshot — estado atual em 3 indicadores-chave" />
      <PurposeLabel text="Risk Score: índice composto 0-100 da saúde do mercado BTC — acima de 70 = risk-on (aumentar exposição); abaixo de 30 = risk-off (reduzir posições e proteger capital)." mb={10} mt={0} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14, marginBottom: 20 }}>
        <RiskMeter
          score={activeScore}
          prob={activeProb}
          regime={activeRegime}
          moduleScores={liveRiskScore?.module_scores ?? GLOBAL_RISK_FALLBACK.module_scores}
        />
        <FearGreedGauge liveValue={_fngLive?.value} fngError={liveErrors.fng} liveHistory={liveFng?.history ?? []} />
        <BTCSnapshot liveData={_btcLive} tickerError={liveErrors.ticker} spotFlow={spotFlowLive} />
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
        <PurposeLabel text="Indicadores macro globais atualizados diariamente — VIX acima de 30 sinaliza stress; DXY em alta pressiona BTC; yields em queda são favoráveis a ativos de risco." />
        <MacroRow />
      </div>

      {/* ── ZONA C: Sinais extras ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle icon="📡" label="Market Signals" sub="BTC Dominance · Liquidações · Stablecoins · Correlações · Yield Curve · Credit Spread"
          action={null} />
        <PurposeLabel text="Sinais complementares de mercado — dominância BTC acima de 58% indica rotação de altcoins para BTC; liquidações crescentes indicam alavancagem excessiva no mercado." />
        <ExtraSignals />
      </div>

      {/* ── DICAS DE OURO — Dashboard ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Usar o Dashboard</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Leitura recomendada antes de operar</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="🌡️"
            title="Risk Score: como interpretar os thresholds de 30 e 70"
            tag="RISCO"
            body={<span>
              O Risk Score combina 5 fontes: funding rate, delta de OI, DVOL de opções, Fear {'&'} Greed e desvio de preço da EMA20.
              <br /><br />
              <strong>Acima de 70 (sobreaquecido):</strong> Funding alto, longs excessivos, risco de flush liquidatório. Reduza exposição ou use stops apertados.<br />
              <strong>Entre 30 e 70 (neutro/moderado):</strong> Sinais mistos. Exija confluência de outros indicadores antes de entrar.<br />
              <strong>Abaixo de 30 (capitulação):</strong> Medo extremo — historicamente precede recuperações. Potencial zona de entrada, mas confirme com reversão de preço e CVD positivo.
              <br /><br />
              <strong>Regra prática:</strong> Nunca entre em longs alavancados com Risk Score acima de 65. Nunca entre em shorts alavancados com Risk Score abaixo de 35.
            </span>}
          />
          <TipCard
            emoji="😱"
            title="Fear & Greed divergindo do preço: o sinal mais poderoso"
            tag="CONTRARIAN"
            body={<span>
              A divergência entre o índice Fear {'&'} Greed e o preço do BTC é um dos sinais mais potentes da análise de sentimento.
              <br /><br />
              <strong>Preço subindo + F{'&'}G em queda:</strong> A alta não está gerando euforia — possível acumulação institucional silenciosa. Tende a ser sustentável.<br />
              <strong>Preço em queda + F{'&'}G subindo:</strong> O sentimento melhora antes do preço — possível fundo antecipado pelo mercado.<br />
              <strong>Preço subindo + F{'&'}G {'>'} 80 (Ganância Extrema):</strong> Alerta — varejo eufórico, smart money pode estar distribuindo.
              <br /><br />
              <strong>Como usar:</strong> Compare o valor atual (número grande) com os 7 dias anteriores (barras abaixo do gauge). Tendência de queda do F{'&'}G com preço estável é sinal de warning.
            </span>}
          />
          <TipCard
            emoji="🌐"
            title="Sinais macro: o vento que empurra ou freia o BTC"
            tag="MACRO"
            body={<span>
              O BTC não existe em vácuo. Os mercados macro definem o ambiente de risco global e afetam a disposição a comprar ativos especulativos.
              <br /><br />
              <strong>VIX {'>'} 25:</strong> Stress de mercado — correlação BTC/SPX aumenta, quedas conjuntas mais prováveis. Reduza posições.<br />
              <strong>DXY em alta (USD forte):</strong> Capital migra para dólar. Ambiente desfavorável para BTC. Cautela.<br />
              <strong>US10Y caindo:</strong> Juros em queda = apetite por risco crescendo = favorável ao BTC.<br />
              <strong>Ouro subindo + BTC caindo:</strong> "Flight to safety" — não é momento de arriscar.
              <br /><br />
              <strong>Cenário ideal para BTC:</strong> VIX {'<'} 18, DXY estável ou em queda, yields caindo, S{'&'}P em alta.
            </span>}
          />
          <TipCard
            emoji="👑"
            title="BTC Dominance: decifrando o ciclo de altseason"
            tag="CICLO"
            body={<span>
              A dominância do BTC (% do marketcap total cripto) indica onde o dinheiro está fluindo dentro do ecossistema.
              <br /><br />
              <strong>Dominância {'>'} 58% e subindo:</strong> Capital migrando de altcoins para BTC — "Bitcoin season". Favorável para BTC, desfavorável para altcoins.<br />
              <strong>Dominância {'<'} 50% e caindo:</strong> Capital fluindo para altcoins — "Altcoin season". ETH e altcoins large-cap tendem a superar BTC.<br />
              <strong>Dominância caindo com BTC em alta:</strong> Melhor momento para exposição diversificada.
              <br /><br />
              <strong>Checagem rápida:</strong> Use o painel Market Signals acima para ver o valor atual de BTC.D.
            </span>}
          />
          <TipCard
            emoji="⛓️"
            title="Mempool congestionada: demanda real on-chain"
            tag="ON-CHAIN"
            body={<span>
              O mempool é a fila de transações aguardando confirmação. Seu tamanho e as taxas revelam o nível de atividade on-chain real.
              <br /><br />
              <strong>Fees altas (Fastest {'>'} 50 sat/vB):</strong> Rede congestionada — alta demanda por blockspace. Ocorre em períodos de alta atividade.<br />
              <strong>Mempool {'>'} 100MB:</strong> Backlog significativo — transações lentas para quem paga fee mínimo.<br />
              <strong>Fees caindo com preço subindo:</strong> A alta não está sendo acompanhada por atividade on-chain — possível alta fraca.
              <br /><br />
              <strong>Para traders:</strong> Fees altas correlacionam com volatilidade elevada. Um spike de fees antes de um movimento grande pode ser indicador antecipado.
            </span>}
          />
          <TipCard
            emoji="🤖"
            title="Como usar a análise de IA sem depender cegamente dela"
            tag="IA"
            body={<span>
              A análise de IA do Dashboard combina regras de threshold (funding, OI, F{'&'}G, retorno de preço) em quatro módulos: derivativos, spot, opções e macro.
              <br /><br />
              <strong>Use a IA para:</strong> Confirmar uma hipótese já formada. Se você já viu funding alto, F{'&'}G elevado e OI crescendo, e a IA diz "CAUTION", a confluência aumenta a confiança.<br />
              <strong>Não use a IA para:</strong> Decisões isoladas. O modelo não tem acesso a notícias, eventos inesperados ou movimentos de baleias.<br />
              <strong>Track Record:</strong> Verifique o histórico abaixo. Acurácia acima de 60% indica modelo calibrado.
              <br /><br />
              <strong>Regra de ouro:</strong> Confluência entre IA + Z-Score + MTF + Macro = convicção máxima. IA isolada = ruído.
            </span>}
          />
        </div>
      </div>

      {/* ── ZONA D: AI Analysis + Track Record (2 cols) ── */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle icon="📊" label="Análise & Previsões" sub="Análise automática por regras de threshold · Claude Haiku quando configurado · Com histórico de acertos" />
        <PurposeLabel text="Síntese automática das condições atuais pelo modelo de IA — use como ponto de partida para análise, nunca como única fonte de decisão; confluência entre múltiplos timeframes aumenta a confiança no sinal." />

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
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.3, marginBottom: 4 }}>
              Alertas Estatísticos — Z-Score
            </div>
            <PurposeLabel text="Desvios estatísticos em relação à média histórica — Z acima de +2σ ou abaixo de -2σ indica movimento extremo que frequentemente precede reversão ou aceleração de tendência." mb={10} />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Análise Natural — Claude Haiku</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                border: '1px solid rgba(139,92,246,0.3)', letterSpacing: '0.06em',
              }}>AI · 15min cache</span>
            </div>
            <PurposeLabel text="Interpretação em linguagem natural gerada pelo Claude Haiku — resume o estado atual integrando todos os módulos; atualizado a cada 15 minutos para evitar excesso de chamadas à API." mb={10} />
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
          sub="Notificações automáticas de condições extremas de mercado"
          action={<Link to={createPageUrl('SmartAlerts')} style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', padding: '3px 9px', borderRadius: 5, fontWeight: 600 }}>Ver todos →</Link>} />
        <PurposeLabel text="Notificações automáticas de condições de mercado configuradas — permite reagir a mudanças sem monitorar a tela o tempo todo; cada alerta indica intensidade e tipo do evento." />
        {RECENT_ALERTS_FALLBACK.length > 0 ? (
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            {RECENT_ALERTS_FALLBACK.map(a => <AlertRow key={a.id} alert={a} />)}
          </div>
        ) : (
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '20px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🔔</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Nenhum alerta ativo</div>
            <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
              Configure alertas em{' '}
              <Link to={createPageUrl('SmartAlerts')} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>Smart Alerts →</Link>
              {' '}para ser notificado de funding extremo, liquidações e eventos macro.
            </div>
          </div>
        )}
      </div>

      {/* ── ZONA F: Mempool + Data Quality ── */}
      <PurposeLabel text="Estado da rede Bitcoin em tempo real — taxas altas indicam congestionamento e demanda elevada pela chain; mempool grande sinaliza backlog de transações pendentes." mt={0} mb={8} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MempoolRow />
        <DataQualityStrip />
      </div>
    </div>
  );
}