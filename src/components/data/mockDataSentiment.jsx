// ─── SOCIAL SENTIMENT & WORD CLOUD — Mock Data ────────────────────────────────

// ─── SOCIAL FEAR/GREED SCORE ──────────────────────────────────────────────────
export const socialSentiment = {
  score: 62,                   // 0-100
  classification: 'Greed',
  label_pt: 'Ganância',
  color: '#f59e0b',
  prev_24h: 58,
  prev_7d: 71,
  delta_24h: 4,
  delta_7d: -9,
  sources: {
    twitter_x:   { score: 64, weight: 0.40, posts_24h: 284_200, bullish_pct: 61.4 },
    reddit:      { score: 58, weight: 0.20, posts_24h: 42_800,  bullish_pct: 56.8 },
    telegram:    { score: 67, weight: 0.15, posts_24h: 18_400,  bullish_pct: 64.2 },
    news_sites:  { score: 59, weight: 0.25, posts_24h: 3_200,   bullish_pct: 57.1 },
  },
  updated_at: new Date(),
};

// ─── WORD CLOUD ───────────────────────────────────────────────────────────────
export const wordCloudData = [
  { text: 'Bitcoin',     value: 980, sentiment: 0.22,  color: '#f59e0b' },
  { text: 'ETF',         value: 742, sentiment: 0.48,  color: '#10b981' },
  { text: 'BTC',         value: 698, sentiment: 0.18,  color: '#f59e0b' },
  { text: 'Fed',         value: 621, sentiment: -0.31, color: '#ef4444' },
  { text: 'Bull',        value: 584, sentiment: 0.62,  color: '#10b981' },
  { text: 'Halving',     value: 548, sentiment: 0.71,  color: '#10b981' },
  { text: 'Inflation',   value: 492, sentiment: -0.44, color: '#ef4444' },
  { text: 'BlackRock',   value: 441, sentiment: 0.38,  color: '#3b82f6' },
  { text: 'Crypto',      value: 428, sentiment: 0.12,  color: '#60a5fa' },
  { text: 'FOMC',        value: 398, sentiment: -0.28, color: '#f59e0b' },
  { text: 'ATH',         value: 374, sentiment: 0.82,  color: '#10b981' },
  { text: 'Funding',     value: 348, sentiment: -0.18, color: '#f59e0b' },
  { text: 'DXY',         value: 312, sentiment: -0.42, color: '#ef4444' },
  { text: 'Altcoins',    value: 298, sentiment: 0.08,  color: '#a78bfa' },
  { text: 'Short',       value: 284, sentiment: -0.34, color: '#ef4444' },
  { text: 'USDT',        value: 271, sentiment: 0.14,  color: '#10b981' },
  { text: 'Liquidação',  value: 248, sentiment: -0.62, color: '#ef4444' },
  { text: 'Whale',       value: 232, sentiment: 0.08,  color: '#60a5fa' },
  { text: 'Staking',     value: 218, sentiment: 0.28,  color: '#10b981' },
  { text: 'Metaverse',   value: 184, sentiment: -0.02, color: '#8b5cf6' },
  { text: 'Layer2',      value: 172, sentiment: 0.34,  color: '#3b82f6' },
  { text: 'VIX',         value: 164, sentiment: -0.38, color: '#ef4444' },
  { text: 'Gold',        value: 158, sentiment: 0.21,  color: '#f59e0b' },
  { text: 'Recession',   value: 142, sentiment: -0.72, color: '#ef4444' },
  { text: 'IBIT',        value: 138, sentiment: 0.52,  color: '#3b82f6' },
  { text: 'Sell',        value: 124, sentiment: -0.44, color: '#ef4444' },
  { text: 'Buy',         value: 118, sentiment: 0.54,  color: '#10b981' },
  { text: 'HODL',        value: 112, sentiment: 0.68,  color: '#10b981' },
  { text: 'DeFi',        value: 108, sentiment: 0.18,  color: '#8b5cf6' },
  { text: 'NFT',         value: 92,  sentiment: -0.08, color: '#6b7280' },
];

