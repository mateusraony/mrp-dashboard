// ─── DERIVATIVES ADVANCED — Liquidation Heatmap · OI by Strike · Carry Calculator
import { useState } from 'react';
import {
  liquidationClusters, futuresBasis,
} from '../components/data/mockDataExtended';
import { btcOptionsExtended } from '../components/data/mockData';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import AIInsightPanel from '../components/ai/AIInsightPanel';
import IVRankPanel from '../components/options/IVRankPanel';
import TakerFlowPanel from '../components/options/TakerFlowPanel';
import { useOptionsData } from '@/hooks/useDeribit';
import { useBtcTicker, useFuturesBasis, useLiquidations } from '@/hooks/useBtcData';
import { useMacroBoard } from '@/hooks/useFred';
import { DATA_MODE, IS_LIVE } from '@/lib/env';
import { useAiInsight } from '@/hooks/useAiInsight';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ComposedChart, Line,
} from 'recharts';

const SPOT = 0;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtM(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function SectionTitle({ title, sub, badge, mode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{title}</div>
        {badge && <GradeBadge grade={badge} />}
        <ModeBadge mode={mode ?? DATA_MODE} />
      </div>
      {sub && <div style={{ fontSize: 10, color: '#475569' }}>{sub}</div>}
    </div>
  );
}

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
      style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', borderLeft: '3px solid #a78bfa' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && <span style={{ fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{tag}</span>}
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

// ─── Locked placeholder ──────────────────────────────────────────────────────
function LockedSection({ title, reason, url = undefined, urlLabel = undefined, minHeight = 130 }) {
  return (
    <div style={{
      minHeight, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, padding: '28px 20px', textAlign: 'center',
      background: 'rgba(0,0,0,0.12)', border: '1px dashed rgba(100,116,139,0.2)', borderRadius: 10,
    }}>
      <div style={{ fontSize: 32, opacity: 0.4 }}>🔒</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{title}</div>
      <div style={{ fontSize: 11, color: '#334155', maxWidth: 380, lineHeight: 1.7 }}>{reason}</div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          fontSize: 10, color: '#3b82f6', textDecoration: 'none', fontWeight: 700,
          padding: '4px 12px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.25)',
          background: 'rgba(59,130,246,0.05)',
        }}>{urlLabel ?? 'Ver como ativar →'}</a>
      )}
      <div style={{ fontSize: 9, color: '#475569', padding: '2px 10px', borderRadius: 4, background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)' }}>
        Dado <strong style={{ color: '#f97316' }}>não considerado</strong> nas análises de AI
      </div>
    </div>
  );
}

// ─── LIQ HEATMAP — Gráfico de barras horizontal duplo (longs ← | → shorts) ──
// Agrupa liquidações reais em clusters de $500
function buildClustersFromLiquidations(liquidations, spotPrice) {
  if (!liquidations || liquidations.length === 0) return null;
  const BUCKET = 500;
  const bucketMap = new Map();
  for (const liq of liquidations) {
    const price = liq.price ?? liq.average_price ?? 0;
    if (!price) continue;
    const bucket = Math.round(price / BUCKET) * BUCKET;
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, { price: bucket, longs_usd: 0, shorts_usd: 0 });
    const usd = Math.abs(liq.usd_value ?? (price * (liq.qty ?? 0)));
    const side = liq.side ?? liq.positionSide ?? '';
    if (side === 'SELL' || price < spotPrice) {
      bucketMap.get(bucket).longs_usd += usd;
    } else {
      bucketMap.get(bucket).shorts_usd += usd;
    }
  }
  return Array.from(bucketMap.values()).sort((a, b) => a.price - b.price);
}

