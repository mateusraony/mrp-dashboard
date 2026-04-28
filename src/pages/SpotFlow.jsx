import { btcSpotFlow, fmtNum, aiAnalysis } from '../components/data/mockData';
import { spotSessions } from '../components/data/mockDataAltcoins';
import { AIModuleCard } from '../components/ui/AIAnalysisPanel';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge } from '../components/ui/DataBadge';
import {
  AreaChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Line,
} from 'recharts';
import { format } from 'date-fns';
import { useKlines, useBtcTicker } from '@/hooks/useBtcData';
import { computeSessionStats } from '@/utils/sessionAnalytics';

// Derives spot metrics from 1h klines.
// 1W fields (volume_1w_usdt, cvd_1w) require ≥168 candles; omitted when partial
// so the mock 1W values are preserved rather than understating weekly flow.
// ret_15m / ret_1m require finer / wider timeframes — always stay mock.
function computeSpotMetrics(klines, btcPrice) {
  if (!klines || klines.length < 2) return null;
  const last  = klines[klines.length - 1];
  const price = btcPrice ?? last.close;

  const retSince = (n) => {
    const idx = klines.length - 1 - n;
    return idx >= 0 ? (last.close - klines[idx].close) / klines[idx].close : null;
  };

  const sumVolUsdt = (n) =>
    klines.slice(-Math.min(n, klines.length)).reduce((s, k) => s + k.volume * k.close, 0);

  const sumCvd = (n) =>
    klines.slice(-Math.min(n, klines.length)).reduce((s, k) => s + (2 * k.taker_buy - k.volume), 0);

  const hasFullWeek = klines.length >= 168;

  return {
    price,
    ret_1h:         retSince(1)  ?? 0,
    ret_4h:         retSince(4)  ?? 0,
    ret_1d:         retSince(24) ?? 0,
    volume_1h_usdt: sumVolUsdt(1),
    volume_1d_usdt: sumVolUsdt(24),
    ...(hasFullWeek ? { volume_1w_usdt: sumVolUsdt(168) } : {}),
    cvd:            sumCvd(4),
    cvd_1d:         sumCvd(24),
    ...(hasFullWeek ? { cvd_1w: sumCvd(168) } : {}),
    taker_buy:      klines.reduce((a, k) => a + k.taker_buy, 0),
    taker_sell:     klines.reduce((a, k) => a + (k.volume - k.taker_buy), 0),
  };
}

