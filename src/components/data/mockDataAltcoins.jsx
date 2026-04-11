// ─── ALTCOINS & ALT SEASON — Mock Data ────────────────────────────────────────

// ─── ALT SEASON INDEX (0-100) ─────────────────────────────────────────────────
// < 25 = BTC Season | 25-75 = Mixed | > 75 = Alt Season
export const altSeasonIndex = {
  value: 38,
  label: 'BTC Season',      // computed from value
  change_7d: -11,
  change_30d: -24,
  history_30d: Array.from({ length: 30 }, (_, i) => ({
    day: i,
    value: Math.max(10, Math.min(90, 62 - i * 0.8 + (Math.sin(i * 0.4) * 6) + (Math.random() - 0.5) * 5)),
  })),
  signal: 'BTC Season — Capital rotacionando para BTC. Altcoins underperformando.',
  top_outperformers: 4,   // alts outperforming BTC (of top 100) last 90d
};

// ─── ETH DOMINANCE ────────────────────────────────────────────────────────────
export const ethDominance = {
  value: 14.8,
  prev_7d: 15.6,
  prev_30d: 17.2,
  delta_7d: 14.8 - 15.6,
  delta_30d: 14.8 - 17.2,
  trend: 'falling',
};

// ─── TOP ALTS vs BTC ──────────────────────────────────────────────────────────
export const topAltcoins = [
  { rank: 1,  symbol: 'ETH',  name: 'Ethereum',     mcap_b: 358.4, ret_7d: -3.2,  ret_30d: -18.4, ret_90d: -28.1, vs_btc_7d: -2.8,  vs_btc_30d: -14.2, sector: 'L1',        color: '#627eea' },
  { rank: 2,  symbol: 'BNB',  name: 'BNB Chain',    mcap_b: 89.1,  ret_7d: +0.8,  ret_30d: -5.2,  ret_90d: -11.4, vs_btc_7d: +1.2,  vs_btc_30d: -1.0,  sector: 'L1',        color: '#f0b90b' },
  { rank: 3,  symbol: 'SOL',  name: 'Solana',       mcap_b: 74.2,  ret_7d: -5.8,  ret_30d: -32.1, ret_90d: -48.2, vs_btc_7d: -5.4,  vs_btc_30d: -27.9, sector: 'L1',        color: '#9945ff' },
  { rank: 4,  symbol: 'XRP',  name: 'XRP',          mcap_b: 124.8, ret_7d: +2.4,  ret_30d: -8.1,  ret_90d: +12.4, vs_btc_7d: +2.8,  vs_btc_30d: -3.9,  sector: 'Payments',  color: '#00aae4' },
  { rank: 5,  symbol: 'ADA',  name: 'Cardano',      mcap_b: 28.4,  ret_7d: -8.2,  ret_30d: -28.4, ret_90d: -42.1, vs_btc_7d: -7.8,  vs_btc_30d: -24.2, sector: 'L1',        color: '#0033ad' },
  { rank: 6,  symbol: 'AVAX', name: 'Avalanche',    mcap_b: 14.1,  ret_7d: -4.1,  ret_30d: -38.2, ret_90d: -55.4, vs_btc_7d: -3.7,  vs_btc_30d: -34.0, sector: 'L1',        color: '#e84142' },
  { rank: 7,  symbol: 'DOGE', name: 'Dogecoin',     mcap_b: 38.2,  ret_7d: +5.1,  ret_30d: -12.4, ret_90d: -18.2, vs_btc_7d: +5.5,  vs_btc_30d: -8.2,  sector: 'Meme',      color: '#c2a633' },
  { rank: 8,  symbol: 'LINK', name: 'Chainlink',    mcap_b: 11.8,  ret_7d: -2.1,  ret_30d: -21.2, ret_90d: -30.4, vs_btc_7d: -1.7,  vs_btc_30d: -17.0, sector: 'Oracle',    color: '#2a5ada' },
  { rank: 9,  symbol: 'DOT',  name: 'Polkadot',     mcap_b: 8.4,   ret_7d: -9.4,  ret_30d: -41.2, ret_90d: -58.2, vs_btc_7d: -9.0,  vs_btc_30d: -37.0, sector: 'L0',        color: '#e6007a' },
  { rank: 10, symbol: 'MATIC',name: 'Polygon',      mcap_b: 5.8,   ret_7d: -6.8,  ret_30d: -44.1, ret_90d: -62.4, vs_btc_7d: -6.4,  vs_btc_30d: -39.9, sector: 'L2',        color: '#8247e5' },
  { rank: 11, symbol: 'OP',   name: 'Optimism',     mcap_b: 3.2,   ret_7d: -7.2,  ret_30d: -46.8, ret_90d: -64.1, vs_btc_7d: -6.8,  vs_btc_30d: -42.6, sector: 'L2',        color: '#ff0420' },
  { rank: 12, symbol: 'ARB',  name: 'Arbitrum',     mcap_b: 2.8,   ret_7d: -8.4,  ret_30d: -48.2, ret_90d: -68.4, vs_btc_7d: -8.0,  vs_btc_30d: -44.0, sector: 'L2',        color: '#28a0f0' },
];

