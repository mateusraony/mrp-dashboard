// ─── PORTFOLIO MOCK DATA ──────────────────────────────────────────────────────
import { btcFutures, btcOptions } from './mockData';
import { futuresBasis, ivRank, optionsTakerFlow } from './mockDataExtended';

export const SPOT_PRICE = 84298.70;

// ─── POSIÇÕES PADRÃO (pré-carregadas) ────────────────────────────────────────
export const defaultPositions = [
  {
    id: 'p1', type: 'spot', asset: 'BTC Spot',
    size: 1.5, side: 'long', entry_price: 81200,
    current_price: SPOT_PRICE,
    delta: 1.0, gamma: 0, theta: 0, vega: 0,
    color: '#f59e0b',
  },
  {
    id: 'p2', type: 'futures_perp', asset: 'BTC Perp (Binance)',
    size: 0.5, side: 'long', entry_price: 83800,
    current_price: SPOT_PRICE,
    delta: 1.0, gamma: 0, theta: 0, vega: 0,
    color: '#3b82f6',
  },
  {
    id: 'p3', type: 'futures_dated', asset: 'BTC-Jun-26 Futures',
    size: 1.0, side: 'short', entry_price: 87240,
    current_price: 87240,
    delta: -1.0, gamma: 0, theta: 0, vega: 0,
    color: '#ef4444',
  },
  {
    id: 'p4', type: 'option_call', asset: 'BTC Call $86K Mar-28',
    size: 2, side: 'long', entry_price: 2840, strike: 86000,
    expiry_days: 18,
    current_price: SPOT_PRICE,
    // Black-Scholes approximations
    delta: 0.42, gamma: 0.0000028, theta: -42, vega: 180,
    iv: 0.61,
    color: '#10b981',
  },
  {
    id: 'p5', type: 'option_put', asset: 'BTC Put $82K Mar-28',
    size: 1, side: 'short', entry_price: 1840, strike: 82000,
    expiry_days: 18,
    current_price: SPOT_PRICE,
    delta: 0.28, gamma: 0.0000024, theta: 40, vega: -155,
    iv: 0.67,
    color: '#a78bfa',
  },
  {
    id: 'p6', type: 'cash', asset: 'USD Cash / Stablecoin',
    size: 50000, side: 'long', entry_price: 1,
    current_price: 1,
    delta: 0, gamma: 0, theta: 0, vega: 0,
    color: '#06b6d4',
  },
];

// ─── GREEKS COMPUTATION ───────────────────────────────────────────────────────
export function computePortfolioGreeks(positions) {
  let totalDeltaBTC = 0;
  let totalDeltaUSD = 0;
  let totalGamma = 0;
  let totalTheta = 0;
  let totalVega = 0;
  let totalNotionalUSD = 0;
  let spotExposureUSD = 0;
  let cashUSD = 0;

  for (const p of positions) {
    const sign = p.side === 'long' ? 1 : -1;
    const qty = p.size * sign;

    if (p.type === 'cash') {
      cashUSD += p.size;
      continue;
    }

    const notional = p.type.startsWith('option')
      ? p.size * SPOT_PRICE
      : p.size * SPOT_PRICE;
    totalNotionalUSD += notional;

    // Delta (in BTC)
    const deltaContrib = p.delta * qty;
    totalDeltaBTC += deltaContrib;
    totalDeltaUSD += deltaContrib * SPOT_PRICE;

    // Gamma (USD² sensitivity)
    totalGamma += p.gamma * qty * SPOT_PRICE * SPOT_PRICE;

    // Theta (USD/day)
    totalTheta += p.theta * qty;

    // Vega (USD per 1% IV change)
    totalVega += p.vega * qty * 0.01;

    if (p.type === 'spot') spotExposureUSD += p.size * SPOT_PRICE;
  }

  const totalPortfolioValue = spotExposureUSD + cashUSD;
  const deltaPct = totalPortfolioValue > 0 ? (totalDeltaUSD / totalPortfolioValue) * 100 : 0;

  return {
    delta_btc: totalDeltaBTC,
    delta_usd: totalDeltaUSD,
    delta_pct: deltaPct,
    gamma: totalGamma,
    theta: totalTheta,
    vega: totalVega,
    notional_usd: totalNotionalUSD,
    spot_exposure_usd: spotExposureUSD,
    cash_usd: cashUSD,
    total_value_usd: totalPortfolioValue + (totalNotionalUSD - spotExposureUSD),
  };
}

// ─── PNL CALCULATOR ───────────────────────────────────────────────────────────
export function computePositionPnL(pos) {
  const sign = pos.side === 'long' ? 1 : -1;
  if (pos.type === 'cash') return 0;
  if (pos.type.startsWith('option')) {
    // Simplificado: pnl = (current premium - entry premium) * size * sign
    const currentPremium = pos.type === 'option_call'
      ? Math.max(0, SPOT_PRICE - pos.strike) + 400  // intrinsic + time value approx
      : Math.max(0, pos.strike - SPOT_PRICE) + 380;
    return (currentPremium - pos.entry_price) * pos.size * sign;
  }
  return (pos.current_price - pos.entry_price) * pos.size * sign;
}

// ─── STRESS TEST SCENARIOS ────────────────────────────────────────────────────
export function stressTest(positions, pctMove) {
  const newPrice = SPOT_PRICE * (1 + pctMove / 100);
  let pnl = 0;
  for (const p of positions) {
    if (p.type === 'cash') continue;
    const sign = p.side === 'long' ? 1 : -1;
    const priceDelta = newPrice - SPOT_PRICE;
    if (p.type.startsWith('option')) {
      const deltaApprox = p.delta * priceDelta * p.size * sign;
      const gammaApprox = 0.5 * p.gamma * (priceDelta ** 2) * p.size * sign;
      pnl += deltaApprox + gammaApprox;
    } else {
      pnl += priceDelta * p.size * sign;
    }
  }
  return pnl;
}

export const stressScenarios = [-20, -15, -10, -5, 0, 5, 10, 15, 20].map(pct => ({
  label: `${pct > 0 ? '+' : ''}${pct}%`,
  pct,
}));