export default function SpotFlow() {
  // ── Sprint 5.4: live session analytics from Binance klines ──────────────────
  const { data: klines }  = useKlines('1h', 168);  // 168h = 7 days — needed for accurate 1W aggregates
  const { data: ticker }  = useBtcTicker();
  const btcPrice          = ticker?.mark_price ?? btcSpotFlow.price;

  // Live spot metrics derived from klines; fallback to mock for uncovered fields
  const liveSpot = computeSpotMetrics(klines, btcPrice);
  const s = liveSpot ? { ...btcSpotFlow, ...liveSpot } : btcSpotFlow;

  // Calcula sessões live quando klines disponíveis; fallback para mock
  const liveSessions = klines && klines.length >= 24
    ? computeSessionStats(klines, btcPrice)
    : null;

  // Compatibiliza shape: live retorna array, mock é objeto {asia, europe, us}
  const sessionList = liveSessions ?? Object.values(spotSessions);
  const cvdPositive = s.cvd > 0;

  // Usar klines live quando disponível para o gráfico de preço
  const klinesSource = klines && klines.length > 0 ? klines : s.klines;
  const chartData = klinesSource.map(k => ({
    time: format(new Date(k.time), 'HH:mm'),
    close: parseFloat(k.close.toFixed(0)),
    volume: parseFloat(k.volume.toFixed(0)),
    bull: k.close >= k.open ? parseFloat(k.volume.toFixed(0)) : 0,
    bear: k.close < k.open ? parseFloat(k.volume.toFixed(0)) : 0,
  }));

  const retColor = (v) => v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#4a5568';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          BTC Spot Flow
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3 }}>
          Binance Spot · BTCUSDT · Taker Flow / CVD · <ModeBadge />
        </p>
      </div>

      {/* Metrics — 15m / 1h / 4h / 1D / 1W / 1M */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Spot Price', value: `$${fmtNum(s.price, 0)}`, color: '#e2e8f0' },
          { label: 'Ret 15m',  value: `${s.ret_15m >= 0 ? '+' : ''}${(s.ret_15m*100).toFixed(2)}%`, color: retColor(s.ret_15m) },
          { label: 'Ret 1h',   value: `${s.ret_1h >= 0 ? '+' : ''}${(s.ret_1h*100).toFixed(2)}%`, color: retColor(s.ret_1h) },
          { label: 'Ret 4h',   value: `${s.ret_4h >= 0 ? '+' : ''}${(s.ret_4h*100).toFixed(2)}%`, color: retColor(s.ret_4h) },
          { label: 'Ret 1D',   value: `${s.ret_1d >= 0 ? '+' : ''}${(s.ret_1d*100).toFixed(2)}%`, color: retColor(s.ret_1d) },
          { label: 'Ret 1W',   value: `${s.ret_1w >= 0 ? '+' : ''}${(s.ret_1w*100).toFixed(2)}%`, color: retColor(s.ret_1w) },
          { label: 'Ret 1M',   value: `${s.ret_1m >= 0 ? '+' : ''}${(s.ret_1m*100).toFixed(2)}%`, color: retColor(s.ret_1m) },
          { label: 'Vol 1h',   value: `$${(s.volume_1h_usdt/1e9).toFixed(2)}B`, color: '#e2e8f0' },
          { label: 'Vol 1D',   value: `$${(s.volume_1d_usdt/1e9).toFixed(1)}B`, color: '#e2e8f0' },
          { label: 'Vol 1W',   value: `$${(s.volume_1w_usdt/1e9).toFixed(0)}B`, color: '#e2e8f0' },
        ].map((m, i) => (
          <div key={i} style={{
            background: '#111827', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* CVD multi-período */}
      <div style={{
        background: '#111827', border: '1px solid #1e2d45',
        borderRadius: 12, padding: 16, marginBottom: 16,
        display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 2 }}>CVD Intraday</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: s.cvd > 0 ? '#10b981' : '#ef4444' }}>
            {s.cvd > 0 ? '+' : ''}{fmtNum(s.cvd, 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 2 }}>CVD 1D</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: s.cvd_1d > 0 ? '#10b981' : '#ef4444' }}>
            {s.cvd_1d > 0 ? '+' : ''}{fmtNum(s.cvd_1d, 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 2 }}>CVD 1W</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: s.cvd_1w > 0 ? '#10b981' : '#ef4444' }}>
            {s.cvd_1w > 0 ? '+' : ''}{fmtNum(s.cvd_1w, 0)}
          </div>
          <div style={{ fontSize: 9, color: '#4a5568', marginTop: 2 }}>⚠ Distribuição líquida 7d</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 2 }}>Buy/Sell balance</div>
          <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
            {((s.taker_buy / (s.taker_buy + s.taker_sell)) * 100).toFixed(1)}% buy-side
          </div>
        </div>
      </div>

      {/* CVD + Price charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* CVD */}
        <div style={{
          background: '#111827',
          border: `1px solid rgba(${cvdPositive ? '16,185,129' : '239,68,68'},0.3)`,
          borderRadius: 12, padding: 20,
        }}>
          <SectionHeader title="Cumulative Volume Delta (CVD)" subtitle="aggTrades · ~1000 most recent" />
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>CVD (4H)</div>
              <div style={{
                fontSize: 26, fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
                color: cvdPositive ? '#10b981' : '#ef4444',
              }}>
                {cvdPositive ? '+' : ''}{fmtNum(s.cvd, 0)}
              </div>
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>
                {cvdPositive ? '▲ Net buyer takers' : '▼ Net seller takers'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>Taker Buy</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
                {(s.taker_buy / 1000).toFixed(1)}K BTC
              </div>
              <div style={{ fontSize: 10, color: '#4a5568', marginTop: 4 }}>Taker Sell</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>
                {(s.taker_sell / 1000).toFixed(1)}K BTC
              </div>
            </div>
          </div>
          {/* CVD bar */}
          <div style={{ background: '#1e2d45', borderRadius: 4, height: 10, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: cvdPositive ? '#10b981' : '#ef4444',
              width: `${Math.min(100, Math.abs(s.cvd) / (s.taker_buy + s.taker_sell) * 2 * 100 + 50)}%`,
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#4a5568', textAlign: 'center' }}>
            Buy/Sell balance · {((s.taker_buy / (s.taker_buy + s.taker_sell)) * 100).toFixed(1)}% buy-side
          </div>
        </div>

        {/* Vol spike */}
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
          <SectionHeader title="Volume & Volatility" subtitle="klines 1h · last 48 candles" />
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={chartData.slice(-24)} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false}
                interval={5} />
              <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false}
                domain={['auto', 'auto']} width={55} />
              <YAxis yAxisId="vol" orientation="left" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              />
              <Bar yAxisId="vol" dataKey="bull" fill="rgba(16,185,129,0.4)" radius={[1,1,0,0]} />
              <Bar yAxisId="vol" dataKey="bear" fill="rgba(239,68,68,0.4)" radius={[1,1,0,0]} />
              <Line yAxisId="price" type="monotone" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SESSIONS ANÁLISE ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>Análise por Sessão de Mercado</div>
            <div style={{ fontSize: 10, color: '#334155' }}>Ásia · Europa · EUA — CVD · Volume · Agressão por janela</div>
          </div>
          {liveSessions && (
            <span style={{ fontSize: 9, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>
              LIVE · Binance 1h klines
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {sessionList.map((sess) => {
            const isBuy = sess.dominant_side === 'buy';
            const cvdColor = sess.cvd > 0 ? '#10b981' : '#ef4444';
            const moveColor = sess.price_move_pct > 0 ? '#10b981' : '#ef4444';
            return (
              <div key={sess.label} style={{
                background: '#111827', border: `1px solid ${sess.color}20`,
                borderTop: `3px solid ${sess.color}`,
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{sess.label}</div>
                    <div style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                      {sess.utc} UTC · {sess.brt} BRT
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 5, fontWeight: 700,
                    background: isBuy ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: isBuy ? '#10b981' : '#ef4444',
                    border: `1px solid ${isBuy ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    {isBuy ? '▲ BUY' : '▼ SELL'}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>CVD</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: cvdColor }}>
                      {sess.cvd > 0 ? '+' : ''}{(sess.cvd / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Price Move</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: moveColor }}>
                      {sess.price_move_pct > 0 ? '+' : ''}{sess.price_move_pct.toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Volume</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                      ${sess.volume_usd_b.toFixed(2)}B
                    </div>
                  </div>
                  <div style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Taker Buy%</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: sess.taker_buy_pct > 50 ? '#10b981' : '#ef4444' }}>
                      {sess.taker_buy_pct.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {/* Taker buy bar */}
                <div style={{ height: 4, borderRadius: 2, background: '#1e2d45', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${sess.taker_buy_pct}%`, background: sess.taker_buy_pct > 50 ? '#10b981' : '#ef4444', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 9, color: '#334155', lineHeight: 1.5 }}>{sess.signal}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Analysis */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🤖 AI Analysis — Spot Flow</div>
        <AIModuleCard module={aiAnalysis.modules.spot} title="Spot Flow" icon="⟴" />
      </div>

      {/* Price chart full */}
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 20 }}>
        <SectionHeader title="BTC Price 48h" subtitle="1h candles · Binance Spot" />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} interval={5} />
            <YAxis tick={{ fontSize: 9, fill: '#4a5568' }} tickLine={false} width={60} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [`$${v.toLocaleString()}`, 'Price']}
            />
            <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={1.5}
              fill="url(#priceGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}