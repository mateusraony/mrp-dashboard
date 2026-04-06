// ─── EXTENDED MOCK DATA — Institutional Tier 2 Metrics ──────────────────────
// ETF Flows · Liquidation Clusters · Term Structure · LTH/STH · Basis · IV Rank

// ─── SPOT ETF FLOWS (BlackRock, Fidelity, Grayscale, etc.) ──────────────────
export const etfFlows = {
  date: '2026-03-10',
  total_aum_b: 112.4,         // $112.4B total AUM em ETFs BTC
  total_aum_prev_7d_b: 108.2,
  total_aum_prev_30d_b: 94.6,
  net_flow_today_m: 284.6,    // Entrada líquida hoje (USD milhões)
  net_flow_7d_m: 1_842.3,
  net_flow_30d_m: 8_420.0,
  consec_inflow_days: 7,       // dias consecutivos de entrada
  funds: [
    {
      ticker: 'IBIT',  name: 'iShares Bitcoin Trust',     issuer: 'BlackRock',
      aum_b: 54.2,  flow_today_m: 142.8, flow_7d_m: 980.4,  flow_30d_m: 4_120.0,
      shares: 841_200_000, price: 64.42,
      color: '#3b82f6',
    },
    {
      ticker: 'FBTC',  name: 'Fidelity Wise Origin BTC',  issuer: 'Fidelity',
      aum_b: 21.8,  flow_today_m: 68.4,  flow_7d_m: 412.1,  flow_30d_m: 1_840.0,
      shares: 312_400_000, price: 69.78,
      color: '#10b981',
    },
    {
      ticker: 'ARKB',  name: 'ARK 21Shares Bitcoin ETF',  issuer: 'ARK Invest',
      aum_b: 7.4,   flow_today_m: 28.1,  flow_7d_m: 188.3,  flow_30d_m: 820.0,
      shares: 98_200_000,  price: 75.36,
      color: '#f59e0b',
    },
    {
      ticker: 'BITB',  name: 'Bitwise Bitcoin ETF',        issuer: 'Bitwise',
      aum_b: 4.1,   flow_today_m: 18.4,  flow_7d_m: 98.2,   flow_30d_m: 410.0,
      shares: 54_100_000,  price: 75.78,
      color: '#a78bfa',
    },
    {
      ticker: 'GBTC',  name: 'Grayscale Bitcoin Trust',    issuer: 'Grayscale',
      aum_b: 18.2,  flow_today_m: -42.1, flow_7d_m: -218.4, flow_30d_m: -840.0,
      shares: 281_800_000, price: 64.58,
      color: '#ef4444',
    },
    {
      ticker: 'HODL',  name: 'VanEck Bitcoin ETF',         issuer: 'VanEck',
      aum_b: 2.8,   flow_today_m: 12.4,  flow_7d_m: 64.2,   flow_30d_m: 280.0,
      shares: 38_400_000,  price: 72.92,
      color: '#06b6d4',
    },
    {
      ticker: 'BTCO',  name: 'Invesco Galaxy Bitcoin ETF', issuer: 'Invesco',
      aum_b: 3.9,   flow_today_m: 56.6,  flow_7d_m: 317.5,  flow_30d_m: 1_790.0,
      shares: 52_100_000,  price: 74.86,
      color: '#ec4899',
    },
  ],
  // Histórico de flows diários (30 dias)
  history_daily: Array.from({ length: 30 }, (_, i) => {
    const base = 180 + Math.sin(i * 0.4) * 120;
    const noise = (Math.random() - 0.3) * 200;
    return {
      date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      inflow: Math.max(0, parseFloat((base + noise + 80).toFixed(1))),
      outflow: parseFloat((Math.max(0, 80 - noise * 0.3)).toFixed(1)),
      net: parseFloat((base + noise).toFixed(1)),
    };
  }),
  signal: 'Entrada líquida de $284.6M hoje — BlackRock IBIT lidera com $142.8M. 7 dias consecutivos de entrada = pressão institucional compradora sustentada.',
  quality: 'A',
};

