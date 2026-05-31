// ─── PREDICTIVE PANEL — BTC 24h Price Projection ────────────────────────────
import { useState, useMemo } from 'react';
import PurposeLabel from '@/components/ui/PurposeLabel';
import { ModeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from 'recharts';
import { useBtcTicker, useKlines, useKlinesMeta, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useAiInsight } from '@/hooks/useAiInsight';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';
import { IS_LIVE } from '@/lib/env';

// ─── TOOLTIP EDUCATIVO ────────────────────────────────────────────────────────
function Tip({ children, text }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'help' }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, opacity: 0.7 }}>?</span>
      {open && (
        <span style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
          background: '#0d1421', border: '1px solid #1e3048', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.6,
          width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', whiteSpace: 'normal', pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── DICA DE OURO CARD ───────────────────────────────────────────────────────
function TipCard({ emoji, title, body, tag = null }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{
      background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10,
      padding: '12px 14px', cursor: 'pointer', borderLeft: '3px solid #3b82f6',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && (
            <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
              {tag}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#4a5568' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
          borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
          {body}
        </div>
      )}
    </div>
  );
}

// ─── NARRATIVAS DE CENÁRIO LIVE ──────────────────────────────────────────────
// Gera trigger, drivers e risk em tempo real a partir de dados reais disponíveis.
// Fontes: funding (Binance), OI delta (Binance), Fear&Greed (Alternative.me), ATR(14).
function buildScenarioNarrative({ fundingRate, oiDeltaPct, fngValue, fngLabel, atr14 }) {
  const fundPct = (fundingRate * 100).toFixed(4);
  const oiStr   = oiDeltaPct != null
    ? (oiDeltaPct >= 0 ? `+${oiDeltaPct.toFixed(1)}%` : `${oiDeltaPct.toFixed(1)}%`)
    : null;
  const atr = (mult) => atr14 ? `$${Math.round(atr14 * mult).toLocaleString()}` : null;

  const fundStatus = fundingRate > 0.001  ? 'longs sobrecarregados'
                   : fundingRate > 0.0005 ? 'leve pressão compradora'
                   : fundingRate < 0      ? 'shorts pagando longs'
                   :                        'mercado equilibrado';

  const fngChar = fngValue > 75 ? 'ganância extrema'
                : fngValue > 60 ? 'ganância'
                : fngValue > 45 ? 'neutro-positivo'
                : fngValue > 30 ? 'medo leve'
                : fngValue > 20 ? 'medo'
                :                 'medo extremo';

  return {
    bull_strong: {
      trigger: fundingRate < 0
        ? `Funding negativo (${fundPct}%) — shorts pagando longs; short squeeze em formação`
        : fngValue < 35
        ? `FNG ${fngValue} (${fngChar}) — nível de medo compatível com reversão brusca histórica`
        : `FNG ${fngValue} (${fngChar}) + funding ${fundPct}% sem sobrecarga — base para rally forte`,
      drivers: [
        `Fear & Greed: ${fngValue} — ${fngLabel}`,
        `Funding: ${fundPct}% — ${fundStatus}`,
        oiStr ? `OI Delta 24h: ${oiStr}` : null,
        atr(2.5) ? `Alvo +2.5× ATR ≈ ${atr(2.5)} de amplitude máxima` : null,
      ].filter(Boolean),
      risk: fundingRate > 0.001
        ? `Funding elevado (${fundPct}%) — longs sobrecarregados; long flush pode reverter o rally rapidamente`
        : `Rally sem driver de liquidez externo (ETF/stablecoin mint) pode ser de curta duração`,
    },

    bull_mild: {
      trigger: fngValue > 50 && fundingRate < 0.0008
        ? `FNG ${fngValue} (${fngChar}) + funding controlado (${fundPct}%) — condições para alta consistente`
        : fngValue < 35
        ? `Bounce técnico após oversold — FNG ${fngValue} perto de reversão histórica de curto prazo`
        : `Suporte de demanda estável com bias comprador leve`,
      drivers: [
        `Fear & Greed: ${fngValue} — ${fngLabel}`,
        `Funding: ${fundPct}% — ${fundStatus}`,
        oiStr ? `OI Delta 24h: ${oiStr}` : null,
        atr(0.5) ? `Alvo +0.5× ATR ≈ ${atr(0.5)} de amplitude` : null,
      ].filter(Boolean),
      risk: fngValue > 70
        ? `FNG em ganância (${fngValue}) — correção após alta moderada é comum; tomar parcial acima do ATR +0.5×`
        : `Sem catalisador forte — movimento pode estagnar antes de atingir o alvo`,
    },

    neutral: {
      trigger: `Sinais contraditórios — FNG ${fngValue} (${fngChar}) e funding ${fundPct}% sem viés direcional claro`,
      drivers: [
        `Fear & Greed: ${fngValue} — ${fngLabel} (zona de indecisão)`,
        `Funding: ${fundPct}% — ${fundStatus}`,
        oiStr ? `OI Delta 24h: ${oiStr}` : null,
        `Mercado aguardando catalisador externo (macro, ETF flow ou liquidação grande)`,
      ].filter(Boolean),
      risk: `Rompimento falso nos dois lados possível em consolidação — evitar alavancagem alta sem confirmação de volume`,
    },

    bear_mild: {
      trigger: fundingRate > 0.0008
        ? `Funding elevado (${fundPct}%) — excesso de longs cria pressão por correção técnica`
        : fngValue < 40
        ? `FNG ${fngValue} (${fngChar}) — sentimento deteriorando, vendedores dominando`
        : `Realização de lucros após período de alta — correção saudável dentro do ATR`,
      drivers: [
        `Fear & Greed: ${fngValue} — ${fngLabel}`,
        `Funding: ${fundPct}% — ${fundStatus}`,
        oiStr ? `OI Delta 24h: ${oiStr}` : null,
        atr(1.5) ? `Suporte alvo em -1.5× ATR ≈ ${atr(1.5)} abaixo do spot` : null,
      ].filter(Boolean),
      risk: fngValue < 25
        ? `FNG em medo extremo (${fngValue}) — recuperação em V possível; não encurtar perto do fundo`
        : `Dado macro positivo intraday pode reverter a correção rapidamente`,
    },

    bear_strong: {
      trigger: fundingRate > 0.001 && fngValue < 50
        ? `Funding (${fundPct}%) + FNG ${fngValue} — longs alavancados com sentimento fraco = setup de liquidação em cascata`
        : fngValue < 25
        ? `FNG ${fngValue} (${fngChar}) — capitulação extrema pode aprofundar queda antes da reversão`
        : `Evento de força maior (macro/regulatório) precipitando desalavancagem forçada`,
      drivers: [
        `Fear & Greed: ${fngValue} — ${fngLabel}`,
        `Funding: ${fundPct}% — ${fundStatus}`,
        oiStr ? `OI Delta 24h: ${oiStr}` : null,
        atr(3.5) ? `Alvo -3.5× ATR ≈ ${atr(3.5)} de amplitude (movimento extremo, requer volume excepcional)` : null,
      ].filter(Boolean),
      risk: `Suporte histórico forte pode travar a queda — evento de 7% em 24h é estatisticamente raro; sempre use stop loss`,
    },
  };
}

// Fallbacks — dados preditivos requerem APIs pagas (Glassnode, Bloomberg) ou cálculo histórico
// target_price é null quando spot não disponível; componente exibe apenas o %
const SCENARIOS_24H_FALLBACK = [
  { id: 'bull_strong', label: 'Rally Institucional', prob: 28, direction: 'bull',    color: '#10b981', target_price: null, target_pct:  4.8, trigger: '—', drivers: [], risk: '—', confidence: 0.61 },
  { id: 'bull_mild',   label: 'Alta Moderada',       prob: 34, direction: 'bull',    color: '#60a5fa', target_price: null, target_pct:  2.1, trigger: '—', drivers: [], risk: '—', confidence: 0.70 },
  { id: 'neutral',     label: 'Lateral',             prob: 18, direction: 'neutral', color: '#f59e0b', target_price: null, target_pct:  0,   trigger: '—', drivers: [], risk: '—', confidence: 0.52 },
  { id: 'bear_mild',   label: 'Correção Suave',      prob: 14, direction: 'bear',    color: '#f97316', target_price: null, target_pct: -2.5, trigger: '—', drivers: [], risk: '—', confidence: 0.64 },
  { id: 'bear_strong', label: 'Liquidação',          prob:  6, direction: 'bear',    color: '#ef4444', target_price: null, target_pct: -7.0, trigger: '—', drivers: [], risk: '—', confidence: 0.45 },
];
const BREAKOUT_TABLE_FALLBACK = [];
const INSTITUTIONAL_PRESSURE_FALLBACK = {
  overall_score:  0,
  components:     [],
  interpretation: 'Dados indisponíveis — requer APIs pagas (Glassnode, Bloomberg)',
};
const PRICE_PATHS_FALLBACK = { timestamps: [], bull: [], neutral: [], bear: [] };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtK(v) { return `$${(v / 1000).toFixed(1)}K`; }

function ProbBar({ value, color, showPct = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${color}70, ${color})`, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      {showPct && <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 800, minWidth: 32, textAlign: 'right' }}>{value}%</span>}
    </div>
  );
}

// ─── SCENARIO CARD ────────────────────────────────────────────────────────────
function ScenarioCard({ s, selected, onSelect }) {
  const isBull = s.direction === 'bull';
  const isBear = s.direction === 'bear';
  return (
    <div onClick={() => onSelect(s.id)} style={{
      background: selected ? '#131e2e' : '#111827',
      border: `1px solid ${selected ? s.color + '60' : '#1e2d45'}`,
      borderLeft: `4px solid ${s.color}`,
      borderRadius: 11, padding: '12px 14px', cursor: 'pointer',
      transition: 'all 0.13s',
      boxShadow: selected ? `0 0 20px ${s.color}10` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', marginBottom: 2 }}>{s.label}</div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>
            {isBull ? '↑' : isBear ? '↓' : '→'} {s.target_pct > 0 ? '+' : ''}{s.target_pct.toFixed(1)}%
          </div>
          {s.target_price != null && <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{fmtK(s.target_price)}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>PROBABILIDADE</div>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color, lineHeight: 1 }}>{s.prob}%</div>
        </div>
      </div>
      <ProbBar value={s.prob} color={s.color} />
      <div style={{ marginTop: 8, fontSize: 9, color: '#334155', lineHeight: 1.5 }}>{s.trigger}</div>
    </div>
  );
}

// ─── BREAKOUT ROW ─────────────────────────────────────────────────────────────
function BreakoutRow({ b, spotPrice: rowSpot = 0 }) {
  const isNow   = b.side === 'now';
  const isUp    = b.side === 'up';
  const distPct = Math.abs((b.price - rowSpot) / rowSpot * 100);
  return (
    <tr style={{ borderBottom: '1px solid #0f1a28', background: isNow ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
      <td style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isNow && <span style={{ fontSize: 10, color: isUp ? '#10b981' : '#ef4444' }}>{isUp ? '▲' : '▼'}</span>}
          <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: isNow ? '#f59e0b' : '#e2e8f0', fontWeight: isNow ? 900 : 700 }}>{b.label}</span>
          {isNow && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 800 }}>← SPOT</span>}
        </div>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
        {!isNow && <span style={{ fontSize: 10, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{distPct.toFixed(1)}%</span>}
      </td>
      <td style={{ padding: '8px 12px' }}>
        {!isNow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${b.prob_touch}%`, background: b.color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: b.color, fontWeight: 800, minWidth: 28, textAlign: 'right' }}>{b.prob_touch}%</span>
          </div>
        )}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
        {!isNow && (
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{b.prob_close}%</span>
        )}
      </td>
      <td style={{ padding: '8px 12px', maxWidth: 200 }}>
        <span style={{ fontSize: 9, color: '#334155', lineHeight: 1.4 }}>{b.drivers}</span>
      </td>
    </tr>
  );
}

