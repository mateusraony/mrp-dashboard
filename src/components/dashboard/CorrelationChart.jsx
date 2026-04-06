// Correlation Chart — interativo: seleção de pares, janela 1D/1W/1M
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { btcCorrelations } from '../data/mockData';
import { HelpIcon } from '../ui/Tooltip';

const WINDOWS = ['1d', '1w', '1m'];
const WINDOW_LABELS = { '1d': '1 Dia', '1w': '1 Semana', '1m': '1 Mês' };
const X_LABELS = {
  '1d': (i) => `${i}h`,
  '1w': (i) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][i] || `D${i}`,
  '1m': (i) => `${i+1}`,
};

function CustomTooltip({ active, payload, label, window }) {
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

export default function CorrelationChart() {
  const [window, setWindow] = useState('1w');
  const [selected, setSelected] = useState(btcCorrelations.pairs.map(p => p.asset)); // todos ativos

  const toggle = (asset) => {
    setSelected(prev =>
      prev.includes(asset)
        ? prev.length > 1 ? prev.filter(a => a !== asset) : prev // mínimo 1
        : [...prev, asset]
    );
  };

  const selectOnly = (asset) => {
    setSelected(prev => prev.length === 1 && prev[0] === asset ? btcCorrelations.pairs.map(p => p.asset) : [asset]);
  };

  // Monta dataset para o recharts
  const chartData = useMemo(() => {
    const histKey = `history_${window}`;
    const len = btcCorrelations.pairs[0][histKey].length;
    return Array.from({ length: len }, (_, i) => {
      const pt = { t: i };
      btcCorrelations.pairs.forEach(p => { pt[p.asset] = p[histKey][i]; });
      return pt;
    });
  }, [window]);

  const activePairs = btcCorrelations.pairs.filter(p => selected.includes(p.asset));

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
              content="Correlação de Pearson entre BTC e cada ativo na janela selecionada. +1 = movem juntos, -1 = movem em sentidos opostos, 0 = sem correlação. Clique em um ativo para isolar. Clique novamente para voltar ao modo completo."
              width={280}
            />
          </div>
          <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>Clique num ativo para isolar · duplo-clique para comparar pares</div>
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
        {btcCorrelations.pairs.map(p => {
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
                {currCorr >= 0 ? '+' : ''}{currCorr.toFixed(2)}
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