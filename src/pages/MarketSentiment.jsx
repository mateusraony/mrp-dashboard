// ─── SENTIMENTO DE MERCADO — Social Fear/Greed · Word Cloud · Correlações ─────
import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, BarChart,
} from 'recharts';
import { useMarketSentiment } from '../hooks/useMarketSentiment';
import { IS_LIVE } from '../lib/env';
import { ModeBadge } from '../components/ui/DataBadge';
import { DataTrustBadge } from '../components/ui/DataTrustBadge';

// ─── Static data (social APIs requerem plano pago) ────────────────────────────
const wordCloudData = [
  { text: 'Bitcoin', value: 980, sentiment: 0.22, color: '#f59e0b' },
  { text: 'ETF',     value: 742, sentiment: 0.48, color: '#10b981' },
  { text: 'BTC',     value: 698, sentiment: 0.18, color: '#f59e0b' },
  { text: 'Fed',     value: 621, sentiment: -0.31, color: '#ef4444' },
  { text: 'Bull',    value: 584, sentiment: 0.62, color: '#10b981' },
  { text: 'Halving', value: 548, sentiment: 0.71, color: '#10b981' },
  { text: 'ATH',     value: 374, sentiment: 0.82, color: '#10b981' },
  { text: 'Funding', value: 348, sentiment: -0.18, color: '#f59e0b' },
  { text: 'DXY',     value: 312, sentiment: -0.42, color: '#ef4444' },
  { text: 'HODL',    value: 112, sentiment: 0.68, color: '#10b981' },
];

const sentimentHistory7d = [
  { day: 'Dom', score: 71, volume_b: 24.2, btc_price: 82100 },
  { day: 'Seg', score: 68, volume_b: 28.4, btc_price: 83200 },
  { day: 'Ter', score: 74, volume_b: 31.8, btc_price: 84800 },
  { day: 'Qua', score: 70, volume_b: 29.1, btc_price: 84100 },
  { day: 'Qui', score: 65, volume_b: 26.4, btc_price: 83600 },
  { day: 'Sex', score: 58, volume_b: 22.8, btc_price: 82900 },
  { day: 'Sáb', score: 62, volume_b: 25.6, btc_price: 84300 },
];

const socialCorrelation = {
  sentiment_vs_price_24h: 0.74, sentiment_vs_volume_24h: 0.68,
  sentiment_vs_price_7d: 0.61, sentiment_vs_volume_7d: 0.55,
  lag_hours_optimal: 4,
  note: 'Correlação social-preço de 0.74 com lag de ~4h. Picos de menções Bitcoin (+30% vs média) antecederam altas em 68% dos casos nos últimos 30 dias.',
};

const trendingTopics = [
  { topic: '#Bitcoin', mentions_24h: 284200, change_pct: 18.4,  sentiment: 0.31,  platform: 'X' },
  { topic: '#BTC',     mentions_24h: 198400, change_pct: 12.1,  sentiment: 0.28,  platform: 'X' },
  { topic: '#FOMC',    mentions_24h: 142800, change_pct: 84.2,  sentiment: -0.42, platform: 'X' },
  { topic: '#ETF',     mentions_24h: 98400,  change_pct: 22.8,  sentiment: 0.54,  platform: 'X' },
  { topic: 'Halving',  mentions_24h: 38400,  change_pct: 42.1,  sentiment: 0.72,  platform: 'X' },
];

const kolSentiment = [
  { name: 'Michael Saylor', handle: '@saylor',     sentiment: 0.98,  stance: 'Ultra Bullish BTC', followers_m: 4.2 },
  { name: 'Cathie Wood',    handle: '@CathieDWood', sentiment: 0.74,  stance: 'Bullish, $1M target', followers_m: 1.8 },
  { name: 'Peter Schiff',   handle: '@PeterSchiff', sentiment: -0.91, stance: 'Bear, prefers Gold', followers_m: 1.1 },
  { name: 'Raoul Pal',      handle: '@RaoulGMI',    sentiment: 0.62,  stance: 'Macro Bullish', followers_m: 1.3 },
];

const mentionsHourly = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  mentions: Math.round(11800 * (i >= 12 && i <= 18 ? 1.4 : 1.0) * (0.85 + Math.sin(i) * 0.15)),
  btc_volume_m: parseFloat((1050 + Math.sin(i * 0.4) * 300).toFixed(0)),
}));

