// ─── MERCADOS GLOBAIS — FX · Commodities · Bancos Centrais · BRL ─────────────
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useGlobalMarkets, useGlobalMarketsBase } from '../hooks/useGlobalMarkets';
import { useBcbData } from '../hooks/useBcb';
import { useBtcTicker } from '../hooks/useBtcData';
import { useGdeltNews } from '../hooks/useGdelt';
import { useCoinGeckoNews } from '../hooks/useCoinGeckoNews';
import { IS_LIVE } from '../lib/env';
import { isSupabaseConfigured } from '../services/supabase';
import { ModeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';
import GoldenRule from '../components/ui/GoldenRule';

// ─── News helpers ─────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

const SENT_ICON  = { '1': '🟢', '-1': '🔴', '0': '⚪' };
const SENT_COLOR = { '1': '#10b981', '-1': '#ef4444', '0': '#64748b' };

const FX_ICONS   = { 'EUR/USD': '🇪🇺', 'USD/JPY': '🇯🇵', 'GBP/USD': '🇬🇧', 'USD/CNY': '🇨🇳', 'USD/BRL': '🇧🇷' };
const CB_ICONS   = { 'Federal Reserve': '🇺🇸', 'Banco Central': '🇧🇷', 'BCE': '🇪🇺', 'BoJ': '🇯🇵' };
const COMM_ICONS = { Gold: '🥇', Silver: '🥈', 'WTI Crude Oil': '🛢️' };
const CORR_ICONS = { SP500: '📈', DXY: '💵', GOLD: '🥇', VIX: '🌡️' };

const CORR_DESC  = {
  SP500: 'BTC e equities têm correlação positiva em expansão de liquidez global',
  DXY:   'Dólar forte historicamente pressiona BTC — correlação negativa',
  GOLD:  'BTC e ouro disputam o papel de "reserva de valor"',
  VIX:   'Volatilidade extrema força desalavancagem — pressão em todos os ativos',
};

// ─── Accordion de dica ────────────────────────────────────────────────────────
function TipCard({ emoji, title, body, tag }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', borderLeft: '3px solid #3b82f6' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
          {tag && <span style={{ fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{tag}</span>}
        </div>
        <span style={{ fontSize: 12, color: '#4a5568' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.7, borderTop: '1px solid #1e2d45', paddingTop: 10 }}>
          {body}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPct(v, dec = 2) { return `${v >= 0 ? '+' : ''}${v.toFixed(dec)}%`; }
function col(v, inv = false) {
  const pos = inv ? v <= 0 : v >= 0;
  return pos ? '#10b981' : '#ef4444';
}
function fmtVal(v) {
  if (!v) return '—';
  return v > 1000 ? v.toLocaleString() : v.toFixed(v > 100 ? 0 : v > 10 ? 2 : 4);
}

// ─── Asset Row (adapts our delta_1d/7d/30d fractions) ────────────────────────
function AssetRow({ item }) {
  const d1  = (item.delta_1d  ?? 0) * 100;
  const d7  = (item.delta_7d  ?? 0) * 100;
  const d30 = (item.delta_30d ?? 0) * 100;
  const inv = item.inverted || false;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(26,37,53,0.5)' }}>
      <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon ?? '—'}</span>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{item.pair ?? item.name ?? item.symbol}</div>
        <div style={{ fontSize: 9, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.unit ?? item.source}</div>
      </div>
      <div style={{ textAlign: 'right', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{fmtVal(item.value)}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flex: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {[{ label: '1D', v: d1 }, { label: '1W', v: d7 }, { label: '1M', v: d30 }].map(({ label, v }) => (
          <span key={label} style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: col(v, inv), background: `${col(v, inv)}10`, border: `1px solid ${col(v, inv)}20`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            {fmtPct(v, 1)} <span style={{ opacity: 0.5 }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Central Bank Card ────────────────────────────────────────────────────────
function RateCard({ bank }) {
  const dirColor = bank.direction === 'hiking' ? '#ef4444' : bank.direction === 'cutting' ? '#10b981' : '#f59e0b';
  const dirLabel = bank.direction === 'hiking' ? '▲ Subindo' : bank.direction === 'cutting' ? '▼ Cortando' : '→ Hold';
  const icon = CB_ICONS[bank.bank] ?? '🏦';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{icon} {bank.country}</div>
          <div style={{ fontSize: 9, color: '#475569' }}>{bank.bank}</div>
        </div>
        <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: `${dirColor}10`, color: dirColor, border: `1px solid ${dirColor}25`, fontWeight: 700 }}>{dirLabel}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#f1f5f9', lineHeight: 1 }}>
        {bank.rate != null ? `${bank.rate.toFixed(2)}%` : '—'}
      </div>
      <div style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>Fonte: {bank.source}</div>
    </div>
  );
}

// ─── Correlation Bar Chart ────────────────────────────────────────────────────
function CorrelationChart({ data, period }) {
  const key = `corr_${period}`;
  const sorted = [...data]
    .filter(d => d[key] != null)
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));

  if (sorted.length === 0) {
    return <div style={{ textAlign: 'center', fontSize: 11, color: '#334155', padding: 40 }}>Correlações calculando... (necessita klines 1d)</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={88} />
        <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} formatter={v => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n.toFixed(2)}`, `Corr ${period}`]; }} />
        <ReferenceLine x={0} stroke="#1e2d45" />
        <Bar dataKey={key} radius={[0, 3, 3, 0]}>
          {sorted.map((d, i) => <Cell key={i} fill={(d[key] ?? 0) > 0.3 ? '#10b981' : (d[key] ?? 0) < -0.3 ? '#ef4444' : '#f59e0b'} fillOpacity={0.8} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── BRL Section ──────────────────────────────────────────────────────────────
function BRLSection({ bcb, btcPrice }) {
  const selic  = bcb?.selic  ?? null;
  const ipca   = bcb?.ipca   ?? null;
  const usdbrl = bcb?.usdbrl ?? null;
  const btcBrl = btcPrice && usdbrl ? btcPrice * usdbrl : null;

  return (
    <div style={{ background: '#111827', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>🇧🇷</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>Perspectiva BRL</div>
          <div style={{ fontSize: 10, color: '#475569' }}>BTC/BRL · Selic · IPCA · Análise para investidores brasileiros</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'BTC/BRL', value: btcBrl ? `R$ ${(btcBrl / 1000).toFixed(1)}K` : '—', color: '#f59e0b', sub: 'BTC × câmbio atual' },
          { label: 'USD/BRL', value: usdbrl ? `R$ ${usdbrl.toFixed(3)}` : '—', color: '#ef4444', sub: 'BCB OpenData' },
          { label: 'Selic (a.a.)', value: selic ? `${selic.toFixed(2)}%` : '—', color: '#60a5fa', sub: 'Banco Central do Brasil' },
          { label: 'IPCA (mês)', value: ipca ? `${ipca.toFixed(2)}%` : '—', color: '#f59e0b', sub: 'Inflação mensal (BCB)' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>💡 Análise BRL → BTC</div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>
          Com Selic elevada, o capital institucional brasileiro tende a preferir renda fixa. A desvalorização do BRL vs USD amplifica retornos de BTC para investidores em reais, tornando o ativo uma hedge cambial natural. Compare sempre o retorno BTC/BRL vs CDI líquido.
        </div>
      </div>
    </div>
  );
}

// ─── News Panel (GDELT macro + CoinGecko cripto) ─────────────────────────────
function GlobalNewsPanel() {
  const [sourceFilter, setSourceFilter] = useState('all');

  const { data: gdeltArticles = [], isLoading: gdeltLoading } = useGdeltNews('bitcoin economy');
  const { data: cgData } = useCoinGeckoNews();

  const cgItems     = cgData?.items     ?? [];
  const isFallback  = cgData?.isFallback  ?? false;
  const lastUpdated = cgData?.lastUpdated ?? null;
  const isLoading   = gdeltLoading && cgItems.length === 0;

  // Normaliza GDELT → shape unificado
  const macroArticles = gdeltArticles.map(a => ({
    title:        a.title,
    url:          a.url,
    source:       a.domain,
    published_at: a.published_at,
    sentiment:    String(a.sentiment),
    type:         'macro',
  }));

  // Normaliza CoinGecko → shape unificado
  const cryptoArticles = cgItems.map(a => ({
    title:        a.title,
    url:          a.url,
    source:       a.news_site,
    published_at: a.published_at,
    sentiment:    '0',
    type:         'crypto',
  }));

  // Merge, dedup por URL, ordenar por data desc
  const seen = new Set();
  const merged = [...macroArticles, ...cryptoArticles]
    .filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 12);

  // When GDELT unavailable, Macro tab falls back to CryptoCompare articles
  const filtered = sourceFilter === 'all'
    ? merged
    : sourceFilter === 'macro' && macroArticles.length === 0
      ? merged
      : merged.filter(a => a.type === sourceFilter);

  const isLive = merged.length > 0;

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a2535', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>📰 Contexto de Mercado Global</span>
          {IS_LIVE ? (
            isLive
              ? <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>● LIVE</span>
              : <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>{isLoading ? 'CARREGANDO' : 'SEM DADOS'}</span>
          ) : (
            <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 700 }}>MOCK</span>
          )}
          {isFallback && lastUpdated && (
            <span title={`Último salvo no Supabase: ${new Date(lastUpdated).toLocaleString('pt-BR')}`}
              style={{ fontSize: 8, color: '#f59e0b', cursor: 'help' }}>
              ⚠ Cache · {new Date(lastUpdated).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        {/* Source filter */}
        <div style={{ display: 'flex', gap: 4, background: '#0d1421', padding: 3, borderRadius: 7, border: '1px solid #1a2535' }}>
          {[
            { key: 'all', label: 'Todas' },
            { key: 'macro', label: 'Macro' },
            { key: 'crypto', label: 'Cripto' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setSourceFilter(key)} style={{
              padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700,
              background: sourceFilter === key ? 'rgba(59,130,246,0.18)' : 'transparent',
              color: sourceFilter === key ? '#60a5fa' : '#475569',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Banner fallback */}
      {isFallback && lastUpdated && (
        <div style={{ padding: '5px 16px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10 }}>⚠️</span>
          <span style={{ fontSize: 10, color: '#78716c' }}>
            Notícias do cache Supabase — última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {/* Fontes */}
      <div style={{ padding: '5px 16px', background: 'rgba(59,130,246,0.03)', borderBottom: '1px solid rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#334155' }}>
          Macro: GDELT Project (4.500+ fontes globais) · Cripto: CryptoCompare / Messari (fallback automático) · Atualização automática a cada 30 min
        </span>
      </div>

      {/* Artigos */}
      <div>
        {isLoading && !isLive && (
          <div style={{ padding: '20px 16px', fontSize: 11, color: '#334155', textAlign: 'center' }}>Carregando notícias ao vivo...</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: '20px 16px', fontSize: 11, color: '#334155', textAlign: 'center' }}>
            {IS_LIVE ? 'Nenhuma notícia disponível no momento — aguardando resposta das APIs.' : 'Modo mock — notícias ao vivo requerem DATA_MODE=live.'}
          </div>
        )}
        {filtered.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(26,37,53,0.5)' : 'none' }}>
            <span style={{ fontSize: 12, marginTop: 2, flexShrink: 0 }}>{SENT_ICON[n.sentiment] ?? '⚪'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 500, lineHeight: 1.45, marginBottom: 4 }}>{n.title}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#475569' }}>{n.source}</span>
                <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4,
                  background: n.type === 'macro' ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)',
                  color: n.type === 'macro' ? '#3b82f6' : '#10b981',
                  border: n.type === 'macro' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(16,185,129,0.2)',
                  fontWeight: 700 }}>
                  {n.type === 'macro' ? 'MACRO' : 'CRIPTO'}
                </span>
                <span style={{ fontSize: 8, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
                  {timeAgo(n.published_at)}
                </span>
              </div>
            </div>
            <a href={n.url} target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, fontSize: 10, color: '#3b82f6', textDecoration: 'none', padding: '3px 8px', borderRadius: 5, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 1 }}>
              Ver ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = ['FX & Câmbio', 'Commodities', 'Bancos Centrais', 'Correlações BTC', 'Brasil (BRL)'];

export default function GlobalMarkets() {
  const [tab, setTab]             = useState('FX & Câmbio');
  const [corrPeriod, setCorrPeriod] = useState('30d');

  const { data, isLoading }   = useGlobalMarkets();
  const { data: baseData }    = useGlobalMarketsBase();
  const { data: bcb }         = useBcbData();
  const { data: ticker }      = useBtcTicker();

  const isFallback  = baseData?.isFallback  ?? false;
  const lastUpdated = baseData?.lastUpdated ?? null;

  const fxRates        = (data?.fxRates        ?? []).map(r => ({ ...r, icon: FX_ICONS[r.pair]     ?? '💱' }));
  const commodities    = (data?.commodities    ?? []).map(c => ({ ...c, icon: COMM_ICONS[c.name]  ?? '📦' }));
  const cbRates        = (data?.centralBankRates ?? []);
  const btcCorrelations = (data?.btcCorrelations ?? []).map(c => ({
    ...c,
    icon: CORR_ICONS[c.asset] ?? '📊',
    desc: CORR_DESC[c.asset]  ?? '',
  }));

  // Quick snapshot — live values from FX + commodities
  const fxEur  = fxRates.find(r => r.pair === 'EUR/USD');
  const fxBrl  = fxRates.find(r => r.pair === 'USD/BRL');
  const gold   = commodities.find(c => c.symbol === 'XAU');
  const wti    = commodities.find(c => c.symbol === 'WTI');

  const snapshotItems = [
    { label: 'EUR/USD', v: fxEur?.value ?? 0, d: (fxEur?.delta_30d ?? 0) * 100, inv: false },
    { label: 'USD/BRL', v: fxBrl?.value ?? bcb?.usdbrl ?? 0, d: (fxBrl?.delta_30d ?? 0) * 100, inv: true },
    { label: 'XAU/oz',  v: gold?.value ?? 0, d: (gold?.delta_30d ?? 0) * 100, inv: false },
    { label: 'WTI',     v: wti?.value  ?? 0, d: (wti?.delta_30d  ?? 0) * 100, inv: false },
  ].filter(s => s.v > 0);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>🌍 Mercados Globais</h1>
            <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
            <DataTrustBadge
              mode={IS_LIVE ? (isSupabaseConfigured() ? 'live' : 'error') : 'mock'}
              confidence={IS_LIVE && isSupabaseConfigured() ? 'A' : 'D'}
              source="FRED API"
              sourceUrl="https://api.stlouisfed.org/fred"
              reason={!isSupabaseConfigured() && IS_LIVE ? 'Supabase não configurado — dados FRED indisponíveis' : !IS_LIVE ? 'DATA_MODE=mock' : undefined}
            />
            {isFallback && lastUpdated && (
              <span title={`Último salvo no Supabase: ${new Date(lastUpdated).toLocaleString('pt-BR')}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#f59e0b', cursor: 'help' }}>
                ⚠ Cache · {new Date(lastUpdated).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>EUR · BRL · GBP · JPY · Ouro · Petróleo · Bancos Centrais · Correlações com BTC</p>
        </div>
        {data && <div style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>Qualidade: {data.quality} · FRED/BCB</div>}
      </div>

      {/* ── PARA QUE SERVE ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>🌍</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>Para que serve esta página?</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, maxWidth: 800 }}>
              <strong style={{ color: '#cbd5e1' }}>Mercados Globais</strong> reúne os principais termômetros do ambiente macro mundial — câmbio, commodities, juros dos bancos centrais e correlações com BTC.{' '}
              <strong style={{ color: '#3b82f6' }}>Use esta página para responder:</strong>{' '}
              "O ambiente global está favorável ou desfavorável para o BTC agora?" — Liquidez global, força do dólar e ciclo de juros são os três maiores drivers macro do preço do Bitcoin.
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✅', text: 'Verificar se BTC está seguindo o SP500 (risco on/off global)' },
                { icon: '💵', text: 'Monitorar USD/BRL para calcular seu retorno real em reais' },
                { icon: '🏦', text: 'Entender se bancos centrais estão expandindo ou contraindo liquidez' },
                { icon: '🥇', text: 'Comparar BTC com ouro como reserva de valor alternativa' },
              ].map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <span>{u.icon}</span><span>{u.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BANNER CACHE / FALLBACK ───────────────────────────────────────────────── */}
      {isFallback && lastUpdated && (
        <div style={{ marginBottom: 16, padding: '7px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>⚠ Usando último valor salvo no Supabase — API FRED indisponível no momento</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>Última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}</span>
        </div>
      )}

      <GoldenRule compact />
      <GlobalNewsPanel />

      {/* Quick snapshot */}
      {snapshotItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${snapshotItems.length}, 1fr)`, gap: 8, marginBottom: 14 }}>
          {snapshotItems.map((s, i) => {
            const c = col(s.d, s.inv);
            return (
              <div key={i} style={{ background: '#111827', border: `1px solid ${c}20`, borderTop: `2px solid ${c}`, borderRadius: 9, padding: '8px 10px' }}>
                <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>{fmtVal(s.v)}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: c }}>{fmtPct(s.d, 1)} 1M</div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading && <div style={{ textAlign: 'center', fontSize: 11, color: '#475569', padding: '20px 0' }}>Carregando dados FRED/BCB...</div>}

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
        <div>
          <div style={{ padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#475569', display: 'inline-block', marginBottom: 10 }}>
            📌 <strong style={{ color: '#64748b' }}>Para que serve:</strong> Mostra quanto custa 1 USD em outras moedas. Dólar forte (DXY subindo) historicamente pressiona o BTC. Acompanhe USD/BRL para saber o seu retorno real em reais.
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a2535', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>💱 Câmbio & FX</span>
              <span style={{ fontSize: 9, color: '#475569' }}>via FRED API + BCB OpenData</span>
            </div>
            {fxRates.length > 0
              ? fxRates.map((item, i) => <AssetRow key={i} item={item} />)
              : <div style={{ padding: '20px 14px', fontSize: 11, color: '#334155', textAlign: 'center' }}>Aguardando dados FRED...</div>
            }
          </div>
        </div>
      )}

      {/* TAB: Commodities */}
      {tab === 'Commodities' && (
        <div>
          <div style={{ padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#475569', display: 'inline-block', marginBottom: 10 }}>
            📌 <strong style={{ color: '#64748b' }}>Para que serve:</strong> Ouro e prata competem com BTC como reserva de valor. WTI (petróleo bruto) reflete risco geopolítico e inflação. Quando ouro sobe em momentos de incerteza, BTC frequentemente acompanha.
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a2535' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>🏗️ Commodities</span>
              <span style={{ fontSize: 9, color: '#475569', marginLeft: 8 }}>Gold, Silver, WTI via FRED</span>
            </div>
            {commodities.length > 0
              ? commodities.map((item, i) => <AssetRow key={i} item={item} />)
              : <div style={{ padding: '20px 14px', fontSize: 11, color: '#334155', textAlign: 'center' }}>Aguardando dados FRED...</div>
            }
          </div>
        </div>
      )}

      {/* TAB: Bancos Centrais */}
      {tab === 'Bancos Centrais' && (
        <div>
          <div style={{ padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#475569', display: 'inline-block', marginBottom: 10 }}>
            📌 <strong style={{ color: '#64748b' }}>Para que serve:</strong> Juros altos = capital migra para renda fixa, saindo do BTC. Cortes de juros = liquidez cresce = historicamente bullish para cripto. O Fed (EUA) é o mais relevante globalmente.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {cbRates.length > 0
              ? cbRates.map((b, i) => <RateCard key={i} bank={b} />)
              : <div style={{ fontSize: 11, color: '#334155', gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>Aguardando dados FRED/BCB...</div>
            }
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>🏛️ Ciclo Global de Juros → Impacto em BTC</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 9, color: '#64748b', lineHeight: 1.8 }}>
              <div>
                <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>🔴 Bancos Centrais SUBINDO juros:</div>
                <div>• Fed Hold/Hiking → custo de capital alto → pressão em ativos de risco</div>
                <div>• Selic elevada → capital BR prefere renda fixa vs BTC</div>
                <div>• BoJ hikings → carry trade encerramento → risco-off global</div>
              </div>
              <div>
                <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 4 }}>🟢 Bancos Centrais CORTANDO juros:</div>
                <div>• BCE cortando → liquidez europeia migrando para risco</div>
                <div>• PBoC afrouxando → capital chinês buscando alternativas</div>
                <div>• Cortes globais → expansão de liquidez → historicamente bullish BTC</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Correlações */}
      {tab === 'Correlações BTC' && (
        <div>
        <div style={{ padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#475569', display: 'inline-block', marginBottom: 10 }}>
          📌 <strong style={{ color: '#64748b' }}>Para que serve:</strong> Indica se BTC está se comportando como ativo de risco (correlação positiva com SP500), reserva de valor (junto ao ouro) ou inversamente ao dólar (DXY negativo). Correlações mudam conforme o regime de mercado.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                🔗 Correlação BTC vs Ativos Globais
                <DataTrustBadge
                  mode="estimated"
                  confidence="B"
                  source="Correlações (calculado)"
                  reason="Pearson de séries FRED — cálculo proxy, não fonte direta"
                />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['7d', '30d', '90d'].map(p => (
                  <button key={p} onClick={() => setCorrPeriod(p)} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 9, fontWeight: corrPeriod === p ? 700 : 500, background: corrPeriod === p ? 'rgba(59,130,246,0.15)' : 'transparent', borderColor: corrPeriod === p ? 'rgba(59,130,246,0.4)' : '#1a2535', color: corrPeriod === p ? '#60a5fa' : '#475569' }}>{p}</button>
                ))}
              </div>
            </div>
            <CorrelationChart data={btcCorrelations} period={corrPeriod} />
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
                {btcCorrelations.map((c, i) => (
                  <div key={i} style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5, padding: '5px 8px', background: '#0d1421', borderRadius: 5 }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{c.icon} {c.label}:</span> {c.desc || 'Correlação calculada via Pearson (klines Binance 1d)'}
                  </div>
                ))}
                {btcCorrelations.length === 0 && (
                  <div style={{ fontSize: 9, color: '#334155' }}>Correlações serão exibidas após acumulação de dados históricos.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* TAB: Brasil */}
      {tab === 'Brasil (BRL)' && (
        <div>
          <div style={{ padding: '6px 10px', borderRadius: 6, background: '#0a1220', border: '1px solid #1e2d45', fontSize: 10, color: '#475569', display: 'inline-block', marginBottom: 10 }}>
            📌 <strong style={{ color: '#64748b' }}>Para que serve:</strong> Para o investidor brasileiro: mostra quanto BTC vale em reais, e como a Selic alta compete com o retorno do BTC. Compare BTC/BRL vs CDI para saber se vale o risco.
          </div>
          <BRLSection bcb={bcb} btcPrice={ticker?.mark_price} />
        </div>
      )}

      {/* ── DICAS DE OURO ────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>🏆 Dicas de Ouro</div>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 12 }}>Como usar os Mercados Globais para tomar decisões melhores com BTC</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TipCard
            emoji="📈" title="DXY subindo = pressão no BTC" tag="CÂMBIO"
            body="Quando o índice do dólar (DXY) sobe, geralmente o BTC cai. O dólar forte atrai capital global, tirando liquidez de ativos de risco como cripto. Monitore o DXY antes de abrir posições grandes — se o DXY estiver em tendência de alta, seja mais cauteloso com BTC."
          />
          <TipCard
            emoji="🏦" title="Bancos Centrais cortando juros = vento a favor" tag="LIQUIDEZ"
            body="Historicamente, ciclos de corte de juros (especialmente do Fed) precedem altas em BTC. Mais liquidez no sistema → mais apetite por risco. Quando Fed e BCE cortam ao mesmo tempo, o efeito é amplificado. Observe a direção (▲ Subindo / ▼ Cortando) em cada banco central."
          />
          <TipCard
            emoji="🥇" title="Ouro e BTC — reserva de valor comparada" tag="CORRELAÇÃO"
            body="Em períodos de stress geopolítico, ouro e BTC podem subir juntos como ativos de proteção. Mas quando o mercado entra em pânico total (VIX >30), BTC pode cair junto com tudo. A correlação BTC × Ouro muda conforme o regime — verifique sempre a janela de 30d."
          />
          <TipCard
            emoji="🇧🇷" title="Selic alta: calcule o CDI líquido antes de comprar BTC" tag="BRASIL"
            body="Com Selic a 14%+, o CDI líquido de IR (~11-12% a.a.) é o custo de oportunidade real para o investidor brasileiro. BTC precisaria superar isso para justificar o risco. Compare sempre BTC/BRL vs CDI no período — não BTC/USD, pois a desvalorização do real já 'ajuda' o retorno em reais."
          />
          <TipCard
            emoji="⚠️" title="VIX acima de 25: cuidado com alavancagem" tag="RISCO"
            body="Quando o VIX (medidor de medo do SP500) passa de 25, a volatilidade global sobe. Grandes players institucionais fecham posições alavancadas em todos os ativos, inclusive BTC. Em momentos de VIX elevado, prefira reduzir exposição ou proteger posições com stops mais apertados."
          />
          <TipCard
            emoji="🌐" title="Correlação BTC × SP500 não é constante" tag="AVANÇADO"
            body="Durante bull markets cripto, BTC frequentemente descorrelaciona do SP500 e age como ativo independente. Em crises sistêmicas (2020, 2022), a correlação sobe para 0.8+. Sempre olhe a janela de 30d na aba 'Correlações BTC' — a janela de 7d é muito ruidosa para decisões de médio prazo."
          />
        </div>
      </div>
    </div>
  );
}
