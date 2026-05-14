// ─── MOCK DATA MODULE ───────────────────────────────────────────────────────
// All values tagged with source for easy swap to live API calls
// Badge: 🧪 MOCK | Grades: A/B/C
// DATA_MODE is imported from @/lib/env — não exportar aqui para evitar shadowing.

// ─── HELPERS ───────────────────────────────────────────────────────────────
export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function fmtNum(v, decimals = 2) {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(v, decimals = 3) {
  if (v === null || v === undefined) return '—';
  return (v * 100).toFixed(decimals) + '%';
}

export function fmtDelta(v, isYield = false) {
  if (v === null || v === undefined) return '—';
  const sign = v >= 0 ? '+' : '';
  if (isYield) return `${sign}${(v * 100).toFixed(1)}bp`;
  return `${sign}${(v * 100).toFixed(2)}%`;
}

// ─── THRESHOLDS ─────────────────────────────────────────────────────────────
export const THRESHOLDS = {
  FUNDING_REF: 0.0005,
  OI_REF_PCT: 1.5,
  RET_REF: 0.004,
  VOL_REF: 1.0,
  CROWD_REF: 0.10,
  K_DEFAULT: 10,
  RISK_ALERT_SCORE: 75,
  GLOBAL_RISKOFF_SCORE: 35,
  GLOBAL_RISKON_SCORE: 65,
  MACRO_EVENT_LEAD_HOURS: 6,
  EVAL_WINDOW_MIN: 240,
};

// ─── SOURCE HEALTH ──────────────────────────────────────────────────────────
export const sourceHealth = [
  { source: 'binance_futures', last_ok_at: new Date(Date.now()-45000), fail_count_24h: 0, latency_ms: 187, staleness_sec: 45, grade: 'A' },
  { source: 'binance_spot',    last_ok_at: new Date(Date.now()-32000), fail_count_24h: 0, latency_ms: 143, staleness_sec: 32, grade: 'A' },
  { source: 'deribit',         last_ok_at: new Date(Date.now()-90000), fail_count_24h: 2, latency_ms: 412, staleness_sec: 90, grade: 'B' },
  { source: 'fred',            last_ok_at: new Date(Date.now()-3600000), fail_count_24h: 0, latency_ms: 820, staleness_sec: 3600, grade: 'A' },
  { source: 'mempool',         last_ok_at: new Date(Date.now()-60000), fail_count_24h: 0, latency_ms: 224, staleness_sec: 60, grade: 'A' },
  { source: 'gdelt',           last_ok_at: new Date(Date.now()-300000), fail_count_24h: 5, latency_ms: 1240, staleness_sec: 300, grade: 'B' },
  { source: 'alternative',     last_ok_at: new Date(Date.now()-120000), fail_count_24h: 0, latency_ms: 310, staleness_sec: 120, grade: 'A' },
  { source: 'coinmetrics',     last_ok_at: null, fail_count_24h: 12, latency_ms: null, staleness_sec: null, grade: 'C' },
];

// ─── BTC FUTURES ────────────────────────────────────────────────────────────
export const btcFutures = {
  symbol: 'BTCUSDT',
  mark_price: 84312.50,
  index_price: 84298.70,
  funding_rate: 0.000712,
  next_funding_time: new Date(Date.now() + 4 * 3600000),
  funding_history: Array.from({length: 30}, (_, i) => ({
    fundingTime: Date.now() - (29 - i) * 8 * 3600000,
    fundingRate: parseFloat((0.0002 + Math.sin(i * 0.4) * 0.0004 + (Math.random() - 0.5) * 0.0002).toFixed(6)),
  })),
  open_interest_usdt: 18_420_000_000,
  oi_prev_1d: 17_980_000_000,   // +2.45%
  oi_prev_1w: 16_200_000_000,   // +13.7%
  oi_prev_1m: 14_100_000_000,   // +30.6%
  oi_delta_pct: 2.34,           // 1D
  oi_delta_pct_1w: 13.70,       // 1W
  oi_delta_pct_1m: 30.64,       // 1M
  funding_avg_7d: 0.000524,
  funding_avg_30d: 0.000398,
  long_short_ratio: 1.23,
  top_trader_ls: 1.41,
  depth_bids: [
    { price: 84200, qty: 12.4 }, { price: 84100, qty: 28.1 },
    { price: 84000, qty: 45.6 }, { price: 83800, qty: 67.2 },
    { price: 83500, qty: 89.0 }, { price: 83000, qty: 134.5 },
  ],
  depth_asks: [
    { price: 84400, qty: 15.2 }, { price: 84500, qty: 31.7 },
    { price: 84700, qty: 52.1 }, { price: 85000, qty: 88.4 },
    { price: 85500, qty: 112.3 },{ price: 86000, qty: 198.7 },
  ],
  risk_score: 68,
  risk_direction: 'long_flush',
  risk_factors: {
    funding_extreme: 0.71,
    oi_spike: 0.52,
    ret_mag: 0.38,
    vol_spike: 0.44,
    crowding: 0.61,
  },
};

// ─── BTC SPOT FLOW ──────────────────────────────────────────────────────────
export const btcSpotFlow = {
  symbol: 'BTCUSDT',
  price: 84298.70,
  ret_15m: 0.0031,
  ret_1h: 0.0087,
  ret_4h: -0.0124,
  ret_1d: 0.0215,
  ret_1w: 0.0842,    // +8.42% weekly
  ret_1m: -0.0531,   // -5.31% monthly
  volume_1h_usdt: 1_234_500_000,
  volume_1d_usdt: 28_450_000_000,
  volume_1w_usdt: 182_300_000_000,
  taker_buy: 456_789,
  taker_sell: 398_241,
  cvd: 58_548,
  cvd_1d: 124_320,
  cvd_1w: -284_500,
  cvd_trend: 'positive',
  vol_spike_score: 0.44,
  klines: Array.from({length: 48}, (_, i) => {
    const base = 83000 + Math.sin(i * 0.25) * 1200;
    const noise = (Math.random() - 0.48) * 600;
    const o = base + noise;
    const c = base + noise + (Math.random() - 0.47) * 400;
    return {
      time: Date.now() - (47 - i) * 3600000,
      open: o, close: c,
      high: Math.max(o, c) + Math.random() * 200,
      low: Math.min(o, c) - Math.random() * 200,
      volume: 5000 + Math.random() * 3000,
    };
  }),
};

// ─── BTC OPTIONS (Deribit) ──────────────────────────────────────────────────
export const btcOptions = {
  spot: 84298.70,
  expiry: 'BTC-14MAR26',
  expiry_hours: 168,
  iv_atm: 0.624,
  iv_atm_1d_delta: 0.018,
  iv_atm_1w_delta: -0.031,
  iv_atm_1m_delta: 0.054,
  skew: -0.031,
  skew_direction: 'put_skew',
  regime: 'elevated_vol',
  strikes: [
    { strike: 76000, call_iv: 0.71, put_iv: 0.82 },
    { strike: 78000, call_iv: 0.68, put_iv: 0.76 },
    { strike: 80000, call_iv: 0.65, put_iv: 0.71 },
    { strike: 82000, call_iv: 0.64, put_iv: 0.67 },
    { strike: 84000, call_iv: 0.624,put_iv: 0.624 },
    { strike: 86000, call_iv: 0.61, put_iv: 0.61 },
    { strike: 88000, call_iv: 0.59, put_iv: 0.60 },
    { strike: 90000, call_iv: 0.58, put_iv: 0.59 },
    { strike: 92000, call_iv: 0.57, put_iv: 0.58 },
  ],
  quality: 'B',
};

// ─── MACRO BOARD (FRED) — with 1D / 1W / 1M deltas ──────────────────────────
export const macroBoard = {
  note: 'Dados diários FRED — não intraday',
  updated_at: new Date('2026-05-10'),
  series: [
    {
      id: 'SP500', name: 'S&P 500', series_id: 'SP500',
      value: 7398.93, prev: 7337.50, prev_7d: 7168.20, prev_30d: 6987.40,
      unit: 'pts', format: 'number',
      delta_1d: (7398.93 - 7337.50) / 7337.50,
      delta_7d: (7398.93 - 7168.20) / 7168.20,
      delta_30d: (7398.93 - 6987.40) / 6987.40,
      quality: 'A', icon: '📈',
    },
    {
      id: 'DXY', name: 'USD Broad Index', series_id: 'DTWEXBGS',
      value: 118.5, prev: 119.20, prev_7d: 120.40, prev_30d: 122.80,
      unit: '', format: 'number',
      delta_1d: (118.5 - 119.20) / 119.20,
      delta_7d: (118.5 - 120.40) / 120.40,
      delta_30d: (118.5 - 122.80) / 122.80,
      quality: 'A', icon: '💵',
    },
    {
      id: 'GOLD', name: 'Gold (LBMA AM)', series_id: 'GOLDAMGBD228NLBM',
      value: 4715.0, prev: 4678.0, prev_7d: 4580.0, prev_30d: 4320.0,
      unit: '$/oz', format: 'number',
      delta_1d: (4715.0 - 4678.0) / 4678.0,
      delta_7d: (4715.0 - 4580.0) / 4580.0,
      delta_30d: (4715.0 - 4320.0) / 4320.0,
      quality: 'A', icon: '🥇',
    },
    {
      id: 'VIX', name: 'VIX', series_id: 'VIXCLS',
      value: 17.19, prev: 17.42, prev_7d: 18.85, prev_30d: 21.60,
      unit: '', format: 'number',
      delta_1d: (17.19 - 17.42) / 17.42,
      delta_7d: (17.19 - 18.85) / 18.85,
      delta_30d: (17.19 - 21.60) / 21.60,
      quality: 'A', icon: '🌡️',
    },
    {
      id: 'US10Y', name: 'US 10Y Yield', series_id: 'DGS10',
      value: 4.37, prev: 4.40, prev_7d: 4.44, prev_30d: 4.28,
      unit: '%', format: 'yield',
      delta_1d_bp: (4.37 - 4.40) * 100,
      delta_7d_bp: (4.37 - 4.44) * 100,
      delta_30d_bp: (4.37 - 4.28) * 100,
      delta_1d: (4.37 - 4.40) / 4.40,
      delta_7d: (4.37 - 4.44) / 4.44,
      delta_30d: (4.37 - 4.28) / 4.28,
      quality: 'A', icon: '📊',
    },
    {
      id: 'US2Y', name: 'US 2Y Yield', series_id: 'DGS2',
      value: 3.90, prev: 3.93, prev_7d: 3.97, prev_30d: 4.02,
      unit: '%', format: 'yield',
      delta_1d_bp: (3.90 - 3.93) * 100,
      delta_7d_bp: (3.90 - 3.97) * 100,
      delta_30d_bp: (3.90 - 4.02) * 100,
      delta_1d: (3.90 - 3.93) / 3.93,
      delta_7d: (3.90 - 3.97) / 3.97,
      delta_30d: (3.90 - 4.02) / 4.02,
      quality: 'A', icon: '📉',
    },
  ],
};

// ─── ON-CHAIN (mempool + fees) ───────────────────────────────────────────────
export const onChain = {
  fees: { fastestFee: 28, halfHourFee: 21, hourFee: 14, economyFee: 8 },
  mempool: { count: 14_823, vsize: 89_245_120, total_fee: 4.212 },
  quality: 'A',
};

// ─── ON-CHAIN AVANÇADO (CryptoQuant / Glassnode) ─────────────────────────────
// NUPL — Net Unrealized Profit/Loss  [-1, 1]
export const btcNUPL = {
  value: 0.48,         // 0.48 = "Crença" — zona saudável antes de euforia
  prev_7d: 0.44,
  prev_30d: 0.38,
  delta_7d: 0.48 - 0.44,
  delta_30d: 0.48 - 0.38,
  // Zonas: <0 = Capitulação, 0–0.25 = Esperança, 0.25–0.5 = Otimismo/Crença,
  //        0.5–0.75 = Entusiasmo/Ganância, >0.75 = Euforia
  zone: 'Crença',           // zona atual
  zone_color: '#10b981',    // verde = zona saudável
  interpretation: 'Mercado em zona de Crença (NUPL 0.48) — holders no lucro mas sem euforia. Zona historicamente associada a continuação de alta com cautela.',
  quality: 'B',             // fonte: Glassnode (estimado)
  history: {
    '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: parseFloat((0.44 + i*0.00167 + (Math.random()-0.5)*0.015).toFixed(3)) })),
    '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((0.38 + i*0.0143 + (Math.random()-0.5)*0.02).toFixed(3)) })),
    '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((0.28 + i*0.0067 + (Math.random()-0.5)*0.025).toFixed(3)) })),
  },
};

// SOPR — Spent Output Profit Ratio
export const btcSOPR = {
  value: 1.028,        // >1 = coins vendidas em lucro, <1 = em prejuízo
  prev_7d: 1.012,
  prev_30d: 0.994,
  delta_7d: 1.028 - 1.012,
  delta_30d: 1.028 - 0.994,
  smoothed_7d: 1.018,  // média 7d para reduzir ruído
  interpretation: 'SOPR > 1 confirma que holders estão realizando lucro — pressão vendedora presente mas não extrema. Queda para <1 seria sinal de capitulação.',
  quality: 'B',
  history: {
    '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: parseFloat((1.012 + i*0.00067 + (Math.random()-0.5)*0.008).toFixed(4)) })),
    '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((1.012 + i*0.0023 + (Math.random()-0.5)*0.01).toFixed(4)) })),
    '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((0.990 + i*0.00127 + (Math.random()-0.5)*0.012).toFixed(4)) })),
  },
};

// Exchange Netflow — entradas/saídas de BTC nas exchanges
export const btcExchangeNetflow = {
  // Positivo = mais BTC entrando na exchange (pressão vendedora)
  // Negativo = mais BTC saindo da exchange (acúmulo / retirada)
  netflow_24h: -4_820,     // BTC — saída líquida de 4.820 BTC (acumulação)
  inflow_24h: 38_450,
  outflow_24h: 43_270,
  netflow_7d: -28_400,     // BTC saindo líquido na semana
  netflow_30d: +12_300,    // 30d — leve entrada (venda)
  exchange_reserves: 2_340_000,   // BTC total em exchanges (baixo = bullish)
  reserves_prev_30d: 2_420_000,
  reserves_delta_30d_pct: (2_340_000 - 2_420_000) / 2_420_000 * 100,
  signal: 'Saída líquida de 4.820 BTC em 24h — acumulação: holders retirando coins para cold wallet',
  quality: 'B',
  history: {
    '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: Math.round(-200 + (Math.random()-0.5)*800) })),
    '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: Math.round(-4000 + i*200 + (Math.random()-0.5)*1500) })),
    '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: Math.round(-1500 + (Math.random()-0.5)*3000) })),
  },
};

// Whale Transactions (>$1M e >$10M)
export const btcWhaleActivity = {
  txs_over_1m_24h: 1_842,    // transações > $1M nas últimas 24h
  txs_over_10m_24h: 284,     // transações > $10M
  txs_over_1m_7d_avg: 1_650, // média 7d
  txs_over_10m_7d_avg: 241,
  delta_1m_vs_avg: ((1842 - 1650) / 1650 * 100),  // +11.6% acima da média
  delta_10m_vs_avg: ((284 - 241) / 241 * 100),      // +17.8% acima da média
  signal: 'Transações de baleias +11.6% acima da média 7d — atividade institucional elevada',
  quality: 'B',
  history_1m: Array.from({length: 24}, (_, i) => ({ t: i, v: Math.round(1500 + Math.sin(i*0.5)*200 + (Math.random()-0.5)*150) })),
  history_10m: Array.from({length: 24}, (_, i) => ({ t: i, v: Math.round(230 + Math.sin(i*0.5)*30 + (Math.random()-0.5)*25) })),
};

// Realized Price & MVRV
export const btcRealizedMetrics = {
  realized_price: 46_840,    // custo médio de todas as moedas em circulação
  current_price: 84_298.70,
  mvrv_ratio: 84298.70 / 46840,   // Market Value / Realized Value ≈ 1.80
  mvrv_zscore: 1.84,               // Z-score — >7 = bolha histórica, <0 = fundo
  // Zonas MVRV: <1 = subvalorizado, 1–2.5 = neutro/acumulação, 2.5–3.7 = caro, >3.7 = extremo
  mvrv_zone: 'Neutro-Alto',
  mvrv_zone_color: '#f59e0b',
  realized_price_delta_30d: ((46840 - 44200) / 44200 * 100),  // +5.97%
  interpretation: 'MVRV 1.80 — mercado negociando 80% acima do custo realizado. Zona neutra-alta. Historicamente, MVRV > 3.5 antecede topos de ciclo.',
  quality: 'B',
  history_mvrv: {
    '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((1.65 + i*0.021 + (Math.random()-0.5)*0.04).toFixed(3)) })),
    '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((1.42 + i*0.013 + (Math.random()-0.5)*0.05).toFixed(3)) })),
  },
};

// Hash Rate & Dificuldade
export const btcHashRate = {
  hash_rate_eh: 842.4,      // EH/s (exahashes por segundo)
  hash_rate_prev_7d: 831.2,
  hash_rate_prev_30d: 798.5,
  delta_7d_pct: (842.4 - 831.2) / 831.2 * 100,
  delta_30d_pct: (842.4 - 798.5) / 798.5 * 100,
  difficulty: 113_756_612_395_875,
  difficulty_prev: 108_522_647_629_500,
  difficulty_adj_pct: (113756612395875 - 108522647629500) / 108522647629500 * 100,
  next_adj_est_pct: 2.8,   // estimativa próximo ajuste
  next_adj_blocks: 1247,   // blocos até próximo ajuste
  signal: 'Hash rate em ATH — mineradores expandindo. Dificuldade +4.8% no último ajuste.',
  quality: 'A',
  history: {
    '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: parseFloat((838 + i*0.22 + (Math.random()-0.5)*3).toFixed(1)) })),
    '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((798.5 + i*6.3 + (Math.random()-0.5)*8).toFixed(1)) })),
    '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((750 + i*3.1 + (Math.random()-0.5)*10).toFixed(1)) })),
  },
};

// OI por exchange (concentração de risco)
export const oiByExchange = [
  { exchange: 'Binance',  oi_b: 7.84, share_pct: 42.6, change_24h: 2.1 },
  { exchange: 'Bybit',    oi_b: 4.12, share_pct: 22.4, change_24h: 3.4 },
  { exchange: 'OKX',      oi_b: 2.98, share_pct: 16.2, change_24h: 1.8 },
  { exchange: 'CME',      oi_b: 2.21, share_pct: 12.0, change_24h: -0.4 },
  { exchange: 'Deribit',  oi_b: 0.84, share_pct: 4.6,  change_24h: 0.9 },
  { exchange: 'Outros',   oi_b: 0.39, share_pct: 2.2,  change_24h: 1.2 },
];

// Put/Call Ratio & Max Pain (Options)
export const btcOptionsExtended = {
  put_call_ratio_vol: 0.82,     // Por volume — <1 = mais calls = bullish
  put_call_ratio_oi: 0.94,      // Por OI
  put_call_ratio_7d_avg: 0.71,
  max_pain: 81_000,             // Strike onde mais opções expiram sem valor
  max_pain_distance_pct: ((81000 - 84298.70) / 84298.70 * 100),  // -3.91% abaixo do spot
  gamma_exposure_usd: -342_000_000,  // negativo = dealer short gamma = maior vol
  oi_by_strike: [
    { strike: 76000, call_oi: 1842, put_oi: 3210 },
    { strike: 78000, call_oi: 2134, put_oi: 2840 },
    { strike: 80000, call_oi: 3420, put_oi: 4120 },
    { strike: 82000, call_oi: 4210, put_oi: 3840 },
    { strike: 84000, call_oi: 5840, put_oi: 5120 },
    { strike: 86000, call_oi: 6420, put_oi: 2840 },
    { strike: 88000, call_oi: 5210, put_oi: 1820 },
    { strike: 90000, call_oi: 4840, put_oi: 1240 },
    { strike: 92000, call_oi: 3210, put_oi: 840 },
  ],
  quality: 'B',
};

// ─── FEAR & GREED ─────────────────────────────────────────────────────────────
export const fearGreed = {
  value: 58,
  classification: 'Greed',
  timestamp: new Date().toISOString(),
  history: [72, 68, 63, 71, 74, 65, 58],
  quality: 'A',
};

// ─── ECONOMIC CALENDAR ──────────────────────────────────────────────────────
export const econCalendar = [
  {
    id: 'ev001', title: 'CPI (Consumer Price Index)', agency: 'BLS',
    datetime_brt: new Date('2026-03-12T09:30:00'),
    tier: 1, url: 'https://www.bls.gov/cpi/',
    tags: ['inflation', 'CPI', 'Fed'], status: 'upcoming',
  },
  {
    id: 'ev002', title: 'FOMC Meeting Minutes', agency: 'Fed',
    datetime_brt: new Date('2026-03-19T15:00:00'),
    tier: 1, url: 'https://www.federalreserve.gov/monetarypolicy/',
    tags: ['FOMC', 'rates', 'Fed'], status: 'upcoming',
  },
  {
    id: 'ev003', title: 'Non-Farm Payroll (NFP)', agency: 'BLS',
    datetime_brt: new Date('2026-04-03T09:30:00'),
    tier: 1, url: 'https://www.bls.gov/ces/',
    tags: ['NFP', 'jobs', 'payroll'], status: 'upcoming',
  },
  {
    id: 'ev004', title: 'GDP Q4 Final', agency: 'BEA',
    datetime_brt: new Date('2026-03-26T09:30:00'),
    tier: 1, url: 'https://www.bea.gov/data/gdp/',
    tags: ['GDP', 'growth'], status: 'upcoming',
  },
  {
    id: 'ev005', title: 'Initial Jobless Claims', agency: 'BLS',
    datetime_brt: new Date('2026-03-13T09:30:00'),
    tier: 2, url: 'https://www.dol.gov/ui/data.pdf',
    tags: ['jobs', 'unemployment'], status: 'upcoming',
  },
  {
    id: 'ev006', title: 'PCE Price Index', agency: 'BEA',
    datetime_brt: new Date('2026-03-28T09:30:00'),
    tier: 1, url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index',
    tags: ['PCE', 'inflation', 'Fed'], status: 'upcoming',
  },
];

// ─── NEWS ────────────────────────────────────────────────────────────────────
export const topNews = [
  {
    title: 'Federal Reserve signals pause in rate cuts amid persistent inflation',
    source: 'Reuters', url: '#', published: new Date(Date.now() - 2 * 3600000),
    relevance: 0.94, sentiment: -0.12, tags: ['Fed', 'rates', 'inflation'],
  },
  {
    title: 'Bitcoin open interest hits $18.4B as institutional flows surge',
    source: 'Bloomberg', url: '#', published: new Date(Date.now() - 4 * 3600000),
    relevance: 0.91, sentiment: 0.31, tags: ['BTC', 'OI', 'institutional'],
  },
  {
    title: 'US Treasury yields climb on stronger-than-expected jobs data',
    source: 'WSJ', url: '#', published: new Date(Date.now() - 6 * 3600000),
    relevance: 0.88, sentiment: -0.08, tags: ['yields', 'jobs', 'macro'],
  },
  {
    title: 'Gold surges past $2,912 as dollar weakens; crypto markets mixed',
    source: 'FT', url: '#', published: new Date(Date.now() - 8 * 3600000),
    relevance: 0.85, sentiment: 0.22, tags: ['gold', 'USD', 'crypto'],
  },
  {
    title: 'VIX spikes above 22 as geopolitical tensions drive equity volatility',
    source: 'CNBC', url: '#', published: new Date(Date.now() - 12 * 3600000),
    relevance: 0.82, sentiment: -0.35, tags: ['VIX', 'volatility', 'equities'],
  },
];

// ─── RECENT ALERTS ──────────────────────────────────────────────────────────
export const recentAlerts = [
  {
    id: 'a001', type: 'SQUEEZE_WATCH', emoji: '⚡',
    title: 'BTC Long Squeeze Risk Elevated',
    asset: 'BTCUSDT', score: 68, prob: 0.62, conf: 0.74,
    quality: 'A', grade: 'A',
    created_at: new Date(Date.now() - 25 * 60000),
    cooldown_min: 60,
    metrics: { funding: '+0.071%', OI_delta: '+2.34%', LS_ratio: '1.23' },
    dedupe_key: 'SQUEEZE_WATCH:BTCUSDT:long_crowding',
    run_id: 'run_20260307_142500',
  },
  {
    id: 'a002', type: 'MACRO_EVENT', emoji: '📅',
    title: 'CPI Release in 5 Days — Tier 1',
    asset: 'MACRO', score: 55, prob: 0.55, conf: 0.90,
    quality: 'A', grade: 'A',
    created_at: new Date(Date.now() - 3 * 3600000),
    cooldown_min: 360,
    metrics: { event: 'CPI', agency: 'BLS', tier: 'Tier-1' },
    dedupe_key: 'MACRO_EVENT:CPI:2026-03-12',
    run_id: 'run_20260307_110000',
  },
  {
    id: 'a003', type: 'OPTIONS_VOL', emoji: '📊',
    title: 'BTC IV ATM +1.8pp vs Yesterday',
    asset: 'BTC-OPTIONS', score: 61, prob: 0.58, conf: 0.61,
    quality: 'B', grade: 'B',
    created_at: new Date(Date.now() - 5 * 3600000),
    cooldown_min: 120,
    metrics: { iv_atm: '62.4%', skew: '-3.1pp (put skew)', regime: 'elevated_vol' },
    dedupe_key: 'OPTIONS_VOL:BTC:iv_shift',
    run_id: 'run_20260307_090000',
  },
];

// ─── GLOBAL RISK SCORE ──────────────────────────────────────────────────────
export function computeGlobalRiskScore() {
  const scores = { futures: 68, spot: 54, options: 65, macro: 52 };
  const weights = { futures: 0.35, spot: 0.25, options: 0.10, macro: 0.30 };
  let num = 0, den = 0;
  for (const k of Object.keys(scores)) {
    num += scores[k] * weights[k];
    den += weights[k];
  }
  const g = num / den;
  const prob = sigmoid((g - 50) / THRESHOLDS.K_DEFAULT);
  return {
    score: Math.round(g),
    prob: Math.round(prob * 100),
    regime: g >= THRESHOLDS.GLOBAL_RISKON_SCORE ? 'RISK-ON' :
            g <= THRESHOLDS.GLOBAL_RISKOFF_SCORE ? 'RISK-OFF' : 'NEUTRAL',
    module_scores: scores,
  };
}

export const globalRisk = computeGlobalRiskScore();

// ─── LIQUIDITY HEATMAP ───────────────────────────────────────────────────────
export const liquidityBins = [
  { label: '0–0.1%',  bid: 1_046_080, ask: 1_280_640,  bid_notional: 1_046_080,  ask_notional: 1_280_640 },
  { label: '0.1–0.2%',bid: 2_370_060, ask: 2_674_340,  bid_notional: 2_370_060,  ask_notional: 2_674_340 },
  { label: '0.2–0.5%',bid: 3_838_080, ask: 4_411_320,  bid_notional: 3_838_080,  ask_notional: 4_411_320 },
  { label: '0.5–1%',  bid: 5_657_760, ask: 7_460_160,  bid_notional: 5_657_760,  ask_notional: 7_460_160 },
  { label: '1–2%',    bid: 7_499_280, ask: 9_466_400,  bid_notional: 7_499_280,  ask_notional: 9_466_400 },
  { label: '2–5%',    bid: 11_339_250,ask: 16_744_040, bid_notional: 11_339_250, ask_notional: 16_744_040},
];

// ─── BTC DOMINANCE ───────────────────────────────────────────────────────────
export const btcDominance = {
  value: 58.4,       // %
  prev_7d: 55.1,
  prev_30d: 52.8,
  delta_7d: 58.4 - 55.1,
  delta_30d: 58.4 - 52.8,
  trend: 'rising',   // rising = capital fluindo para BTC (risk-off altcoins)
  signal: 'BTC acumulando dominância — altcoins sob pressão relativa',
  quality: 'A',
};

// ─── LIQUIDAÇÕES 24H ─────────────────────────────────────────────────────────
export const liquidations24h = {
  total_usd: 312_450_000,
  longs_usd: 224_180_000,   // 71.7% longs
  shorts_usd: 88_270_000,   // 28.3% shorts
  largest_single: 4_200_000,
  btc_longs_usd: 98_400_000,
  btc_shorts_usd: 31_200_000,
  signal: 'Predominância de liquidações de longs — pressão vendedora residual',
  quality: 'B',  // fonte: Coinglass
};

// ─── STABLECOIN SUPPLY ────────────────────────────────────────────────────────
export const stablecoinSupply = {
  usdt_supply_b: 142.8,   // bilhões
  usdc_supply_b: 58.3,
  total_b: 201.1,
  prev_7d_b: 197.4,
  prev_30d_b: 189.2,
  delta_7d_pct: (201.1 - 197.4) / 197.4 * 100,
  delta_30d_pct: (201.1 - 189.2) / 189.2 * 100,
  signal: 'Supply crescendo +1.9% em 7d — capital entrando no ecossistema',
  quality: 'A',
};

// ─── YIELD CURVE SPREAD ────────────────────────────────────────────────────────
// Calculado a partir de macroBoard: 10Y - 2Y
export const yieldCurveSpread = {
  spread_bp: (4.37 - 3.90) * 100,   // 47bp — curva normal (positiva)
  prev_7d_bp: (4.44 - 3.97) * 100,
  prev_30d_bp: (4.28 - 4.02) * 100,
  regime: 'normal',   // 'normal' | 'flat' | 'inverted'
  signal: 'Curva positiva (+47bp) — sem sinal recessivo imediato',
  recession_watch: false,
  quality: 'A',
};

// ─── CORRELAÇÕES BTC — histórico por janela ───────────────────────────────────
// Gera pontos históricos simulados para cada par
function genCorrHistory(base, volatility, points) {
  return Array.from({ length: points }, (_, i) => {
    const drift = (Math.random() - 0.5) * volatility;
    return parseFloat(Math.min(0.99, Math.max(-0.99, base + drift * (1 - i / points))).toFixed(2));
  }).reverse();
}

export const btcCorrelations = {
  pairs: [
    { asset: 'SPX',  label: 'S&P 500',   color: '#60a5fa', corr_1d: 0.68, corr_1w: 0.72, corr_1m: 0.65, history_1d: genCorrHistory(0.68, 0.15, 24), history_1w: genCorrHistory(0.70, 0.12, 7),  history_1m: genCorrHistory(0.66, 0.10, 30) },
    { asset: 'GOLD', label: 'Gold',       color: '#f59e0b', corr_1d: 0.31, corr_1w: 0.18, corr_1m: 0.24, history_1d: genCorrHistory(0.31, 0.18, 24), history_1w: genCorrHistory(0.22, 0.14, 7),  history_1m: genCorrHistory(0.25, 0.12, 30) },
    { asset: 'DXY',  label: 'DXY',        color: '#ef4444', corr_1d:-0.54, corr_1w:-0.48, corr_1m:-0.51, history_1d: genCorrHistory(-0.54, 0.14, 24),history_1w: genCorrHistory(-0.50, 0.11, 7), history_1m: genCorrHistory(-0.51, 0.09, 30) },
    { asset: 'VIX',  label: 'VIX',        color: '#a78bfa', corr_1d:-0.61, corr_1w:-0.55, corr_1m:-0.58, history_1d: genCorrHistory(-0.61, 0.16, 24),history_1w: genCorrHistory(-0.57, 0.12, 7), history_1m: genCorrHistory(-0.58, 0.10, 30) },
    { asset: 'HY',   label: 'HY Bonds',   color: '#10b981', corr_1d: 0.44, corr_1w: 0.39, corr_1m: 0.41, history_1d: genCorrHistory(0.44, 0.13, 24), history_1w: genCorrHistory(0.41, 0.10, 7),  history_1m: genCorrHistory(0.41, 0.08, 30) },
  ],
  quality: 'B',
};

// ─── HISTÓRICO — BTC Dominance ────────────────────────────────────────────────
export const btcDominanceHistory = {
  '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: parseFloat((58.4 - (23-i)*0.04 + (Math.random()-0.5)*0.3).toFixed(2)) })),
  '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((55.1 + i*0.47 + (Math.random()-0.5)*0.4).toFixed(2)) })),
  '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((52.8 + i*0.187 + (Math.random()-0.5)*0.5).toFixed(2)) })),
};

// ─── HISTÓRICO — Stablecoin Supply ────────────────────────────────────────────
export const stablecoinHistory = {
  '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: parseFloat((201.1 - (23-i)*0.012 + (Math.random()-0.5)*0.08).toFixed(2)) })),
  '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((197.4 + i*0.53 + (Math.random()-0.5)*0.15).toFixed(2)) })),
  '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((189.2 + i*0.397 + (Math.random()-0.5)*0.3).toFixed(2)) })),
};

// ─── HISTÓRICO — Yield Curve Spread (bp) ─────────────────────────────────────
export const yieldCurveHistory = {
  '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: parseFloat((47.0 - (23-i)*0.04 + (Math.random()-0.5)*1.5).toFixed(1)) })),
  '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: parseFloat((47.0 + i*0.10 + (Math.random()-0.5)*1.2).toFixed(1)) })),
  '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: parseFloat((26.0 + i*0.70 + (Math.random()-0.5)*1.5).toFixed(1)) })),
};

// ─── HISTÓRICO — HY Credit Spread (bp) ───────────────────────────────────────
export const creditSpreadHistory = {
  '1d': Array.from({length: 24}, (_, i) => ({ t: i, v: Math.round(342 - (23-i)*0.5 + (Math.random()-0.5)*4) })),
  '1w': Array.from({length: 7},  (_, i) => ({ t: i, v: Math.round(318 + i*3.4 + (Math.random()-0.5)*3) })),
  '1m': Array.from({length: 30}, (_, i) => ({ t: i, v: Math.round(285 + i*1.9 + (Math.random()-0.5)*4) })),
};

// ─── HY CREDIT SPREAD ─────────────────────────────────────────────────────────
export const creditSpread = {
  hy_spread_bp: 342,    // High Yield spread (OAS)
  ig_spread_bp: 98,     // Investment Grade spread
  prev_7d_hy: 318,
  prev_30d_hy: 285,
  delta_7d_bp: 342 - 318,   // +24bp em 7d — widening = risco sistêmico crescendo
  delta_30d_bp: 342 - 285,  // +57bp em 30d
  regime: 'widening',       // 'tightening' | 'stable' | 'widening'
  signal: 'HY spread widening +57bp em 1M — sinal de stress de crédito',
  quality: 'B',
};

// ─── MACRO HISTÓRICO — Mini sparklines com janela 1D/1W/1M ──────────────────
function genMacroHistory(current, prev7d, prev30d, points, window) {
  if (window === '1d') {
    const start = current * 0.9985;
    return Array.from({ length: 24 }, (_, i) => ({ t: i, v: parseFloat((start + (current - start) * (i / 23) + (Math.random() - 0.5) * current * 0.001).toFixed(2)) }));
  }
  if (window === '1w') {
    return Array.from({ length: 7 }, (_, i) => ({ t: i, v: parseFloat((prev7d + (current - prev7d) * (i / 6) + (Math.random() - 0.5) * current * 0.003).toFixed(2)) }));
  }
  return Array.from({ length: 30 }, (_, i) => ({ t: i, v: parseFloat((prev30d + (current - prev30d) * (i / 29) + (Math.random() - 0.5) * current * 0.005).toFixed(2)) }));
}

export const macroHistory = {
  SP500: {
    '1d': genMacroHistory(7398.93, 7337.50, 6987.40, 24, '1d'),
    '1w': genMacroHistory(7398.93, 7168.20, 6987.40, 7, '1w'),
    '1m': genMacroHistory(7398.93, 7168.20, 6987.40, 30, '1m'),
  },
  DXY: {
    '1d': genMacroHistory(118.5, 119.20, 122.80, 24, '1d'),
    '1w': genMacroHistory(118.5, 120.40, 122.80, 7, '1w'),
    '1m': genMacroHistory(118.5, 120.40, 122.80, 30, '1m'),
  },
  GOLD: {
    '1d': genMacroHistory(4715.0, 4678.0, 4320.0, 24, '1d'),
    '1w': genMacroHistory(4715.0, 4580.0, 4320.0, 7, '1w'),
    '1m': genMacroHistory(4715.0, 4580.0, 4320.0, 30, '1m'),
  },
  VIX: {
    '1d': genMacroHistory(17.19, 17.42, 21.60, 24, '1d'),
    '1w': genMacroHistory(17.19, 18.85, 21.60, 7, '1w'),
    '1m': genMacroHistory(17.19, 18.85, 21.60, 30, '1m'),
  },
  US10Y: {
    '1d': genMacroHistory(4.37, 4.40, 4.28, 24, '1d'),
    '1w': genMacroHistory(4.37, 4.44, 4.28, 7, '1w'),
    '1m': genMacroHistory(4.37, 4.44, 4.28, 30, '1m'),
  },
  US2Y: {
    '1d': genMacroHistory(3.90, 3.93, 4.02, 24, '1d'),
    '1w': genMacroHistory(3.90, 3.97, 4.02, 7, '1w'),
    '1m': genMacroHistory(3.90, 3.97, 4.02, 30, '1m'),
  },
};

// ─── AI ANALYSIS ─────────────────────────────────────────────────────────────
// Structured AI recommendation per asset / module
export const aiAnalysis = {
  generated_at: new Date(),
  model: 'quant-risk-v2',
  overall: {
    recommendation: '',
    direction: 'bearish_bias',
    confidence: 0.71,
    probability_correction: 0.62,
    timeframe: '4h–24h',
    trigger: 'Funding > 0.08% OR price -2% from $84,300',
    rationale: 'Funding positivo elevado (+0.071%) com OI crescendo +2.34% 1D e +13.7% 1W indica posicionamento comprado sobrecarregado. O VIX em 22.14 (+14.1% no mês) sinaliza ambiente de risco adverso. Yield curve positiva porém em flattening (+28.1bp). Probabilidade de flush de longs nos próximos ciclos de funding é 62% baseado em dados históricos.',
    bull_case: 'CVD positivo (+58K) e Fear & Greed em 58 (Greed) podem sustentar o preço acima de $83,000 no curto prazo. Institutional flow forte (OI +30.6% em 1M).',
    bear_case: 'Funding persistente acima de 0.06% tende a se auto-corrigir. VIX escalando. DXY queda de 3.4% em 1M pode reverter. IV ATM elevada em 62.4% com put skew ativo.',
  },
  modules: {
    derivatives: {
      score: 68,
      signal: 'LONG FLUSH RISCO ELEVADO',
      direction: 'bearish',
      confidence: 0.74,
      probability: 0.62,
      timeframe: '4h–12h',
      trigger: 'Funding > 0.08% por 2 ciclos consecutivos OU OI delta 1H > +0.5%',
      analysis: 'Funding rate atual +0.0712% (1.4× acima da referência). OI expandiu +2.34% no dia, +13.7% na semana e +30.6% no mês — nível de posicionamento agressivo. L/S ratio 1.23 confirma bias comprado. Histórico indica flush quando funding fica acima de 0.08% com OI crescendo — janela de risco 4-12h.',
    },
    spot: {
      score: 54,
      signal: 'NEUTRO / LEVE BULLISH INTRADAY',
      direction: 'neutral',
      confidence: 0.58,
      probability: 0.54,
      timeframe: '1h–4h',
      trigger: 'CVD vira negativo OU Ret 1H < -0.5%',
      analysis: 'CVD intraday positivo (+58K) indica pressão compradora no curto prazo. Porém, desempenho semanal +8.42% cria resistência por realização de lucro. Ret 4H negativo (-1.24%) sugere pressão de distribuição. Sinal misto: flow curto prazo bullish, mas estrutura 1W overextended.',
    },
    options: {
      score: 65,
      signal: 'HEDGING ATIVO — CAUTELA',
      direction: 'bearish_bias',
      confidence: 0.61,
      probability: 0.58,
      timeframe: '1d–7d',
      trigger: 'IV ATM > 70% OU Skew < -5pp',
      analysis: 'IV ATM em 62.4% — regime de volatilidade elevada. Put skew de -3.1pp indica mercado pagando prêmio por proteção de downside. Delta 1M da IV +5.4pp confirma tendência de alta de volatilidade no mês. Mercado está se hedgeando ativamente — sinal de que grandes players antecipam movimento direcional.',
    },
    macro: {
      score: 52,
      signal: 'AMBIENTE MISTO — MONITORAR',
      direction: 'neutral',
      confidence: 0.67,
      probability: 0.52,
      timeframe: '1d–7d',
      trigger: 'CPI > estimativa OU Fed hawkish surprise em 19/Mar',
      analysis: 'VIX +14.1% no mês (15.8→22.1) indica piora do apetite a risco. DXY caindo 3.4% no mês é positivo para BTC historicamente. S&P +5.7% no mês mostra resiliência equity, mas FOMC em 19/Mar é risco binário. Yield curve positiva (+28.1bp) — sem sinal recessivo imediato. CPI em 12/Mar é o próximo gatilho macro crítico.',
    },
  },
};
