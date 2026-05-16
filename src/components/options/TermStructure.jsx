// ─── TERM STRUCTURE COMPONENT ─────────────────────────────────────────────────
// Curva de Volatilidade Implícita ATM por prazo de vencimento
import { termStructure as mockTermStructure } from '../../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../ui/DataBadge';
import { XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';

const structureLabels = {
  slight_contango: { label: 'Leve Contango', color: '#f59e0b', desc: 'Risco maior no curto prazo — mercado ansioso antes de evento' },
  contango: { label: 'Contango', color: '#ef4444', desc: 'IV curto prazo muito acima do longo — stress imediato elevado' },
  backwardation: { label: 'Backwardation', color: '#10b981', desc: 'Estrutura normal — IV cresce com prazo (mais incerteza no futuro)' },
  flat: { label: 'Flat', color: '#64748b', desc: 'Mercado sem visão direcional de curto vs longo prazo' },
  hump: { label: 'Hump', color: '#a78bfa', desc: 'Pico no médio prazo — evento específico precificado' },
};

function CustomTooltip({ active = false, payload = [], label = '' }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 8, padding: '10px 14px',
      fontSize: 11,
    }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{label} · {d.days}d</div>
      <div style={{ color: '#60a5fa' }}>IV ATM: <strong>{(d.iv_atm * 100).toFixed(2)}%</strong></div>
      {d.iv_prev_day != null && (
        <div style={{ color: '#475569' }}>Δ vs ontem: <span style={{ color: d.iv_atm >= d.iv_prev_day ? '#ef4444' : '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>
          {d.iv_atm >= d.iv_prev_day ? '+' : ''}{((d.iv_atm - d.iv_prev_day) * 100).toFixed(2)}pp
        </span></div>
      )}
      {d.oi_contracts != null && (
        <div style={{ color: '#475569', marginTop: 2 }}>OI: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{d.oi_contracts.toLocaleString()} contratos</span></div>
      )}
    </div>
  );
}

/**
 * TermStructure — aceita prop optionsData (de useOptionsData()) ou usa mock.
 * Se optionsData?.term_structure existir: usa dados reais da Deribit.
 * Senão: usa mock com badge DEMO visível.
 */
export default function TermStructure({ optionsData }) {
  // Tenta dados reais da Deribit
  const liveTermStructure = optionsData?.term_structure;
  const isLive = liveTermStructure && liveTermStructure.length > 0;

  if (isLive) {
    // Dados reais — usa OptionsData.term_structure
    const ivFront = liveTermStructure[0]?.atm_iv ?? 0;
    const ivBack = liveTermStructure[liveTermStructure.length - 1]?.atm_iv ?? 0;
    const isContango = ivFront > ivBack;
    const struct = isContango ? structureLabels.contango : structureLabels.backwardation;
    const interpretation = isContango
      ? 'Contango — IV curto prazo acima do longo. Mercado precificando risco imediato.'
      : 'Backwardation — IV cresce com o prazo. Estrutura normal, incerteza maior no longo prazo.';

    const chartData = liveTermStructure.map(e => ({
      label: e.label.replace('BTC-', ''),
      days: e.days_to,
      iv_atm: e.atm_iv,
      iv_prev_day: null,
      iv_pct: parseFloat((e.atm_iv * 100).toFixed(3)),
      iv_prev_pct: parseFloat((e.atm_iv * 100).toFixed(3)), // sem histórico prev no live
    }));

    return (
      <div style={{
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid #1e2d45', borderRadius: 14, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Term Structure — IV ATM</div>
              <ModeBadge mode="live" />
              <GradeBadge grade={optionsData.quality} />
            </div>
            <div style={{ fontSize: 11, color: '#475569' }}>Curva de volatilidade implícita por prazo · Deribit BTC</div>
          </div>
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: `${struct.color}12`, border: `1px solid ${struct.color}30`,
            fontSize: 11, color: struct.color, fontWeight: 700,
          }}>
            {struct.label}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} tickFormatter={v => v.toFixed(0) + '%'} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="iv_pct" stroke="#3b82f6" fill="url(#ivGrad)" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#131e2e' }} name="IV ATM" />
          </AreaChart>
        </ResponsiveContainer>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(7, liveTermStructure.length)}, 1fr)`, gap: 6, marginTop: 14 }}>
          {liveTermStructure.slice(0, 7).map((e, i) => (
            <div key={i} style={{
              background: '#0d1421', borderRadius: 7, padding: '8px 6px', textAlign: 'center',
              border: '1px solid #1a2535',
            }}>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, fontWeight: 700 }}>{e.label.replace('BTC-', '')}</div>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>
                {(e.atm_iv * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                {e.days_to}d
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: `${struct.color}08`, border: `1px solid ${struct.color}20`,
          fontSize: 11, color: '#64748b', lineHeight: 1.6,
        }}>
          <span style={{ color: struct.color, fontWeight: 700 }}>⚡ {struct.label}: </span>
          {interpretation}
        </div>
      </div>
    );
  }

  // Fallback: mock data com badge DEMO
  const d = mockTermStructure;
  const struct = structureLabels[d.structure_type] || structureLabels.flat;

  const chartData = d.expirations.map(e => ({
    ...e,
    iv_pct: parseFloat((e.iv_atm * 100).toFixed(3)),
    iv_prev_pct: parseFloat((e.iv_prev_day * 100).toFixed(3)),
  }));

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 14, padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Term Structure — IV ATM</div>
            <ModeBadge mode="mock" />
            <GradeBadge grade={d.quality} />
            <span style={{ fontSize: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, background: '#1e2d45', color: '#64748b', borderRadius: 4, border: '1px solid #2a3f5f' }}>
              DEMO
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>Curva de volatilidade implícita por prazo · Deribit BTC</div>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 8,
          background: `${struct.color}12`, border: `1px solid ${struct.color}30`,
          fontSize: 11, color: struct.color, fontWeight: 700,
        }}>
          {struct.label}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="ivPrevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#475569" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#475569" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} tickFormatter={v => v.toFixed(0) + '%'} domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="iv_prev_pct" stroke="#2a3f5f" fill="url(#ivPrevGrad)" strokeWidth={1.5} strokeDasharray="4 4" name="Ontem" dot={false} />
          <Area type="monotone" dataKey="iv_pct" stroke="#3b82f6" fill="url(#ivGrad)" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#131e2e' }} name="Hoje" />
        </AreaChart>
      </ResponsiveContainer>

      {/* Expirations grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 14 }}>
        {d.expirations.map((e, i) => {
          const delta = (e.iv_atm - e.iv_prev_day) * 100;
          return (
            <div key={i} style={{
              background: '#0d1421', borderRadius: 7, padding: '8px 6px', textAlign: 'center',
              border: '1px solid #1a2535',
            }}>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, fontWeight: 700 }}>{e.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>
                {(e.iv_atm * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 9, color: delta > 0 ? '#ef4444' : '#10b981', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                {delta > 0 ? '+' : ''}{delta.toFixed(2)}pp
              </div>
            </div>
          );
        })}
      </div>

      {/* Interpretação */}
      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 8,
        background: `${struct.color}08`, border: `1px solid ${struct.color}20`,
        fontSize: 11, color: '#64748b', lineHeight: 1.6,
      }}>
        <span style={{ color: struct.color, fontWeight: 700 }}>⚡ {struct.label}: </span>
        {d.interpretation}
      </div>
    </div>
  );
}
