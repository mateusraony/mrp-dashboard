// ─── STABLECOIN FLOW TRACKER — MOCK DATA ────────────────────────────────────
// Minting / Burning USDT e USDC em Ethereum e Arbitrum
// Correlação com volume de compra nas exchanges

function seed(n) { return (Math.sin(n * 9301 + 49297) % 1 + 1) / 2; }
function rng(i, base, vol) { return parseFloat((base + (seed(i) - 0.5) * vol * 2).toFixed(2)); }

// ─── EMISSÕES DIÁRIAS (30 dias) ─────────────────────────────────────────────
export const dailyMintBurn = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(Date.now() - (29 - i) * 86400000);
  const label = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const usdt_mint = rng(i,     420,  380);
  const usdt_burn = rng(i + 100, 310, 280);
  const usdc_mint = rng(i + 200, 280, 240);
  const usdc_burn = rng(i + 300, 190, 170);
  const btc_vol   = rng(i + 400, 28.4, 12);
  return {
    label,
    usdt_mint: Math.max(10, usdt_mint),
    usdt_burn: Math.max(5,  usdt_burn),
    usdt_net:  parseFloat((usdt_mint - usdt_burn).toFixed(2)),
    usdc_mint: Math.max(10, usdc_mint),
    usdc_burn: Math.max(5,  usdc_burn),
    usdc_net:  parseFloat((usdc_mint - usdc_burn).toFixed(2)),
    total_net: parseFloat((usdt_mint - usdt_burn + usdc_mint - usdc_burn).toFixed(2)),
    btc_buy_vol_b: Math.max(8, btc_vol),   // volume de compra BTC no dia (USD bi)
  };
});

// Calcular média 7 dias
const last7 = dailyMintBurn.slice(-7);
const avg7d_net = parseFloat((last7.reduce((s, d) => s + d.total_net, 0) / 7).toFixed(2));

// ─── SNAPSHOT ATUAL ──────────────────────────────────────────────────────────
export const stablecoinSnapshot = {
  updated_at: new Date(),
  usdt: {
    total_supply_b: 142.8,
    arb_supply_b:   18.4,
    eth_supply_b:   98.2,
    mint_24h_m:     284.6,
    burn_24h_m:     198.3,
    net_24h_m:      286.3,
    mint_7d_m:      1_842,
    burn_7d_m:      1_284,
    net_7d_m:       558,
    avg_daily_mint_7d: 263,
    color: '#10b981',
  },
  usdc: {
    total_supply_b: 58.3,
    arb_supply_b:   12.1,
    eth_supply_b:   38.4,
    mint_24h_m:     182.4,
    burn_24h_m:     148.1,
    net_24h_m:      134.3,
    mint_7d_m:      1_204,
    burn_7d_m:      892,
    net_7d_m:       312,
    avg_daily_mint_7d: 172,
    color: '#3b82f6',
  },
  total_supply_b: 201.1,
  total_net_24h_m: 420.6,
  avg7d_net_m: avg7d_net,
  sigma_vs_7d: parseFloat(((420.6 - avg7d_net) / Math.max(1, Math.abs(avg7d_net)) * 100).toFixed(1)),
  quality: 'B',
};

