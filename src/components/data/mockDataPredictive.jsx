// ─── PREDICTIVE PANEL MOCK DATA ──────────────────────────────────────────────
// BTC Price Projection 24h · Breakout Probability · Institutional Pressure

import { btcFutures, btcCorrelations, macroBoard } from './mockData';
import { stablecoinSnapshot, mintVsBtcCorr } from './mockDataStablecoin';
import { etfFlows, liquidationClusters } from './mockDataExtended';
import { marketRegime } from './mockDataRegime';

const SPOT = 84298.70;

// ─── FACTOR INPUTS ────────────────────────────────────────────────────────────
const vix     = macroBoard.series.find(s => s.id === 'VIX');
const stableNet = stablecoinSnapshot.total_net_24h_m;     // +420M = bullish
const etfNet    = etfFlows.net_flow_today_m;              // +284.6M = bullish
const fundingPct = btcFutures.funding_rate * 100;         // 0.0712%
const oiDelta   = btcFutures.oi_delta_pct;                // +2.34% 1D
const corrSPX   = btcCorrelations.pairs[0].corr_1d;       // 0.68

// ─── SCENARIO ENGINE ─────────────────────────────────────────────────────────
// Bull score: stablecoin inflow + ETF inflow + regime risk-on + correlação positiva
const bullFactors = {
  stablecoin_mint:  Math.min(1, stableNet / 500),          // 0.84
  etf_inflow:       Math.min(1, etfNet / 400),             // 0.71
  regime_on:        marketRegime.score / 100,              // 0.58
  corr_spx:         corrSPX,                               // 0.68
  funding_ok:       fundingPct < 0.08 ? 0.7 : 0.35,       // 0.70
};
const bearFactors = {
  vix_elevated:     vix.value > 20 ? Math.min(1, (vix.value - 15) / 20) : 0,  // 0.36
  funding_extreme:  fundingPct > 0.06 ? Math.min(1, fundingPct / 0.12) : 0,   // 0.59
  oi_overextended:  Math.min(1, oiDelta / 5),                                  // 0.47
  cluster_below:    0.45,  // $83K cluster a 1.55%
};

const rawBull = Object.values(bullFactors).reduce((s, v) => s + v, 0) / Object.keys(bullFactors).length;
const rawBear = Object.values(bearFactors).reduce((s, v) => s + v, 0) / Object.keys(bearFactors).length;
const total   = rawBull + rawBear;

const probBull  = parseFloat((rawBull / total * 100).toFixed(1));
const probBear  = parseFloat((rawBear / total * 100).toFixed(1));
const probNeutral = parseFloat((100 - probBull - probBear + 10).toFixed(1)); // equilíbrio

// ─── SCENARIOS 24H ───────────────────────────────────────────────────────────
export const scenarios24h = [
  {
    id: 'bull_strong',
    label: 'Rally Institucional',
    prob: 28,
    direction: 'bull',
    color: '#10b981',
    target_price: SPOT * 1.048,   // +4.8% → ~$88,350
    target_pct: 4.8,
    trigger: 'Novo mint de $500M+ USDT + ETF inflow > $300M + VIX recuando',
    drivers: ['Stablecoin mint +420M 24h', 'IBIT entrada $142M', 'Regime Risk-On 58pts'],
    risk: 'Funding já em 0.071% — rally pode ser limitado por realizações',
    confidence: 0.61,
  },
  {
    id: 'bull_mild',
    label: 'Alta Moderada',
    prob: 34,
    direction: 'bull',
    color: '#60a5fa',
    target_price: SPOT * 1.021,   // +2.1% → ~$86,070
    target_pct: 2.1,
    trigger: 'Consolidação com viés comprador acima de $84K',
    drivers: ['CVD positivo +58K', 'SPX correlação 0.68', 'LTH acumulando'],
    risk: 'Resistência em $86K (cluster de shorts)',
    confidence: 0.70,
  },
  {
    id: 'neutral',
    label: 'Lateral / Indecisão',
    prob: 18,
    direction: 'neutral',
    color: '#f59e0b',
    target_price: SPOT,
    target_pct: 0,
    trigger: 'Sem catalisador macro novo, funding se estabiliza',
    drivers: ['Aguardando CPI 12/Mar', 'Stablecoin em alta mas sem deploy'],
    risk: 'Qualquer print macro pode romper a indecisão',
    confidence: 0.52,
  },
  {
    id: 'bear_mild',
    label: 'Correção Suave',
    prob: 14,
    direction: 'bear',
    color: '#f97316',
    target_price: SPOT * 0.975,   // -2.5% → ~$82,190
    target_pct: -2.5,
    trigger: 'Funding persiste acima de 0.08% → flush parcial de longs',
    drivers: ['VIX em 22.14 (+14% no mês)', 'Cluster $83K a 1.55%', 'OI +13.7% 1W'],
    risk: 'Flush pode parar em $83K antes de reverter',
    confidence: 0.64,
  },
  {
    id: 'bear_strong',
    label: 'Liquidação em Cascata',
    prob: 6,
    direction: 'bear',
    color: '#ef4444',
    target_price: SPOT * 0.934,   // -6.6% → ~$78,750
    target_pct: -6.6,
    trigger: 'VIX > 28 + DXY revertendo + macro surprise negativo',
    drivers: ['$924M em longs alavancados @$78K', 'Put skew ativo -3.1pp', 'Funding extremo'],
    risk: 'Cenário de cauda — baixa probabilidade mas alto impacto',
    confidence: 0.55,
  },
];

