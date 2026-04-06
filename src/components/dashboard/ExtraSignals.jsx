// Extra market signals — BTC Dominance, Liquidações, Stablecoin Supply,
// Yield Curve Spread, Correlation Chart (interativo), HY Credit Spread
import { HelpIcon } from '../ui/Tooltip';
import MiniTimeChart from './MiniTimeChart';
import CorrelationChart from './CorrelationChart';
import {
  btcDominance, btcDominanceHistory,
  liquidations24h,
  stablecoinSupply, stablecoinHistory,
  yieldCurveSpread, yieldCurveHistory,
  creditSpread, creditSpreadHistory,
} from '../data/mockData';

const GLOSSARY = {
  btcDom: {
    title: 'BTC Dominance',
    content: 'Percentual do market cap total de crypto representado pelo Bitcoin. Subindo = capital fluindo para BTC. Caindo = capital migrando para altcoins (altseason). Acima de 60% historicamente antecede forte valorização de altcoins.',
  },
  liquidations: {
    title: 'Liquidações 24h (Coinglass)',
    content: 'Total em USD de posições alavancadas forçadamente encerradas nas últimas 24h. Longs liquidados = queda brusca de preço. Picos acima de $500M/dia indicam excesso de alavancagem.',
  },
  stablecoin: {
    title: 'Stablecoin Supply (USDT + USDC)',
    content: 'Supply total de stablecoins em circulação. Crescimento = capital novo entrando no ecossistema crypto ("dry powder"). Queda = saída de capital.',
  },
  yieldCurve: {
    title: 'Yield Curve Spread (10Y - 2Y)',
    content: 'Diferença em basis points entre Treasury de 10 anos e 2 anos. Negativo (invertido) = sinal recessivo histórico — precedeu as últimas 7 recessões americanas com ~18 meses de antecedência.',
  },
  creditSpread: {
    title: 'HY Credit Spread (OAS)',
    content: 'Diferença de rendimento entre títulos High Yield e Treasuries. Widening (subindo) = stress de crédito crescente = desfavorável para ativos de risco incluindo BTC.',
  },
};