function LiqHeatmapFull() {
  const { data: ticker } = useBtcTicker();
  const { data: liquidationsRaw } = useLiquidations(50);
  const SPOT_LIVE = ticker?.mark_price ?? SPOT;
  const [hover, setHover] = useState(null);

  const liveClusters = liquidationsRaw && liquidationsRaw.length > 0
    ? buildClustersFromLiquidations(liquidationsRaw, SPOT_LIVE)
    : null;

  const usingLive = liveClusters && liveClusters.length >= 3;
  const d = usingLive ? {
    ...liquidationClusters,
    clusters: liveClusters,
    total_longs_at_risk_10pct: liveClusters.reduce((s, c) => s + (c.price < SPOT_LIVE * 0.9 ? c.longs_usd : 0), 0),
    total_shorts_at_risk_10pct: liveClusters.reduce((s, c) => s + (c.price > SPOT_LIVE * 1.1 ? c.shorts_usd : 0), 0),
    largest_long_cluster: liveClusters.filter(c => c.price < SPOT_LIVE).sort((a, b) => b.longs_usd - a.longs_usd)[0] ?? liquidationClusters.largest_long_cluster,
    largest_short_cluster: liveClusters.filter(c => c.price > SPOT_LIVE).sort((a, b) => b.shorts_usd - a.shorts_usd)[0] ?? liquidationClusters.largest_short_cluster,
    quality: 'A',
  } : liquidationClusters;

  const sorted = [...d.clusters].sort((a, b) => a.price - b.price);
  const maxVal = Math.max(...sorted.map(c => Math.max(c.longs_usd, c.shorts_usd)));

  const longRisk = d.total_longs_at_risk_10pct;
  const shortRisk = d.total_shorts_at_risk_10pct;
  const totalRisk = longRisk + shortRisk;
  const probLongFlush = Math.round((longRisk / totalRisk) * 100);

  const closestLong  = [...sorted].filter(c => c.price < SPOT_LIVE).sort((a, b) => b.price - a.price)[0];
  const closestShort = [...sorted].filter(c => c.price > SPOT_LIVE).sort((a, b) => a.price - b.price)[0];

  const derivAdvPayload = (ticker && usingLive) ? {
    page: 'derivatives_advanced',
    riskScore: 50,
    riskRegime: probLongFlush > 65 ? 'RISCO ELEVADO' : 'MODERADO',
    fearGreedValue: 50,
    fearGreedLabel: 'Neutral',
    fundingRate: ticker.last_funding_rate,
    context: {
      probLongFlush,
      longRiskUsd: longRisk,
      closestLongPrice: closestLong?.price,
      closestShortPrice: closestShort?.price,
    },
  } : null;
  const { data: aiInsightText, isLoading: aiLoading } = useAiInsight(derivAdvPayload);
  const distLong  = closestLong  ? ((SPOT_LIVE - closestLong.price)  / SPOT_LIVE * 100).toFixed(1) : '—';
  const distShort = closestShort ? ((closestShort.price - SPOT_LIVE) / SPOT_LIVE * 100).toFixed(1) : '—';

  return (
    <div>
      <SectionTitle
        title="Liquidation Cluster Heatmap"
        sub={`Spot atual: ${SPOT_LIVE > 0 ? `$${SPOT_LIVE.toLocaleString()}` : '—'} · Barras VERMELHAS = longs que serão liquidados se preço CAIR · VERDES = shorts se preço SUBIR`}
        badge={d.quality}
        mode={IS_LIVE ? 'live' : 'mock'}
      />

      <div style={{ fontSize: 10, color: '#334155', marginBottom: 14, padding: '6px 10px', background: '#0a1220', borderRadius: 6, border: '1px solid #1a2535', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Mostra onde estão concentradas as posições alavancadas que serão liquidadas automaticamente se o preço atingir aquele nível. Clusters grandes = "muralhas" que podem acelerar ou brecar movimentos.
      </div>

      {!usingLive ? (
        <LockedSection
          title="Clustering de liquidações aguardando dados"
          reason="Menos de 3 liquidações recentes detectadas na Binance. O sistema aguarda eventos suficientes para montar clusters confiáveis. Nenhum dado simulado é exibido nesta seção."
          minHeight={160}
        />
      ) : (<>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>
            <Tip text="Total em USD de posições long que seriam forçosamente fechadas se o preço cair 10% a partir do spot atual.">Longs em Risco (−10%)</Tip>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>{fmtM(longRisk)}</div>
          <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>Maior: ${(d.largest_long_cluster.price / 1000).toFixed(0)}K → {fmtM(d.largest_long_cluster.usd)}</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#10b981', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>
            <Tip text="Total em USD de posições short que seriam forçosamente fechadas se o preço subir 10%.">Shorts em Risco (+10%)</Tip>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{fmtM(shortRisk)}</div>
          <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>Maior: ${(d.largest_short_cluster.price / 1000).toFixed(0)}K → {fmtM(d.largest_short_cluster.usd)}</div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>Cluster Long + Próximo</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>{closestLong ? `$${(closestLong.price / 1000).toFixed(0)}K` : '—'}</div>
          <div style={{ fontSize: 8, color: '#334155' }}>−{distLong}% do spot · {fmtM(closestLong?.longs_usd)}</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 8, color: '#10b981', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>Cluster Short + Próximo</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{closestShort ? `$${(closestShort.price / 1000).toFixed(0)}K` : '—'}</div>
          <div style={{ fontSize: 8, color: '#334155' }}>+{distShort}% do spot · {fmtM(closestShort?.shorts_usd)}</div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 9, color: '#475569' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Longs liquidados (preço cai até esse nível)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Shorts liquidados (preço sobe até esse nível)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Preço Spot Atual</span>
      </div>

      {/* Gráfico horizontal duplo */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Lado esquerdo — LONGS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 8, color: '#ef4444', textAlign: 'right', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>← LONGS EM RISCO (se preço cair)</div>
          {sorted.slice().reverse().map((c) => {
            const isAbove = c.price > SPOT_LIVE;
            const val = c.longs_usd;
            const pct = (val / maxVal) * 100;
            const isHov = hover === c.price;
            return (
              <div key={`L-${c.price}`}
                onMouseEnter={() => setHover(c.price)}
                onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, height: 22 }}>
                <div style={{ width: 50, textAlign: 'right', fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: isAbove ? '#1e3048' : '#ef4444', flexShrink: 0 }}>
                  {!isAbove ? fmtM(val) : ''}
                </div>
                <div style={{ flex: 1, height: 16, background: '#0d1421', borderRadius: '3px 0 0 3px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                  {!isAbove && (
                    <div style={{ width: `${pct}%`, height: '100%', background: isHov ? '#f87171' : `rgba(239,68,68,${0.2 + pct/100*0.7})`, borderRadius: '3px 0 0 3px', boxShadow: pct > 50 ? '0 0 8px rgba(239,68,68,0.4)' : 'none' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Centro — PRICE LABELS */}
        <div style={{ width: 70, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', marginTop: 22 }}>
          {sorted.slice().reverse().map((c) => {
            const isSpot = Math.abs(c.price - SPOT_LIVE) < 200;
            const isHov = hover === c.price;
            return (
              <div key={`P-${c.price}`} style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  fontSize: isSpot ? 10 : 9,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: isSpot ? 900 : isHov ? 700 : 400,
                  color: isSpot ? '#f59e0b' : isHov ? '#e2e8f0' : '#475569',
                  padding: isSpot ? '1px 5px' : '0',
                  background: isSpot ? 'rgba(245,158,11,0.1)' : 'transparent',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}>
                  ${(c.price / 1000).toFixed(0)}K{isSpot ? ' ◀▶' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Lado direito — SHORTS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 8, color: '#10b981', textAlign: 'left', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>SHORTS EM RISCO (se preço subir) →</div>
          {sorted.slice().reverse().map((c) => {
            const isAbove = c.price > SPOT_LIVE;
            const val = c.shorts_usd;
            const pct = (val / maxVal) * 100;
            const isHov = hover === c.price;
            return (
              <div key={`S-${c.price}`}
                onMouseEnter={() => setHover(c.price)}
                onMouseLeave={() => setHover(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, height: 22 }}>
                <div style={{ flex: 1, height: 16, background: '#0d1421', borderRadius: '0 3px 3px 0', overflow: 'hidden' }}>
                  {isAbove && (
                    <div style={{ width: `${pct}%`, height: '100%', background: isHov ? '#34d399' : `rgba(16,185,129,${0.2 + pct/100*0.7})`, borderRadius: '0 3px 3px 0', boxShadow: pct > 50 ? '0 0 8px rgba(16,185,129,0.4)' : 'none' }} />
                  )}
                </div>
                <div style={{ width: 50, fontSize: 8, fontFamily: 'JetBrains Mono, monospace', color: isAbove ? '#10b981' : '#1e3048', flexShrink: 0 }}>
                  {isAbove ? fmtM(val) : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {hover && (() => {
        const c = sorted.find(x => x.price === hover);
        if (!c) return null;
        return (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>${(c.price ?? 0).toLocaleString()}</span>
            <span>Longs: <strong style={{ color: '#ef4444' }}>{fmtM(c.longs_usd)}</strong></span>
            <span>Shorts: <strong style={{ color: '#10b981' }}>{fmtM(c.shorts_usd)}</strong></span>
            <span style={{ color: '#475569' }}>{c.price > SPOT_LIVE ? `+${((c.price - SPOT_LIVE)/SPOT_LIVE*100).toFixed(1)}% acima do spot` : `−${((SPOT_LIVE - c.price)/SPOT_LIVE*100).toFixed(1)}% abaixo do spot`}</span>
          </div>
        );
      })()}

      {/* AI Panel */}
      <div style={{ marginTop: 16 }}>
        <AIInsightPanel
          moduleId="LIQ_CLUSTERS"
          probability={probLongFlush}
          regime={probLongFlush > 65 ? 'flush_risk' : probLongFlush > 50 ? 'caution' : 'neutral'}
          recommendation={
            probLongFlush > 65
              ? `Alta concentração de longs em risco — ${fmtM(longRisk)} seriam liquidados em queda de 10%. Reduzir exposição comprada.`
              : `Estrutura equilibrada. Maior ameaça imediata: cluster de longs em ${closestLong ? `$${(closestLong.price/1000).toFixed(0)}K` : '—'} (−${distLong}% do spot).`
          }
          reasoning={`Ratio longs/shorts em risco ±10%: ${probLongFlush}% / ${100 - probLongFlush}%. Cluster mais próximo de longs: ${closestLong ? `$${(closestLong.price/1000).toFixed(0)}K` : '—'} (${fmtM(closestLong?.longs_usd)}). Cluster mais próximo de shorts: ${closestShort ? `$${(closestShort.price/1000).toFixed(0)}K` : '—'} (${fmtM(closestShort?.shorts_usd)}). Short squeeze requereria rompimento de ${closestShort ? `$${(closestShort.price/1000).toFixed(0)}K` : '—'} com volume.`}
          actions={[closestLong ? 'Monitorar $' + (closestLong.price/1000).toFixed(0) + 'K' : 'Aguardando clusters', 'Ver Funding Rate', 'Checar OI Delta']}
          insight={aiInsightText}
          isLoadingInsight={aiLoading}
          modelLabel={aiInsightText ? 'claude-haiku-4-5' : undefined}
        />
      </div>

      </>)}
    </div>
  );
}

// ─── OI BY STRIKE ─────────────────────────────────────────────────────────────
function OIByStrike() {
  const [asset, setAsset] = useState('BTC');
  const d = btcOptionsExtended;
  const { data: ticker } = useBtcTicker();
  const { data: liveOptions } = useOptionsData();

  const spotBtc = ticker?.mark_price ?? SPOT;
  const liveChain = liveOptions?.chain ?? [];
  const isLiveBtc = IS_LIVE && asset === 'BTC' && liveChain.length > 0;
  const isEth = asset === 'ETH';

  const ethStrikes = d.oi_by_strike.map(s => ({
    strike: Math.round(s.strike * 0.0381),
    call_oi: Math.round(s.call_oi * 0.12),
    put_oi: Math.round(s.put_oi * 0.12),
  }));

  const btcStrikes = isLiveBtc
    ? liveChain.map(c => ({ strike: c.strike, call_oi: c.call_oi, put_oi: c.put_oi }))
    : d.oi_by_strike;

  const strikes = asset === 'BTC' ? btcStrikes : ethStrikes.map((s, i) => ({
    ...s, strike: [2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500, 3600][i] || s.strike,
  }));

  const chartData = strikes.map(s => ({
    strike: `$${(s.strike / 1000).toFixed(0)}K`,
    strikeRaw: s.strike,
    call_oi: s.call_oi,
    put_oi: -s.put_oi,
    net: s.call_oi - s.put_oi,
    isAtm: Math.abs(s.strike - (asset === 'BTC' ? spotBtc : 3200)) < (asset === 'BTC' ? 300 : 100),
  }));

  const maxPain = asset === 'BTC' ? (liveOptions?.max_pain ?? d.max_pain) : 3200;
  const gamma = asset === 'BTC' ? (liveOptions?.gamma_exposure_usd ?? d.gamma_exposure_usd) : -28_000_000;
  const pcrVol = asset === 'BTC' ? (liveOptions?.put_call_ratio_vol ?? d.put_call_ratio_vol) : d.put_call_ratio_vol;
  const pcrOi = asset === 'BTC' ? (liveOptions?.put_call_ratio_oi ?? d.put_call_ratio_oi) : d.put_call_ratio_oi;

  const effectiveMode = isLiveBtc ? 'live' : 'mock';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <SectionTitle
          title="Open Interest por Strike"
          sub={`${asset} Options — Calls (verde, acima) · Puts (vermelho, abaixo)`}
          badge={isLiveBtc ? 'A' : d.quality}
          mode={effectiveMode}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!isLiveBtc && (
            <DataTrustBadge mode="paid_required" confidence="D" source="Deribit" sourceUrl="https://www.deribit.com" reason="Chain de opções BTC requer Deribit API com ENABLE_OPTIONS ativo." />
          )}
          {['BTC', 'ETH'].map(a => (
            <button key={a} onClick={() => setAsset(a)} style={{
              padding: '4px 12px', borderRadius: 6,
              background: asset === a ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: `1px solid ${asset === a ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
              color: asset === a ? '#60a5fa' : '#475569',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
            }}>{a}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '6px 10px', background: '#0a1220', borderRadius: 6, border: '1px solid #1a2535', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Mostra onde estão os maiores contratos de opções em aberto. Concentração de calls = mercado apostando em alta naquele strike. Puts = proteção contra queda. O Max Pain é o preço onde a maioria expira sem valor — atração gravitacional próxima de vencimentos.
      </div>

      {(isEth || !isLiveBtc) ? (
        <LockedSection
          title={isEth ? 'ETH Options indisponível' : 'BTC Options indisponível (Deribit inativo)'}
          reason={isEth
            ? 'Opções ETH não têm suporte na API gratuita Deribit. Requer conta com acesso à chain ETH.'
            : 'Chain de opções BTC requer Deribit API ativa. Configure ENABLE_OPTIONS com chave Deribit.'}
          url="https://www.deribit.com"
          urlLabel="Deribit →"
          minHeight={160}
        />
      ) : (<>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[
          {
            label: <Tip text="Razão entre volume de Puts e Calls. Acima de 1.0: mais contratos de venda (proteção/bear). Abaixo de 1.0: mais calls (otimismo). Acima de 1.3 = extrema proteção (pânico ou hedge institucional).">Put/Call Ratio (Vol)</Tip>,
            value: pcrVol.toFixed(2), color: '#f59e0b', sub: 'Por volume',
          },
          {
            label: <Tip text="Razão entre OI em Puts e Calls. Mais estável que o PCR de volume — muda mais lentamente. Acima de 1.2: mercado estruturalmente mais hedgeado.">Put/Call Ratio (OI)</Tip>,
            value: pcrOi.toFixed(2), color: '#a78bfa', sub: 'Por OI',
          },
          {
            label: <Tip text="O preço onde os vendedores de opções (market makers/writers) sofrem menos perdas na expiração. Atua como imã — preço tende a gravitar para cá perto do vencimento. Não é garantia, mas é estatisticamente relevante.">Max Pain</Tip>,
            value: `$${(maxPain / 1000).toFixed(0)}K`, color: '#ef4444', sub: 'Maior expiração s/valor',
          },
          {
            label: <Tip text="GEX (Gamma Exposure) = posição de gamma dos dealers. Negativo: dealers estão short gamma → amplificam volatilidade (seguem o movimento). Positivo: dealers são long gamma → amortizam volatilidade (vendem na alta, compram na queda).">GEX</Tip>,
            value: `${(gamma / 1e6).toFixed(0)}M`, color: gamma < 0 ? '#ef4444' : '#10b981', sub: gamma < 0 ? 'Short gamma dealer' : 'Long gamma dealer',
          },
        ].map((s, i) => (
          <div key={i} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '9px 11px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* OI chart — bidirectional */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
          <XAxis dataKey="strike" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.abs(v / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10 }}
            formatter={(v, name) => [Math.abs(Number(v)).toLocaleString(), name === 'call_oi' ? 'Call OI' : 'Put OI']}
          />
          <ReferenceLine y={0} stroke="#2a3f5f" strokeWidth={1.5} />
          <ReferenceLine x={`$${(maxPain / 1000).toFixed(0)}K`} stroke="rgba(239,68,68,0.5)" strokeDasharray="4 4" label={{ value: 'Max Pain', fill: '#ef4444', fontSize: 8, position: 'insideTopRight' }} />
          <Bar dataKey="call_oi" name="Call OI" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isAtm ? '#22d3ee' : '#10b981'} fillOpacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="put_oi" name="Put OI" radius={[0, 0, 2, 2]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isAtm ? '#f97316' : '#ef4444'} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: '#334155', flexWrap: 'wrap' }}>
        <span>■ <span style={{ color: '#10b981' }}>Calls (acima)</span> — viés comprador</span>
        <span>■ <span style={{ color: '#ef4444' }}>Puts (abaixo)</span> — hedge/proteção</span>
        <span>■ <span style={{ color: '#22d3ee' }}>ATM atual</span></span>
      </div>

      </>)}
    </div>
  );
}

// ─── CARRY CALCULATOR ─────────────────────────────────────────────────────────
function CarryCalculator() {
  const [capital, setCapital] = useState(100000);
  const [selectedExp, setSelectedExp] = useState(0);

  const { data: liveBasis } = useFuturesBasis();
  const futures = (liveBasis && liveBasis.length > 0)
    ? liveBasis.map(f => ({
        expiry:           f.expiry_label,
        price:            f.mark_price,
        days_to_exp:      f.days_to_exp,
        basis_annualized: f.basis_annualized,
      }))
    : futuresBasis.futures;

  const safeIdx = Math.min(selectedExp, Math.max(0, futures.length - 1));
  const f = futures[safeIdx];

  const { data: macroData } = useMacroBoard();
  const us10yEntry = macroData?.series?.find(s => s.id === 'US10Y');
  const US10Y = us10yEntry?.value ?? 4.512;

  const { data: ticker } = useBtcTicker();
  const SPOT_LIVE = ticker?.mark_price ?? SPOT;

  const carryReturn    = capital * (f.basis_annualized / 100) * (f.days_to_exp / 365);
  const riskFreeReturn = capital * (US10Y / 100) * (f.days_to_exp / 365);
  const netCarry       = carryReturn - riskFreeReturn;
  const carrySpread    = f.basis_annualized - US10Y;

  const chartData = futures.map(fx => ({
    expiry: fx.expiry.split('-').slice(0, 2).join('-'),
    basis:  parseFloat(fx.basis_annualized.toFixed(2)),
    spread: parseFloat((fx.basis_annualized - US10Y).toFixed(2)),
    days:   fx.days_to_exp,
    us10y:  US10Y,
  }));

  return (
    <div>
      <SectionTitle
        title="Carry Calculator — Custo de Basis por Vencimento"
        sub={`Basis anualizado vs US10Y (${US10Y}%) · Spot: ${SPOT_LIVE > 0 ? `$${SPOT_LIVE.toLocaleString()}` : '—'}`}
        badge={(liveBasis && liveBasis.length > 0) ? 'A' : futuresBasis.quality}
        mode={(liveBasis && liveBasis.length > 0) ? 'live' : 'mock'}
      />

      <div style={{ fontSize: 10, color: '#334155', marginBottom: 14, padding: '6px 10px', background: '#0a1220', borderRadius: 6, border: '1px solid #1a2535', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Calcula se vale a pena fazer carry trade — comprar BTC spot e vender o futuro trimestral para capturar o prêmio. Se o basis anualizado for maior que o juro americano (US10Y), você ganha a diferença sem risco direcional. Use a calculadora interativa para simular com seu capital.
      </div>

      {/* Basis chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
          <XAxis dataKey="expiry" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v).toFixed(1)}%`} />
          <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10 }} formatter={(v) => [`${Number(v).toFixed(2)}%`, '']} />
          <ReferenceLine y={US10Y} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `US10Y ${US10Y}%`, fill: '#f59e0b', fontSize: 9, position: 'right' }} />
          <Bar dataKey="basis" name="Basis ann." radius={[3,3,0,0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.basis > US10Y ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
            ))}
          </Bar>
          <Line dataKey="spread" name="Spread vs RF" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Basis table */}
      <div style={{ margin: '14px 0 14px' }}>
        <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, fontWeight: 700 }}>Custo de Carry por Vencimento</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {futures.map((fx, i) => {
            const spread = fx.basis_annualized - US10Y;
            const isSelected = safeIdx === i;
            return (
              <div key={i} onClick={() => setSelectedExp(i)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                borderRadius: 8, background: isSelected ? '#131e2e' : '#0d1421',
                border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
                cursor: 'pointer', transition: 'all 0.12s',
              }}>
                <div style={{ width: 90, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{fx.expiry.split('-').slice(0, 2).join(' ')}</div>
                  <div style={{ fontSize: 8, color: '#334155' }}>{fx.days_to_exp}d</div>
                </div>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Preço futuro</div>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 700 }}>${(fx.price ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 8, color: '#334155' }}>Basis ann.</span>
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#10b981', fontWeight: 800 }}>{fx.basis_annualized.toFixed(2)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, fx.basis_annualized / 20 * 100)}%`, background: '#10b981', borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Spread RF</div>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: spread > 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                    {spread > 0 ? '+' : ''}{spread.toFixed(1)}pp
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive calculator */}
      <div style={{ background: '#0d1421', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>🧮 Calculadora de Carry Interativa</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Capital (USD)</label>
            <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
              style={{ background: '#111827', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '7px 10px', width: '100%', fontFamily: 'JetBrains Mono, monospace', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vencimento</label>
            <select value={selectedExp} onChange={e => setSelectedExp(Number(e.target.value))}
              style={{ background: '#111827', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '7px 10px', width: '100%', outline: 'none' }}>
              {futures.map((fx, i) => (
                <option key={i} value={i}>{fx.expiry} ({fx.days_to_exp}d)</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Retorno Carry',    value: `+$${carryReturn.toFixed(0)}`,    color: '#10b981', sub: `${f.basis_annualized.toFixed(1)}% ann. × ${f.days_to_exp}d` },
            { label: 'Custo Risk-Free',  value: `-$${riskFreeReturn.toFixed(0)}`, color: '#f59e0b', sub: `US10Y ${US10Y}% × ${f.days_to_exp}d` },
            { label: 'Net Carry',        value: `${netCarry >= 0 ? '+' : ''}$${netCarry.toFixed(0)}`, color: netCarry >= 0 ? '#10b981' : '#ef4444', sub: `Spread: ${carrySpread > 0 ? '+' : ''}${carrySpread.toFixed(1)}pp` },
          ].map(s => (
            <div key={s.label} style={{ background: '#111827', borderRadius: 8, padding: '9px 11px', border: `1px solid ${s.color}20` }}>
              <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {carrySpread > 0 && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 7, fontSize: 9, color: '#10b981' }}>
            ✅ Carry trade atrativo: basis de {f.basis_annualized.toFixed(1)}% supera a taxa livre de risco em +{carrySpread.toFixed(1)}pp. Estratégia: comprar spot + vender {f.expiry}.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TERM STRUCTURE ───────────────────────────────────────────────────────────
function TermStructurePanel() {
  const { data: liveOptions } = useOptionsData();
  const liveTerm = IS_LIVE && liveOptions?.term_structure?.length ? liveOptions.term_structure : null;

  if (liveTerm) {
    const ivFront = liveTerm[0]?.atm_iv ?? 0;
    const ivBack = liveTerm[liveTerm.length - 1]?.atm_iv ?? 0;
    const isContango = ivFront > ivBack;
    const interpretation = isContango
      ? 'Contango — IV curto prazo acima do longo. Mercado precificando risco imediato ou evento próximo.'
      : 'Backwardation — IV cresce com o prazo. Estrutura normal, incerteza maior no longo prazo.';
    return (
      <div>
        <SectionTitle
          title="Term Structure — IV por Prazo"
          sub={`Deribit BTC · ${liveTerm.length} vencimentos · ${isContango ? 'Contango' : 'Backwardation'}`}
          badge="A"
          mode="live"
        />
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '6px 10px', background: '#0a1220', borderRadius: 6, border: '1px solid #1a2535', display: 'inline-block' }}>
          📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Mostra como a volatilidade implícita varia conforme o prazo das opções. Contango = risco percebido maior no curto prazo (evento iminente). Backwardation = estrutura normal, incerteza cresce com o tempo.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {liveTerm.map((e, i) => {
            const label = e.label.replace('BTC-', '');
            const ivPct = e.atm_iv * 100;
            const barW = Math.min(100, ivPct);
            return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7 }}>
                <div style={{ width: 60, fontSize: 10, fontWeight: 800, color: '#94a3b8', flexShrink: 0 }}>{label}</div>
                <div style={{ width: 40, fontSize: 9, color: '#334155', flexShrink: 0 }}>{e.days_to}d</div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', fontWeight: 800, flexShrink: 0 }}>{ivPct.toFixed(1)}%</div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, borderRadius: 2, background: '#111827', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, background: '#a78bfa', opacity: 0.7 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 9, color: '#64748b', lineHeight: 1.7, padding: '9px 11px', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 7 }}>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>📊 Interpretação: </span>{interpretation}
        </div>
      </div>
    );
  }

  // Deribit indisponível — mostrar cadeado
  return (
    <div>
      <SectionTitle
        title="Term Structure — IV por Prazo"
        sub="Estrutura a termo da volatilidade implícita — Deribit BTC"
        badge="D"
        mode="mock"
      />
      <div style={{ fontSize: 10, color: '#334155', marginBottom: 12, padding: '6px 10px', background: '#0a1220', borderRadius: 6, border: '1px solid #1a2535', display: 'inline-block' }}>
        📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Mostra como a volatilidade implícita varia conforme o prazo das opções. Contango = risco imediato. Backwardation = estrutura normal.
      </div>
      <LockedSection
        title="Term Structure indisponível"
        reason="Term structure real requer Deribit API com ENABLE_OPTIONS ativo. Configure a chave Deribit para ver a estrutura a termo real das opções BTC."
        url="https://www.deribit.com"
        urlLabel="Deribit →"
        minHeight={160}
      />
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = ['Liq. Heatmap', 'OI por Strike', 'Carry Calculator', 'Term Structure', 'IV Rank', 'Taker Flow'];

export function AdvancedContent() {
  const [tab, setTab] = useState(0);
  const { data: liveOptions } = useOptionsData();

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Derivatives Advanced</h1>
          <ModeBadge />
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Liquidation Clusters · OI por Strike (BTC/ETH) · Carry Calculator · Term Structure de IV · IV Rank · Taker Flow
        </p>
      </div>

      {/* Banner "Para que serve" */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(167,139,250,0.07) 0%, rgba(99,102,241,0.05) 100%)', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>⚗️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta aba?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 820 }}>
              <strong style={{ color: '#cbd5e1' }}>Avançado</strong> expande a análise de derivativos com ferramentas usadas por traders profissionais e fundos:
              onde estão os clusters de liquidação, como o mercado de opções está posicionado, e se o carry trade é rentável.{' '}
              <strong style={{ color: '#a78bfa' }}>Use esta aba para responder:</strong>{' '}
              "Onde estão os clusters de liquidação mais próximos? Vale fazer carry trade agora? O mercado de opções está com medo ou ganância?"
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '💥', text: 'Clusters de liquidação por faixa de preço' },
                { icon: '📊', text: 'OI por strike — onde estão as apostas' },
                { icon: '🧮', text: 'Calculadora interativa de carry trade' },
                { icon: '📈', text: 'Estrutura a termo da volatilidade implícita' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: '20px 22px' }}>
        {tab === 0 && <LiqHeatmapFull />}
        {tab === 1 && <OIByStrike />}
        {tab === 2 && <CarryCalculator />}
        {tab === 3 && <TermStructurePanel />}
        {tab === 4 && <IVRankPanel optionsData={liveOptions} />}
        {tab === 5 && <TakerFlowPanel optionsData={liveOptions} />}
      </div>

      {/* Dicas de Ouro */}
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar Derivatives Avançado</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Conceitos usados por traders institucionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="💥"
            title="Cluster grande = acelerador ou freio de movimentos"
            tag="CLUSTERS"
            body="Quando há um cluster enorme de longs logo abaixo do spot (ex: $5B em $94K), se o preço chegar naquele nível, todas essas posições serão liquidadas automaticamente — criando uma avalanche de vendas que acelera a queda. Por outro lado, um cluster grande de shorts acima atua como 'resistência magnética' que pode provocar short squeeze se rompido."
          />
          <TipCard
            emoji="📊"
            title="PCR > 1.2 = mercado em modo defensivo"
            tag="OPTIONS"
            body="Quando o Put/Call Ratio de volume ultrapassa 1.2, significa que muito mais contratos de venda (puts) estão sendo negociados do que compras (calls). Isso indica hedge institucional ou medo generalizado. Paradoxalmente, PCR extremamente alto (>1.5) pode ser sinal contrarian bullish — quando TODOS estão comprado proteção, o pior já pode ter precificado."
          />
          <TipCard
            emoji="🎯"
            title="Max Pain — a gravitação das opções"
            tag="OPTIONS"
            body="O Max Pain é o preço onde os compradores de opções perdem mais dinheiro (onde mais opções expiram sem valor). Os market makers que venderam essas opções têm incentivo para empurrar o preço nessa direção. Não é garantia, mas nas últimas 24-48h antes do vencimento, o preço frequentemente converge para o Max Pain com mais de 60% de probabilidade."
          />
          <TipCard
            emoji="⚡"
            title="GEX negativo = dealers amplificam o movimento"
            tag="GEX"
            body="Quando o Gamma Exposure (GEX) dos dealers é negativo, eles estão Short Gamma — precisam vender quando o preço cai e comprar quando sobe para se hedgearem. Isso AMPLIFICA a volatilidade. Em GEX positivo (Long Gamma), os dealers fazem o oposto: compram na queda e vendem na alta, AMORTECENDO a volatilidade. GEX muito negativo + liquidações próximas = combinação explosiva."
          />
          <TipCard
            emoji="🧮"
            title="Carry trade: capturando basis sem risco direcional"
            tag="CARRY"
            body="Se o futuro trimestral de BTC está a +15% anualizado e o juro americano está em 4.5%, a diferença de +10.5% é capturable sem apostar na direção do preço: compra BTC spot + vende o futuro. No vencimento, você recebe o prêmio independente de BTC subir ou cair. O risco é execution (slippage, custos de custódia) e o basis se comprimir antes do vencimento."
          />
          <TipCard
            emoji="📈"
            title="Contango de IV = evento próximo esperado"
            tag="TERM STRUCTURE"
            body="Quando a volatilidade implícita de curto prazo (1W) está ACIMA da de longo prazo (3M+), a term structure está em contango invertido. Isso indica que o mercado precifica um risco específico em breve (FOMC, halving, regulação). Operadores de volatilidade vendem IV cara de curto prazo e compram IV barata de longo prazo nesse cenário."
          />
          <TipCard
            emoji="🌊"
            title="IV Rank > 80%: venda de volatilidade é atraente"
            tag="IV RANK"
            body="IV Rank mostra onde a volatilidade atual está em relação ao histórico de 1 ano (0% = mínima histórica, 100% = máxima histórica). Com IV Rank > 80%, a volatilidade está cara comparada ao histórico — vender premium (puts cobertas, strangles) tem expectativa positiva pois IV tende a reverter para a média. Com IV Rank < 20%, comprar opções é mais barato que o normal."
          />
        </div>
      </div>
    </div>
  );
}
