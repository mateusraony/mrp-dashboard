/**
 * ruleBasedAnalysis.ts — Análise AI baseada em regras quantitativas
 *
 * Gera sinais de mercado a partir de dados live sem chamar APIs externas.
 * Cada módulo aplica thresholds documentados da literatura de crypto quant.
 */

export type Direction = 'bullish' | 'bearish' | 'bullish_bias' | 'bearish_bias' | 'neutral';

// ── Pesos por módulo ──────────────────────────────────────────────────────────

export interface ModuleWeights {
  derivatives: number;
  spot:        number;
  options:     number;
  macro:       number;
}

/** Pesos padrão equiponderados — usados enquanto não há histórico suficiente */
export const DEFAULT_WEIGHTS: ModuleWeights = {
  derivatives: 0.25,
  spot:        0.25,
  options:     0.25,
  macro:       0.25,
};

export interface ModuleAnalysis {
  score:      number;
  signal:     string;
  direction:  Direction;
  confidence: number;
  probability: number;
  timeframe:  string;
  trigger:    string;
  analysis:   string;
}

export interface RuleBasedAnalysis {
  generated_at: Date;
  model:        string;
  overall: {
    recommendation:         string;
    direction:              Direction;
    confidence:             number;
    probability_correction: number;
    timeframe:              string;
    trigger:                string;
    rationale:              string;
    bull_case:              string;
    bear_case:              string;
  };
  modules: {
    derivatives: ModuleAnalysis;
    spot:        ModuleAnalysis;
    options:     ModuleAnalysis;
    macro:       ModuleAnalysis;
  };
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface DerivativesInput {
  fundingRate:   number;   // e.g. 0.0007 = 0.07%
  oiDeltaPct:    number;   // e.g. 2.34 = +2.34%
  openInterest?: number;   // USD (optional)
}

export interface SpotInput {
  ret1d:       number;   // e.g. 0.012 = +1.2%
  cvd1d:       number;   // cumulative volume delta in BTC
  volume1dUsdt: number;  // 24h volume in USD
  price:       number;
}

export interface OptionsInput {
  ivAtm:      number;   // 0–1, e.g. 0.62
  skew:       number;   // pp, e.g. -0.031
  pcrVol:     number;   // put/call ratio by volume
  maxPainDistancePct: number;  // % from spot to max pain
}

export interface MacroInput {
  fngValue:   number;   // 0–100
  fngLabel:   string;
  riskScore:  number;   // 0–100
  riskRegime: string;   // 'SAUDÁVEL' | 'MODERADO' | 'RISCO ELEVADO'
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// ── Derivatives module ────────────────────────────────────────────────────────

function analyzeDerivatives(d: DerivativesInput): ModuleAnalysis {
  const fundPct = d.fundingRate * 100;
  const oiGrowth = d.oiDeltaPct;

  let direction: Direction;
  let signal: string;
  let score: number;
  let probability: number;

  if (fundPct > 0.08 && oiGrowth > 2) {
    direction = 'bearish'; signal = 'LONG FLUSH RISCO ELEVADO'; score = 72; probability = 0.68;
  } else if (fundPct > 0.06) {
    direction = 'bearish_bias'; signal = 'FUNDING ELEVADO · CAUTELA'; score = 62; probability = 0.57;
  } else if (fundPct < -0.01) {
    direction = 'bullish_bias'; signal = 'SHORT SQUEEZE SETUP'; score = 38; probability = 0.54;
  } else if (oiGrowth > 5) {
    direction = 'bearish_bias'; signal = 'OI EXPANSÃO AGRESSIVA'; score = 58; probability = 0.52;
  } else if (oiGrowth < -3) {
    direction = 'bullish_bias'; signal = 'DELEVERAGING · FUNDO POSSÍVEL'; score = 42; probability = 0.50;
  } else {
    direction = 'neutral'; signal = 'ESTRUTURA EQUILIBRADA'; score = 50; probability = 0.45;
  }

  // Adjust score by OI intensity
  score = clamp(score + (oiGrowth > 0 ? Math.min(8, oiGrowth) : 0), 0, 100);

  const fundingAnn = (fundPct * 3 * 365).toFixed(1);
  const oiSign = oiGrowth > 0 ? '+' : '';
  const analysis = `Funding rate ${fundPct > 0 ? '+' : ''}${fundPct.toFixed(4)}% (${fundingAnn}% ann.). OI ${oiSign}${oiGrowth.toFixed(2)}% 1D — ${oiGrowth > 3 ? 'expansão agressiva típica de alavancagem crescente' : oiGrowth < -2 ? 'deleveraging em andamento' : 'variação moderada'}. ${fundPct > 0.06 ? 'Funding persistentemente positivo aumenta probabilidade de reset (flush de longs) nos próximos 4–12h.' : fundPct < 0 ? 'Funding negativo favorece short squeeze — vendedores pagando para manter posição.' : 'Funding dentro do range neutro, sem pressão de reset imediata.'}`;

  return {
    score: Math.round(score),
    signal,
    direction,
    confidence: 0.76,
    probability,
    timeframe: '4h–12h',
    trigger: fundPct > 0.06
      ? `Funding > 0.08% por 2 ciclos OU OI delta 1H > +0.5%`
      : `Funding < 0% OU queda de OI > -3% 1H`,
    analysis,
  };
}

// ── Spot module ───────────────────────────────────────────────────────────────

function analyzeSpot(s: SpotInput): ModuleAnalysis {
  const cvdPositive = s.cvd1d > 0;
  const priceUp = s.ret1d > 0;
  const ret1dPct = (s.ret1d * 100).toFixed(2);
  const vol1dB = (s.volume1dUsdt / 1e9).toFixed(2);
  const cvdFmt = s.cvd1d > 0 ? `+${s.cvd1d.toFixed(0)}` : s.cvd1d.toFixed(0);

  let direction: Direction;
  let signal: string;
  let score: number;
  let probability: number;

  if (cvdPositive && priceUp) {
    direction = 'bullish'; signal = 'FLUXO COMPRADOR CONFIRMADO'; score = 62; probability = 0.60;
  } else if (!cvdPositive && !priceUp) {
    direction = 'bearish'; signal = 'FLUXO VENDEDOR DOMINANTE'; score = 38; probability = 0.58;
  } else if (cvdPositive && !priceUp) {
    direction = 'bullish_bias'; signal = 'CVD DIVERGÊNCIA POSITIVA'; score = 55; probability = 0.53;
  } else {
    direction = 'bearish_bias'; signal = 'DISTRIBUIÇÃO OCULTA POSSÍVEL'; score = 44; probability = 0.51;
  }

  const retAbs = Math.abs(s.ret1d * 100);
  if (retAbs > 3) score = clamp(score + (priceUp ? 10 : -10), 0, 100);

  const analysis = `CVD 24h: ${cvdFmt} BTC — ${cvdPositive ? 'takers compradores dominaram o fluxo' : 'takers vendedores dominaram o fluxo'}. Retorno 1D: ${s.ret1d > 0 ? '+' : ''}${ret1dPct}%. Volume 24h: $${vol1dB}B. ${cvdPositive && !priceUp ? 'Divergência CVD positivo × preço negativo sugere acumulação silenciosa ou absorção de venda.' : !cvdPositive && priceUp ? 'Divergência CVD negativo × preço positivo pode indicar distribuição disfarçada — checar continuação.' : cvdPositive && priceUp ? 'Convergência positiva: compradores controlam o tape e o preço avança.' : 'Alinhamento negativo: pressão vendedora refletida no preço.'}`;

  return {
    score: Math.round(score),
    signal,
    direction,
    confidence: 0.64,
    probability,
    timeframe: '1h–4h',
    trigger: cvdPositive ? `CVD vira negativo OU Ret 1H < -0.8%` : `CVD vira positivo OU Ret 1H > +0.8%`,
    analysis,
  };
}

// ── Options module ────────────────────────────────────────────────────────────

function analyzeOptions(o: OptionsInput): ModuleAnalysis {
  const ivPct = (o.ivAtm * 100).toFixed(1);
  const skewPp = (o.skew * 100).toFixed(1);
  const regime = o.ivAtm > 0.75 ? 'EXTREMA' : o.ivAtm > 0.55 ? 'ELEVADA' : o.ivAtm > 0.35 ? 'NORMAL' : 'BAIXA';

  let direction: Direction;
  let signal: string;
  let score: number;
  let probability: number;

  if (o.ivAtm > 0.70 && o.skew < -0.005) {
    direction = 'bearish'; signal = 'HEDGING CRÍTICO · IV EXTREMA'; score = 72; probability = 0.65;
  } else if (o.skew < -0.005) {
    direction = 'bearish_bias'; signal = 'HEDGING ATIVO · PUT SKEW'; score = 60; probability = 0.57;
  } else if (o.pcrVol > 1.2) {
    direction = 'bearish_bias'; signal = 'PUT FLOW DOMINANTE'; score = 58; probability = 0.54;
  } else if (o.ivAtm < 0.35) {
    direction = 'neutral'; signal = 'BAIXA VOLATILIDADE · COMPLACÊNCIA'; score = 45; probability = 0.42;
  } else if (o.skew > 0.005) {
    direction = 'bullish_bias'; signal = 'CALL SKEW · VIÉS COMPRADOR'; score = 40; probability = 0.50;
  } else {
    direction = 'neutral'; signal = 'AMBIENTE NEUTRO DE OPÇÕES'; score = 50; probability = 0.48;
  }

  const analysis = `IV ATM: ${ivPct}% — regime ${regime}. Skew: ${o.skew > 0 ? '+' : ''}${skewPp}pp (${o.skew < -0.005 ? 'put skew ativo — mercado pagando prêmio por proteção downside' : o.skew > 0.005 ? 'call skew — mercado apostando em upside' : 'skew neutro'}). PCR vol: ${o.pcrVol.toFixed(2)} (${o.pcrVol > 1.1 ? 'puts dominando — sinal defensivo' : 'calls dominando — sinal ofensivo'}). ${o.maxPainDistancePct > 0 ? `Max pain ${o.maxPainDistancePct.toFixed(1)}% acima do spot — gravitação bullish de curto prazo.` : `Max pain ${Math.abs(o.maxPainDistancePct).toFixed(1)}% abaixo do spot — gravitação bearish de curto prazo.`}`;

  return {
    score: Math.round(score),
    signal,
    direction,
    confidence: 0.62,
    probability,
    timeframe: '1d–7d',
    trigger: o.skew < -0.005
      ? `IV ATM > 70% OU Skew < -5pp OU PCR > 1.3`
      : `IV ATM < 40% (complacência) OU Skew vira positivo`,
    analysis,
  };
}

// ── Macro module ──────────────────────────────────────────────────────────────

function analyzeMacro(m: MacroInput): ModuleAnalysis {
  const fng = m.fngValue;
  const isHighRisk = m.riskRegime === 'RISCO ELEVADO';
  const isHealthy = m.riskRegime === 'SAUDÁVEL';

  let direction: Direction;
  let signal: string;
  let score: number;
  let probability: number;

  if (isHighRisk || fng < 20) {
    direction = 'bearish'; signal = 'RISCO ELEVADO · CAPITAL CONSERVADOR'; score = 28; probability = 0.62;
  } else if (fng > 80) {
    direction = 'bearish_bias'; signal = 'GANÂNCIA EXTREMA · CAUTELA CONTRARIAN'; score = 35; probability = 0.55;
  } else if (isHealthy && fng >= 40 && fng <= 70) {
    direction = 'bullish'; signal = 'AMBIENTE SAUDÁVEL · BULLISH'; score = 66; probability = 0.58;
  } else if (fng < 35) {
    direction = 'bullish_bias'; signal = 'MEDO NO MERCADO · OPORTUNIDADE'; score = 42; probability = 0.52;
  } else {
    direction = 'neutral'; signal = 'AMBIENTE MISTO · MONITORAR'; score = 50; probability = 0.48;
  }

  const fngClass = fng > 75 ? 'Extreme Greed' : fng > 55 ? 'Greed' : fng > 45 ? 'Neutral' : fng > 25 ? 'Fear' : 'Extreme Fear';
  const riskLabel = isHighRisk ? '⚠️ elevado' : m.riskRegime === 'MODERADO' ? '🟡 moderado' : '✅ saudável';
  const analysis = `Risk Score composto: ${m.riskScore}/100 — ${riskLabel}. Fear & Greed: ${fng} (${m.fngLabel || fngClass}). ${fng > 75 ? 'Ganância extrema historicamente precede correções — sinal contrarian negativo.' : fng < 25 ? 'Medo extremo frequentemente coincide com fundos locais — potencial virada bullish.' : isHealthy ? 'Regime saudável com F&G equilibrado favorece continuação de tendência.' : 'Ambiente incerto — aguardar confirmação antes de adicionar exposição.'}`;

  return {
    score: Math.round(score),
    signal,
    direction,
    confidence: 0.58,
    probability,
    timeframe: '1d–7d',
    trigger: isHighRisk
      ? `Risk Score < 50 OU F&G > 55`
      : fng > 75 ? `F&G < 70 OU Risk Score > 60` : `F&G < 30 OU Risk Score > 65`,
    analysis,
  };
}

// ── Overall aggregation ───────────────────────────────────────────────────────

function aggregateOverall(
  d: ModuleAnalysis,
  s: ModuleAnalysis,
  o: ModuleAnalysis,
  m: ModuleAnalysis,
  weights: ModuleWeights = DEFAULT_WEIGHTS,
): RuleBasedAnalysis['overall'] {
  const pairs: [ModuleAnalysis, number][] = [
    [d, weights.derivatives],
    [s, weights.spot],
    [o, weights.options],
    [m, weights.macro],
  ];

  // Pesos somados por direção — substitui contagem simples
  const bearishScore = pairs
    .filter(([mod]) => mod.direction === 'bearish' || mod.direction === 'bearish_bias')
    .reduce((sum, [, w]) => sum + w, 0);
  const bullishScore = pairs
    .filter(([mod]) => mod.direction === 'bullish' || mod.direction === 'bullish_bias')
    .reduce((sum, [, w]) => sum + w, 0);

  // Médias ponderadas de probabilidade e confiança
  const avgProb = pairs.reduce((sum, [mod, w]) => sum + mod.probability * w, 0);
  const avgConf = pairs.reduce((sum, [mod, w]) => sum + mod.confidence * w, 0);

  let direction: Direction;
  let recommendation: string;
  // Thresholds calibrados para equivaler ao comportamento com pesos iguais (0.25 cada)
  if      (bearishScore >= 0.65)                              { direction = 'bearish';      recommendation = 'REDUZIR EXPOSIÇÃO · BEAR SINAL'; }
  else if (bearishScore >= 0.45 && bullishScore < 0.15)       { direction = 'bearish_bias'; recommendation = 'CAUTELA · REDUZIR LONGS'; }
  else if (bullishScore >= 0.65)                              { direction = 'bullish';      recommendation = 'AUMENTAR EXPOSIÇÃO · BULL SINAL'; }
  else if (bullishScore >= 0.45 && bearishScore < 0.15)       { direction = 'bullish_bias'; recommendation = 'VIÉS COMPRADOR · MONITORAR'; }
  else                                                        { direction = 'neutral';      recommendation = 'NEUTRO · AGUARDAR DEFINIÇÃO'; }

  const bearSignals = pairs.filter(([mod]) => mod.direction === 'bearish' || mod.direction === 'bearish_bias').map(([mod]) => mod.signal);
  const bullSignals = pairs.filter(([mod]) => mod.direction === 'bullish' || mod.direction === 'bullish_bias').map(([mod]) => mod.signal);

  const isCalibrated = Math.abs(weights.derivatives - 0.25) > 0.01;
  const weightNote = isCalibrated ? ' (pesos calibrados por histórico)' : '';
  const rationale = `Análise rule-based${weightNote}. ${bearishScore > bullishScore ? `Score bearish: ${(bearishScore * 100).toFixed(0)}% — sinais: ${bearSignals.join(', ')}.` : `Score bullish: ${(bullishScore * 100).toFixed(0)}% — sinais: ${bullSignals.join(', ')}.`} Score ponderado: ${pairs.reduce((a, [mod, w]) => a + mod.score * w, 0) | 0}/100. Prob. de continuação: ${(avgProb * 100).toFixed(0)}%.`;

  const bull_case = bullSignals.length > 0
    ? `${bullSignals.join(' + ')}. ${bullCount >= 2 ? 'Múltiplos módulos convergindo para sinal comprador.' : 'Sinal isolated — confirmar com volume e CVD.'}`
    : 'Sem sinais bullish ativos no momento. Aguardar reversão de funding ou CVD positivo.';

  const bear_case = bearSignals.length > 0
    ? `${bearSignals.join(' + ')}. ${bearCount >= 2 ? 'Convergência bearish sugere reduzir alavancagem.' : 'Sinal isolated — monitorar próximos ciclos de funding.'}`
    : 'Sem sinais bearish ativos no momento. Estrutura equilibrada.';

  const triggerModule = pairs.reduce((a, b) => a[0].probability > b[0].probability ? a : b)[0];

  return {
    recommendation,
    direction,
    confidence: parseFloat(avgConf.toFixed(2)),
    probability_correction: parseFloat(avgProb.toFixed(2)),
    timeframe: '4h–24h',
    trigger: triggerModule.trigger,
    rationale,
    bull_case,
    bear_case,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface RuleBasedInputs {
  derivatives?: DerivativesInput | null;
  spot?:        SpotInput | null;
  options?:     OptionsInput | null;
  macro?:       MacroInput | null;
}

/**
 * computeRuleBasedAnalysis — generates full AI analysis from live data inputs.
 * @param weights  Pesos por módulo (calibrados ou DEFAULT_WEIGHTS). Opcional.
 * Any null input module falls back to neutral/mock values.
 */
export function computeRuleBasedAnalysis(inputs: RuleBasedInputs, weights?: ModuleWeights): RuleBasedAnalysis {
  const deriv = inputs.derivatives
    ? analyzeDerivatives(inputs.derivatives)
    : { score: 50, signal: 'AGUARDANDO DADOS', direction: 'neutral' as Direction, confidence: 0.3, probability: 0.45, timeframe: '—', trigger: '—', analysis: 'Dados live não disponíveis.' };

  const spot = inputs.spot
    ? analyzeSpot(inputs.spot)
    : { score: 50, signal: 'AGUARDANDO DADOS', direction: 'neutral' as Direction, confidence: 0.3, probability: 0.45, timeframe: '—', trigger: '—', analysis: 'Dados live não disponíveis.' };

  const opts = inputs.options
    ? analyzeOptions(inputs.options)
    : { score: 50, signal: 'AGUARDANDO DADOS', direction: 'neutral' as Direction, confidence: 0.3, probability: 0.45, timeframe: '—', trigger: '—', analysis: 'Dados live não disponíveis.' };

  const macro = inputs.macro
    ? analyzeMacro(inputs.macro)
    : { score: 50, signal: 'AGUARDANDO DADOS', direction: 'neutral' as Direction, confidence: 0.3, probability: 0.45, timeframe: '—', trigger: '—', analysis: 'Dados live não disponíveis.' };

  return {
    generated_at: new Date(),
    model: 'rule-based-v1',
    overall: aggregateOverall(deriv, spot, opts, macro, weights),
    modules: { derivatives: deriv, spot, options: opts, macro },
  };
}
