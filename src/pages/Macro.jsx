import { macroBoard as macroBoardMock, macroHistory, fmtNum, aiAnalysis as aiAnalysisMock } from '../components/data/mockData';
import { useMacroBoard, useGlobalLiquidity } from '@/hooks/useFred';
import { useBcbData } from '@/hooks/useBcb';
import { useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useAiInsight } from '@/hooks/useAiInsight';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { IS_LIVE } from '@/lib/env';
import { DataQualityBadge } from '../components/ui/DataQualityBadge';
import { useMemo, useState } from 'react';
import { Area, AreaChart } from 'recharts';

// ─── DATA LAYER (live > mock fallback) ───────────────────────────────────────
// useMacroBoard() retorna MacroBoardData — shape idêntico ao macroBoardMock:
//   { series: MacroSeriesEntry[], updated_at: number }
function useMacroPageData() {
  const { data: live, isError: fredError } = useMacroBoard();
  const { data: liquidity } = useGlobalLiquidity();
  const { data: bcb, isLoading: bcbLoading, isError: bcbError } = useBcbData();
  const { data: fng } = useFearGreed(1);
  const { data: riskScore } = useRiskScore();
  const macroBoard = live ?? macroBoardMock;
  // isLiveMacro=true somente quando FRED retornou ao menos uma série quality 'A'.
  // fetchMacroBoard usa Promise.allSettled e retorna placeholders quality 'C' quando
  // o FRED proxy falha — live fica truthy mas os dados são zeros sem valor real.
  const isLiveMacro = IS_LIVE && !!live && live.series.some(s => s.quality === 'A');
  return { macroBoard, isLiveMacro, fredError, liquidity, bcb, bcbLoading, bcbError, fng, riskScore };
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

// Converts live series history [{date, value}] to MiniTimeChart format {1d, 1w, 1m}
// 1d = 2 pontos (ontem + hoje), 1w = 5 dias úteis, 1m = todos os pontos (~30d)
function historyToWindows(history) {
  if (!history || history.length === 0) return null;
  const pts = history.map(h => ({ t: h.date, v: h.value }));
  return { '1d': pts.slice(-2), '1w': pts.slice(-5), '1m': pts };
}

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

  const hist = s.history ? historyToWindows(s.history) : (macroHistory[s.id] ?? null);
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

/**
 * @param {{ label: string, value: string|number, sub?: string, color?: string, trend?: string, trendLabel?: string, badge?: import('react').ReactNode }} props
 */
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

      {/* Para que serve — Liquidez Global */}
      <div style={{ fontSize: 10, color: '#334155', marginBottom: 14, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> A liquidez do Fed é o "combustível" do mercado. Quando o Fed expande o balanço (QE), injeta dinheiro no sistema — bom para ativos de risco. Quando drena (QT), o dinheiro some — ruim para cripto. RRP drenando = liquidez voltando ao mercado. TGA gastando = governo injetando dinheiro na economia.
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
                  formatter={v => [`$${(Number(v) / 1000).toFixed(2)}T`, 'Net Liquidity']}
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
                  ${(Number(liq.history[liq.history.length - 1]?.[s.key] ?? 0) / 1000).toFixed(2)}T
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BR MACRO PANEL ──────────────────────────────────────────────────────────

/**
 * Retorna a cor semafórica para cada métrica BCB.
 * @param {'selic'|'ipca'|'usdbrl'} metric
 * @param {number|null} value
 */
function bcbColor(metric, value) {
  if (value === null) return '#94a3b8';
  if (metric === 'selic') {
    if (value < 12)  return '#10b981'; // verde
    if (value < 15)  return '#f59e0b'; // amarelo
    return '#ef4444';                  // vermelho
  }
  if (metric === 'ipca') {
    if (value < 0.4) return '#10b981';
    if (value < 0.7) return '#f59e0b';
    return '#ef4444';
  }
  if (metric === 'usdbrl') {
    if (value < 5.5) return '#10b981';
    if (value < 6.0) return '#f59e0b';
    return '#ef4444';
  }
  return '#94a3b8';
}

/**
 * BrMacroPanel — exibe SELIC, IPCA e USDBRL do BCB com badges de qualidade/fonte.
 * Estilo consistente com LiquidityMetricCard.
 */
function BrMacroPanel({ bcb, isLoading, isError }) {
  // Calcula DataQualityBadge props a partir do BcbData
  const freshness = bcb
    ? (Date.now() - bcb.updated_at < 3_600_000 ? 100 : 60)
    : 0;
  const nullCount = bcb
    ? [bcb.selic, bcb.ipca, bcb.usdbrl].filter(v => v === null).length
    : 3;
  const completeness = bcb ? Math.round(((3 - nullCount) / 3) * 100) : 0;
  const isMock = !bcb || bcb.source === 'mock';

  // Formata valor ou exibe "—" para null/loading/erro
  const fmt = (val, decimals = 2) => {
    if (isLoading) return '…';
    if (isError || val === null || val === undefined) return '—';
    return val.toFixed(decimals);
  };

  const metrics = [
    {
      key:    'selic',
      label:  'SELIC',
      value:  bcb?.selic ?? null,
      unit:   '% a.a.',
      sub:    'Taxa overnight referência',
      color:  bcbColor('selic', bcb?.selic ?? null),
    },
    {
      key:    'ipca',
      label:  'IPCA',
      value:  bcb?.ipca ?? null,
      unit:   '% ao mês',
      sub:    'Inflação oficial mensal',
      color:  bcbColor('ipca', bcb?.ipca ?? null),
    },
    {
      key:    'usdbrl',
      label:  'USD/BRL',
      value:  bcb?.usdbrl ?? null,
      unit:   'R$',
      sub:    'Câmbio dólar / real',
      color:  bcbColor('usdbrl', bcb?.usdbrl ?? null),
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Cabeçalho da seção */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
            Brasil — Macro BCB
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            SELIC · IPCA · USD/BRL via Banco Central do Brasil OpenData
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {bcb && (
            <DataQualityBadge
              freshness={freshness}
              completeness={completeness}
              consistency={100}
              fallback_active={isMock}
              source={bcb.source}
            />
          )}
          {/* Badge de fonte */}
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
            background: isMock ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            color:      isMock ? '#f59e0b' : '#10b981',
            border:     isMock ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(16,185,129,0.25)',
          }}>
            {isMock ? 'Mock' : 'BCB OpenData'}
          </span>
          <span style={{ fontSize: 9, color: '#334155' }}>
            SGS 11 · SGS 433 · SGS 1
          </span>
        </div>
      </div>

      {/* Para que serve — Brasil Macro */}
      <div style={{ fontSize: 10, color: '#334155', marginBottom: 14, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Contexto macro do Brasil. SELIC alta = custo de capital caro, peso nos investimentos em risco. IPCA acima de 0.5% ao mês = inflação acelerada. USD/BRL acima de R$6 = real desvalorizado. Para investidores brasileiros em BTC, câmbio alto pode compensar quedas em dólar — acompanhe os três juntos.
      </div>

      {/* Grid de cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {metrics.map(m => (
          <div
            key={m.key}
            style={{
              background: '#111827',
              border: '1px solid #1e2d45',
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: 6,
            }}>
              <div style={{
                fontSize: 10, color: '#4a5568',
                textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700,
              }}>
                {m.label}
              </div>
              {/* Indicador de qualidade por campo */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: m.color, flexShrink: 0,
                boxShadow: `0 0 5px ${m.color}80`,
              }} />
            </div>

            {/* Valor principal */}
            <div style={{
              fontSize: 26, fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
              color: m.color,
              letterSpacing: '-0.04em', lineHeight: 1.1,
            }}>
              {fmt(m.value)}
              <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 5, fontWeight: 400 }}>
                {m.unit}
              </span>
            </div>

            {/* Sub-label */}
            {m.sub && (
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                {m.sub}
              </div>
            )}

            {/* Status badge por campo */}
            {!isLoading && !isError && m.value !== null && (
              <div style={{
                marginTop: 8,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 9, fontWeight: 700,
                color: m.color,
                background: `${m.color}12`,
                border: `1px solid ${m.color}25`,
                borderRadius: 4, padding: '2px 7px',
              }}>
                {m.color === '#10b981' ? '● Saudável' : m.color === '#f59e0b' ? '● Atenção' : '● Elevado'}
              </div>
            )}

            {/* Estado de erro/loading por campo */}
            {!isLoading && (isError || m.value === null) && (
              <div style={{
                marginTop: 8,
                fontSize: 9, color: '#ef4444',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {isError ? 'Erro ao carregar' : 'Dado indisponível'}
              </div>
            )}
          </div>
        ))}
      </div>
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

export default function Macro() {
  const { macroBoard, isLiveMacro, fredError, liquidity, bcb, bcbLoading, bcbError, fng, riskScore } = useMacroPageData();
  const m = macroBoard;

  // Rule-based AI analysis from live macro data
  const liveAnalysis = IS_LIVE && fng != null
    ? computeRuleBasedAnalysis({
        macro: {
          fngValue:   fng.value,
          fngLabel:   fng.label,
          riskScore:  riskScore?.score ?? 50,
          riskRegime: riskScore?.regime ?? 'MODERADO',
        },
      })
    : null;
  const aiAnalysis = liveAnalysis ?? aiAnalysisMock;

  // Yield spread computed before payload so it can be included in Claude context
  const { yieldSpread, yieldSpreadBp, isInverted } = useMemo(() => {
    const us10y = m.series.find(s => s.id === 'US10Y');
    const us2y  = m.series.find(s => s.id === 'US2Y');
    const spread = (us10y?.value && us2y?.value)
      ? us10y.value - us2y.value
      : null;
    return {
      yieldSpread:   spread,
      yieldSpreadBp: spread !== null ? (spread * 100).toFixed(1) : null,
      isInverted:    spread !== null && spread < 0,
    };
  }, [m.series]);

  // Claude AI insight — yield spread now available
  const vixVal = m.series.find(s => s.id === 'VIX')?.value;
  const dxyVal = m.series.find(s => s.id === 'DXY')?.value;
  const spRet  = m.series.find(s => s.id === 'SP500')?.delta_1d;
  const macroPayload = fng ? {
    page: 'macro',
    riskScore: riskScore?.score ?? 50,
    riskRegime: riskScore?.regime ?? 'MODERADO',
    fearGreedValue: fng.value,
    fearGreedLabel: fng.label,
    fundingRate: 0,
    context: {
      vix: vixVal,
      dxy: dxyVal,
      spRet1d: spRet,
      yieldSpreadBp: yieldSpreadBp !== null ? parseFloat(yieldSpreadBp) : undefined,
    },
  } : null;
  const { data: macroInsight, isLoading: macroAiLoading } = useAiInsight(macroPayload);

  const deltaChartData = useMemo(() => m.series.map(s => ({
    name: s.id,
    d1:  s.format === 'yield' ? parseFloat((s.delta_1d_bp ?? 0).toFixed(1))  : parseFloat((s.delta_1d * 100).toFixed(2)),
    d1w: s.format === 'yield' ? parseFloat((s.delta_7d_bp ?? 0).toFixed(1))  : parseFloat((s.delta_7d * 100).toFixed(2)),
    d1m: s.format === 'yield' ? parseFloat((s.delta_30d_bp ?? 0).toFixed(1)) : parseFloat(((s.delta_30d ?? 0) * 100).toFixed(2)),
    label: s.format === 'yield' ? 'bp' : '%',
  })), [m.series]);

  // ── Veredicto Macro (Hawkish / Dovish / Neutro) ──────────────────────────────
  const vixScore   = (vixVal ?? 0) > 25 ? -1 : (vixVal ?? 0) < 15 ? 1 : 0;
  const dxyScore   = (dxyVal ?? 0) > 105 ? -1 : (dxyVal ?? 0) < 98 ? 1 : 0;
  const curveScore = isInverted ? -1 : (yieldSpread !== null && yieldSpread > 0.5) ? 1 : 0;
  const riskScoreV = (riskScore?.score ?? 50) > 65 ? 1 : (riskScore?.score ?? 50) < 35 ? -1 : 0;
  const macroTotalScore = vixScore + dxyScore + curveScore + riskScoreV;

  const macroVerdict = macroTotalScore >= 2
    ? {
        label: 'AMBIENTE DOVISH',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.08)',
        border: 'rgba(16,185,129,0.3)',
        icon: '🕊️',
        text: 'O ambiente macro está favorável ao risco. VIX baixo, curva positiva e dólar fraco suportam ativos de risco como cripto e ações.',
      }
    : macroTotalScore <= -2
    ? {
        label: 'AMBIENTE HAWKISH',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.3)',
        icon: '🦅',
        text: 'O ambiente macro está restritivo. VIX elevado, dólar forte ou curva invertida aumentam o risco de recessão e pressionam ativos de risco.',
      }
    : {
        label: 'AMBIENTE NEUTRO',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.3)',
        icon: '⚖️',
        text: 'O macro está misto. Alguns indicadores apontam para expansão, outros para contração. Cautela é recomendada — evite apostas direcionais fortes.',
      };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Macro Board
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: '#4a5568', margin: 0 }}>
            FRED Daily Data · {IS_LIVE ? `Updated ${new Date(m.updated_at).toLocaleDateString('pt-BR')}` : 'Dados de demonstração'} ·
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

      {/* ── O QUE É ESTA PÁGINA ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>🌍</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              <strong style={{ color: '#cbd5e1' }}>Macro Board</strong> monitora os indicadores macroeconômicos globais que ditam o humor do mercado financeiro — e, por consequência, do Bitcoin e ativos de risco.{' '}
              <strong style={{ color: '#3b82f6' }}>Use esta página para responder:</strong>{' '}
              "O mundo está em modo 'apetite por risco' (comprar) ou 'fuga para segurança' (vender)?" — Quando o Fed aperta, o dólar sobe e o VIX dispara, cripto tende a sofrer. Quando a política é expansionista e os juros caem, o ambiente favorece a alta.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '📉', text: 'Entender se o Fed está apertando ou afrouxando a política monetária' },
                { icon: '💵', text: 'Ver se o dólar forte está pressionando ativos emergentes e cripto' },
                { icon: '⚡', text: 'Detectar inversão da curva de juros — histórico sinal de recessão' },
                { icon: '🇧🇷', text: 'Acompanhar SELIC, IPCA e USD/BRL para o contexto brasileiro' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Banner de fallback mock quando FRED está indisponível em modo live */}
      {IS_LIVE && !isLiveMacro && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#92400e',
        }}>
          <span>⚠️</span>
          <span>
            <strong style={{ color: '#f59e0b' }}>FRED API indisponível</strong>
            {fredError ? ' — erro na requisição.' : ' — sem resposta.'}{' '}
            Exibindo dados de demonstração. Os valores abaixo não refletem o mercado atual.
          </span>
        </div>
      )}

      {/* Regra de Ouro */}
      <GoldenRule compact />

      {/* ── VEREDICTO MACRO ─────────────────────────────────────────────────────── */}
      <div style={{
        background: macroVerdict.bg, border: `1px solid ${macroVerdict.border}`,
        borderRadius: 14, padding: '20px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{macroVerdict.icon}</div>
          <div>
            <div style={{ fontSize: 10, color: macroVerdict.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Panorama Macro Atual</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: macroVerdict.color, letterSpacing: '-0.02em', marginBottom: 4 }}>{macroVerdict.label}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 460 }}>{macroVerdict.text}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>VIX</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: (vixVal ?? 0) > 25 ? '#ef4444' : '#10b981' }}>
              {vixVal != null ? vixVal.toFixed(1) : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>DXY</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: (dxyVal ?? 0) > 105 ? '#ef4444' : '#10b981' }}>
              {dxyVal != null ? dxyVal.toFixed(1) : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Curva</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: isInverted ? '#ef4444' : '#10b981' }}>
              {yieldSpreadBp !== null ? `${yieldSpread >= 0 ? '+' : ''}${yieldSpreadBp}bp` : '—'}
            </div>
          </div>
        </div>
      </div>

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
            {yieldSpreadBp !== null
              ? `Yield Curve (10Y−2Y): ${yieldSpread >= 0 ? '+' : ''}${yieldSpreadBp}bp`
              : 'Yield Curve: dados insuficientes'}
          </div>
          <div style={{ fontSize: 11, color: '#8899a6', marginTop: 2 }}>
            {yieldSpreadBp === null
              ? 'US10Y ou US2Y indisponível no momento'
              : isInverted
              ? 'Curva invertida — historicamente associada a risco de recessão nos EUA'
              : `Spread positivo — curva ${parseFloat(yieldSpreadBp) < 50 ? 'achatada (atenção)' : 'normal (saudável)'}`}
          </div>
        </div>
      </div>

      {/* Para que serve — Yield Curve */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#334155', padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> A curva de juros compara o rendimento dos títulos de 10 anos vs. 2 anos do Tesouro americano. Quando o juro curto supera o longo (invertida = negativo), bancos param de emprestar e a economia desacelera. É o indicador de recessão mais testado da história — antecedeu todas as recessões americanas desde 1970.
        </div>
      </div>

      {/* Series grid */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          <Tip text="SP500 = saúde da bolsa americana. DXY = força do dólar. Gold = ativo de proteção. VIX = 'índice do medo' do mercado. US10Y/US2Y = juros do Tesouro americano.">
            Indicadores Macro Globais
          </Tip>
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Monitorar os 6 termômetros do mercado global. VIX acima de 25 = pânico. DXY subindo = dólar forte pressiona cripto. Gold subindo = fuga de risco. SP500 caindo + VIX subindo = risk-off — ambiente desfavorável para BTC.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {m.series.map(s => <SeriesCard key={s.id} s={s} />)}
      </div>

      {/* Analysis */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Análise Macro</div>
        <div style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>Sinal calculado por regras de threshold (yields · DXY · VIX · risco) — não por modelo de linguagem. Claude Haiku exibido abaixo quando configurado.</div>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Resume todos os sinais macro em um único veredito (BULLISH/BEARISH/NEUTRAL) com score 0–100. Use como confirmação final do contexto macro antes de tomar decisões de entrada ou saída.
        </div>
        <AIModuleCard module={aiAnalysis.modules.macro} title="Macro Board" icon="⊞" />
        <ClaudeInsight text={macroInsight} loading={macroAiLoading} />
      </div>

      {/* Macro Heatmap — Correlações */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
            <Tip text="Correlação mede como dois ativos se movem juntos. +1 = sempre na mesma direção. -1 = sempre em direções opostas. 0 = sem relação.">
              Heatmap de Correlações Macro
            </Tip>
          </div>
          <div style={{ fontSize: 10, color: '#334155', padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Visualizar como os ativos macro se relacionam entre si. BTC com correlação alta ao SP500 = ele se comporta como ativo de risco. BTC com correlação negativa ao DXY = dólar forte machuca BTC. Use para entender quais forças macro estão guiando o mercado agora.
          </div>
        </div>
        <MacroHeatmap />
      </div>

      {/* Delta comparison chart — 1D / 1W / 1M */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Comparar a variação de todos os ativos macro no mesmo gráfico. Se VIX subiu muito e SP500 caiu muito na mesma semana, o ambiente é de fuga de risco. Se Gold subiu e DXY caiu, o Fed pode estar suavizando o discurso.
        </div>
        <SectionHeader title="Deltas 1D / 1W / 1M — Macro Cross" subtitle="Variação normalizada por série · % para preços · bp para yields" />
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
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#0d1421', fontSize: 10, color: '#64748b' }}>
          💡 <strong style={{ color: '#94a3b8' }}>Como ler:</strong> Barras azuis = variação diária. Roxo = semanal. Ciano = mensal. VIX e DXY positivos são sinais negativos para risco. SP500 e Gold positivos são sinais positivos. Compare os timeframes para ver se há tendência ou apenas ruído pontual.
        </div>
      </div>

      {/* Liquidez Global — Fed BS / RRP / TGA / Real Yield / Term Premium / DXY */}
      <GlobalLiquiditySection liq={liquidity} />

      {/* Brasil — Macro BCB: SELIC / IPCA / USDBRL */}
      <BrMacroPanel bcb={bcb} isLoading={bcbLoading} isError={bcbError} />

      {/* ── DICAS DE OURO ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar o Macro Board</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Regras usadas por analistas macro profissionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="📉"
            title="Curva de juros invertida = alerta de recessão"
            tag="YIELD CURVE"
            body="Quando o juro de 2 anos supera o de 10 anos (spread negativo), os bancos param de emprestar porque não conseguem lucrar com o descasamento de prazos. Isso provoca crédito mais caro, redução de investimentos e, eventualmente, recessão. Historicamente, a inversão precede recessões em 12–18 meses. Quando a curva 'desinverte' (volta a ser positiva), pode indicar que a recessão já começou — não que o perigo passou."
          />
          <TipCard
            emoji="🏦"
            title="Fed Balance Sheet encolhendo = menos dinheiro no sistema"
            tag="LIQUIDEZ"
            body="O Fed cria dinheiro comprando títulos (QE) e destrói dinheiro vendendo (QT — Quantitative Tightening). O Net Liquidity (Fed BS − RRP − TGA) é o proxy mais usado: acima de $6T tende a ser bullish para risco. Abaixo de $5T tende a ser bearish. Quando o RRP drena (cai), significa que esse dinheiro vai para o mercado — positivo para cripto e ações."
          />
          <TipCard
            emoji="💵"
            title="DXY forte = veneno para BTC e emergentes"
            tag="DÓLAR"
            body="O Bitcoin é cotado em dólares. Quando o dólar fica mais forte (DXY sobe), o mesmo BTC custa 'mais caro' em dólares para quem tem outras moedas — o que reduz a demanda global. Além disso, DXY forte significa que capital está fugindo de ativos de risco para o dólar como 'porto seguro'. DXY acima de 105 historicamente pressiona BTC. DXY abaixo de 98 tende a criar vento favorável."
          />
          <TipCard
            emoji="😱"
            title="VIX acima de 25 = mercado em pânico — oportunidade ou armadilha?"
            tag="VIX"
            body="O VIX mede o quanto o mercado está pagando por proteção contra quedas (opções de venda no SP500). Acima de 25 significa medo elevado — geralmente coincide com quedas fortes. Acima de 40 é pânico extremo, que historicamente marca fundos de mercado (2020, 2022). Abaixo de 15 significa complacência — mercado relaxado, pode ser bom para risco, mas cuidado: complacência também precede crashes. A regra é: VIX alto = oportunidade de compra paciente. VIX baixo = não abaixe a guarda."
          />
          <TipCard
            emoji="🥇"
            title="Gold subindo com SP500 caindo = fuga de risco total"
            tag="GOLD"
            body="Ouro é o ativo de proteção mais antigo do mundo. Quando investidores ficam com medo, saem de ações e cripto e compram ouro. Se SP500 cai e ouro sobe ao mesmo tempo, o sinal é claro: o dinheiro grande está em modo defensivo. Já quando ouro sobe junto com ações, pode indicar inflação alta ou desvalorização do dólar — não necessariamente fuga de risco."
          />
          <TipCard
            emoji="🇧🇷"
            title="SELIC alta + Real fraco = duplo obstáculo para cripto no Brasil"
            tag="BRASIL"
            body="Com SELIC em dois dígitos, aplicações de renda fixa brasileiras pagam retornos elevados e seguros. Isso reduz o incentivo do investidor brasileiro de se expor a ativos de risco como cripto. Adicionalmente, USD/BRL acima de R$6 significa que cada dólar de BTC custa mais reais — eleva a barreira de entrada. A combinação SELIC alta + câmbio alto é o cenário mais desafiador para adoção de cripto no Brasil."
          />
          <TipCard
            emoji="⚖️"
            title="Real Yield acima de 2% = concorrência perigosa para BTC"
            tag="REAL YIELD"
            body="O Real Yield 10Y (TIPS) mostra quanto o Tesouro americano paga acima da inflação. Quando está acima de 2%, títulos americanos se tornam extremamente atrativos comparados a qualquer ativo de risco: pagam bem e com segurança. Historicamente, BTC sofre quando o Real Yield sobe acima de 2% porque o dinheiro institucional prefere o 'retorno seguro'. Abaixo de 1% é o ambiente ideal para ativos especulativos."
          />
          <TipCard
            emoji="🔄"
            title="Como usar o Macro Board na prática"
            tag="SÍNTESE"
            body="Não use um indicador isolado. Leia o quadro completo: (1) VIX está controlado? (2) DXY está fraco ou estável? (3) Curva de juros está positiva? (4) Fed está expandindo ou contraindo liquidez? (5) SP500 está em tendência de alta? Se a maioria responder 'sim', o macro está favorável — use como vento favorável na sua análise de BTC. Se a maioria for 'não', o macro está contra você — reduza tamanho de posição e aumente cautela."
          />
        </div>
      </div>
    </div>
  );
}