// ─── LIQUIDATION CLUSTERS (Heatmap de Liquidações) ──────────────────────────
// Onde estão as ordens de liquidação acumuladas por faixa de preço
export const liquidationClusters = {
  spot: 84298.70,
  // clusters[i] = { price, longs_usd, shorts_usd, total_usd }
  // Longs liquidados se preço CAI até esse nível
  // Shorts liquidados se preço SOBE até esse nível
  clusters: [
    // Acima do spot (shorts em risco se preço subir)
    { price: 85000, longs_usd: 12_400_000,  shorts_usd: 48_200_000, side: 'shorts' },
    { price: 85500, longs_usd: 8_200_000,   shorts_usd: 84_100_000, side: 'shorts' },
    { price: 86000, longs_usd: 5_100_000,   shorts_usd: 142_800_000, side: 'shorts' },
    { price: 87000, longs_usd: 3_400_000,   shorts_usd: 218_400_000, side: 'shorts' },
    { price: 88000, longs_usd: 2_100_000,   shorts_usd: 312_100_000, side: 'shorts' },
    { price: 90000, longs_usd: 1_200_000,   shorts_usd: 484_200_000, side: 'shorts' },
    { price: 92000, longs_usd: 800_000,     shorts_usd: 621_400_000, side: 'shorts' },
    // Abaixo do spot (longs em risco se preço cair)
    { price: 84000, longs_usd: 38_400_000,  shorts_usd: 8_100_000, side: 'longs' },
    { price: 83500, longs_usd: 68_100_000,  shorts_usd: 6_400_000, side: 'longs' },
    { price: 83000, longs_usd: 142_400_000, shorts_usd: 4_200_000, side: 'longs' },
    { price: 82000, longs_usd: 284_800_000, shorts_usd: 3_100_000, side: 'longs' },
    { price: 81000, longs_usd: 420_100_000, shorts_usd: 2_400_000, side: 'longs' },
    { price: 80000, longs_usd: 618_400_000, shorts_usd: 1_800_000, side: 'longs' },
    { price: 78000, longs_usd: 924_200_000, shorts_usd: 1_200_000, side: 'longs' },
  ].sort((a, b) => b.price - a.price),
  largest_long_cluster: { price: 78000, usd: 924_200_000 },
  largest_short_cluster: { price: 92000, usd: 621_400_000 },
  total_longs_at_risk_10pct: 1_840_000_000, // longs liquidados se -10%
  total_shorts_at_risk_10pct: 842_000_000,   // shorts liquidados se +10%
  quality: 'B',
};

// ─── TERM STRUCTURE (Curva de Volatilidade por Prazo) ────────────────────────
export const termStructure = {
  spot: 84298.70,
  updated_at: new Date(),
  // Cada vencimento com IV ATM
  expirations: [
    { label: '1W',  days: 7,   iv_atm: 0.584, iv_prev_day: 0.568, oi_contracts: 8_420,  volume_24h: 2_840 },
    { label: '2W',  days: 14,  iv_atm: 0.601, iv_prev_day: 0.589, oi_contracts: 12_100, volume_24h: 1_980 },
    { label: '1M',  days: 30,  iv_atm: 0.624, iv_prev_day: 0.612, oi_contracts: 24_800, volume_24h: 4_210 },
    { label: '2M',  days: 60,  iv_atm: 0.618, iv_prev_day: 0.608, oi_contracts: 18_400, volume_24h: 2_840 },
    { label: '3M',  days: 90,  iv_atm: 0.612, iv_prev_day: 0.601, oi_contracts: 21_200, volume_24h: 3_410 },
    { label: '6M',  days: 180, iv_atm: 0.598, iv_prev_day: 0.591, oi_contracts: 14_800, volume_24h: 1_820 },
    { label: '1Y',  days: 365, iv_atm: 0.574, iv_prev_day: 0.568, oi_contracts: 8_200,  volume_24h: 980  },
  ],
  // Estrutura: 'contango' (curto > longo, IV cai com prazo) = stress curto prazo
  //            'backwardation' (longo > curto, IV sobe com prazo) = estrutura normal
  //            'hump' (pico no meio) = evento específico precificado
  structure_type: 'slight_contango',
  front_back_spread: 0.584 - 0.574, // 1W - 1Y = +1.0pp (leve contango = mercado ansioso no curto prazo)
  interpretation: 'Estrutura em leve contango (+1.0pp de spread 1W-1Y) — mercado precificando mais risco no curto prazo. Typical antes de eventos macro (CPI 12/Mar, FOMC 19/Mar).',
  quality: 'B',
};