function SignalCard({ title, glossKey, children, accent = '#3b82f6' }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45',
      borderTop: `2px solid ${accent}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        {title}
        <HelpIcon title={GLOSSARY[glossKey].title} content={GLOSSARY[glossKey].content} width={280} />
      </div>
      {children}
    </div>
  );
}

function DeltaBadge({ val, suffix = '%', decimals = 1, label }) {
  const c = val >= 0 ? '#10b981' : '#ef4444';
  return (
    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: c, background: `${c}12`, border: `1px solid ${c}25`, borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
      {val >= 0 ? '+' : ''}{val.toFixed(decimals)}{suffix}
      {label && <span style={{ color: '#334155', marginLeft: 3 }}>{label}</span>}
    </span>
  );
}

// ── BTC Dominance ─────────────────────────────────────────────────────────────
function BtcDominanceCard() {
  const trendColor = btcDominance.trend === 'rising' ? '#10b981' : '#ef4444';
  return (
    <SignalCard title="BTC Dominance" glossKey="btcDom" accent="#f59e0b">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9' }}>
          {btcDominance.value.toFixed(1)}<span style={{ fontSize: 14, color: '#64748b' }}>%</span>
        </span>
        <span style={{ fontSize: 10, color: trendColor, fontWeight: 700 }}>
          {btcDominance.trend === 'rising' ? '↑ Rising' : '↓ Falling'}
        </span>
      </div>
      <MiniTimeChart
        data={btcDominanceHistory}
        color="#f59e0b"
        height={70}
        formatter={(v) => `${v.toFixed(1)}%`}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <DeltaBadge val={btcDominance.delta_7d} suffix="pp" label="7d" />
        <DeltaBadge val={btcDominance.delta_30d} suffix="pp" label="30d" />
      </div>
    </SignalCard>
  );
}

// ── Liquidações 24h ───────────────────────────────────────────────────────────
function LiquidationsCard() {
  const pctLongs = (liquidations24h.longs_usd / liquidations24h.total_usd * 100).toFixed(0);
  const pctShorts = (liquidations24h.shorts_usd / liquidations24h.total_usd * 100).toFixed(0);

  return (
    <SignalCard title="Liquidações 24h" glossKey="liquidations" accent="#ef4444">
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9', marginBottom: 8 }}>
        ${(liquidations24h.total_usd / 1e6).toFixed(0)}M
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: `${pctLongs}%`, background: '#ef4444' }} />
          <div style={{ width: `${pctShorts}%`, background: '#10b981' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Longs {pctLongs}% — ${(liquidations24h.longs_usd / 1e6).toFixed(0)}M</span>
          <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>${(liquidations24h.shorts_usd / 1e6).toFixed(0)}M — {pctShorts}% Shorts</span>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
        Maior isolada: ${(liquidations24h.largest_single / 1e6).toFixed(1)}M · BTC longs: ${(liquidations24h.btc_longs_usd / 1e6).toFixed(0)}M
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
        Fonte: Coinglass · Janela: 24h contínuas
      </div>
    </SignalCard>
  );
}

// ── Stablecoin Supply ─────────────────────────────────────────────────────────
function StablecoinCard() {
  return (
    <SignalCard title="Stablecoin Supply" glossKey="stablecoin" accent="#10b981">
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9', marginBottom: 6 }}>
        ${stablecoinSupply.total_b.toFixed(1)}B
      </div>
      <MiniTimeChart
        data={stablecoinHistory}
        color="#10b981"
        height={70}
        formatter={(v) => `$${v.toFixed(1)}B`}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <DeltaBadge val={stablecoinSupply.delta_7d_pct} label="7d" />
        <DeltaBadge val={stablecoinSupply.delta_30d_pct} label="30d" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>USDT: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>${stablecoinSupply.usdt_supply_b.toFixed(1)}B</span></span>
        <span style={{ fontSize: 10, color: '#64748b' }}>USDC: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>${stablecoinSupply.usdc_supply_b.toFixed(1)}B</span></span>
      </div>
    </SignalCard>
  );
}

// ── Yield Curve Spread ────────────────────────────────────────────────────────
function YieldCurveCard() {
  const spread = yieldCurveSpread.spread_bp;
  const isInverted = spread < 0;
  const isFlatWarning = spread < 20 && spread >= 0;
  const color = isInverted ? '#ef4444' : isFlatWarning ? '#f59e0b' : '#10b981';
  const label = isInverted ? '⚠ INVERTIDA' : isFlatWarning ? 'Achatando' : 'Normal';

  return (
    <SignalCard title="Yield Curve 10Y–2Y" glossKey="yieldCurve" accent={color}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>
          {spread >= 0 ? '+' : ''}{spread.toFixed(1)}<span style={{ fontSize: 13, color: '#64748b' }}>bp</span>
        </span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</span>
      </div>
      <MiniTimeChart
        data={yieldCurveHistory}
        color={color}
        height={70}
        formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}bp`}
        refValue={0}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <DeltaBadge val={spread - yieldCurveSpread.prev_7d_bp} suffix="bp" label="7d" />
        <DeltaBadge val={spread - yieldCurveSpread.prev_30d_bp} suffix="bp" label="30d" />
      </div>
      {isInverted && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '4px 8px' }}>
          ⚠ Invertida — precursor histórico de recessão em ~18m
        </div>
      )}
    </SignalCard>
  );
}

// ── HY Credit Spread ──────────────────────────────────────────────────────────
function CreditSpreadCard() {
  const isWidening = creditSpread.regime === 'widening';
  const color = isWidening ? '#ef4444' : creditSpread.regime === 'tightening' ? '#10b981' : '#f59e0b';

  return (
    <SignalCard title="HY Credit Spread" glossKey="creditSpread" accent={color}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>High Yield (OAS)</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>
            {creditSpread.hy_spread_bp}<span style={{ fontSize: 11, color: '#64748b' }}>bp</span>
          </span>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inv. Grade</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
            {creditSpread.ig_spread_bp}<span style={{ fontSize: 11, color: '#334155' }}>bp</span>
          </span>
        </div>
      </div>
      <MiniTimeChart
        data={creditSpreadHistory}
        color={color}
        height={70}
        inverted={true}
        formatter={(v) => `${v}bp`}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <DeltaBadge val={creditSpread.delta_7d_bp} suffix="bp" label="7d" decimals={0} />
        <DeltaBadge val={creditSpread.delta_30d_bp} suffix="bp" label="30d" decimals={0} />
        <span style={{ fontSize: 10, background: `${color}12`, color, border: `1px solid ${color}25`, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
          {isWidening ? '↑ Widening' : creditSpread.regime === 'tightening' ? '↓ Tightening' : '→ Stable'}
        </span>
      </div>
    </SignalCard>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function ExtraSignals() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 12,
    }}>
      <BtcDominanceCard />
      <LiquidationsCard />
      <StablecoinCard />
      <YieldCurveCard />
      {/* Correlation chart ocupa 2 colunas no desktop */}
      <CorrelationChart />
      <CreditSpreadCard />
    </div>
  );
}