// ─── GRANDES EMISSÕES (whale mint events) ───────────────────────────────────
export const largeMintEvents = [
  {
    id: 'ev001', token: 'USDT', chain: 'Ethereum', amount_m: 500,
    timestamp: new Date(Date.now() - 2 * 3600000),
    tx_hash: '0x1a2b...3c4d', issuer: 'Tether Treasury',
    corr_btc_move_pct: 2.14,
    corr_buy_vol_m: 380,
    signal: 'bullish',
    note: '$500M de USDT emitido na Ethereum — seguido de +2.14% em BTC em 4h. Volume de compra +$380M.',
  },
  {
    id: 'ev002', token: 'USDC', chain: 'Arbitrum', amount_m: 250,
    timestamp: new Date(Date.now() - 18 * 3600000),
    tx_hash: '0x5e6f...7a8b', issuer: 'Circle',
    corr_btc_move_pct: 0.84,
    corr_buy_vol_m: 142,
    signal: 'neutral',
    note: '$250M USDC no Arbitrum — correlação fraca com BTC (+0.84%). Provável operação DeFi.',
  },
  {
    id: 'ev003', token: 'USDT', chain: 'Ethereum', amount_m: 1000,
    timestamp: new Date(Date.now() - 2 * 86400000),
    tx_hash: '0x9c0d...1e2f', issuer: 'Tether Treasury',
    corr_btc_move_pct: 3.91,
    corr_buy_vol_m: 820,
    signal: 'bullish',
    note: '$1B de USDT — maior emissão em 30 dias. BTC subiu +3.91% nas próximas 6h. Compra institucional.',
  },
  {
    id: 'ev004', token: 'USDC', chain: 'Ethereum', amount_m: 400,
    timestamp: new Date(Date.now() - 4 * 86400000),
    tx_hash: '0x3g4h...5i6j', issuer: 'Circle',
    corr_btc_move_pct: -1.24,
    corr_buy_vol_m: 0,
    signal: 'bearish',
    note: '$400M USDC + burn simultâneo em outros wallets — rebalanceamento institucional. BTC caiu -1.24%.',
  },
];

// ─── BURN EVENTS ─────────────────────────────────────────────────────────────
export const largeBurnEvents = [
  {
    id: 'bv001', token: 'USDT', chain: 'Ethereum', amount_m: 300,
    timestamp: new Date(Date.now() - 6 * 3600000),
    note: 'Queima de $300M USDT — saída de capital, pressão vendedora esperada.',
  },
  {
    id: 'bv002', token: 'USDC', chain: 'Arbitrum', amount_m: 180,
    timestamp: new Date(Date.now() - 30 * 3600000),
    note: 'Queima de $180M USDC Arbitrum — provável retirada de liquidez DeFi.',
  },
];

// ─── ANOMALY ALERTS ──────────────────────────────────────────────────────────
export const stablecoinAnomalies = [
  {
    id: 'an001', severity: 'HIGH', token: 'USDT',
    title: 'Mint 24h +287% acima da média 7D',
    value_m: 284.6, avg7d_m: 73.4,
    deviation_pct: 287.7,
    triggered_at: new Date(Date.now() - 2 * 3600000),
    message: 'Emissão de USDT em 24h está 287% acima da média dos últimos 7 dias. Histórico: eventos similares antecederam rally de +4% a +8% em BTC com lag de 6-48h.',
    action: 'Monitorar acumulação em exchanges. Correlacionar com CVD.',
  },
  {
    id: 'an002', severity: 'MEDIUM', token: 'USDC',
    title: 'Burn Arbitrum incomum — saída DeFi',
    value_m: 180, avg7d_m: 48.2,
    deviation_pct: 273.4,
    triggered_at: new Date(Date.now() - 30 * 3600000),
    message: 'Burn de USDC no Arbitrum 273% acima da média. Possível saída de liquidez de protocolo DeFi ou rebalanceamento de yield farm.',
    action: 'Checar TVL do Arbitrum. Sinal ambíguo — pode ser neutro.',
  },
];

// ─── BY CHAIN — supply breakdown ─────────────────────────────────────────────
export const supplyByChain = [
  { chain: 'Ethereum', usdt_b: 98.2, usdc_b: 38.4, total_b: 136.6, share_pct: 67.9, color: '#627eea' },
  { chain: 'Arbitrum', usdt_b: 18.4, usdc_b: 12.1, total_b: 30.5,  share_pct: 15.2, color: '#28a0f0' },
  { chain: 'Tron',     usdt_b: 22.8, usdc_b: 0,    total_b: 22.8,  share_pct: 11.3, color: '#ef0027' },
  { chain: 'Solana',   usdt_b: 3.4,  usdc_b: 7.8,  total_b: 11.2,  share_pct: 5.6,  color: '#9945ff' },
];

// ─── CORRELATION SERIES (mint net vs BTC price 30d) ─────────────────────────
export const mintVsBtcCorr = {
  pearson_30d: 0.68,
  pearson_7d: 0.81,
  lag_hours_optimal: 12, // net mint leva ~12h para se refletir em preço
  note: 'Correlação de 0.81 entre mint líquido e preço BTC com lag de ~12h. Emissões grandes tendem a preceder alta.',
};