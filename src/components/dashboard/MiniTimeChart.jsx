// Reusable mini sparkline chart with 1D/1W/1M window selector
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const WINDOWS = ['1d', '1w', '1m'];
const WINDOW_LABELS = { '1d': '1D', '1w': '1W', '1m': '1M' };

function CustomTooltip({ active = false, payload = [], formatter }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
      <span style={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
        {formatter ? formatter(val) : val}
      </span>
    </div>
  );
}

export default function MiniTimeChart({
  data,        // { '1d': [{t, v}], '1w': [...], '1m': [...] }
  color = '#60a5fa',
  height = 80,
  formatter,   // (val) => string
  refValue = undefined,    // linha de referência horizontal (optional)
  inverted = false, // se true, cor positiva é ruim (ex: VIX, credit spread)
}) {
  const [win, setWin] = useState('1w');
  const pts = data[win] || [];

  const first = pts[0]?.v ?? 0;
  const last = pts[pts.length - 1]?.v ?? 0;
  const isUp = last >= first;
  const chartColor = inverted ? (isUp ? '#ef4444' : '#10b981') : (isUp ? '#10b981' : '#ef4444');

  return (
    <div>
      {/* Window pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {WINDOWS.map(w => (
          <button key={w} onClick={() => setWin(w)} style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
            background: win === w ? `${chartColor}18` : 'transparent',
            border: win === w ? `1px solid ${chartColor}40` : '1px solid #1a2535',
            color: win === w ? chartColor : '#334155',
            transition: 'all 0.15s',
          }}>{WINDOW_LABELS[w]}</button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={pts} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={['auto', 'auto']} hide />
          {refValue !== undefined && <ReferenceLine y={refValue} stroke="#334155" strokeDasharray="3 3" />}
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          <Area
            type="monotone" dataKey="v"
            stroke={chartColor} strokeWidth={1.5}
            fill={`url(#grad-${color.replace('#','')})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}