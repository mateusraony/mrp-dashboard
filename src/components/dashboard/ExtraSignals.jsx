// Extra market signals — BTC Dominance, Liquidações, Stablecoin Supply,
// Yield Curve Spread, Correlation Chart (interativo), HY Credit Spread
import { useMemo } from 'react';
import { HelpIcon } from '../ui/Tooltip';
import MiniTimeChart from './MiniTimeChart';
import CorrelationChart from './CorrelationChart';
import { IS_LIVE } from '@/lib/env';

import { useDominance, useLiquidations } from '@/hooks/useBtcData';
import { useStablecoinData } from '@/hooks/useStablecoin';
import { useYieldCurve, useCreditSpread } from '@/hooks/useFred';

// ─── Glossário ────────────────────────────────────────────────────────────────

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

// ─── Subcomponentes utilitários ───────────────────────────────────────────────

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

function LiveBadge() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em' }}>
      ● LIVE
    </span>
  );
}

function SkeletonLine({ w = '100%', h = 14, mb = 6 }) {
  return <div style={{ width: w, height: h, background: '#1a2535', borderRadius: 4, marginBottom: mb, animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

// ─── BTC Dominance ────────────────────────────────────────────────────────────

function BtcDominanceCard() {
  const { data, isLoading } = useDominance();
  const value = data?.btc_dominance;

  return (
    <SignalCard title="BTC Dominance" glossKey="btcDom" accent="#f59e0b">
      {isLoading ? (
        <>
          <SkeletonLine w="60%" h={28} mb={10} />
          <SkeletonLine w="80%" />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9' }}>
              {value != null ? value.toFixed(1) : '—'}<span style={{ fontSize: 14, color: '#64748b' }}>%</span>
            </span>
            {IS_LIVE && value != null ? <LiveBadge /> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#475569' }}>ETH: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{data?.eth_dominance != null ? data.eth_dominance.toFixed(1) : '—'}%</span></span>
            <span style={{ fontSize: 10, color: '#475569' }}>Others: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{data?.others_dominance != null ? data.others_dominance.toFixed(1) : '—'}%</span></span>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
            Fonte: CoinGecko · Market cap global
          </div>
        </>
      )}
    </SignalCard>
  );
}

// ─── Liquidações 24h ──────────────────────────────────────────────────────────

function LiquidationsCard() {
  const { data: items, isLoading, isError } = useLiquidations(200);

  const agg = useMemo(() => {
    if (!items || items.length === 0) return null;
    const longs_usd  = items.filter(x => x.side === 'SELL').reduce((s, x) => s + x.usd_value, 0);
    const shorts_usd = items.filter(x => x.side === 'BUY').reduce((s, x) => s + x.usd_value, 0);
    const total_usd  = longs_usd + shorts_usd;
    const largest    = Math.max(...items.map(x => x.usd_value));
    const btc_longs  = items.filter(x => x.side === 'SELL' && x.symbol === 'BTCUSDT').reduce((s, x) => s + x.usd_value, 0);
    return { longs_usd, shorts_usd, total_usd, largest, btc_longs };
  }, [items]);

  const pctLongs  = agg && agg.total_usd > 0 ? (agg.longs_usd  / agg.total_usd * 100).toFixed(0) : '—';
  const pctShorts = agg && agg.total_usd > 0 ? (agg.shorts_usd / agg.total_usd * 100).toFixed(0) : '—';

  return (
    <SignalCard title="Liquidações 24h" glossKey="liquidations" accent="#ef4444">
      {isLoading ? (
        <>
          <SkeletonLine w="50%" h={26} mb={10} />
          <SkeletonLine />
        </>
      ) : isError || !agg ? (
        <>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>Dados indisponíveis</div>
          <div style={{ fontSize: 10, color: '#334155' }}>Endpoint requer autenticação Binance</div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9' }}>
              ${(agg.total_usd / 1e6).toFixed(0)}M
            </span>
            <LiveBadge />
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${pctLongs}%`, background: '#ef4444' }} />
              <div style={{ width: `${pctShorts}%`, background: '#10b981' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Longs {pctLongs}% — ${(agg.longs_usd / 1e6).toFixed(0)}M</span>
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>${(agg.shorts_usd / 1e6).toFixed(0)}M — {pctShorts}% Shorts</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
            Maior isolada: ${(agg.largest / 1e6).toFixed(1)}M · BTC longs: ${(agg.btc_longs / 1e6).toFixed(0)}M
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
            Fonte: Binance · {items.length} liquidações recentes
          </div>
        </>
      )}
    </SignalCard>
  );
}

// ─── Stablecoin Supply ────────────────────────────────────────────────────────

function StablecoinCard() {
  const { data, isLoading } = useStablecoinData();

  const totalB  = data ? data.totalSupply / 1e9 : null;
  const usdt    = data?.top5?.find(t => t.symbol === 'USDT');
  const usdc    = data?.top5?.find(t => t.symbol === 'USDC');

  return (
    <SignalCard title="Stablecoin Supply" glossKey="stablecoin" accent="#10b981">
      {isLoading ? (
        <>
          <SkeletonLine w="55%" h={26} mb={10} />
          <SkeletonLine />
          <SkeletonLine w="70%" />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9' }}>
              ${totalB != null ? totalB.toFixed(1) : '—'}B
            </span>
            {IS_LIVE && data?.source === 'DeFiLlama' ? <LiveBadge /> : null}
          </div>
          {data?.totalChange24h != null && (
            <div style={{ marginBottom: 8 }}>
              <DeltaBadge val={data.totalChange24h} label="24h" />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              USDT: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {usdt ? `$${(usdt.circulating / 1e9).toFixed(1)}B` : '—'}
              </span>
            </span>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              USDC: <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {usdc ? `$${(usdc.circulating / 1e9).toFixed(1)}B` : '—'}
              </span>
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
            Fonte: DeFiLlama · {data?.top5?.length ?? 0} assets rastreados
          </div>
        </>
      )}
    </SignalCard>
  );
}

// ─── Yield Curve Spread ───────────────────────────────────────────────────────

function YieldCurveCard() {
  const { data, isLoading } = useYieldCurve();

  const spreadBp = data != null ? data.spread_10y2y * 100 : null;
  const isInverted    = spreadBp != null && spreadBp < 0;
  const isFlatWarning = spreadBp != null && spreadBp < 20 && spreadBp >= 0;
  const color = isInverted ? '#ef4444' : isFlatWarning ? '#f59e0b' : '#10b981';
  const label = isInverted ? '⚠ INVERTIDA' : isFlatWarning ? 'Achatando' : 'Normal';

  // Monta histórico do spread a partir das séries 10Y e 2Y
  const chartData = useMemo(() => {
    if (!data?.history_10y?.length || !data?.history_2y?.length) return null;
    const map2y = new Map(data.history_2y.map((p, i) => [i, p.value]));
    const pts = data.history_10y.map((p, i) => ({
      t: i,
      v: parseFloat(((p.value - (map2y.get(i) ?? p.value)) * 100).toFixed(1)),
    }));
    return { '1d': pts.slice(-1), '1w': pts.slice(-7), '1m': pts };
  }, [data]);

  return (
    <SignalCard title="Yield Curve 10Y–2Y" glossKey="yieldCurve" accent={spreadBp != null ? color : '#3b82f6'}>
      {isLoading ? (
        <>
          <SkeletonLine w="60%" h={28} mb={10} />
          <SkeletonLine />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: spreadBp != null ? color : '#64748b' }}>
              {spreadBp != null ? `${spreadBp >= 0 ? '+' : ''}${spreadBp.toFixed(1)}` : '—'}
              <span style={{ fontSize: 13, color: '#64748b' }}>bp</span>
            </span>
            {spreadBp != null && (
              <>
                <span style={{ fontSize: 10, color, fontWeight: 700 }}>{label}</span>
                {IS_LIVE ? <LiveBadge /> : null}
              </>
            )}
          </div>
          {chartData && (
            <MiniTimeChart
              data={chartData}
              color={color}
              height={70}
              formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}bp`}
              refValue={0}
            />
          )}
          {isInverted && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, padding: '4px 8px' }}>
              ⚠ Invertida — precursor histórico de recessão em ~18m
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: '#334155' }}>
            Fed Funds: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{data?.fed_funds != null ? `${data.fed_funds.toFixed(2)}%` : '—'}</span>
            · Fonte: FRED
          </div>
        </>
      )}
    </SignalCard>
  );
}

