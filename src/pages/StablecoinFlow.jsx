// ─── STABLECOIN FLOW TRACKER ─────────────────────────────────────────────────
import { useState, useMemo } from 'react';

// Fallbacks — dados de mint/burn requerem API paga (Glassnode ~$29/mês ou Nansen)
const DAILY_MINT_BURN_FALLBACK = [];
const STABLECOIN_SNAPSHOT_FALLBACK = {
  total_supply_b: 0, total_net_24h_m: 0, avg7d_net_m: 0, sigma_vs_7d: 0,
  usdt: { mint_24h_m: 0, net_24h_m: 0, net_7d_m: 0 },
  usdc: { mint_24h_m: 0, net_24h_m: 0, net_7d_m: 0 },
};
const LARGE_MINT_EVENTS_FALLBACK = [];
const LARGE_BURN_EVENTS_FALLBACK = [];
const STABLECOIN_ANOMALIES_FALLBACK = [];
const SUPPLY_BY_CHAIN_FALLBACK = [];
const MINT_VS_BTC_CORR_FALLBACK = {
  pearson_7d: 0, pearson_30d: 0, lag_hours_optimal: 0,
  note: 'Dados indisponíveis — requer API paga (Glassnode/Nansen)',
};
import { useStablecoinData } from '@/hooks/useStablecoin';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(v, d = 1) { return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(d)}M`; }
function fmtSign(v) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}`; }
const signColor = v => v >= 0 ? '#10b981' : '#ef4444';

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
  const tokenColor = ev.token === 'USDT' ? '#10b981' : '#3b82f6';
  const chainColor = ev.chain === 'Ethereum' ? '#627eea' : ev.chain === 'Arbitrum' ? '#28a0f0' : '#9945ff';
  return (
    <div style={{ padding: '10px 13px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <div style={{ fontSize: 16 }}>{isMint ? '🪙' : '🔥'}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: isMint ? '#10b981' : '#ef4444' }}>
            {isMint ? '+' : '−'}{fmt(ev.amount_m)}
          </span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${tokenColor}15`, color: tokenColor, fontWeight: 700, border: `1px solid ${tokenColor}30` }}>{ev.token}</span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${chainColor}15`, color: chainColor, fontWeight: 600, border: `1px solid ${chainColor}30` }}>{ev.chain}</span>
          {ev.signal && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${sc}12`, color: sc, fontWeight: 800 }}>{ev.signal.toUpperCase()}</span>}
          <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>{formatDistanceToNow(ev.timestamp, { addSuffix: true })}</span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>{ev.note}</div>
        {ev.corr_btc_move_pct !== undefined && (
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: '#334155' }}>BTC: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: ev.corr_btc_move_pct >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{fmtSign(ev.corr_btc_move_pct)}%</span></span>
            {ev.corr_buy_vol_m > 0 && <span style={{ fontSize: 9, color: '#334155' }}>Vol compra: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', fontWeight: 700 }}>{fmt(ev.corr_buy_vol_m)}</span></span>}
          </div>
        )}
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
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value?.toFixed(1)}M
        </div>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
const TABS = ['Visão Geral', 'Emissões', 'Por Rede', 'Correlação'];

export function StablecoinContent() {
  const [tab, setTab] = useState(0);
  const [tf, setTf] = useState(30);

  const { data: defiData } = useStablecoinData();

  const snap = useMemo(() => {
    if (!defiData || defiData.source === 'mock') return STABLECOIN_SNAPSHOT_FALLBACK;
    const usdt = defiData.top5.find(t => t.symbol === 'USDT');
    const usdc = defiData.top5.find(t => t.symbol === 'USDC');
    const usdtNet24hM = usdt ? (usdt.circulating - usdt.circulatingPrev) / 1e6 : 0;
    const usdcNet24hM = usdc ? (usdc.circulating - usdc.circulatingPrev) / 1e6 : 0;
    const totalNet24hM = (defiData.totalSupply * defiData.totalChange24h / 100) / 1e6;
    return {
      total_supply_b: defiData.totalSupply / 1e9,
      total_net_24h_m: totalNet24hM,
      avg7d_net_m: STABLECOIN_SNAPSHOT_FALLBACK.avg7d_net_m,
      sigma_vs_7d: STABLECOIN_SNAPSHOT_FALLBACK.sigma_vs_7d,
      usdt: {
        mint_24h_m: Math.max(0, usdtNet24hM),
        net_24h_m: usdtNet24hM,
        net_7d_m: usdtNet24hM * 7,
      },
      usdc: {
        mint_24h_m: Math.max(0, usdcNet24hM),
        net_24h_m: usdcNet24hM,
        net_7d_m: usdcNet24hM * 7,
      },
    };
  }, [defiData]);

  const slicedData = DAILY_MINT_BURN_FALLBACK.slice(-tf);
  const avg7dNet = snap.avg7d_net_m;
  const isRateLimited = defiData?.quality === 'C';
  const isLiveData = defiData?.source === 'DeFiLlama' || defiData?.source === 'cache';

  const CHAIN_COLORS = ['#627eea', '#28a0f0', '#ef0027', '#9945ff'];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Rate-limit notification */}
      {isRateLimited && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ fontSize: 11, color: '#f59e0b' }}>
            DeFiLlama: limite de requisições atingido — exibindo dados em cache. Próxima tentativa automática em ~1h.
          </span>
        </div>
      )}
      {/* Live data source badge */}
      {isLiveData && !isRateLimited && (
        <div style={{ marginBottom: 12, padding: '6px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>● AO VIVO</span>
          <span style={{ fontSize: 9, color: '#475569' }}>DeFiLlama · supply total e fluxos 24h</span>
        </div>
      )}
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Stablecoin Flow Tracker</h1>
          <DataTrustBadge mode="paid_required" confidence="D" source="Glassnode/Nansen" reason="Mint/burn flows requerem Glassnode (~$29/mês) ou Nansen" />
          {STABLECOIN_ANOMALIES_FALLBACK.length > 0 && (
            <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, padding: '2px 8px', fontWeight: 800 }}>
              🚨 {STABLECOIN_ANOMALIES_FALLBACK.length} anomalia{STABLECOIN_ANOMALIES_FALLBACK.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Mint/Burn USDT · USDC · Ethereum · Arbitrum · Correlação com volume BTC
        </p>
      </div>

      {/* Anomaly banners */}
      {STABLECOIN_ANOMALIES_FALLBACK.map(a => <AnomalyBanner key={a.id} anomaly={a} />)}

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        <StatCard label="Supply Total" value={`$${snap.total_supply_b.toFixed(1)}B`} icon="💰" sub="USDT + USDC" />
        <StatCard label="Net 24h" value={`+$${snap.total_net_24h_m.toFixed(0)}M`} color="#10b981" icon="🪙" sub={`Avg 7d: +$${snap.avg7d_net_m.toFixed(0)}M`} />
        <StatCard label="Desvio vs 7D" value={`${snap.sigma_vs_7d > 0 ? '+' : ''}${snap.sigma_vs_7d.toFixed(0)}%`} color={snap.sigma_vs_7d > 50 ? '#ef4444' : '#f59e0b'} icon="📐" sub={snap.sigma_vs_7d > 50 ? '⚠ Anomalia' : 'Normal'} />
        <StatCard label="USDT Mint 24h" value={`+$${snap.usdt.mint_24h_m.toFixed(0)}M`} color="#10b981" icon="🟢" sub={`Net: +$${snap.usdt.net_24h_m.toFixed(0)}M`} />
        <StatCard label="USDC Mint 24h" value={`+$${snap.usdc.mint_24h_m.toFixed(0)}M`} color="#3b82f6" icon="🔵" sub={`Net: +$${snap.usdc.net_24h_m.toFixed(0)}M`} />
        <StatCard label="Corr. BTC 7D" value={`${MINT_VS_BTC_CORR_FALLBACK.pearson_7d >= 0 ? '+' : ''}${MINT_VS_BTC_CORR_FALLBACK.pearson_7d.toFixed(2)}`} color="#a78bfa" icon="🔗" sub={`Lag ~${MINT_VS_BTC_CORR_FALLBACK.lag_hours_optimal}h`} />
      </div>

      {/* Tabs */}
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
          {/* Net Flow chart (Mint - Burn) */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Net Flow Diário — USDT + USDC</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Mint líquido (Mint − Burn) em USD milhões · Linha = média 7 dias</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={slicedData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={tf === 7 ? 0 : tf === 14 ? 1 : 4} />
                <YAxis tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip content={<FlowTooltip />} />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
                <ReferenceLine y={avg7dNet} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: `7d avg: ${avg7dNet.toFixed(0)}M`, fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                <Bar dataKey="usdt_net" name="USDT Net" stackId="a" fill="#10b981" opacity={0.8} radius={[0,0,0,0]} />
                <Bar dataKey="usdc_net" name="USDC Net" stackId="a" fill="#3b82f6" opacity={0.8} radius={[2,2,0,0]} />
                <Line dataKey="total_net" name="Total Net" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Mint vs Buy Vol */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Mint Bruto vs Volume de Compra BTC</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Correlação entre emissão de stablecoins e volume de compra de BTC nas exchanges</div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={slicedData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={tf === 7 ? 0 : tf === 14 ? 1 : 4} />
                <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="usdt_mint" name="USDT Mint" fill="#10b981" opacity={0.6} radius={[2,2,0,0]} />
                <Bar yAxisId="left" dataKey="usdc_mint" name="USDC Mint" fill="#3b82f6" opacity={0.6} radius={[2,2,0,0]} />
                <Line yAxisId="right" dataKey="btc_buy_vol_b" name="BTC Buy Vol ($B)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 8, fontSize: 9, color: '#334155' }}>
              Correlação Pearson 7D: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', fontWeight: 800 }}>{MINT_VS_BTC_CORR_FALLBACK.pearson_7d >= 0 ? '+' : ''}{MINT_VS_BTC_CORR_FALLBACK.pearson_7d.toFixed(2)}</span>
              {' '}· Lag médio: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', fontWeight: 700 }}>~{MINT_VS_BTC_CORR_FALLBACK.lag_hours_optimal}h</span>
              {' '}· {MINT_VS_BTC_CORR_FALLBACK.note}
            </div>
          </div>
        </div>
      )}

      {/* ── EMISSÕES ── */}
      {tab === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Mint events */}
          <div style={{ background: '#111827', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>🪙</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>Grandes Emissões (Mint)</div>
                <div style={{ fontSize: 9, color: '#334155' }}>Eventos ≥ $250M</div>
              </div>
            </div>
            {LARGE_MINT_EVENTS_FALLBACK.map(ev => <EventRow key={ev.id} ev={ev} type="mint" />)}
          </div>
          {/* Burn events */}
          <div style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>Grandes Queimas (Burn)</div>
                <div style={{ fontSize: 9, color: '#334155' }}>Eventos ≥ $150M</div>
              </div>
            </div>
            {LARGE_BURN_EVENTS_FALLBACK.map(ev => <EventRow key={ev.id} ev={ev} type="burn" />)}
            {/* Net summary */}
            <div style={{ padding: '11px 14px', background: 'rgba(16,185,129,0.04)' }}>
              <div style={{ fontSize: 9, color: '#334155', marginBottom: 3 }}>Net 7D por token</div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div><span style={{ fontSize: 9, color: '#475569' }}>USDT: </span><span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', fontWeight: 700 }}>+${(snap.usdt.net_7d_m).toFixed(0)}M</span></div>
                <div><span style={{ fontSize: 9, color: '#475569' }}>USDC: </span><span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#3b82f6', fontWeight: 700 }}>+${(snap.usdc.net_7d_m).toFixed(0)}M</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POR REDE ── */}
      {tab === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Pie */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Supply por Rede</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PieChart width={160} height={160}>
                <Pie data={SUPPLY_BY_CHAIN_FALLBACK} dataKey="total_b" nameKey="chain" cx={80} cy={80} outerRadius={70} innerRadius={40} paddingAngle={2}>
                  {SUPPLY_BY_CHAIN_FALLBACK.map((entry, i) => <Cell key={i} fill={CHAIN_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(1)}B`, '']} contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }} />
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUPPLY_BY_CHAIN_FALLBACK.map((c, i) => (
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Breakdown por Rede e Token</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2535' }}>
                  {['Rede', 'USDT', 'USDC', 'Total', '%'].map(h => (
                    <th key={h} style={{ fontSize: 9, color: '#334155', textAlign: h === 'Rede' ? 'left' : 'right', padding: '5px 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUPPLY_BY_CHAIN_FALLBACK.map((c, i) => (
                  <tr key={c.chain} style={{ borderBottom: '1px solid #0f1a28' }}>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: CHAIN_COLORS[i] }} />
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{c.chain}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', fontWeight: 700 }}>${c.usdt_b.toFixed(1)}B</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#3b82f6', fontWeight: 700 }}>{c.usdc_b > 0 ? `$${c.usdc_b.toFixed(1)}B` : '—'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 900 }}>${c.total_b.toFixed(1)}B</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{c.share_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CORRELAÇÃO ── */}
      {tab === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Corr stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {[
              { label: 'Pearson 30D', value: MINT_VS_BTC_CORR_FALLBACK.pearson_30d.toFixed(2), color: '#a78bfa', sub: 'Mint líquido × BTC price' },
              { label: 'Pearson 7D',  value: MINT_VS_BTC_CORR_FALLBACK.pearson_7d.toFixed(2),  color: '#a78bfa', sub: 'Mais forte recentemente' },
              { label: 'Lag Ótimo',   value: `~${MINT_VS_BTC_CORR_FALLBACK.lag_hours_optimal}h`, color: '#60a5fa', sub: 'Tempo até efeito no preço' },
              { label: 'Sinal Atual', value: snap.sigma_vs_7d > 50 ? '🔥 Alta' : '→ Normal', color: snap.sigma_vs_7d > 50 ? '#ef4444' : '#f59e0b', sub: `Desvio vs 7d: +${snap.sigma_vs_7d.toFixed(0)}%` },
            ].map(s => <StatCard key={s.label} {...s} icon="🔗" />)}
          </div>
          {/* Scatter-like area chart */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Mint Net × BTC Buy Volume (30D)</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Comparação visual: barras = mint líquido · linha = volume de compra BTC normalizado</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={DAILY_MINT_BURN_FALLBACK} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 11 }} />
                <ReferenceLine y={avg7dNet} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" />
                <Bar dataKey="total_net" name="Mint Net ($M)" fill="#a78bfa" opacity={0.7} radius={[2,2,0,0]} />
                <Line dataKey="btc_buy_vol_b" name="BTC Buy Vol ($B)" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Interpretation */}
          <div style={{ padding: '13px 15px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>🔗 Interpretação da Correlação</div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.8 }}>{MINT_VS_BTC_CORR_FALLBACK.note}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, color: '#334155' }}>📌 <strong style={{ color: '#475569' }}>Mint grande isolado</strong> = capital sendo preparado para deploy. Alta probabilidade de compra em 6-24h.</div>
              <div style={{ fontSize: 10, color: '#334155' }}>📌 <strong style={{ color: '#475569' }}>Burn sem queda de preço</strong> = profit taking institucional — sinal de atenção.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}