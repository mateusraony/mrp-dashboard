import { macroBoard as macroBoardMock, macroHistory, fmtNum, aiAnalysis } from '../components/data/mockData';
import { useMacroBoard, useGlobalLiquidity } from '@/hooks/useFred';
import { DataQualityBadge } from '../components/ui/DataQualityBadge';
import {
  LineChart, Line, Area, AreaChart,
} from 'recharts';

// ─── DATA LAYER (live > mock fallback) ───────────────────────────────────────
// useMacroBoard() retorna MacroBoardData — shape idêntico ao macroBoardMock:
//   { series: MacroSeriesEntry[], updated_at: number }
function useMacroPageData() {
  const { data: live } = useMacroBoard();
  const { data: liquidity } = useGlobalLiquidity();
  const macroBoard = live ?? macroBoardMock;
  return { macroBoard, liquidity };
}
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import GoldenRule from '../components/ui/GoldenRule';
import SectionHeader from '../components/ui/SectionHeader';
import MacroHeatmap from '../components/dashboard/MacroHeatmap';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import MiniTimeChart from '../components/dashboard/MiniTimeChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts';

function SeriesCard({ s }) {
  const isYield = s.format === 'yield';
  const d1Color = s.delta_1d >= 0 ? '#10b981' : '#ef4444';
  const d7Color = s.delta_7d >= 0 ? '#10b981' : '#ef4444';
  const d1Val = isYield ? `${s.delta_1d_bp >= 0 ? '+' : ''}${s.delta_1d_bp.toFixed(1)}bp` : `${s.delta_1d >= 0 ? '+' : ''}${(s.delta_1d * 100).toFixed(2)}%`;
  const d7Val = isYield ? `${s.delta_7d_bp >= 0 ? '+' : ''}${s.delta_7d_bp.toFixed(1)}bp` : `${s.delta_7d >= 0 ? '+' : ''}${(s.delta_7d * 100).toFixed(2)}%`;

  // inverted: VIX e DXY são "ruins" quando sobem (para BTC)
  const isInverted = s.id === 'VIX' || s.id === 'DXY';
  const accentColor = isInverted
    ? (s.delta_1d >= 0 ? '#ef4444' : '#10b981')
    : (s.delta_1d >= 0 ? '#10b981' : '#ef4444');

  const hist = macroHistory[s.id];
  const fmtVal = (v) => isYield ? `${v.toFixed(3)}%` : fmtNum(v, s.id === 'VIX' || s.id === 'DXY' ? 2 : 0);

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 4 }}>{s.icon} {s.name}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', letterSpacing: '-0.03em' }}>
            {isYield ? s.value.toFixed(3) : fmtNum(s.value, s.id === 'VIX' || s.id === 'DXY' ? 2 : 0)}
            <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 4 }}>{s.unit}</span>
          </div>
        </div>
        <GradeBadge grade={s.quality} />
      </div>

      {/* MiniTimeChart com 1D/1W/1M */}
      {hist && (
        <MiniTimeChart
          data={hist}
          color={accentColor}
          height={65}
          inverted={isInverted}
          formatter={fmtVal}
        />
      )}

      {/* Deltas */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>Δ 1D</div>
          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: d1Color, fontWeight: 600 }}>{d1Val}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>Δ 1W</div>
          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: d7Color, fontWeight: 600 }}>{d7Val}</div>
        </div>
        {s.delta_30d !== undefined && (
          <div>
            <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>Δ 1M</div>
            <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: (isYield ? s.delta_30d_bp : s.delta_30d) >= 0 ? '#10b981' : '#ef4444' }}>
              {isYield ? `${s.delta_30d_bp >= 0 ? '+' : ''}${s.delta_30d_bp.toFixed(1)}bp` : `${s.delta_30d >= 0 ? '+' : ''}${(s.delta_30d * 100).toFixed(2)}%`}
            </div>
          </div>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>FRED</div>
          <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f' }}>{s.series_id}</div>
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL LIQUIDITY SECTION ────────────────────────────────────────────────