// ─── HY Credit Spread (LIVE via FRED BAMLH0A0HYM2 + BAMLC0A0CM) ─────────────

function CreditSpreadCard() {
  const { data: state, isLoading } = useCreditSpread();
  const d = state?.data;
  const regime = d?.regime ?? 'stable';
  const isWidening = regime === 'widening';
  const color = isWidening ? '#ef4444' : regime === 'tightening' ? '#10b981' : '#f59e0b';

  if (isLoading && !d) {
    return (
      <SignalCard title="HY Credit Spread" glossKey="creditSpread" accent={color}>
        <SkeletonLine w="60%" h={28} mb={8} />
        <SkeletonLine h={70} mb={8} />
        <SkeletonLine w="80%" h={14} />
      </SignalCard>
    );
  }

  // Converte histórico [{date, hy, ig}] para formato MiniTimeChart {1m: [{t,v}]}
  const chartData = d?.history
    ? { '1m': d.history.map((h, i) => ({ t: i, v: h.hy })) }
    : null;

  return (
    <SignalCard title="HY Credit Spread" glossKey="creditSpread" accent={color}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 6, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>High Yield (OAS)</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>
            {d?.hy_spread_bp ?? '—'}<span style={{ fontSize: 11, color: '#64748b' }}>bp</span>
          </span>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inv. Grade</div>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
            {d?.ig_spread_bp ?? '—'}<span style={{ fontSize: 11, color: '#334155' }}>bp</span>
          </span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {state?.isFallback
            ? <span style={{ fontSize: 9, color: '#f59e0b' }}>⚠ Cache</span>
            : d ? <LiveBadge /> : null}
        </div>
      </div>
      {chartData && (
        <MiniTimeChart
          data={chartData}
          color={color}
          height={70}
          inverted={true}
          formatter={(v) => `${v}bp`}
        />
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {d && <DeltaBadge val={d.delta_7d_bp} suffix="bp" label="7d" decimals={0} />}
        {d && <DeltaBadge val={d.delta_30d_bp} suffix="bp" label="30d" decimals={0} />}
        {d && (
          <span style={{ fontSize: 10, background: `${color}12`, color, border: `1px solid ${color}25`, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
            {isWidening ? '↑ Widening' : regime === 'tightening' ? '↓ Tightening' : '→ Stable'}
          </span>
        )}
      </div>
      {!d && !isLoading && (
        <div style={{ fontSize: 10, color: '#475569', marginTop: 8 }}>
          Sem dados disponíveis — verifique FRED_API_KEY no Supabase.
        </div>
      )}
    </SignalCard>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export default function ExtraSignals() {
  return (
    <div>
      <div style={{ marginBottom: 8, padding: '5px 10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
        <span style={{ color: '#10b981', fontWeight: 700 }}>● LIVE</span>
        <span>BTC Dominância (CoinGecko) · Stablecoins (DeFiLlama) · Yield Curve (FRED) · HY Credit Spread (FRED BAMLH0A0HYM2)</span>
      </div>
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
    </div>
  );
}
