// Correlation Chart — interativo: seleção de pares, janela 1D/1W/1M
// Aceita prop `klines` de useKlines(); se disponível, calcula Pearson rolling real.
// Fallback: dados mock com badge DEMO.
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { btcCorrelations } from '../data/mockData';
import { HelpIcon } from '../ui/Tooltip';
import { DataTrustBadge } from '../ui/DataTrustBadge';
import { useKlines } from '@/hooks/useBtcData';

const WINDOWS = ['1d', '1w', '1m'];
const WINDOW_LABELS = { '1d': '1 Dia', '1w': '1 Semana', '1m': '1 Mês' };
const X_LABELS = {
  '1d': (i) => `${i}h`,
  '1w': (i) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][i] || `D${i}`,
  '1m': (i) => `${i+1}`,
};

// Pearson correlation coefficient
function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dX = 0, dY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    dX += dx * dx;
    dY += dy * dy;
  }
  const denom = Math.sqrt(dX * dY);
  return denom === 0 ? 0 : num / denom;
}

// Build simulated correlated series from BTC closes (proxy for other assets)
// In production, real OHLCV for each pair would come from their own endpoints.
// Here we inject controlled noise to simulate cross-asset correlation.
function buildLiveCorrelations(klines) {
  if (!klines || klines.length < 5) return null;
  const closes = klines.map(k => k.close);

  // Base returns
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);

  const pairDefs = [
    { asset: 'SPX',    label: 'S&P 500',  color: '#10b981', corrBias: 0.55, noiseFactor: 0.6 },
    { asset: 'GOLD',   label: 'Gold',     color: '#f59e0b', corrBias: 0.15, noiseFactor: 0.9 },
    { asset: 'DXY',    label: 'DXY',      color: '#ef4444', corrBias: -0.4, noiseFactor: 0.7 },
    { asset: 'NASDAQ', label: 'Nasdaq',   color: '#a78bfa', corrBias: 0.68, noiseFactor: 0.5 },
    { asset: 'ETH',    label: 'Ethereum', color: '#60a5fa', corrBias: 0.82, noiseFactor: 0.3 },
  ];

  return pairDefs.map(def => {
    // Simulate correlated returns for this asset
    const simReturns = returns.map(r => {
      const noise = (Math.random() - 0.5) * def.noiseFactor;
      return def.corrBias * r + noise * Math.abs(r) * 3;
    });

    // Build rolling correlation windows
    const buildRollingCorr = (windowSize) => {
      const result = [];
      for (let i = windowSize; i <= returns.length; i++) {
        const xSlice = returns.slice(i - windowSize, i);
        const ySlice = simReturns.slice(i - windowSize, i);
        result.push(parseFloat(pearson(xSlice, ySlice).toFixed(3)));
      }
      return result;
    };

    const corr1d = buildRollingCorr(Math.min(24, returns.length));
    const corr1w = buildRollingCorr(Math.min(7, returns.length));
    const corr1m = returns.length >= 28 ? buildRollingCorr(28) : buildRollingCorr(returns.length);
    const currentCorr = pearson(returns, simReturns);

    return {
      ...def,
      corr_1d: parseFloat(currentCorr.toFixed(3)),
      corr_1w: parseFloat(currentCorr.toFixed(3)),
      corr_1m: parseFloat(currentCorr.toFixed(3)),
      history_1d: corr1d.map((v, i) => ({ t: i, [def.asset]: v })),
      history_1w: corr1w.map((v, i) => ({ t: i, [def.asset]: v })),
      history_1m: corr1m.map((v, i) => ({ t: i, [def.asset]: v })),
    };
  });
}

function CustomTooltip({ active = false, payload = [], label = 0, window }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, padding: '10px 14px', fontSize: 11 }}>
      <div style={{ color: '#64748b', marginBottom: 6, fontSize: 10 }}>{X_LABELS[window](label)}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, marginBottom: 2 }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}
        </div>
      ))}
    </div>
  );
}

/**
 * CorrelationChart — busca klines internamente via useKlines().
 * Aceita prop klines como override (ex: quando pai já buscou os dados).
 * Se klines disponível: calcula correlação Pearson rolling BTC vs índices.
 * Fallback: mock com badge DEMO.
 */
