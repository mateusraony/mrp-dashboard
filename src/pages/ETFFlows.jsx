// ─── ETF FLOWS PAGE ───────────────────────────────────────────────────────────
// Bitcoin Spot ETF capital flows — BlackRock, Fidelity, ARK, Grayscale, etc.
import { useState } from 'react';
import PurposeLabel from '@/components/ui/PurposeLabel';
import { etfFlows } from '../components/data/mockDataExtended';
import { GradeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { useBtcTicker } from '@/hooks/useBtcData';
import { useEtfRedditPosts } from '@/hooks/useEtfReddit';
import { useEtfSummary, useEtfFlowHistory } from '@/hooks/useSoSoValue';
import { IS_LIVE } from '@/lib/env';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

function fmt(v, decimals = 1) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(decimals)}B`;
  return `$${v.toFixed(decimals)}M`;
}

function FlowBadge({ value }) {
  const pos = value >= 0;
  return (
    <span style={{
      fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
      color: pos ? '#10b981' : '#ef4444',
      background: pos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${pos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      borderRadius: 5, padding: '2px 7px',
    }}>
      {pos ? '+' : ''}{fmt(value)}
    </span>
  );
}

function SummaryCard({ label, value, sub, color = '#e2e8f0' }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
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

// BTC holdings por ETF — fallback estático (SEC filings/etf.com)
// Usado apenas quando SoSoValue não retorna btc_holdings nem aum_b.
// Atualizado 2026-05-18 — valores estimados a partir de filings públicos.
const ETF_BTC_HOLDINGS_FALLBACK = {
  IBIT: 620_000,   // BlackRock iShares Bitcoin Trust
  FBTC: 215_000,   // Fidelity Wise Origin Bitcoin
  ARKB:  58_000,   // ARK 21Shares Bitcoin ETF
  BITB:  50_000,   // Bitwise Bitcoin ETF
  GBTC: 183_000,   // Grayscale Bitcoin Trust (declínio pós-conversão)
  HODL:  28_000,   // VanEck
  BTCO:  28_000,   // Invesco
};

export function ETFContent() {
  const [sortBy, setSortBy] = useState('aum');
  const { data: ticker }      = useBtcTicker();
  const { data: redditPosts } = useEtfRedditPosts();
  const sosoResult            = useEtfSummary();
  const sosoHistResult        = useEtfFlowHistory(30);
  const livePrice             = ticker?.mark_price ?? null;

  // isFallback/lastUpdated expostos pelo select corrigido
  const sosoSummary     = sosoResult.data;
  const sosoHistory     = sosoHistResult.data?.data ?? null;
  const isSosoFallback  = sosoResult.data?.isFallback ?? false;
  const sosoLastUpdated = sosoResult.data?.lastUpdated ?? null;

  // Usa dados reais da SoSoValue quando disponíveis, caso contrário usa mock
  const sosoAvailable = IS_LIVE && sosoSummary && sosoSummary.funds?.length > 0;
  const d = sosoAvailable
    ? {
        ...etfFlows,
        total_aum_b:      sosoSummary.total_aum_b,
        net_flow_today_m: sosoSummary.net_flow_today_m,
        net_flow_7d_m:    sosoSummary.net_flow_7d_m,
        net_flow_30d_m:   sosoSummary.net_flow_30d_m,
        funds:            sosoSummary.funds.map(f => ({
          ...f,
          color:  etfFlows.funds.find(m => m.ticker === f.ticker)?.color ?? '#94a3b8',
          shares: etfFlows.funds.find(m => m.ticker === f.ticker)?.shares ?? 0,
          price:  etfFlows.funds.find(m => m.ticker === f.ticker)?.price ?? 0,
        })),
        history_daily: (sosoHistory && sosoHistory.length > 0) ? sosoHistory : etfFlows.history_daily,
        signal: `Entrada líquida de ${sosoSummary.net_flow_today_m >= 0 ? '+' : ''}$${Math.abs(sosoSummary.net_flow_today_m).toFixed(0)}M hoje via SoSoValue (dados reais).`,
      }
    : etfFlows;

  // Enriquece cada fundo com AUM estimado via preço live (quando SoSoValue não tem AUM)
  // Hierarquia: SoSoValue AUM > SoSoValue btc_holdings × price > static fallback × price > mock
  const fundsWithLiveAum = d.funds.map(f => {
    const hasRealAum      = sosoAvailable && f.aum_b > 0;
    const liveBtcHoldings = sosoAvailable && f.btc_holdings > 0 ? f.btc_holdings : null;
    const holdings        = liveBtcHoldings ?? ETF_BTC_HOLDINGS_FALLBACK[f.ticker] ?? 0;
    return {
      ...f,
      aum_b: hasRealAum
        ? f.aum_b
        : (livePrice && holdings > 0 ? (holdings * livePrice) / 1e9 : f.aum_b),
      aum_is_live: hasRealAum || !!(livePrice && liveBtcHoldings),
      aum_source: hasRealAum       ? 'SoSoValue'
        : (livePrice && liveBtcHoldings ? 'SoSoValue×BTC'
          : livePrice                   ? 'SEC×BTC'
          : 'mock'),
    };
  });

  const sorted = [...fundsWithLiveAum].sort((a, b) => {
    if (sortBy === 'aum') return b.aum_b - a.aum_b;
    if (sortBy === 'today') return b.flow_today_m - a.flow_today_m;
    if (sortBy === '7d') return b.flow_7d_m - a.flow_7d_m;
    return b.flow_30d_m - a.flow_30d_m;
  });

  const totalNet = fundsWithLiveAum.reduce((s, f) => s + f.flow_today_m, 0);

  // Veredicto de mercado baseado no flow do dia
  const verdict = totalNet > 300
    ? { label: 'ENTRADA FORTE', color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', icon: '▲', text: 'Capital institucional entrando com força. Demanda estrutural confirmada.' }
    : totalNet > 0
    ? { label: 'ENTRADA MODERADA', color: '#60a5fa', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', icon: '↗', text: 'Fluxo positivo mas abaixo do limiar de "sinal forte". Observar continuidade.' }
    : totalNet < -200
    ? { label: 'SAÍDA SIGNIFICATIVA', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', icon: '▼', text: 'Resgates superiores a $200M/dia. Pressão vendedora institucional real.' }
    : { label: 'SAÍDA MODERADA', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', icon: '↘', text: 'Saída abaixo de $200M. Pode ser rotação, não necessariamente panic.' };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} data-source="sosovalue,binance_futures" data-page="etf-flows">

      {/* ── CABEÇALHO ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
            Bitcoin Spot ETF Flows
          </h1>
          {sosoAvailable
            ? <DataTrustBadge mode="live" confidence="A" source="SoSoValue API" reason="Flows e AUM reais via SoSoValue (free tier)" />
            : <DataTrustBadge mode="paid_required" confidence="D" source="SoSoValue (chave pendente)" reason="Configure VITE_SOSOVALUE_KEY — cadastro gratuito em sosovalue.com/developer" />
          }
          {!sosoAvailable && livePrice && (
            <DataTrustBadge mode="estimated" confidence="B" source="Binance + SEC filings" reason="AUM = holdings BTC conhecidos (SEC) × preço live Binance" />
          )}
          <GradeBadge grade={sosoAvailable ? 'A' : d.quality} />
          {isSosoFallback && (
            <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>
              ⚠ CACHE
            </span>
          )}
          {!isSosoFallback && sosoAvailable && (
            <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
              {d.consec_inflow_days} dias consecutivos de entrada
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
          {sosoAvailable
            ? 'Fonte: SoSoValue API (dados reais) · Flows D-1 · AUM calculado pela SoSoValue.'
            : 'Fonte: simulado — configure VITE_SOSOVALUE_KEY (gratuito em sosovalue.com/developer) para dados reais.'
          }
        </p>
      </div>

      {/* ── BANNER EXPLICATIVO ── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>🏦</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              <strong style={{ color: '#cbd5e1' }}>ETF Flows</strong> mostra quanto <strong style={{ color: '#cbd5e1' }}>dinheiro institucional</strong> (BlackRock, Fidelity, ARK…) está <em>entrando ou saindo</em> do Bitcoin via fundos regulados.{' '}
              <strong style={{ color: '#3b82f6' }}>Use esta página para responder:</strong>{' '}
              "Os grandes investidores estão comprando ou vendendo BTC agora?" — Entradas acima de <strong style={{ color: '#10b981' }}>$300M/dia</strong> indicam demanda institucional forte; saídas persistentes acima de <strong style={{ color: '#ef4444' }}>$200M/dia</strong> pressionam o preço.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', text: 'Confirmar se a demanda institucional sustenta a alta' },
                { icon: '🔍', text: 'Detectar acumulação silenciosa em correções' },
                { icon: '⚠️', text: 'Identificar saídas que podem pressionar o preço' },
                { icon: '🏆', text: 'Ver qual gestor (BlackRock, Fidelity...) está dominando' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER CACHE (último salvo) ── */}
      {isSosoFallback && sosoLastUpdated && (
        <div style={{ marginBottom: 16, padding: '7px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>⚠ Exibindo último valor salvo no Supabase — API SoSoValue temporariamente indisponível</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Última atualização: {new Date(sosoLastUpdated).toLocaleString('pt-BR')}</span>
        </div>
      )}

      {/* ── VEREDICTO ── */}
      <div style={{
        background: verdict.bg, border: `1px solid ${verdict.border}`,
        borderRadius: 14, padding: '16px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32, lineHeight: 1, color: verdict.color }}>{verdict.icon}</div>
          <div>
            <div style={{ fontSize: 9, color: verdict.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Veredicto do Flow Hoje</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: verdict.color, letterSpacing: '-0.02em', marginBottom: 3 }}>{verdict.label}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 460 }}>{verdict.text}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>NET HOJE</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: totalNet >= 0 ? '#10b981' : '#ef4444', letterSpacing: '-0.03em' }}>
            {totalNet >= 0 ? '+' : ''}${Math.abs(totalNet).toFixed(0)}M
          </div>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <PurposeLabel text="Total de ativos sob gestão nos ETFs BTC — AUM acima de $50B indica que ETFs tornaram-se força dominante no mercado; comparável a holdings de Satoshi (~1M BTC)." mb={10} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <SummaryCard
          label="AUM Total"
          value={livePrice
            ? `$${fundsWithLiveAum.reduce((s, f) => s + f.aum_b, 0).toFixed(1)}B`
            : `$${d.total_aum_b.toFixed(1)}B`
          }
          sub={livePrice
            ? `estimado · BTC $${Math.round(livePrice / 1000)}k live`
            : d.total_aum_prev_30d_b > 0
              ? `+${((d.total_aum_b - d.total_aum_prev_30d_b) / d.total_aum_prev_30d_b * 100).toFixed(1)}% em 30d`
              : 'N/A'
          }
          color={livePrice ? '#10b981' : '#60a5fa'}
        />
        <SummaryCard
          label="Flow Hoje"
          value={`${totalNet >= 0 ? '+' : ''}$${Math.abs(totalNet).toFixed(0)}M`}
          sub={totalNet >= 0 ? '↑ Entrada líquida' : '↓ Saída líquida'}
          color={totalNet >= 0 ? '#10b981' : '#ef4444'}
        />
        <SummaryCard
          label="Flow 7D"
          value={`+$${(d.net_flow_7d_m / 1000).toFixed(2)}B`}
          sub="Acumulado semana"
          color="#10b981"
        />
        <SummaryCard
          label="Flow 30D"
          value={`+$${(d.net_flow_30d_m / 1000).toFixed(2)}B`}
          sub="Acumulado mês"
          color="#10b981"
        />
        <SummaryCard
          label="N° de ETFs"
          value={d.funds.length.toString()}
          sub="produtos ativos"
          color="#a78bfa"
        />
        <SummaryCard
          label="Dominância IBIT"
          value={(() => {
            const ibit = fundsWithLiveAum.find(f => f.ticker === 'IBIT');
            const total = fundsWithLiveAum.reduce((s, f) => s + f.aum_b, 0);
            if (!ibit || total === 0) return '—';
            return `${(ibit.aum_b / total * 100).toFixed(1)}%`;
          })()}
          sub="BlackRock (maior)"
          color="#3b82f6"
        />
      </div>

      {/* ── FLOW CHART 30 DIAS ── */}
      <div style={{
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid #1e2d45', borderRadius: 14, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Flows Diários — Últimos 30 dias</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Entrada (verde) vs Saída (vermelho) · USD Milhões</div>
            <PurposeLabel text="Barras verdes = capital entrando nos ETFs (compra institucional). Barras vermelhas = resgates (saída). Sequência de 5+ dias verdes = tendência de acumulação. Sequência de 3+ dias vermelhos = alerta de distribuição." mt={4} />
          </div>
          {sosoAvailable
            ? <DataTrustBadge mode="live" confidence="A" source="SoSoValue API" reason="Histórico de flows real via SoSoValue (free tier)" />
            : <DataTrustBadge mode="mock" confidence="D" source="simulado" reason="Configure VITE_SOSOVALUE_KEY para ativar dados reais" />
          }
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={d.history_daily} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} tickFormatter={v => `$${v}M`} />
            <Tooltip
              contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }}
              formatter={(v, n) => [`$${Math.abs(Number(v)).toFixed(1)}M`, n === 'inflow' ? 'Entrada' : n === 'outflow' ? 'Saída' : 'Net']}
            />
            <ReferenceLine y={0} stroke="#2a3f5f" />
            <Bar dataKey="net" radius={[2, 2, 0, 0]}>
              {d.history_daily.map((entry, index) => (
                <Cell key={index} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Guia de interpretação do gráfico */}
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#0a1220', border: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Como interpretar estas barras</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {[
              { icon: '🟢', cond: 'Barra verde > $300M', result: 'Entrada forte. Gestoras comprando BTC agressivamente. Alta continuidade provável.' },
              { icon: '🔴', cond: 'Barra vermelha > $200M', result: 'Resgate relevante. Pode pressionar o preço nas próximas horas.' },
              { icon: '⚠️', cond: '3+ dias vermelhos seguidos', result: 'Tendência de saída. Monitore se o preço começa a ceder.' },
              { icon: '🏆', cond: '5+ dias verdes seguidos', result: 'Acumulação estrutural. Instituições aumentando posição sistematicamente.' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, lineHeight: 1.2, flexShrink: 0 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                  <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABELA DE ETFs ── */}
      <div style={{
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid #1e2d45', borderRadius: 14, overflow: 'hidden', marginBottom: 20,
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #1e2d45',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Fundos por Emissor</div>
            <div style={{ fontSize: 11, color: '#475569' }}>AUM, flows e concentração por produto</div>
            <PurposeLabel text="Qual gestor está captando mais? IBIT (BlackRock) dominante indica que grandes family offices e fundos de pensão estão comprando via produto regulado. Fluxos negativos no GBTC (Grayscale) são normais pós-conversão e não indicam pânico." mt={4} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['aum', 'today', '7d', '30d'].map(k => (
              <button key={k} onClick={() => setSortBy(k)} style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                background: sortBy === k ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: sortBy === k ? '#60a5fa' : '#475569',
                border: `1px solid ${sortBy === k ? 'rgba(59,130,246,0.4)' : '#1e2d45'}`,
                fontWeight: sortBy === k ? 700 : 400,
              }}>
                {k === 'aum' ? 'AUM' : k === 'today' ? 'Hoje' : k === '7d' ? '7D' : '30D'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['ETF', 'Emissor', 'AUM', 'Flow Hoje', 'Flow 7D', 'Flow 30D', 'Dominância'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: h === 'ETF' || h === 'Emissor' ? 'left' : 'right',
                    fontSize: 10, color: '#475569', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((fund, i) => (
                <tr key={fund.ticker} style={{
                  borderBottom: '1px solid rgba(30,45,69,0.5)',
                  background: i === 0 ? 'rgba(59,130,246,0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: fund.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{fund.ticker}</div>
                        <div style={{ fontSize: 10, color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fund.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: '#64748b' }}>{fund.issuer}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
                      ${fund.aum_b.toFixed(1)}B
                    </span>
                    {fund.aum_is_live && (
                      <div style={{ fontSize: 8, color: '#10b981', marginTop: 1 }}>{fund.aum_source ?? 'live'}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FlowBadge value={fund.flow_today_m} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FlowBadge value={fund.flow_7d_m} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <FlowBadge value={fund.flow_30d_m} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <div style={{ width: 60, height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${(fund.aum_b / (d.total_aum_b || 1) * 100).toFixed(1)}%`,
                          background: fund.color,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', minWidth: 38, textAlign: 'right' }}>
                        {(fund.aum_b / (d.total_aum_b || 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #1e2d45', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#334155' }}>
            Total AUM: <span style={{ color: '#60a5fa', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>${d.total_aum_b.toFixed(1)}B</span>
          </span>
          <span style={{ fontSize: 10, color: '#334155' }}>
            Net Flow Total Hoje: <span style={{ color: totalNet >= 0 ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
              {totalNet >= 0 ? '+' : ''}${Math.abs(totalNet).toFixed(1)}M
            </span>
          </span>
        </div>
      </div>

      {/* ── SIGNAL ── */}
      <div style={{
        padding: '14px 18px',
        background: totalNet >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${totalNet >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        borderRadius: 12,
        fontSize: 12, color: '#94a3b8', lineHeight: 1.7,
        marginBottom: 20,
      }}>
        <span style={{ color: totalNet >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
          📡 Sinal ETF:{' '}
        </span>
        {d.signal}
        {!sosoAvailable && (
          <span style={{ fontSize: 9, color: '#475569', marginLeft: 6 }}>(simulado — configure VITE_SOSOVALUE_KEY para dados reais)</span>
        )}
      </div>

      {/* ── REDDIT PULSE ── */}
      <div style={{ marginBottom: 20, background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>🟠</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Reddit Pulse — BTC ETF</div>
            <PurposeLabel text="Discussões recentes sobre ETFs de BTC no Reddit — volume de posts e upvotes elevado indica interesse institucional crescente; tópicos negativos persistentes podem antecipar resgates." mt={4} />
            <div style={{ fontSize: 10, color: '#475569' }}>Discussões recentes em r/ETFs e r/Bitcoin · atualizado a cada 30min</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(redditPosts ?? []).map((post, i) => (
            <a
              key={i}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, textDecoration: 'none', transition: 'border-color 0.15s' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 42, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: post.score > 100 ? '#10b981' : '#60a5fa' }}>{post.score > 999 ? `${(post.score / 1000).toFixed(1)}k` : post.score}</span>
                <span style={{ fontSize: 8, color: '#334155' }}>pontos</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 4 }}>{post.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(255,69,0,0.12)', color: '#ff6b35', border: '1px solid rgba(255,69,0,0.2)', fontWeight: 700 }}>r/{post.subreddit}</span>
                  <span style={{ fontSize: 9, color: '#334155' }}>{new Date(post.created_utc * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </a>
          ))}
          {(!redditPosts || redditPosts.length === 0) && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#334155', fontSize: 11 }}>Carregando posts do Reddit…</div>
          )}
        </div>
      </div>

      {/* ── DICAS DE OURO ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar ETF Flows</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Regras usadas por traders profissionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="📈"
            title="Entrada acima de $500M/dia = sinal muito forte"
            tag="LIMIAR"
            body="Fluxos acima de $500M em um único dia indicam compra agressiva de gestoras de peso. Historicamente, após 3+ dias seguidos nesse nível, o BTC tende a consolidar ou subir nos 7 dias seguintes. Abaixo de $100M, o sinal é fraco e pode ser apenas rotação interna entre fundos."
          />
          <TipCard
            emoji="🔴"
            title="Saída por 3+ dias seguidos = alerta de pressão vendedora"
            tag="TENDÊNCIA"
            body="Resgates consecutivos por 3 ou mais dias indicam que os grandes detentores estão reduzindo exposição ao BTC. Não é necessariamente colapso — pode ser realização de lucros — mas é sinal para aumentar a cautela e não comprar em momentos de euforia."
          />
          <TipCard
            emoji="🏛️"
            title="GBTC saindo ≠ panic — é normalização pós-conversão"
            tag="CONTEXTO"
            body="O GBTC (Grayscale) sofreu saídas massivas após a conversão para ETF, pois investidores que entraram com desconto realizaram lucros. Isso é estrutural, não bearish. O que importa é o TOTAL da indústria: se IBIT e FBTC compensam as saídas do GBTC, o saldo líquido ainda é positivo."
          />
          <TipCard
            emoji="🥇"
            title="IBIT dominando > 50% = BlackRock validando o mercado"
            tag="DOMINÂNCIA"
            body="Quando a BlackRock (IBIT) concentra mais de 50% do AUM total dos ETFs, significa que o maior gestor de ativos do mundo está apostando no Bitcoin com capital significativo. Isso é diferente de um fundo boutique comprando — é validação do ativo por uma instituição trillion-dollar."
          />
          <TipCard
            emoji="⏰"
            title="Dados são D-1 — nunca use para timing intraday"
            tag="TIMING"
            body="Os flows dos ETFs são divulgados com 1 dia de atraso. Se você ver entrada de $400M 'hoje', esse dado se refere a ontem. Use ETF flows para contexto macro de 7-30 dias, nunca para trade de horas. Para timing intraday, use CVD e liquidações em derivativos."
          />
          <TipCard
            emoji="🔗"
            title="AUM subindo + preço subindo = demanda real, não especulação"
            tag="CONFLUÊNCIA"
            body="Quando o AUM total dos ETFs cresce junto com o preço do BTC, significa que não é apenas especulação alavancada: capital novo está entrando via produtos regulados. Isso é o cenário de alta mais saudável. Divergência (preço sobe mas AUM cai) pode indicar alta artificial via derivativos."
          />
        </div>
      </div>

    </div>
  );
}
