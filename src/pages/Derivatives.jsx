import {
  btcFutures, liquidityBins,
  oiByExchange as oiByExchangeMock,
  fmtNum, fmtPct, aiAnalysis as aiAnalysisMock,
} from '../components/data/mockData';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { useBtcTicker, useOiByExchange, useLiquidations } from '@/hooks/useBtcData';
import { useMultiVenueSnapshot } from '@/hooks/useMultiVenue';
import { DataQualityBadge } from '../components/ui/DataQualityBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { IS_LIVE } from '@/lib/env';

// ─── DATA LAYER (live > mock fallback) ───────────────────────────────────────
// oiByExchange live → mapeia oi_usd para oi_b (shape do mock) para compatibilidade do UI
function useDerivativesData() {
  const { data: ticker } = useBtcTicker();
  const { data: oiExch } = useOiByExchange();

  const liveBtcFutures = ticker
    ? { ...btcFutures, mark_price: ticker.mark_price, funding_rate: ticker.last_funding_rate, oi_delta_pct: ticker.oi_delta_pct, open_interest: ticker.open_interest }
    : btcFutures;

  // Converter oi_usd (live) → oi_b (mock shape em bilhões BTC) para o UI
  const oiByExchange = oiExch
    ? oiExch.map(e => ({ ...e, oi_b: e.oi_usd / 1e9, change_24h: 0 }))
    : oiByExchangeMock;

  return { btcFutures: liveBtcFutures, oiByExchange };
}
import { oiRatio, perpVsDatedOI } from '../components/data/mockDataExtended';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge } from '../components/ui/DataBadge';
import LiquidationHeatmap from '../components/derivatives/LiquidationHeatmap';
import BasisPanel from '../components/derivatives/BasisPanel';
import { BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

const COLORS = {
  positive: '#10b981', negative: '#ef4444', neutral: '#f59e0b',
  blue: '#3b82f6', purple: '#8b5cf6',
};

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
        <div style={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: color, transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

function FundingChart({ data }) {
  const chartData = data.map(d => ({
    time: format(new Date(d.fundingTime), 'MMM d HH:mm'),
    rate: parseFloat((d.fundingRate * 100).toFixed(4)),
  }));
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false}
          interval={Math.floor(chartData.length / 5)} />
        <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
          formatter={(v) => [Number(v).toFixed(4) + '%', 'Funding']}
        />
        <ReferenceLine y={0} stroke="#2a3f5f" />
        <Bar dataKey="rate" radius={[2,2,0,0]}
          fill={COLORS.positive}
          label={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LiquidityHeatmap({ bins }) {
  const maxVal = Math.max(...bins.map(b => Math.max(b.bid_notional, b.ask_notional)));
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#10b981' }}>■ Bids</span>
        <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 8 }}>■ Asks</span>
      </div>
      {bins.map((bin, i) => {
        const bidPct = (bin.bid_notional / maxVal) * 100;
        const askPct = (bin.ask_notional / maxVal) * 100;
        return (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 3 }}>{bin.label}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Bids bar (right-aligned) */}
              <div style={{ flex: 1, height: 12, borderRadius: 2, background: '#1e2d45', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  width: `${bidPct}%`, height: '100%',
                  background: `rgba(16,185,129,${0.3 + bidPct/100 * 0.7})`,
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#4a5568', width: 70, textAlign: 'center' }}>
                {(bin.bid_notional / 1e6).toFixed(1)}M / {(bin.ask_notional / 1e6).toFixed(1)}M
              </span>
              {/* Asks bar */}
              <div style={{ flex: 1, height: 12, borderRadius: 2, background: '#1e2d45', overflow: 'hidden' }}>
                <div style={{
                  width: `${askPct}%`, height: '100%',
                  background: `rgba(239,68,68,${0.3 + askPct/100 * 0.7})`,
                  borderRadius: 2,
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DerivativesOverview() {
  const { btcFutures: liveBtc, oiByExchange: liveOi } = useDerivativesData();
  const f = liveBtc; // use live data if available

  // Rule-based AI analysis from live ticker
  const liveAnalysis = IS_LIVE && liveBtc.mark_price !== btcFutures.mark_price
    ? computeRuleBasedAnalysis({ derivatives: { fundingRate: liveBtc.funding_rate, oiDeltaPct: liveBtc.oi_delta_pct, openInterest: liveBtc.open_interest } })
    : null;
  const aiAnalysis = liveAnalysis ?? aiAnalysisMock;
  const fundingPos = f.funding_rate > 0;
  const nextFundHours = Math.round((f.next_funding_time.getTime() - Date.now()) / 3600000);

  const riskColor = f.risk_score > 75 ? COLORS.negative : f.risk_score > 50 ? COLORS.neutral : COLORS.positive;
  const directionLabel = f.risk_direction === 'long_flush' ? '⬇️ Long Flush' : '⬆️ Short Squeeze';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          BTC Derivatives
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* Top metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Mark Price', value: `$${fmtNum(f.mark_price, 0)}`, color: '#e2e8f0' },
          { label: 'Index Price', value: `$${fmtNum(f.index_price, 0)}`, sub: `Spread: ${((f.mark_price - f.index_price)/f.index_price*10000).toFixed(1)}bp`, color: '#e2e8f0' },
          { label: 'Funding Atual', value: fmtPct(f.funding_rate, 4), color: fundingPos ? '#ef4444' : '#10b981', sub: `Next in ${nextFundHours}h` },
          { label: 'Funding 7D avg', value: fmtPct(f.funding_avg_7d, 4), color: f.funding_avg_7d > 0.0005 ? '#f59e0b' : '#8899a6' },
          { label: 'Funding 30D avg', value: fmtPct(f.funding_avg_30d, 4), color: '#8899a6' },
          { label: 'Open Interest', value: `$${(f.open_interest_usdt/1e9).toFixed(2)}B`, color: '#e2e8f0' },
          { label: 'L/S Ratio', value: f.long_short_ratio.toFixed(2), color: f.long_short_ratio > 1 ? '#10b981' : '#ef4444', sub: 'Global accounts' },
          { label: 'Top Trader L/S', value: f.top_trader_ls.toFixed(2), color: f.top_trader_ls > 1 ? '#60a5fa' : '#a78bfa' },
        ].map((m, i) => (
          <div key={i} style={{
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: m.color }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* OI multi-período */}
      <div style={{
        background: '#111827', border: '1px solid #1e2d45',
        borderRadius: 12, padding: 16, marginBottom: 16,
        display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          OI Delta
        </div>
        {[
          { label: '1D', value: f.oi_delta_pct, color: f.oi_delta_pct > 1.5 ? '#f59e0b' : '#10b981' },
          { label: '1W', value: f.oi_delta_pct_1w, color: f.oi_delta_pct_1w > 10 ? '#f59e0b' : '#10b981' },
          { label: '1M', value: f.oi_delta_pct_1m, color: f.oi_delta_pct_1m > 20 ? '#ef4444' : '#f59e0b' },
        ].map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#2a3f5f' }}>{d.label}</span>
            <span style={{
              fontSize: 20, fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
              color: d.color,
            }}>
              {d.value > 0 ? '+' : ''}{d.value.toFixed(2)}%
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#4a5568' }}>
          OI Abs: <span style={{ color: '#8899a6', fontFamily: 'JetBrains Mono, monospace' }}>${(f.open_interest_usdt/1e9).toFixed(2)}B</span>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Risk score */}
        <div style={{
          background: '#111827', border: `1px solid rgba(${f.risk_score > 75 ? '239,68,68' : '245,158,11'},0.3)`,
          borderRadius: 12, padding: 20,
        }}>
          <SectionHeader title="Proxy Flush/Squeeze Risk" subtitle="BTC — Computed" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 52, fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
                color: riskColor, letterSpacing: '-0.04em', lineHeight: 1,
              }}>{f.risk_score}</div>
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>/ 100</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, marginBottom: 8,
                padding: '4px 10px', borderRadius: 6,
                background: `rgba(${f.risk_score > 75 ? '239,68,68' : '245,158,11'},0.1)`,
                color: riskColor,
                display: 'inline-block',
              }}>
                {directionLabel}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%)', marginBottom: 12 }}>
                <div style={{
                  position: 'relative',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#4a5568' }}>
                {f.risk_direction === 'long_flush' ?
                  'Funding positivo + longs sobrecarregados → risco elevado de flush (liquidação em cascata)' :
                  'Funding negativo + shorts sobrecarregados → risco de squeeze (compra forçada)'}
              </div>
            </div>
          </div>
          <div>
            <FactorBar label="Funding Extreme" value={f.risk_factors.funding_extreme} />
            <FactorBar label="OI Spike" value={f.risk_factors.oi_spike} />
            <FactorBar label="Vol Spike" value={f.risk_factors.vol_spike} />
            <FactorBar label="Crowding" value={f.risk_factors.crowding} />
            <FactorBar label="Return Magnitude" value={f.risk_factors.ret_mag} />
          </div>
        </div>

        {/* Funding History */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader title="Funding Rate History" subtitle="8h intervals · last 30 periods" />
          <FundingChart data={f.funding_history} />
          <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>Current</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: fundingPos ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                {fmtPct(f.funding_rate, 4)} {fundingPos ? '▲ Longs pay' : '▼ Shorts pay'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>Next funding</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 600 }}>
                {nextFundHours}h
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🤖 AI Analysis — Derivatives</div>
        <AIModuleCard module={aiAnalysis.modules.derivatives} title="Derivatives" icon="⟆" />
      </div>

      {/* OI por Exchange */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <SectionHeader title="Open Interest por Exchange" subtitle="Concentração de risco — BTC Perps + Futuros" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {liveOi.map((ex, i) => {
            const c = ex.change_24h >= 0 ? '#10b981' : '#ef4444';
            return (
              <div key={i} style={{ background: '#0D1421', border: '1px solid #1e2d45', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 700, marginBottom: 4 }}>{ex.exchange}</div>
                <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
                  ${ex.oi_b.toFixed(2)}B
                </div>
                <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                  {ex.share_pct.toFixed(1)}% do total
                </div>
                <div style={{ fontSize: 10, color: c, fontWeight: 600 }}>
                  {ex.change_24h >= 0 ? '+' : ''}{ex.change_24h.toFixed(1)}% 24h
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: '#334155' }}>
          Total global: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>${(liveOi.reduce((s, e) => s + e.oi_b, 0)).toFixed(2)}B</span>
          {' '}· CME = institucional tradicional (0 alavancagem retail)
        </div>
      </div>

      {/* Liquidity heatmap - orderbook */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <SectionHeader
          title="Liquidity Heatmap — Orderbook"
          subtitle="Profundidade do book de futuros por distância do mid price"
        />
        <LiquidityHeatmap bins={liquidityBins} />
        <div style={{ marginTop: 12, fontSize: 10, color: '#4a5568', fontStyle: 'italic' }}>
          Bids vs Asks em USD. Barras maiores = parede de liquidez mais profunda. Principais bids:{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>
            $83.000 ($11,3M) · $83.500 ($7,5M)
          </span>
          . Principais asks:{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>
            $86.000 ($16,7M) · $85.500 ($9,5M)
          </span>
        </div>
      </div>

      {/* OI Ratio + Perp vs Dated */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* OI/Market Cap Ratio */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>OI / Market Cap Ratio</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', letterSpacing: '-0.04em' }}>
              {oiRatio.ratio_pct.toFixed(2)}%
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 5, padding: '2px 8px' }}>
              {oiRatio.zone}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, oiRatio.ratio_pct / 2 * 100)}%`, background: 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#475569', marginBottom: 10 }}>
            <span>7d atrás: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{oiRatio.prev_7d_ratio.toFixed(2)}%</span></span>
            <span>30d atrás: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{oiRatio.prev_30d_ratio.toFixed(2)}%</span></span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>{oiRatio.signal}</div>
        </div>

        {/* Perp vs Dated split */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Perp vs Dated Futures OI</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Perpétuos</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>
                ${perpVsDatedOI.perp_oi_b.toFixed(1)}B
              </div>
              <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>{perpVsDatedOI.perp_pct.toFixed(1)}% do total</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Datados (incl. CME)</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
                ${perpVsDatedOI.dated_oi_b.toFixed(1)}B
              </div>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>{perpVsDatedOI.dated_pct.toFixed(1)}% do total</div>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
            <div style={{ width: `${perpVsDatedOI.perp_pct}%`, background: '#3b82f6' }} />
            <div style={{ flex: 1, background: '#10b981' }} />
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>
            CME (institucional): <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>${perpVsDatedOI.cme_oi_b.toFixed(2)}B ({perpVsDatedOI.cme_pct_of_dated.toFixed(1)}% dos datados)</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginTop: 8 }}>{perpVsDatedOI.signal}</div>
        </div>
      </div>

      {/* Liquidation Clusters */}
      <div style={{ marginBottom: 16 }}>
        <LiquidationHeatmap />
      </div>

      {/* Basis & Carry */}
      <BasisPanel />

      {/* Liquidações Forçadas — Sprint 5.3 */}
      <LiquidationsPanel />

      {/* Cross-Venue Microstructure — Sprint 5.5 */}
      <MultiVenuePanel />
    </div>
  );
}
// ─── LIQUIDATIONS PANEL (Sprint 5.3) ─────────────────────────────────────────
function LiquidationsPanel() {
  const { data: liq, isLoading, isError } = useLiquidations(50);

  // Calcular totais
  const longLiqs  = liq?.filter(l => l.side === 'SELL') ?? [];  // SELL = long foi liquidado
  const shortLiqs = liq?.filter(l => l.side === 'BUY')  ?? [];  // BUY  = short foi liquidado
  const totalLongUsd  = longLiqs.reduce((s, l) => s + l.usd_value, 0);
  const totalShortUsd = shortLiqs.reduce((s, l) => s + l.usd_value, 0);

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <SectionHeader title="Liquidações Forçadas — BTCUSDT" subtitle="Binance Futures · últimas 50 ordens · tempo real" />

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Longs Liquidados</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>
            ${(totalLongUsd / 1e3).toFixed(0)}K
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{longLiqs.length} ordens</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Shorts Liquidados</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
            ${(totalShortUsd / 1e3).toFixed(0)}K
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{shortLiqs.length} ordens</div>
        </div>
      </div>

      {/* Tabela */}
      {isLoading && <div style={{ fontSize: 12, color: '#475569', padding: '12px 0' }}>Carregando liquidações...</div>}
      {isError  && <div style={{ fontSize: 12, color: '#ef4444', padding: '12px 0' }}>Erro ao carregar liquidações da Binance.</div>}
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
                const isLong = l.side === 'SELL'; // SELL = long liquidado
                const color  = isLong ? '#ef4444' : '#10b981';
                const label  = isLong ? 'Long ↓' : 'Short ↑';
                const ageMs  = Date.now() - l.timestamp;
                const ageFmt = ageMs < 60_000
                  ? `${Math.round(ageMs / 1000)}s atrás`
                  : ageMs < 3_600_000
                    ? `${Math.round(ageMs / 60_000)}min atrás`
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

// ─── MULTI-VENUE PANEL (Sprint 5.5) ──────────────────────────────────────────
function MultiVenuePanel() {
  const { data: binance } = useBtcTicker();
  const { bybit, okx, isLoading } = useMultiVenueSnapshot();

  // Montar tabela de 3 venues
  const venues = [
    {
      name: 'Binance',
      color: '#f59e0b',
      mark: binance?.mark_price ?? null,
      funding: binance?.last_funding_rate ?? null,
      oi: null,  // OI Binance está no useOiByExchange separado — usar null por ora
    },
    {
      name: 'Bybit',
      color: '#3b82f6',
      mark: bybit?.mark_price ?? null,
      funding: bybit?.funding_rate ?? null,
      oi: bybit?.open_interest_usd ?? null,
    },
    {
      name: 'OKX',
      color: '#10b981',
      mark: okx?.last_price ?? null,
      funding: okx?.funding_rate ?? null,
      oi: okx?.open_interest_usd ?? null,
    },
  ];

  // Divergência de funding: range entre max e min das três venues
  const rates = venues.map(v => v.funding).filter(r => r !== null);
  const fundingDivBps = rates.length >= 2
    ? ((Math.max(...rates) - Math.min(...rates)) * 100 * 100).toFixed(1)
    : null;

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <SectionHeader title="Cross-Venue Microstructure" subtitle="Binance · Bybit · OKX — Funding · Mark Price · OI" />
      {isLoading && !bybit && !okx && (
        <div style={{ fontSize: 12, color: '#475569', padding: '12px 0' }}>Carregando dados multi-venue...</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {venues.map(v => {
          // Score de qualidade por venue: live se tem mark price, fallback se null
          const isLive    = v.mark !== null;
          const vFresh    = isLive ? 100 : 40;
          const vComplete = [v.mark, v.funding, v.oi].filter(x => x !== null).length;
          const vComplPct = Math.round((vComplete / 3) * 100);

          return (
            <div key={v.name} style={{ background: '#0D1421', border: `1px solid ${v.color}25`, borderTop: `3px solid ${v.color}`, borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: v.color, letterSpacing: '0.04em' }}>{v.name}</div>
                <DataQualityBadge
                  freshness={vFresh}
                  completeness={vComplPct}
                  consistency={100}
                  fallback_active={!isLive}
                  source={v.name}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Mark Price</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
                  {v.mark !== null ? `$${fmtNum(v.mark, 0)}` : <span style={{ color: '#334155' }}>—</span>}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Funding Rate</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: v.funding > 0 ? '#ef4444' : v.funding < 0 ? '#10b981' : '#94a3b8' }}>
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

      {/* Funding divergence signal */}
      {fundingDivBps !== null && (
        <div style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 7 }}>
          <span style={{ fontSize: 10, color: '#60a5fa' }}>
            Divergência de funding entre venues: <strong>{fundingDivBps} bps</strong>
            {parseFloat(fundingDivBps) > 5
              ? ' — Divergência elevada · possível oportunidade de arbitragem'
              : ' — Venues sincronizadas'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Wrapper com tab Avançado ─────────────────────────────────────────────────
// Re-export como default com tabs (Overview + Avançado)
