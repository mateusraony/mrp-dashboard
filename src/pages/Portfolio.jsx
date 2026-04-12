// ─── PORTFOLIO MANAGER PAGE ───────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react';
import {
  defaultPositions as defaultPositionsMock,
  computePortfolioGreeks, computePositionPnL,
  stressTest, stressScenarios, SPOT_PRICE,
} from '../components/data/mockDataPortfolio';
import { usePortfolioPositions, useUpsertPosition, useDeletePosition } from '@/hooks/useSupabase';
import { useBtcTicker, useKlines } from '@/hooks/useBtcData';
import { computeLiveRiskMetrics } from '@/utils/riskCalculations';
import { ModeBadge } from '../components/ui/DataBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, CartesianGrid,
} from 'recharts';

const POSITION_TYPES = [
  { value: 'spot',         label: 'Spot BTC' },
  { value: 'futures_perp', label: 'Perp Futures' },
  { value: 'futures_dated',label: 'Dated Futures' },
  { value: 'option_call',  label: 'Call Option' },
  { value: 'option_put',   label: 'Put Option' },
  { value: 'cash',         label: 'USD / Stablecoin' },
];

const DELTA_DEFAULTS = { spot: 1.0, futures_perp: 1.0, futures_dated: 1.0, option_call: 0.40, option_put: 0.30, cash: 0 };
const GAMMA_DEFAULTS = { spot: 0, futures_perp: 0, futures_dated: 0, option_call: 0.0000028, option_put: 0.0000024, cash: 0 };
const THETA_DEFAULTS = { spot: 0, futures_perp: 0, futures_dated: 0, option_call: -42, option_put: 38, cash: 0 };
const VEGA_DEFAULTS  = { spot: 0, futures_perp: 0, futures_dated: 0, option_call: 180, option_put: -155, cash: 0 };

