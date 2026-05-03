// ─── NEWS INTELLIGENCE PAGE ───────────────────────────────────────────────────
// Notícias institucionais (GDELT live) + Feed Geral com AI Sentiment Score
import { useState, useMemo } from 'react';
import { optionsTakerFlow } from '../components/data/mockDataExtended';
import { ModeBadge } from '../components/ui/DataBadge';
import { RefreshButton } from '../components/ui/RefreshButton';
import { IS_LIVE } from '@/lib/env';
import { useGdeltNews, useGdeltHistory } from '@/hooks/useGdelt';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// Categorias detectadas por keywords no título
const CATEGORY_CONFIG = {
  institutional: { icon: '🏦', label: 'Institucional', color: '#a78bfa' },
  regulation:    { icon: '⚖️',  label: 'Regulação',     color: '#f59e0b' },
  adoption:      { icon: '🚀',  label: 'Adoção',        color: '#10b981' },
  risk:          { icon: '⚠️',  label: 'Risco',         color: '#ef4444' },
  market:        { icon: '📊',  label: 'Mercado',       color: '#3b82f6' },
};

function detectCategory(title) {
  const t = title.toLowerCase();
  if (/etf|fund|blackrock|fidelity|grayscale|institutional|asset manager/.test(t)) return 'institutional';
  if (/sec|regulation|regulatory|law|congress|ban|compliance|legal/.test(t)) return 'regulation';
  if (/adoption|integration|payment|merchant|corporation|treasury/.test(t)) return 'adoption';
  if (/hack|breach|exploit|scam|fraud|stolen|attack/.test(t)) return 'risk';
  return 'market';
}

function computeScore(title) {
  const POSITIVE = ['rally','surge','bullish','adoption','ath','gain','rise','record','breakthrough','approval','growth','soar','jump','high'];
  const NEGATIVE = ['crash','drop','bearish','ban','hack','loss','fall','fear','plunge','sell-off','lawsuit','collapse','decline','slump'];
  const lower = title.toLowerCase();
  const pos = POSITIVE.filter(k => lower.includes(k)).length;
  const neg = NEGATIVE.filter(k => lower.includes(k)).length;
  const total = pos + neg;
  if (total === 0) return 0;
  return parseFloat(((pos - neg) / total).toFixed(2));
}

function getTriggeredKeywords(title) {
  const POSITIVE = ['rally','surge','bullish','adoption','ath','gain','rise','record','breakthrough','approval','growth','soar','jump','high'];
  const NEGATIVE = ['crash','drop','bearish','ban','hack','loss','fall','fear','plunge','sell-off','lawsuit','collapse','decline','slump'];
  const lower = title.toLowerCase();
  return {
    positive: POSITIVE.filter(k => lower.includes(k)),
    negative: NEGATIVE.filter(k => lower.includes(k)),
  };
}

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

