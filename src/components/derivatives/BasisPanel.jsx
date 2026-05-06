// ─── BASIS / FUTURES PREMIUM PANEL ───────────────────────────────────────────
// Spot-Futures basis annualized, carry trade signal, CME premium
import { futuresBasis, fundingByExchange } from '../../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../ui/DataBadge';
import { useBtcTicker } from '@/hooks/useBtcData';
import { useBybitTicker, useOkxTicker } from '@/hooks/useMultiVenue';
import { IS_LIVE } from '@/lib/env';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

function fmtPct(v, d = 2) { return `${v.toFixed(d)}%`; }

export default function BasisPanel() {
  const d = futuresBasis;
  const us10y = 4.512; // reference from macro board

  // Dados live de funding rate por exchange
  const { data: ticker } = useBtcTicker();
  const { data: bybit }  = useBybitTicker();
  const { data: okx }    = useOkxTicker();

  // Binance/Bybit/OKX: live quando disponível; Deribit/Bitget/Gate.io: mock
  const fundingChart = [
    { exchange: 'Binance', rate: ticker?.last_funding_rate ?? fundingByExchange[0].rate, color: '#f59e0b' },
    { exchange: 'Bybit',   rate: bybit?.funding_rate       ?? fundingByExchange[1].rate, color: '#10b981' },
    { exchange: 'OKX',     rate: okx?.funding_rate         ?? fundingByExchange[2].rate, color: '#3b82f6' },
    ...fundingByExchange.slice(3), // Deribit, Bitget, Gate.io — sem hook gratuito
  ];
  const isLive = IS_LIVE && (ticker != null || bybit != null || okx != null);

  // Spot: usar mark_price live quando disponível
  const spotPrice = ticker?.mark_price ?? d.spot;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 14, padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Futures Basis & Carry</div>
            <ModeBadge mode={isLive ? 'live' : 'mock'} />
            <GradeBadge grade={d.quality} />
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            Prêmio dos futuros datados vs spot · Spot: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>${spotPrice.toLocaleString()}</span>
          </div>
        </div>
        {d.carry_trade_attractive && (
          <div style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 10, color: '#10b981', fontWeight: 700 }}>
            ✅ Carry Trade Atrativo
          </div>
        )}
      </div>

      {/* Futures table */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Prêmio por Vencimento
        </div>
        {d.futures.map((f, i) => {
          const annColor = f.basis_annualized > us10y ? '#10b981' : '#ef4444';
          const carrySpread = f.basis_annualized - us10y;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
              padding: '10px 12px', borderRadius: 8, background: '#0d1421',
              border: '1px solid #1a2535',
            }}>
              <div style={{ width: 100, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 1 }}>{f.expiry}</div>
                <div style={{ fontSize: 9, color: '#334155' }}>{f.days_to_exp}d</div>
              </div>
              <div style={{ width: 80, flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 1 }}>Preço</div>
                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                  ${f.price.toLocaleString()}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#334155' }}>Basis ann.</span>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: annColor, fontWeight: 700 }}>
                    {fmtPct(f.basis_annualized)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, f.basis_annualized / 20 * 100)}%`, background: annColor }} />
                </div>
              </div>
              <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 1 }}>Carry spread</div>
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: carrySpread > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {carrySpread > 0 ? '+' : ''}{carrySpread.toFixed(1)}pp
                </div>
              </div>
            </div>
          );
        })}

        {/* Reference line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10, color: '#334155' }}>
          <div style={{ height: 1, width: 20, background: '#f59e0b', borderTop: '1px dashed #f59e0b' }} />
          <span>US10Y (referência): <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b' }}>{us10y}%</span></span>
          <span style={{ color: '#334155' }}>— Basis acima = carry trade atrativo</span>
        </div>
      </div>

      {/* Funding by exchange */}
      <div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Funding Rate por Exchange (8h)
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={fundingChart}
            margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="exchange" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} tickFormatter={v => v.toFixed(4) + '%'} />
            <Tooltip
              contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [(Number(v) * 100).toFixed(4) + '%', 'Funding 8h']}
            />
            <ReferenceLine y={0.0005} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Ref', fill: '#f59e0b', fontSize: 8, position: 'right' }} />
            <Bar dataKey="rate" radius={[3, 3, 0, 0]}>
              {fundingChart.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Signal */}
      <div style={{
        marginTop: 14, padding: '10px 12px', borderRadius: 8,
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
        fontSize: 11, color: '#64748b', lineHeight: 1.7,
      }}>
        <span style={{ color: '#10b981', fontWeight: 700 }}>📊 Basis Signal: </span>{d.signal}
      </div>
    </div>
  );
}