import { useState } from 'react';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { useAiInsight } from '@/hooks/useAiInsight';
import { useBtcTicker, useOiByExchange, useLiquidations, useLongShortRatio, useDominance, useFundingAverages, useTopTraderLs, usePerpVsDatedOi } from '@/hooks/useBtcData';
import { useMultiVenueSnapshot, useBybitTicker, useOkxTicker } from '@/hooks/useMultiVenue';
import { DataQualityBadge } from '../components/ui/DataQualityBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { IS_LIVE } from '@/lib/env';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge } from '../components/ui/DataBadge';
import LiquidationHeatmap from '../components/derivatives/LiquidationHeatmap';
import BasisPanel from '../components/derivatives/BasisPanel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

const fmtNum = (v, d = 2) => v != null ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtPct = (v, d = 4) => v != null ? (v * 100).toFixed(d) + '%' : '—';

const BTC_FUTURES_FALLBACK = {
  mark_price: 0, index_price: 0,
  funding_rate: 0, funding_avg_7d: 0, funding_avg_30d: 0,
  open_interest: 0, open_interest_usdt: 0,
  oi_delta_pct: 0, oi_delta_pct_1w: 0, oi_delta_pct_1m: 0,
  long_short_ratio: 1, top_trader_ls: 1,
  next_funding_time: new Date(Date.now() + 8 * 3600 * 1000),
  risk_score: 0, risk_direction: 'long_flush',
  risk_factors: { funding_extreme: 0, oi_spike: 0, vol_spike: 0, crowding: 0, ret_mag: 0 },
  funding_history: [],
};
const OI_RATIO_FALLBACK = { ratio_pct: 0, zone: '—', signal: '' };
const PERP_VS_DATED_FALLBACK = {
  perp_oi_b: 0, perp_pct: 50, dated_oi_b: 0, dated_pct: 50,
  cme_oi_b: 0, cme_pct_of_dated: 0, signal: 'Dados indisponíveis — requer API paga (CoinGlass)',
};
const AI_MODULE_FALLBACK = {
  direction: 'neutral', signal: '', score: 0,
  probability: 0, confidence: 0, timeframe: '—', trigger: '—', analysis: '',
};
const AI_DERIVATIVES_FALLBACK = { modules: { derivatives: AI_MODULE_FALLBACK } };

// ─── DATA LAYER ────────────────────────────────────────────────────────────────
function useDerivativesData() {
  const { data: ticker }    = useBtcTicker();
  const { data: oiExch }    = useOiByExchange();
  const { data: fundAvg }   = useFundingAverages();
  const { data: topTrader } = useTopTraderLs();
  const { data: bybit }     = useBybitTicker();
  const { data: okx }       = useOkxTicker();

  const liveBtcFutures = ticker ? {
    ...BTC_FUTURES_FALLBACK,
    mark_price:         ticker.mark_price,
    index_price:        ticker.mark_price,
    funding_rate:       ticker.last_funding_rate,
    funding_avg_7d:     fundAvg?.avg_7d  ?? 0,
    funding_avg_30d:    fundAvg?.avg_30d ?? 0,
    oi_delta_pct:       ticker.oi_delta_pct,
    open_interest:      ticker.open_interest,
    open_interest_usdt: ticker.open_interest * ticker.mark_price,
    top_trader_ls:      topTrader?.ls_ratio ?? 1,
  } : BTC_FUTURES_FALLBACK;

  const binanceOiEntry = oiExch?.[0] ?? null;
  const bybitOi = bybit?.open_interest_usd ?? null;
  const okxOi   = okx?.open_interest_usd   ?? null;

  const oiByExchange = [];
  if (binanceOiEntry) oiByExchange.push({ ...binanceOiEntry, oi_b: binanceOiEntry.oi_usd / 1e9, change_24h: null });
  if (bybitOi !== null) oiByExchange.push({ exchange: 'Bybit', oi_usd: bybitOi, oi_b: bybitOi / 1e9, share_pct: 0, change_24h: null });
  if (okxOi !== null)   oiByExchange.push({ exchange: 'OKX',   oi_usd: okxOi,   oi_b: okxOi / 1e9,   share_pct: 0, change_24h: null });

  const totalOi = oiByExchange.reduce((s, e) => s + e.oi_b, 0);
  if (totalOi > 0) oiByExchange.forEach(e => { e.share_pct = parseFloat(((e.oi_b / totalOi) * 100).toFixed(1)); });

  return { btcFutures: liveBtcFutures, oiByExchange, hasLiveFutures: !!ticker };
}

const COLORS = { positive: '#10b981', negative: '#ef4444', neutral: '#f59e0b', blue: '#3b82f6' };

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
          width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
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
      style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', borderLeft: '3px solid #3b82f6' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{tag}</span>}
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
      <div style={{ fontSize: 8, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>✦ Claude AI — Interpretação em português</div>
      {loading && !text
        ? <div style={{ height: 12, borderRadius: 3, background: 'rgba(59,130,246,0.1)' }} />
        : <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>{text}</div>
      }
    </div>
  );
}