function MarketNarrative({ articles }) {
  const stats = useMemo(() => {
    if (!articles.length) return null;
    const bullish = articles.filter(a => a.sentiment === 1).length;
    const bearish = articles.filter(a => a.sentiment === -1).length;
    const net = bullish - bearish;
    const ratio = net / articles.length;
    const catCounts = {};
    articles.forEach(a => {
      const c = detectCategory(a.title);
      catCounts[c] = (catCounts[c] || 0) + 1;
    });
    const dominant = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a])[0] || 'market';
    return { bullish, bearish, net, ratio, catCounts, dominant };
  }, [articles]);

  if (!stats) return null;
  const { bullish, bearish, net, ratio, catCounts, dominant } = stats;
  const signal = ratio > 0.25 ? 'BULLISH' : ratio < -0.25 ? 'BEARISH' : 'NEUTRO';
  const sc = ratio > 0.25 ? '#10b981' : ratio < -0.25 ? '#ef4444' : '#f59e0b';
  const narrativeMap = {
    institutional: `Participação institucional ${net >= 0 ? 'crescente' : 'recuando'} — ${catCounts.institutional || 0} artigos sobre ETF/gestoras.`,
    regulation:    `Foco regulatório ${net >= 0 ? 'favorável' : 'desfavorável'} — ${catCounts.regulation || 0} artigos sobre legislação.`,
    adoption:      `Adoção em destaque — ${catCounts.adoption || 0} artigos sobre integração e pagamentos.`,
    risk:          `Alertas de risco: ${catCounts.risk || 0} eventos de segurança ou fraude reportados.`,
    market:        `Dinâmica de mercado ${net > 0 ? 'positiva' : net < 0 ? 'negativa' : 'lateral'} — ${catCounts.market || 0} artigos de análise.`,
  };

  return (
    <div style={{ background: `linear-gradient(135deg,${sc}08,#111827)`, border: `1px solid ${sc}25`, borderLeft: `3px solid ${sc}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>🤖 Narrativa de Mercado AI</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: sc, fontFamily: 'JetBrains Mono, monospace' }}>{signal}</span>
        <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>{articles.length} artigos GDELT</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: '#1a2535', marginBottom: 10, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: `${Math.abs(ratio) * 50}%`, marginLeft: ratio < 0 ? `-${Math.abs(ratio) * 50}%` : 0, background: sc, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, marginBottom: 10 }}>
        {narrativeMap[dominant]}{' '}
        {bullish > 0 && <span style={{ color: '#10b981' }}>{bullish} positivos</span>}
        {bullish > 0 && bearish > 0 && ' · '}
        {bearish > 0 && <span style={{ color: '#ef4444' }}>{bearish} negativos</span>}
        {' '}no batch atual.
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
          const cfg = CATEGORY_CONFIG[cat];
          if (!cfg) return null;
          return (
            <span key={cat} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${cfg.color}14`, border: `1px solid ${cfg.color}28`, color: cfg.color, fontWeight: 600 }}>
              {cfg.icon} {cfg.label}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── GdeltAICard — expandível com sinal de mercado e keywords ────────────────
function GdeltAICard({ article }) {
  const [expanded, setExpanded] = useState(false);
  const score = computeScore(article.title);
  const cat   = detectCategory(article.title);
  const cfg   = CATEGORY_CONFIG[cat];
  const { positive: posKw, negative: negKw } = getTriggeredKeywords(article.title);
  let timeAgo = '';
  try { timeAgo = formatDistanceToNow(new Date(article.published_at), { addSuffix: true, locale: ptBR }); } catch { /* */ }

  const signalMap = {
    institutional: score > 0 ? 'Fluxo institucional positivo — suporte potencial ao BTC' : score < 0 ? 'Cautela institucional — risco de saída de capital' : 'Posicionamento institucional neutro',
    regulation:    score > 0 ? 'Desenvolvimento regulatório favorável ao setor cripto' : score < 0 ? 'Risco regulatório elevado — monitorar de perto' : 'Cenário regulatório ambíguo — aguardar clareza',
    adoption:      score > 0 ? 'Expansão de adoção — sinal bullish de longo prazo' : 'Obstáculo de adoção identificado — impacto moderado',
    risk:          'Evento de risco ativo — hedge e gestão de posição recomendados',
    market:        score > 0 ? 'Momentum de mercado positivo — viés comprador' : score < 0 ? 'Pressão vendedora detectada — atenção ao suporte' : 'Mercado sem direção clara — aguardar confirmação',
  };
  const impact      = (cat === 'institutional' || cat === 'regulation' || cat === 'risk') ? 'Alto' : 'Médio';
  const impactColor = impact === 'Alto' ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ background: '#111827', border: `1px solid ${expanded ? cfg.color + '50' : '#1e2d45'}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 10, padding: '13px 15px', marginBottom: 8, transition: 'border-color 0.2s' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30`, fontWeight: 700 }}>{cfg.icon} {cfg.label}</span>
        <span style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 4, padding: '1px 6px', fontFamily: 'JetBrains Mono, monospace' }}>{article.domain}</span>
        {timeAgo && <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>{timeAgo}</span>}
        <button onClick={() => setExpanded(v => !v)} title={expanded ? 'Fechar análise' : 'Ver análise detalhada'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 11, padding: '0 2px', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 9 }}>{article.title}</div>
      </a>
      <SentimentGauge score={score} />
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid #1a2535', paddingTop: 12 }}>
          <div style={{ background: `${cfg.color}0c`, border: `1px solid ${cfg.color}22`, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>🎯 Sinal de Mercado</div>
            <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{signalMap[cat]}</div>
          </div>
          {(posKw.length > 0 || negKw.length > 0) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>🔑 Keywords detectadas</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {posKw.map(k => <span key={k} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>+{k}</span>)}
                {negKw.map(k => <span key={k} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>-{k}</span>)}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${impactColor}12`, color: impactColor, border: `1px solid ${impactColor}25`, fontWeight: 700 }}>Impacto {impact}</span>
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#60a5fa', textDecoration: 'none', marginLeft: 'auto' }}>Ver artigo completo ↗</a>
          </div>
        </div>
      )}
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

  // ─── Feed Geral: query geral ───────────────────────────────────────────────
  const {
    data: gdeltArticles = [],
    isLoading: gdeltLoading,
    isFetching: gdeltFetching,
    isError: gdeltError,
    error: gdeltRawError,
    refetch: gdeltRefetch,
    dataUpdatedAt: gdeltUpdatedAt,
  } = useGdeltNews('bitcoin crypto');

  // ─── Inteligência AI: query institucional ──────────────────────────────────
  const {
    data: instArticles = [],
    isLoading: instLoading,
    isFetching: instFetching,
    isError: instError,
    refetch: instRefetch,
    dataUpdatedAt: instUpdatedAt,
  } = useGdeltNews('bitcoin ETF institutional SEC BlackRock Fidelity Grayscale adoption regulatory');

  const { data: gdeltHistory = [] } = useGdeltHistory(7);

  // Derivados Feed Geral
  const gdeltBullishCount = gdeltArticles.filter(a => a.sentiment === 1).length;
  const gdeltNeutralCount = gdeltArticles.filter(a => a.sentiment === 0).length;
  const gdeltBearishCount = gdeltArticles.filter(a => a.sentiment === -1).length;

  // Derivados Inteligência AI (live)
  const instBullishCount = instArticles.filter(a => a.sentiment === 1).length;
  const instNeutralCount = instArticles.filter(a => a.sentiment === 0).length;
  const instBearishCount = instArticles.filter(a => a.sentiment === -1).length;
  const avgSentiment24h  = instArticles.length > 0
    ? parseFloat(((instBullishCount - instBearishCount) / instArticles.length).toFixed(2))
    : 0;
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
            <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
            {!gdeltLoading && !gdeltError && (
              <span style={{
                fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                color: '#60a5fa', background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '2px 8px',
              }}>
                {gdeltArticles.length} artigos
              </span>
            )}
            <RefreshButton
              onRefresh={() => { gdeltRefetch(); }}
              isLoading={gdeltFetching}
              lastUpdated={gdeltUpdatedAt}
              label="Atualizar Feed Geral"
            />
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

      {/* ── Inteligência AI — GDELT Institucional (LIVE) ─────────────────── */}
      {mainTab === 'intelligence' && (
        <div style={{ maxWidth: 1200 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
              Inteligência AI
            </h1>
            <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
            <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
              🤖 GDELT Institucional
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <RefreshButton
                onRefresh={() => { instRefetch(); }}
                isLoading={instFetching}
                lastUpdated={instUpdatedAt}
                label="Atualizar Inteligência AI"
              />
            </div>
          </div>

          {/* Summary bar — live */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Sentiment Net', value: `${avgSentiment24h >= 0 ? '+' : ''}${avgSentiment24h.toFixed(2)}`, color: sentColor, sub: avgSentiment24h > 0 ? 'Net Bullish' : avgSentiment24h < 0 ? 'Net Bearish' : 'Neutro' },
              { label: 'Bullish',       value: instBullishCount,  color: '#10b981', sub: 'artigos' },
              { label: 'Bearish',       value: instBearishCount,  color: '#ef4444', sub: 'artigos' },
              { label: 'Neutro',        value: instNeutralCount,  color: '#f59e0b', sub: 'artigos' },
              { label: 'Total',         value: instArticles.length, color: '#60a5fa', sub: 'GDELT inst.' },
              { label: 'Bull-Bear Idx', value: `${optionsTakerFlow.bull_bear_index >= 0 ? '+' : ''}${optionsTakerFlow.bull_bear_index.toFixed(3)}`, color: '#a78bfa', sub: 'Opções Flow' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'linear-gradient(135deg,#131e2e,#111827)', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Narrativa de mercado — agregada dos artigos institucionais */}
          {instArticles.length > 0 && <MarketNarrative articles={instArticles} />}

          {/* Distribuição de sentimento — gráfico live */}
          {instArticles.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg,#131e2e,#111827)', border: '1px solid #1e2d45', borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
                Distribuição de Sentimento — Batch Atual ({instArticles.length} artigos institucionais)
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart
                  data={[
                    { label: 'Bullish',  value: instBullishCount,  fill: '#10b981' },
                    { label: 'Neutro',   value: instNeutralCount,  fill: '#f59e0b' },
                    { label: 'Bearish',  value: instBearishCount,  fill: '#ef4444' },
                  ]}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 11 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[{ fill: '#10b981' }, { fill: '#f59e0b' }, { fill: '#ef4444' }].map((c, i) => (
                      <Cell key={i} fill={c.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {gdeltHistory.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                    Histórico de Sentimento — últimos {gdeltHistory.length}d (Supabase)
                  </div>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={gdeltHistory} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#475569' }} tickLine={false}
                        tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#0d1421', border: '1px solid #2a3f5f', borderRadius: 6, fontSize: 10 }}
                        formatter={(v, name) => [v, name === 'bullish' ? 'Bullish' : name === 'bearish' ? 'Bearish' : 'Neutro']}
                      />
                      <Bar dataKey="bullish" stackId="a" fill="#10b981" radius={[0,0,0,0]} />
                      <Bar dataKey="neutral" stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
                      <Bar dataKey="bearish" stackId="a" fill="#ef4444" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>
                    Acumulado de {gdeltHistory.reduce((s, d) => s + d.total, 0)} artigos nos últimos {gdeltHistory.length} dias · Supabase gdelt_articles
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 9, color: '#334155', marginTop: 6 }}>
                  💡 Histórico 7d acumulará após primeiros fetches live (gdelt_articles Supabase).
                </div>
              )}
            </div>
          )}

          {/* Estado: loading */}
          {instLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1e2d45', borderTopColor: '#a78bfa', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#475569' }}>Buscando notícias institucionais…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Estado: erro */}
          {instError && !instLoading && (
            <div style={{ padding: '24px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>Falha ao carregar GDELT institucional</div>
              <button onClick={() => instRefetch()} style={{ padding: '6px 18px', borderRadius: 6, cursor: 'pointer', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', fontSize: 11, fontWeight: 600 }}>
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado: mock */}
          {!instLoading && !instError && instArticles.length === 0 && (
            <div style={{ padding: '48px 24px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🛰️</div>
              <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 700 }}>Modo MOCK ativo</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Ative o modo <strong style={{ color: '#e2e8f0' }}>LIVE</strong> em Configurações para ver notícias institucionais reais.</div>
            </div>
          )}

          {/* Grid de artigos */}
          {!instLoading && !instError && instArticles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>Institucional — Parte 1</div>
                {instArticles.slice(0, Math.ceil(instArticles.length / 2)).map((a) => (
                  <GdeltAICard key={a.url} article={a} />
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>Institucional — Parte 2</div>
                {instArticles.slice(Math.ceil(instArticles.length / 2)).map((a) => (
                  <GdeltAICard key={a.url} article={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}