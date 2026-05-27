// ─── ON-CHAIN AVANÇADO ────────────────────────────────────────────────────────
// NUPL · SOPR · Exchange Netflow · Whale Activity · Realized Price / MVRV
// Hash Rate · Dificuldade · Mempool
import { useState } from 'react';
import {
  btcNUPL, btcSOPR, btcExchangeNetflow, btcWhaleActivity,
  btcRealizedMetrics, btcHashRate, onChain, fmtNum,
} from '../components/data/mockData';
import { useOnChainAdvanced, useMempoolState, useHashrate } from '@/hooks/useMempool';
import { useOnChainCycle, useOnChainExtended } from '@/hooks/useCoinMetrics';
import { IS_LIVE } from '@/lib/env';
import { DataQualityBadge } from '../components/ui/DataQualityBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { readModuleFlag } from '@/lib/moduleFlags';
import { DisabledModuleBanner } from '@/components/ui/DisabledModuleBanner';

// ─── DATA LAYER (live > mock fallback) ───────────────────────────────────────
function useOnChainLiveData() {
  const onchainEnabled = readModuleFlag('ENABLE_ONCHAIN');
  const { data: cycle }    = useOnChainCycle(onchainEnabled);
  const { data: mempool }  = useMempoolState();
  const { data: hashrate } = useHashrate();
  const { data: extended } = useOnChainExtended(onchainEnabled);
  useOnChainAdvanced();
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

// ─── TOOLTIP INLINE ──────────────────────────────────────────────────────────
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

// ─── ACCORDION DE DICA ────────────────────────────────────────────────────────
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
  // Usa dados live apenas quando CoinMetrics retornou valores reais (mvrv_current > 0)
  // Se isFallback=true com zeros (API falhou, sem cache), exibe mock com badge de aviso
  const hasLiveData = liveCycle && !liveCycle.isFallback && liveCycle.mvrv_current > 0;
  const isFallbackWithStale = liveCycle && liveCycle.isFallback && liveCycle.mvrv_current > 0;
  const nuplValue = (hasLiveData || isFallbackWithStale) ? liveCycle.nupl : n.value;
  const nuplZone  = (hasLiveData || isFallbackWithStale) ? liveCycle.nupl_zone : n.zone;
  const nuplColor = (hasLiveData || isFallbackWithStale) ? liveCycle.nupl_zone_color : n.zone_color;
  const isLive    = IS_LIVE && hasLiveData;
  const noKey     = IS_LIVE && !liveCycle?.mvrv_current;
  return (
    <OnChainCard title="NUPL" glossKey="nupl" accent={nuplColor} grade={isLive ? 'B' : n.quality}
      trustBadge={
        isLive
          ? <DataTrustBadge mode="estimated" confidence="B" source="CoinMetrics Community"
              reason="Proxy via (MCap−RCap)/MCap — não é o NUPL oficial Glassnode mas correlação >0.97"
              updatedAt={liveCycle.updated_at} />
          : isFallbackWithStale
          ? <DataTrustBadge mode="estimated" confidence="C" source="CoinMetrics (cache)"
              reason="API com instabilidade — exibindo último dado válido do cache Supabase."
              updatedAt={liveCycle.lastUpdated} />
          : noKey
          ? <DataTrustBadge mode="paid_required" confidence="D" source="CoinMetrics"
              sourceUrl="https://coinmetrics.io/community-network-data/"
              reason="Adicione VITE_COINMETRICS_KEY (gratuito em coinmetrics.io) para ativar dados reais." />
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
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Mede o "humor" geral dos holders de Bitcoin. Perto de 0 = mercado no prejuízo, possível fundo. Perto de 1 = euforia, possível topo.
      </div>
      <InterpretBox text={n.interpretation} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── PLACEHOLDER — dados que exigem API paga ─────────────────────────────────
function PaidRequiredCard({ title, glossKey, source, sourceUrl, reason }) {
  return (
    <OnChainCard title={title} glossKey={glossKey} accent="#4a6580" grade="D"
      trustBadge={
        <DataTrustBadge mode="paid_required" confidence="D" source={source}
          sourceUrl={sourceUrl} reason={reason} />
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 10 }}>
        <div style={{ fontSize: 28, opacity: 0.3 }}>🔒</div>
        <div style={{ fontSize: 12, color: '#4a6580', textAlign: 'center', maxWidth: 200 }}>
          Dado não disponível sem assinatura {source}
        </div>
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10, color: '#3b82f6', textDecoration: 'none', border: '1px solid #1e3a5f', borderRadius: 4, padding: '3px 8px' }}>
          Ver planos →
        </a>
      </div>
      <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠</span>
        <span>Não computa na análise de IA — será incluído automaticamente quando a assinatura estiver ativa.</span>
      </div>
    </OnChainCard>
  );
}

