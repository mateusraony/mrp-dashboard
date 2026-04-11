// ─── MOCK DATA — Dashboard de Ações & Automações ─────────────────────────────


// ─── OPORTUNIDADES DE TRADING ─────────────────────────────────────────────────
export const tradeOpportunities = [
  {
    id: 'op001',
    asset: 'BTC/USDT',
    type: 'LONG',
    strategy: 'Carry Trade',
    entry: 84_000,
    target: 91_000,
    stop: 81_000,
    rr: 2.33,
    confidence: 74,
    probability: 0.68,
    timeframe: '7–14 dias',
    source: 'Basis + ETF Inflows',
    rationale: 'Basis Jun26 anualizado em 10.2% vs US10Y 4.5% = carry positivo de 5.7pp. ETF inflows de $1.84B na semana com 7 dias consecutivos. Funding controlado. Setup de cash-and-carry com hedge de short futuro.',
    tags: ['carry', 'ETF', 'institucional'],
    created_at: new Date(Date.now() - 2 * 3600000),
    status: 'active',
    pnl_pct: 0.42,
    ai_grade: 'A',
  },
  {
    id: 'op002',
    asset: 'BTC/USDT',
    type: 'SHORT',
    strategy: 'Flush de Longs',
    entry: 84_300,
    target: 80_000,
    stop: 86_500,
    rr: 1.95,
    confidence: 62,
    probability: 0.58,
    timeframe: '4–12 horas',
    source: 'Funding Rate + OI',
    rationale: 'Funding rate em 0.0712% (ann 78%) com OI crescendo +2.34% 1D e +13.7% 1W. L/S ratio 1.23 com top traders em 1.41 — sobrecarregamento de longs histórico. Modelo prevê flush com prob 62% nos próximos ciclos de funding.',
    tags: ['flush', 'funding', 'intraday'],
    created_at: new Date(Date.now() - 5 * 3600000),
    status: 'active',
    pnl_pct: -0.18,
    ai_grade: 'B',
  },
  {
    id: 'op003',
    asset: 'BTC/USDT',
    type: 'LONG',
    strategy: 'Acumulação On-Chain',
    entry: 82_500,
    target: 94_000,
    stop: 79_000,
    rr: 3.28,
    confidence: 71,
    probability: 0.65,
    timeframe: '30–60 dias',
    source: 'NUPL + LTH Supply',
    rationale: 'NUPL em 0.48 (zona de Crença) — historicamente zona de continuação. LTH acumulando +1.88% em 30d. MVRV 1.80 ainda abaixo da zona de topo (3.5+). Saída de 4.820 BTC das exchanges em 24h. Setup swing de médio prazo.',
    tags: ['on-chain', 'swing', 'acumulação'],
    created_at: new Date(Date.now() - 12 * 3600000),
    status: 'watching',
    pnl_pct: null,
    ai_grade: 'A',
  },
  {
    id: 'op004',
    asset: 'BTC-OPTIONS',
    type: 'HEDGE',
    strategy: 'Compra de Put ATM',
    entry: null,
    target: null,
    stop: null,
    premium: 1840,
    rr: null,
    confidence: 68,
    probability: 0.61,
    timeframe: '1–2 semanas',
    source: 'IV + GEX',
    rationale: 'GEX negativo de -$342M indica dealers short gamma — amplifica movimentos. Put skew de -3.1pp mostra demanda por proteção. IV ATM em 62.4% — caro mas justificado pela volatilidade esperada pré-CPI (12/Mar) e FOMC (19/Mar).',
    tags: ['opções', 'hedge', 'GEX'],
    created_at: new Date(Date.now() - 8 * 3600000),
    status: 'active',
    pnl_pct: 3.21,
    ai_grade: 'B',
  },
  {
    id: 'op005',
    asset: 'USDT/USDC',
    type: 'ARBITRAGE',
    strategy: 'Basis Spread Jun26',
    entry: null,
    target: null,
    stop: null,
    basis_ann: 10.2,
    rr: null,
    confidence: 81,
    probability: 0.78,
    timeframe: '90 dias (até Jun26)',
    source: 'CME Basis',
    rationale: 'Comprar BTC spot + vender futuro Jun26 a $87,240. Basis anualizado de 10.2% com capital travado por 90 dias. Yield free de risco vs US10Y 4.5% = retorno incremental de 5.7pp. Zero direcional — retorno garantido pela arbitragem.',
    tags: ['basis', 'arbitragem', 'zero-risco'],
    created_at: new Date(Date.now() - 24 * 3600000),
    status: 'active',
    pnl_pct: 0.89,
    ai_grade: 'A',
  },
  {
    id: 'op006',
    asset: 'BTC/USDT',
    type: 'LONG',
    strategy: 'Stablecoin Signal',
    entry: 83_500,
    target: 89_000,
    stop: 81_000,
    rr: 2.20,
    confidence: 67,
    probability: 0.63,
    timeframe: '24–48 horas',
    source: 'Mint Event $1B USDT',
    rationale: 'Emissão de $1B de USDT há 48h — correlação histórica de 0.81 com alta de BTC com lag de 12h. Net mint 24h +$420.6M (287% acima da média 7D). Capital entrando no ecossistema em ritmo acelerado. Setup de alta probabilidade com confirmação de CVD.',
    tags: ['stablecoin', 'mint', 'correlação'],
    created_at: new Date(Date.now() - 1 * 3600000),
    status: 'watching',
    pnl_pct: null,
    ai_grade: 'B',
  },
];

