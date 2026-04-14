/**
 * DealerFlowPanel.jsx — Painel Dealer Flow: GEX / Vanna / Charm
 *
 * Gera uma escada sintética de strikes em torno do spot (±5 strikes a 2% cada),
 * computa Black-Scholes 2ª ordem via computeContractGreeks e exibe:
 *  - Gráfico de barras: GEX por strike (calls positivo / puts negativo)
 *  - Cards de resumo: Net GEX, Net Vanna Exposure, Net Charm Exposure
 *
 * Props:
 *   spot {number} — preço spot BTC atual
 *   iv   {number} — IV ATM como decimal (ex: 0.65 para 65%)
 */

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { computeContractGreeks } from '@/utils/riskCalculations';

// ─── Constantes de configuração do painel ────────────────────────────────────

const CONTRACT_SIZE  = 1.0;    // 1 BTC por contrato (Deribit padrão)
const BASE_OI_CALL   = 800;    // OI simulado para calls ATM
const BASE_OI_PUT    = 700;    // OI simulado para puts ATM
const TIME_TO_EXPIRY = 30 / 365;
const RISK_FREE_RATE = 0.045;
const STRIKE_STEPS   = 5;      // strikes acima e abaixo do ATM
const STRIKE_PCT     = 0.02;   // 2% de intervalo entre strikes

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Gera escada de strikes ±STRIKE_STEPS em torno do spot, arredondados ao
 * múltiplo de $1.000 mais próximo.
 */
function generateStrikeLadder(spot) {
  const strikes = [];
  for (let i = -STRIKE_STEPS; i <= STRIKE_STEPS; i++) {
    const raw = spot * (1 + i * STRIKE_PCT);
    strikes.push(Math.round(raw / 1000) * 1000);
  }
  return strikes;
}

/**
 * Calcula OI simulado para cada strike com distribuição gaussiana:
 * mais OI perto do ATM, decai conforme afasta.
 */
function simulatedOI(spot, strike, base) {
  const dist = Math.abs(strike - spot) / spot;
  return Math.round(base * Math.exp(-8 * dist * dist));
}

/**
 * Formata número em USD com sufixos K/M para o eixo Y.
 */