// ─── SOPR CARD ────────────────────────────────────────────────────────────────
function SoprCard() {
  if (IS_LIVE) return (
    <PaidRequiredCard title="SOPR" glossKey="sopr" source="Glassnode"
      sourceUrl="https://glassnode.com/pricing"
      reason="SOPR (Spent Output Profit Ratio) requer Glassnode (~$29/mês)" />
  );
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
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Diz se as pessoas que venderam BTC hoje saíram com lucro ou prejuízo. Acima de 1.0 = lucro (pressão de venda). Abaixo de 1.0 = prejuízo (capitulação).
      </div>
      <InterpretBox text={s.interpretation} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── EXCHANGE NETFLOW ─────────────────────────────────────────────────────────
function NetflowCard() {
  if (IS_LIVE) return (
    <PaidRequiredCard title="Exchange Netflow" glossKey="netflow" source="Glassnode"
      sourceUrl="https://glassnode.com/pricing"
      reason="Exchange Netflow requer Glassnode ou CryptoQuant (~$29/mês)" />
  );
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
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> BTC <em>saindo</em> de exchanges = acumulação (bullish). BTC <em>entrando</em> = preparação para vender (bearish). Reservas totais abaixo de 2M BTC = supply escasso.
      </div>
      <InterpretBox text={n.signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── WHALE ACTIVITY ───────────────────────────────────────────────────────────
function WhaleCard() {
  if (IS_LIVE) return (
    <PaidRequiredCard title="Whale Transactions 24h" glossKey="whale" source="Glassnode"
      sourceUrl="https://glassnode.com/pricing"
      reason="Whale Activity (txs >$1M) requer Glassnode (~$29/mês)" />
  );
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
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Rastreia movimentações de grandes investidores (baleias). Picos acima da média 7d podem indicar acumulação institucional silenciosa — ou distribuição antes de uma queda.
      </div>
      <InterpretBox text={w.signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── REALIZED PRICE / MVRV ───────────────────────────────────────────────────
function MvrvCard({ liveCycle }) {
  // Usa dados live apenas quando mvrv_current > 0 (API retornou valores reais)
  const hasLiveData = liveCycle && !liveCycle.isFallback && liveCycle.mvrv_current > 0;
  const isFallbackWithStale = liveCycle && liveCycle.isFallback && liveCycle.mvrv_current > 0;
  const useLive = hasLiveData || isFallbackWithStale;
  const mvrv      = useLive ? liveCycle.mvrv_current    : btcRealizedMetrics.mvrv_ratio;
  const mvrvZ     = useLive ? liveCycle.mvrv_zscore     : btcRealizedMetrics.mvrv_zscore;
  const rPrice    = useLive ? liveCycle.realized_price  : btcRealizedMetrics.realized_price;
  const cPrice    = useLive ? liveCycle.current_price   : btcRealizedMetrics.current_price;
  const zone      = useLive ? liveCycle.mvrv_zone       : btcRealizedMetrics.mvrv_zone;
  const color     = useLive ? liveCycle.mvrv_zone_color : btcRealizedMetrics.mvrv_zone_color;
  const grade     = useLive ? (liveCycle.quality ?? 'B') : 'B';
  const distPct   = rPrice > 0 ? ((cPrice - rPrice) / rPrice * 100) : 0;
  const rDelta30d = btcRealizedMetrics.realized_price_delta_30d;
  const noKey     = IS_LIVE && !liveCycle?.mvrv_current;
  return (
    <OnChainCard title="Realized Price · MVRV" glossKey="mvrv" accent={color} grade={grade}
      trustBadge={
        <DataTrustBadge
          mode={hasLiveData ? 'estimated' : isFallbackWithStale ? 'estimated' : noKey ? 'paid_required' : 'mock'}
          confidence={hasLiveData ? 'B' : isFallbackWithStale ? 'C' : 'D'}
          source={noKey ? 'CoinMetrics (chave necessária)' : 'CoinMetrics Community'}
          sourceUrl="https://coinmetrics.io/community-network-data/"
          updatedAt={useLive ? liveCycle.lastUpdated : undefined}
          reason={
            noKey
              ? 'Adicione VITE_COINMETRICS_KEY (gratuito em coinmetrics.io) para ativar dados reais de MVRV.'
              : isFallbackWithStale
              ? 'API instável — exibindo último dado válido do cache.'
              : !useLive && IS_LIVE
              ? 'CoinMetrics não disponível — exibindo fallback mock'
              : 'NUPL derivado de (MCap−RCap)/MCap — proxy, não fórmula oficial Glassnode'
          }
        />
      }
    >
      {hasLiveData && (
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
      {noKey && IS_LIVE && (
        <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b' }}>
          🔑 <strong>Chave CoinMetrics gratuita necessária.</strong>{' '}
          <a href="https://coinmetrics.io/community-network-data/" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>Cadastre-se aqui →</a>
          {' '}e adicione <code style={{ background: '#1e2d45', padding: '0 4px', borderRadius: 3, fontSize: 9 }}>VITE_COINMETRICS_KEY</code> nas variáveis de ambiente do Render.
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
      <div style={{ marginTop: 4, marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Compara o preço atual com o custo médio de todos os BTC. Abaixo de 1× = mercado barato (fundo histórico). Acima de 3.5× = mercado caro (histórico de topos).
      </div>
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#0a1220', border: '1px solid #1e2d45' }}>
        <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Como interpretar o MVRV</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
          {[
            { icon: '🔵', cond: 'MVRV < 1×', result: 'Mercado subvalorizado. Historicamente = fundo de ciclo. Compra de longo prazo.' },
            { icon: '🟢', cond: 'MVRV 1–2.5×', result: 'Zona de acumulação / neutro. Preço razoável em relação ao custo médio.' },
            { icon: '🟡', cond: 'MVRV 2.5–3.7×', result: 'Mercado caro. Realize lucros parciais. Risco crescente de correção.' },
            { icon: '🔴', cond: 'MVRV > 3.7×', result: 'Zona de euforia / topo histórico. Alto risco. Venda progressiva recomendada.' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, lineHeight: 1.2 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
              </div>
            </div>
          ))}
        </div>
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
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Hash rate alto = rede segura, mineradores confiantes no preço. Queda brusca pode indicar desligamento em massa (bear market) ou proibição regulatória. Dado ao vivo via Mempool.space.
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
      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Mostra a "fila" de transações esperando confirmação. Taxa alta = rede congestionada, pague mais para ser priorizado. Taxa baixa = rede tranquila, bom momento para transações econômicas.
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#334155' }}>
        Fonte: mempool.space · Grade: {grade}
      </div>
    </OnChainCard>
  );
}

// ─── CDD CARD ─────────────────────────────────────────────────────────────────
function CddCard({ liveExtended }) {
  // Usa dados live apenas quando CoinMetrics retornou valores reais (cdd_current > 0)
  const hasLiveExt = liveExtended && !liveExtended.isFallback && liveExtended.cdd_current > 0;
  const hasFallbackExt = liveExtended && liveExtended.isFallback && liveExtended.cdd_current > 0;
  const useExt = hasLiveExt || hasFallbackExt;
  const cdd       = useExt ? liveExtended.cdd_current : 8_000_000;
  const ma30      = useExt ? liveExtended.cdd_ma30    : 7_500_000;
  const zScore    = useExt ? liveExtended.cdd_z_score : 0.3;
  const signal    = useExt ? liveExtended.cdd_signal  : 'Dados não disponíveis — configure VITE_COINMETRICS_KEY (gratuito) para ativar.';
  const grade     = useExt ? liveExtended.quality     : 'B';

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

  const noCoinmetricsKey = IS_LIVE && !liveExtended?.cdd_current;
  return (
    <OnChainCard title="CDD — Coin Days Destroyed" glossKey="cdd" accent={zColor} grade={grade}>
      {hasLiveExt && (
        <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          CoinMetrics Community · Grátis · Qualidade A
        </div>
      )}
      {noCoinmetricsKey && (
        <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b' }}>
          🔑 <strong>Chave CoinMetrics gratuita necessária.</strong>{' '}
          <a href="https://coinmetrics.io/community-network-data/" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>Cadastre-se aqui →</a>
          {' '}e adicione <code style={{ background: '#1e2d45', padding: '0 4px', borderRadius: 3, fontSize: 9 }}>VITE_COINMETRICS_KEY</code> nas variáveis de ambiente do Render.
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

      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> CDD alto = moedas antigas estão se movendo (possível distribuição de holders veteranos). Z-Score positivo = movimento anormalmente alto vs. histórico recente. Dado ao vivo via CoinMetrics Community.
      </div>
      <InterpretBox text={signal} color="#94a3b8" />
    </OnChainCard>
  );
}

// ─── HODL WAVE CARD ───────────────────────────────────────────────────────────
function HodlWaveCard({ liveExtended }) {
  // Usa dados live apenas quando CoinMetrics retornou valores reais (hodl_wave_1yr_pct > 0)
  const hasLiveExt     = liveExtended && !liveExtended.isFallback && liveExtended.hodl_wave_1yr_pct > 0;
  const hasFallbackExt = liveExtended && liveExtended.isFallback && liveExtended.hodl_wave_1yr_pct > 0;
  const useExt    = hasLiveExt || hasFallbackExt;
  const hodlPct   = useExt ? liveExtended.hodl_wave_1yr_pct : 0.705;
  const trend     = useExt ? liveExtended.hodl_wave_trend   : 'neutral';
  const actSply   = useExt ? liveExtended.active_supply_1yr : 5_713_000;
  const dormancy  = useExt ? liveExtended.dormancy_value    : 9.4;
  const dormSig   = useExt ? liveExtended.dormancy_signal   : 'Dados não disponíveis — configure VITE_COINMETRICS_KEY (gratuito) para ativar.';
  const grade     = useExt ? liveExtended.quality           : 'B';
  const noCoinmetricsKey = IS_LIVE && !liveExtended?.hodl_wave_1yr_pct;

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
      {hasLiveExt && (
        <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          CoinMetrics Community · Grátis · Qualidade A
        </div>
      )}
      {noCoinmetricsKey && (
        <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b' }}>
          🔑 <strong>Chave CoinMetrics gratuita necessária.</strong>{' '}
          <a href="https://coinmetrics.io/community-network-data/" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>Cadastre-se aqui →</a>
          {' '}e adicione <code style={{ background: '#1e2d45', padding: '0 4px', borderRadius: 3, fontSize: 9 }}>VITE_COINMETRICS_KEY</code> nas variáveis de ambiente do Render.
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

      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#334155' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Percentual do supply que não se moveu há mais de 1 ano. Subindo = holders guardando (bullish, oferta saindo de circulação). Caindo = distribuição em andamento (holders veteranos vendendo).
      </div>

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

  if (!readModuleFlag('ENABLE_ONCHAIN')) {
    return <DisabledModuleBanner moduleName="ENABLE_ONCHAIN" />;
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* ── CABEÇALHO ─────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
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
      </div>

      {/* ── O QUE É ESTA PÁGINA ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(59,130,246,0.05) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>🔗</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              <strong style={{ color: '#cbd5e1' }}>On-Chain Analytics</strong> lê diretamente o blockchain do Bitcoin — o livro-caixa público e imutável que registra cada transação. Diferente de gráficos de preço, aqui vemos o <strong style={{ color: '#10b981' }}>comportamento real dos holders</strong>: quem está acumulando, quem está distribuindo, e em que fase do ciclo o mercado está.{' '}
              <strong style={{ color: '#3b82f6' }}>Use esta página para responder:</strong>{' '}
              "O mercado está em acumulação ou distribuição? Estamos perto de um fundo ou de um topo de ciclo?" — Uma análise que preço sozinho não consegue responder.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '📊', text: 'Identificar fases de ciclo (acumulação → alta → distribuição → queda)' },
                { icon: '🐋', text: 'Detectar movimentações de baleias e instituições' },
                { icon: '💎', text: 'Ver se holders de longo prazo estão acumulando ou vendendo' },
                { icon: '⛏️', text: 'Monitorar a saúde da rede e o custo de mineração' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER DE QUALIDADE DE DADOS ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8,
        padding: '8px 14px', marginBottom: 20, fontSize: 10, lineHeight: 1.5,
      }}>
        <span style={{ fontWeight: 700, color: '#94a3b8', marginRight: 4 }}>Qualidade dos dados:</span>
        {IS_LIVE ? (
          <>
            <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
              ✔ AO VIVO — Mempool, Hash Rate (Mempool.space)
            </span>
            <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
              ✔ AO VIVO — MVRV, Realized Price, CDD, HODL Waves (CoinMetrics Community · grátis)
            </span>
            <span style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
              ⚠ ESTIMADO — NUPL, SOPR, Netflow, Whales (requerem Glassnode ~$29/mês)
            </span>
          </>
        ) : (
          <span style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>
            ⚠ DEMO — todos os dados são simulados (DATA_MODE=mock)
          </span>
        )}
      </div>

      {/* ── SENTIMENTO & COMPORTAMENTO DOS HOLDERS ────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            ● Sentimento & Comportamento dos Holders
          </div>
          <div style={{ fontSize: 10, color: '#334155', padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve esta seção:</strong> Mede o "estado emocional" do mercado — se os holders estão no lucro, no prejuízo, se estão vendendo ou guardando. São os sinais mais confiáveis de topo e fundo histórico.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
          <NuplCard liveCycle={cycle} />
          <SoprCard />
          <NetflowCard />
        </div>
      </div>

      {/* ── ATIVIDADE INSTITUCIONAL & BALEIAS ─────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            ● Atividade Institucional & Baleias
          </div>
          <div style={{ fontSize: 10, color: '#334155', padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve esta seção:</strong> Rastreia grandes players (fundos, baleias) e mede se o preço atual está barato ou caro em relação ao custo histórico médio do Bitcoin. Essencial para posicionamento de médio/longo prazo.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
          <WhaleCard />
          <MvrvCard liveCycle={cycle} />
          <LthSthCard />
        </div>
      </div>

      {/* ── FLUXO DE CICLO — CDD & HODL ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            ● Fluxo de Ciclo — CDD & HODL Waves
          </div>
          <div style={{ fontSize: 10, color: '#334155', padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve esta seção:</strong> Mostra a "memória" do Bitcoin — se moedas antigas estão quietas (acumulação) ou se movendo (distribuição). HODL Waves altas indicam que o mercado está em fase de paciência. Dados ao vivo via CoinMetrics Community (grátis).
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
          <CddCard liveExtended={extended} />
          <HodlWaveCard liveExtended={extended} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 20 }}>
          <HodlWavesPanel liveExtended={extended} />
        </div>
      </div>

      {/* ── SAÚDE DA REDE BITCOIN ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            ● Saúde da Rede Bitcoin
          </div>
          <div style={{ fontSize: 10, color: '#334155', padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve esta seção:</strong> Monitora a infraestrutura do Bitcoin — velocidade de processamento, segurança da rede e custo das transações. Hash rate alto = mineradores confiantes. Taxas altas = demanda por espaço no bloco elevada. Dados ao vivo via Mempool.space.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <HashRateCard liveHashrate={hashrate} />
          <MempoolCard liveMempool={mempool} />
        </div>
      </div>

      {/* ── DICAS DE OURO ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar On-Chain</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Conceitos usados por analistas institucionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="📉"
            title="NUPL negativo = sinal de fundo histórico"
            tag="CICLO"
            body="Toda vez que o NUPL caiu abaixo de zero na história do Bitcoin, foi um dos melhores momentos para comprar. Isso significa que o mercado, em agregado, está em prejuízo — e normalmente os detentores de longo prazo aproveitam para acumular enquanto os especuladores capitulam e vendem com prejuízo."
          />
          <TipCard
            emoji="🔑"
            title="Realized Price é o suporte mais importante do BTC"
            tag="SUPORTE"
            body="O Realized Price representa o custo médio de compra de todos os BTC em circulação. Historicamente, o Bitcoin nunca ficou muito tempo abaixo desse nível — ele funciona como um suporte psicológico e fundamental. Quando o preço cai até o Realized Price, é comum ver grandes compradores institucionais entrando."
          />
          <TipCard
            emoji="💎"
            title="HODL Wave acima de 70% = mercado maduro"
            tag="ACUMULAÇÃO"
            body="Quando mais de 70% do supply de BTC fica parado por mais de 1 ano, significa que os holders de longo prazo (diamantes) não estão vendendo — mesmo com preços altos. Esse é um sinal de convicção forte. Historicamente, mercados touro mais sustentados acontecem quando a HODL Wave está alta e crescendo."
          />
          <TipCard
            emoji="🐋"
            title="Baleias saindo de exchanges = acumulação silenciosa"
            tag="NETFLOW"
            body="Quando o Exchange Netflow fica consistentemente negativo (saída líquida de BTC), significa que grandes holders estão retirando BTC das exchanges para carteiras frias (cold wallets). Isso reduz a oferta disponível para venda e é historicamente bullish. O inverso — entradas em exchanges — precede vendas e correções."
          />
          <TipCard
            emoji="⛏️"
            title="Hash rate em ATH = mineradores confiantes"
            tag="SEGURANÇA"
            body="Mineradores são os participantes mais racionais do mercado — eles investem milhões em máquinas e eletricidade. Quando o hash rate atinge máximas históricas, significa que os mineradores estão expandindo operações, o que implica que eles esperam preços altos no futuro. Hash rate caindo pode indicar bear market ou crise no setor."
          />
          <TipCard
            emoji="💀"
            title="CDD alto = moedas dormentes acordando"
            tag="DISTRIBUIÇÃO"
            body="Imagine que cada BTC acumula 'dias de vida' enquanto não é movido. Quando alguém move um BTC que ficou parado por 5 anos, 1.825 'dias' são destruídos (5×365). CDD alto indica que holders veteranos — que compraram barato — estão vendendo agora. Isso frequentemente precede correções. CDD baixo = quietude, acumulação."
          />
          <TipCard
            emoji="🔄"
            title="MVRV > 3.5× = cuidado máximo"
            tag="TOPO"
            body="O MVRV Ratio acima de 3.5× apareceu próximo a todos os grandes topos históricos do Bitcoin (2013, 2017, 2021). Significa que o mercado está negociando 250% acima do custo médio de todos os holders — e a pressão para realizar lucros fica insustentável. Abaixo de 1× marcou todos os fundos históricos."
          />
        </div>
      </div>

    </div>
  );
}