// ─── HISTÓRICO DE PERFORMANCE ─────────────────────────────────────────────────
export const performanceHistory = [
  { id: 'h001', asset: 'BTC/USDT', type: 'LONG', strategy: 'ETF Inflow Signal', entry: 71_200, exit: 78_400, pnl_pct: 10.11, result: 'WIN', duration: '8 dias', date: '2026-02-28', ai_grade: 'A' },
  { id: 'h002', asset: 'BTC/USDT', type: 'SHORT', strategy: 'Flush de Longs', entry: 76_400, exit: 73_100, pnl_pct: 4.32, result: 'WIN', duration: '6h', date: '2026-03-01', ai_grade: 'B' },
  { id: 'h003', asset: 'BTC/USDT', type: 'LONG', strategy: 'On-Chain Divergência', entry: 74_000, exit: 72_800, pnl_pct: -1.62, result: 'LOSS', duration: '3 dias', date: '2026-03-03', ai_grade: 'B' },
  { id: 'h004', asset: 'BTC-OPTIONS', type: 'HEDGE', strategy: 'Put Spread Macro', entry: null, exit: null, pnl_pct: 12.40, result: 'WIN', duration: '5 dias', date: '2026-03-05', ai_grade: 'A' },
  { id: 'h005', asset: 'BTC/USDT', type: 'LONG', strategy: 'Stablecoin Mint', entry: 79_200, exit: 83_100, pnl_pct: 4.92, result: 'WIN', duration: '2 dias', date: '2026-03-06', ai_grade: 'A' },
  { id: 'h006', asset: 'BTC/USDT', type: 'SHORT', strategy: 'VIX Spike Hedge', entry: 83_800, exit: 84_100, pnl_pct: -0.36, result: 'LOSS', duration: '2h', date: '2026-03-07', ai_grade: 'B' },
  { id: 'h007', asset: 'USDT/USDC', type: 'ARBITRAGE', strategy: 'Basis Mar26', entry: null, exit: null, pnl_pct: 3.18, result: 'WIN', duration: '28 dias', date: '2026-03-08', ai_grade: 'A' },
];

// ─── STATS GLOBAIS ────────────────────────────────────────────────────────────
const wins = performanceHistory.filter(h => h.result === 'WIN').length;
const total = performanceHistory.length;
const avgPnl = performanceHistory.reduce((s, h) => s + h.pnl_pct, 0) / total;
const bestTrade = performanceHistory.reduce((a, b) => a.pnl_pct > b.pnl_pct ? a : b);

export const performanceStats = {
  total_trades: total,
  win_rate: (wins / total * 100),
  avg_pnl_pct: avgPnl,
  best_trade_pct: bestTrade.pnl_pct,
  cumulative_pnl_pct: performanceHistory.reduce((s, h) => s + h.pnl_pct, 0),
  sharpe_ratio: 2.14,
  max_drawdown: -1.62,
  grade_a_win_rate: 100,
  grade_b_win_rate: 50,
};

// ─── PNL CHART DATA ───────────────────────────────────────────────────────────
export const pnlChartData = (() => {
  let cum = 0;
  return performanceHistory.map(h => {
    cum += h.pnl_pct;
    return { date: h.date.slice(5), pnl: parseFloat(h.pnl_pct.toFixed(2)), cumulative: parseFloat(cum.toFixed(2)) };
  });
})();

