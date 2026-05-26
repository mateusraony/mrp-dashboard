import { useState } from 'react';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import { ModeBadge } from '../components/ui/DataBadge';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { useAiInsight } from '@/hooks/useAiInsight';
import { IS_LIVE } from '@/lib/env';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Line,
} from 'recharts';
import { format } from 'date-fns';
import { useKlines, useKlinesMeta, useBtcTicker, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { readModuleFlag } from '@/lib/moduleFlags';
import { DisabledModuleBanner } from '@/components/ui/DisabledModuleBanner';
import { computeSessionStats } from '@/utils/sessionAnalytics';

const fmtNum  = (v, d = 0) => v != null ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtPct  = (v, sign = true) => v != null ? `${sign && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%` : '—';
const fmtUsd  = (v) => v != null ? `$${(v / 1e9).toFixed(2)}B` : '—';
const retColor = (v) => v > 0.001 ? '#10b981' : v < -0.001 ? '#ef4444' : '#94a3b8';

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

// ─── Fallbacks ────────────────────────────────────────────────────────────────
const SPOT_FALLBACK = {
  price: 0,
  ret_15m: 0, ret_1h: 0, ret_4h: 0, ret_1d: 0, ret_1w: 0, ret_1m: 0,
  volume_1h_usdt: 0, volume_1d_usdt: 0, volume_1w_usdt: 0,
  cvd: 0, cvd_1d: 0, cvd_1w: 0,
  taker_buy: 1, taker_sell: 1,
  klines: [],
};
const AI_MODULE_FALLBACK = {
  direction: 'neutral', signal: '', score: 0,
  probability: 0, confidence: 0,
  timeframe: '—', trigger: '—', analysis: '',
};
const AI_SPOT_FALLBACK = { modules: { spot: AI_MODULE_FALLBACK } };

function computeSpotMetrics(klines, btcPrice) {
  if (!klines || klines.length < 2) return null;
  const last  = klines[klines.length - 1];
  const price = btcPrice ?? last.close;

  const retSince = (n) => {
    const idx = klines.length - 1 - n;
    return idx >= 0 ? (last.close - klines[idx].close) / klines[idx].close : null;
  };
  const sumVolUsdt = (n) =>
    klines.slice(-Math.min(n, klines.length)).reduce((s, k) => s + k.volume * k.close, 0);
  const sumCvd = (n) =>
    klines.slice(-Math.min(n, klines.length)).reduce((s, k) => s + (2 * k.taker_buy - k.volume), 0);
  const hasFullWeek = klines.length >= 168;

  return {
    price,
    ret_1h:         retSince(1)  ?? 0,
    ret_4h:         retSince(4)  ?? 0,
    ret_1d:         retSince(24) ?? 0,
    volume_1h_usdt: sumVolUsdt(1),
    volume_1d_usdt: sumVolUsdt(24),
    ...(hasFullWeek ? { volume_1w_usdt: sumVolUsdt(168) } : {}),
    cvd:            sumCvd(4),
    cvd_1d:         sumCvd(24),
    ...(hasFullWeek ? { cvd_1w: sumCvd(168) } : {}),
    taker_buy:      klines.reduce((a, k) => a + k.taker_buy, 0),
    taker_sell:     klines.reduce((a, k) => a + (k.volume - k.taker_buy), 0),
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SpotFlow() {
  const spotEnabled = readModuleFlag('ENABLE_SPOT_FLOW');
  const { data: klines, isLoading: klinesLoading } = useKlines('1h', 168, spotEnabled);
  const { data: klines15m } = useKlines('15m', 4,  spotEnabled);
  const { data: klines1d }  = useKlines('1d',  32, spotEnabled);
  const { data: klinesMeta } = useKlinesMeta('1h', 168, spotEnabled);
  const { data: ticker }    = useBtcTicker(spotEnabled);
  const { data: riskData }  = useRiskScore();
  const { data: fngData }   = useFearGreed();

  const btcPrice = ticker?.mark_price ?? klines?.at(-1)?.close ?? 0;
  const liveSpot = computeSpotMetrics(klines, btcPrice);
  const s = liveSpot ? { ...SPOT_FALLBACK, ...liveSpot } : SPOT_FALLBACK;

  const ret15m = (() => {
    if (!klines15m || klines15m.length < 2) return 0;
    return (klines15m.at(-1).close - klines15m.at(-2).close) / klines15m.at(-2).close;
  })();
  const ret1M = (() => {
    if (!klines1d || klines1d.length < 30) return 0;
    return (klines1d.at(-1).close - klines1d.at(-30).close) / klines1d.at(-30).close;
  })();
  const ret1w = (() => {
    if (!klines1d || klines1d.length < 7) return 0;
    return (klines1d.at(-1).close - klines1d.at(-7).close) / klines1d.at(-7).close;
  })();
  Object.assign(s, { ret_15m: ret15m, ret_1m: ret1M, ret_1w: ret1w });

  const liveAnalysis = IS_LIVE && liveSpot
    ? computeRuleBasedAnalysis({ spot: { ret1d: liveSpot.ret_1d, cvd1d: liveSpot.cvd_1d, volume1dUsdt: liveSpot.volume_1d_usdt, price: liveSpot.price } })
    : null;
  const aiAnalysis = liveAnalysis ?? AI_SPOT_FALLBACK;

  const spotPayload = liveSpot ? {
    page: 'spot_flow',
    riskScore:      riskData?.score ?? 50,
    riskRegime:     riskData?.regime ?? 'MODERADO',
    fearGreedValue: fngData?.value ?? 50,
    fearGreedLabel: fngData?.label ?? 'Neutral',
    fundingRate:    ticker?.last_funding_rate ?? 0,
    context: { ret1d: liveSpot.ret_1d, cvd: liveSpot.cvd_1d, volume1dB: liveSpot.volume_1d_usdt / 1e9 },
  } : null;
  const { data: spotInsight, isLoading: spotAiLoading } = useAiInsight(spotPayload);

  const sessionList = (klines && klines.length >= 24)
    ? computeSessionStats(klines, btcPrice)
    : [];

  const klinesSource = klines && klines.length > 0 ? klines : [];
  const chartData = klinesSource.map(k => ({
    time:   format(new Date(k.time), 'HH:mm'),
    close:  parseFloat(k.close.toFixed(0)),
    bull:   k.close >= k.open ? parseFloat(k.volume.toFixed(0)) : 0,
    bear:   k.close < k.open  ? parseFloat(k.volume.toFixed(0)) : 0,
  }));

  const isStale   = klinesMeta?.isFallback || ticker?.isFallback;
  const staleDate = klinesMeta?.lastUpdated ?? ticker?.lastUpdated;

  // Sessão ativa agora (UTC)
  const utcHour = new Date().getUTCHours();
  const activeSessionLabel = utcHour < 8 ? 'Ásia' : utcHour < 16 ? 'Europa' : 'EUA';
  const isOverlapEuUsa     = utcHour >= 12 && utcHour < 16;

  // Detecção de divergência CVD × Preço (sinal profissional)
  const priceSignificant = Math.abs(s.ret_1d) > 0.005;
  const divergence = priceSignificant
    ? (s.ret_1d > 0 && s.cvd_1d < 0) ? 'bearish'
    : (s.ret_1d < 0 && s.cvd_1d > 0) ? 'bullish'
    : null
    : null;

  // ── Veredicto geral ──────────────────────────────────────────────────────────
  const takerBuyPct = (s.taker_buy / (s.taker_buy + s.taker_sell)) * 100;
  const cvdScore    = s.cvd_1d > 0 ? 1 : s.cvd_1d < 0 ? -1 : 0;
  const retScore    = s.ret_1d > 0.005 ? 1 : s.ret_1d < -0.005 ? -1 : 0;
  const takerScore  = takerBuyPct > 52 ? 1 : takerBuyPct < 48 ? -1 : 0;
  const totalScore  = cvdScore + retScore + takerScore;

  const verdict = totalScore >= 2
    ? { label: 'COMPRADORES DOMINANDO', color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', icon: '▲', text: 'Mais dinheiro está entrando do que saindo. Os compradores estão no controle agora.' }
    : totalScore <= -2
    ? { label: 'VENDEDORES DOMINANDO', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', icon: '▼', text: 'Mais dinheiro está saindo do que entrando. Os vendedores estão no controle agora.' }
    : { label: 'MERCADO EQUILIBRADO', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', icon: '◆', text: 'Compradores e vendedores estão empatados. Sem tendência clara no momento.' };

  if (!spotEnabled) return <DisabledModuleBanner moduleName="ENABLE_SPOT_FLOW" />;

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  if (klinesLoading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>BTC Spot Flow</h1>
          <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3 }}>Carregando dados da Binance… <ModeBadge /></p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ height: 10, borderRadius: 3, background: '#1e2d45', marginBottom: 8, width: '55%' }} />
              <div style={{ height: 20, borderRadius: 3, background: '#1e2d45', width: '75%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── CABEÇALHO ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
            BTC Spot Flow
          </h1>
          <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Binance Spot · BTCUSDT · dados ao vivo · <ModeBadge /></span>
            {isStale && staleDate && (
              <span title={`Última atualização: ${new Date(staleDate).toLocaleString('pt-BR')}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#f59e0b', cursor: 'help' }}>
                ⚠ Cache · {new Date(staleDate).toLocaleDateString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
          ${fmtNum(s.price, 0)}
          <span style={{ fontSize: 13, marginLeft: 8, color: retColor(s.ret_1d), fontWeight: 600 }}>
            {fmtPct(s.ret_1d)}
          </span>
        </div>
      </div>

      {/* ── O QUE É ESTA PÁGINA ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>📊</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              <strong style={{ color: '#cbd5e1' }}>Spot Flow</strong> analisa o fluxo de <strong style={{ color: '#cbd5e1' }}>dinheiro real</strong> entrando e saindo do Bitcoin — diferente de derivativos (contratos futuros), aqui estamos vendo quem está <em>realmente comprando ou vendendo BTC</em> com dinheiro de verdade.{' '}
              <strong style={{ color: '#3b82f6' }}>Use esta página para responder:</strong>{' '}
              "A alta (ou queda) do BTC está sendo sustentada por compradores de verdade, ou é uma movimentação sem força?" — Se sim, a tendência tende a continuar. Se não, pode reverter.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', text: 'Confirmar se uma alta tem compradores reais por trás' },
                { icon: '🔍', text: 'Detectar acumulação silenciosa em quedas' },
                { icon: '⚠️', text: 'Identificar subidas fracas sem suporte de volume' },
                { icon: '🌍', text: 'Ver qual região do mundo está comprando mais' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER CACHE ────────────────────────────────────────────────────────── */}
      {isStale && staleDate && (
        <div style={{ marginBottom: 16, padding: '7px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>⚠ Dados de cache — números podem estar desatualizados</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Última atualização: {new Date(staleDate).toLocaleString('pt-BR')}</span>
        </div>
      )}

      {/* ── ALERTA DE DIVERGÊNCIA CVD × PREÇO ───────────────────────────────────── */}
      {divergence === 'bearish' && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>Divergência Bearish Detectada</div>
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
              O preço subiu <strong style={{ color: '#e2e8f0' }}>{fmtPct(s.ret_1d)}</strong> nas últimas 24h, mas o CVD está <strong style={{ color: '#ef4444' }}>negativo</strong> — os compradores não são agressivos o suficiente para sustentar essa alta. Traders experientes chamam isso de "distribuição disfarçada". Pode indicar reversão.
            </div>
          </div>
        </div>
      )}
      {divergence === 'bullish' && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🔍</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 2 }}>Divergência Bullish Detectada — Possível Acumulação</div>
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
              O preço caiu <strong style={{ color: '#e2e8f0' }}>{fmtPct(s.ret_1d)}</strong> nas últimas 24h, mas o CVD está <strong style={{ color: '#10b981' }}>positivo</strong> — alguém está comprando mesmo enquanto o preço cede. Pode indicar acumulação silenciosa por parte de grandes players. Sinal de possível reversão.
            </div>
          </div>
        </div>
      )}

      {/* ── VEREDICTO DO MERCADO ─────────────────────────────────────────────────── */}
      <div style={{
        background: verdict.bg, border: `1px solid ${verdict.border}`,
        borderRadius: 14, padding: '20px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40, lineHeight: 1, color: verdict.color }}>{verdict.icon}</div>
          <div>
            <div style={{ fontSize: 10, color: verdict.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Veredicto do Mercado Agora</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: verdict.color, letterSpacing: '-0.02em', marginBottom: 4 }}>{verdict.label}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 460 }}>{verdict.text}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Placar Compra</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>{takerBuyPct.toFixed(1)}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Placar Venda</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>{(100 - takerBuyPct).toFixed(1)}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Volume 24h</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{fmtUsd(s.volume_1d_usdt)}</div>
          </div>
        </div>
      </div>

      {/* ── PRESSÃO DE COMPRA / VENDA ────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              <Tip text="CVD = Cumulative Volume Delta. É como um placar: soma todas as compras agressivas e subtrai todas as vendas agressivas. Se o CVD sobe enquanto o preço sobe, a tendência é real. Se o CVD cai enquanto o preço sobe, cuidado — pode ser falso.">
                Pressão Compradora × Vendedora
              </Tip>
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Quem está botando mais dinheiro no mercado agora</div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'CVD 4h', value: s.cvd,    hint: 'Últimas 4 horas' },
              { label: 'CVD 1D', value: s.cvd_1d, hint: 'Últimas 24 horas' },
              { label: 'CVD 7D', value: s.cvd_1w, hint: 'Últimos 7 dias' },
            ].map(c => (
              <div key={c.label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: '#4a5568', marginBottom: 2 }}>
                  <Tip text={`${c.hint}: soma das compras agressivas menos vendas agressivas em BTC. Positivo = compradores na frente.`}>{c.label}</Tip>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: (c.value ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {(c.value ?? 0) >= 0 ? '+' : ''}{fmtNum(c.value ?? 0, 0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gauge de pressão */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 9, color: '#4a5568' }}>
            <span>◀ Vendedores dominam</span>
            <span>Compradores dominam ▶</span>
          </div>
          <div style={{ background: '#1e2d45', borderRadius: 6, height: 14, overflow: 'hidden', position: 'relative' }}>
            {/* fundo dividido */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <div style={{ flex: 1, background: 'rgba(239,68,68,0.15)' }} />
              <div style={{ flex: 1, background: 'rgba(16,185,129,0.15)' }} />
            </div>
            {/* indicador */}
            <div style={{
              position: 'absolute', top: 2, width: 10, height: 10, borderRadius: '50%',
              background: retColor(s.ret_1d),
              left: `calc(${Math.max(5, Math.min(95, takerBuyPct))}% - 5px)`,
              boxShadow: `0 0 6px ${retColor(s.ret_1d)}`,
              transition: 'left 0.6s ease',
            }} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 5, fontSize: 10, color: '#94a3b8' }}>
            <strong style={{ color: takerBuyPct > 50 ? '#10b981' : '#ef4444' }}>{takerBuyPct.toFixed(1)}%</strong> das ordens foram de <strong>compra agressiva</strong> nas últimas 24h
            {' '}· {fmtNum(s.taker_buy / 1000, 1)}K BTC comprados × {fmtNum(s.taker_sell / 1000, 1)}K vendidos
          </div>
        </div>

        {/* Guia de interpretação do CVD */}
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#0a1220', border: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Como interpretar estes números</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {[
              { icon: '🟢', cond: 'CVD positivo + preço subindo', result: 'Alta confirmada com compradores reais. Tendência forte.' },
              { icon: '🔴', cond: 'CVD negativo + preço caindo', result: 'Queda confirmada com vendedores reais. Evite comprar agora.' },
              { icon: '⚠️', cond: 'CVD negativo + preço subindo', result: 'Alta sem suporte real. Risco de reversão (veja alerta acima).' },
              { icon: '🔍', cond: 'CVD positivo + preço caindo', result: 'Alguém está comprando a queda. Possível reversão próxima.' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, lineHeight: 1.2 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                  <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RETORNOS DE PREÇO ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Variação de Preço por Período</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Verde = BTC subiu · Vermelho = BTC caiu · naquele período de tempo</div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Ver se o BTC está em tendência de curto, médio ou longo prazo. Compare os períodos — se todos vermelhos, tendência de baixa generalizada. Se só 15m vermelho e 1D verde, é apenas uma correção pontual.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {[
            { label: '15 minutos', short: '15m', value: s.ret_15m, hint: 'Variação do preço nos últimos 15 minutos' },
            { label: '1 hora',     short: '1h',  value: s.ret_1h,  hint: 'Variação do preço na última hora' },
            { label: '4 horas',    short: '4h',  value: s.ret_4h,  hint: 'Variação do preço nas últimas 4 horas' },
            { label: '1 dia',      short: '1D',  value: s.ret_1d,  hint: 'Variação do preço nas últimas 24 horas' },
            { label: '1 semana',   short: '1W',  value: s.ret_1w,  hint: 'Variação do preço nos últimos 7 dias' },
            { label: '1 mês',      short: '1M',  value: s.ret_1m,  hint: 'Variação do preço nos últimos 30 dias' },
          ].map(m => {
            const c = retColor(m.value);
            return (
              <div key={m.short} style={{ background: '#0d1421', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${c}` }}>
                <div style={{ fontSize: 9, color: '#4a5568', marginBottom: 4 }}>
                  <Tip text={m.hint}>Últimos {m.label}</Tip>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: c }}>
                  {fmtPct(m.value)}
                </div>
                <div style={{ fontSize: 9, color: c === '#94a3b8' ? '#4a5568' : c, marginTop: 2, opacity: 0.8 }}>
                  {m.value > 0.001 ? '▲ Alta' : m.value < -0.001 ? '▼ Queda' : '▸ Estável'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SESSÕES DE MERCADO ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              <Tip text="O mercado cripto não fecha nunca, mas traders de regiões diferentes operam em horários distintos. Ásia opera à noite no Brasil. Europa abre de manhã. EUA domina à tarde. Saber quem comprou ou vendeu em cada sessão ajuda a entender a força do movimento.">
                Quem Mandou Hoje? — Sessões de Mercado
              </Tip>
            </div>
            <span style={{ fontSize: 9, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>
              LIVE
            </span>
            {isOverlapEuUsa && (
              <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>
                ⚡ OVERLAP EU-EUA — MÁXIMA VOLATILIDADE
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Análise das últimas 48h dividida por janela geográfica · Binance 1h klines</div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Saber de qual país/região veio a pressão de compra ou venda. Se EUA comprou muito mas Ásia vendeu, o mercado pode abrir em queda amanhã de madrugada. Se todas as sessões compraram, é sinal mais forte.
          </div>
        </div>

        {sessionList.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 12, background: '#111827', border: '1px solid #1e2d45', fontSize: 11, color: '#4a5568', textAlign: 'center' }}>
            Aguardando dados suficientes de klines (mínimo 24 candles)…
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {sessionList.map((sess) => {
              const isBuy     = sess.dominant_side === 'buy';
              const isNeutral = sess.dominant_side === 'neutral';
              const badgeColor = isBuy ? '#10b981' : isNeutral ? '#f59e0b' : '#ef4444';
              const badgeBg   = isBuy ? 'rgba(16,185,129,0.12)' : isNeutral ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
              return (
                <div key={sess.label} style={{
                  background: '#111827',
                  borderTop: `3px solid ${sess.color}`,
                  border: `1px solid ${sess.color}22`,
                  borderRadius: 12, padding: '16px 18px',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>{sess.label}</div>
                        {sess.label === activeSessionLabel && (
                          <span style={{ fontSize: 8, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                            ● ATIVA AGORA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                        {sess.utc} UTC · {sess.brt} BRT
                      </div>
                    </div>
                    <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 700, background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}44` }}>
                      {isBuy ? '▲ COMPRADORES' : isNeutral ? '◆ NEUTRO' : '▼ VENDEDORES'}
                    </div>
                  </div>

                  {/* Métricas com legenda */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: '#0d1421', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>
                        <Tip text="Placar compras−vendas agressivas nessa sessão. Positivo = mais gente comprando urgente.">Pressão (CVD)</Tip>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: sess.cvd >= 0 ? '#10b981' : '#ef4444' }}>
                        {sess.cvd >= 0 ? '+' : ''}{(sess.cvd / 1000).toFixed(1)}K
                      </div>
                    </div>
                    <div style={{ background: '#0d1421', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>
                        <Tip text="Quanto o BTC subiu ou caiu do início ao fim desta sessão.">Movimento</Tip>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: sess.price_move_pct >= 0 ? '#10b981' : '#ef4444' }}>
                        {sess.price_move_pct >= 0 ? '+' : ''}{sess.price_move_pct.toFixed(2)}%
                      </div>
                    </div>
                    <div style={{ background: '#0d1421', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>
                        <Tip text="Total de dinheiro movimentado nessa sessão em bilhões de dólares.">Volume USD</Tip>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                        ${sess.volume_usd_b.toFixed(2)}B
                      </div>
                    </div>
                    <div style={{ background: '#0d1421', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>
                        <Tip text="% das ordens que foram compras agressivas (acima de 52% = compradores ativos, abaixo de 48% = vendedores ativos).">% Compradores</Tip>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: sess.taker_buy_pct > 50 ? '#10b981' : '#ef4444' }}>
                        {sess.taker_buy_pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Barra de pressão */}
                  <div style={{ height: 5, borderRadius: 3, background: '#1e2d45', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: `${sess.taker_buy_pct}%`, background: sess.taker_buy_pct > 50 ? '#10b981' : '#ef4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.6 }}>{sess.signal}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── GRÁFICO VOLUME + PREÇO ────────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Preço + Volume — Últimas 48h</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Candles de 1h · Binance Spot</div>
            <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>
              📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Ver se o volume (as barras) confirma o movimento do preço (a linha azul). Barras altas em verde com preço subindo = força real. Barras baixas = mercado sem convicção.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#94a3b8', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(16,185,129,0.5)', display: 'inline-block' }} /> Candle de alta (fechou acima)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239,68,68,0.5)', display: 'inline-block' }} /> Candle de queda (fechou abaixo)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 2, background: '#3b82f6', display: 'inline-block' }} /> Preço BTC</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData.slice(-48)} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} interval={7} />
            <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} domain={['auto', 'auto']} width={55} />
            <YAxis yAxisId="vol" orientation="left" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, name) => name === 'close' ? [`$${v.toLocaleString()}`, 'Preço'] : [v.toLocaleString(), name === 'bull' ? 'Volume alta' : 'Volume queda']}
            />
            <Bar yAxisId="vol" dataKey="bull" fill="rgba(16,185,129,0.45)" radius={[1,1,0,0]} name="bull" />
            <Bar yAxisId="vol" dataKey="bear" fill="rgba(239,68,68,0.45)" radius={[1,1,0,0]} name="bear" />
            <Line yAxisId="price" type="monotone" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#0d1421', fontSize: 10, color: '#64748b' }}>
          💡 <strong style={{ color: '#94a3b8' }}>Como ler:</strong> Barras altas em verde com preço subindo = força real. Barras altas em vermelho com preço caindo = venda intensa. Barras pequenas = mercado sem convicção.
        </div>
      </div>

      {/* ── ANÁLISE INTELIGENTE ──────────────────────────────────────────────────── */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Análise Inteligente do Fluxo</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Sinal calculado por regras quantitativas (CVD · volume · retorno) + interpretação do Claude AI</div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', display: 'inline-block' }}>
            📌 <strong style={{ color: '#94a3b8' }}>Para que serve:</strong> Resume tudo o que você viu acima em um único sinal de direção (BULLISH / BEARISH / NEUTRAL) com score de 0–100. O Claude AI traduz os números em uma frase de análise. Use como confirmação final, não como único critério.
          </div>
        </div>
        <AIModuleCard module={aiAnalysis.modules.spot} title="Spot Flow" icon="⟴" />
        {/* Claude insight */}
        {(spotInsight || spotAiLoading) && (
          <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: 8, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>✦ Claude AI — Interpretação em português</div>
            {spotAiLoading && !spotInsight
              ? <div style={{ height: 12, borderRadius: 3, background: 'rgba(59,130,246,0.1)' }} />
              : <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>{spotInsight}</div>
            }
          </div>
        )}
      </div>

      {/* ── DICAS DE OURO ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🏆 Dicas de Ouro — Como Interpretar Spot Flow</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Clique em cada dica para expandir · Regras usadas por traders profissionais</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="📈"
            title="CVD subindo + preço subindo = tendência real"
            tag="CONFIRMAÇÃO"
            body="Quando o CVD e o preço sobem juntos, significa que existem compradores genuínos empurrando o mercado. É o sinal mais confiável de força. Já quando o preço sobe mas o CVD cai (divergência), desconfie — pode ser uma alta manipulada que vai reverter."
          />
          <TipCard
            emoji="⚠️"
            title="CVD negativo com preço estável = alerta de queda"
            tag="DIVERGÊNCIA"
            body="Se o preço não está caindo mas o CVD está negativo e piorando, significa que os vendedores estão absorvendo silenciosamente as compras. Eventualmente o preço vai ceder. Traders experientes chamam isso de 'distribuição disfarçada'."
          />
          <TipCard
            emoji="🌏"
            title="A sessão asiática dá o tom do dia"
            tag="SESSÕES"
            body="Quando a Ásia compra com força (CVD positivo + taker buy > 53%), é comum a Europa e os EUA continuarem o movimento. Mas se a Ásia vende e os EUA compra na resistência, há um conflito: geralmente o volume americano decide. EUA tem o maior volume do dia e costuma definir o fechamento."
          />
          <TipCard
            emoji="💧"
            title="Volume baixo = qualquer sinal pode ser falso"
            tag="VOLUME"
            body="Sinais de CVD e retorno só são confiáveis quando o volume está acima da média. Se o volume do dia está abaixo de $15B, movimentos de +2% ou −2% podem ser apenas falta de liquidez, não pressão real. Sempre veja o 'Volume 24h' para contexto."
          />
          <TipCard
            emoji="🎯"
            title="Taker Buy% acima de 55% = acumulação institucional"
            tag="TAKER FLOW"
            body="Quando acima de 55% das ordens são de COMPRA e o preço ainda não subiu muito, pode indicar que instituições estão acumulando sem chamar atenção. Elas compram em partes para não mover o preço. Quando esse percentual aparece junto com CVD positivo e volume alto, é sinal forte."
          />
          <TipCard
            emoji="🔄"
            title="Alta no volume sem movimento de preço = indecisão"
            tag="ARMADILHA"
            body="Se o volume explodir mas o preço não se mover, significa que compradores e vendedores estão igualmente fortes — o mercado está travado. Isso costuma preceder movimentos bruscos. Fique atento: quando o equilíbrio quebrar, o movimento tende a ser forte."
          />
        </div>
      </div>

    </div>
  );
}
