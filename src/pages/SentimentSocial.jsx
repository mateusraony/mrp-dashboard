// ─── SENTIMENTO SOCIAL — Twitter/X · Reddit · Fear/Greed Social ───────────────
import { useState } from 'react';
import { socialSentiment, wordCloudData, sentimentHistory7d, socialCorrelation, trendingTopics, kolSentiment, mentionsHourly } from '../components/data/mockDataSentiment';
import { ModeBadge } from '../components/ui/DataBadge';
import {
  ComposedChart, BarChart, Bar, Line, LineChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function col(v) { return v > 0.1 ? '#10b981' : v < -0.1 ? '#ef4444' : '#f59e0b'; }
function sign(v) { return v >= 0 ? '+' : ''; }

// ─── WORD CLOUD (SVG-based simulated) ────────────────────────────────────────
function WordCloud({ words }) {
  const maxVal = Math.max(...words.map(w => w.value));
  // Sort by value desc and lay out in a grid-like manner
  const sorted = [...words].sort((a, b) => b.value - a.value);
  const top30 = sorted.slice(0, 30);

  return (
    <div style={{ padding: '12px 8px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
      {top30.map((word, i) => {
        const ratio = word.value / maxVal;
        const fontSize = Math.round(9 + ratio * 22);
        const opacity = 0.6 + ratio * 0.4;
        return (
          <span
            key={i}
            title={`${word.text}: ${word.value.toLocaleString()} menções | Sentimento: ${word.sentiment > 0 ? '+' : ''}${word.sentiment.toFixed(2)}`}
            style={{
              fontSize,
              fontWeight: ratio > 0.5 ? 900 : ratio > 0.25 ? 700 : 500,
              color: word.color,
              opacity,
              cursor: 'default',
              fontFamily: ratio > 0.4 ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
              transition: 'all 0.15s',
              padding: '2px 4px',
              borderRadius: 4,
              background: `${word.color}08`,
              lineHeight: 1.2,
            }}
            onMouseEnter={e => { e.target.style.opacity = 1; e.target.style.background = `${word.color}18`; }}
            onMouseLeave={e => { e.target.style.opacity = opacity; e.target.style.background = `${word.color}08`; }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}

// ─── SOCIAL GAUGE ─────────────────────────────────────────────────────────────
function SocialGauge({ score }) {
  const zones = [
    { label: 'Extremo Medo', max: 25, color: '#60a5fa' },
    { label: 'Medo',         max: 45, color: '#10b981' },
    { label: 'Neutro',       max: 55, color: '#94a3b8' },
    { label: 'Ganância',     max: 75, color: '#f59e0b' },
    { label: 'Ext. Ganância',max: 100, color: '#ef4444' },
  ];
  const zone = zones.find(z => score <= z.max) || zones[4];

  return (
    <div style={{ background: '#111827', border: `1px solid ${zone.color}25`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>
        Fear & Greed Social 🌐
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 56, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: zone.color, lineHeight: 1, textShadow: `0 0 30px ${zone.color}55` }}>{score}</div>
        <div style={{ paddingBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: zone.color, marginBottom: 2 }}>{zone.label}</div>
          <div style={{ fontSize: 9, color: '#475569' }}>X · Reddit · Telegram · Portais</div>
        </div>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, marginBottom: 4, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #60a5fa 0%, #10b981 25%, #94a3b8 45%, #f59e0b 65%, #ef4444 100%)' }} />
        <div style={{ position: 'absolute', top: -2, left: `${score}%`, transform: 'translateX(-50%)', width: 3, height: 10, borderRadius: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.9)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155', marginBottom: 12 }}>
        <span>0 — Medo</span><span>50</span><span>100 — Ganância</span>
      </div>
      {/* Deltas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '7px 10px', borderRadius: 6, background: '#0d1421', border: '1px solid #1a2535' }}>
          <div style={{ fontSize: 8, color: '#334155' }}>vs 24h atrás</div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: socialSentiment.delta_24h >= 0 ? '#10b981' : '#ef4444' }}>
            {sign(socialSentiment.delta_24h)}{socialSentiment.delta_24h}
          </div>
        </div>
        <div style={{ padding: '7px 10px', borderRadius: 6, background: '#0d1421', border: '1px solid #1a2535' }}>
          <div style={{ fontSize: 8, color: '#334155' }}>vs 7d atrás</div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: socialSentiment.delta_7d >= 0 ? '#10b981' : '#ef4444' }}>
            {sign(socialSentiment.delta_7d)}{socialSentiment.delta_7d}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SOURCE BREAKDOWN ──────────────────────────────────────────────────────────
function SourceBreakdown() {
  const src = socialSentiment.sources;
  const items = [
    { name: 'Twitter/X',   key: 'twitter_x',  icon: '𝕏', color: '#1DA1F2' },
    { name: 'Reddit',      key: 'reddit',     icon: '🟠', color: '#FF4500' },
    { name: 'Telegram',    key: 'telegram',   icon: '✈️', color: '#29B6F6' },
    { name: 'Portais',     key: 'news_sites', icon: '📰', color: '#a78bfa' },
  ];

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Sentimento por Fonte</div>
      {items.map(item => {
        const data = src[item.key];
        if (!data) return null;
        return (
          <div key={item.key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.icon} {item.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#334155' }}>{data.posts_24h.toLocaleString()} posts</span>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: data.bullish_pct >= 50 ? '#10b981' : '#ef4444' }}>{data.bullish_pct.toFixed(1)}% 🐂</span>
              </div>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${data.score}%`, background: item.color, opacity: 0.8 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155', marginTop: 2 }}>
              <span>Score: {data.score}/100</span>
              <span>Peso: {(data.weight * 100).toFixed(0)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CORRELATION CHART ─────────────────────────────────────────────────────────
function CorrelationChart() {
  const data = sentimentHistory7d.map(d => ({
    day: d.day,
    sentiment: d.score,
    btc: parseFloat(((d.btc_price - 82000) / 1000).toFixed(1)), // normalized
    volume: parseFloat((d.volume_b).toFixed(1)),
  }));

  return (
    <div>
      <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sentimento Social vs Preço BTC vs Volume (7D)</div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
          <Bar dataKey="volume" fill="#1e3048" fillOpacity={0.8} name="Vol ($B)" radius={[2, 2, 0, 0]} />
          <Line dataKey="sentiment" stroke="#f59e0b" strokeWidth={2} dot={false} name="Sentimento" />
          <Line dataKey="btc" stroke="#60a5fa" strokeWidth={2} dot={false} name="BTC (norm)" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Correlation metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
        <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0d1421', border: '1px solid #1a2535', textAlign: 'center' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>Corr. Sent→Preço 24h</div>
          <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>+{socialCorrelation.sentiment_vs_price_24h.toFixed(2)}</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0d1421', border: '1px solid #1a2535', textAlign: 'center' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>Corr. Sent→Volume</div>
          <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>+{socialCorrelation.sentiment_vs_volume_24h.toFixed(2)}</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 7, background: '#0d1421', border: '1px solid #1a2535', textAlign: 'center' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 3 }}>Lag Ótimo</div>
          <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#a78bfa' }}>{socialCorrelation.lag_hours_optimal}h</div>
        </div>
      </div>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = ['Visão Geral', 'Nuvem de Palavras', 'Trending & KOLs', 'Correlações'];

export default function SentimentSocial() {
  const [tab, setTab] = useState('Visão Geral');
  const s = socialSentiment;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>🌐 Sentimento Social</h1>
            <ModeBadge mode="mock" />
            <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>🤖 AI Score</span>
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Twitter/X · Reddit · Telegram · Portais Cripto · Correlação BTC · Word Cloud</p>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Score Social', value: s.score, color: s.color, sub: s.label_pt },
          { label: 'Posts X (24h)', value: `${(s.sources.twitter_x.posts_24h / 1000).toFixed(0)}K`, color: '#1DA1F2', sub: 'Twitter/X' },
          { label: 'Posts Reddit', value: `${(s.sources.reddit.posts_24h / 1000).toFixed(0)}K`, color: '#FF4500', sub: 'r/Bitcoin + r/crypto' },
          { label: '🐂 Bullish X', value: `${s.sources.twitter_x.bullish_pct.toFixed(1)}%`, color: '#10b981', sub: 'posts positivos' },
          { label: 'Lag Ótimo', value: `${socialCorrelation.lag_hours_optimal}h`, color: '#a78bfa', sub: 'sent→preço' },
        ].map((st, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 9, padding: '11px 13px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{st.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: st.color, lineHeight: 1 }}>{st.value}</div>
            <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: tab === t ? 800 : 500,
            background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent',
            color: tab === t ? '#60a5fa' : '#475569',
          }}>{t}</button>
        ))}
      </div>

      {/* TAB: Visão Geral */}
      {tab === 'Visão Geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SocialGauge score={s.score} />
            <SourceBreakdown />
          </div>
          <div>
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Sentimento 7D — Score Diário</div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={sentimentHistory7d} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs><linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
                  <ReferenceLine y={50} stroke="#334155" strokeDasharray="3 3" />
                  <Area dataKey="score" stroke="#f59e0b" fill="url(#sentGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px 18px' }}>
              <CorrelationChart />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Nuvem de Palavras */}
      {tab === 'Nuvem de Palavras' && (
        <div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>☁️ Word Cloud — Temas Mais Discutidos (24h)</div>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 14 }}>Tamanho = volume de menções · Cor = sentimento (verde=bullish, vermelho=bearish) · Hover para detalhes</div>
            <WordCloud words={wordCloudData} />
          </div>

          {/* Top words table */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Top 15 — Temas por Menções</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {wordCloudData.slice(0, 15).map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7 }}>
                  <span style={{ fontSize: 11, color: '#334155', fontFamily: 'JetBrains Mono, monospace', width: 20, textAlign: 'right' }}>#{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: w.color, flex: 1 }}>{w.text}</span>
                  <div style={{ flex: 2, height: 4, borderRadius: 2, background: '#1a2535' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${(w.value / wordCloudData[0].value) * 100}%`, background: w.color, opacity: 0.7 }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono, monospace', width: 60, textAlign: 'right' }}>{w.value.toLocaleString()}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: col(w.sentiment), width: 44, textAlign: 'right' }}>{sign(w.sentiment)}{w.sentiment.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Trending & KOLs */}
      {tab === 'Trending & KOLs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>🔥 Trending Topics (24h)</div>
            {trendingTopics.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#334155', width: 20, textAlign: 'right' }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{t.topic}</div>
                  <div style={{ fontSize: 9, color: '#475569' }}>{t.platform} · {t.mentions_24h.toLocaleString()} menções</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: t.change_pct >= 0 ? '#10b981' : '#ef4444' }}>
                  {t.change_pct >= 0 ? '+' : ''}{t.change_pct.toFixed(1)}%
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: col(t.sentiment) }}>
                  {sign(t.sentiment)}{t.sentiment.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>👑 KOLs — Key Opinion Leaders</div>
            {kolSentiment.map((kol, i) => {
              const sentColor = kol.sentiment > 0.5 ? '#10b981' : kol.sentiment > 0 ? '#f59e0b' : '#ef4444';
              return (
                <div key={i} style={{ padding: '11px 13px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{kol.name}</div>
                      <div style={{ fontSize: 9, color: '#334155' }}>{kol.handle} · {kol.followers_m}M followers</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: sentColor }}>{sign(kol.sentiment)}{kol.sentiment.toFixed(2)}</div>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: '#1a2535', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.abs(kol.sentiment) * 100}%`, marginLeft: kol.sentiment < 0 ? `${50 + kol.sentiment * 50}%` : '50%', background: sentColor }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{kol.stance}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: Correlações */}
      {tab === 'Correlações' && (
        <div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📊 Menções por Hora vs Volume BTC (24h)</div>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 12 }}>Correlação entre picos de menções sociais e volume de negociação</div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={mentionsHourly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: '#475569' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 8, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 9, borderRadius: 6 }} />
                <Bar dataKey="mentions" fill="#1e3048" fillOpacity={0.9} name="Menções" radius={[2, 2, 0, 0]} />
                <Line dataKey="btc_volume_m" stroke="#f59e0b" strokeWidth={2} dot={false} name="Vol BTC ($M)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }}>
            🤖 <strong style={{ color: '#60a5fa' }}>Insight AI:</strong> {socialCorrelation.note}
          </div>
        </div>
      )}
    </div>
  );
}