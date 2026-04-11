// ─── MARKET REGIME — MOCK DATA ───────────────────────────────────────────────
// Classifica o regime de mercado: Risk-On / Risk-Off / Neutral
// Baseado em: Yield Curve (US10Y-US2Y), DXY trend, VIX, Funding, NUPL, Correlações

import { macroBoard, btcFutures, btcNUPL } from './mockData';

// ─── COMPONENTES DO REGIME ────────────────────────────────────────────────────
const us10y = macroBoard.series.find(s => s.id === 'US10Y');
const us2y  = macroBoard.series.find(s => s.id === 'US2Y');
const vix   = macroBoard.series.find(s => s.id === 'VIX');
const sp500 = macroBoard.series.find(s => s.id === 'SP500');
const dxy   = macroBoard.series.find(s => s.id === 'DXY');

// Yield curve spread
const yieldSpread = us10y.value - us2y.value;   // 0.281 = +28.1bp
const yieldScore  = yieldSpread >= 0.5 ? 80 : yieldSpread >= 0 ? 60 : yieldSpread >= -0.5 ? 30 : 10;

// DXY — queda = risk-on para ativos de risco
const dxyTrend1m  = dxy.delta_30d * 100;   // -3.4% no mês = bullish para BTC
const dxyScore    = dxyTrend1m <= -2 ? 75 : dxyTrend1m <= 0 ? 60 : dxyTrend1m <= 2 ? 40 : 20;

// VIX — abaixo de 20 = risk-on, acima de 30 = risk-off extremo
const vixScore    = vix.value <= 15 ? 85 : vix.value <= 20 ? 70 : vix.value <= 25 ? 50 : vix.value <= 30 ? 30 : 10;

// S&P trend
const sp500Score  = sp500.delta_30d >= 0.04 ? 80 : sp500.delta_30d >= 0 ? 65 : sp500.delta_30d >= -0.05 ? 40 : 20;

// Funding — positivo alto = sobreaquecido = sinal de reversão iminente
const fundingPct  = btcFutures.funding_rate * 100;
const fundingScore = fundingPct <= 0 ? 80 : fundingPct <= 0.05 ? 65 : fundingPct <= 0.08 ? 50 : 30;

// NUPL on-chain
const nuplScore   = btcNUPL.value >= 0.75 ? 20 : btcNUPL.value >= 0.5 ? 55 : btcNUPL.value >= 0.25 ? 70 : 80;

// ─── REGIME SCORE (ponderado) ─────────────────────────────────────────────────
const weights = { yield: 0.20, dxy: 0.18, vix: 0.22, sp500: 0.15, funding: 0.12, nupl: 0.13 };
const weightedScore = (
  yieldScore  * weights.yield +
  dxyScore    * weights.dxy +
  vixScore    * weights.vix +
  sp500Score  * weights.sp500 +
  fundingScore * weights.funding +
  nuplScore   * weights.nupl
);

const regimeLabel  = weightedScore >= 62 ? 'Risk-On' : weightedScore <= 38 ? 'Risk-Off' : 'Neutral';
const regimeColor  = regimeLabel === 'Risk-On' ? '#10b981' : regimeLabel === 'Risk-Off' ? '#ef4444' : '#f59e0b';
const regimeBg     = regimeLabel === 'Risk-On' ? 'rgba(16,185,129,0.08)' : regimeLabel === 'Risk-Off' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
const regimeBorder = regimeLabel === 'Risk-On' ? 'rgba(16,185,129,0.25)' : regimeLabel === 'Risk-Off' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';

// ─── REGIME COMPONENTS (radar data) ──────────────────────────────────────────
export const regimeComponents = [
  { key: 'yield',   label: 'Yield Curve',  score: yieldScore,   raw: `${yieldSpread >= 0 ? '+' : ''}${(yieldSpread * 100).toFixed(1)}bp`, icon: '📊', description: 'US10Y−US2Y: normal = risk-on, invertida = risk-off', weight: weights.yield },
  { key: 'dxy',     label: 'DXY Trend',    score: dxyScore,     raw: `${dxyTrend1m >= 0 ? '+' : ''}${dxyTrend1m.toFixed(2)}% 1M`,          icon: '💵', description: 'Queda do dólar = risk-on para ativos de risco', weight: weights.dxy },
  { key: 'vix',     label: 'VIX',          score: vixScore,     raw: vix.value.toFixed(2),                                                    icon: '🌡️', description: 'VIX < 20 = risk-on, VIX > 25 = cautela', weight: weights.vix },
  { key: 'sp500',   label: 'S&P 500',      score: sp500Score,   raw: `${sp500.delta_30d >= 0 ? '+' : ''}${(sp500.delta_30d * 100).toFixed(2)}% 1M`, icon: '📈', description: 'Trend positivo do S&P = ambiente de risco favorável', weight: weights.sp500 },
  { key: 'funding', label: 'Funding Rate', score: fundingScore, raw: `+${fundingPct.toFixed(4)}%`,                                           icon: '💸', description: 'Funding extremo = sobreaquecimento = risco de reversão', weight: weights.funding },
  { key: 'nupl',    label: 'NUPL On-Chain',score: nuplScore,    raw: btcNUPL.value.toFixed(2),                                                icon: '⛓',  description: 'NUPL < 0.5 = saudável, > 0.75 = euforia = risco', weight: weights.nupl },
];

