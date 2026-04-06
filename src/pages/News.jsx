import { topNews } from '../components/data/mockData';
import SectionHeader from '../components/ui/SectionHeader';
import { ModeBadge } from '../components/ui/DataBadge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const sentimentColor = (v) => v > 0.1 ? '#10b981' : v < -0.1 ? '#ef4444' : '#f59e0b';
const sentimentLabel = (v) => v > 0.1 ? '▲ Bullish' : v < -0.1 ? '▼ Bearish' : '◆ Neutral';

function NewsCard({ news, rank }) {
  const sc = sentimentColor(news.sentiment);
  const sl = sentimentLabel(news.sentiment);
  const relPct = Math.round(news.relevance * 100);

  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d45',
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      display: 'flex', gap: 14, alignItems: 'flex-start',
      transition: 'border-color 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = '#2a3f5f'}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d45'}
    >
      {/* Rank */}
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: rank <= 2 ? 'rgba(59,130,246,0.15)' : '#0D1421',
        border: `1px solid ${rank <= 2 ? 'rgba(59,130,246,0.3)' : '#1e2d45'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0,
        color: rank <= 2 ? '#60a5fa' : '#4a5568',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {rank}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={news.url} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#e2e8f0',
            lineHeight: 1.5, marginBottom: 6,
          }}>
            {news.title}
          </div>
        </a>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Source */}
          <span style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: '#60a5fa', background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 4, padding: '1px 6px',
          }}>{news.source}</span>

          {/* Time */}
          <span style={{ fontSize: 10, color: '#4a5568' }}>
            {formatDistanceToNow(news.published, { addSuffix: true })}
          </span>

          {/* Sentiment */}
          <span style={{
            fontSize: 10, color: sc, fontWeight: 600,
          }}>{sl}</span>

          {/* Relevance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ height: 4, width: 40, borderRadius: 2, background: '#1e2d45', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${relPct}%`,
                background: '#3b82f6', borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 10, color: '#4a5568' }}>{relPct}% rel</span>
          </div>
        </div>
        {/* Tags */}
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {news.tags.map(t => (
            <span key={t} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: '#0D1421', color: '#4a5568',
              border: '1px solid #1e2d45',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function News() {
  const todayNews = topNews;
  const weekNews = [...topNews].sort(() => Math.random() - 0.5);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Market News
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', marginTop: 3 }}>
          GDELT DOC 2.0 · Hybrid relevance ranking · <ModeBadge />
        </p>
      </div>

      {/* Info box */}
      <div style={{
        marginBottom: 20, padding: '12px 16px',
        background: 'rgba(59,130,246,0.05)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: 10,
        fontSize: 12, color: '#4a5568', lineHeight: 1.6,
      }}>
        <strong style={{ color: '#60a5fa' }}>Query:</strong>{' '}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
          (Bitcoin OR crypto OR "Federal Reserve" OR CPI OR inflation OR payroll OR "Treasury yields" OR FOMC)
        </span>{' '}
        mode=artlist · maxrecords=250 · sort=hybridrel
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Today */}
        <div>
          <SectionHeader title="Top 5 — Today" subtitle="Last 24h · Hybrid relevance" icon="◉" />
          {todayNews.map((n, i) => <NewsCard key={n.title} news={n} rank={i + 1} />)}
        </div>

        {/* Week */}
        <div>
          <SectionHeader title="Top 5 — This Week" subtitle="Last 7d · Hybrid relevance" icon="◉" />
          {weekNews.map((n, i) => <NewsCard key={n.title + '_w'} news={n} rank={i + 1} />)}
        </div>
      </div>

      {/* Sentiment summary */}
      <div style={{
        marginTop: 20, background: '#111827', border: '1px solid #1e2d45',
        borderRadius: 12, padding: 20,
      }}>
        <SectionHeader title="News Sentiment Summary" subtitle="Computed from relevance-weighted articles" />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Bullish', count: topNews.filter(n => n.sentiment > 0.1).length, color: '#10b981' },
            { label: 'Neutral', count: topNews.filter(n => Math.abs(n.sentiment) <= 0.1).length, color: '#f59e0b' },
            { label: 'Bearish', count: topNews.filter(n => n.sentiment < -0.1).length, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: s.color,
              }} />
              <span style={{ fontSize: 13, color: '#8899a6' }}>{s.label}:</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>
                {s.count}
              </span>
            </div>
          ))}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: '#4a5568' }}>
              Avg sentiment: {(topNews.reduce((s, n) => s + n.sentiment, 0) / topNews.length).toFixed(3)}
              {' · '}Avg relevance: {(topNews.reduce((s, n) => s + n.relevance, 0) / topNews.length * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}