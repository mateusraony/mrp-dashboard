// ─── NEWS INTELLIGENCE PAGE ───────────────────────────────────────────────────
// Notícias institucionais com AI Sentiment Score + correlação BTC + Bull-Bear Index
import { useState, useMemo } from 'react';
import { institutionalNews, newsSentimentAggregate, impactCategoryConfig } from '../components/data/mockDataNews';
import { optionsTakerFlow } from '../components/data/mockDataExtended';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { IS_LIVE } from '@/lib/env';
import { useGdeltNews } from '@/hooks/useGdelt';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

const SOURCES = ['Todos', 'Bloomberg', 'Reuters', 'CoinDesk', 'The Block', 'WSJ', 'FT', 'Cointelegraph'];
const CATEGORIES = ['Todos', ...Object.keys(impactCategoryConfig)];

function SentimentGauge({ score }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score > 0.2 ? '#10b981' : score < -0.2 ? '#ef4444' : '#f59e0b';
  const label = score > 0.5 ? 'Strongly Bullish' : score > 0.2 ? 'Bullish' : score < -0.5 ? 'Strongly Bearish' : score < -0.2 ? 'Bearish' : 'Neutral';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 80, height: 6, borderRadius: 3, overflow: 'hidden',
        background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)' }}>
        <div style={{
          position: 'absolute', top: -3, left: `${pct}%`,
          transform: 'translateX(-50%)',
          width: 5, height: 12, borderRadius: 2, background: '#fff',
          boxShadow: '0 0 4px rgba(255,255,255,0.8)',
        }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
        {score > 0 ? '+' : ''}{score.toFixed(2)}
      </span>
      <span style={{ fontSize: 10, color }}>{label}</span>
    </div>
  );
}

function CorrelationBadge({ value }) {
  const color = value > 0.3 ? '#10b981' : value < -0.3 ? '#ef4444' : '#64748b';
  const label = value > 0.3 ? '↑ Positiva' : value < -0.3 ? '↓ Negativa' : '→ Neutra';
  return (
    <span style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 4,
      background: `${color}12`, border: `1px solid ${color}28`,
      color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
    }}>
      {label} ({value > 0 ? '+' : ''}{value.toFixed(2)})
    </span>
  );
}

