// ─── LTH / STH SUPPLY CARD ────────────────────────────────────────────────────
// Long-Term Holders vs Short-Term Holders supply distribution
// LTH/STH split: live via CoinMetrics HODL wave (1yr+ proxy); outros campos: mock (Glassnode pago)
import { lthSthSupply } from '../../components/data/mockDataExtended';
import { GradeBadge, ModeBadge } from '../ui/DataBadge';
import { HelpIcon } from '../ui/Tooltip';
import { useOnChainExtended } from '@/hooks/useCoinMetrics';
import { IS_LIVE } from '@/lib/env';

function fmtBTC(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return `${(v / 1000).toFixed(1)}K`;
}

export default function LthSthCard() {
  const d = lthSthSupply;
  const { data: extended } = useOnChainExtended();

  // Percentuais e supply: live quando CoinMetrics retorna dados (HODL wave 1yr+ proxy)
  // Outros campos (realized_price, profit, delta_30d) requerem Glassnode (pago) — mantém mock
  const TOTAL_SUPPLY = 19_850_000;
  const lthPct    = extended?.hodl_wave_1yr_pct ?? d.lth_pct;
  const sthPct    = extended ? (100 - lthPct) : d.sth_pct;
  const lthSupply = extended ? Math.round(TOTAL_SUPPLY * lthPct / 100) : d.lth_supply;
  const sthSupply = extended ? TOTAL_SUPPLY - lthSupply : d.sth_supply;
  const quality   = extended?.quality ?? d.quality;
  const isLive    = IS_LIVE && extended != null;

  const sections = [
    {
      label: 'LTH — Long-Term Holders',
      sublabel: 'Moedas paradas > 155 dias (diamantes)',
      supply: lthSupply,
      pct: lthPct,
      delta_30d: d.lth_delta_30d_pct,
      in_profit: d.lth_in_profit,
      in_loss: d.lth_in_loss,
      profit_pct: d.lth_profit_pct,
      realized_price: d.lth_realized_price,
      color: '#10b981',
    },
    {
      label: 'STH — Short-Term Holders',
      sublabel: 'Moedas movidas < 155 dias (especuladores)',
      supply: sthSupply,
      pct: sthPct,
      delta_30d: d.sth_delta_30d_pct,
      in_profit: d.sth_in_profit,
      in_loss: d.sth_in_loss,
      profit_pct: d.sth_profit_pct,
      realized_price: d.sth_realized_price,
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
      border: '1px solid #1e2d45', borderTop: '3px solid #10b981',
      borderRadius: 12, padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
          LTH / STH Supply
          <ModeBadge mode={isLive ? 'estimated' : 'mock'} />
          <HelpIcon
            title="LTH vs STH Supply"
            content="LTH (Long-Term Holders) = moedas que não se moveram por >155 dias — holders convictos. STH (Short-Term Holders) = moedas movidas recentemente — especuladores. Quando LTH aumenta = acumulação de longo prazo (bullish). STH em prejuízo = capitulação potencial."
            width={300}
          />
        </div>
        <GradeBadge grade={quality} />
      </div>

      {/* Supply bar total */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>
          Supply total: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{fmtBTC(TOTAL_SUPPLY)} BTC</span>
        </div>
        <div style={{ height: 14, borderRadius: 7, overflow: 'hidden', display: 'flex' }}>
          <div style={{
            width: `${lthPct}%`, height: '100%',
            background: 'linear-gradient(90deg, #059669, #10b981)',
            position: 'relative',
          }} />
          <div style={{
            width: `${sthPct}%`, height: '100%',
            background: 'linear-gradient(90deg, #d97706, #f59e0b)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: '#334155' }}>
          <span style={{ color: '#10b981' }}>LTH {lthPct.toFixed(1)}%</span>
          <span style={{ color: '#f59e0b' }}>STH {sthPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Cards LTH / STH */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {sections.map((s, i) => (
          <div key={i} style={{
            background: '#0d1421', borderRadius: 9, padding: '10px 12px',
            border: `1px solid ${s.color}20`,
          }}>
            <div style={{ fontSize: 9, color: s.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {i === 0 ? '💎 LTH' : '📈 STH'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>
              {fmtBTC(s.supply)}
            </div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 6 }}>BTC ({s.pct.toFixed(1)}%)</div>

            {/* Profit/Loss bar */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', display: 'flex', marginBottom: 3 }}>
                <div style={{ width: `${s.profit_pct}%`, background: s.color, opacity: 0.8 }} />
                <div style={{ flex: 1, background: '#1a2535' }} />
              </div>
              <div style={{ fontSize: 9, color: '#334155' }}>
                {s.profit_pct.toFixed(1)}% em lucro
              </div>
            </div>

            {/* Realized price */}
            <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>
              Custo médio: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                ${s.realized_price.toLocaleString()}
              </span>
            </div>

            {/* 30d delta */}
            <div style={{
              marginTop: 6, fontSize: 9,
              color: s.delta_30d > 0 ? '#10b981' : '#ef4444',
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
            }}>
              {s.delta_30d > 0 ? '+' : ''}{s.delta_30d.toFixed(2)}% em 30d
            </div>
          </div>
        ))}
      </div>

      {/* Signal */}
      <div style={{
        padding: '8px 10px', borderRadius: 7,
        background: 'rgba(30,45,69,0.4)', border: '1px solid #1e2d45',
        fontSize: 10, color: '#94a3b8', lineHeight: 1.6,
      }}>
        {d.signal}
      </div>
    </div>
  );
}