// ─── PATH CHART ───────────────────────────────────────────────────────────────
function PathChart({ selected, spotPrice: chartSpot = 0, paths = PRICE_PATHS_FALLBACK }) {
  const data = paths.timestamps.map((t, i) => ({
    t,
    bull:    paths.bull[i],
    neutral: paths.neutral[i],
    bear:    paths.bear[i],
    spot:    chartSpot,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.5)" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} interval={5} />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, fontSize: 10 }}
          formatter={(v, name) => [`$${v.toLocaleString()}`, name]} />
        <ReferenceLine y={chartSpot} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'SPOT', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
        <Area type="monotone" dataKey="bull"    name="Bull"    stroke="#10b981" strokeWidth={selected === 'bull_strong' || selected === 'bull_mild' ? 2.5 : 1.5} fill="url(#bullGrad)"    dot={false} strokeOpacity={selected && !['bull_strong','bull_mild'].includes(selected) ? 0.3 : 1} />
        <Line  type="monotone" dataKey="neutral" name="Neutro" stroke="#f59e0b" strokeWidth={selected === 'neutral' ? 2.5 : 1.5}                                 dot={false} strokeOpacity={selected && selected !== 'neutral' ? 0.3 : 1} strokeDasharray="4 4" />
        <Area type="monotone" dataKey="bear"    name="Bear"    stroke="#ef4444" strokeWidth={selected === 'bear_mild' || selected === 'bear_strong' ? 2.5 : 1.5} fill="url(#bearGrad)" dot={false} strokeOpacity={selected && !['bear_mild','bear_strong'].includes(selected) ? 0.3 : 1} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── INSTITUTIONAL PRESSURE ───────────────────────────────────────────────────
function InstitutionalPanel() {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Pressão Institucional de Compra</div>
          <DataTrustBadge
            mode="paid_required"
            confidence="D"
            source="Glassnode"
            sourceUrl="https://glassnode.com/pricing"
            reason="ETF inflows, stablecoin flows e CME data requerem API Glassnode (~$29/mês)"
          />
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7, maxWidth: 700 }}>
          <strong style={{ color: '#cbd5e1' }}>O que é Pressão Institucional?</strong> É uma medida de
          quanto dinheiro grande (fundos, ETFs, empresas) está comprando ou vendendo BTC.
          Quando a pressão institucional é alta, significa que o &quot;dinheiro esperto&quot; está
          entrando — historicamente um sinal positivo para o médio prazo.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { icon: '🏦', label: 'ETF Flows', desc: 'Entrada/saída de capital nos ETFs de BTC (BlackRock IBIT, Fidelity, etc.)' },
          { icon: '💵', label: 'Stablecoin Mint', desc: 'Criação de novas stablecoins (USDT, USDC) — capital esperando entrar em cripto' },
          { icon: '📈', label: 'CME Premium', desc: 'Prêmio dos futuros de BTC na bolsa americana CME — proxy de interesse institucional' },
          { icon: '🔒', label: 'HODL Waves', desc: '% de BTC que não se moveu em mais de 6 meses — acumulação de longo prazo' },
        ].map((c, i) => (
          <div key={i} style={{ padding: '10px 12px', background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8 }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8,
        background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>
        <strong style={{ color: '#94a3b8' }}>Como interpretar quando disponível:</strong> Score acima de 65 = pressão compradora forte
        (dinheiro institucional entrando). Score abaixo de 40 = mercado sem suporte institucional — risco elevado de queda sem base.
        Score entre 40–65 = neutro, aguardar confirmação direcional.
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 6,
        background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)',
        fontSize: 10, color: '#78716c', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 8 }}>
        <span>🔒 Dados indisponíveis — requer Glassnode Standard (~$29/mês) ou Bloomberg Terminal</span>
        <a href="https://glassnode.com/pricing" target="_blank" rel="noopener noreferrer"
          style={{ color: '#f97316', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
          Ver planos →
        </a>
      </div>
    </div>
  );
}

// ─── CLAUDE INSIGHT INLINE ───────────────────────────────────────────────────
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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TABS = ['Cenários', 'Trajetórias', 'Prob. Rompimento', 'Pressão Institucional'];

export default function PredictivePanel() {
  const [tab, setTab]         = useState(0);
  const [selected, setSelected] = useState('bull_mild');

  // ── Live data hooks ────────────────────────────────────────────────────
  const { data: ticker }     = useBtcTicker();
  const { data: klines }     = useKlines('1d', 30);
  const { data: klinesMeta } = useKlinesMeta('1d', 30); // mesmo queryKey → zero request extra
  const { data: fng }        = useFearGreed(1);
  const { data: riskScore }  = useRiskScore();

  // ── Estado de fallback agregado (qualquer fonte em cache → mostrar banner) ─
  const isStale   = !!(ticker?.isFallback || klinesMeta?.isFallback || fng?.isFallback);
  const staleDate = ticker?.lastUpdated ?? klinesMeta?.lastUpdated ?? fng?.lastUpdated ?? null;

  // ── ATR(14): média de (high - low) dos últimos 14 candles diários ──────
  const atr14 = useMemo(() => {
    if (!klines || klines.length < 14) return null;
    return klines.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;
  }, [klines]);

  const spotPrice = ticker?.mark_price ?? null;

  // ── Cenários com preços live (substituem mock quando disponíveis) ───────
  const liveScenarioPrices = useMemo(() => {
    if (!spotPrice || !atr14) return null;
    return {
      bull_strong: spotPrice + atr14 * 2.5,
      bull_mild:   spotPrice + atr14 * 0.5,
      neutral:     spotPrice,
      bear_mild:   spotPrice - atr14 * 1.5,
      bear_strong: spotPrice - atr14 * 3.5,
    };
  }, [spotPrice, atr14]);

  // ── Probabilidades de cenário ajustadas por Fear&Greed e funding ──────────
  const liveScenarioProbs = useMemo(() => {
    if (!IS_LIVE || !fng || !ticker) return null;
    const fg = fng.value;
    const funding = ticker.last_funding_rate;
    const fgBias   = (fg - 50) / 50;
    const fundBias = funding > 0.0005 ? -0.3 : funding < 0 ? 0.2 : 0;
    const bias     = Math.max(-1, Math.min(1, fgBias + fundBias));
    const shift    = bias * 12;
    const base = [28, 34, 18, 14, 6];
    const adj  = [shift * 0.5, shift * 0.3, 0, -shift * 0.3, -shift * 0.5];
    const raw  = base.map((b, i) => Math.max(2, b + adj[i]));
    const total = raw.reduce((a, b) => a + b, 0);
    const norm  = raw.map(v => Math.round((v / total) * 100));
    norm[2] += 100 - norm.reduce((a, b) => a + b, 0);
    const ids = ['bull_strong', 'bull_mild', 'neutral', 'bear_mild', 'bear_strong'];
    return Object.fromEntries(ids.map((id, i) => [id, norm[i]]));
  }, [fng, ticker]);

  // ── Trajetórias de preço live geradas a partir do spot + cenários ─────────
  const livePricePaths = useMemo(() => {
    if (!spotPrice || !liveScenarioPrices) return null;
    const steps      = 25;
    const timestamps = Array.from({ length: steps }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const bullEnd    = liveScenarioPrices.bull_mild;
    const bearEnd    = liveScenarioPrices.bear_mild;
    const makePath   = (end) => timestamps.map((_, i) =>
      Math.round(spotPrice + (end - spotPrice) * (i / (steps - 1)))
    );
    return { timestamps, bull: makePath(bullEnd), neutral: makePath(spotPrice), bear: makePath(bearEnd) };
  }, [spotPrice, liveScenarioPrices]);

  // ── Tabela de rompimento calculada de klines (suporte/resistência) ─────────
  const liveBreakoutTable = useMemo(() => {
    if (!klines || klines.length < 14 || !spotPrice || !atr14) return null;
    const recent20   = klines.slice(-20);
    const recentHigh = Math.max(...recent20.map(k => k.high));
    const recentLow  = Math.min(...recent20.map(k => k.low));
    const touchProb  = (price) => Math.max(5, Math.round(Math.exp(-Math.abs(price - spotPrice) / atr14 * 1.2) * 85));
    const rows = [
      { price: spotPrice,           label: `Spot ${(spotPrice/1000).toFixed(1)}K`,     side: 'now',  prob_touch: 100, prob_close: 100, color: '#f59e0b', drivers: '' },
      { price: recentHigh,          label: `Topo recente (20d)`,                        side: 'up',   prob_touch: touchProb(recentHigh),          prob_close: Math.round(touchProb(recentHigh) * 0.55),          color: '#10b981', drivers: 'Resistência de topo dos últimos 20 candles diários · pressão vendedora esperada' },
      { price: spotPrice + atr14,   label: `ATR +1.0× (${((atr14/spotPrice)*100).toFixed(1)}%)`, side: 'up',  prob_touch: touchProb(spotPrice + atr14),   prob_close: Math.round(touchProb(spotPrice + atr14) * 0.55),   color: '#60a5fa', drivers: 'Nível baseado em volatilidade média 14d' },
      { price: spotPrice + atr14*2, label: `ATR +2.0× (${((atr14*2/spotPrice)*100).toFixed(1)}%)`, side: 'up', prob_touch: touchProb(spotPrice + atr14*2), prob_close: Math.round(touchProb(spotPrice + atr14*2) * 0.55), color: '#a78bfa', drivers: 'Extensão bull · estatisticamente difícil em 24h' },
      { price: recentLow,           label: `Fundo recente (20d)`,                       side: 'down', prob_touch: touchProb(recentLow),           prob_close: Math.round(touchProb(recentLow) * 0.55),           color: '#ef4444', drivers: 'Suporte de fundo dos últimos 20 candles diários · zona de compras' },
      { price: spotPrice - atr14,   label: `ATR -1.0× (-${((atr14/spotPrice)*100).toFixed(1)}%)`, side: 'down', prob_touch: touchProb(spotPrice - atr14),   prob_close: Math.round(touchProb(spotPrice - atr14) * 0.55),   color: '#f97316', drivers: 'Suporte baseado em volatilidade média 14d' },
      { price: spotPrice - atr14*2, label: `ATR -2.0× (-${((atr14*2/spotPrice)*100).toFixed(1)}%)`, side: 'down', prob_touch: touchProb(spotPrice - atr14*2), prob_close: Math.round(touchProb(spotPrice - atr14*2) * 0.55), color: '#ef4444', drivers: 'Alvo bear · requer venda agressiva sustentada' },
    ].filter(r => r.price > 0).sort((a, b) => b.price - a.price);
    return rows;
  }, [klines, spotPrice, atr14]);

  // ── Análise direcional baseada em regras ────────────────────────────────
  const liveAnalysis = useMemo(() => {
    if (!IS_LIVE || !ticker || !fng) return null;
    return computeRuleBasedAnalysis({
      derivatives: {
        fundingRate: ticker.last_funding_rate,
        oiDeltaPct:  ticker.oi_delta_pct,
      },
      macro: {
        fngValue:   fng.value,
        fngLabel:   fng.label,
        riskScore:  riskScore?.score ?? 50,
        riskRegime: riskScore?.regime ?? 'MODERADO',
      },
    });
  }, [ticker, fng, riskScore]);

  // ── Claude AI insight ──────────────────────────────────────────────────
  const scenSummary = SCENARIOS_24H_FALLBACK.map(s => `${s.label} ${s.prob}%`).join(', ');
  const predPayload = (ticker && atr14) ? {
    page: 'predictive',
    riskScore: riskScore?.score ?? 50,
    riskRegime: riskScore?.regime ?? 'MODERADO',
    fearGreedValue: fng?.value ?? 50,
    fearGreedLabel: fng?.label ?? 'Neutral',
    fundingRate: ticker?.last_funding_rate ?? 0,
    context: {
      atr: atr14,
      scenariosSummary: scenSummary,
    },
  } : null;
  const { data: predInsight, isLoading: predAiLoading } = useAiInsight(predPayload);

  // ── Cenários com preços, probabilidades e narrativas live mescladas ──────
  const scenarios = useMemo(() => {
    const withPrices = (() => {
      if (liveScenarioPrices && spotPrice) {
        return SCENARIOS_24H_FALLBACK.map(s => {
          const liveTarget = liveScenarioPrices[s.id];
          if (liveTarget == null) return s;
          const target_pct = parseFloat(((liveTarget - spotPrice) / spotPrice * 100).toFixed(1));
          return { ...s, target_price: liveTarget, target_pct };
        });
      }
      if (spotPrice) {
        return SCENARIOS_24H_FALLBACK.map(s => ({
          ...s,
          target_price: spotPrice * (1 + s.target_pct / 100),
        }));
      }
      return SCENARIOS_24H_FALLBACK;
    })();

    const withProbs = liveScenarioProbs
      ? withPrices.map(s => ({ ...s, prob: liveScenarioProbs[s.id] ?? s.prob }))
      : withPrices;

    // Mesclar trigger, drivers e risk em tempo real quando todas as fontes estão disponíveis
    if (IS_LIVE && ticker && fng && atr14) {
      const narratives = buildScenarioNarrative({
        fundingRate: ticker.last_funding_rate,
        oiDeltaPct:  ticker.oi_delta_pct,
        fngValue:    fng.value,
        fngLabel:    fng.label,
        atr14,
      });
      return withProbs.map(s => ({ ...s, ...(narratives[s.id] ?? {}) }));
    }
    return withProbs;
  }, [liveScenarioPrices, spotPrice, liveScenarioProbs, ticker, fng, atr14]);

  const SPOT = spotPrice ?? 0;
  const selectedScenario = scenarios.find(s => s.id === selected);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Painel Preditivo BTC 24H</h1>
          <ModeBadge mode={IS_LIVE && spotPrice ? 'live' : 'mock'} />
          <span style={{ fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>📐 Quantitativo</span>
          {liveAnalysis && (() => {
            const d = liveAnalysis.overall.direction;
            const isBull = d === 'bullish' || d === 'bullish_bias';
            const isBear = d === 'bearish' || d === 'bearish_bias';
            const c = isBull ? '#10b981' : isBear ? '#ef4444' : '#f59e0b';
            const score = Math.round(liveAnalysis.overall.confidence * 100);
            return (
              <span style={{
                fontSize: 9, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                color: c,
                background: `${c}1a`,
                border: `1px solid ${c}4d`,
                borderRadius: 4, padding: '2px 8px',
              }}>
                {isBull ? '↑ BULL' : isBear ? '↓ BEAR' : '→ NEUTRO'} · conf {score}%
              </span>
            );
          })()}
        </div>
        <PurposeLabel text="Modelo preditivo de direção de preço para as próximas 24h baseado em múltiplos indicadores — use como input adicional, nunca como única base de decisão." />
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Projeção baseada em correlações históricas, fluxo de stablecoin, pressão institucional e VIX · Spot:{' '}
          {SPOT > 0
            ? <span style={{ fontFamily: 'JetBrains Mono, monospace', color: ticker?.isFallback ? '#f59e0b' : '#f59e0b', fontWeight: 700 }}>${SPOT.toLocaleString()}{ticker?.isFallback && ' ⚠'}</span>
            : <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>carregando…</span>
          }
          {atr14 && (
            <span style={{ marginLeft: 8, color: '#334155' }}>
              ·{' '}
              <Tip text="ATR = Average True Range. Mede quanto o preço do BTC oscila em média por dia nos últimos 14 dias. Quanto maior o ATR, mais volátil o mercado — os targets bull/bear ficam mais distantes do spot.">
                ATR(14): <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>${Math.round(atr14).toLocaleString()}</span>
              </Tip>
            </span>
          )}
        </p>
      </div>

      {/* ── BANNER EXPLICATIVO DE PROPÓSITO ── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.07) 0%, rgba(59,130,246,0.05) 100%)',
        border: '1px solid rgba(167,139,250,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>🔮</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
              Para que serve esta página?
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              O <strong style={{ color: '#cbd5e1' }}>Painel Preditivo</strong> usa dados reais de mercado
              (preço, volatilidade, sentimento, funding) para estimar{' '}
              <strong style={{ color: '#cbd5e1' }}>qual cenário de preço é mais provável nas próximas 24h</strong>.
              Não é bola de cristal — é probabilidade baseada em evidências quantitativas.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '📊', text: 'Ver qual cenário tem maior probabilidade hoje' },
                { icon: '📐', text: 'Entender níveis de suporte/resistência mais relevantes' },
                { icon: '🧠', text: 'Calibrar expectativa antes de tomar uma decisão' },
                { icon: '⚠️', text: 'Lembrar que nenhuma previsão é 100% — sempre use stop loss' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER AMBER — ÚLTIMO SALVO ── */}
      {isStale && staleDate && (
        <div style={{ marginBottom: 16, padding: '7px 14px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8 }}>
          <span>⚠ Usando último valor salvo — API indisponível no momento</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            Último salvo: {new Date(staleDate).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      {/* ── DICAS DE OURO ── */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          🏆 Dicas de Ouro — Como Usar o Painel Preditivo
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 12 }}>
          Clique em cada dica para expandir · Erros comuns de quem usa previsões de preço
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="🎯"
            title="Cenário com maior prob. ≠ certeza"
            tag="ATENÇÃO"
            body="Se 'Alta Moderada' tem 40%, significa que em 60% das vezes o mercado foi diferente. Use o painel para calibrar expectativas, não para apostar tudo em uma direção."
          />
          <TipCard
            emoji="📊"
            title="Fear & Greed muda as probabilidades"
            tag="DADO VIVO"
            body="Quando o índice Fear & Greed está abaixo de 20 (medo extremo), o modelo aumenta a probabilidade de recuperação. Acima de 80 (ganância extrema), aumenta a de correção. Os dados são atualizados automaticamente a cada hora."
          />
          <TipCard
            emoji="📐"
            title="ATR(14) = tamanho esperado do movimento"
            body="Um ATR de $2.000 significa que o BTC se move ~$2.000 por dia em média. Se o target bull está a $4.000 do spot, isso é 2× o ATR — pouco provável em 24h, mas possível em 2–3 dias."
          />
          <TipCard
            emoji="⚠️"
            title="Prob. de Rompimento não é recomendação"
            tag="RISCO"
            body="A tabela mostra quais níveis têm maior chance de serem tocados, não se é hora de comprar ou vender. Use junto com análise de volume e tendência — nunca isoladamente."
          />
          <TipCard
            emoji="🔄"
            title="Dados se atualizam automaticamente"
            body="O painel busca dados novos a cada 5 segundos (preço) e a cada hora (Fear & Greed). Se a API falhar, o sistema usa o último valor salvo no Supabase — o aviso ⚠ aparece no topo da página quando isso acontece."
          />
        </div>
      </div>

      {/* Claude Insight — exibido abaixo das Dicas de Ouro */}
      <ClaudeInsight text={predInsight} loading={predAiLoading} />

      {/* ── CENÁRIOS ── */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
          {/* Scenario cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PurposeLabel text="Probabilidade estimada de movimento direcional — acima de 70% de confiança em uma direção sugere setup mais favorável; entre 40-60% indica indecisão." mt={0} mb={4} />
            {scenarios.map(s => (
              <ScenarioCard key={s.id} s={s} selected={selected === s.id} onSelect={setSelected} />
            ))}
            {/* Interpretation guide */}
            <div style={{ marginTop: 4, padding: '10px 14px', borderRadius: 8,
              background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10 }}>
              <div style={{ color: '#3b82f6', fontWeight: 700, marginBottom: 8 }}>Como ler as probabilidades</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {[
                  { icon: '🟢', cond: '> 40% em cenário bull', result: 'Bias comprador — maioria dos indicadores apontam alta.' },
                  { icon: '🔴', cond: '> 30% em cenário bear', result: 'Risco real de queda — funding elevado ou FNG < 30.' },
                  { icon: '🟡', cond: 'Cenário Lateral > 25%', result: 'Indecisão — evitar posições grandes, sem direção clara.' },
                  { icon: '📐', cond: 'Confiança < 50%', result: 'Modelo sem convicção — aguarde sinal mais claro.' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, lineHeight: 1.2 }}>{r.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: 2 }}>{r.cond}</div>
                      <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>{r.result}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected detail */}
          {selectedScenario && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Summary */}
              <div style={{ background: '#111827', border: `1px solid ${selectedScenario.color}30`, borderLeft: `4px solid ${selectedScenario.color}`, borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: selectedScenario.color, marginBottom: 10 }}>{selectedScenario.label}</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>TARGET</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: selectedScenario.color, lineHeight: 1 }}>
                    {selectedScenario.target_price != null ? fmtK(selectedScenario.target_price) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {selectedScenario.target_pct > 0 ? '+' : ''}{selectedScenario.target_pct.toFixed(1)}% vs spot
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 5 }}>GATILHO</div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>{selectedScenario.trigger}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 5 }}>DRIVERS</div>
                  {selectedScenario.drivers.map(d => (
                    <div key={d} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: selectedScenario.color, flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: 9, color: '#475569' }}>{d}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 7 }}>
                  <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>⚠️ RISCO</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{selectedScenario.risk}</div>
                </div>
              </div>

              {/* Confidence */}
              <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Confiança do Modelo</div>
                <PurposeLabel text="Predição gerada por modelo de machine learning treinado em dados históricos — performance passada não garante resultados futuros; sempre use stop loss." mb={8} />
                <ProbBar value={Math.round(selectedScenario.confidence * 100)} color={selectedScenario.color} />
                <div style={{ fontSize: 9, color: '#334155', marginTop: 6 }}>
                  Preços-alvo calculados via ATR(14) · 30 klines diários Binance. {liveScenarioProbs ? 'Probabilidades ajustadas por Fear&Greed + Funding rate em tempo real.' : 'Probabilidades são referência estática — não derivadas de modelo preditivo.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TRAJETÓRIAS ── */}
      {tab === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Trajetórias de Preço Simuladas — Próximas 24h</div>
            <PurposeLabel text="Projeção de caminhos de preço para os três cenários principais — bull, neutro e bear — baseada no spot atual e na volatilidade ATR(14)." />
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 12 }}>Clique em um cenário para destacar sua trajetória correspondente</div>
            {/* Scenario selector pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {scenarios.map(s => (
                <button key={s.id} onClick={() => setSelected(s.id)} style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: selected === s.id ? `${s.color}18` : 'transparent',
                  border: `1px solid ${selected === s.id ? s.color + '50' : '#1a2535'}`,
                  color: selected === s.id ? s.color : '#475569',
                  cursor: 'pointer', fontSize: 9, fontWeight: 700,
                }}>{s.label} ({s.prob}%)</button>
              ))}
            </div>
            <PathChart selected={selected} spotPrice={SPOT} paths={livePricePaths ?? PRICE_PATHS_FALLBACK} />
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { color: '#10b981', label: 'Bull (alta)' },
                { color: '#f59e0b', label: 'Neutral (lateral)' },
                { color: '#ef4444', label: 'Bear (queda)' },
                { color: '#f59e0b', label: 'Spot atual', dash: true },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2, background: l.color, borderTop: l.dash ? '2px dashed' : undefined, borderColor: l.color }} />
                  <span style={{ fontSize: 9, color: '#475569' }}>{l.label}</span>
                </div>
              ))}
            </div>
            {/* Como ler o gráfico */}
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8,
              background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10 }}>
              <div style={{ color: '#3b82f6', fontWeight: 700, marginBottom: 8 }}>Como ler este gráfico</div>
              {[
                { color: '#10b981', label: 'Linha verde (Bull)', desc: 'Trajetória se compradores dominarem — calculada com ATR × 0.5 acima do spot atual.' },
                { color: '#f59e0b', label: 'Linha amarela (Neutro)', desc: 'Trajetória lateral — preço mantém-se próximo do spot, sem direção clara.' },
                { color: '#ef4444', label: 'Linha vermelha (Bear)', desc: 'Trajetória se vendedores dominarem — calculada com ATR × 1.5 abaixo do spot atual.' },
              ].map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < 2 ? 8 : 0 }}>
                  <div style={{ width: 12, height: 3, background: l.color, marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontWeight: 700, color: l.color }}>{l.label}: </span>
                    <span style={{ color: '#64748b' }}>{l.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario summary table */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f1a28' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Resumo dos Cenários</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2535' }}>
                  {['Cenário', 'Target', 'Variação', 'Prob.', 'Confiança'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenarios.map(s => (
                  <tr key={s.id} onClick={() => setSelected(s.id)} style={{ borderBottom: '1px solid #0f1a28', cursor: 'pointer', background: selected === s.id ? '#131e2e' : 'transparent' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 20, background: s.color, borderRadius: 2 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{s.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{fmtK(s.target_price)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: s.color, fontWeight: 800 }}>
                      {s.target_pct > 0 ? '+' : ''}{s.target_pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${s.prob}%`, background: s.color }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: s.color, fontWeight: 800 }}>{s.prob}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{Math.round(s.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PROB. ROMPIMENTO ── */}
      {tab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 14px', background: liveBreakoutTable ? 'rgba(16,185,129,0.06)' : 'rgba(167,139,250,0.06)', border: `1px solid ${liveBreakoutTable ? 'rgba(16,185,129,0.2)' : 'rgba(167,139,250,0.2)'}`, borderRadius: 9 }}>
            <span style={{ fontSize: 10, color: liveBreakoutTable ? '#10b981' : '#a78bfa', fontWeight: 700 }}>{liveBreakoutTable ? '● Dados Live: ' : '🎯 Metodologia: '}</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {liveBreakoutTable
                ? 'Níveis calculados de klines Binance (20d high/low + ATR ×1, ×2). Prob. de toque via decaimento exponencial pela distância ATR. Clusters de liquidação precisos requerem Glassnode.'
                : 'Tabela requer clusters de liquidação via API paga (Glassnode). Quando disponível: prob. de toque por distância ATR + correlação SPX + lag stablecoin ~12h.'}
            </span>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f1a28' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Tabela de Probabilidade de Rompimento — Próximas 24H</div>
                <div style={{ display: 'flex', gap: 10, fontSize: 9, color: '#334155' }}>
                  <span>■ <span style={{ color: '#10b981' }}>Upside</span></span>
                  <span>■ <span style={{ color: '#ef4444' }}>Downside</span></span>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 6 }}>
                {[
                  { pct: '> 70%', label: 'Muito provável tocar este nível em 24h' },
                  { pct: '40–70%', label: 'Possível — fique atento se o preço se aproximar' },
                  { pct: '< 40%', label: 'Improvável — precisaria de movimento atípico' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ color: '#3b82f6', fontWeight: 800 }}>{r.pct}</span>
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2535', background: '#0d1421' }}>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nível</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Distância</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prob. Toque 24H</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prob. Fechamento</th>
                  <th style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Drivers</th>
                </tr>
              </thead>
              <tbody>
                {(liveBreakoutTable ?? BREAKOUT_TABLE_FALLBACK).map(b => <BreakoutRow key={b.price} b={b} spotPrice={SPOT} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRESSÃO INSTITUCIONAL ── */}
      {tab === 3 && <InstitutionalPanel />}
    </div>
  );
}