// ─── OPTIONS TAKER FLOW PANEL ─────────────────────────────────────────────────
// Buy Call / Sell Call / Buy Put / Sell Put premium flows
import { optionsTakerFlow as mockTakerFlow } from '../../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../ui/DataBadge';
import { DataTrustBadge } from '../ui/DataTrustBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import PurposeLabel from '../ui/PurposeLabel';

function fmt(v) { return `$${v.toFixed(1)}M`; }

/**
 * TakerFlowPanel — aceita prop optionsData (de useOptionsData()).
 * Quando optionsData tem taker_flow: usa dados reais (via PCR como proxy).
 * Senão: usa mock com badge DEMO visível.
 *
 * Nota: a API pública Deribit não expõe taker flow diretamente.
 * Usamos put_call_ratio_vol e put_call_ratio_oi como proxy para viés bull/bear.
 */
export default function TakerFlowPanel({ optionsData }) {
  const hasLiveData = optionsData && optionsData.put_call_ratio_vol != null && optionsData.put_call_ratio_oi != null;

  // Quando live: derivamos bull_bear_index a partir do PCR
  // PCR < 1 = mais calls = bullish; PCR > 1 = mais puts = bearish
  const liveData = hasLiveData ? (() => {
    const pcrVol = optionsData.put_call_ratio_vol;
    const pcrOi  = optionsData.put_call_ratio_oi;
    // Bull-bear index derivado: (1 - PCR) normalizado [-1, +1]
    const bbIdx = Math.max(-1, Math.min(1, (1 - pcrVol) * 0.7 + (1 - pcrOi) * 0.3));
    return {
      ...mockTakerFlow,
      bull_bear_index: bbIdx,
      signal: `PCR Vol: ${pcrVol.toFixed(2)} · PCR OI: ${pcrOi.toFixed(2)} — ${bbIdx > 0.1 ? 'Viés bullish (mais calls)' : bbIdx < -0.1 ? 'Viés bearish (mais puts)' : 'Neutro'}. Dados reais Deribit.`,
      quality: 'B', // taker flow ainda é aproximado
    };
  })() : mockTakerFlow;

  if (!hasLiveData) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
        border: '1px solid rgba(249,115,22,0.2)', borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Options Taker Flow</div>
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 14 }}>Premium líquido 24h · Buy vs Sell por tipo · Deribit</div>
        <div style={{
          padding: '32px 20px', borderRadius: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10, textAlign: 'center',
          background: 'rgba(249,115,22,0.03)', border: '1px dashed rgba(249,115,22,0.2)',
        }}>
          <div style={{ fontSize: 32, opacity: 0.5 }}>🔒</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Taker Flow indisponível</div>
          <div style={{ fontSize: 11, color: '#475569', maxWidth: 380, lineHeight: 1.7 }}>
            Options Taker Flow requer acesso a dados de fluxo de prêmio via Deribit API.
            Configure <strong style={{ color: '#94a3b8' }}>ENABLE_OPTIONS</strong> com chave Deribit para ativar.
          </div>
          <a href="https://www.deribit.com/pages/information/api" target="_blank" rel="noopener noreferrer" style={{
            fontSize: 10, color: '#3b82f6', textDecoration: 'none', fontWeight: 700,
            padding: '4px 12px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.25)',
            background: 'rgba(59,130,246,0.05)',
          }}>Ver API Deribit →</a>
          <div style={{ fontSize: 9, color: '#475569', padding: '2px 10px', borderRadius: 4, background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)' }}>
            Dado <strong style={{ color: '#f97316' }}>não considerado</strong> nas análises de AI
          </div>
        </div>
      </div>
    );
  }

  const d = liveData;
  const bullBearPct = ((d.bull_bear_index + 1) / 2 * 100);
  const bbColor = d.bull_bear_index > 0.1 ? '#10b981' : d.bull_bear_index < -0.1 ? '#ef4444' : '#f59e0b';

  const flowItems = [
    { label: 'Buy Call',  value: d.buy_call_premium_m,  color: '#10b981', icon: '↑', desc: 'Aposta bullish / long gamma' },
    { label: 'Sell Call', value: -d.sell_call_premium_m, color: '#60a5fa', icon: '↓', desc: 'Monetizar carry / cap upside' },
    { label: 'Buy Put',   value: -d.buy_put_premium_m,   color: '#ef4444', icon: '↑', desc: 'Hedge / proteção downside' },
    { label: 'Sell Put',  value: d.sell_put_premium_m,  color: '#a78bfa', icon: '↓', desc: 'Sell vol / coletar prêmio' },
  ];

  const comboData = d.combo_strategies.map(s => ({
    name: s.name,
    value: Math.abs(s.premium_net_m),
    raw: s.premium_net_m,
    color: s.color,
  }));

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderRadius: 14, padding: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Options Taker Flow</div>
            <ModeBadge mode={hasLiveData ? 'live' : 'mock'} />
            <GradeBadge grade={d.quality} />
            {!hasLiveData && (
              <DataTrustBadge
                mode="paid_required"
                confidence="D"
                source="Deribit"
                sourceUrl="https://www.deribit.com/pages/information/api"
                reason="Options Taker Flow requer acesso a dados de fluxo de prêmio via Deribit API."
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>Premium líquido 24h · Buy vs Sell por tipo · Deribit</div>
        </div>
      </div>
      <PurposeLabel text="Fluxo de compradores vs vendedores de opções BTC nas últimas 24h — quando compras de call superam puts, o mercado está apostando em alta; quando puts dominam, há demanda por proteção. Bull-Bear Index derivado do Put/Call Ratio real da Deribit." mb={10} />

      {/* Aviso: fluxos em $M são estimados do PCR, não dados reais de taker flow */}
      {hasLiveData && (
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 12, padding: '5px 9px', borderRadius: 5, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', lineHeight: 1.5 }}>
          ⚠ Valores de prêmio ($M) são estimativas baseadas no mock — a API pública Deribit não expõe taker flow diretamente. O <strong>Bull-Bear Index</strong> é calculado a partir do PCR real da Deribit.
        </div>
      )}

      {/* Bull-Bear Index */}
      <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#0d1421', border: `1px solid ${bbColor}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Bull-Bear Index
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: bbColor }}>
            {d.bull_bear_index > 0 ? '+' : ''}{d.bull_bear_index.toFixed(3)}
          </span>
        </div>
        <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4,
          background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)' }}>
          <div style={{
            position: 'absolute', top: -2, left: `${bullBearPct}%`,
            transform: 'translateX(-50%)',
            width: 6, height: 14, borderRadius: 3, background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
          <span>-1 Extremo Bear</span><span>0 Neutro</span><span>+1 Extremo Bull</span>
        </div>
      </div>

      {/* Flow grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {flowItems.map((item, i) => (
          <div key={i} style={{
            background: '#0d1421', borderRadius: 9, padding: '10px 12px',
            border: `1px solid ${item.color}15`,
          }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: item.color }}>
              {fmt(Math.abs(item.value))}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Net summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
          <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>Net Call Premium</div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
            +{fmt(d.net_call_premium_m)}
          </span>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>Mais compradores que vendedores</div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>Net Put Premium</div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>
            +{fmt(d.net_put_premium_m)}
          </span>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>Hedging ativo — proteção comprada</div>
        </div>
      </div>

      {/* Combo strategies */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Combo Strategies — Net Premium 24h
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={comboData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v, n, props) => [`${props.payload.raw > 0 ? '+' : '-'}$${Number(v).toFixed(1)}M`, 'Net Premium']}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {comboData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Signal */}
      <div style={{
        padding: '9px 11px', borderRadius: 8,
        background: 'rgba(30,45,69,0.4)', border: '1px solid #1e2d45',
        fontSize: 10, color: '#64748b', lineHeight: 1.6,
      }}>
        {d.signal}
      </div>

    </div>
  );
}