function FactorBar({ label, value, max = 1 }) {
  const pct = (value / max) * 100;
  const color = pct > 70 ? COLORS.negative : pct > 40 ? COLORS.neutral : COLORS.positive;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#8899a6' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: '#1e2d45' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function FundingChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(245,158,11,0.04)', border: '1px dashed rgba(245,158,11,0.2)', borderRadius: 8,
      }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>📊</div>
        <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', maxWidth: 240 }}>
          Histórico de funding indisponível via endpoint público gratuito
        </div>
        <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>Taxa atual exibida abaixo</div>
      </div>
    );
  }
  const chartData = data.map(d => ({
    time: format(new Date(d.fundingTime), 'MMM d HH:mm'),
    rate: parseFloat((d.fundingRate * 100).toFixed(4)),
  }));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} interval={Math.floor(chartData.length / 5)} />
        <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
        <Tooltip contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }} formatter={(v) => [Number(v).toFixed(4) + '%', 'Funding']} />
        <ReferenceLine y={0} stroke="#2a3f5f" />
        <Bar dataKey="rate" radius={[2,2,0,0]} fill={COLORS.positive} label={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export function DerivativesOverview() {
  const { btcFutures: liveBtc, oiByExchange: liveOi, hasLiveFutures } = useDerivativesData();
  const f = liveBtc;

  const { data: perpVsDated } = usePerpVsDatedOi();
  const { data: lsData }      = useLongShortRatio();
  const liveLsRatio = (lsData && lsData.shortAccount > 0)
    ? parseFloat((lsData.longAccount / lsData.shortAccount).toFixed(4))
    : null;

  const { data: oiData }    = useOiByExchange();
  const { data: dominance } = useDominance();
  const totalOiUsd   = oiData ? oiData.reduce((s, e) => s + (e.oi_usd ?? 0), 0) : null;
  const btcMcapUsd   = dominance ? dominance.total_mcap_usd * dominance.btc_dominance / 100 : null;
  const liveRatioPct = (totalOiUsd && btcMcapUsd) ? (totalOiUsd / btcMcapUsd) * 100 : null;
  const displayRatioPct  = liveRatioPct ?? OI_RATIO_FALLBACK.ratio_pct;
  const displayZone      = liveRatioPct !== null
    ? (liveRatioPct < 0.5 ? 'Baixo' : liveRatioPct < 1.0 ? 'Moderado' : liveRatioPct < 1.5 ? 'Elevado' : 'Extremo')
    : OI_RATIO_FALLBACK.zone;
  const displayZoneColor = liveRatioPct !== null
    ? (liveRatioPct < 0.5 ? '#10b981' : liveRatioPct < 1.0 ? '#f59e0b' : '#ef4444')
    : '#f59e0b';

  const liveAnalysis = IS_LIVE && hasLiveFutures
    ? computeRuleBasedAnalysis({ derivatives: { fundingRate: liveBtc.funding_rate, oiDeltaPct: liveBtc.oi_delta_pct, openInterest: liveBtc.open_interest } })
    : null;
  const aiAnalysis = liveAnalysis ?? AI_DERIVATIVES_FALLBACK;

  const derivPayload = hasLiveFutures ? {
    page: 'derivatives',
    riskScore: aiAnalysis.modules?.derivatives?.score ?? 50,
    riskRegime: f.risk_score > 75 ? 'EXTREMO' : f.risk_score > 50 ? 'ELEVADO' : 'MODERADO',
    fearGreedValue: 50, fearGreedLabel: 'Neutral',
    fundingRate: liveBtc.funding_rate,
    context: { oiDeltaPct: liveBtc.oi_delta_pct },
  } : null;
  const { data: derivInsight, isLoading: derivAiLoading } = useAiInsight(derivPayload);

  const fundingPos     = f.funding_rate > 0;
  const fundingExtreme = Math.abs(f.funding_rate) > 0.0005;
  const nextFundHours  = Math.round((f.next_funding_time.getTime() - Date.now()) / 3600000);
  const riskColor      = f.risk_score > 75 ? COLORS.negative : f.risk_score > 50 ? COLORS.neutral : COLORS.positive;
  const directionLabel = f.risk_direction === 'long_flush' ? '⬇️ Long Flush' : '⬆️ Short Squeeze';
  const lsRatioFinal   = liveLsRatio ?? f.long_short_ratio;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} data-source="binance_futures" data-page="derivatives">

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>BTC Derivatives</h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          Binance USDⓈ-M Futures · BTCUSDT · <ModeBadge />
          <DataTrustBadge
            mode={IS_LIVE ? 'live' : 'mock'}
            confidence={IS_LIVE ? 'A' : 'D'}
            source="Binance Futures"
            sourceUrl="https://fapi.binance.com"
            reason={!IS_LIVE ? 'DATA_MODE=mock' : undefined}
          />
        </p>
      </div>

      {/* ── BANNER "PARA QUE SERVE" ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(239,68,68,0.07) 0%, rgba(245,158,11,0.05) 100%)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>⟆</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 820 }}>
              <strong style={{ color: '#cbd5e1' }}>Derivatives</strong> analisa contratos futuros e alavancagem — a "aposta" que traders fazem com dinheiro emprestado.
              Diferente do Spot (dinheiro real), aqui estamos vendo liquidações, funding rates (custo de alavancagem) e posições de risco.{' '}
              <strong style={{ color: '#f59e0b' }}>Use esta página para responder:</strong>{' '}
              "O mercado está super-alavancado? Existe risco de cascata de liquidações? Vai ter um flush (despencada forçada) ou squeeze (disparada forçada)?"
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '⚠️', text: 'Detectar sobre-alavancagem de longs ou shorts' },
                { icon: '💥', text: 'Prever cascatas de liquidações automáticas' },
                { icon: '🏦', text: 'Ver qual exchange concentra mais risco' },
                { icon: '📊', text: 'Entender quanto custa manter alavancagem agora' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ALERTA FUNDING EXTREMO ───────────────────────────────────────────── */}
      {fundingExtreme && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          background: fundingPos ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
          border: `1px solid ${fundingPos ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{fundingPos ? '🔥' : '❄️'}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: fundingPos ? '#ef4444' : '#10b981', marginBottom: 2 }}>
              {fundingPos ? 'Funding Extremamente Positivo — Alerta de Long Flush' : 'Funding Extremamente Negativo — Alerta de Short Squeeze'}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
              {fundingPos
                ? `Funding acima de +0.05% por 8h: longs estão pagando caro para manter posições. Historicamente precede quedas de 3–8% em horas. Atual: ${fmtPct(f.funding_rate, 4)}`
                : `Funding abaixo de -0.05% por 8h: shorts dominam e pagam caro. Um short squeeze pode disparar alta forçada. Atual: ${fmtPct(f.funding_rate, 4)}`
              }
            </div>
          </div>
        </div>
      )}

      {/* ── TOP METRICS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          {
            label: <Tip text="Preço de liquidação dos contratos perpétuos na Binance. Ligeiramente diferente do spot — a diferença chama-se 'basis'. Fonte: Binance /fapi/v1/premiumIndex">Mark Price</Tip>,
            value: `$${fmtNum(f.mark_price, 0)}`, color: '#e2e8f0',
          },
          {
            label: <Tip text="Index Price = média ponderada do preço spot em múltiplas exchanges. Serve de referência para calcular o funding rate a cada 8h. Aqui usa mark_price como proxy — diferença real é pequena.">Index Price</Tip>,
            value: `$${fmtNum(f.index_price, 0)}`,
            sub: `Spread: ${f.index_price > 0 ? ((f.mark_price - f.index_price)/f.index_price*10000).toFixed(1) : '0.0'}bp`,
            color: '#e2e8f0',
          },
          {
            label: <Tip text="Funding Rate = taxa paga a cada 8h entre longs e shorts. Positivo: longs pagam aos shorts (mercado otimista demais). Negativo: shorts pagam aos longs. Extremo (>0.05%): risco de liquidações.">Funding Atual</Tip>,
            value: fmtPct(f.funding_rate, 4),
            color: fundingPos ? '#ef4444' : '#10b981',
            sub: `Próximo em ${nextFundHours}h`,
          },
          {
            label: <Tip text="Média do funding rate nas últimas 7 dias. Acima de 0.05%: custo de alavancagem está persistentemente elevado — não é um spike pontual.">Funding 7D avg</Tip>,
            value: fmtPct(f.funding_avg_7d, 4),
            color: f.funding_avg_7d > 0.0005 ? '#f59e0b' : '#8899a6',
          },
          {
            label: <Tip text="Média do funding nos últimos 30 dias. Benchmark de longo prazo: se o atual estiver muito acima desta média, o mercado está inusitadamente alavancado agora.">Funding 30D avg</Tip>,
            value: fmtPct(f.funding_avg_30d, 4), color: '#8899a6',
          },
          {
            label: <Tip text="Open Interest = soma de todos os contratos futuros abertos (longs + shorts). Subindo: mais alavancagem. Caindo: desalavancagem. Spike repentino + funding extremo = perigo.">Open Interest</Tip>,
            value: `$${(f.open_interest_usdt/1e9).toFixed(2)}B`, color: '#e2e8f0',
          },
          {
            label: <Tip text="Razão entre contas Long vs Short na Binance. Acima de 1: mais longs. Abaixo de 1: mais shorts. Desequilíbrio >1.2 = maior risco de flush no lado dominante.">L/S Ratio</Tip>,
            value: lsRatioFinal.toFixed(2),
            color: lsRatioFinal > 1 ? '#10b981' : '#ef4444',
            sub: lsData ? '● Binance live' : '—',
          },
          {
            label: <Tip text="Posição dos maiores traders da Binance (notional ≥50 BTC). Indicador do 'smart money'. Divergência com o L/S geral pode indicar armadilha para os menores.">Top Trader L/S</Tip>,
            value: f.top_trader_ls.toFixed(2),
            color: f.top_trader_ls > 1 ? '#60a5fa' : '#a78bfa',
            sub: 'Top traders Binance',
          },
        ].map((m, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: m.color }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── OI DELTA MULTI-PERÍODO ────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            <Tip text="OI Delta = variação percentual do Open Interest no período. Positivo: mais alavancagem entrando. Negativo: posições sendo fechadas. Delta > +5% em 24h + funding extremo = mercado armando liquidações.">OI Delta</Tip>
          </div>
          <span style={{ fontSize: 9, color: '#334155', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 4, padding: '2px 6px' }}>variação do open interest por período</span>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              1D <span style={{ color: '#10b981', fontWeight: 700 }}>● LIVE</span>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: f.oi_delta_pct > 1.5 ? '#f59e0b' : '#10b981' }}>
              {f.oi_delta_pct > 0 ? '+' : ''}{f.oi_delta_pct.toFixed(2)}%
            </span>
          </div>
          <div style={{ opacity: 0.45 }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4 }}>1W <span style={{ color: '#334155' }}>○ sem dado</span></div>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#2a3a4a' }}>—</span>
          </div>
          <div style={{ opacity: 0.45 }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4 }}>1M <span style={{ color: '#334155' }}>○ sem dado</span></div>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#2a3a4a' }}>—</span>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 2 }}>OI Absoluto (Binance)</div>
            <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace', color: '#8899a6', fontWeight: 600 }}>${(f.open_interest_usdt/1e9).toFixed(2)}B</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 9, color: '#334155', padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535' }}>
          ℹ️ Histórico semanal/mensal de OI indisponível no endpoint público Binance — somente variação 24h disponível. OI Delta 1W e 1M <strong style={{ color: '#475569' }}>não são considerados nas análises de AI</strong>.
        </div>
      </div>

      {/* ── RISK SCORE + FUNDING HISTORY ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Risk score */}
        <div style={{ background: '#111827', border: `1px solid rgba(${f.risk_score > 75 ? '239,68,68' : '245,158,11'},0.3)`, borderRadius: 12, padding: 20 }}>
          <SectionHeader title="Proxy Flush/Squeeze Risk" subtitle="Calculado localmente — baseado em thresholds" />
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Score 0–100 que resume o risco de liquidação em cascata. Verde = estável. Vermelho = extremo, reduzir exposição.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: riskColor, letterSpacing: '-0.04em', lineHeight: 1 }}>{f.risk_score}</div>
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>/ 100</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, padding: '4px 10px', borderRadius: 6, background: `rgba(${f.risk_score > 75 ? '239,68,68' : '245,158,11'},0.1)`, color: riskColor, display: 'inline-block' }}>
                {directionLabel}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)', marginBottom: 10 }} />
              <div style={{ fontSize: 11, color: '#4a5568' }}>
                {f.risk_direction === 'long_flush'
                  ? 'Funding positivo + longs sobrecarregados → risco de flush (liquidação em cascata)'
                  : 'Funding negativo + shorts sobrecarregados → risco de squeeze (compra forçada)'}
              </div>
            </div>
          </div>
          <div>
            <FactorBar label={<Tip text="O quanto o funding rate atual desvia do normal (~0%). Acima de 0.05%: extremo.">Funding Extreme</Tip>} value={f.risk_factors.funding_extreme} />
            <FactorBar label={<Tip text="Velocidade de crescimento do OI em 24h. Spike acima de 5% = muito dinheiro alavancado entrando rápido.">OI Spike</Tip>} value={f.risk_factors.oi_spike} />
            <FactorBar label={<Tip text="Variação intraday do preço. Volatilidade alta + funding extremo = condições para liquidações em massa.">Vol Spike</Tip>} value={f.risk_factors.vol_spike} />
            <FactorBar label={<Tip text="Desequilíbrio entre longs e shorts. Mercado muito unilateral = mais vulnerável a liquidações em cascata.">Crowding</Tip>} value={f.risk_factors.crowding} />
            <FactorBar label={<Tip text="Magnitude do retorno recente. Movimentos grandes aumentam a chance de posições alavancadas atingirem stop.">Return Magnitude</Tip>} value={f.risk_factors.ret_mag} />
          </div>
          <div style={{ marginTop: 12, fontSize: 9, padding: '8px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1a2535' }}>
            <div style={{ color: '#475569', fontWeight: 700, marginBottom: 4 }}>Dados usados neste score:</div>
            {['✅ Funding Rate (live)', '✅ OI Delta 24h (live)', '✅ Open Interest (live)'].map((d, i) => <div key={i} style={{ color: '#334155' }}>{d}</div>)}
            {['⬜ OI Delta 1W (indisponível)', '⬜ OI Delta 1M (indisponível)'].map((d, i) => <div key={i} style={{ color: '#2a3a4a' }}>{d}</div>)}
          </div>
        </div>

        {/* Funding History */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader title="Funding Rate History" subtitle="8h intervals · Binance USDⓈ-M" />
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 10, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Ver tendência do custo de alavancagem. Persistentemente positivo = mercado em euforia. Oscilando em torno de zero = saudável.
          </div>
          <FundingChart data={f.funding_history} />
          <div style={{ marginTop: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>Atual</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: fundingPos ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                {fmtPct(f.funding_rate, 4)} {fundingPos ? '▲ Longs pagam' : '▼ Shorts pagam'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>Próximo funding</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 600 }}>{nextFundHours}h</div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#0a1220', border: '1px solid #1e2d45' }}>
            <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Como interpretar o funding rate</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: '🔴', cond: '> +0.05% / 8h', result: 'Longs super-alavancados. Risco de flush.' },
                { icon: '🟢', cond: '< -0.05% / 8h', result: 'Shorts dominam. Risco de squeeze.' },
                { icon: '🟡', cond: '+0.01% a +0.05%', result: 'Mercado bullish moderado. Normal.' },
                { icon: '⚪', cond: '~0%', result: 'Equilibrado. Sem pressão extrema.' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#cbd5e1', marginBottom: 1 }}>{r.cond}</div>
                    <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ANÁLISE DERIVATIVES ──────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Análise Derivatives</div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>Sinal calculado por regras quantitativas (funding · OI delta 1D · open interest) — não por modelo de linguagem</div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Resume tudo em um sinal BULLISH / BEARISH / NEUTRAL com score 0–100. Use como confirmação final, não como único critério de decisão.
          </div>
        </div>
        <AIModuleCard module={aiAnalysis.modules.derivatives} title="Derivatives" icon="⟆" />
        <ClaudeInsight text={derivInsight} loading={derivAiLoading} />
      </div>

      {/* ── OI POR EXCHANGE ──────────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <SectionHeader title="Open Interest por Exchange" subtitle="Binance · Bybit · OKX — concentração de risco" />
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Ver onde está concentrado o risco de alavancagem. Exchange com maior OI = epicentro de liquidações se ocorrer flush.
        </div>
        {liveOi.length === 0 && <div style={{ fontSize: 12, color: '#475569', padding: '16px 0' }}>Carregando dados de OI…</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {liveOi.map((ex, i) => (
            <div key={i} style={{ background: '#0D1421', border: '1px solid #1e2d45', borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 700, marginBottom: 4 }}>{ex.exchange}</div>
              <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>${ex.oi_b.toFixed(2)}B</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{ex.share_pct.toFixed(1)}% das exchanges consultadas</div>
              <div style={{ fontSize: 9, color: '#2a3a4a', fontStyle: 'italic', marginTop: 2 }}>Var 24h: indisponível</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 10, color: '#334155' }}>
            Total (Binance + Bybit + OKX): <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>${(liveOi.reduce((s, e) => s + e.oi_b, 0)).toFixed(2)}B</span>
          </div>
          <DataTrustBadge mode="paid_required" confidence="D" source="CoinGlass" sourceUrl="https://coinglass.com/pricing" reason="Breakdown completo cross-exchange (CME, Bitget, Gate.io) + histórico 24h requer CoinGlass pago." />
        </div>
        <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', fontSize: 10, color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>🔒 CME, Bitget e Gate.io não disponíveis — dados dessas exchanges <strong style={{ color: '#f97316' }}>não são considerados</strong> nas análises de AI</span>
          <a href="https://coinglass.com/pricing" target="_blank" rel="noopener noreferrer" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Ver planos →</a>
        </div>
      </div>

      {/* ── OI RATIO + PERP vs DATED ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* OI/Market Cap Ratio */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              <Tip text="Compara o total de contratos abertos (alavancagem) com o Market Cap do BTC. Ratio alto = muita alavancagem relativa ao tamanho do mercado — condição perigosa e instável.">OI / Market Cap Ratio</Tip>
            </div>
            <DataTrustBadge mode={liveRatioPct !== null ? 'live' : 'mock'} confidence={liveRatioPct !== null ? 'B' : 'D'} source={liveRatioPct !== null ? 'Binance + CoinGecko' : 'Mock'} reason="OI Binance / Market Cap BTC via CoinGecko" />
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Ratio alto = mercado frágil e super-alavancado. Ratio baixo = base sólida para movimento sustentável.
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: displayZoneColor, letterSpacing: '-0.04em' }}>{displayRatioPct.toFixed(2)}%</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: displayZoneColor, background: `${displayZoneColor}18`, border: `1px solid ${displayZoneColor}40`, borderRadius: 5, padding: '2px 8px' }}>{displayZone}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, displayRatioPct / 2 * 100)}%`, background: 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#475569', marginBottom: 12 }}>
            <span>7d atrás: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>—</span></span>
            <span>30d atrás: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>—</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: '< 0.5%', color: '#10b981', desc: 'Baixo — mercado saudável' },
              { label: '0.5–1%', color: '#f59e0b', desc: 'Moderado — atenção' },
              { label: '1–1.5%', color: '#f97316', desc: 'Elevado — cautela' },
              { label: '> 1.5%', color: '#ef4444', desc: 'Extremo — bolha possível' },
            ].map((z, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, color: z.color, fontWeight: 600 }}>{z.label}</div>
                  <div style={{ fontSize: 9, color: '#475569' }}>{z.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Perp vs Dated split */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              <Tip text="Perpétuos (perps): sem vencimento, rolados com funding rate — usados por especuladores. Datados (trimestrais): vencem em data fixa — usados por institucionais para hedge. Mais perps = mercado especulativo e mais volátil.">Perp vs Dated Futures OI</Tip>
            </div>
            <DataTrustBadge mode={perpVsDated ? 'live' : 'mock'} confidence={perpVsDated ? 'B' : 'D'} source={perpVsDated ? 'Binance USDⓈ-M' : 'CoinGlass'} reason={perpVsDated ? 'Perp + trimestrais Binance live' : 'Cross-exchange requer CoinGlass pago'} />
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Perps &gt; 70% = mercado especulativo-retail. Datados dominando = presença institucional, hedge de longo prazo.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Perpétuos</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>${(perpVsDated?.perp_oi_b ?? 0).toFixed(1)}B</div>
              <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>{(perpVsDated?.perp_pct ?? 50).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Datados (trimestral)</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>${(perpVsDated?.dated_oi_b ?? 0).toFixed(1)}B</div>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>{(perpVsDated?.dated_pct ?? 50).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
            <div style={{ width: `${perpVsDated?.perp_pct ?? 50}%`, background: '#3b82f6' }} />
            <div style={{ flex: 1, background: '#10b981' }} />
          </div>
          {perpVsDated?.quarterly_symbols?.length > 0 && (
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>
              Contratos ativos: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{perpVsDated.quarterly_symbols.join(' · ')}</span>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginTop: 4 }}>
            {perpVsDated?.signal ?? PERP_VS_DATED_FALLBACK.signal}
          </div>
        </div>
      </div>

      {/* ── LIQUIDITY HEATMAP — PAGO / INDISPONÍVEL ──────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🔒 Liquidity Heatmap — Profundidade do Orderbook</div>
            <div style={{ fontSize: 10, color: '#475569' }}>Visualização de bids/asks por faixa de preço — muralhas de liquidez e suportes ocultos</div>
          </div>
          <DataTrustBadge mode="paid_required" confidence="D" source="CoinGlass / Hyblock" sourceUrl="https://coinglass.com/pricing" reason="Requer WebSocket de profundidade em tempo real ou API paga (CoinGlass/Hyblock)." />
        </div>
        <div style={{ padding: '28px 20px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'rgba(249,115,22,0.03)', border: '1px dashed rgba(249,115,22,0.2)' }}>
          <div style={{ fontSize: 32 }}>🔒</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textAlign: 'center' }}>Dado não disponível na versão atual</div>
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', maxWidth: 420, lineHeight: 1.7 }}>
            O Liquidity Heatmap mostraria onde estão as grandes ordens de compra e venda — identificando "muralhas" que o preço pode demorar para romper e zonas de liquidez escassa onde movimentos são mais bruscos.
            Requer <strong style={{ color: '#94a3b8' }}>WebSocket de profundidade de orderbook</strong> em tempo real.
          </div>
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 6, padding: '4px 12px' }}>
            Este dado <strong style={{ color: '#f97316' }}>não é considerado</strong> nas análises de AI desta página
          </div>
        </div>
        <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', fontSize: 10, color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>🔒 Dados simulados — requer WebSocket de profundidade ou API paga (CoinGlass / Hyblock Capital)</span>
          <a href="https://coinglass.com/pricing" target="_blank" rel="noopener noreferrer" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Ver planos →</a>
        </div>
      </div>

      {/* ── LIQUIDATION CLUSTERS ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <LiquidationHeatmap />
      </div>

      {/* ── BASIS & CARRY ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Futures Basis & Carry:</strong> Quanto os futuros trimestrais estão acima do spot? Se o basis anualizado for maior que o juro americano (US10Y), o "carry trade" é atrativo — comprar spot + vender futuro = lucro sem risco direcional.
        </div>
        <BasisPanel />
      </div>

      {/* ── LIQUIDAÇÕES FORÇADAS ─────────────────────────────────────────────── */}
      <LiquidationsPanel />

      {/* ── CROSS-VENUE MICROSTRUCTURE ───────────────────────────────────────── */}
      <MultiVenuePanel />

      {/* ── DICAS DE OURO ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar Derivatives</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Regras usadas por traders profissionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="📊"
            title="Funding > +0.05% por 8h = alarme vermelho"
            tag="FUNDING"
            body="Quando o funding rate está acima de +0.05% por período de 8h, longs estão pagando caro para manter posições. Esse custo corrói as margens até que os longs mais fracos capitulam — geralmente em cascata. Historicamente, funding acima de +0.10% precede quedas de 3–10% em questão de horas."
          />
          <TipCard
            emoji="💥"
            title="OI subindo + funding extremo = armadilha prestes a disparar"
            tag="OI SPIKE"
            body="Se o Open Interest cresceu mais de 5% em 24h E o funding está extremo, o mercado está super-alavancado. Qualquer notícia negativa pode disparar liquidações em série. Traders experientes reduzem exposição nesse cenário ou ficam de fora esperando a poeira baixar."
          />
          <TipCard
            emoji="⚖️"
            title="L/S Ratio > 1.2 = 20% mais longs que shorts"
            tag="DESEQUILÍBRIO"
            body="Quando há muito mais longs do que shorts (ratio > 1.2), o mercado está desequilibrado. Market makers adoram esse cenário — um movimento brusco para baixo elimina uma cascata de longs e recolhe os stops. Ratio > 1.5 é extremo e historicamente precede correções rápidas de 5–15%."
          />
          <TipCard
            emoji="🏦"
            title="Binance concentra 40–50% do OI global"
            tag="CONCENTRAÇÃO"
            body="A Binance é o epicentro do mercado de derivativos de BTC. Se houver problema lá (manutenção, travamento de ordens, regulação), o impacto é imediato em todo o mercado. Monitorar Bybit e OKX como alternativas e ver se os funding rates divergem — divergência > 5bps = oportunidade de arbitragem."
          />
          <TipCard
            emoji="📈"
            title="Perps > 70% do OI = mercado especulativo"
            tag="ESTRUTURA"
            body="Quando contratos perpétuos dominam (>70% do OI total), o mercado é majoritariamente especulativo — traders de varejo apostando com alavancagem. Isso amplifica volatilidade. Quando futuros datados (trimestrais) crescem sua participação, indica entrada de institucionais em hedge — sinal mais saudável e estrutural."
          />
          <TipCard
            emoji="⚡"
            title="Funding divergindo entre exchanges = oportunidade de arb"
            tag="ARBITRAGEM"
            body="Se Binance tem funding +0.03% e Bybit tem -0.02%, existe uma diferença de 5 basis points. Traders sofisticados capturam esse spread: long no mais barato (Bybit) + short no mais caro (Binance). Quando a divergência fecha, o lucro é realizado sem risco direcional. Veja a seção Cross-Venue abaixo para monitorar."
          />
          <TipCard
            emoji="🔄"
            title="Basis anualizado > US10Y = carry trade atrativo para institucionais"
            tag="CARRY TRADE"
            body="Se o futuro trimestral de BTC está com prêmio anualizado de 15% e o juro americano (US10Y) está em 4.5%, a diferença de +10.5% é 'dinheiro grátis' para quem compra BTC spot e vende o futuro — capturando o spread sem risco direcional. Fundos hedge fazem isso sistematicamente. Quando muitos fazem isso, o basis comprime."
          />
        </div>
      </div>

    </div>
  );
}

// ─── LIQUIDATIONS PANEL ────────────────────────────────────────────────────────
function LiquidationsPanel() {
  const { data: _liqState, isLoading } = useLiquidations(50);
  const liq     = _liqState?.items ?? [];
  const isError = (_liqState?.isFallback ?? false) && liq.length === 0;

  const longLiqs  = liq?.filter(l => l.side === 'SELL') ?? [];
  const shortLiqs = liq?.filter(l => l.side === 'BUY')  ?? [];
  const totalLongUsd  = longLiqs.reduce((s, l) => s + l.usd_value, 0);
  const totalShortUsd = shortLiqs.reduce((s, l) => s + l.usd_value, 0);
  const dominaSide = totalLongUsd > totalShortUsd * 1.5 ? 'longs' : totalShortUsd > totalLongUsd * 1.5 ? 'shorts' : 'equilibrado';

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <SectionHeader title="Liquidações Forçadas — BTCUSDT" subtitle="Binance Futures · últimas 50 ordens · tempo real" />
      <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Quando traders alavancados não têm mais margem para cobrir perdas, a exchange fecha a posição automaticamente — isso é uma "liquidação forçada". Volume alto de liquidações de longs = venda em pânico em cascata.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>⬇️ Longs Liquidados</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>${(totalLongUsd / 1e3).toFixed(0)}K</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{longLiqs.length} ordens · compras forçadas eliminadas</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>⬆️ Shorts Liquidados</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>${(totalShortUsd / 1e3).toFixed(0)}K</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{shortLiqs.length} ordens · vendas forçadas eliminadas</div>
        </div>
      </div>

      {liq && liq.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: dominaSide === 'longs' ? 'rgba(239,68,68,0.06)' : dominaSide === 'shorts' ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${dominaSide === 'longs' ? 'rgba(239,68,68,0.2)' : dominaSide === 'shorts' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
          <span style={{ fontSize: 10, color: dominaSide === 'longs' ? '#ef4444' : dominaSide === 'shorts' ? '#10b981' : '#f59e0b' }}>
            {dominaSide === 'longs' ? '⬇️ Longs dominam as liquidações — pressão vendedora automática no mercado' :
             dominaSide === 'shorts' ? '⬆️ Shorts dominam as liquidações — pressão compradora automática (short squeeze parcial)' :
             '⚖️ Liquidações equilibradas — sem pressão dominante no momento'}
          </span>
        </div>
      )}

      {isLoading && <div style={{ fontSize: 12, color: '#475569', padding: '12px 0' }}>Carregando liquidações…</div>}
      {isError   && <div style={{ fontSize: 12, color: '#ef4444', padding: '12px 0' }}>Erro ao carregar liquidações da Binance.</div>}
      {liq && liq.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Lado', 'Preço', 'Qtd (BTC)', 'USD', 'Tempo'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #1a2535' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liq.slice(0, 20).map((l, i) => {
                const isLong = l.side === 'SELL';
                const color  = isLong ? '#ef4444' : '#10b981';
                const label  = isLong ? 'Long ↓' : 'Short ↑';
                const ageMs  = Date.now() - l.timestamp;
                const ageFmt = ageMs < 60_000 ? `${Math.round(ageMs / 1000)}s`
                  : ageMs < 3_600_000 ? `${Math.round(ageMs / 60_000)}min`
                  : format(new Date(l.timestamp), 'HH:mm');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #0d1421' }}>
                    <td style={{ padding: '5px 8px', color, fontWeight: 700 }}>{label}</td>
                    <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>${fmtNum(l.price, 0)}</td>
                    <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{l.qty.toFixed(3)}</td>
                    <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono, monospace', color }}>
                      {l.usd_value >= 1e6 ? `$${(l.usd_value/1e6).toFixed(2)}M` : `$${(l.usd_value/1e3).toFixed(0)}K`}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#475569' }}>{ageFmt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MULTI-VENUE PANEL ─────────────────────────────────────────────────────────
function MultiVenuePanel() {
  const { data: binance } = useBtcTicker();
  const { bybit, okx, isLoading } = useMultiVenueSnapshot();

  const venues = [
    { name: 'Binance', color: '#f59e0b', mark: binance?.mark_price ?? null, funding: binance?.last_funding_rate ?? null, oi: null },
    { name: 'Bybit',   color: '#3b82f6', mark: bybit?.mark_price ?? null,   funding: bybit?.funding_rate ?? null,        oi: bybit?.open_interest_usd ?? null },
    { name: 'OKX',     color: '#10b981', mark: okx?.last_price ?? null,     funding: okx?.funding_rate ?? null,          oi: okx?.open_interest_usd ?? null },
  ];

  const rates = venues.map(v => v.funding).filter(r => r !== null);
  const fundingDivBps = rates.length >= 2
    ? ((Math.max(...rates) - Math.min(...rates)) * 100 * 100).toFixed(1)
    : null;

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <SectionHeader title="Cross-Venue Microstructure" subtitle="Binance · Bybit · OKX — comparação em tempo real" />
      <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '5px 8px', background: '#0a1220', borderRadius: 5, border: '1px solid #1a2535', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Ver se os três maiores exchanges estão sincronizados. Divergência de funding entre eles = oportunidade de arbitragem para traders sofisticados.
      </div>

      {isLoading && !bybit && !okx && <div style={{ fontSize: 12, color: '#475569', padding: '12px 0' }}>Carregando dados multi-venue…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {venues.map(v => {
          const isLive    = v.mark !== null;
          const vFresh    = isLive ? 100 : 40;
          const vComplete = [v.mark, v.funding, v.oi].filter(x => x !== null).length;
          const vComplPct = Math.round((vComplete / 3) * 100);
          return (
            <div key={v.name} style={{ background: '#0D1421', border: `1px solid ${v.color}25`, borderTop: `3px solid ${v.color}`, borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: v.color }}>{v.name}</div>
                <DataQualityBadge freshness={vFresh} completeness={vComplPct} consistency={100} fallback_active={!isLive} source={v.name} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Mark Price</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
                  {v.mark !== null ? `$${fmtNum(v.mark, 0)}` : <span style={{ color: '#334155' }}>—</span>}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Funding Rate</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: v.funding == null ? '#334155' : v.funding > 0 ? '#ef4444' : v.funding < 0 ? '#10b981' : '#94a3b8' }}>
                  {v.funding !== null ? `${(v.funding * 100).toFixed(4)}%` : <span style={{ color: '#334155' }}>—</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>OI (USD)</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                  {v.oi !== null ? `$${(v.oi / 1e9).toFixed(2)}B` : <span style={{ color: '#334155' }}>—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {fundingDivBps !== null && (
        <div style={{ padding: '8px 12px', background: parseFloat(fundingDivBps) > 5 ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)', border: `1px solid ${parseFloat(fundingDivBps) > 5 ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.15)'}`, borderRadius: 7 }}>
          <span style={{ fontSize: 10, color: parseFloat(fundingDivBps) > 5 ? '#f59e0b' : '#60a5fa' }}>
            Divergência de funding entre venues: <strong>{fundingDivBps} bps</strong>
            {parseFloat(fundingDivBps) > 5
              ? ' — Divergência elevada · possível oportunidade de arbitragem entre exchanges'
              : ' — Venues sincronizadas · mercado eficiente no momento'}
          </span>
        </div>
      )}
    </div>
  );
}

export default DerivativesOverview;