function LiquidityMetricCard({ label, value, sub, color = '#e2e8f0', trend, trendLabel, badge }) {
  const trendColor = trend === 'draining' || trend === 'spending'
    ? '#10b981' // drenagem de RRP/TGA = bullish para liquidez
    : trend === 'adding' || trend === 'building'
    ? '#ef4444'
    : '#f59e0b';

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
          {label}
        </div>
        {badge}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{sub}</div>
      )}
      {trend && (
        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700,
          color: trendColor, background: `${trendColor}12`, border: `1px solid ${trendColor}25`, borderRadius: 4, padding: '2px 7px' }}>
          {trend === 'draining' ? '↓ Drenando' : trend === 'adding' ? '↑ Adicionando' : trend === 'spending' ? '↓ Gastando' : trend === 'building' ? '↑ Acumulando' : '→ Estável'}
          {trendLabel && <span style={{ fontWeight: 400, opacity: 0.7 }}> · {trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

function GlobalLiquiditySection({ liq }) {
  if (!liq) return null;

  const netColor = liq.net_liquidity > 6_500 ? '#10b981' : liq.net_liquidity > 5_500 ? '#f59e0b' : '#ef4444';
  const chgColor = liq.fed_balance_chg_4w >= 0 ? '#10b981' : '#ef4444';

  // Badge de qualidade: dados FRED são atualizados diariamente; freshness~60 = <24h
  const qualityBadge = (
    <DataQualityBadge
      freshness={Date.now() - liq.updated_at < 3_600_000 ? 100 : 60}
      completeness={100}
      consistency={100}
      fallback_active={false}
      source="FRED"
    />
  );

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Cabeçalho da seção */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
            Liquidez Global
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            Fed Balance Sheet · RRP · TGA · Real Yield · Term Premium · Dollar Index
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <DataQualityBadge freshness={60} completeness={100} consistency={100} fallback_active={false} source="FRED" />
          <span style={{ fontSize: 9, color: '#334155' }}>
            WALCL · RRPONTSYD · WTREGEN · DFII10 · THREEFYTP10 · DTWEXBGS
          </span>
        </div>
      </div>

      {/* Sinal de liquidez líquida */}
      <div style={{
        marginBottom: 14, padding: '12px 16px', borderRadius: 10,
        background: `${netColor}0a`, border: `1px solid ${netColor}25`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: netColor, marginTop: 3, flexShrink: 0, boxShadow: `0 0 6px ${netColor}80` }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
            Net Liquidity: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: netColor }}>${(liq.net_liquidity / 1000).toFixed(2)}T</span>
            <span style={{ fontSize: 9, color: '#475569', marginLeft: 8, fontWeight: 400 }}>Fed BS − RRP − TGA</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>{liq.net_liquidity_signal}</div>
        </div>
      </div>

      {/* Grid principal de cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
        {/* Fed Balance Sheet */}
        <LiquidityMetricCard
          label="Fed Balance Sheet"
          value={`$${(liq.fed_balance_b / 1000).toFixed(2)}T`}
          sub={`Δ 4 semanas: ${liq.fed_balance_chg_4w >= 0 ? '+' : ''}$${liq.fed_balance_chg_4w.toFixed(0)}B`}
          color={chgColor}
          badge={qualityBadge}
        />

        {/* Net Liquidity */}
        <LiquidityMetricCard
          label="Net Liquidity (Fed−RRP−TGA)"
          value={`$${(liq.net_liquidity / 1000).toFixed(2)}T`}
          sub="Proxy de liquidez líquida do sistema"
          color={netColor}
        />

        {/* Reverse Repo (RRP) */}
        <LiquidityMetricCard
          label="Reverse Repo (RRP)"
          value={`$${liq.rrp_b.toFixed(0)}B`}
          sub="Overnight RRP Facility"
          color={liq.rrp_trend === 'draining' ? '#10b981' : '#ef4444'}
          trend={liq.rrp_trend}
          trendLabel="vs 4 semanas"
        />

        {/* Treasury General Account */}
        <LiquidityMetricCard
          label="Treasury Gen. Account"
          value={`$${liq.tga_b.toFixed(0)}B`}
          sub="Conta corrente do Tesouro"
          color={liq.tga_trend === 'spending' ? '#10b981' : '#f59e0b'}
          trend={liq.tga_trend}
          trendLabel="vs 4 semanas"
        />

        {/* Real Yield 10Y */}
        <LiquidityMetricCard
          label="Real Yield 10Y (TIPS)"
          value={`${liq.real_yield_10y.toFixed(2)}%`}
          sub="DFII10 — yield real ajustado à inflação"
          color={liq.real_yield_10y > 2 ? '#ef4444' : liq.real_yield_10y > 1 ? '#f59e0b' : '#10b981'}
        />

        {/* Term Premium */}
        <LiquidityMetricCard
          label="Term Premium 10Y"
          value={`${liq.term_premium_10y >= 0 ? '+' : ''}${liq.term_premium_10y.toFixed(2)}%`}
          sub="ACM model (THREEFYTP10)"
          color={liq.term_premium_10y < 0 ? '#10b981' : '#f59e0b'}
        />

        {/* Dollar Index */}
        <LiquidityMetricCard
          label="Dollar Index (Broad)"
          value={liq.dollar_index.toFixed(2)}
          sub="DTWEXBGS — trade-weighted USD"
          color={liq.dollar_index > 108 ? '#ef4444' : liq.dollar_index > 102 ? '#f59e0b' : '#10b981'}
        />
      </div>

      {/* Gráfico de Net Liquidity histórico */}
      {liq.history && liq.history.length > 0 && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>
            Net Liquidity Histórico (Fed − RRP − TGA)
          </div>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liq.history} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="netLiqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={netColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={netColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#4a5568' }}
                  tickLine={false}
                  interval={Math.floor(liq.history.length / 5)}
                  tickFormatter={d => d.slice(5)} // MM-DD
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#4a5568' }}
                  tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(1)}T`}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 10 }}
                  formatter={v => [`$${(v / 1000).toFixed(2)}T`, 'Net Liquidity']}
                />
                <Area
                  type="monotone"
                  dataKey="net_b"
                  stroke={netColor}
                  strokeWidth={1.5}
                  fill="url(#netLiqGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: netColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'fed_b', label: 'Fed BS', color: '#3b82f6' },
              { key: 'rrp_b', label: 'RRP',    color: '#ef4444' },
              { key: 'tga_b', label: 'TGA',    color: '#f59e0b' },
            ].map(s => (
              <span key={s.key} style={{ fontSize: 9, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 2, background: s.color, borderRadius: 1, display: 'inline-block' }} />
                {s.label}: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: s.color }}>
                  ${(liq.history[liq.history.length - 1]?.[s.key] / 1000).toFixed(2)}T
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Macro() {
  const { macroBoard, liquidity } = useMacroPageData();
  const m = macroBoard;
  const yieldSpread = m.series.find(s => s.id === 'US10Y').value - m.series.find(s => s.id === 'US2Y').value;
  const yieldSpreadBp = (yieldSpread * 100).toFixed(1);
  const isInverted = yieldSpread < 0;

  const deltaChartData = m.series.map(s => ({
    name: s.id,
    d1:  s.format === 'yield' ? parseFloat(s.delta_1d_bp.toFixed(1))   : parseFloat((s.delta_1d * 100).toFixed(2)),
    d1w: s.format === 'yield' ? parseFloat(s.delta_7d_bp.toFixed(1))   : parseFloat((s.delta_7d * 100).toFixed(2)),
    d1m: s.format === 'yield' ? parseFloat(s.delta_30d_bp !== undefined ? s.delta_30d_bp.toFixed(1) : '0') : parseFloat((s.delta_30d !== undefined ? s.delta_30d * 100 : 0).toFixed(2)),
    label: s.format === 'yield' ? 'bp' : '%',
  }));

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Macro Board
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: '#4a5568', margin: 0 }}>
            FRED Daily Data · Updated {new Date(m.updated_at).toLocaleDateString('pt-BR')} ·
          </p>
          <ModeBadge />
          <div style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            ⚠️ Dados diários — não intraday
          </div>
        </div>
      </div>

      {/* Regra de Ouro */}
      <GoldenRule compact />

      {/* Yield spread alert */}
      <div style={{
        marginBottom: 20, padding: '12px 16px', borderRadius: 10,
        background: isInverted ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
        border: `1px solid ${isInverted ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18 }}>{isInverted ? '🔴' : '🟢'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            Yield Curve (10Y−2Y): {yieldSpread >= 0 ? '+' : ''}{yieldSpreadBp}bp
          </div>
          <div style={{ fontSize: 11, color: '#8899a6', marginTop: 2 }}>
            {isInverted
              ? 'Inverted yield curve — historically associated with recession risk'
              : `Positive spread — ${parseFloat(yieldSpreadBp) < 50 ? 'Flattening' : 'Normal'} curve`}
          </div>
        </div>
      </div>

      {/* Series grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {m.series.map(s => <SeriesCard key={s.id} s={s} />)}
      </div>

      {/* AI Analysis */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🤖 AI Analysis — Macro</div>
        <AIModuleCard module={aiAnalysis.modules.macro} title="Macro Board" icon="⊞" />
      </div>

      {/* Macro Heatmap — Correlações */}
      <div style={{ marginBottom: 20 }}>
        <MacroHeatmap />
      </div>

      {/* Delta comparison chart — 1D / 1W / 1M */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <SectionHeader title="Deltas 1D / 1W / 1M — Macro Cross" subtitle="Normalized per series" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={deltaChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8899a6' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, n, p) => { const n2 = Number(v); return [`${n2 > 0 ? '+' : ''}${n2} ${p.payload.label}`, n === 'd1' ? 'Δ 1D' : n === 'd1w' ? 'Δ 1W' : 'Δ 1M']; }}
            />
            <Legend formatter={v => v === 'd1' ? 'Δ 1D' : v === 'd1w' ? 'Δ 1W' : 'Δ 1M'} wrapperStyle={{ fontSize: 10, color: '#8899a6' }} />
            <ReferenceLine y={0} stroke="#2a3f5f" />
            <Bar dataKey="d1" radius={[2,2,0,0]} fill="#3b82f6" opacity={0.9} />
            <Bar dataKey="d1w" radius={[2,2,0,0]} fill="#8b5cf6" opacity={0.7} />
            <Bar dataKey="d1m" radius={[2,2,0,0]} fill="#06b6d4" opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Liquidez Global — Fed BS / RRP / TGA / Real Yield / Term Premium / DXY */}
      <GlobalLiquiditySection liq={liquidity} />
    </div>
  );
}