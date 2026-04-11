// ─── MERCADOS GLOBAIS — FX · Commodities · Índices · Bancos Centrais · BRL ───
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { fxRates, commodities, globalIndices, centralBankRates, btcCorrelationMatrix, brlMacroAnalysis } from '../components/data/mockDataGlobalMarkets';
import { ModeBadge } from '../components/ui/DataBadge';
import GoldenRule from '../components/ui/GoldenRule';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(now, prev) { return ((now - prev) / prev * 100); }
function fmtPct(v, dec = 2) { return `${v >= 0 ? '+' : ''}${v.toFixed(dec)}%`; }
function col(v, inv = false) {
  const pos = inv ? v <= 0 : v >= 0;
  return pos ? '#10b981' : '#ef4444';
}

// ─── Asset Row ────────────────────────────────────────────────────────────────
function AssetRow({ item, valueKey = 'value', prevKey = '1d' }) {
  const now = item[valueKey];
  const prev1d = item.prev_1d;
  const prev7d = item.prev_7d;
  const prev30d = item.prev_30d;
  const d1 = pct(now, prev1d);
  const d7 = pct(now, prev7d);
  const d30 = pct(now, prev30d);
  const inv = item.inverted || false;
  const corrColor = item.corr_btc_30d > 0.4 ? '#10b981' : item.corr_btc_30d < -0.4 ? '#ef4444' : item.corr_btc_30d > 0.2 ? '#10b98180' : '#f59e0b';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(26,37,53,0.5)' }}>
      <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{item.pair || item.id}</div>
        <div style={{ fontSize: 9, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
      </div>
      <div style={{ textAlign: 'right', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
          {typeof now === 'number' && now > 1000 ? now.toLocaleString() : now.toFixed(now > 100 ? 0 : now > 10 ? 2 : 4)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flex: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {[{ label: '1D', v: d1 }, { label: '1W', v: d7 }, { label: '1M', v: d30 }].map(({ label, v }) => (
          <span key={label} style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: col(v, inv), background: `${col(v, inv)}10`, border: `1px solid ${col(v, inv)}20`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            {fmtPct(v, 1)} <span style={{ opacity: 0.5 }}>{label}</span>
          </span>
        ))}
      </div>
      {item.corr_btc_30d !== undefined && (
        <div style={{ textAlign: 'right', width: 60, flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#334155' }}>Corr BTC</div>
          <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: corrColor }}>
            {item.corr_btc_30d > 0 ? '+' : ''}{item.corr_btc_30d.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Central Bank Card ────────────────────────────────────────────────────────
function RateCard({ bank }) {
  const dirColor = bank.direction === 'hiking' ? '#ef4444' : bank.direction === 'cutting' ? '#10b981' : '#f59e0b';
  const dirLabel = bank.direction === 'hiking' ? '▲ Subindo' : bank.direction === 'cutting' ? '▼ Cortando' : '→ Hold';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{bank.icon} {bank.country}</div>
          <div style={{ fontSize: 9, color: '#475569' }}>{bank.bank}</div>
        </div>
        <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: `${dirColor}10`, color: dirColor, border: `1px solid ${dirColor}25`, fontWeight: 700 }}>{dirLabel}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9', lineHeight: 1 }}>{bank.rate.toFixed(2)}%</div>
      <div style={{ fontSize: 8, color: '#334155', marginTop: 4 }}>{bank.last_change}</div>
      <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>Próxima: {bank.next_meeting}</div>
    </div>
  );
}

// ─── Correlation Bar Chart ────────────────────────────────────────────────────
function CorrelationChart({ data, period }) {
  const key = `corr_${period}`;
  const sorted = [...data].sort((a, b) => b[key] - a[key]);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
        <YAxis type="category" dataKey="asset" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={88} />
        <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} formatter={v => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n.toFixed(2)}`, `Corr ${period}`]; }} />
        <ReferenceLine x={0} stroke="#1e2d45" />
        <Bar dataKey={key} radius={[0, 3, 3, 0]}>
          {sorted.map((d, i) => <Cell key={i} fill={d[key] > 0.3 ? '#10b981' : d[key] < -0.3 ? '#ef4444' : '#f59e0b'} fillOpacity={0.8} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── BRL Special Section ──────────────────────────────────────────────────────
function BRLSection() {
  const b = brlMacroAnalysis;
  const btcBrlDelta = b.btc_brl_delta_30d_pct;

  return (
    <div style={{ background: '#111827', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>🇧🇷</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>Perspectiva BRL</div>
          <div style={{ fontSize: 10, color: '#475569' }}>BTC/BRL · Selic · IPCA · IBOVESPA · Análise para investidores brasileiros</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'BTC/BRL', value: `R$ ${(b.btc_brl / 1000).toFixed(1)}K`, color: '#f59e0b', sub: `${fmtPct(btcBrlDelta, 1)} 30d` },
          { label: 'USD/BRL', value: `R$ ${b.usdbrl.toFixed(3)}`, color: '#ef4444', sub: 'Real enfraquecendo' },
          { label: 'Selic (a.a.)', value: `${b.selic}%`, color: '#60a5fa', sub: 'COPOM — tendência de alta' },
          { label: 'IPCA (12m)', value: `${b.ipca_12m}%`, color: '#f59e0b', sub: 'Acima da meta (3.5%)' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e', marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>💡 Análise BRL → BTC</div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>{b.note}</div>
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚖️ BTC vs Renda Fixa BR</div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>{b.selic_vs_btc_opportunity}</div>
      </div>
    </div>
  );
}

// ─── Mock news data ───────────────────────────────────────────────────────────
const GLOBAL_NEWS = [
  {
    period: 'dia',
    items: [
      { title: 'Fed mantém juros — Powell sinaliza cautela para próximos cortes', source: 'Reuters', impact: 'alto', tag: 'Fed', color: '#ef4444', url: 'https://www.reuters.com/markets/rates-bonds/' },
      { title: 'VIX sobe para 22 — hedge funds aumentam proteção antes do CPI', source: 'Bloomberg', impact: 'alto', tag: 'VIX', color: '#ef4444', url: 'https://www.bloomberg.com/markets/rates-bonds/treasuries' },
      { title: 'BCE sinaliza novo corte em abril — euro se fortalece vs USD', source: 'FT', impact: 'médio', tag: 'BCE', color: '#f59e0b', url: 'https://www.ft.com/central-banks' },
      { title: 'Ouro bate novo ATH de $2.912 — demanda de banco central China sobe', source: 'WSJ', impact: 'médio', tag: 'Gold', color: '#f59e0b', url: 'https://www.wsj.com/market-data/commodities' },
    ],
  },
  {
    period: 'semana',
    items: [
      { title: 'CPI EUA divulgado na quinta — mercado precifica 3,4% YoY vs 3,2% esperado', source: 'BLS', impact: 'alto', tag: 'CPI', color: '#ef4444', url: 'https://www.bls.gov/cpi/' },
      { title: 'NFP gerou 245k empregos — acima do esperado, pressiona Fed para manter juros', source: 'BLS', impact: 'alto', tag: 'NFP', color: '#ef4444', url: 'https://www.bls.gov/ces/' },
      { title: 'IBOVESPA recua 1.2% na semana — Selic alta pesa em fluxo estrangeiro', source: 'B3', impact: 'médio', tag: 'IBOV', color: '#f59e0b', url: 'https://www.b3.com.br/pt_br/market-data-e-indices/indices/' },
      { title: 'Petróleo WTI cai 4% — OPEC+ adia reunião sobre produção', source: 'Reuters', impact: 'médio', tag: 'WTI', color: '#f59e0b', url: 'https://www.reuters.com/business/energy/' },
      { title: 'DXY cai 0.8% na semana — dólar perde força pós-dados mistos de emprego', source: 'Bloomberg', impact: 'médio', tag: 'DXY', color: '#f59e0b', url: 'https://www.bloomberg.com/markets/currencies' },
    ],
  },
  {
    period: 'mês',
    items: [
      { title: 'FOMC de março: Fed mantém taxa em 4.375% — discurso divide mercado', source: 'Fed Reserve', impact: 'alto', tag: 'FOMC', color: '#ef4444', url: 'https://www.federalreserve.gov/monetarypolicy/' },
      { title: 'BoJ eleva taxa para 0.5% — maior alta em 17 anos — carry trade em alerta', source: 'BoJ', impact: 'alto', tag: 'BoJ', color: '#ef4444', url: 'https://www.boj.or.jp/en/mopo/index.htm' },
      { title: 'Cobre sobe 7% no mês — China anuncia estímulo de infraestrutura de $500B', source: 'Reuters', impact: 'médio', tag: 'Cobre', color: '#f59e0b', url: 'https://www.reuters.com/markets/commodities/' },
      { title: 'PCE de fevereiro surpreende para cima — cortes Fed ficam mais distantes', source: 'BEA', impact: 'alto', tag: 'PCE', color: '#ef4444', url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index' },
      { title: 'Real cai 3.9% no mês vs USD — COPOM sinaliza mais altas na Selic', source: 'BCB', impact: 'médio', tag: 'BRL', color: '#f59e0b', url: 'https://www.bcb.gov.br/en/monetarypolicy' },
    ],
  },
];

const IMPACT_STYLE = {
  alto:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  icon: '🔴' },
  médio: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: '🟡' },
  baixo: { color: '#64748b', bg: 'rgba(100,116,139,0.1)',border: 'rgba(100,116,139,0.2)', icon: '⚪' },
};

function GlobalNewsPanel() {
  const [period, setPeriod] = useState('dia');
  const newsData = GLOBAL_NEWS.find(n => n.period === period);

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a2535', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>📰 Notícias de Impacto Global</span>
          <span style={{ fontSize: 9, color: '#475569', marginLeft: 8 }}>com link para fonte oficial</span>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#0d1421', padding: 3, borderRadius: 7, border: '1px solid #1a2535' }}>
          {['dia', 'semana', 'mês'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: period === p ? 'rgba(59,130,246,0.18)' : 'transparent',
              color: period === p ? '#60a5fa' : '#475569',
              textTransform: 'capitalize',
            }}>
              {p === 'dia' ? 'Hoje' : p === 'semana' ? 'Esta Semana' : 'Este Mês'}
            </button>
          ))}
        </div>
      </div>
      <div>
        {newsData?.items.map((n, i) => {
          const imp = IMPACT_STYLE[n.impact] || IMPACT_STYLE.baixo;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px',
              borderBottom: i < newsData.items.length - 1 ? '1px solid rgba(26,37,53,0.5)' : 'none',
            }}>
              <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>{imp.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: '#475569' }}>{n.source}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: imp.bg, color: imp.color, border: `1px solid ${imp.border}`, fontWeight: 700 }}>
                    {n.impact.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#0d1421', color: '#64748b', border: '1px solid #1a2535', fontFamily: 'JetBrains Mono, monospace' }}>
                    {n.tag}
                  </span>
                </div>
              </div>
              <a href={n.url} target="_blank" rel="noopener noreferrer" style={{
                flexShrink: 0, fontSize: 10, color: '#3b82f6', textDecoration: 'none',
                padding: '3px 8px', borderRadius: 5,
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2,
              }}>
                Ver ↗
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = ['FX & Câmbio', 'Commodities', 'Índices', 'Bancos Centrais', 'Correlações BTC', 'Brasil (BRL)'];

export default function GlobalMarkets() {
  const [tab, setTab] = useState('FX & Câmbio');
  const [corrPeriod, setCorrPeriod] = useState('30d');

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>🌍 Mercados Globais</h1>
            <ModeBadge mode="mock" />
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>DXY · EUR · BRL · GBP · JPY · Ouro · Petróleo · Índices · Bancos Centrais · Correlações com BTC</p>
        </div>
      </div>

      {/* Regra de Ouro */}
      <GoldenRule compact />

      {/* News Panel */}
      <GlobalNewsPanel />

      {/* Quick snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'DXY', v: 104.82, d: pct(104.82, 108.40), inv: true },
          { label: 'EUR/USD', v: 1.0842, d: pct(1.0842, 1.0520), inv: false },
          { label: 'USD/BRL', v: 5.742, d: pct(5.742, 5.520), inv: true },
          { label: 'XAU', v: 2912.5, d: pct(2912.5, 2780), inv: false },
          { label: 'S&P 500', v: 5687.4, d: pct(5687.4, 5380.1), inv: false },
          { label: 'VIX', v: 22.14, d: pct(22.14, 15.80), inv: true },
        ].map((s, i) => {
          const c = col(s.d, s.inv);
          return (
            <div key={i} style={{ background: '#111827', border: `1px solid ${c}20`, borderTop: `2px solid ${c}`, borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{s.v > 100 ? s.v.toLocaleString() : s.v.toFixed(s.v > 10 ? 2 : 4)}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: c }}>{fmtPct(s.d, 1)} 1M</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: tab === t ? 800 : 500, background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent', color: tab === t ? '#60a5fa' : '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      {/* TAB: FX */}
      {tab === 'FX & Câmbio' && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a2535', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>💱 Câmbio & DXY</span>
            <span style={{ fontSize: 9, color: '#475569' }}>com correlação BTC (30d)</span>
          </div>
          {fxRates.map((item, i) => (
            <div key={i}>
              <AssetRow item={item} />
              {item.note && <div style={{ fontSize: 9, color: '#334155', padding: '4px 14px 8px 52px', lineHeight: 1.5 }}>{item.note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* TAB: Commodities */}
      {tab === 'Commodities' && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a2535' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>🏗️ Commodities</span>
          </div>
          {commodities.map((item, i) => (
            <div key={i}>
              <AssetRow item={item} />
              {item.note && <div style={{ fontSize: 9, color: '#334155', padding: '4px 14px 8px 52px', lineHeight: 1.5 }}>{item.note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* TAB: Índices */}
      {tab === 'Índices' && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a2535' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>📊 Índices Globais</span>
          </div>
          {globalIndices.map((item, i) => (
            <div key={i}>
              <AssetRow item={item} />
              {item.note && <div style={{ fontSize: 9, color: '#334155', padding: '4px 14px 8px 52px', lineHeight: 1.5 }}>{item.note}</div>}
            </div>
          ))}
        </div>
      )}

      {/* TAB: Bancos Centrais */}
      {tab === 'Bancos Centrais' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {centralBankRates.map((b, i) => <RateCard key={i} bank={b} />)}
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🏛️ Ciclo Global de Juros → Impacto em BTC</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 9, color: '#64748b', lineHeight: 1.8 }}>
              <div>
                <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>🔴 Bancos Centrais SUBINDO juros:</div>
                <div>• Fed Hold/Hiking → custo de capital alto → pressão em ativos de risco</div>
                <div>• Selic em 13.75% → capital institucional BR prefere renda fixa vs BTC</div>
                <div>• BoJ hikings → carry trade encerramento → risco-off global</div>
              </div>
              <div>
                <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 4 }}>🟢 Bancos Centrais CORTANDO juros:</div>
                <div>• BCE cortando (-25bp Mar26) → liquidez europeia migrando para risco</div>
                <div>• PBoC afrouxando → capital chinês buscando alternativas</div>
                <div>• Cortes globais → expansão de liquidez → historicamente bullish BTC</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Correlações */}
      {tab === 'Correlações BTC' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🔗 Correlação BTC vs Ativos Globais</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['7d', '30d', '90d'].map(p => (
                  <button key={p} onClick={() => setCorrPeriod(p)} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 9, fontWeight: corrPeriod === p ? 700 : 500, background: corrPeriod === p ? 'rgba(59,130,246,0.15)' : 'transparent', borderColor: corrPeriod === p ? 'rgba(59,130,246,0.4)' : '#1a2535', color: corrPeriod === p ? '#60a5fa' : '#475569' }}>{p}</button>
                ))}
              </div>
            </div>
            <CorrelationChart data={btcCorrelationMatrix} period={corrPeriod} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>📖 Como Interpretar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: '>0.5', desc: 'Alta correlação positiva — movem juntos', color: '#10b981' },
                  { label: '0.2–0.5', desc: 'Correlação moderada', color: '#10b98180' },
                  { label: '-0.2–0.2', desc: 'Baixa/nenhuma correlação', color: '#f59e0b' },
                  { label: '-0.5 a -0.2', desc: 'Correlação inversa moderada', color: '#ef444480' },
                  { label: '<-0.5', desc: 'Alta correlação negativa', color: '#ef4444' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: r.color, width: 56 }}>{r.label}</span>
                    <span style={{ fontSize: 9, color: '#475569' }}>{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>🎯 Key Insights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {btcCorrelationMatrix.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5, padding: '5px 8px', background: '#0d1421', borderRadius: 5 }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{c.icon} {c.asset}:</span> {c.desc}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Brasil */}
      {tab === 'Brasil (BRL)' && <BRLSection />}
    </div>
  );
}