// ─── BREAKOUT PROBABILITY TABLE ──────────────────────────────────────────────
// Para cada nível de preço: prob de tocar nas próximas 24h
export const breakoutTable = [
  { price: 90000, label: '$90K',  prob_touch: 8,  prob_close: 3,  side: 'up',   drivers: 'Short squeeze $88-92K', color: '#10b981' },
  { price: 88000, label: '$88K',  prob_touch: 21, prob_close: 12, side: 'up',   drivers: 'Shorts cluster + momentum', color: '#10b981' },
  { price: 86000, label: '$86K',  prob_touch: 41, prob_close: 28, side: 'up',   drivers: 'Alta moderada + IBIT flow', color: '#60a5fa' },
  { price: 85000, label: '$85K',  prob_touch: 62, prob_close: 48, side: 'up',   drivers: 'Resistência técnica + shorts', color: '#60a5fa' },
  { price: 84298, label: 'SPOT',  prob_touch: 100, prob_close: 100, side: 'now', drivers: 'Preço atual', color: '#f59e0b' },
  { price: 83500, label: '$83.5K', prob_touch: 55, prob_close: 38, side: 'down', drivers: 'Suporte técnico + longs cluster', color: '#f97316' },
  { price: 83000, label: '$83K',  prob_touch: 38, prob_close: 22, side: 'down', drivers: '$142M longs em risco', color: '#f97316' },
  { price: 82000, label: '$82K',  prob_touch: 21, prob_close: 12, side: 'down', drivers: '$285M longs — flush parcial', color: '#ef4444' },
  { price: 80000, label: '$80K',  prob_touch: 10, prob_close: 5,  side: 'down', drivers: 'Suporte psicológico + $618M', color: '#ef4444' },
  { price: 78000, label: '$78K',  prob_touch: 4,  prob_close: 2,  side: 'down', drivers: '$924M cluster — bear extremo', color: '#ef4444' },
];

// ─── INSTITUTIONAL PRESSURE SCORE ────────────────────────────────────────────
export const institutionalPressure = {
  overall_score: parseFloat(((rawBull * 100) * 0.7 + (etfNet / 400) * 30).toFixed(1)),
  components: [
    { label: 'ETF Net Flow 24h',     value: etfNet,      max: 400,  score: Math.round(etfNet / 400 * 100),   color: '#3b82f6', unit: 'M', signal: 'bullish' },
    { label: 'Stablecoin Mint Net',  value: stableNet,   max: 600,  score: Math.round(stableNet / 600 * 100), color: '#10b981', unit: 'M', signal: 'bullish' },
    { label: 'CME OI (institucional)', value: 2.21,      max: 5,    score: 44,                               color: '#60a5fa', unit: 'B', signal: 'neutral' },
    { label: 'VIX (inverso)',         value: vix.value,  max: 40,   score: Math.round((40 - vix.value) / 40 * 100), color: '#a78bfa', unit: '', signal: vix.value > 20 ? 'bearish' : 'bullish' },
    { label: 'Funding Rate (inverso)',value: fundingPct, max: 0.15, score: Math.round((1 - fundingPct / 0.15) * 100), color: '#f59e0b', unit: '%', signal: fundingPct > 0.08 ? 'bearish' : 'neutral' },
  ],
  interpretation: `Score institucional de compra em ${parseFloat(((rawBull * 100) * 0.7 + (etfNet / 400) * 30).toFixed(1))}/100. ETF inflow de $${etfNet.toFixed(0)}M + stablecoin net +$${stableNet.toFixed(0)}M indicam pressão compradora sustentada. VIX em ${vix.value.toFixed(1)} representa o principal risco bearish. Lag histórico de ~12h entre mint e price action.`,
};

// ─── 24H PRICE PATH SIMULATION ───────────────────────────────────────────────
function seededRnd(seed) { return ((Math.sin(seed * 9301 + 49297) % 1) + 1) / 2; }

export const pricePaths = {
  timestamps: Array.from({ length: 25 }, (_, i) => {
    const d = new Date();
    d.setHours(d.getHours() + i);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }),
  bull: Array.from({ length: 25 }, (_, i) => {
    const trend = SPOT + (SPOT * 0.048) * (i / 24);
    const noise = (seededRnd(i + 1) - 0.48) * 400;
    return parseFloat((trend + noise).toFixed(0));
  }),
  neutral: Array.from({ length: 25 }, (_, i) => {
    const noise = (seededRnd(i + 50) - 0.5) * 600;
    return parseFloat((SPOT + noise).toFixed(0));
  }),
  bear: Array.from({ length: 25 }, (_, i) => {
    const trend = SPOT - (SPOT * 0.025) * (i / 24);
    const noise = (seededRnd(i + 100) - 0.52) * 350;
    return parseFloat((trend + noise).toFixed(0));
  }),
};