// ─── LTH / STH SUPPLY (Long-Term vs Short-Term Holders) ─────────────────────
// LTH = moedas paradas por >155 dias
// STH = moedas movidas nos últimos <155 dias
export const lthSthSupply = {
  total_supply: 19_850_000,      // BTC em circulação
  lth_supply: 14_284_000,        // BTC em mãos de LTH (~71.9%)
  sth_supply: 5_566_000,         // BTC em mãos de STH (~28.1%)
  lth_pct: 71.9,
  sth_pct: 28.1,
  // LTH em lucro vs prejuízo
  lth_in_profit: 13_840_000,     // 96.9% dos LTH em lucro
  lth_in_loss: 444_000,
  lth_profit_pct: 96.9,
  // STH em lucro vs prejuízo
  sth_in_profit: 3_282_000,      // 58.9% dos STH em lucro
  sth_in_loss: 2_284_000,
  sth_profit_pct: 58.9,
  // Deltas
  lth_supply_prev_30d: 14_020_000,
  sth_supply_prev_30d: 5_830_000,
  lth_delta_30d_pct: ((14_284_000 - 14_020_000) / 14_020_000 * 100), // +1.88% → acumulando
  sth_delta_30d_pct: ((5_566_000 - 5_830_000) / 5_830_000 * 100),   // -4.53% → STH reduzindo
  // Realized cap por coorte
  lth_realized_price: 42_180,    // LTH compraram em média a $42.1K
  sth_realized_price: 81_420,    // STH compraram em média a $81.4K (quase no pico)
  // Interpretação
  signal: 'LTH dominam 71.9% do supply — acumulando +1.88% em 30d. STH compraram próximo do topo ($81.4K) e estão 41.1% abaixo do custo médio atual. Estrutura saudável de longo prazo.',
  quality: 'B',
  // Histórico
  history_lth_pct: {
    '1w': Array.from({ length: 7 }, (_, i) => ({ t: i, v: parseFloat((71.2 + i * 0.1 + (Math.random() - 0.5) * 0.15).toFixed(2)) })),
    '1m': Array.from({ length: 30 }, (_, i) => ({ t: i, v: parseFloat((70.1 + i * 0.060 + (Math.random() - 0.5) * 0.2).toFixed(2)) })),
  },
};

// ─── BASIS / FUTURES PREMIUM (Spot-Futures) ──────────────────────────────────
// Basis = (Futures Price - Spot Price) / Spot Price × annualized
export const futuresBasis = {
  spot: 84298.70,
  perp_mark: 84312.50,           // perpetual = quase spot (diferença = funding)
  // Futuros datados
  futures: [
    {
      expiry: 'Mar-28-2026', days_to_exp: 18,
      price: 84_840,
      basis_abs: 84840 - 84298.70,
      basis_pct: ((84840 - 84298.70) / 84298.70 * 100),
      basis_annualized: ((84840 - 84298.70) / 84298.70 * 100) / 18 * 365,
    },
    {
      expiry: 'Jun-27-2026', days_to_exp: 108,
      price: 87_240,
      basis_abs: 87240 - 84298.70,
      basis_pct: ((87240 - 84298.70) / 84298.70 * 100),
      basis_annualized: ((87240 - 84298.70) / 84298.70 * 100) / 108 * 365,
    },
    {
      expiry: 'Sep-25-2026', days_to_exp: 198,
      price: 89_820,
      basis_abs: 89820 - 84298.70,
      basis_pct: ((89820 - 84298.70) / 84298.70 * 100),
      basis_annualized: ((89820 - 84298.70) / 84298.70 * 100) / 198 * 365,
    },
    {
      expiry: 'Dec-25-2026', days_to_exp: 289,
      price: 92_400,
      basis_abs: 92400 - 84298.70,
      basis_pct: ((92400 - 84298.70) / 84298.70 * 100),
      basis_annualized: ((92400 - 84298.70) / 84298.70 * 100) / 289 * 365,
    },
  ],
  // CME basis (institutional)
  cme_basis_annualized: 9.8,     // % annualized — prêmio institucional
  cme_basis_prev_7d: 11.2,
  // Carry trade signal
  carry_trade_attractive: true,   // basis > risk-free rate (US10Y = 4.5%)
  signal: 'Basis anualizado de ~10.2% (Jun26) vs US10Y 4.5% = carry positivo de 5.7pp. Incentivo para cash-and-carry institucional — comprar spot, vender futuro. Confirma demanda institucional estrutural.',
  quality: 'B',
  // Histórico basis anualizado
  history_basis_ann: {
    '1w': Array.from({ length: 7 }, (_, i) => ({ t: i, v: parseFloat((8.4 + i * 0.26 + (Math.random() - 0.5) * 0.5).toFixed(2)) })),
    '1m': Array.from({ length: 30 }, (_, i) => ({ t: i, v: parseFloat((7.2 + i * 0.1 + (Math.random() - 0.5) * 0.8).toFixed(2)) })),
  },
};

