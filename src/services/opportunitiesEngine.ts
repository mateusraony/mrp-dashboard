/**
 * opportunitiesEngine.ts — Motor de geração de oportunidades de trading.
 *
 * Módulo puro (zero side effects, zero fetch).
 * Recebe snapshot de dados de mercado e retorna as regras disparadas.
 */

export type Direction = 'long' | 'short' | 'neutral';
export type Confidence = 'high' | 'medium' | 'low';

export interface Opportunity {
  id:         string;
  rule:       string;
  direction:  Direction;
  confidence: Confidence;
  rationale:  string;
}

export interface OpportunityInputs {
  fundingRateBps: number;   // funding rate em basis points (decimal * 10_000)
  fearGreedIndex: number;   // 0–100
  riskScore:      number;   // 0–100
  ivRank:         number;   // 0–100 (iv_atm * 100, proxy)
}

/**
 * Avalia as 6 regras de oportunidade e retorna apenas as disparadas.
 */
export function generateOpportunities(inputs: OpportunityInputs): Opportunity[] {
  const { fundingRateBps, fearGreedIndex, riskScore, ivRank } = inputs;
  const result: Opportunity[] = [];

  // Regra 1 — Funding muito positivo → short ou aguarda correção
  if (fundingRateBps > 15) {
    result.push({
      id:         'funding-high-short',
      rule:       'Funding > 15bps',
      direction:  'short',
      confidence: fundingRateBps > 25 ? 'high' : 'medium',
      rationale:  `Funding elevado (${fundingRateBps.toFixed(1)}bps) sinaliza excesso de longs — pressão de correção`,
    });
  }

  // Regra 2 — Funding negativo → long (longs pagos pelos shorts)
  if (fundingRateBps < -8) {
    result.push({
      id:         'funding-negative-long',
      rule:       'Funding < -8bps',
      direction:  'long',
      confidence: fundingRateBps < -15 ? 'high' : 'medium',
      rationale:  `Funding negativo (${fundingRateBps.toFixed(1)}bps) — longs recebem; shorts em excesso`,
    });
  }

  // Regra 3 — Medo extremo + risco baixo → long contrário
  if (fearGreedIndex < 20 && riskScore < 25) {
    result.push({
      id:         'fear-contrarian-long',
      rule:       'Fear < 20 & RiskScore < 25',
      direction:  'long',
      confidence: fearGreedIndex < 10 ? 'high' : 'medium',
      rationale:  `Medo extremo (FnG=${fearGreedIndex}) + risco sistêmico baixo (${riskScore}) — sinal contrário`,
    });
  }

  // Regra 4 — Ganância extrema + risco alto → short
  if (fearGreedIndex > 80 && riskScore > 75) {
    result.push({
      id:         'greed-risk-short',
      rule:       'Greed > 80 & RiskScore > 75',
      direction:  'short',
      confidence: fearGreedIndex > 90 ? 'high' : 'medium',
      rationale:  `Ganância extrema (FnG=${fearGreedIndex}) + risco elevado (${riskScore}) — topo potencial`,
    });
  }

  // Regra 5 — IV muito baixo → compra de opções (vol barata)
  if (ivRank < 20) {
    result.push({
      id:         'iv-low-buy-options',
      rule:       'IV Rank < 20',
      direction:  'neutral',
      confidence: ivRank < 10 ? 'high' : 'low',
      rationale:  `IV Rank baixo (${ivRank.toFixed(0)}) — volatilidade implícita barata; oportunidade de compra de opções`,
    });
  }

  // Regra 6 — IV muito alto → venda de prêmio
  if (ivRank > 80) {
    result.push({
      id:         'iv-high-sell-premium',
      rule:       'IV Rank > 80',
      direction:  'neutral',
      confidence: ivRank > 90 ? 'high' : 'medium',
      rationale:  `IV Rank alto (${ivRank.toFixed(0)}) — volatilidade implícita cara; venda de prêmio favorável`,
    });
  }

  return result;
}