// ─── Word Cloud Component ─────────────────────────────────────────────────────
function WordCloud({ words }) {
  const maxVal = Math.max(...words.map(w => w.value));
  const sorted = [...words].sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', padding: '10px', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
      {sorted.map((w, i) => {
        const size = 8 + (w.value / maxVal) * 22;
        const opacity = 0.5 + (w.value / maxVal) * 0.5;
        return (
          <span key={i} title={`${w.text}: ${w.value} menções · Sentimento: ${w.sentiment > 0 ? '+' : ''}${w.sentiment.toFixed(2)}`} style={{
            fontSize: size, fontWeight: w.value > maxVal * 0.5 ? 800 : 600,
            color: w.color, opacity,
            cursor: 'default', transition: 'opacity 0.15s',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '-0.01em',
          }}
            onMouseEnter={e => { const t = e.target; if (t instanceof HTMLElement) t.style.opacity = '1'; }}
            onMouseLeave={e => { const t = e.target; if (t instanceof HTMLElement) t.style.opacity = String(opacity); }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

// ─── Social Gauge ─────────────────────────────────────────────────────────────
function SocialGauge({ score, color, label }) {
  const zones = [
    { label: 'Medo Extremo', max: 25, color: '#60a5fa' },
    { label: 'Medo',         max: 45, color: '#10b981' },
    { label: 'Neutro',       max: 55, color: '#94a3b8' },
    { label: 'Ganância',     max: 75, color: '#f59e0b' },
    { label: 'Ganância Ext.',max: 100, color: '#ef4444' },
  ];
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 52, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1, textShadow: `0 0 24px ${color}55` }}>{score}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, marginBottom: 8 }}>{label}</div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #60a5fa 0%, #10b981 25%, #94a3b8 45%, #f59e0b 65%, #ef4444 100%)' }} />
        <div style={{ position: 'absolute', top: -2, left: `${score}%`, transform: 'translateX(-50%)', width: 3, height: 10, borderRadius: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.9)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#334155' }}>
        <span>Medo Extremo</span><span>Neutro</span><span>Ganância Ext.</span>
      </div>
    </div>
  );
}

// ─── Source Card (live shape: {label, score, weight, raw}) ───────────────────
function SourceCard({ src }) {
  const sentColor = src.score > 75 ? '#ef4444' : src.score > 60 ? '#f59e0b' : src.score > 45 ? '#10b981' : '#60a5fa';
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{src.label}</div>
        <div style={{ fontSize: 9, color: '#334155' }}>peso: {Math.round(src.weight * 100)}%</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: sentColor, lineHeight: 1, marginBottom: 4 }}>{src.score}</div>
      <div style={{ fontSize: 8, color: '#334155' }}>{src.raw}</div>
      <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: '#1a2535' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${src.score}%`, background: sentColor, opacity: 0.7 }} />
      </div>
    </div>
  );
}

// ─── KOL Card ─────────────────────────────────────────────────────────────────
function KOLCard({ kol }) {
  const sc = kol.sentiment > 0.3 ? '#10b981' : kol.sentiment < -0.3 ? '#ef4444' : '#f59e0b';
  const sl = kol.sentiment > 0.6 ? 'Ultra Bullish' : kol.sentiment > 0.3 ? 'Bullish' : kol.sentiment < -0.6 ? 'Ultra Bearish' : kol.sentiment < -0.3 ? 'Bearish' : 'Neutro';
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 12px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: `${sc}18`, border: `1px solid ${sc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
        {kol.sentiment > 0 ? '🐂' : '🐻'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{kol.name}</div>
        <div style={{ fontSize: 9, color: '#475569' }}>{kol.handle} · {kol.followers_m}M seguidores</div>
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{kol.stance}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: sc }}>{kol.sentiment > 0 ? '+' : ''}{kol.sentiment.toFixed(2)}</div>
        <div style={{ fontSize: 8, color: sc }}>{sl}</div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Tendências', 'KOLs', 'Correlações'];

const SENTIMENT_FALLBACK = {
  score: 50, label_pt: 'Carregando...', color: '#94a3b8',
  prev_24h: 50, delta_24h: 0, sources: [],
};

export default function MarketSentiment() {
  const [tab, setTab] = useState('Overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const { data: sentiment } = useMarketSentiment();
  const s = sentiment ?? SENTIMENT_FALLBACK;

  const generateAIAnalysis = async () => {
    // TODO: integrar com API real de AI (OpenAI/Claude) quando dados reais forem conectados
    setIsGenerating(true);
    setTimeout(() => {
      setAiAnalysis('Análise AI disponível após conexão com APIs reais. Configure VITE_AI_API_KEY para ativar.');
      setIsGenerating(false);
    }, 800);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>🧠 Sentimento Social</h1>
            <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
            {!IS_LIVE && <DataTrustBadge mode="mock" confidence="D" source="Demo" reason="Dados sociais simulados — Twitter/Reddit sem API real" />}
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', fontWeight: 700 }}>AI-Powered</span>
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Twitter/X · Reddit · Telegram · Notícias Cripto · Word Cloud · Correlação BTC</p>
        </div>
        <button onClick={generateAIAnalysis} disabled={isGenerating} style={{ padding: '9px 16px', borderRadius: 8, cursor: isGenerating ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, background: isGenerating ? '#0d1421' : 'rgba(167,139,250,0.12)', border: `1px solid ${isGenerating ? '#1a2535' : 'rgba(167,139,250,0.35)'}`, color: isGenerating ? '#334155' : '#a78bfa' }}>
          {isGenerating ? '⏳ Analisando...' : '🤖 Gerar Análise AI'}
        </button>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 10, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)' }}>
          <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, marginBottom: 6 }}>🤖 Análise AI — Sentimento Social</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>{aiAnalysis}</div>
        </div>
      )}

      {/* Big gauge + sources */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Social Fear/Greed Score</div>
          <SocialGauge score={s.score} color={s.color} label={s.label_pt} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            <div><div style={{ fontSize: 8, color: '#334155' }}>24h atrás</div><div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: s.delta_24h > 0 ? '#10b981' : '#ef4444' }}>{s.prev_24h} ({s.delta_24h > 0 ? '+' : ''}{s.delta_24h})</div></div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Score por Fonte</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
            {s.sources.map((src, i) => <SourceCard key={i} src={src} />)}
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
            💡 Correlação sentimento → preço BTC: <span style={{ color: '#60a5fa', fontWeight: 700 }}>{socialCorrelation.sentiment_vs_price_24h}</span> · Lag ótimo: <span style={{ color: '#f59e0b' }}>{socialCorrelation.lag_hours_optimal}h</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: tab === t ? 800 : 500, background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent', color: tab === t ? '#60a5fa' : '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Word Cloud */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>☁️ Nuvem de Palavras</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 10 }}>Tamanho = volume de menções · Cor = sentimento (verde/vermelho)</div>
            <WordCloud words={wordCloudData} />
          </div>

          {/* 7d history */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📈 Sentimento + Preço BTC (7 dias)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={sentimentHistory7d} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="score" tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
                <Bar yAxisId="score" dataKey="score" radius={[3, 3, 0, 0]} fillOpacity={0.7} name="Score">
                  {sentimentHistory7d.map((e, i) => <Cell key={i} fill={e.score > 60 ? '#f59e0b' : e.score > 45 ? '#10b981' : '#60a5fa'} />)}
                </Bar>
                <Line yAxisId="price" dataKey="btc_price" stroke="#f59e0b" strokeWidth={2} dot={false} name="BTC" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Mentions hourly */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📊 Menções + Volume BTC (24h por hora)</div>
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart data={mentionsHourly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis yAxisId="mentions" tick={{ fontSize: 7, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 7, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
                <Bar yAxisId="mentions" dataKey="mentions" fill="#3b82f6" fillOpacity={0.5} radius={[2, 2, 0, 0]} name="Menções" />
                <Line yAxisId="vol" dataKey="btc_volume_m" stroke="#f59e0b" strokeWidth={2} dot={false} name="Vol BTC ($M)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB: Tendências */}
      {tab === 'Tendências' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>🔥 Trending Topics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {trendingTopics.map((t, i) => {
                const sc = t.sentiment > 0.2 ? '#10b981' : t.sentiment < -0.2 ? '#ef4444' : '#f59e0b';
                const cc = t.change_pct >= 0 ? '#10b981' : '#ef4444';
                const maxM = Math.max(...trendingTopics.map(x => x.mentions_24h));
                return (
                  <div key={i} style={{ padding: '9px 12px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#e2e8f0', flex: 1 }}>{t.topic}</span>
                      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${sc}10`, color: sc, border: `1px solid ${sc}20` }}>{sc === '#10b981' ? 'Bullish' : sc === '#ef4444' ? 'Bearish' : 'Neutro'}</span>
                      <span style={{ fontSize: 9, color: '#475569' }}>{t.platform}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: cc }}>{t.change_pct > 0 ? '+' : ''}{t.change_pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#1a2535' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${(t.mentions_24h / maxM) * 100}%`, background: sc, opacity: 0.7 }} />
                      </div>
                      <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#475569', width: 70, textAlign: 'right' }}>{t.mentions_24h.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Word cloud + top words */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>☁️ Nuvem de Palavras Detalhada</div>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 10 }}>Hover para ver detalhes · Cores = sentimento</div>
            <WordCloud words={wordCloudData} />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>Top 15 por Menções</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {wordCloudData.slice(0, 15).map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#0d1421', borderRadius: 5, border: '1px solid #0f1d2e' }}>
                    <span style={{ fontSize: 9, color: '#334155', width: 16, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>#{i+1}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: w.color, flex: 1 }}>{w.text}</span>
                    <div style={{ flex: 2, height: 3, borderRadius: 2, background: '#1a2535' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${(w.value / wordCloudData[0].value) * 100}%`, background: w.color, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'JetBrains Mono, monospace', width: 55, textAlign: 'right' }}>{w.value.toLocaleString()}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: w.sentiment >= 0 ? '#10b981' : '#ef4444', width: 40, textAlign: 'right' }}>{w.sentiment >= 0 ? '+' : ''}{w.sentiment.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: KOLs */}
      {tab === 'KOLs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>👥 Key Opinion Leaders — Sentimento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {kolSentiment.map((k, i) => <KOLCard key={i} kol={k} />)}
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e', fontSize: 9, color: '#475569', lineHeight: 1.6 }}>
              💡 Peso KOL no score: influenciadores com &gt;1M seguidores têm peso 2× no cálculo do sentimento agregado. Divergência entre KOLs bullish e bearish pode sinalizar fase de distribuição.
            </div>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📊 KOL Sentiment Spread</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={kolSentiment} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} formatter={v => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n.toFixed(2)}`, 'Sentimento']; }} />
                <ReferenceLine x={0} stroke="#1e2d45" />
                <Bar dataKey="sentiment" radius={[0, 3, 3, 0]}>
                  {kolSentiment.map((k, i) => <Cell key={i} fill={k.sentiment > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB: Correlações */}
      {tab === 'Correlações' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>🔗 Correlação Social → Preço BTC</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Sentimento vs Preço (24h)', value: socialCorrelation.sentiment_vs_price_24h, color: '#60a5fa' },
                { label: 'Sentimento vs Volume (24h)', value: socialCorrelation.sentiment_vs_volume_24h, color: '#10b981' },
                { label: 'Sentimento vs Preço (7d)', value: socialCorrelation.sentiment_vs_price_7d, color: '#a78bfa' },
                { label: 'Sentimento vs Volume (7d)', value: socialCorrelation.sentiment_vs_volume_7d, color: '#f59e0b' },
              ].map((c, i) => (
                <div key={i} style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: '#334155', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: c.color }}>{c.value > 0 ? '+' : ''}{c.value.toFixed(2)}</div>
                  <div style={{ height: 3, borderRadius: 2, background: '#1a2535', marginTop: 6 }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.abs(c.value) * 100}%`, marginLeft: c.value < 0 ? `${(1 - Math.abs(c.value)) * 100}%` : 0, background: c.color, opacity: 0.7 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>
              <span style={{ color: '#94a3b8', fontWeight: 700 }}>Lag ótimo:</span> {socialCorrelation.lag_hours_optimal}h<br />
              {socialCorrelation.note}
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📈 Histórico: Sentimento vs Volume</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={sentimentHistory7d} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="score" tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}B`} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
                <Bar yAxisId="vol" dataKey="volume_b" fill="#3b82f6" fillOpacity={0.3} radius={[2, 2, 0, 0]} name="Volume ($B)" />
                <Line yAxisId="score" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Sentiment Score" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}