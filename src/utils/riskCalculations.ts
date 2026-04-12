/**
 * riskCalculations.ts — Cálculos de risco validados em Python (Fase 4)
 *
 * Implementações portadas de scripts/validate_var.py, validate_risk_score.py, validate_gex.py
 * QA: todos os cálculos foram validados com testes unitários Python antes deste port.
 *
 * Exports principais:
 *   computeHistoricalVol   — vol diária/anual de série de preços
 *   computeVaR             — VaR paramétrico + histórico + CVaR
 *   computeSharpe          — Sharpe anualizado
 *   computeMaxDrawdown     — maior queda pico→vale
 *   computeLiveRiskMetrics — integrador completo (substitui computeRiskMetrics mock)
 *   computeRiskScore       — Risk Score composto 0–100
 *   computeGex             — GEX por strike, net GEX, dealer position, flip point
 *   computeMaxPain         — Max Pain (strike com menor OI expirando com valor)
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONF_95      = 1.6449;  // z-score 95% (normal)
const CONF_99      = 2.3263;  // z-score 99% (normal)
const TRADING_DAYS = 252;
const RISK_FREE    = 0.045;   // 4.5% T-bill anual

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LivePosition {
  type:         string;
  size:         number;
  entry_price:  number;
  current_price?: number;
  delta:        number;
  gamma?:       number;
  theta?:       number;
  vega?:        number;
  side:         string;
}

export interface VolData {
  daily_vol:  number;
  annual_vol: number;
  mean_daily: number;
  log_returns: number[];
}

export interface VaRResult {
  var_95_1d:   number;  // negativo (perda USD)
  var_99_1d:   number;
  var_95_hist: number;
  var_99_hist: number;
  cvar_95:     number;
  sigma_port:  number;
}

export interface RiskMetricsLive {
  var_95_1d:        number;
  var_99_1d:        number;
  var_95_hist:      number;
  cvar_95:          number;
  sharpe_ratio:     number;
  max_drawdown_pct: number;
  beta_vs_btc:      number;
  annual_vol_pct:   number;
  delta_usd:        number;
  delta_pct:        number;
  total_value_usd:  number;
}

export interface RiskScoreResult {
  score:        number;   // 0–100 inteiro
  regime:       'RISCO ELEVADO' | 'MODERADO' | 'SAUDÁVEL';
  module_scores: {
    funding: number;
    oi:      number;
    vol:     number;
    fng:     number;
    price:   number;
  };
  ema20: number;
}

export interface GexStrikeInput {
  strike:   number;
  call_oi:  number;
  put_oi:   number;
  gamma?:   number;
  call_iv:  number;
  put_iv:   number;
}

export interface GexStrikeOutput {
  strike:   number;
  gex_call: number;   // milhões USD
  gex_put:  number;
  net_gex:  number;
  gamma:    number;
}

export interface GexResult {
  gex_by_strike:   GexStrikeOutput[];
  net_gex_total:   number;   // milhões USD
  net_gex_usd:     number;   // USD absoluto
  dealer_position: 'long_gamma' | 'short_gamma' | 'neutral';
  gamma_flip:      number | null;
  flip_distance_pct: number | null;
}

// ─── 1. Volatilidade Histórica ────────────────────────────────────────────────

export function computeHistoricalVol(prices: number[]): VolData {
  if (prices.length < 2) {
    return { daily_vol: 0, annual_vol: 0, mean_daily: 0, log_returns: [] };
  }
  const log_returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    log_returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const n = log_returns.length;
  const mean = log_returns.reduce((s, r) => s + r, 0) / n;
  const variance = log_returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const daily_vol = Math.sqrt(variance);
  return {
    daily_vol,
    annual_vol: daily_vol * Math.sqrt(TRADING_DAYS),
    mean_daily: mean,
    log_returns,
  };
}

// ─── 2. Delta do Portfólio ────────────────────────────────────────────────────

export function computePortfolioDelta(
  positions: LivePosition[],
  btcPrice: number,
): { total_delta: number; delta_usd: number; delta_pct: number; total_value: number } {
  const nonCash = positions.filter(p => p.type !== 'cash');
  const totalDelta = nonCash.reduce((s, p) => {
    const sign = p.side === 'long' ? 1 : -1;
    return s + sign * p.delta * p.size;
  }, 0);
  const totalValue = positions.reduce((s, p) => {
    const price = p.current_price ?? p.entry_price;
    return s + p.size * price;
  }, 0);
  const deltaUsd = totalDelta * btcPrice;
  const deltaPct = totalValue > 0 ? (deltaUsd / totalValue) * 100 : 0;
  return { total_delta: totalDelta, delta_usd: deltaUsd, delta_pct: deltaPct, total_value: totalValue };
}

// ─── 3. VaR Paramétrico ───────────────────────────────────────────────────────

export function computeVaRParametric(deltaUsd: number, dailyVol: number): { var_95: number; var_99: number; sigma_port: number } {
  const sigma = Math.abs(deltaUsd) * dailyVol;
  return {
    var_95:     -(CONF_95 * sigma),
    var_99:     -(CONF_99 * sigma),
    sigma_port: sigma,
  };
}

// ─── 4. VaR Histórico + CVaR ─────────────────────────────────────────────────

export function computeVaRHistorical(deltaUsd: number, logReturns: number[]): { var_95: number; var_99: number; cvar_95: number } {
  if (!logReturns.length) return { var_95: 0, var_99: 0, cvar_95: 0 };
  const pnl = logReturns.map(r => deltaUsd * r).sort((a, b) => a - b);
  const n   = pnl.length;
  const i95 = Math.max(0, Math.floor(0.05 * n));
  const i99 = Math.max(0, Math.floor(0.01 * n));
  const tail = pnl.slice(0, Math.max(1, i95));
  const cvar = tail.reduce((s, v) => s + v, 0) / tail.length;
  return {
    var_95:  pnl[i95],
    var_99:  pnl[i99],
    cvar_95: cvar,
  };
}

// ─── 5. Sharpe Anualizado ─────────────────────────────────────────────────────

export function computeSharpe(logReturns: number[]): number {
  if (logReturns.length < 2) return 0;
  const n       = logReturns.length;
  const mean    = logReturns.reduce((s, r) => s + r, 0) / n;
  const std     = Math.sqrt(logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1));
  if (std === 0) return 999;
  const annRet = mean * TRADING_DAYS;
  const annVol = std * Math.sqrt(TRADING_DAYS);
  return parseFloat(((annRet - RISK_FREE) / annVol).toFixed(3));
}

// ─── 6. Max Drawdown ──────────────────────────────────────────────────────────

export function computeMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0];
  let maxDD = 0;
  for (const price of prices) {
    if (price > peak) peak = price;
    const dd = (price - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return parseFloat(maxDD.toFixed(4));
}

// ─── 7. EMA ───────────────────────────────────────────────────────────────────

export function computeEMA(prices: number[], period = 20): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// ─── 8. Integrador: computeLiveRiskMetrics ────────────────────────────────────

/**
 * Calcula todas as métricas de risco com dados live.
 * Substitui o computeRiskMetrics original (que usava constantes mock).
 *
 * @param positions  - lista de posições do portfólio
 * @param btcPrices  - histórico de preços BTC (klines close, mínimo 30 velas diárias)
 */