function fmtUSD(v) {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * Formata número com sinal para exibição de exposição.
 */
function fmtExposure(v, suffix = '') {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}${suffix}`;
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function GexTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const callGex = payload.find(p => p.dataKey === 'gexCall')?.value ?? 0;
  const putGex  = payload.find(p => p.dataKey === 'gexPut')?.value ?? 0;
  const net = callGex + putGex;
  return (
    <div style={{
      background: '#0d1421', border: '1px solid #162032', borderRadius: 8,
      padding: '10px 14px', fontSize: 11,
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
        Strike ${Number(label).toLocaleString()}
      </div>
      <div style={{ color: '#10b981', marginBottom: 2 }}>
        Call GEX: {fmtUSD(callGex)}
      </div>
      <div style={{ color: '#ef4444', marginBottom: 2 }}>
        Put GEX: {fmtUSD(putGex)}
      </div>
      <div style={{
        color: net >= 0 ? '#10b981' : '#ef4444',
        borderTop: '1px solid #1e3048', marginTop: 6, paddingTop: 6, fontWeight: 700,
      }}>
        Net GEX: {fmtUSD(net)}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DealerFlowPanel({ spot = 85_000, iv = 0.65 }) {
  // Computa escada de strikes e gregas por strike
  const { chartData, netGex, netVanna, netCharm, atmStrike } = useMemo(() => {
    const strikes = generateStrikeLadder(spot);
    const atm = strikes[STRIKE_STEPS]; // strike central = mais próximo do spot

    let totalGex   = 0;
    let totalVanna = 0;
    let totalCharm = 0;

    const data = strikes.map(strike => {
      const callOI = simulatedOI(spot, strike, BASE_OI_CALL);
      const putOI  = simulatedOI(spot, strike, BASE_OI_PUT);

      const callInputs = /** @type {import('@/utils/riskCalculations').BSInputs} */({ spot, strike, timeToExpiry: TIME_TO_EXPIRY, riskFreeRate: RISK_FREE_RATE, iv, optionType: /** @type {'call'} */('call') });
      const putInputs  = /** @type {import('@/utils/riskCalculations').BSInputs} */({ spot, strike, timeToExpiry: TIME_TO_EXPIRY, riskFreeRate: RISK_FREE_RATE, iv, optionType: /** @type {'put'} */('put') });

      const callG = computeContractGreeks(callInputs, callOI, CONTRACT_SIZE);
      const putG  = computeContractGreeks(putInputs,  putOI,  CONTRACT_SIZE);

      const gexCall = callG?.gex           ?? 0;
      const gexPut  = putG?.gex            ?? 0;
      const vannaC  = callG?.vannaExposure ?? 0;
      const vannaP  = putG?.vannaExposure  ?? 0;
      const charmC  = callG?.charmExposure ?? 0;
      const charmP  = putG?.charmExposure  ?? 0;

      totalGex   += gexCall + gexPut;
      totalVanna += vannaC + vannaP;
      totalCharm += charmC + charmP;

      return {
        strike,
        label: `$${(strike / 1000).toFixed(0)}K`,
        gexCall: parseFloat(gexCall.toFixed(2)),
        gexPut:  parseFloat(gexPut.toFixed(2)),
        netGex:  parseFloat((gexCall + gexPut).toFixed(2)),
      };
    });

    return {
      chartData:  data,
      netGex:     totalGex,
      netVanna:   totalVanna,
      netCharm:   totalCharm,
      atmStrike:  atm,
    };
  }, [spot, iv]);

  const dealerPositionLabel = netGex > 0
    ? 'Long Gamma — dealers amortecendo volatilidade'
    : 'Short Gamma — dealers amplificando volatilidade';
  const dealerColor = netGex > 0 ? '#10b981' : '#ef4444';

  return (
    <div style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 12, padding: 20 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
            Dealer Flow — GEX / Vanna / Charm
          </div>
          <div style={{ fontSize: 11, color: '#4a6580', marginTop: 3 }}>
            Black-Scholes 2ª ordem · Strike ladder ±{STRIKE_STEPS} × {(STRIKE_PCT * 100).toFixed(0)}%
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', padding: '3px 8px',
          borderRadius: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b', textTransform: 'uppercase',
        }}>
          simulado — strike OI via Deribit
        </span>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {/* Net GEX */}
        <div style={{
          background: '#070B14', border: `1px solid ${netGex >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Net GEX
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: netGex >= 0 ? '#10b981' : '#ef4444',
          }}>
            {fmtUSD(netGex)}
          </div>
          <div style={{ fontSize: 10, color: dealerColor, marginTop: 3, lineHeight: 1.4 }}>
            {dealerPositionLabel}
          </div>
        </div>

        {/* Net Vanna Exposure */}
        <div style={{
          background: '#070B14', border: '1px solid #162032',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Net Vanna Exposure
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: netVanna >= 0 ? '#60a5fa' : '#f59e0b',
          }}>
            {fmtExposure(netVanna, ' BTC')}
          </div>
          <div style={{ fontSize: 10, color: '#4a6580', marginTop: 3 }}>
            ∂Delta/∂σ — sensibilidade do delta à vol
          </div>
        </div>

        {/* Net Charm Exposure */}
        <div style={{
          background: '#070B14', border: '1px solid #162032',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Net Charm Exposure
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: '#a78bfa',
          }}>
            {fmtExposure(netCharm, '/dia')}
          </div>
          <div style={{ fontSize: 10, color: '#4a6580', marginTop: 3 }}>
            ∂Delta/∂t — decaimento do delta por dia
          </div>
        </div>
      </div>

      {/* Gráfico de barras GEX por strike */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 10 }}>
          GEX por Strike — Calls (positivo) vs Puts (negativo)
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -4, bottom: 0 }} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162032" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#4a6580' }}
              tickLine={false}
              axisLine={{ stroke: '#162032' }}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#4a6580' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => fmtUSD(v)}
              width={52}
            />
            <Tooltip content={({ active, payload, label }) => <GexTooltip active={active} payload={payload} label={label} />} />
            <ReferenceLine y={0} stroke="#1e3048" strokeWidth={1.5} />
            <ReferenceLine
              x={`$${(atmStrike / 1000).toFixed(0)}K`}
              stroke="#3b82f6"
              strokeDasharray="4 3"
              label={{ value: 'ATM', fill: '#3b82f6', fontSize: 9, position: 'top' }}
            />

            {/* Barras calls */}
            <Bar dataKey="gexCall" name="Call GEX" stackId="gex" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`call-${index}`}
                  fill={entry.gexCall >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(16,185,129,0.3)'}
                />
              ))}
            </Bar>

            {/* Barras puts */}
            <Bar dataKey="gexPut" name="Put GEX" stackId="gex" radius={[0, 0, 2, 2]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`put-${index}`}
                  fill={entry.gexPut <= 0 ? 'rgba(239,68,68,0.75)' : 'rgba(239,68,68,0.3)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(16,185,129,0.75)', borderRadius: 2 }} />
          Call GEX
        </span>
        <span style={{ fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(239,68,68,0.75)', borderRadius: 2 }} />
          Put GEX
        </span>
        <span style={{ fontSize: 10, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 18, height: 2, background: '#3b82f6', borderRadius: 1, marginTop: 1 }} />
          ATM
        </span>
        <span style={{ fontSize: 10, color: '#4a6580', marginLeft: 'auto' }}>
          IV: {(iv * 100).toFixed(1)}% · Spot: ${spot.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