// ─── SECTOR ROTATION ──────────────────────────────────────────────────────────
export const sectorRotation = [
  { sector: 'BTC',      ret_7d: +0.4,  ret_30d: +4.2,  capital_flow_7d_b: +2.4,  dominance: 58.4 },
  { sector: 'L1',       ret_7d: -4.8,  ret_30d: -24.1, capital_flow_7d_b: -3.8,  dominance: 21.2 },
  { sector: 'L2',       ret_7d: -7.6,  ret_30d: -48.0, capital_flow_7d_b: -1.2,  dominance: 4.1  },
  { sector: 'DeFi',     ret_7d: -3.2,  ret_30d: -31.4, capital_flow_7d_b: -0.8,  dominance: 3.8  },
  { sector: 'Payments', ret_7d: +2.1,  ret_30d: -8.4,  capital_flow_7d_b: +0.6,  dominance: 5.2  },
  { sector: 'Oracle',   ret_7d: -2.4,  ret_30d: -21.8, capital_flow_7d_b: -0.4,  dominance: 1.8  },
  { sector: 'Meme',     ret_7d: +4.8,  ret_30d: -12.1, capital_flow_7d_b: +0.3,  dominance: 2.4  },
  { sector: 'GameFi',   ret_7d: -11.2, ret_30d: -58.4, capital_flow_7d_b: -0.2,  dominance: 0.8  },
  { sector: 'AI',       ret_7d: -1.8,  ret_30d: -28.4, capital_flow_7d_b: +0.1,  dominance: 1.4  },
  { sector: 'Stables',  ret_7d: 0.0,   ret_30d: 0.0,   capital_flow_7d_b: +2.8,  dominance: 8.1  },
];

// ─── DOMINANCE HISTORY (90d) ─────────────────────────────────────────────────
export const dominanceHistory = Array.from({ length: 90 }, (_, i) => ({
  day: i,
  btc: parseFloat((52.8 + (i / 90) * 5.6 + Math.sin(i * 0.15) * 1.2 + (Math.random() - 0.5) * 0.8).toFixed(2)),
  eth: parseFloat((17.2 - (i / 90) * 2.4 - Math.sin(i * 0.1) * 0.8 + (Math.random() - 0.5) * 0.5).toFixed(2)),
  others: parseFloat((30.0 - (i / 90) * 3.2 + (Math.random() - 0.5) * 1.0).toFixed(2)),
}));

// ─── BTC.D vs ETH.D RELATIVE (30d) ────────────────────────────────────────────
export const btcEthDomRatio = dominanceHistory.slice(-30).map(d => ({
  day: d.day,
  ratio: parseFloat((d.btc / d.eth).toFixed(3)),
}));

// ─── ALTCOIN SEASON PHASES ─────────────────────────────────────────────────────
export const seasonPhases = [
  { label: 'Alt Season',  range: '75–100', desc: '>75% das top 100 alts superam BTC em 90d', color: '#10b981', active: false },
  { label: 'Mixed',       range: '25–75',  desc: 'Rotação mista — algumas alts ganham, outras perdem', color: '#f59e0b', active: false },
  { label: 'BTC Season',  range: '0–25',   desc: '<25% das alts superam BTC — Bitcoin lidera', color: '#ef4444', active: true  },
];

// ─── SPOT SESSIONS (SpotFlow) ─────────────────────────────────────────────────
// Usado no SpotFlow.jsx para análise por sessão de mercado
export const spotSessions = {
  asia: {
    label: 'Ásia',
    utc: '00:00–08:00',
    brt: '21:00–05:00',
    color: '#f59e0b',
    cvd: -184200,
    volume_btc: 18240,
    volume_usd_b: 1.54,
    price_move_pct: -0.82,
    taker_buy_pct: 47.2,
    dominant_side: 'sell',
    signal: 'Pressão vendedora asiática — CVD negativo consistente',
  },
  europe: {
    label: 'Europa',
    utc: '08:00–16:00',
    brt: '05:00–13:00',
    color: '#3b82f6',
    cvd: +312800,
    volume_btc: 31480,
    volume_usd_b: 2.65,
    price_move_pct: +1.24,
    taker_buy_pct: 54.8,
    dominant_side: 'buy',
    signal: 'Sessão europeia com absorção — CVD positivo, acumulação institucional',
  },
  us: {
    label: 'EUA',
    utc: '16:00–24:00',
    brt: '13:00–21:00',
    color: '#a78bfa',
    cvd: +228400,
    volume_btc: 44120,
    volume_usd_b: 3.72,
    price_move_pct: +0.61,
    taker_buy_pct: 52.1,
    dominant_side: 'buy',
    signal: 'Maior volume — EUA dominando com bias comprador moderado',
  },
};