// ─── RADAR DATA ───────────────────────────────────────────────────────────────
export const radarData = [
  { metric: 'Yield Curve',  value: yieldScore,   fullMark: 100 },
  { metric: 'DXY',          value: dxyScore,     fullMark: 100 },
  { metric: 'VIX',          value: vixScore,     fullMark: 100 },
  { metric: 'S&P 500',      value: sp500Score,   fullMark: 100 },
  { metric: 'Funding',      value: fundingScore, fullMark: 100 },
  { metric: 'NUPL',         value: nuplScore,    fullMark: 100 },
];

// ─── REGIME HISTORY (90 dias simulado) ───────────────────────────────────────
function seedR(n) { return (Math.sin(n * 6271 + 3141) % 1 + 1) / 2; }
export const regimeHistory = Array.from({ length: 90 }, (_, i) => {
  const base = weightedScore - 8 + i * 0.08;
  const noise = (seedR(i) - 0.5) * 22;
  const score = Math.min(95, Math.max(15, base + noise));
  const label = score >= 62 ? 'Risk-On' : score <= 38 ? 'Risk-Off' : 'Neutral';
  const date = new Date(Date.now() - (89 - i) * 86400000);
  return {
    label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: parseFloat(score.toFixed(1)),
    regime: label,
  };
});

// ─── REGIME TRANSITIONS (eventos notáveis) ───────────────────────────────────
export const regimeTransitions = [
  { date: 'Mar 10', from: 'Neutral', to: 'Risk-On',  trigger: 'CPI abaixo do esperado + DXY −1.8%', idx: 67 },
  { date: 'Fev 28', from: 'Risk-On', to: 'Neutral',  trigger: 'VIX subiu de 16 para 22 em 2 dias', idx: 49 },
  { date: 'Fev 12', from: 'Risk-Off',to: 'Neutral',  trigger: 'FOMC tom menos hawkish', idx: 33 },
  { date: 'Jan 28', from: 'Neutral', to: 'Risk-Off', trigger: 'NFP > estimativa + Fed hawkish', idx: 18 },
];

// ─── AI EXPOSURE SUGGESTIONS ─────────────────────────────────────────────────
export const exposureSuggestions = {
  'Risk-On': {
    label: 'Aumentar exposição a risco',
    color: '#10b981',
    suggestions: [
      { action: 'BTC Spot/Futures', direction: '↑', detail: 'Aumentar alocação spot. Funding controlado permite long com carry favorável.', confidence: 0.72 },
      { action: 'Altcoins', direction: '↑', detail: 'Risk-On historicamente beneficia altcaps. Selecionar com volume sólido.', confidence: 0.58 },
      { action: 'Opções — Calls', direction: '↑', detail: 'IVR em zona neutra — custo de calls razoável. Call spread é eficiente.', confidence: 0.64 },
      { action: 'Hedge via Put', direction: '↓', detail: 'Reduzir hedge excessivo. Ambiente não exige proteção máxima no momento.', confidence: 0.69 },
    ],
  },
  'Neutral': {
    label: 'Manter posições e aguardar sinal',
    color: '#f59e0b',
    suggestions: [
      { action: 'BTC Spot', direction: '→', detail: 'Manter exposição atual. Sem edge direcional claro. Evitar leverage elevada.', confidence: 0.67 },
      { action: 'Cash Reserve', direction: '↑', detail: 'Aumentar reserva de stablecoin para capturar oportunidade quando regime definir.', confidence: 0.73 },
      { action: 'Opções — Straddle', direction: '↑', detail: 'Regime indefinido = volatilidade potencial. Straddle captura movimento em ambas direções.', confidence: 0.61 },
      { action: 'Leverage', direction: '↓', detail: 'Regime neutro não justifica alavancagem. Risco/retorno desfavorável.', confidence: 0.78 },
    ],
  },
  'Risk-Off': {
    label: 'Reduzir exposição e proteger capital',
    color: '#ef4444',
    suggestions: [
      { action: 'BTC Spot/Futures', direction: '↓', detail: 'Reduzir exposição direcional. Priorizar preservação de capital.', confidence: 0.81 },
      { action: 'Cash/Stablecoins', direction: '↑', detail: 'Aumentar posição em USDT/USDC. Capitalizar oportunidade de fundo.', confidence: 0.76 },
      { action: 'Puts de Proteção', direction: '↑', detail: 'IV elevada mas proteção justificada. Put $78K protege posição residual.', confidence: 0.70 },
      { action: 'Altcoins', direction: '↓', detail: 'Risk-Off impacta desproporcionalmente altcoins. Converter para BTC ou cash.', confidence: 0.84 },
    ],
  },
};

// ─── EXPORTAÇÕES PRINCIPAIS ────────────────────────────────────────────────────
export const marketRegime = {
  score: parseFloat(weightedScore.toFixed(1)),
  label: regimeLabel,
  color: regimeColor,
  bg: regimeBg,
  border: regimeBorder,
  components: regimeComponents,
  updated_at: new Date(),
  quality: 'B',
  // Scores por sub-regime
  risk_on_score:  parseFloat(weightedScore.toFixed(1)),
  neutral_score:  parseFloat((100 - Math.abs(weightedScore - 50) * 2).toFixed(1)),
  risk_off_score: parseFloat((100 - weightedScore).toFixed(1)),
};