function fmtUSD(v, digits = 0) {
  if (Math.abs(v) >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
  return `$${v.toFixed(digits)}`;
}

function GreekCard({ label, value, unit, color, sub, description }) {
  return (
    <div style={{
      background: '#111827', border: `1px solid ${color}20`,
      borderTop: `3px solid ${color}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {typeof value === 'number' && value > 0 && label.includes('Delta') ? '+' : ''}
        {typeof value === 'number' ? value.toFixed(value < 1 && value > -1 ? 3 : 1) : value}
        {unit && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: '#334155' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>{sub}</div>}
      <div style={{ fontSize: 9, color: '#1e3048', marginTop: 8, lineHeight: 1.6, borderTop: '1px solid #0d1421', paddingTop: 7 }}>{description}</div>
    </div>
  );
}

function AddPositionForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({
    type: 'spot', side: 'long', asset: '', size: 1,
    entry_price: SPOT_PRICE, strike: 84000, expiry_days: 18,
    delta: 1.0, gamma: 0, theta: 0, vega: 0,
  });

  const handleTypeChange = (type) => {
    setForm(f => ({
      ...f, type,
      delta: DELTA_DEFAULTS[type],
      gamma: GAMMA_DEFAULTS[type],
      theta: THETA_DEFAULTS[type],
      vega: VEGA_DEFAULTS[type],
      asset: POSITION_TYPES.find(t => t.value === type)?.label || '',
    }));
  };

  const isOption = form.type.startsWith('option');
  const isCash = form.type === 'cash';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #0d1421 100%)',
      border: '1px solid rgba(59,130,246,0.3)', borderRadius: 14,
      padding: '20px 22px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>+ Nova Posição</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
        {/* Type */}
        <div>
          <div style={labelStyle}>Tipo</div>
          <select value={form.type} onChange={e => handleTypeChange(e.target.value)} style={selectStyle}>
            {POSITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {/* Side */}
        <div>
          <div style={labelStyle}>Direção</div>
          <select value={form.side} onChange={e => setForm(f => ({ ...f, side: e.target.value }))} style={selectStyle}>
            <option value="long">Long / Buy</option>
            <option value="short">Short / Sell</option>
          </select>
        </div>
        {/* Asset label */}
        <div>
          <div style={labelStyle}>Descrição</div>
          <input value={form.asset} onChange={e => setForm(f => ({ ...f, asset: e.target.value }))}
            placeholder="ex: BTC Call $86K" style={inputStyle} />
        </div>
        {/* Size */}
        <div>
          <div style={labelStyle}>{isCash ? 'Valor (USD)' : 'Quantidade (BTC)'}</div>
          <input type="number" value={form.size} onChange={e => setForm(f => ({ ...f, size: parseFloat(e.target.value) || 0 }))}
            style={inputStyle} step="0.1" min="0" />
        </div>
        {/* Entry price */}
        {!isCash && (
          <div>
            <div style={labelStyle}>Preço de Entrada</div>
            <input type="number" value={form.entry_price} onChange={e => setForm(f => ({ ...f, entry_price: parseFloat(e.target.value) || 0 }))}
              style={inputStyle} />
          </div>
        )}
        {/* Strike (options only) */}
        {isOption && (
          <div>
            <div style={labelStyle}>Strike</div>
            <input type="number" value={form.strike} onChange={e => setForm(f => ({ ...f, strike: parseFloat(e.target.value) || 0 }))}
              style={inputStyle} />
          </div>
        )}
      </div>

      {/* Greeks */}
      {!isCash && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, fontWeight: 700 }}>Greeks (editáveis)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { key: 'delta', label: 'Delta', step: 0.01 },
              { key: 'gamma', label: 'Gamma', step: 0.0000001 },
              { key: 'theta', label: 'Theta', step: 1 },
              { key: 'vega', label: 'Vega', step: 1 },
            ].map(g => (
              <div key={g.key}>
                <div style={labelStyle}>{g.label}</div>
                <input type="number" value={form[g.key]}
                  onChange={e => setForm(f => ({ ...f, [g.key]: parseFloat(e.target.value) || 0 }))}
                  style={inputStyle} step={g.step} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => {
          onAdd({ ...form, id: `p${Date.now()}`, current_price: form.type === 'cash' ? 1 : SPOT_PRICE, color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') });
        }} style={{
          padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', fontWeight: 700, fontSize: 12,
        }}>Adicionar</button>
        <button onClick={onCancel} style={{
          padding: '8px 18px', borderRadius: 7, border: '1px solid #1e2d45', cursor: 'pointer',
          background: 'transparent', color: '#64748b', fontSize: 12,
        }}>Cancelar</button>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 600 };
const inputStyle = { width: '100%', background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 6, padding: '6px 8px', color: '#e2e8f0', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default function Portfolio() {
  // Dados live de mercado para métricas de risco calculadas
  const { data: ticker }   = useBtcTicker();
  const { data: klines1d } = useKlines('1d', 30);

  // Carrega posições do Supabase (ou mock se não configurado)
  const { data: savedPositions } = usePortfolioPositions();
  const { mutate: persistPosition } = useUpsertPosition();
  const { mutate: persistRemovePosition } = useDeletePosition();

  // Estado local inicializado com dados do Supabase (ou mock como fallback)
  const [positions, setPositions] = useState(defaultPositionsMock);
  useEffect(() => {
    if (savedPositions && savedPositions.length > 0) {
      // Adiciona current_price do SPOT_PRICE como fallback (será atualizado via hook live)
      // @ts-ignore — Supabase PortfolioPosition tem campos Zod opcionais; runtime sempre válido
      setPositions(savedPositions.map(p => ({ ...p, id: p.id ?? crypto.randomUUID(), current_price: p.entry_price })));
    }
  }, [savedPositions]);

  // Atualiza current_price das posições com o preço live do BTC
  useEffect(() => {
    if (ticker?.mark_price) {
      setPositions(prev => prev.map(p =>
        p.type !== 'cash' && (p.type === 'spot' || p.type.startsWith('futures'))
          ? { ...p, current_price: ticker.mark_price }
          : p,
      ));
    }
  }, [ticker?.mark_price]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [stressMove, setStressMove] = useState(null);

  const greeks = useMemo(() => computePortfolioGreeks(positions), [positions]);

  // Preços históricos BTC para cálculo de vol real (close prices dos klines diários)
  const btcPriceHistory = useMemo(() => {
    if (klines1d && klines1d.length > 0) {
      return klines1d.map(k => k.close);  // campo close da transformação select
    }
    // Fallback: sem histórico, VaR usa vol zero (retorna 0 conservador)
    return [];
  }, [klines1d]);

  // Risk metrics LIVE — usa vol histórica real + posições atualizadas com preço live
  const riskMetrics = useMemo(() => {
    const liveResult = computeLiveRiskMetrics(positions, btcPriceHistory);
    // Retrocompatibilidade com o shape esperado pelo JSX:
    return {
      var95:     Math.abs(liveResult.var_95_1d),
      var99:     Math.abs(liveResult.var_99_1d),
      sharpe:    liveResult.sharpe_ratio,
      beta:      liveResult.beta_vs_btc,
      annualVol: liveResult.annual_vol_pct,
      // Campos adicionais (live)
      cvar95:    Math.abs(liveResult.cvar_95),
      var95hist: Math.abs(liveResult.var_95_hist),
    };
  }, [positions, btcPriceHistory]);

  const maxDrawdownUSD = useMemo(() => {
    const stressVals = stressScenarios.map(s => stressTest(positions.filter(p => p.type !== 'cash'), s.pct));
    return Math.min(...stressVals);
  }, [positions]);

  const pnlData = useMemo(() => {
    return positions
      .filter(p => p.type !== 'cash')
      .map(p => ({
        name: p.asset.substring(0, 16),
        pnl: computePositionPnL(p),
        color: p.color,
        side: p.side,
      }));
  }, [positions]);

  const totalPnL = pnlData.reduce((s, p) => s + p.pnl, 0);

  const stressData = useMemo(() => {
    return stressScenarios.map(s => ({
      label: s.label,
      pnl: stressTest(positions.filter(p => p.type !== 'cash'), s.pct),
      pct: s.pct,
    }));
  }, [positions]);

  const removePosition = (id) => setPositions(ps => ps.filter(p => p.id !== id));
  const addPosition = (pos) => { setPositions(ps => [...ps, pos]); setShowAddForm(false); };

  const deltaColor = Math.abs(greeks.delta_pct) > 30 ? '#ef4444' : Math.abs(greeks.delta_pct) > 15 ? '#f59e0b' : '#10b981';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Portfolio Manager</h1>
          <ModeBadge mode="mock" />
          <span style={{ fontSize: 10, color: totalPnL >= 0 ? '#10b981' : '#ef4444', background: totalPnL >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${totalPnL >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
            P&L {totalPnL >= 0 ? '+' : ''}{fmtUSD(totalPnL)}
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#475569' }}>
          Simulação de portfólio com Greeks ponderados · BTC Spot + Futuros + Opções · Spot: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b' }}>${SPOT_PRICE.toLocaleString()}</span>
        </p>
      </div>

      {/* Greeks Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <GreekCard label="Delta Portfólio" value={greeks.delta_btc} unit="BTC"
          color={deltaColor} sub={`${fmtUSD(greeks.delta_usd)} · ${greeks.delta_pct.toFixed(1)}% do capital`}
          description="Exposição direcional líquida ao preço do BTC" />
        <GreekCard label="Gamma" value={greeks.gamma / 1000} unit="K"
          color="#a78bfa" sub="USD² por $1 de move"
          description="Aceleração do delta. Gamma alto = posição não-linear" />
        <GreekCard label="Theta" value={greeks.theta} unit="$/dia"
          color={greeks.theta >= 0 ? '#10b981' : '#ef4444'} sub={`${fmtUSD(Math.abs(greeks.theta) * 7)}/semana`}
          description="Decaimento temporal diário. Positivo = vendedor de opcoes" />
        <GreekCard label="Vega" value={greeks.vega} unit="$/1% IV"
          color={greeks.vega >= 0 ? '#60a5fa' : '#f97316'} sub="Sensibilidade à volatilidade"
          description="P&L por cada 1% de mudança na IV. Positivo = long vol" />
        <GreekCard label="Notional Total" value={greeks.notional_usd / 1e6} unit="M USD"
          color="#64748b" sub={`Spot: ${fmtUSD(greeks.spot_exposure_usd)}`}
          description="Valor nocional agregado de todas as posições" />
        <GreekCard label="Cash / USD" value={greeks.cash_usd / 1e3} unit="K"
          color="#06b6d4" sub="Liquidez disponível"
          description="USD não alocado em posições ativas" />
      </div>

      {/* Delta gauge */}
      <div style={{ background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Exposição Delta — Portfólio</span>
          <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: deltaColor, fontWeight: 800 }}>
            {greeks.delta_pct > 0 ? '+' : ''}{greeks.delta_pct.toFixed(1)}% {greeks.delta_pct > 10 ? '▲ NET LONG' : greeks.delta_pct < -10 ? '▼ NET SHORT' : '◆ NEUTRO'}
          </span>
        </div>
        <div style={{ position: 'relative', height: 12, borderRadius: 6, background: 'linear-gradient(90deg, #ef4444 0%, #1e2d45 50%, #10b981 100%)', overflow: 'visible' }}>
          {/* Needle */}
          <div style={{
            position: 'absolute', top: -3, left: `${Math.min(95, Math.max(5, 50 + greeks.delta_pct))}%`,
            transform: 'translateX(-50%)',
            width: 4, height: 18, borderRadius: 2,
            background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.6)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: '#334155' }}>
          <span>−50% Short</span><span>Neutro 0%</span><span>+50% Long</span>
        </div>
      </div>

      {/* ─── RISK PACK ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #0f1c2e 0%, #111827 100%)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, padding: '2px 7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Risk Pack</span>
          VaR · Sharpe · Drawdown · Beta
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {/* VaR 95% */}
          <div style={{ background: '#0d1421', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid rgba(239,68,68,0.4)' }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>VaR 95% (1 dia)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444', lineHeight: 1 }}>
              -{fmtUSD(riskMetrics.var95)}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 5 }}>Perda máx. 95% confiança · 1 dia</div>
          </div>
          {/* VaR 99% */}
          <div style={{ background: '#0d1421', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid rgba(239,68,68,0.6)' }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>VaR 99% (1 dia)</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444', lineHeight: 1 }}>
              -{fmtUSD(riskMetrics.var99)}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 5 }}>Cauda de risco extremo · normal</div>
          </div>
          {/* Sharpe */}
          <div style={{ background: '#0d1421', border: `1px solid ${riskMetrics.sharpe >= 1 ? 'rgba(16,185,129,0.15)' : riskMetrics.sharpe >= 0 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${riskMetrics.sharpe >= 1 ? 'rgba(16,185,129,0.5)' : riskMetrics.sharpe >= 0 ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)'}` }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Sharpe Ratio</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: riskMetrics.sharpe >= 1 ? '#10b981' : riskMetrics.sharpe >= 0 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>
              {riskMetrics.sharpe.toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 5 }}>Retorno ajustado ao risco · anual</div>
          </div>
          {/* Max Drawdown */}
          <div style={{ background: '#0d1421', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid rgba(245,158,11,0.4)' }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Max Drawdown</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', lineHeight: 1 }}>
              {fmtUSD(maxDrawdownUSD)}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 5 }}>Cenário stress -20% BTC</div>
          </div>
          {/* Beta */}
          <div style={{ background: '#0d1421', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid rgba(96,165,250,0.4)' }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Beta vs BTC</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', lineHeight: 1 }}>
              {riskMetrics.beta.toFixed(2)}x
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 5 }}>Sensibilidade ao movimento do BTC</div>
          </div>
          {/* Vol Anualizada */}
          <div style={{ background: '#0d1421', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid rgba(167,139,250,0.4)' }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Vol. Anualizada</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa', lineHeight: 1 }}>
              {riskMetrics.annualVol.toFixed(1)}%
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 5 }}>Volatilidade do portfólio · aprox.</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 9, color: '#1e3048', lineHeight: 1.5 }}>
          ⚠ Modelo paramétrico (distribuição normal). VaR subestima eventos de cauda (fat-tail). Produção: histórico ou Monte Carlo.
        </div>
      </div>

      {/* Add position + positions table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Posições ({positions.length})</span>
          <button onClick={() => setShowAddForm(v => !v)} style={{
            padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.4)', cursor: 'pointer',
            background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 700, fontSize: 11,
          }}>
            {showAddForm ? '✕ Cancelar' : '+ Adicionar Posição'}
          </button>
        </div>
        {showAddForm && <AddPositionForm onAdd={addPosition} onCancel={() => setShowAddForm(false)} />}

        {/* Table */}
        <div style={{ background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                {['Posição', 'Tipo', 'Tamanho', 'Entrada', 'Δ P&L', 'Delta', 'Theta/d', 'Vega', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'right', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const pnl = computePositionPnL(p);
                const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
                const sign = p.side === 'long' ? 1 : -1;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(30,45,69,0.5)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{p.asset}</div>
                          <div style={{ fontSize: 9, color: p.side === 'long' ? '#10b981' : '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>{p.side}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                      {POSITION_TYPES.find(t => t.value === p.type)?.label || p.type}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                      {p.type === 'cash' ? fmtUSD(p.size) : `${p.size} BTC`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                      {p.type === 'cash' ? '—' : `$${p.entry_price.toLocaleString()}`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: pnlColor }}>
                      {p.type === 'cash' ? '—' : `${pnl >= 0 ? '+' : ''}${fmtUSD(pnl)}`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                      {p.type === 'cash' ? '—' : `${(p.delta * sign) > 0 ? '+' : ''}${(p.delta * sign).toFixed(2)}`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: p.theta * sign >= 0 ? '#10b981' : '#ef4444' }}>
                      {p.type === 'cash' ? '—' : `${p.theta * sign >= 0 ? '+' : ''}${(p.theta * sign).toFixed(0)}`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: p.vega * sign >= 0 ? '#60a5fa' : '#f97316' }}>
                      {p.type === 'cash' ? '—' : `${p.vega * sign >= 0 ? '+' : ''}${(p.vega * sign).toFixed(0)}`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => removePosition(p.id)} style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 4, padding: '2px 7px', cursor: 'pointer', color: '#ef4444', fontSize: 10,
                      }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* P&L by position + Stress Test */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* P&L per position */}
        <div style={{ background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>P&L por Posição</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pnlData} margin={{ top: 4, right: 4, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
                formatter={v => [`$${Number(v).toFixed(0)}`, 'P&L']} />
              <ReferenceLine y={0} stroke="#2a3f5f" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {pnlData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stress Test */}
        <div style={{ background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Stress Test — Simulação de Move</div>
          <div style={{ fontSize: 10, color: '#334155', marginBottom: 12 }}>P&L do portfólio em cenários de variação do BTC</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stressData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : v < -1000 ? `-$${(-v/1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
                formatter={v => [`$${Number(v).toFixed(0)}`, 'P&L Estimado']} />
              <ReferenceLine y={0} stroke="#2a3f5f" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {stressData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Greeks explanation */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📚 Glossário de Greeks</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          {[
            { greek: 'Δ Delta', desc: 'Exposição direcional. Delta 1.0 = P&L move $1 para cada $1 de alta no BTC. Portfólio Delta-Neutro = protegido de moves pequenos.', color: '#10b981' },
            { greek: 'Γ Gamma', desc: 'Aceleração do delta. Gamma alto = delta muda rápido — posição não-linear. Importante perto de vencimentos.', color: '#a78bfa' },
            { greek: 'Θ Theta', desc: 'Decaimento temporal ($/dia). Negativo = paga pelo tempo. Positivo = coleta prêmio de opções (vendedor de vol).', color: '#f59e0b' },
            { greek: 'V Vega', desc: 'Sensibilidade à IV. Positivo = long vol (lucra com IV subindo). Negativo = short vol (lucra com IV caindo ou estável).', color: '#60a5fa' },
          ].map(g => (
            <div key={g.greek} style={{ background: '#0d1421', border: `1px solid ${g.color}15`, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${g.color}40` }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: g.color, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}>{g.greek}</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.6 }}>{g.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}