// ─── AUTOMATION RULES ─────────────────────────────────────────────────────────
export const automationRules = [
  {
    id: 'rule001',
    name: 'Alerta Regime Change',
    trigger: 'regime_change',
    condition: 'Regime muda de Risk-On para Risk-Off ou Neutro',
    threshold: null,
    channels: ['telegram', 'discord'],
    active: true,
    fires_24h: 0,
    last_fire: null,
    priority: 'HIGH',
    message_template: '🚨 REGIME CHANGE DETECTADO\nNovo regime: {{regime}}\nScore: {{score}}/100\nAção recomendada: {{action}}',
  },
  {
    id: 'rule002',
    name: 'Stablecoin Mint Anômalo',
    trigger: 'stablecoin_anomaly',
    condition: 'Net mint 24h > 200% da média 7D',
    threshold: 200,
    channels: ['telegram'],
    active: true,
    fires_24h: 1,
    last_fire: new Date(Date.now() - 2 * 3600000),
    priority: 'MEDIUM',
    message_template: '💧 STABLECOIN ANOMALIA\nMint {{token}}: ${{amount}}M ({{deviation}}% acima da média)\nSinal: {{signal}}',
  },
  {
    id: 'rule003',
    name: 'Funding Rate Crítico',
    trigger: 'funding_extreme',
    condition: 'Funding rate > 0.10% por 2 ciclos consecutivos',
    threshold: 0.10,
    channels: ['telegram', 'discord', 'webhook'],
    active: true,
    fires_24h: 0,
    last_fire: new Date(Date.now() - 18 * 3600000),
    priority: 'HIGH',
    message_template: '⚡ FUNDING EXTREMO\nFunding: {{rate}}% (ann {{ann}}%)\nOI: {{oi}} | Risco de flush: {{prob}}%',
  },
  {
    id: 'rule004',
    name: 'Whale Alert $10M+',
    trigger: 'whale_transaction',
    condition: 'Transação individual > $10M detectada',
    threshold: 10,
    channels: ['discord'],
    active: false,
    fires_24h: 3,
    last_fire: new Date(Date.now() - 45 * 60000),
    priority: 'LOW',
    message_template: '🐋 WHALE ALERT\nValor: ${{amount}}M | Chain: {{chain}}\nDireção: {{direction}}',
  },
  {
    id: 'rule005',
    name: 'VIX Spike > 25',
    trigger: 'vix_spike',
    condition: 'VIX ultrapassa 25 — risco macro elevado',
    threshold: 25,
    channels: ['telegram', 'discord'],
    active: true,
    fires_24h: 0,
    last_fire: null,
    priority: 'HIGH',
    message_template: '🌡️ VIX SPIKE\nVIX atual: {{vix}} | Threshold: {{threshold}}\nRisco macro: ELEVADO. Reduza exposição.',
  },
  {
    id: 'rule006',
    name: 'AI Score Bearish > 70',
    trigger: 'ai_score',
    condition: 'Score de risco global supera 70 (bear zone)',
    threshold: 70,
    channels: ['telegram'],
    active: true,
    fires_24h: 0,
    last_fire: new Date(Date.now() - 72 * 3600000),
    priority: 'MEDIUM',
    message_template: '🤖 AI SCORE ELEVADO\nScore: {{score}}/100 | Regime: {{regime}}\nRecomendação: {{recommendation}}',
  },
];

// ─── BOT CONNECTIONS ──────────────────────────────────────────────────────────
export const botConnections = [
  { id: 'bot001', type: 'telegram', name: 'CryptoWatch Bot', token: 'bot:****', chat_id: '-100****', status: 'connected', messages_sent: 124, last_ping: new Date(Date.now() - 30000) },
  { id: 'bot002', type: 'discord', name: 'CryptoWatch Discord', webhook_url: 'https://discord.com/api/webhooks/****', status: 'connected', messages_sent: 47, last_ping: new Date(Date.now() - 60000) },
  { id: 'bot003', type: 'webhook', name: 'Custom Webhook', webhook_url: '', status: 'disconnected', messages_sent: 0, last_ping: null },
];

// ─── RECENT BOT MESSAGES ──────────────────────────────────────────────────────
export const recentBotMessages = [
  { id: 'm001', channel: 'telegram', rule: 'Stablecoin Mint Anômalo', message: '💧 STABLECOIN ANOMALIA\nMint USDT: $500M (+287% acima da média)', sent_at: new Date(Date.now() - 2 * 3600000), status: 'delivered' },
  { id: 'm002', channel: 'discord',  rule: 'Funding Rate Crítico', message: '⚡ FUNDING EXTREMO\nFunding: 0.0712% (ann 78%)', sent_at: new Date(Date.now() - 18 * 3600000), status: 'delivered' },
  { id: 'm003', channel: 'telegram', rule: 'AI Score Bearish > 70', message: '🤖 AI SCORE ELEVADO\nScore: 68/100 | Risk-On moderado', sent_at: new Date(Date.now() - 72 * 3600000), status: 'delivered' },
];