import { macroBoard, macroHistory, fmtNum, aiAnalysis } from '../components/data/mockData';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import GoldenRule from '../components/ui/GoldenRule';
import SectionHeader from '../components/ui/SectionHeader';
import MacroHeatmap from '../components/dashboard/MacroHeatmap';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import MiniTimeChart from '../components/dashboard/MiniTimeChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts';

function SeriesCard({ s }) {
  const isYield = s.format === 'yield';
  const d1Color = s.delta_1d >= 0 ? '#10b981' : '#ef4444';
  const d7Color = s.delta_7d >= 0 ? '#10b981' : '#ef4444';
  const d1Val = isYield ? `${s.delta_1d_bp >= 0 ? '+' : ''}${s.delta_1d_bp.toFixed(1)}bp` : `${s.delta_1d >= 0 ? '+' : ''}${(s.delta_1d * 100).toFixed(2)}%`;
  const d7Val = isYield ? `${s.delta_7d_bp >= 0 ? '+' : ''}${s.delta_7d_bp.toFixed(1)}bp` : `${s.delta_7d >= 0 ? '+' : ''}${(s.delta_7d * 100).toFixed(2)}%`;

  // inverted: VIX e DXY são "ruins" quando sobem (para BTC)
  const isInverted = s.id === 'VIX' || s.id === 'DXY';
  const accentColor = isInverted
    ? (s.delta_1d >= 0 ? '#ef4444' : '#10b981')
    : (s.delta_1d >= 0 ? '#10b981' : '#ef4444');

  const hist = macroHistory[s.id];
  const fmtVal = (v) => isYield ? `${v.toFixed(3)}%` : fmtNum(v, s.id === 'VIX' || s.id === 'DXY' ? 2 : 0);

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 4 }}>{s.icon} {s.name}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', letterSpacing: '-0.03em' }}>
            {isYield ? s.value.toFixed(3) : fmtNum(s.value, s.id === 'VIX' || s.id === 'DXY' ? 2 : 0)}
            <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 4 }}>{s.unit}</span>
          </div>
        </div>
        <GradeBadge grade={s.quality} />
      </div>

      {/* MiniTimeChart com 1D/1W/1M */}
      {hist && (
        <MiniTimeChart
          data={hist}
          color={accentColor}
          height={65}
          inverted={isInverted}
          formatter={fmtVal}
        />
      )}

      {/* Deltas */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>Δ 1D</div>
          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: d1Color, fontWeight: 600 }}>{d1Val}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>Δ 1W</div>
          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: d7Color, fontWeight: 600 }}>{d7Val}</div>
        </div>
        {s.delta_30d !== undefined && (
          <div>
            <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>Δ 1M</div>
            <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: (isYield ? s.delta_30d_bp : s.delta_30d) >= 0 ? '#10b981' : '#ef4444' }}>
              {isYield ? `${s.delta_30d_bp >= 0 ? '+' : ''}${s.delta_30d_bp.toFixed(1)}bp` : `${s.delta_30d >= 0 ? '+' : ''}${(s.delta_30d * 100).toFixed(2)}%`}
            </div>
          </div>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>FRED</div>
          <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f' }}>{s.series_id}</div>
        </div>
      </div>
    </div>
  );
}

export default function Macro() {
  const m = macroBoard;
  const yieldSpread = m.series.find(s => s.id === 'US10Y').value - m.series.find(s => s.id === 'US2Y').value;
  const yieldSpreadBp = (yieldSpread * 100).toFixed(1);
  const isInverted = yieldSpread < 0;

  const deltaChartData = m.series.map(s => ({
    name: s.id,
    d1:  s.format === 'yield' ? parseFloat(s.delta_1d_bp.toFixed(1))   : parseFloat((s.delta_1d * 100).toFixed(2)),
    d1w: s.format === 'yield' ? parseFloat(s.delta_7d_bp.toFixed(1))   : parseFloat((s.delta_7d * 100).toFixed(2)),
    d1m: s.format === 'yield' ? parseFloat(s.delta_30d_bp !== undefined ? s.delta_30d_bp.toFixed(1) : '0') : parseFloat((s.delta_30d !== undefined ? s.delta_30d * 100 : 0).toFixed(2)),
    label: s.format === 'yield' ? 'bp' : '%',
  }));

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Macro Board
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: '#4a5568', margin: 0 }}>
            FRED Daily Data · Updated {m.updated_at.toLocaleDateString('pt-BR')} ·
          </p>
          <ModeBadge />
          <div style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            ⚠️ Dados diários — não intraday
          </div>
        </div>
      </div>

      {/* Regra de Ouro */}
      <GoldenRule compact />

      {/* Yield spread alert */}
      <div style={{
        marginBottom: 20, padding: '12px 16px', borderRadius: 10,
        background: isInverted ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
        border: `1px solid ${isInverted ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18 }}>{isInverted ? '🔴' : '🟢'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
            Yield Curve (10Y−2Y): {yieldSpread >= 0 ? '+' : ''}{yieldSpreadBp}bp
          </div>
          <div style={{ fontSize: 11, color: '#8899a6', marginTop: 2 }}>
            {isInverted
              ? 'Inverted yield curve — historically associated with recession risk'
              : `Positive spread — ${parseFloat(yieldSpreadBp) < 50 ? 'Flattening' : 'Normal'} curve`}
          </div>
        </div>
      </div>

      {/* Series grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {m.series.map(s => <SeriesCard key={s.id} s={s} />)}
      </div>

      {/* AI Analysis */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🤖 AI Analysis — Macro</div>
        <AIModuleCard module={aiAnalysis.modules.macro} title="Macro Board" icon="⊞" />
      </div>

      {/* Macro Heatmap — Correlações */}
      <div style={{ marginBottom: 20 }}>
        <MacroHeatmap />
      </div>

      {/* Delta comparison chart — 1D / 1W / 1M */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
        <SectionHeader title="Deltas 1D / 1W / 1M — Macro Cross" subtitle="Normalized per series" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={deltaChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8899a6' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, n, p) => { const n2 = Number(v); return [`${n2 > 0 ? '+' : ''}${n2} ${p.payload.label}`, n === 'd1' ? 'Δ 1D' : n === 'd1w' ? 'Δ 1W' : 'Δ 1M']; }}
            />
            <Legend formatter={v => v === 'd1' ? 'Δ 1D' : v === 'd1w' ? 'Δ 1W' : 'Δ 1M'} wrapperStyle={{ fontSize: 10, color: '#8899a6' }} />
            <ReferenceLine y={0} stroke="#2a3f5f" />
            <Bar dataKey="d1" radius={[2,2,0,0]} fill="#3b82f6" opacity={0.9} />
            <Bar dataKey="d1w" radius={[2,2,0,0]} fill="#8b5cf6" opacity={0.7} />
            <Bar dataKey="d1m" radius={[2,2,0,0]} fill="#06b6d4" opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}