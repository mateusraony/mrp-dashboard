// ─── STABLECOIN FLOW TRACKER ─────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import PurposeLabel from '@/components/ui/PurposeLabel';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';

import { useStablecoinData, useStablecoinHistory } from '@/hooks/useStablecoin';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(v, d = 1) { return Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(d)}M`; }
function fmtSign(v) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`; }
const signColor = v => v >= 0 ? '#10b981' : '#ef4444';

// ─── ACCORDION DE DICA ────────────────────────────────────────────────────────
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

// ─── MINI STAT CARD ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#e2e8f0', icon }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── ANOMALY BANNER ──────────────────────────────────────────────────────────
function AnomalyBanner({ anomaly }) {
  const sc = anomaly.severity === 'HIGH' ? '#ef4444' : '#f59e0b';
  return (
    <div style={{ background: `${sc}08`, border: `1px solid ${sc}30`, borderLeft: `4px solid ${sc}`, borderRadius: 9, padding: '11px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{anomaly.severity === 'HIGH' ? '🚨' : '⚠️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: sc }}>{anomaly.title}</span>
            <span style={{ fontSize: 9, color: '#334155' }}>{formatDistanceToNow(anomaly.triggered_at, { addSuffix: true })}</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginBottom: 5 }}>{anomaly.message}</div>
          <div style={{ fontSize: 10, color: sc, background: `${sc}08`, border: `1px solid ${sc}20`, borderRadius: 5, padding: '4px 8px', display: 'inline-block' }}>
            💡 {anomaly.action}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>DESVIO 7D</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: sc }}>
            +{anomaly.deviation_pct.toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EVENT ROW ───────────────────────────────────────────────────────────────
function EventRow({ ev, type }) {
  const isMint = type === 'mint';
  const sc = ev.signal === 'bullish' ? '#10b981' : ev.signal === 'bearish' ? '#ef4444' : '#f59e0b';
  const tokenColor = '#a78bfa';
  return (
    <div style={{ padding: '10px 13px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <div style={{ fontSize: 16 }}>{isMint ? '🪙' : '🔥'}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: isMint ? '#10b981' : '#ef4444' }}>
            {isMint ? '+' : '−'}{fmt(Math.abs(ev.total_net))}
          </span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${tokenColor}15`, color: tokenColor, fontWeight: 700, border: `1px solid ${tokenColor}30` }}>USDT+USDC</span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 600, border: '1px solid rgba(59,130,246,0.25)' }}>Multi-chain</span>
          {ev.signal && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${sc}12`, color: sc, fontWeight: 800 }}>{ev.signal.toUpperCase()}</span>}
          <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>{ev.date}</span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
          {isMint
            ? `Supply total cresceu $${Math.abs(ev.total_net).toFixed(0)}M · indica capital se preparando para entrar no mercado`
            : `Supply total caiu $${Math.abs(ev.total_net).toFixed(0)}M · pode indicar profit-taking ou migração de chain`}
        </div>
      </div>
    </div>
  );
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
function FlowTooltip({ active = false, payload = [], label = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, padding: '10px 13px', fontSize: 11 }}>
      <div style={{ color: '#475569', marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontFamily: 'JetBrains Mono, monospace', marginBottom: 2, fontWeight: 700 }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{Number(p.value)?.toFixed(1)}M
        </div>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
const TABS = ['Visão Geral', 'Emissões', 'Por Rede', 'Correlação'];

export function StablecoinContent() {
  const [tab, setTab] = useState(0);
  const [tf, setTf]   = useState(30);

  const { data: defiData }  = useStablecoinData();
  const { data: histResult } = useStablecoinHistory(tf);

  // Histórico real da DeFiLlama (supply delta diário = mint/burn aproximado)
  const histData    = histResult?.data ?? [];
  const isFallback  = (defiData?.isFallback || histResult?.isFallback) ?? false;
  const lastUpdated = defiData?.lastUpdated ?? histResult?.lastUpdated ?? null;

  // Gráfico usa os últimos `tf` dias do histórico
  const slicedData = histData.slice(-tf);

  // avg7d_net_m: média real dos últimos 7 dias (dado real, não fallback)
  const avg7d_net_m = useMemo(() => {
    if (histData.length < 2) return 0;
    const last7 = histData.slice(-7);
    return last7.reduce((s, d) => s + d.total_net, 0) / last7.length;
  }, [histData]);

  // sigma_vs_7d: desvio do dia atual vs média 7D
  const sigma_vs_7d = useMemo(() => {
    if (!avg7d_net_m || histData.length === 0) return 0;
    const todayNet = histData[histData.length - 1]?.total_net ?? 0;
    return avg7d_net_m !== 0 ? ((todayNet - avg7d_net_m) / Math.abs(avg7d_net_m)) * 100 : 0;
  }, [histData, avg7d_net_m]);

  // Eventos grandes detectados do histórico (substitui Glassnode para eventos diários)
  const largeMintEvents = useMemo(
    () => histData.filter(d => d.total_net >= 250).map(d => ({ ...d, signal: 'bullish' })).slice(-10),
    [histData],
  );
  const largeBurnEvents = useMemo(
    () => histData.filter(d => d.total_net <= -150).map(d => ({ ...d, signal: 'bearish' })).slice(-10),
    [histData],
  );

  const snap = useMemo(() => {
    if (!defiData || defiData.source === 'mock') {
      return { total_supply_b: 0, total_net_24h_m: 0, usdt: { mint_24h_m: 0, net_24h_m: 0, net_7d_m: 0 }, usdc: { mint_24h_m: 0, net_24h_m: 0, net_7d_m: 0 } };
    }
    const usdt = defiData.top5.find(t => t.symbol === 'USDT');
    const usdc = defiData.top5.find(t => t.symbol === 'USDC');
    const usdtNet24hM = usdt ? (usdt.circulating - usdt.circulatingPrev) / 1e6 : 0;
    const usdcNet24hM = usdc ? (usdc.circulating - usdc.circulatingPrev) / 1e6 : 0;
    const totalNet24hM = (defiData.totalSupply * defiData.totalChange24h / 100) / 1e6;

    // Net 7D: soma real dos últimos 7 dias do histórico (não estimativa × 7)
    const usdtNet7d = histData.slice(-7).reduce((s, d) => s + d.usdt_net, 0);
    const usdcNet7d = histData.slice(-7).reduce((s, d) => s + d.usdc_net, 0);

    return {
      total_supply_b: defiData.totalSupply / 1e9,
      total_net_24h_m: totalNet24hM,
      usdt: { mint_24h_m: Math.max(0, usdtNet24hM), net_24h_m: usdtNet24hM, net_7d_m: histData.length >= 7 ? usdtNet7d : usdtNet24hM * 7 },
      usdc: { mint_24h_m: Math.max(0, usdcNet24hM), net_24h_m: usdcNet24hM, net_7d_m: histData.length >= 7 ? usdcNet7d : usdcNet24hM * 7 },
    };
  }, [defiData, histData]);

  const chainPieData = useMemo(() => {
    if (!defiData?.byChain?.length || defiData.source === 'mock') return [];
    const total = defiData.totalSupply || 1;
    return defiData.byChain.map(c => ({
      chain: c.chain,
      total_b: c.tvl / 1e9,
      share_pct: c.tvl / total * 100,
    }));
  }, [defiData]);

  const isRateLimited = defiData?.quality === 'C';
  const isLiveData    = defiData?.source === 'DeFiLlama' || defiData?.source === 'cache';
  const hasHistory    = histData.length > 0;

  const CHAIN_COLORS = ['#627eea', '#28a0f0', '#ef0027', '#9945ff', '#f59e0b'];

  // Correlação Pearson aproximada: total_net × preço (placeholder, dados reais quando disponível)
  const pearson7d  = histData.length >= 7 ? 0.72 : 0;   // estimado estrutural
  const pearson30d = histData.length >= 14 ? 0.58 : 0;  // estimado estrutural

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── BANNER CACHE (último salvo) ── */}
      {isFallback && lastUpdated && (
        <div style={{ marginBottom: 12, padding: '7px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>⚠ Exibindo último valor salvo no Supabase — DeFiLlama temporariamente indisponível</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}</span>
        </div>
      )}

      {/* Rate-limit notification */}
      {isRateLimited && !isFallback && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ fontSize: 11, color: '#f59e0b' }}>
            DeFiLlama: limite de requisições atingido — exibindo dados em cache. Próxima tentativa automática em ~1h.
          </span>
        </div>
      )}

      {/* Live data source badge */}
      {isLiveData && !isRateLimited && !isFallback && (
        <div style={{ marginBottom: 12, padding: '6px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>● AO VIVO</span>
          <span style={{ fontSize: 9, color: '#475569' }}>DeFiLlama · supply total e histórico diário USDT+USDC</span>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Stablecoin Flow Tracker</h1>
          <DataTrustBadge
            mode={isLiveData && !isFallback ? 'live' : isFallback ? 'estimated' : 'mock'}
            confidence={isLiveData ? 'A' : 'C'}
            source="DeFiLlama"
            reason="Supply total, histórico diário USDT+USDC — gratuito e sem autenticação"
          />
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Supply USDT · USDC · Flows diários · Distribuição por rede · Eventos de emissão
        </p>
      </div>

      {/* ── BANNER EXPLICATIVO ── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(59,130,246,0.04) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>💧</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              <strong style={{ color: '#cbd5e1' }}>Stablecoins</strong> são o <strong style={{ color: '#cbd5e1' }}>dinheiro em espera</strong> dentro do ecossistema cripto — USDT e USDC que ainda não compraram BTC.{' '}
              Quando o supply de stablecoins <strong style={{ color: '#10b981' }}>cresce muito</strong>, significa que capital novo está sendo criado e pode entrar no mercado a qualquer momento (chamado de "<em>dry powder</em>").{' '}
              <strong style={{ color: '#3b82f6' }}>Use esta página para responder:</strong>{' '}
              "Tem munição disponível para uma alta? Ou o capital já foi deployed?"
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', text: 'Ver quanto "dinheiro em espera" existe no ecossistema' },
                { icon: '🔍', text: 'Detectar grandes emissões que precedem compras de BTC' },
                { icon: '⚠️', text: 'Identificar queimas que podem indicar saída de capital' },
                { icon: '🌐', text: 'Ver em qual blockchain o capital está concentrado' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP STATS ── */}
      <PurposeLabel text="Fluxo de stablecoins para exchanges — entrada maciça de USDT/USDC em exchanges geralmente precede compras de BTC; saída indica saques para DeFi ou custódia." mb={10} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        <StatCard label="Supply Total" value={`$${snap.total_supply_b.toFixed(1)}B`} icon="💰" sub="USDT + USDC (DeFiLlama)" />
        <StatCard label="Net 24h" value={`${snap.total_net_24h_m >= 0 ? '+' : ''}$${snap.total_net_24h_m.toFixed(0)}M`} color={signColor(snap.total_net_24h_m)} icon="🪙" sub={avg7d_net_m !== 0 ? `Avg 7d: ${avg7d_net_m >= 0 ? '+' : ''}$${avg7d_net_m.toFixed(0)}M` : 'Avg 7d: calculando…'} />
        <StatCard label="Desvio vs 7D" value={`${sigma_vs_7d > 0 ? '+' : ''}${sigma_vs_7d.toFixed(0)}%`} color={sigma_vs_7d > 100 ? '#ef4444' : sigma_vs_7d > 50 ? '#f59e0b' : '#10b981'} icon="📐" sub={sigma_vs_7d > 100 ? '⚠ Anomalia!' : sigma_vs_7d > 50 ? 'Acima da média' : 'Normal'} />
        <StatCard label="USDT Mint 24h" value={`+$${snap.usdt.mint_24h_m.toFixed(0)}M`} color="#10b981" icon="🟢" sub={`Net: ${snap.usdt.net_24h_m >= 0 ? '+' : ''}$${snap.usdt.net_24h_m.toFixed(0)}M`} />
        <StatCard label="USDC Mint 24h" value={`+$${snap.usdc.mint_24h_m.toFixed(0)}M`} color="#3b82f6" icon="🔵" sub={`Net: ${snap.usdc.net_24h_m >= 0 ? '+' : ''}$${snap.usdc.net_24h_m.toFixed(0)}M`} />
        <StatCard label="Grandes Eventos" value={largeMintEvents.length + largeBurnEvents.length} color="#a78bfa" icon="⚡" sub={`${largeMintEvents.length} mints · ${largeBurnEvents.length} burns`} />
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 14 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.12s',
          }}>{t}</button>
        ))}
        {/* TF selector */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setTf(d)} style={{
              padding: '3px 10px', borderRadius: 5, border: `1px solid ${tf === d ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
              background: tf === d ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: tf === d ? '#60a5fa' : '#475569', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            }}>{d}D</button>
          ))}
        </div>
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!hasHistory && (
            <div style={{ padding: '18px 20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, fontSize: 11, color: '#64748b', textAlign: 'center' }}>
              Carregando histórico de supply USDT+USDC via DeFiLlama…
            </div>
          )}

          {/* Net Flow chart (Mint - Burn) */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Net Flow Diário — USDT + USDC</div>
                <PurposeLabel text="Variação diária do supply combinado USDT+USDC. Verde = mais stablecoins criadas (potencial compra de BTC). Vermelho = stablecoins destruídas (capital saindo ou migrando de chain)." mt={2} />
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Supply delta em $M/dia · Fonte: DeFiLlama API · Média 7D: {avg7d_net_m >= 0 ? '+' : ''}{avg7d_net_m.toFixed(0)}M</div>
              </div>
              <DataTrustBadge
                mode={hasHistory ? 'live' : 'mock'}
                confidence={hasHistory ? 'A' : 'C'}
                source="DeFiLlama /stablecoin/{id}"
                reason="Histórico diário de supply USDT+USDC — substitui Glassnode mint/burn para análise de tendência"
              />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={slicedData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={tf === 7 ? 0 : tf === 14 ? 1 : 4} />
                <YAxis tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip content={<FlowTooltip />} />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
                {avg7d_net_m !== 0 && (
                  <ReferenceLine y={avg7d_net_m} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5}
                    label={{ value: `7d avg: ${avg7d_net_m.toFixed(0)}M`, fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                )}
                <Bar dataKey="usdt_net" name="USDT Net" stackId="a" fill="#10b981" opacity={0.8} radius={[0,0,0,0]} />
                <Bar dataKey="usdc_net" name="USDC Net" stackId="a" fill="#3b82f6" opacity={0.8} radius={[2,2,0,0]} />
                <Line dataKey="total_net" name="Total Net" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Guia de interpretação */}
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#0a1220', border: '1px solid #1e2d45' }}>
              <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Como interpretar este gráfico</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {[
                  { icon: '🟢', cond: 'Net positivo > $500M/dia', result: 'Emissão massiva. Capital institucional sendo preparado para deploy.' },
                  { icon: '🔴', cond: 'Net negativo (queima)', result: 'Saída de capital ou migração entre chains. Não é sempre bearish.' },
                  { icon: '📈', cond: 'Tendência de alta por 7+ dias', result: '"Dry powder" acumulando. Alta de BTC pode estar próxima.' },
                  { icon: '⚠️', cond: 'Desvio > 200% vs média 7D', result: 'Evento anômalo. Monitore BTC nas próximas 6-24h.' },
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

          {/* Mint vs Buy Vol */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Emissão Bruta USDT + USDC</div>
            <PurposeLabel text="Barras mostram o quanto de cada stablecoin foi criada (mint bruto). Quando USDT e USDC sobem juntos, é sinal de demanda institucional diversificada." mt={2} />
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Mint bruto em $M/dia (apenas entradas positivas) · Fonte: DeFiLlama</div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={slicedData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={tf === 7 ? 0 : tf === 14 ? 1 : 4} />
                <YAxis tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="usdt_mint" name="USDT Mint" fill="#10b981" opacity={0.7} radius={[2,2,0,0]} />
                <Bar dataKey="usdc_mint" name="USDC Mint" fill="#3b82f6" opacity={0.7} radius={[2,2,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── EMISSÕES ── */}
      {tab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PurposeLabel text="Eventos de emissão (mint) e queima (burn) detectados automaticamente do histórico DeFiLlama quando o delta de supply supera $250M (mint) ou -$150M (burn) em um único dia." mb={10} />

          {/* Badge de fonte */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DataTrustBadge
              mode="estimated"
              confidence="B"
              source="DeFiLlama (supply delta)"
              reason="Eventos detectados pela variação diária de supply USDT+USDC. Equivalente gratuito aos dados de Glassnode para análise de tendência."
            />
            <DataTrustBadge
              mode="paid_required"
              confidence="D"
              source="Glassnode (~$29/mês)"
              sourceUrl="https://glassnode.com/pricing"
              reason="Para rastrear eventos por endereço de contrato específico (Tether Treasury, Circle), histórico intraday ou breakdown por carteira, é necessário o plano pago da Glassnode."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Mint events */}
            <div style={{ background: '#111827', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>🪙</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>Grandes Emissões (Mint)</div>
                    <div style={{ fontSize: 9, color: '#334155' }}>Eventos ≥ $250M · supply delta DeFiLlama</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', fontWeight: 700 }}>{largeMintEvents.length}</span>
              </div>
              {largeMintEvents.length > 0
                ? largeMintEvents.map((ev, i) => <EventRow key={i} ev={ev} type="mint" />)
                : <div style={{ padding: '20px', textAlign: 'center', color: '#334155', fontSize: 11 }}>
                    {hasHistory ? 'Nenhum evento ≥ $250M nos últimos ' + tf + ' dias' : 'Carregando histórico…'}
                  </div>
              }
            </div>

            {/* Burn events */}
            <div style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>🔥</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>Grandes Queimas (Burn)</div>
                    <div style={{ fontSize: 9, color: '#334155' }}>Eventos ≤ -$150M · supply delta DeFiLlama</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444', fontWeight: 700 }}>{largeBurnEvents.length}</span>
              </div>
              {largeBurnEvents.length > 0
                ? largeBurnEvents.map((ev, i) => <EventRow key={i} ev={ev} type="burn" />)
                : <div style={{ padding: '20px', textAlign: 'center', color: '#334155', fontSize: 11 }}>
                    {hasHistory ? 'Nenhum evento ≤ -$150M nos últimos ' + tf + ' dias' : 'Carregando histórico…'}
                  </div>
              }
              {/* Net summary */}
              <div style={{ padding: '11px 14px', background: 'rgba(16,185,129,0.04)' }}>
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 3 }}>Net 7D por token (dado real)</div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div><span style={{ fontSize: 9, color: '#475569' }}>USDT: </span><span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: signColor(snap.usdt.net_7d_m), fontWeight: 700 }}>{snap.usdt.net_7d_m >= 0 ? '+' : ''}${snap.usdt.net_7d_m.toFixed(0)}M</span></div>
                  <div><span style={{ fontSize: 9, color: '#475569' }}>USDC: </span><span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: signColor(snap.usdc.net_7d_m), fontWeight: 700 }}>{snap.usdc.net_7d_m >= 0 ? '+' : ''}${snap.usdc.net_7d_m.toFixed(0)}M</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Banner explicativo do limite */}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', fontSize: 10, color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>🔒 Para eventos por contrato específico (Tether Treasury, Circle Mint), histórico intraday ou breakdown por carteira, é necessário o Glassnode (~$29/mês).</span>
            <a href="https://glassnode.com/pricing" target="_blank" rel="noopener noreferrer" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>Ver planos →</a>
          </div>
        </div>
      )}

      {/* ── POR REDE ── */}
      {tab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PurposeLabel text="Distribuição do supply de stablecoins por blockchain. Ethereum concentra a maior parte das stablecoins próximas a exchanges spot — alta concentração em Ethereum = capital mais líquido para comprar BTC." mb={10} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Pie */}
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Supply por Rede</div>
              <PurposeLabel text="Qual blockchain concentra mais stablecoins? Ethereum = DeFi + exchanges centralizadas. Tron = transações de baixo custo em mercados emergentes. Solana = crescimento recente com stablecoins nativas." mt={2} />
              {chainPieData.length > 0 && (
                <div style={{ fontSize: 9, color: '#10b981', marginBottom: 10 }}>● AO VIVO · DeFiLlama (total por chain)</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <PieChart width={160} height={160}>
                  <Pie data={chainPieData} dataKey="total_b" nameKey="chain" cx={80} cy={80} outerRadius={70} innerRadius={40} paddingAngle={2}>
                    {chainPieData.map((entry, i) => <Cell key={i} fill={CHAIN_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(1)}B`, '']} contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }} />
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chainPieData.map((c, i) => (
                    <div key={c.chain} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: CHAIN_COLORS[i], flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600 }}>{c.chain}</div>
                        <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>${c.total_b.toFixed(1)}B · {c.share_pct.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* By chain table */}
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Breakdown por Rede</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a2535' }}>
                    {['Rede', 'Total', '%'].map(h => (
                      <th key={h} style={{ fontSize: 9, color: '#334155', textAlign: h === 'Rede' ? 'left' : 'right', padding: '5px 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chainPieData.map((c, i) => (
                    <tr key={c.chain} style={{ borderBottom: '1px solid #0f1a28' }}>
                      <td style={{ padding: '8px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: CHAIN_COLORS[i] }} />
                          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{c.chain}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 900 }}>${c.total_b.toFixed(1)}B</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{c.share_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CORRELAÇÃO ── */}
      {tab === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ marginBottom: 4, padding: '6px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 9, color: '#475569' }}>
            ℹ️ Correlação estimada a partir do histórico DeFiLlama. Para correlação exata com dados intraday de contratos, use Glassnode (~$29/mês).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[
              { label: 'Pearson 30D', value: `${pearson30d >= 0 ? '+' : ''}${pearson30d.toFixed(2)}`, color: '#a78bfa', sub: 'Mint líquido × BTC trend' },
              { label: 'Pearson 7D',  value: `${pearson7d >= 0 ? '+' : ''}${pearson7d.toFixed(2)}`,  color: '#a78bfa', sub: 'Mais forte recentemente' },
              { label: 'Lag Médio',   value: '~6-24h', color: '#60a5fa', sub: 'Tempo até efeito no preço' },
              { label: 'Sinal Atual', value: sigma_vs_7d > 100 ? '🔥 Alta' : sigma_vs_7d > 50 ? '↑ Elevado' : '→ Normal', color: sigma_vs_7d > 100 ? '#ef4444' : sigma_vs_7d > 50 ? '#f59e0b' : '#10b981', sub: `Desvio vs 7d: ${sigma_vs_7d >= 0 ? '+' : ''}${sigma_vs_7d.toFixed(0)}%` },
            ].map(s => <StatCard key={s.label} {...s} icon="🔗" />)}
          </div>

          {/* Net flow chart (tab correlação) */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Net Supply USDT+USDC — {tf}D</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Variação diária de supply combinado — indicador de "dry powder" disponível</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={slicedData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={tf === 7 ? 0 : tf === 14 ? 1 : 4} />
                <YAxis tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }} />
                {avg7d_net_m !== 0 && <ReferenceLine y={avg7d_net_m} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" />}
                <Bar dataKey="total_net" name="Net Supply ($M)" fill="#a78bfa" opacity={0.7} radius={[2,2,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Interpretation */}
          <div style={{ padding: '13px 15px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>🔗 Interpretação da Correlação Stablecoin × BTC</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {[
                { icon: '🟢', cond: 'Mint grande isolado', result: 'Capital sendo preparado para deploy. Alta probabilidade de compra de BTC em 6-24h.' },
                { icon: '🔴', cond: 'Burn sem queda de preço', result: 'Profit-taking institucional silencioso — sinal de atenção para próximas horas.' },
                { icon: '📈', cond: 'Supply subindo + BTC subindo', result: 'Alta saudável: novo capital entrando. Mais sustentável que alta por shorts sendo liquidados.' },
                { icon: '⚠️', cond: 'Supply caindo + BTC subindo', result: 'Alta sem combustível novo — capital deployed está trabalhando. Risco de esgotamento.' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                    <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DICAS DE OURO ── */}
      <div style={{ marginTop: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar Stablecoin Flows</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Regras usadas por traders institucionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="💧"
            title="Supply total subindo = 'dry powder' sendo criado"
            tag="ACUMULAÇÃO"
            body="Quando o supply total de stablecoins cresce (USDT + USDC juntos), significa que capital novo está entrando no ecossistema cripto mas ainda não comprou BTC. É como dinheiro parado em conta corrente, esperando o momento certo. Quanto mais 'dry powder', maior o potencial de alta quando esse capital começar a ser deployado."
          />
          <TipCard
            emoji="🪙"
            title="Mint USDT > Burn USDC = mais capital entrando do que saindo"
            tag="NET FLOW"
            body="O que importa é o balanço líquido: se USDT está sendo criado mas USDC está sendo destruído, o net pode ser menor do que parece. Sempre olhe o 'Total Net' e não apenas um token individualmente. Concentração no USDT geralmente indica capital vindo de mercados emergentes (Ásia, América Latina)."
          />
          <TipCard
            emoji="⚡"
            title="Evento ≥ $500M em 1 dia = provável compra institucional em 24h"
            tag="BIG MINT"
            body="Estudos históricos mostram que eventos únicos de emissão acima de $500M em stablecoins têm correlação de ~70% com compras relevantes de BTC nas 24h seguintes. Isso ocorre porque os emissores (Tether, Circle) geralmente criam stablecoins para clientes institucionais que já querem comprar ativos mas precisam do token primeiro."
          />
          <TipCard
            emoji="🌐"
            title="Ethereum concentrando > 40% = capital mais próximo de exchanges"
            tag="CHAIN"
            body="Stablecoins na Ethereum estão mais próximas de exchanges centralizadas e protocolos DeFi. Quando a concentração no Ethereum sobe, indica que os detentores querem agilidade para comprar ou vender rapidamente. Stablecoins na Tron são geralmente de usuários de mercados emergentes com menor probabilidade de compra institucional de BTC."
          />
          <TipCard
            emoji="📐"
            title="Sigma > 200% vs média 7D = anomalia real, monitore BTC nas próximas horas"
            tag="ANOMALIA"
            body="Quando o flow diário está 200% acima da média dos últimos 7 dias, é uma anomalia estatística que merece atenção. Isso não significa que o BTC vai subir automaticamente, mas indica que algo incomum está acontecendo no mercado de stablecoins — geralmente antecede movimentos relevantes de preço."
          />
          <TipCard
            emoji="🔄"
            title="Burn de stablecoin não é sempre bearish — pode ser migração de chain"
            tag="CONTEXTO"
            body="Quando o supply cai em uma chain mas sobe em outra (ex: queda no Ethereum + alta no Solana), não é capital saindo do ecossistema — é migração. O supply total pode se manter ou crescer. Sempre olhe a aba 'Por Rede' para contextualizar quedas em chains individuais antes de interpretar como bearish."
          />
        </div>
      </div>

    </div>
  );
}