export function computeLiveRiskMetrics(
  positions: LivePosition[],
  btcPrices: number[],
): RiskMetricsLive {
  const btcPrice = btcPrices.length > 0 ? btcPrices[btcPrices.length - 1] : 0;
  const volData  = computeHistoricalVol(btcPrices);
  const delta    = computePortfolioDelta(positions, btcPrice);
  const varP     = computeVaRParametric(delta.delta_usd, volData.daily_vol);
  const varH     = computeVaRHistorical(delta.delta_usd, volData.log_returns);
  const sharpe   = computeSharpe(volData.log_returns);
  const mdd      = computeMaxDrawdown(btcPrices);
  const beta     = parseFloat((delta.delta_pct / 100).toFixed(3));

  return {
    var_95_1d:        varP.var_95,
    var_99_1d:        varP.var_99,
    var_95_hist:      varH.var_95,
    cvar_95:          varH.cvar_95,
    sharpe_ratio:     sharpe,
    max_drawdown_pct: mdd,
    beta_vs_btc:      beta,
    annual_vol_pct:   parseFloat((volData.annual_vol * 100).toFixed(1)),
    delta_usd:        parseFloat(delta.delta_usd.toFixed(0)),
    delta_pct:        parseFloat(delta.delta_pct.toFixed(1)),
    total_value_usd:  parseFloat(delta.total_value.toFixed(0)),
  };
}

// ─── 9. Risk Score Composto ───────────────────────────────────────────────────

function scoreFundingRate(rate: number): number {
  return Math.min(100, (Math.abs(rate) / 0.003) * 100);
}

function scoreOIDelta(pct: number): number {
  return Math.min(100, (Math.abs(pct) / 10) * 100);
}

function scoreDVOL(dvol: number): number {
  if (dvol >= 80)     return Math.min(100, 70 + (dvol - 80) / 40 * 30);
  if (dvol >= 60)     return 40 + (dvol - 60) / 20 * 30;
  if (dvol >= 40)     return (dvol - 40) / 20 * 40;
  if (dvol >= 20)     return 20 + (40 - dvol) / 20 * 20;
  return 40;
}

function scoreFearGreed(fng: number): number {
  return Math.min(100, Math.abs(fng - 50) * 2);
}

function scorePriceDeviation(price: number, ema20: number): number {
  if (ema20 <= 0) return 0;
  const devPct = Math.abs((price - ema20) / ema20) * 100;
  return Math.min(100, devPct / 10 * 100);
}

/**
 * Computa o Risk Score composto (0–100).
 *
 * @param fundingRate  - taxa 8h (ex: 0.0002)
 * @param oiDeltaPct   - variação OI 24h em %
 * @param dvol30d      - Deribit DVOL em % anualizado
 * @param fearGreed    - índice 0–100
 * @param btcPrice     - preço atual BTC
 * @param btcPrices20d - últimos 20 preços diários de BTC
 */