function NewsCard({ news, isSelected, onClick }) {
  const cfg = impactCategoryConfig[news.impact_category] || { icon: '📰', color: '#64748b', label: 'News' };
  const priceMoved = news.price_delta_pct;
  const priceColor = priceMoved > 0 ? '#10b981' : priceMoved < 0 ? '#ef4444' : '#64748b';

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? 'rgba(59,130,246,0.06)' : 'rgba(13,20,33,0.6)',
        border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : '#1e2d45'}`,
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 10, padding: '14px 16px', marginBottom: 8,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {/* Source + time + tier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
          color: '#60a5fa', background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px',
        }}>{news.source}</span>
        {news.tier === 1 && (
          <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
            TIER 1
          </span>
        )}
        <span style={{ fontSize: 9, color: cfg.color, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>
          {formatDistanceToNow(news.published, { addSuffix: true })}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 10 }}>
        {news.title}
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SentimentGauge score={news.sentiment_score} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: '#334155' }}>Δ BTC:</span>
          <span style={{ fontSize: 10, color: priceColor, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            {priceMoved > 0 ? '+' : ''}{priceMoved.toFixed(2)}%
          </span>
        </div>
        <CorrelationBadge value={news.bull_bear_correlation} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: '#334155' }}>Rel:</span>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${news.relevance * 100}%`, background: '#3b82f6' }} />
          </div>
          <span style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{(news.relevance * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function NewsDetail({ news }) {
  if (!news) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#334155', fontSize: 12 }}>
      ← Selecione uma notícia para ver análise detalhada
    </div>
  );
  const cfg = impactCategoryConfig[news.impact_category] || { icon: '📰', color: '#64748b', label: 'News' };
  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '2px 8px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{news.source}</span>
          <span style={{ fontSize: 10, color: cfg.color, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>{cfg.icon} {cfg.label}</span>
          {news.tier === 1 && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>TIER 1</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.5 }}>{news.title}</div>
        <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>{formatDistanceToNow(news.published, { addSuffix: true })}</div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Sentiment Score */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            🤖 AI Sentiment Score
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: news.sentiment_color, lineHeight: 1 }}>
              {news.sentiment_score > 0 ? '+' : ''}{news.sentiment_score.toFixed(2)}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: news.sentiment_color }}>{news.sentiment_label}</div>
              <SentimentGauge score={news.sentiment_score} />
            </div>
          </div>
        </div>

        {/* Price impact */}
        <div style={{ background: '#0d1421', borderRadius: 9, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            📈 Impacto no Preço
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: '#334155', marginBottom: 2 }}>BTC na Publicação</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontWeight: 700 }}>${news.btc_price_at_publish.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#334155', marginBottom: 2 }}>BTC Atual</div>
              <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', fontWeight: 700 }}>${news.btc_price_now.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#334155', marginBottom: 2 }}>Δ Preço</div>
              <div style={{ fontSize: 16, fontFamily: 'JetBrains Mono, monospace', color: news.price_delta_pct >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                {news.price_delta_pct >= 0 ? '+' : ''}{news.price_delta_pct.toFixed(2)}%
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: '#64748b', lineHeight: 1.6, borderTop: '1px solid #1a2535', paddingTop: 8 }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sinal: </span>{news.correlation_signal}
          </div>
        </div>

        {/* Bull-Bear Correlation */}
        <div style={{ background: '#0d1421', borderRadius: 9, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            🎯 Correlação com Bull-Bear Index
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: news.bull_bear_correlation > 0 ? '#10b981' : '#ef4444' }}>
              {news.bull_bear_correlation > 0 ? '+' : ''}{news.bull_bear_correlation.toFixed(2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 3, background: '#1a2535', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  marginLeft: news.bull_bear_correlation < 0 ? `${50 + news.bull_bear_correlation * 50}%` : '50%',
                  width: `${Math.abs(news.bull_bear_correlation) * 50}%`,
                  background: news.bull_bear_correlation > 0 ? '#10b981' : '#ef4444',
                }} />
              </div>
              <div style={{ fontSize: 9, color: '#334155', textAlign: 'center' }}>
                Bull-Bear Index atual (Opções): <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                  {optionsTakerFlow.bull_bear_index > 0 ? '+' : ''}{optionsTakerFlow.bull_bear_index.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, marginBottom: 6 }}>🤖 Análise AI</div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>{news.ai_summary}</div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {news.tags.map(t => (
            <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#0d1421', color: '#475569', border: '1px solid #1a2535', fontFamily: 'JetBrains Mono, monospace' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GdeltNewsCard — card para artigos reais do GDELT ────────────────────────
function GdeltNewsCard({ article, rank }) {
  const sentColor =
    article.sentiment === 1  ? '#10b981' :
    article.sentiment === -1 ? '#ef4444' : '#f59e0b';
  const sentIcon =
    article.sentiment === 1  ? '▲' :
    article.sentiment === -1 ? '▼' : '◆';

  let timeAgo = '';
  try {
    timeAgo = formatDistanceToNow(new Date(article.published_at), { addSuffix: true });
  } catch {
    timeAgo = '';
  }

  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d45',
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      {/* Rank badge */}
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: rank <= 2 ? 'rgba(59,130,246,0.15)' : '#0D1421',
        border: `1px solid ${rank <= 2 ? 'rgba(59,130,246,0.3)' : '#1e2d45'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        color: rank <= 2 ? '#60a5fa' : '#4a5568',
        fontFamily: 'JetBrains Mono, monospace',
      }}>{rank}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Thumbnail (se disponível) */}
        {article.socialimage && (
          <div style={{ marginBottom: 8, borderRadius: 6, overflow: 'hidden', maxHeight: 80 }}>
            <img
              src={article.socialimage}
              alt=""
              style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Título com link */}
        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 6 }}>
            {article.title}
          </div>
        </a>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Domínio */}
          <span style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: '#60a5fa', background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 6px',
          }}>{article.domain}</span>

          {/* Badge de sentimento */}
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
            background: `${sentColor}14`, border: `1px solid ${sentColor}30`,
            color: sentColor, fontFamily: 'JetBrains Mono, monospace',
          }}>
            {sentIcon} {article.sentiment_label}
          </span>

          {/* Tempo */}
          {timeAgo && (
            <span style={{ fontSize: 10, color: '#4a5568', marginLeft: 'auto' }}>{timeAgo}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewsIntelligence() {
  const [mainTab, setMainTab] = useState('intelligence');
  const [selectedNews, setSelectedNews] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('Todos');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [sentimentFilter, setSentimentFilter] = useState('Todos');
  const agg = newsSentimentAggregate;

  // ─── GDELT real news feed ──────────────────────────────────────────────────
  const {
    data: gdeltArticles = [],
    isLoading: gdeltLoading,
    isError: gdeltError,
    error: gdeltRawError,
    refetch: gdeltRefetch,
    dataUpdatedAt: gdeltUpdatedAt,
  } = useGdeltNews('bitcoin crypto');

  // Derivados para o resumo de sentimento do Feed Geral
  const gdeltBullishCount  = gdeltArticles.filter(a => a.sentiment === 1).length;
  const gdeltNeutralCount  = gdeltArticles.filter(a => a.sentiment === 0).length;
  const gdeltBearishCount  = gdeltArticles.filter(a => a.sentiment === -1).length;

  const filtered = useMemo(() => {
    return institutionalNews.filter(n => {
      if (sourceFilter !== 'Todos' && n.source !== sourceFilter) return false;
      if (categoryFilter !== 'Todos' && n.impact_category !== categoryFilter) return false;
      if (sentimentFilter === 'Bullish' && n.sentiment_score <= 0.1) return false;
      if (sentimentFilter === 'Bearish' && n.sentiment_score >= -0.1) return false;
      if (sentimentFilter === 'Neutral' && Math.abs(n.sentiment_score) > 0.1) return false;
      return true;
    });
  }, [sourceFilter, categoryFilter, sentimentFilter]);

  const avgSentiment24h = agg.avg_score_24h;
  const sentColor = avgSentiment24h > 0.1 ? '#10b981' : avgSentiment24h < -0.1 ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Tab switcher principal */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {[{ id: 'intelligence', label: '🧠 Inteligência AI' }, { id: 'feed', label: '📰 Feed Geral' }].map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: mainTab === t.id ? 800 : 500, background: mainTab === t.id ? 'rgba(59,130,246,0.18)' : 'transparent', color: mainTab === t.id ? '#60a5fa' : '#475569' }}>{t.label}</button>
        ))}
      </div>

      {/* ── Feed Geral — GDELT real news ─────────────────────────────────── */}
      {mainTab === 'feed' && (
        <div style={{ maxWidth: 1000 }}>

          {/* Header info + status */}
          <div style={{
            marginBottom: 16, padding: '12px 16px',
            background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.6 }}>
                <strong style={{ color: '#60a5fa' }}>Fonte:</strong>{' '}
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  GDELT DOC 2.0 · query=&quot;bitcoin crypto&quot; · sort=DateDesc
                </span>
              </div>
            </div>
            {/* Modo badge */}
            <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
            {/* Contagem de artigos */}
            {!gdeltLoading && !gdeltError && (
              <span style={{
                fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                color: '#60a5fa', background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '2px 8px',
              }}>
                {gdeltArticles.length} artigos
              </span>
            )}
            {/* Timestamp do último fetch */}
            {gdeltUpdatedAt > 0 && (
              <span style={{ fontSize: 10, color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>
                atualizado {formatDistanceToNow(new Date(gdeltUpdatedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Estado: loading */}
          {gdeltLoading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '48px 0', gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid #1e2d45', borderTopColor: '#3b82f6',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 13, color: '#475569' }}>Carregando notícias...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Estado: erro */}
          {gdeltError && !gdeltLoading && (
            <div style={{
              padding: '32px 24px', background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                Falha ao carregar notícias GDELT
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                {gdeltRawError?.message ?? 'Erro desconhecido'}
              </div>
              <button
                onClick={() => gdeltRefetch()}
                style={{
                  marginTop: 4, padding: '6px 18px', borderRadius: 6, cursor: 'pointer',
                  background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.3)', fontSize: 11, fontWeight: 600,
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado: modo mock (sem dados) */}
          {!gdeltLoading && !gdeltError && gdeltArticles.length === 0 && (
            <div style={{
              padding: '48px 24px', background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
            }}>
              <div style={{ fontSize: 20 }}>🛰️</div>
              <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 700 }}>Modo MOCK ativo</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, maxWidth: 380 }}>
                Ative o modo <strong style={{ color: '#e2e8f0' }}>LIVE</strong> em Configurações para ver notícias reais via GDELT.
              </div>
            </div>
          )}

          {/* Lista de artigos */}
          {!gdeltLoading && !gdeltError && gdeltArticles.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Coluna esquerda: primeiros 12 artigos */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>
                    Recentes — Parte 1
                  </div>
                  {gdeltArticles.slice(0, 12).map((a, i) => (
                    <GdeltNewsCard key={a.url} article={a} rank={i + 1} />
                  ))}
                </div>
                {/* Coluna direita: artigos 13–25 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>
                    Recentes — Parte 2
                  </div>
                  {gdeltArticles.slice(12).map((a, i) => (
                    <GdeltNewsCard key={a.url} article={a} rank={i + 13} />
                  ))}
                </div>
              </div>

              {/* Resumo de sentimento */}
              <div style={{
                marginTop: 20, background: '#111827',
                border: '1px solid #1e2d45', borderRadius: 12, padding: 20,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
                  Resumo de Sentimento — GDELT
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { label: 'Positivo', count: gdeltBullishCount, color: '#10b981' },
                    { label: 'Neutro',   count: gdeltNeutralCount, color: '#f59e0b' },
                    { label: 'Negativo', count: gdeltBearishCount, color: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: 13, color: '#8899a6' }}>{s.label}:</span>
                      <span style={{
                        fontSize: 16, fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace', color: s.color,
                      }}>{s.count}</span>
                    </div>
                  ))}
                  <div style={{ flex: 1, textAlign: 'right', fontSize: 11, color: '#4a5568' }}>
                    {gdeltArticles.length} artigos · via GDELT DOC 2.0
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Inteligência AI (conteúdo original) */}
      {mainTab === 'intelligence' && (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
            News Intelligence
          </h1>
          <ModeBadge mode="mock" />
          <GradeBadge grade={agg.quality} />
          <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
            🤖 AI Sentiment
          </span>
        </div>
        <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
          Notícias institucionais filtradas por relevância · Bloomberg, Reuters, CoinDesk, The Block, WSJ, FT, Cointelegraph · Sentiment Score via NLP
        </p>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16,
      }}>
        {[
          { label: 'Sentiment 24h', value: `${avgSentiment24h > 0 ? '+' : ''}${avgSentiment24h.toFixed(2)}`, color: sentColor, sub: avgSentiment24h > 0 ? 'Net Bullish' : 'Net Bearish' },
          { label: 'Bullish Today', value: agg.bullish_count, color: '#10b981', sub: 'notícias' },
          { label: 'Bearish Today', value: agg.bearish_count, color: '#ef4444', sub: 'notícias' },
          { label: 'Neutral Today', value: agg.neutral_count, color: '#f59e0b', sub: 'notícias' },
          { label: 'Bull-Bear Index', value: `${optionsTakerFlow.bull_bear_index > 0 ? '+' : ''}${optionsTakerFlow.bull_bear_index.toFixed(3)}`, color: '#a78bfa', sub: 'Opções Taker Flow' },
          { label: 'Corr. Média', value: `${agg.avg_price_correlation > 0 ? '+' : ''}${agg.avg_price_correlation.toFixed(2)}`, color: '#60a5fa', sub: 'News → Preço' },
        ].map((item, i) => (
          <div key={i} style={{ background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: item.color, letterSpacing: '-0.02em' }}>{item.value}</div>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Sentiment history chart */}
      <div style={{ background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)', border: '1px solid #1e2d45', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>Sentiment Agregado — Últimos 7 dias</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={agg.history_7d} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} domain={[-1, 1]} tickFormatter={v => v.toFixed(1)} />
            <Tooltip
              contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }}
              formatter={(v) => [Number(v).toFixed(2), 'Score']}
            />
            <ReferenceLine y={0} stroke="#2a3f5f" />
            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
              {agg.history_7d.map((entry, i) => (
                <Cell key={i} fill={entry.score > 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#334155', fontWeight: 600 }}>Filtros:</span>
        {/* Source */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SOURCES.slice(0, 5).map(s => (
            <button key={s} onClick={() => setSourceFilter(s)} style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
              background: sourceFilter === s ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: sourceFilter === s ? '#60a5fa' : '#475569',
              border: `1px solid ${sourceFilter === s ? 'rgba(59,130,246,0.4)' : '#1e2d45'}`,
              fontWeight: sourceFilter === s ? 700 : 400,
            }}>{s}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 16, background: '#1e2d45' }} />
        {['Todos', 'Bullish', 'Neutral', 'Bearish'].map(s => (
          <button key={s} onClick={() => setSentimentFilter(s)} style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
            background: sentimentFilter === s ? (s === 'Bullish' ? 'rgba(16,185,129,0.2)' : s === 'Bearish' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)') : 'transparent',
            color: sentimentFilter === s ? (s === 'Bullish' ? '#10b981' : s === 'Bearish' ? '#ef4444' : '#60a5fa') : '#475569',
            border: `1px solid ${sentimentFilter === s ? '#2a3f5f' : '#1e2d45'}`,
            fontWeight: sentimentFilter === s ? 700 : 400,
          }}>{s}</button>
        ))}
      </div>

      {/* Main grid: list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, alignItems: 'start' }}>
        {/* News list */}
        <div>
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 10 }}>
            {filtered.length} notícia{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </div>
          {filtered.map(n => (
            <NewsCard
              key={n.id}
              news={n}
              isSelected={selectedNews?.id === n.id}
              onClick={() => setSelectedNews(selectedNews?.id === n.id ? null : n)}
            />
          ))}
        </div>

        {/* Detail panel */}
        <div style={{
          background: 'linear-gradient(135deg, #131e2e 0%, #111827 100%)',
          border: '1px solid #1e2d45', borderRadius: 14,
          position: 'sticky', top: 20, maxHeight: '85vh', overflowY: 'auto',
        }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2d45' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>📋 Análise Detalhada</div>
          </div>
          <NewsDetail news={selectedNews} />
        </div>
      </div>
    </div>
      )}
    </div>
  );
}