// ─── IV RANK / IV PERCENTILE ──────────────────────────────────────────────────
// IVR = (IV atual - IV mínima 52 semanas) / (IV máxima - IV mínima)
export const ivRank = {
  iv_current: 0.624,            // 62.4% ATM
  iv_52w_low: 0.381,            // mínima do ano
  iv_52w_high: 0.842,           // máxima do ano (crash março 2025)
  iv_rank: ((0.624 - 0.381) / (0.842 - 0.381) * 100), // IVR = 52.7%
  iv_percentile: 58.4,          // percentil histórico (% do tempo que IV estava abaixo do nível atual)
  iv_30d_avg: 0.598,
  iv_90d_avg: 0.612,
  // IVR zones: 0-25 = muito barata (buy vol), 25-50 = barata, 50-75 = neutra/cara, 75-100 = muito cara (sell vol)
  ivr_zone: 'Neutra',
  ivr_zone_color: '#f59e0b',
  signal: 'IVR 52.7% — volatilidade em zona neutra. Nem barata nem cara. Opções razoavelmente precificadas. Estratégias direcionais preferíveis a pure vol plays.',
  quality: 'B',
  // Histórico IVR
  history: {
    '1w': Array.from({ length: 7 }, (_, i) => ({ t: i, v: parseFloat((48.2 + i * 0.64 + (Math.random() - 0.5) * 2).toFixed(1)) })),
    '1m': Array.from({ length: 30 }, (_, i) => ({ t: i, v: parseFloat((38.4 + i * 0.48 + (Math.random() - 0.5) * 3).toFixed(1)) })),
  },
};

// ─── FUNDING RATE POR EXCHANGE ─────────────────────────────────────────────────
export const fundingByExchange = [
  { exchange: 'Binance',  rate: 0.000712, rate_8h: 0.000712, rate_annualized: 0.000712 * 3 * 365 * 100, volume_b: 28.4, color: '#f59e0b' },
  { exchange: 'Bybit',    rate: 0.000698, rate_8h: 0.000698, rate_annualized: 0.000698 * 3 * 365 * 100, volume_b: 14.2, color: '#10b981' },
  { exchange: 'OKX',      rate: 0.000684, rate_8h: 0.000684, rate_annualized: 0.000684 * 3 * 365 * 100, volume_b: 9.8,  color: '#3b82f6' },
  { exchange: 'Deribit',  rate: 0.000720, rate_8h: 0.000720, rate_annualized: 0.000720 * 3 * 365 * 100, volume_b: 2.1,  color: '#a78bfa' },
  { exchange: 'Bitget',   rate: 0.000735, rate_8h: 0.000735, rate_annualized: 0.000735 * 3 * 365 * 100, volume_b: 4.8,  color: '#06b6d4' },
  { exchange: 'Gate.io',  rate: 0.000682, rate_8h: 0.000682, rate_annualized: 0.000682 * 3 * 365 * 100, volume_b: 1.4,  color: '#ec4899' },
];

