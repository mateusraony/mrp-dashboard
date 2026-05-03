// ─── NEWS INTELLIGENCE MOCK DATA ─────────────────────────────────────────────
// Notícias institucionais com Sentiment Score · Correlação com BTC price
// Fontes: Bloomberg, Reuters, CoinDesk, Cointelegraph, WSJ, FT, The Block

// Artigos removidos — feed real via GDELT (src/hooks/useGdelt.ts).
// Array vazio evita exibição de notícias fabricadas atribuídas a fontes reais.
export const institutionalNews = [];

// ─── SENTIMENT AGREGADO ───────────────────────────────────────────────────────
const _n = institutionalNews.length || 1;
export const newsSentimentAggregate = {
  avg_score_24h: institutionalNews.slice(0, 5).reduce((s, n) => s + n.sentiment_score, 0) / (Math.min(5, institutionalNews.length) || 1),
  avg_score_7d: institutionalNews.reduce((s, n) => s + n.sentiment_score, 0) / _n,
  bullish_count: institutionalNews.filter(n => n.sentiment_score > 0.1).length,
  neutral_count: institutionalNews.filter(n => Math.abs(n.sentiment_score) <= 0.1).length,
  bearish_count: institutionalNews.filter(n => n.sentiment_score < -0.1).length,
  // Correlação média notícia→preço
  avg_price_correlation: institutionalNews.reduce((s, n) => s + n.bull_bear_correlation, 0) / _n,
  // Histórico diário de sentiment
  history_7d: [
    { day: 'Seg', score: 0.42, bullish: 3, bearish: 1 },
    { day: 'Ter', score: 0.28, bullish: 2, bearish: 2 },
    { day: 'Qua', score: -0.14, bullish: 1, bearish: 3 },
    { day: 'Qui', score: 0.51, bullish: 4, bearish: 1 },
    { day: 'Sex', score: 0.38, bullish: 3, bearish: 1 },
    { day: 'Sáb', score: 0.22, bullish: 2, bearish: 1 },
    { day: 'Dom', score: 0.34, bullish: 3, bearish: 1 },
  ],
  // Por categoria de impacto
  by_category: [
    { category: 'ETF_FLOW',               count: 2, avg_sentiment: 0.27, label: 'ETF Flows' },
    { category: 'MACRO_POLICY',           count: 1, avg_sentiment: -0.71, label: 'Política Macro' },
    { category: 'CORPORATE_ACCUMULATION', count: 1, avg_sentiment: 0.76, label: 'Acumulação Corp.' },
    { category: 'OPTIONS_POSITIONING',    count: 1, avg_sentiment: -0.22, label: 'Posicionamento Opts' },
    { category: 'MACRO_DATA',             count: 1, avg_sentiment: 0.12, label: 'Dados Macro' },
    { category: 'INSTITUTIONAL_ADOPTION', count: 2, avg_sentiment: 0.67, label: 'Adoção Institucional' },
    { category: 'DERIVATIVES_RISK',       count: 1, avg_sentiment: -0.48, label: 'Risco Derivativos' },
    { category: 'INSTITUTIONAL_INFRA',    count: 1, avg_sentiment: 0.58, label: 'Infra Institucional' },
  ],
  quality: 'B',
};

// ─── IMPACT CATEGORY CONFIG ────────────────────────────────────────────────────
export const impactCategoryConfig = {
  ETF_FLOW:               { icon: '🏦', color: '#3b82f6',  label: 'ETF Flow' },
  MACRO_POLICY:           { icon: '🏛️', color: '#ef4444',  label: 'Macro Policy' },
  CORPORATE_ACCUMULATION: { icon: '🏢', color: '#10b981',  label: 'Corp. Acum.' },
  OPTIONS_POSITIONING:    { icon: '◬',  color: '#a78bfa',  label: 'Opts Position' },
  MACRO_DATA:             { icon: '📊', color: '#f59e0b',  label: 'Macro Data' },
  INSTITUTIONAL_ADOPTION: { icon: '🌐', color: '#06b6d4',  label: 'Inst. Adoption' },
  DERIVATIVES_RISK:       { icon: '⚡', color: '#f97316',  label: 'Deriv. Risk' },
  INSTITUTIONAL_INFRA:    { icon: '🔧', color: '#8b5cf6',  label: 'Inst. Infra' },
};