export function computeRiskScore(
  fundingRate: number,
  oiDeltaPct: number,
  dvol30d: number,
  fearGreed: number,
  btcPrice: number,
  btcPrices20d: number[],
): RiskScoreResult {
  const WEIGHTS = { funding: 0.30, oi: 0.20, vol: 0.20, fng: 0.20, price: 0.10 };
  const ema20 = computeEMA(btcPrices20d, 20);

  const scores = {
    funding: scoreFundingRate(fundingRate),
    oi:      scoreOIDelta(oiDeltaPct),
    vol:     scoreDVOL(dvol30d),
    fng:     scoreFearGreed(fearGreed),
    price:   scorePriceDeviation(btcPrice, ema20),
  };

  const composite = Math.min(100, Math.max(0,
    Object.entries(scores).reduce((s, [k, v]) => s + v * WEIGHTS[k as keyof typeof WEIGHTS], 0),
  ));

  const score = Math.round(composite);
  const regime: RiskScoreResult['regime'] =
    score >= 65 ? 'RISCO ELEVADO' :
    score >= 35 ? 'MODERADO'      : 'SAUDÁVEL';

  return { score, regime, module_scores: scores, ema20: Math.round(ema20) };
}

// ─── 10. GEX e Dealer Positioning ────────────────────────────────────────────

function estimateGammaBS(spot: number, strike: number, iv: number, tYears = 0.0274): number {
  if (iv <= 0 || tYears <= 0 || spot <= 0 || strike <= 0) return 0;
  try {
    const d1 = (Math.log(spot / strike) + (0.045 + iv ** 2 / 2) * tYears) / (iv * Math.sqrt(tYears));
    const nd1p = Math.exp(-0.5 * d1 ** 2) / Math.sqrt(2 * Math.PI);
    return nd1p / (spot * iv * Math.sqrt(tYears));
  } catch { return 0; }
}

/**
 * Computa GEX por strike, net GEX total, posição do dealer e gamma flip point.
 *
 * @param strikes  - array de strikes com OI e gamma/IV
 * @param spot     - preço BTC atual
 * @param tYears   - tempo para expiração em anos (default ≈ 10 dias)
 */
export function computeGex(
  strikes: GexStrikeInput[],
  spot: number,
  tYears = 0.0274,
): GexResult {
  if (!strikes.length) {
    return { gex_by_strike: [], net_gex_total: 0, net_gex_usd: 0,
             dealer_position: 'neutral', gamma_flip: null, flip_distance_pct: null };
  }

  const gexData: GexStrikeOutput[] = strikes.map(s => {
    const g = s.gamma ?? estimateGammaBS(spot, s.strike, (s.call_iv + s.put_iv) / 2, tYears);
    const gexCall = s.call_oi * g * spot * spot * 0.01;
    const gexPut  = -s.put_oi * g * spot * spot * 0.01;
    return {
      strike:   s.strike,
      gex_call: parseFloat((gexCall / 1e6).toFixed(2)),
      gex_put:  parseFloat((gexPut  / 1e6).toFixed(2)),
      net_gex:  parseFloat(((gexCall + gexPut) / 1e6).toFixed(2)),
      gamma:    parseFloat(g.toFixed(8)),
    };
  });

  const netGexTotal = parseFloat(gexData.reduce((s, d) => s + d.net_gex, 0).toFixed(2));
  const dealer_position: GexResult['dealer_position'] =
    netGexTotal > 5  ? 'long_gamma'  :
    netGexTotal < -5 ? 'short_gamma' : 'neutral';

  // Gamma flip: onde o GEX acumulado (por strike ascendente) muda de sinal
  const sorted = [...gexData].sort((a, b) => a.strike - b.strike);
  let cumulative = 0;
  let gamma_flip: number | null = null;
  for (const d of sorted) {
    const prev = cumulative;
    cumulative += d.net_gex;
    if ((prev < 0 && cumulative >= 0) || (prev >= 0 && cumulative < 0)) {
      gamma_flip = d.strike;
      break;
    }
  }

  return {
    gex_by_strike:    gexData,
    net_gex_total:    netGexTotal,
    net_gex_usd:      Math.round(netGexTotal * 1e6),
    dealer_position,
    gamma_flip,
    flip_distance_pct: gamma_flip != null
      ? parseFloat(((gamma_flip - spot) / spot * 100).toFixed(2))
      : null,
  };
}

// ─── 11. Max Pain ─────────────────────────────────────────────────────────────

/**
 * Max Pain: strike com menor custo total de expiração para writers de opções.
 * = Minimiza sum(call_oi * max(0, strike-test) + put_oi * max(0, test-strike))
 */
export function computeMaxPain(strikes: GexStrikeInput[], spot: number): number {
  if (!strikes.length) return spot;
  let minPain = Infinity;
  let maxPainStrike = spot;
  for (const test of strikes) {
    const pain = strikes.reduce((s, d) =>
      s + Math.max(0, d.strike - test.strike) * d.call_oi
        + Math.max(0, test.strike - d.strike) * d.put_oi, 0);
    if (pain < minPain) { minPain = pain; maxPainStrike = test.strike; }
  }
  return maxPainStrike;
}