// ─── OI RATIO (OI / Market Cap) ───────────────────────────────────────────────
export const oiRatio = {
  oi_usd: 18_420_000_000,
  market_cap_usd: 84298.70 * 19_850_000,   // ~$1.674T
  ratio_pct: (18_420_000_000 / (84298.70 * 19_850_000) * 100), // ~1.10%
  prev_7d_ratio: 0.97,
  prev_30d_ratio: 0.82,
  // Zonas: <0.5% = baixo leverage, 0.5–1.0% = moderado, 1.0–1.5% = elevado, >1.5% = extremo
  zone: 'Elevado',
  zone_color: '#f59e0b',
  signal: 'OI/Market Cap em 1.10% — zona de leverage elevado. Mercado alavancado acima da média histórica. Aumenta risco de flush/squeeze em moves bruscos.',
  quality: 'A',
};

// ─── PERP VS DATED FUTURES OI SPLIT ──────────────────────────────────────────
export const perpVsDatedOI = {
  perp_oi_b: 14.2,     // 77.1% do total
  dated_oi_b: 4.22,    // 22.9% do total
  total_oi_b: 18.42,
  perp_pct: 77.1,
  dated_pct: 22.9,
  cme_oi_b: 2.21,      // institucional (subconjunto do dated)
  cme_pct_of_dated: (2.21 / 4.22 * 100),
  signal: 'Perps dominam 77.1% do OI — elevada especulação de curto prazo. CME (institucional) representa 52.4% do dated OI.',
  quality: 'A',
};

// ─── TAKER FLOW OPTIONS (Buy Call/Sell Call/Buy Put/Sell Put) ─────────────────
export const optionsTakerFlow = {
  // Últimas 24h — Net Premium em USD
  buy_call_premium_m: 48.4,    // comprando calls = especulação bullish
  sell_call_premium_m: 32.1,   // vendendo calls = monetizando carry (cap upside)
  buy_put_premium_m: 38.2,     // comprando puts = hedging/proteção
  sell_put_premium_m: 21.8,    // vendendo puts = sell vol / coletando prêmio
  net_call_premium_m: 48.4 - 32.1,   // +16.3M (net bullish calls)
  net_put_premium_m: 38.2 - 21.8,    // +16.4M (net hedging puts)
  bull_bear_index: (48.4 - 38.2) / (48.4 + 38.2), // +0.117 leve bullish
  // Por estratégia combo
  combo_strategies: [
    { name: 'Call Spread',  premium_net_m: 12.4, type: 'directional_bull', color: '#10b981' },
    { name: 'Put Spread',   premium_net_m: 8.2,  type: 'directional_bear', color: '#ef4444' },
    { name: 'Straddle',     premium_net_m: 6.8,  type: 'vol_long',         color: '#a78bfa' },
    { name: 'Strangle',     premium_net_m: 4.1,  type: 'vol_long',         color: '#8b5cf6' },
    { name: 'Covered Call', premium_net_m: -9.4, type: 'carry',            color: '#f59e0b' },
    { name: 'Cash Secured', premium_net_m: -5.2, type: 'carry',            color: '#64748b' },
  ],
  signal: 'Net premium +$16.3M em Calls vs +$16.4M em Puts — mercado equilibrado mas com leve viés de hedging. Bull-Bear Index 0.117 = neutro-bullish. Estragédias de carry (covered call) dominam vendas.',
  quality: 'B',
  // Histórico 24h
  history_24h: Array.from({ length: 24 }, (_, i) => ({
    t: i,
    buy_call: parseFloat((2.1 + Math.sin(i * 0.4) * 0.8 + (Math.random() - 0.5) * 0.6).toFixed(2)),
    buy_put: parseFloat((1.6 + Math.sin(i * 0.3 + 1) * 0.6 + (Math.random() - 0.5) * 0.5).toFixed(2)),
    sell_call: parseFloat((1.4 + Math.sin(i * 0.35) * 0.5 + (Math.random() - 0.5) * 0.4).toFixed(2)),
    sell_put: parseFloat((0.9 + Math.sin(i * 0.25) * 0.4 + (Math.random() - 0.5) * 0.3).toFixed(2)),
  })),
};