// ─── SENTIMENT HISTÓRICO 7D ───────────────────────────────────────────────────
export const sentimentHistory7d = [
  { day: 'Dom', score: 71, volume_b: 24.2, btc_price: 82100 },
  { day: 'Seg', score: 68, volume_b: 28.4, btc_price: 83200 },
  { day: 'Ter', score: 74, volume_b: 31.8, btc_price: 84800 },
  { day: 'Qua', score: 70, volume_b: 29.1, btc_price: 84100 },
  { day: 'Qui', score: 65, volume_b: 26.4, btc_price: 83600 },
  { day: 'Sex', score: 58, volume_b: 22.8, btc_price: 82900 },
  { day: 'Sáb', score: 62, volume_b: 25.6, btc_price: 84300 },
];

// ─── CORRELAÇÃO SOCIAL → VOLUME/PREÇO ─────────────────────────────────────────
export const socialCorrelation = {
  sentiment_vs_price_24h: 0.74,
  sentiment_vs_volume_24h: 0.68,
  sentiment_vs_price_7d: 0.61,
  sentiment_vs_volume_7d: 0.55,
  lag_hours_optimal: 4,    // sentimento leva ~4h para refletir no preço
  note: 'Correlação social-preço de 0.74 com lag de ~4h. Picos de menções Bitcoin (+30% vs média) antecederam altas de preço em 68% dos casos nos últimos 30 dias.',
};

// ─── TOP TRENDING TOPICS ──────────────────────────────────────────────────────
export const trendingTopics = [
  { topic: '#Bitcoin', mentions_24h: 284_200, change_pct: 18.4,  sentiment: 0.31,  platform: 'X' },
  { topic: '#BTC',     mentions_24h: 198_400, change_pct: 12.1,  sentiment: 0.28,  platform: 'X' },
  { topic: '#FOMC',    mentions_24h: 142_800, change_pct: 84.2,  sentiment: -0.42, platform: 'X' },
  { topic: '#ETF',     mentions_24h: 98_400,  change_pct: 22.8,  sentiment: 0.54,  platform: 'X' },
  { topic: '#Crypto',  mentions_24h: 84_200,  change_pct: 8.4,   sentiment: 0.18,  platform: 'X' },
  { topic: 'r/Bitcoin',mentions_24h: 42_800,  change_pct: 14.2,  sentiment: 0.41,  platform: 'Reddit' },
  { topic: 'Halving',  mentions_24h: 38_400,  change_pct: 42.1,  sentiment: 0.72,  platform: 'X' },
  { topic: 'Inflation',mentions_24h: 28_400,  change_pct: -12.4, sentiment: -0.48, platform: 'X' },
];

// ─── KOL SENTIMENT (Key Opinion Leaders) ─────────────────────────────────────
export const kolSentiment = [
  { name: 'Michael Saylor', handle: '@saylor',      sentiment: 0.98,  stance: 'Ultra Bullish BTC', followers_m: 4.2 },
  { name: 'Cathie Wood',    handle: '@CathieDWood',  sentiment: 0.74,  stance: 'Bullish, $1M target', followers_m: 1.8 },
  { name: 'Peter Schiff',   handle: '@PeterSchiff',  sentiment: -0.91, stance: 'Bear, prefers Gold', followers_m: 1.1 },
  { name: 'Raoul Pal',      handle: '@RaoulGMI',     sentiment: 0.62,  stance: 'Macro Bullish', followers_m: 1.3 },
  { name: 'CryptoQuant',   handle: '@ki_young_ju',  sentiment: 0.38,  stance: 'Neutro, monitorando', followers_m: 0.8 },
];

// ─── MENÇÕES POR HORA (24h) ───────────────────────────────────────────────────
export const mentionsHourly = Array.from({ length: 24 }, (_, i) => {
  const base = 11_800;
  const peak = i >= 12 && i <= 18 ? 1.4 : 1.0;
  return {
    hour: `${String(i).padStart(2, '0')}:00`,
    mentions: Math.round(base * peak * (0.85 + Math.random() * 0.3)),
    sentiment: parseFloat((0.2 + Math.sin(i * 0.3) * 0.2 + (Math.random() - 0.5) * 0.15).toFixed(2)),
    btc_volume_m: parseFloat((1050 + Math.sin(i * 0.4) * 300 + (Math.random() - 0.5) * 200).toFixed(0)),
  };
});