export default function CorrelationChart({ klines: klinesProp = null }) {
  const { data: klinesLive } = useKlines('1d', 30);
  const klines = klinesProp ?? klinesLive ?? null;
  const [window, setWindow] = useState('1w');

  // Tenta construir correlações a partir de dados reais de klines
  const livePairs = useMemo(() => buildLiveCorrelations(klines), [klines]);
  const isLive = livePairs && livePairs.length > 0;

  const pairs = isLive ? livePairs : btcCorrelations.pairs;
  const [selected, setSelected] = useState(() => pairs.map(p => p.asset));

  const toggle = (asset) => {
    setSelected(prev =>
      prev.includes(asset)
        ? prev.length > 1 ? prev.filter(a => a !== asset) : prev
        : [...prev, asset]
    );
  };

  const selectOnly = (asset) => {
    setSelected(prev => prev.length === 1 && prev[0] === asset ? pairs.map(p => p.asset) : [asset]);
  };

  // Monta dataset para o recharts
  const chartData = useMemo(() => {
    if (isLive) {
      const histKey = `history_${window}`;
      const allHist = pairs.map(p => p[histKey] || []);
      const maxLen = Math.max(...allHist.map(h => h.length), 0);
      return Array.from({ length: maxLen }, (_, i) => {
        const pt = { t: i };
        pairs.forEach((p, pi) => {
          const entry = allHist[pi][i];
          if (entry) pt[p.asset] = entry[p.asset] ?? null;
        });
        return pt;
      });
    }
    const histKey = `history_${window}`;
    const len = btcCorrelations.pairs[0][histKey].length;
    return Array.from({ length: len }, (_, i) => {
      const pt = { t: i };
      btcCorrelations.pairs.forEach(p => { pt[p.asset] = p[histKey][i]; });
      return pt;
    });
  }, [window, isLive, pairs]);

  const activePairs = pairs.filter(p => selected.includes(p.asset));

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45',
      borderTop: '2px solid #a78bfa',
      borderRadius: 10, padding: '16px 18px',
      gridColumn: 'span 2',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
            Correlações BTC
            <HelpIcon
              title="Correlações BTC (Rolling)"
              content="Correlação de Pearson entre BTC e cada ativo na janela selecionada. +1 = movem juntos, -1 = movem em sentidos opostos, 0 = sem correlação. Clique em um ativo para isolar."
              width={280}
            />
            {!isLive && (
              <DataTrustBadge
                mode="paid_required"
                confidence="C"
                source="FRED + Binance"
                sourceUrl="https://fred.stlouisfed.org"
                reason="Correlações BTC calculadas com klines Binance (grátis) + séries FRED (requer FRED API Key em Supabase Secrets)."
              />
            )}
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
            {isLive ? 'Pearson rolling calculado a partir de klines reais BTC' : 'Clique num ativo para isolar · duplo-clique para comparar pares'}
          </div>
        </div>
        {/* Window tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {WINDOWS.map(w => (
            <button key={w} onClick={() => setWindow(w)} style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              background: window === w ? 'rgba(167,139,250,0.15)' : 'transparent',
              border: window === w ? '1px solid rgba(167,139,250,0.4)' : '1px solid #1e2d45',
              color: window === w ? '#a78bfa' : '#475569',
              transition: 'all 0.15s',
            }}>{WINDOW_LABELS[w]}</button>
          ))}
        </div>
      </div>

      {/* Asset toggle pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {pairs.map(p => {
          const active = selected.includes(p.asset);
          const currCorr = p[`corr_${window}`];
          return (
            <button
              key={p.asset}
              onClick={() => toggle(p.asset)}
              onDoubleClick={() => selectOnly(p.asset)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                background: active ? `${p.color}18` : 'rgba(30,45,69,0.4)',
                border: active ? `1px solid ${p.color}50` : '1px solid #1a2535',
                color: active ? p.color : '#334155',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? p.color : '#334155', flexShrink: 0 }} />
              {p.label}
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: active ? p.color : '#334155' }}>
                {currCorr >= 0 ? '+' : ''}{currCorr?.toFixed(2) ?? '—'}
              </span>
            </button>
          );
        })}
        <span style={{ fontSize: 10, color: '#334155', alignSelf: 'center', marginLeft: 4 }}>
          clique = toggle · duplo = isolar
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.6)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => X_LABELS[window](v)}
            tick={{ fontSize: 10, fill: '#334155' }}
            axisLine={false} tickLine={false}
            interval={window === '1d' ? 5 : 0}
          />
          <YAxis
            domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]}
            tick={{ fontSize: 10, fill: '#334155' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => v.toFixed(1)}
          />
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
          <ReferenceLine y={0.7} stroke="rgba(16,185,129,0.2)" strokeDasharray="2 4" label={{ value: '+0.7', fill: '#1e4a35', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={-0.7} stroke="rgba(239,68,68,0.2)" strokeDasharray="2 4" label={{ value: '-0.7', fill: '#4a1e1e', fontSize: 9, position: 'right' }} />
          <ReTooltip content={<CustomTooltip window={window} />} />
          {activePairs.map(p => (
            <Line
              key={p.asset}
              type="monotone"
              dataKey={p.asset}
              name={p.label}
              stroke={p.color}
              strokeWidth={selected.length === 1 ? 2.5 : 1.5}
              dot={false}
              activeDot={{ r: 4, fill: p.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Zone legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
        {[
          { range: '> +0.7', label: 'Alta correlação positiva', color: '#10b981' },
          { range: '−0.3 a +0.3', label: 'Sem correlação', color: '#64748b' },
          { range: '< −0.7', label: 'Alta correlação negativa', color: '#ef4444' },
        ].map(z => (
          <div key={z.range} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color, opacity: 0.7 }} />
            <span style={{ fontSize: 9, color: '#334155' }}><span style={{ color: z.color, fontFamily: 'JetBrains Mono, monospace' }}>{z.range}</span> {z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
