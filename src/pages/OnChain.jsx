// ─── ON-CHAIN AVANÇADO ────────────────────────────────────────────────────────
// NUPL · SOPR · Exchange Netflow · Whale Activity · Realized Price / MVRV
// Hash Rate · Dificuldade · Mempool
import {
  btcNUPL, btcSOPR, btcExchangeNetflow, btcWhaleActivity,
  btcRealizedMetrics, btcHashRate, onChain, fmtNum,
} from '../components/data/mockData';
import { useOnChainAdvanced, useMempoolState, useHashrate } from '@/hooks/useMempool';
import { useOnChainCycle, useOnChainExtended } from '@/hooks/useCoinMetrics';
import { IS_LIVE } from '@/lib/env';
import { DataQualityBadge } from '../components/ui/DataQualityBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';

// ─── DATA LAYER (live > mock fallback) ───────────────────────────────────────
function useOnChainLiveData() {
  const { data: cycle }    = useOnChainCycle();     // MVRV Z-Score, NUPL, Realized Price
  const { data: mempool }  = useMempoolState();     // fees + mempool state live
  const { data: hashrate } = useHashrate();         // hashrate live
  const { data: extended } = useOnChainExtended();  // CDD, HODL Waves, Dormancy
  useOnChainAdvanced();                             // NUPL/SOPR/Netflow — mantém cache (mock quality B)
  return { cycle, mempool, hashrate, extended };
}
import MiniTimeChart from '../components/dashboard/MiniTimeChart';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { HelpIcon } from '../components/ui/Tooltip';
import LthSthCard from '../components/onchain/LthSthCard';
import {
  BarChart, Bar,
  AreaChart, Area,
  ComposedChart, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import HodlWavesPanel from '../components/onchain/HodlWavesPanel';

// ─── GLOSSÁRIO ────────────────────────────────────────────────────────────────
const G = {
  nupl: {
    title: 'NUPL — Net Unrealized Profit/Loss',
    content: 'Diferença entre o lucro e o prejuízo não realizado de todas as moedas em circulação, normalizado pelo market cap. Zonas: Capitulação (<0), Esperança (0–0.25), Otimismo/Crença (0.25–0.5), Entusiasmo/Ganância (0.5–0.75), Euforia (>0.75). Fonte: Glassnode.',
  },
  sopr: {
    title: 'SOPR — Spent Output Profit Ratio',
    content: 'Razão entre o preço de venda e o preço de compra original das moedas movimentadas. >1 = holders vendendo em lucro (pressão vendedora). <1 = vendendo em prejuízo (capitulação). 1.0 = ponto de equilíbrio crítico.',
  },
  netflow: {
    title: 'Exchange Netflow (BTC)',
    content: 'Diferença entre BTC entrando e saindo de exchanges. Negativo (saída líquida) = holders movendo para cold wallets = sinal de acumulação. Positivo (entrada líquida) = preparação para venda = pressão vendedora.',
  },
  whale: {
    title: 'Transações de Baleias (Whale Transactions)',
    content: 'Contagem de transações on-chain acima de $1M e $10M em USD. Picos acima da média 7d indicam maior atividade institucional/baleia — podem sinalizar acumulação ou distribuição dependendo do contexto.',
  },
  mvrv: {
    title: 'MVRV Ratio — Market Value / Realized Value',
    content: 'Razão entre o valor de mercado atual e o Realized Value (custo médio de todas as moedas). <1 = mercado subvalorizado (fundo histórico). 1–2.5 = zona de acumulação/neutro. 2.5–3.7 = mercado caro. >3.7 = zona de euforia/topo histórico.',
  },
  realizedPrice: {
    title: 'Realized Price (Preço Realizado)',
    content: 'Preço médio de compra de todas as moedas BTC em circulação — calculado pelo último preço de cada moeda no momento da última transação. Funciona como suporte/resistência psicológico de longo prazo. Abaixo do Realized Price = mercado em prejuízo agregado.',
  },
  hashrate: {
    title: 'Hash Rate (EH/s)',
    content: 'Poder computacional total da rede Bitcoin em exahashes por segundo. Hash Rate crescendo = mais mineradores operando = maior segurança da rede. Queda brusca pode indicar desligamento massivo de mineradores.',
  },
  difficulty: {
    title: 'Dificuldade de Mineração',
    content: 'Ajusta automaticamente a cada ~2 semanas para manter o tempo médio de bloco em ~10 minutos. Aumento de dificuldade = rede mais segura e mineradores investindo mais capital.',
  },
  cdd: {
    title: 'CDD — Coin Days Destroyed',
    content: 'Cada moeda BTC acumula "dias de moeda" por cada dia que permanece sem ser movimentada. Quando a moeda é movimentada, esses dias são "destruídos" (CDD). CDD alto = moedas antigas sendo movimentadas em grande escala, possível sinal de distribuição. CDD baixo = holders em repouso, acumulação silenciosa. Z-Score normaliza pelo histórico dos últimos 90 dias.',
  },
  hodlWave: {
    title: 'HODL Wave 1yr+ — Supply Dormente',
    content: 'Percentual do supply circulante de BTC que não foi movimentado nos últimos 12 meses ou mais. Aumento progressivo = fase de acumulação (holders comprando e guardando). Queda rápida = distribuição (coins velhas sendo vendidas). Fonte: CoinMetrics Community (SplyAdr1yrPlus).',
  },
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

function OnChainCard({ title, glossKey, accent = '#3b82f6', grade, trustBadge = null, children }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45',
      borderTop: `3px solid ${accent}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
          {title}
          {glossKey && <HelpIcon title={G[glossKey].title} content={G[glossKey].content} width={300} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {trustBadge}
          {grade && <GradeBadge grade={grade} />}
        </div>
      </div>
      {children}
    </div>
  );
}

function InterpretBox({ text, color = '#64748b' }) {
  return (
    <div style={{
      marginTop: 10, padding: '8px 10px', borderRadius: 7,
      background: 'rgba(30,45,69,0.4)', border: '1px solid #1e2d45',
      fontSize: 10, color, lineHeight: 1.6,
    }}>
      {text}
    </div>
  );
}

// Zonas do NUPL
const NUPL_ZONES = [
  { min: -1,  max: 0,    label: 'Capitulação', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { min: 0,   max: 0.25, label: 'Esperança',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { min: 0.25,max: 0.5,  label: 'Crença',      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { min: 0.5, max: 0.75, label: 'Ganância',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { min: 0.75,max: 1,    label: 'Euforia',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
];

function NuplZoneBar({ value }) {
  const zone = NUPL_ZONES.find(z => value >= z.min && value < z.max) || NUPL_ZONES[2];
  const pct = ((value + 1) / 2) * 100; // mapeia -1..1 → 0..100%
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4,
        background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 25%, #10b981 37.5%, #10b981 62.5%, #f59e0b 75%, #ef4444 100%)' }}>
        <div style={{
          position: 'absolute', top: -2, left: `${pct}%`,
          transform: 'translateX(-50%)',
          width: 6, height: 14, borderRadius: 3, background: '#fff',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
        <span>Capitulação</span><span>Esperança</span><span>Crença</span><span>Ganância</span><span>Euforia</span>
      </div>
    </div>
  );
}

// ─── NUPL CARD ────────────────────────────────────────────────────────────────
function NuplCard({ liveCycle }) {
  const n = btcNUPL;
  // CoinMetrics Community fornece NUPL como proxy: (MCap−RCap)/MCap
  const nuplValue = liveCycle?.nupl      ?? n.value;
  const nuplZone  = liveCycle?.nupl_zone ?? n.zone;
  const nuplColor = liveCycle?.nupl_zone_color ?? n.zone_color;
  const isLive    = IS_LIVE && liveCycle != null;
  return (
    <OnChainCard title="NUPL" glossKey="nupl" accent={nuplColor} grade={isLive ? 'B' : n.quality}
      trustBadge={
        isLive
          ? <DataTrustBadge mode="estimated" confidence="B" source="CoinMetrics Community"
              reason="Proxy via (MCap−RCap)/MCap — não é o NUPL oficial Glassnode mas correlação >0.97"
              updatedAt={liveCycle.updated_at} />
          : <DataTrustBadge mode="paid_required" confidence="D" source="Glassnode"
              sourceUrl="https://glassnode.com"
              reason="NUPL/SOPR/Netflow/Whales requerem Glassnode (~$29/mês). Exibindo dados de demonstração." />
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: nuplColor, letterSpacing: '-0.04em' }}>
          {nuplValue.toFixed(3)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: nuplColor, background: `${nuplColor}18`, border: `1px solid ${nuplColor}30`, borderRadius: 5, padding: '2px 8px' }}>
          {nuplZone}
        </span>
      </div>
      <NuplZoneBar value={nuplValue} />
      <MiniTimeChart data={n.history} color={nuplColor} height={65} formatter={v => v.toFixed(3)} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: n.delta_7d >= 0 ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono, monospace', background: `${n.delta_7d >= 0 ? '#10b981' : '#ef4444'}12`, border: `1px solid ${n.delta_7d >= 0 ? '#10b981' : '#ef4444'}25`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
          {n.delta_7d >= 0 ? '+' : ''}{n.delta_7d.toFixed(3)} 7d
        </span>
        <span style={{ fontSize: 10, color: n.delta_30d >= 0 ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono, monospace', background: `${n.delta_30d >= 0 ? '#10b981' : '#ef4444'}12`, border: `1px solid ${n.delta_30d >= 0 ? '#10b981' : '#ef4444'}25`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
          {n.delta_30d >= 0 ? '+' : ''}{n.delta_30d.toFixed(3)} 30d
        </span>
      </div>
      <InterpretBox text={n.interpretation} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── SOPR CARD ────────────────────────────────────────────────────────────────
function SoprCard() {
  const s = btcSOPR;
  const isProfit = s.value > 1;
  const color = s.value > 1.05 ? '#f59e0b' : s.value > 1 ? '#10b981' : '#ef4444';
  return (
    <OnChainCard title="SOPR" glossKey="sopr" accent={color} grade={s.quality}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.04em' }}>
          {s.value.toFixed(3)}
        </span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>
          {isProfit ? '▲ Realizando lucro' : '▼ Realizando prejuízo'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>
        Média suavizada 7d: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{s.smoothed_7d.toFixed(3)}</span>
      </div>
      {/* Barra com linha de equilíbrio em 1.0 */}
      <div style={{ height: 6, borderRadius: 3, background: '#1a2535', position: 'relative', overflow: 'visible', marginBottom: 10 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, ((s.value - 0.8) / 0.5) * 100)}%`, background: color }} />
        <div style={{ position: 'absolute', top: -4, left: `${((1.0 - 0.8) / 0.5) * 100}%`, width: 2, height: 14, background: '#475569', borderRadius: 1 }} />
      </div>
      <MiniTimeChart data={s.history} color={color} height={65} formatter={v => v.toFixed(4)} refValue={1} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: s.delta_7d >= 0 ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono, monospace', background: `${s.delta_7d >= 0 ? '#10b981' : '#ef4444'}12`, border: `1px solid ${s.delta_7d >= 0 ? '#10b981' : '#ef4444'}25`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
          {s.delta_7d >= 0 ? '+' : ''}{s.delta_7d.toFixed(4)} 7d
        </span>
      </div>
      <InterpretBox text={s.interpretation} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── EXCHANGE NETFLOW ─────────────────────────────────────────────────────────
function NetflowCard() {
  const n = btcExchangeNetflow;
  const isOutflow = n.netflow_24h < 0;
  const color = isOutflow ? '#10b981' : '#ef4444';
  return (
    <OnChainCard title="Exchange Netflow" glossKey="netflow" accent={color} grade={n.quality}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Netflow 24h</div>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>
            {n.netflow_24h > 0 ? '+' : ''}{fmtNum(n.netflow_24h, 0)}
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>BTC</span>
          </span>
          <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 2 }}>
            {isOutflow ? '↓ Saída — Acumulação' : '↑ Entrada — Pressão vendedora'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reservas em Exchanges</div>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {(n.exchange_reserves / 1e6).toFixed(2)}M BTC
          </span>
          <div style={{ fontSize: 10, color: n.reserves_delta_30d_pct < 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
            {n.reserves_delta_30d_pct.toFixed(2)}% em 30d
          </div>
        </div>
      </div>
      <MiniTimeChart data={n.history} color={color} height={65} formatter={v => `${v > 0 ? '+' : ''}${fmtNum(v, 0)} BTC`} refValue={0} />
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>7d: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: n.netflow_7d < 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{n.netflow_7d > 0 ? '+' : ''}{fmtNum(n.netflow_7d, 0)}</span></span>
        <span style={{ fontSize: 10, color: '#64748b' }}>30d: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: n.netflow_30d < 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{n.netflow_30d > 0 ? '+' : ''}{fmtNum(n.netflow_30d, 0)}</span></span>
      </div>
      <InterpretBox text={n.signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── WHALE ACTIVITY ───────────────────────────────────────────────────────────
function WhaleCard() {
  const w = btcWhaleActivity;
  const isElevated = w.delta_1m_vs_avg > 10;
  const color = isElevated ? '#a78bfa' : '#60a5fa';
  const chartData = w.history_1m.map((d, i) => ({ t: d.t, v1m: d.v, v10m: w.history_10m[i]?.v }));
  return (
    <OnChainCard title="Whale Transactions 24h" glossKey="whale" accent={color} grade={w.quality}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Txs &gt; $1M</div>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>
            {fmtNum(w.txs_over_1m_24h, 0)}
          </span>
          <div style={{ fontSize: 10, color: w.delta_1m_vs_avg >= 0 ? '#a78bfa' : '#64748b', fontWeight: 600 }}>
            {w.delta_1m_vs_avg >= 0 ? '+' : ''}{w.delta_1m_vs_avg.toFixed(1)}% vs média 7d
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Txs &gt; $10M</div>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#8b5cf6' }}>
            {fmtNum(w.txs_over_10m_24h, 0)}
          </span>
          <div style={{ fontSize: 10, color: w.delta_10m_vs_avg >= 0 ? '#8b5cf6' : '#64748b', fontWeight: 600 }}>
            {w.delta_10m_vs_avg >= 0 ? '+' : ''}{w.delta_10m_vs_avg.toFixed(1)}% vs média 7d
          </div>
        </div>
      </div>
      {/* Bar chart 24h */}
      <ResponsiveContainer width="100%" height={70}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
          <XAxis dataKey="t" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 10 }}
            formatter={(v, name) => [fmtNum(v, 0), name === 'v1m' ? '>$1M' : '>$10M']}
          />
          <Bar dataKey="v1m" fill={`${color}50`} radius={[1, 1, 0, 0]} />
          <Bar dataKey="v10m" fill={`#8b5cf680`} radius={[1, 1, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <InterpretBox text={w.signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── REALIZED PRICE / MVRV ───────────────────────────────────────────────────
function MvrvCard({ liveCycle }) {
  // live via CoinMetrics Community API (grátis, qualidade A) se disponível
  const mvrv      = liveCycle?.mvrv_current    ?? btcRealizedMetrics.mvrv_ratio;
  const mvrvZ     = liveCycle?.mvrv_zscore     ?? btcRealizedMetrics.mvrv_zscore;
  const rPrice    = liveCycle?.realized_price  ?? btcRealizedMetrics.realized_price;
  const cPrice    = liveCycle?.current_price   ?? btcRealizedMetrics.current_price;
  const zone      = liveCycle?.mvrv_zone       ?? btcRealizedMetrics.mvrv_zone;
  const color     = liveCycle?.mvrv_zone_color ?? btcRealizedMetrics.mvrv_zone_color;
  const grade     = liveCycle?.quality         ?? 'B';
  const distPct   = rPrice > 0 ? ((cPrice - rPrice) / rPrice * 100) : 0;
  const rDelta30d = btcRealizedMetrics.realized_price_delta_30d;
  return (
    <OnChainCard title="Realized Price · MVRV" glossKey="mvrv" accent={color} grade={grade}
      trustBadge={
        <DataTrustBadge
          mode={IS_LIVE ? (liveCycle ? 'estimated' : 'mock') : 'mock'}
          confidence={IS_LIVE && liveCycle ? 'B' : 'D'}
          source="CoinMetrics"
          sourceUrl="https://community-api.coinmetrics.io/v4"
          updatedAt={liveCycle?.updated_at}
          reason={
            !liveCycle && IS_LIVE
              ? 'CoinMetrics não disponível — exibindo fallback mock'
              : 'NUPL derivado de (MCap−RCap)/MCap — proxy, não fórmula oficial Glassnode'
          }
        />
      }
    >
      {liveCycle && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <DataQualityBadge
            freshness={liveCycle.updated_at && Date.now() - liveCycle.updated_at < 3_600_000 ? 100 : 60}
            completeness={100}
            consistency={100}
            fallback_active={false}
            source="CoinMetrics"
          />
          <span style={{ fontSize: 9, color: '#475569' }}>Community · Grátis</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Realized Price
            <HelpIcon title={G.realizedPrice.title} content={G.realizedPrice.content} width={280} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9' }}>
            ${fmtNum(rPrice, 0)}
          </span>
          <div style={{ fontSize: 10, color: distPct >= 0 ? '#10b981' : '#ef4444', fontWeight: 600, marginTop: 1 }}>
            Spot {distPct >= 0 ? '+' : ''}{distPct.toFixed(1)}% {distPct >= 0 ? 'acima' : 'abaixo'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>MVRV Ratio</div>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.04em' }}>
            {mvrv.toFixed(2)}×
          </span>
          <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>
            {zone}
          </div>
        </div>
      </div>

      {/* MVRV scale */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 0, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
          {[
            { label: '<1', w: '20%', c: '#3b82f6' },
            { label: '1–2.5', w: '37.5%', c: '#10b981' },
            { label: '2.5–3.7', w: '24%', c: '#f59e0b' },
            { label: '>3.7', w: '18.5%', c: '#ef4444' },
          ].map((z, i) => (
            <div key={i} style={{ width: z.w, background: z.c, opacity: 0.7 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
          <span>Fundo (&lt;1)</span><span>Neutro (1–2.5)</span><span>Caro (2.5–3.7)</span><span>Euforia (&gt;3.7)</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>Z-Score: <span style={{ fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 700 }}>{mvrvZ.toFixed(2)}</span></span>
        <span style={{ fontSize: 10, color: '#64748b' }}>Realized +{rDelta30d.toFixed(1)}% em 30d</span>
      </div>
      <InterpretBox text={btcRealizedMetrics.interpretation} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── HASH RATE ────────────────────────────────────────────────────────────────
function HashRateCard({ liveHashrate }) {
  // live via Mempool.space (grátis, qualidade A) se disponível; fallback para mock
  const currentEh     = liveHashrate?.current_eh      ?? btcHashRate.hash_rate_eh;
  const d7            = liveHashrate?.delta_7d_pct     ?? btcHashRate.delta_7d_pct;
  const d30           = liveHashrate?.delta_30d_pct    ?? btcHashRate.delta_30d_pct;
  const difficulty    = liveHashrate?.difficulty       ?? btcHashRate.difficulty;
  const diffAdj       = liveHashrate?.diff_adj_pct     ?? btcHashRate.difficulty_adj_pct;
  const nextAdjPct    = liveHashrate?.next_adj_est_pct ?? btcHashRate.next_adj_est_pct;
  const nextAdjBlocks = liveHashrate?.next_adj_blocks  ?? btcHashRate.next_adj_blocks;
  const grade         = liveHashrate ? 'A' : btcHashRate.quality;

  // Converter history live para formato MiniTimeChart { '1d', '1w', '1m' }
  const history = liveHashrate
    ? (() => {
        const pts = liveHashrate.history.map(h => ({ t: h.timestamp, v: h.eh }));
        return { '1d': pts.slice(-2), '1w': pts.slice(-7), '1m': pts.slice(-30) };
      })()
    : btcHashRate.history;

  const isGrowing = d7 > 0;
  const color = isGrowing ? '#10b981' : '#ef4444';
  return (
    <OnChainCard title="Hash Rate & Dificuldade" glossKey="hashrate" accent={color} grade={grade}>
      {liveHashrate && (
        <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Mempool.space · Grátis · Qualidade A
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hash Rate</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>
            {currentEh.toFixed(1)}<span style={{ fontSize: 11, color: '#64748b' }}>EH/s</span>
          </span>
          <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>
            {isGrowing ? '+' : ''}{d7.toFixed(2)}% 7d · {d30.toFixed(1)}% 30d
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Dificuldade (adj.)
            <HelpIcon title={G.difficulty.title} content={G.difficulty.content} width={280} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {(difficulty / 1e12).toFixed(1)}T
          </span>
          <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 1 }}>
            Último adj.: {diffAdj >= 0 ? '+' : ''}{diffAdj.toFixed(1)}%
          </div>
        </div>
      </div>
      <MiniTimeChart data={history} color={color} height={65} formatter={v => `${v.toFixed(1)} EH/s`} />
      <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(59,130,246,0.06)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)' }}>
        <span style={{ fontSize: 10, color: '#60a5fa' }}>
          Próximo ajuste estimado: <strong>{nextAdjPct >= 0 ? '+' : ''}{nextAdjPct.toFixed(1)}%</strong> — {nextAdjBlocks.toLocaleString()} blocos
        </span>
      </div>
      <InterpretBox text={btcHashRate.signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── MEMPOOL CARD ─────────────────────────────────────────────────────────────
function MempoolCard({ liveMempool }) {
  // live via Mempool.space (grátis, qualidade A) se disponível; fallback para mock
  const txCount  = liveMempool?.tx_count    ?? onChain.mempool.count;
  const vsizeB   = liveMempool?.vsize_bytes  ?? onChain.mempool.vsize;
  const grade    = liveMempool ? 'A' : onChain.quality;
  const fees = {
    fastest:   liveMempool?.fees.fastest_fee   ?? onChain.fees.fastestFee,
    halfHour:  liveMempool?.fees.half_hour_fee ?? onChain.fees.halfHourFee,
    hour:      liveMempool?.fees.hour_fee      ?? onChain.fees.hourFee,
    economy:   liveMempool?.fees.economy_fee   ?? onChain.fees.economyFee,
  };
  const feeItems = [
    { label: 'Prioridade Máxima', val: fees.fastest,  unit: 'sat/vB', color: '#ef4444' },
    { label: '~30 min',           val: fees.halfHour, unit: 'sat/vB', color: '#f59e0b' },
    { label: '~1 hora',           val: fees.hour,     unit: 'sat/vB', color: '#10b981' },
    { label: 'Econômica',         val: fees.economy,  unit: 'sat/vB', color: '#64748b' },
  ];
  return (
    <OnChainCard title="Mempool BTC" glossKey={null} accent="#8b5cf6" grade={grade}>
      {liveMempool && (
        <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Mempool.space · Grátis · Qualidade A
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Tx não confirmadas</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa' }}>
            {txCount.toLocaleString()}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Tamanho</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#8b5cf6' }}>
            {(vsizeB / 1e6).toFixed(1)}<span style={{ fontSize: 11, color: '#64748b' }}>MB</span>
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {feeItems.map((f, i) => (
          <div key={i} style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px', border: '1px solid #1a2535' }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>{f.label}</div>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: f.color }}>
              {f.val}
            </span>
            <span style={{ fontSize: 9, color: '#334155', marginLeft: 3 }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
        Fonte: mempool.space · Grade: {grade}
      </div>
    </OnChainCard>
  );
}

// ─── CDD CARD ─────────────────────────────────────────────────────────────────
function CddCard({ liveExtended }) {
  const cdd       = liveExtended?.cdd_current   ?? 8_000_000;
  const ma30      = liveExtended?.cdd_ma30       ?? 7_500_000;
  const zScore    = liveExtended?.cdd_z_score    ?? 0.3;
  const signal    = liveExtended?.cdd_signal     ?? 'Dados não disponíveis — exibindo estimativa mock.';
  const grade     = liveExtended?.quality        ?? 'B';

  // Cor baseada no z-score: azul (baixo) → verde (neutro) → amarelo → vermelho (alto)
  const zColor = zScore > 2 ? '#ef4444' : zScore > 1 ? '#f59e0b' : zScore > 0 ? '#10b981' : '#3b82f6';

  // Escala da barra: -2 a +3 (faixa típica de CDD z-score)
  const barMin   = -2;
  const barMax   = 3;
  const barPct   = Math.min(100, Math.max(0, ((zScore - barMin) / (barMax - barMin)) * 100));
  const neutralPct = ((0 - barMin) / (barMax - barMin)) * 100;

  // Formata CDD em milhões para exibição compacta
  const fmtCdd = (v) => v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : fmtNum(v, 0);

  // Prepara dados para MiniTimeChart: mapeia history_cdd → formato {1d, 1w, 1m}
  const pts = (liveExtended?.history_cdd ?? []).map(d => ({ t: d.date, v: d.value }));
  const chartData = pts.length > 0
    ? { '1d': pts.slice(-2), '1w': pts.slice(-7), '1m': pts }
    : { '1d': [], '1w': [], '1m': [] };

  return (
    <OnChainCard title="CDD — Coin Days Destroyed" glossKey="cdd" accent={zColor} grade={grade}>
      {liveExtended && (
        <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          CoinMetrics Community · Grátis · Qualidade A
        </div>
      )}

      {/* Valores principais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CDD Atual</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: zColor }}>
            {fmtCdd(cdd)}
          </span>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
            MA30: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{fmtCdd(ma30)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Z-Score (90d)</div>
          <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: zColor, letterSpacing: '-0.04em' }}>
            {zScore >= 0 ? '+' : ''}{zScore.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Barra de z-score com linha de zero */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4,
          background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 40%, #f59e0b 65%, #ef4444 100%)' }}>
          {/* Marcador posição atual */}
          <div style={{
            position: 'absolute', top: -2, left: `${barPct}%`,
            transform: 'translateX(-50%)',
            width: 6, height: 12, borderRadius: 3, background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          }} />
          {/* Linha zero */}
          <div style={{
            position: 'absolute', top: 0, left: `${neutralPct}%`,
            width: 1, height: '100%', background: 'rgba(255,255,255,0.4)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
          <span>Baixo (-2)</span><span>Neutro (0)</span><span>Alto (+3)</span>
        </div>
      </div>

      {/* Mini chart de histórico CDD */}
      {pts.length > 0 && (
        <MiniTimeChart
          data={chartData}
          color={zColor}
          height={65}
          formatter={v => fmtCdd(v)}
        />
      )}

      {/* CDD 30d vs MA30 — ComposedChart (barras + linha MA30) */}
      {(liveExtended?.history_cdd ?? []).length > 0 && (() => {
        // Últimos 30 pontos do histórico CDD
        const raw30 = (liveExtended.history_cdd).slice(-30);
        const composed30 = raw30.map(d => ({
          date:  d.date.slice(5),  // MM-DD para exibição compacta
          cdd:   d.value,
          ma30:  d.ma30,
          // z-score simplificado inline para cor da barra
          _z:    liveExtended.cdd_z_score ?? 0,
        }));
        // Cor de cada barra individual baseada no z-score global do dia (aproximação)
        const barColor = zScore >= 2 ? '#ef4444' : zScore >= 1 ? '#f59e0b' : '#10b981';
        return (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              CDD 30d vs MA30
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <ComposedChart data={composed30} margin={{ top: 2, right: 4, bottom: 0, left: -28 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 7, fill: '#475569' }}
                  interval={Math.floor(composed30.length / 5)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: '#0d1421', border: '1px solid #2a3f5f',
                    borderRadius: 6, fontSize: 9,
                  }}
                  formatter={(v, name) => [
                    name === 'cdd' ? fmtCdd(v) : fmtCdd(v),
                    name === 'cdd' ? 'CDD' : 'MA30',
                  ]}
                  labelStyle={{ color: '#64748b', fontSize: 8 }}
                />
                <Bar dataKey="cdd" fill={`${barColor}70`} radius={[1, 1, 0, 0]} maxBarSize={12} />
                <Line
                  type="monotone"
                  dataKey="ma30"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      <InterpretBox text={signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── HODL WAVE CARD ───────────────────────────────────────────────────────────
function HodlWaveCard({ liveExtended }) {
  const hodlPct   = liveExtended?.hodl_wave_1yr_pct ?? 0.705;
  const trend     = liveExtended?.hodl_wave_trend   ?? 'neutral';
  const actSply   = liveExtended?.active_supply_1yr ?? 5_713_000;
  const dormancy  = liveExtended?.dormancy_value    ?? 9.4;
  const dormSig   = liveExtended?.dormancy_signal   ?? 'Dados não disponíveis — exibindo estimativa mock.';
  const grade     = liveExtended?.quality           ?? 'B';

  // Cor e label de tendência
  const trendMeta = {
    accumulating: { color: '#10b981', label: 'Acumulação' },
    distributing: { color: '#ef4444', label: 'Distribuição' },
    neutral:      { color: '#f59e0b', label: 'Neutro' },
  }[trend] ?? { color: '#64748b', label: 'Indefinido' };

  // Barra visual: HODL vs Ativo
  const hodlBarPct   = Math.min(100, hodlPct * 100);
  const activeBarPct = Math.min(100, (1 - hodlPct) * 100);

  // Prepara dados para MiniTimeChart: history_hodl → pct como valor
  const pts = (liveExtended?.history_hodl ?? []).map(d => ({ t: d.date, v: d.pct * 100 }));
  const chartData = pts.length > 0
    ? { '1d': pts.slice(-2), '1w': pts.slice(-7), '1m': pts }
    : { '1d': [], '1w': [], '1m': [] };

  return (
    <OnChainCard title="HODL Wave 1yr+ · Dormancy" glossKey="hodlWave" accent={trendMeta.color} grade={grade}>
      {liveExtended && (
        <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          CoinMetrics Community · Grátis · Qualidade A
        </div>
      )}

      {/* % HODL destaque */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 36, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: trendMeta.color, letterSpacing: '-0.04em' }}>
          {(hodlPct * 100).toFixed(1)}%
        </span>
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>supply em HODL &gt;1 ano</div>
          <span style={{
            fontSize: 10, fontWeight: 700, color: trendMeta.color,
            background: `${trendMeta.color}18`,
            border: `1px solid ${trendMeta.color}30`,
            borderRadius: 5, padding: '2px 8px',
          }}>
            {trendMeta.label}
          </span>
        </div>
      </div>

      {/* Barra HODL vs Ativo */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 4 }}>
          <div style={{ width: `${hodlBarPct}%`, background: trendMeta.color, opacity: 0.8 }} />
          <div style={{ width: `${activeBarPct}%`, background: '#1e3a5f' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569' }}>
          <span style={{ color: trendMeta.color }}>HODL {(hodlPct * 100).toFixed(1)}%</span>
          <span>Ativo {(activeBarPct).toFixed(1)}%</span>
        </div>
      </div>

      {/* Mini chart % HODL histórico */}
      {pts.length > 0 && (
        <MiniTimeChart
          data={chartData}
          color={trendMeta.color}
          height={55}
          formatter={v => `${v.toFixed(1)}%`}
        />
      )}

      {/* Supply Activity — stacked AreaChart hodl_pct vs active_pct */}
      {(liveExtended?.history_hodl ?? []).length > 0 && (() => {
        const areaData = (liveExtended.history_hodl).map(d => ({
          date:       d.date.slice(5),          // MM-DD
          hodl_pct:   parseFloat((d.pct * 100).toFixed(2)),
          active_pct: parseFloat(((1 - d.pct) * 100).toFixed(2)),
        }));
        // Exibe apenas cada N-ésimo tick para não sobrecarregar o eixo X
        const tickInterval = Math.floor(areaData.length / 5);
        return (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Supply Activity (% of total)
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={areaData} margin={{ top: 2, right: 4, bottom: 0, left: -28 }} stackOffset="expand">
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 7, fill: '#475569' }}
                  interval={tickInterval}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 7, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d1421', border: '1px solid #2a3f5f',
                    borderRadius: 6, fontSize: 9,
                  }}
                  formatter={(v, name) => [
                    `${typeof v === 'number' ? v.toFixed(2) : v}%`,
                    name === 'hodl_pct' ? 'HODL >1yr' : 'Ativo <1yr',
                  ]}
                  labelStyle={{ color: '#64748b', fontSize: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="hodl_pct"
                  stackId="supply"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.65}
                  dot={false}
                  activeDot={false}
                />
                <Area
                  type="monotone"
                  dataKey="active_pct"
                  stackId="supply"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.45}
                  dot={false}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Dormancy proxy */}
      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 7, background: 'rgba(30,45,69,0.5)', border: '1px solid #1e2d45' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Dormancy Proxy (CDD / Endereços Ativos)
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {dormancy.toFixed(1)}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
          {dormSig}
        </div>
      </div>
    </OnChainCard>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function OnChain() {
  const { cycle, mempool, hashrate, extended } = useOnChainLiveData();
  // Determina se algum dado live está disponível (para ajustar o badge)
  const hasLiveData = !!(cycle || mempool || hashrate || extended);
  const modeLabel   = (IS_LIVE && hasLiveData) ? 'live' : 'mock';
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
            On-Chain Analytics
          </h1>
          <ModeBadge mode={modeLabel} />
          <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
            ⚠ Fontes: CoinMetrics · Mempool.space · Glassnode(mock)
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#475569', marginTop: 6, lineHeight: 1.6 }}>
          MVRV/Realized Price/CDD/HODL: CoinMetrics Community (grátis, qualidade A). Hash Rate/Mempool: Mempool.space (live).
          NUPL/SOPR/Netflow/Whales: estimativas mock (quality B) — requerem Glassnode/CryptoQuant para dados live.
        </p>
      </div>

      {/* Banner de resumo de qualidade de dados — orientação rápida para novos usuários */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8,
        padding: '8px 14px', marginBottom: 20, fontSize: 10, lineHeight: 1.5,
      }}>
        <span style={{ fontWeight: 700, color: '#94a3b8', marginRight: 4 }}>Qualidade dos dados:</span>
        <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
          AO VIVO — Mempool, Hash Rate (Mempool.space)
        </span>
        <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
          AO VIVO — MVRV, Realized Price, CDD, HODL Waves (CoinMetrics Community · grátis)
        </span>
        <span style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
          ESTIMADO — NUPL, SOPR, Netflow, Whales (requerem Glassnode ~$29/mês)
        </span>
      </div>

      {/* Sentimento do mercado on-chain */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          ● Sentimento & Comportamento dos Holders
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
          <NuplCard liveCycle={cycle} />
          <SoprCard />
          <NetflowCard />
        </div>
      </div>

      {/* Atividade institucional */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          ● Atividade Institucional & Baleias
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
          <WhaleCard />
          <MvrvCard liveCycle={cycle} />
          <LthSthCard />
        </div>
      </div>

      {/* Fluxo de Ciclo — CDD & HODL (Sprint 6.1 + 6.3) */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          ● Fluxo de Ciclo — CDD & HODL
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
          <CddCard liveExtended={extended} />
          <HodlWaveCard liveExtended={extended} />
        </div>
        {/* Sprint 6.3 — HODL Waves visual avançado: distribuição de supply por coorte */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 20 }}>
          <HodlWavesPanel liveExtended={extended} />
        </div>
      </div>

      {/* Saúde da rede */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          ● Saúde da Rede Bitcoin
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <HashRateCard liveHashrate={hashrate} />
          <MempoolCard liveMempool={mempool} />
        </div>
      </div>
    </div>
  );
}