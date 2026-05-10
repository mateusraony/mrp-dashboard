import { describe, it, expect } from 'vitest';
import { generateOpportunities, type OpportunityInputs } from '@/services/opportunitiesEngine';

const base: OpportunityInputs = {
  fundingRateBps: 0,
  fearGreedIndex: 50,
  riskScore:      50,
  ivRank:         50,
};

describe('generateOpportunities', () => {
  it('retorna array vazio quando nenhuma regra é disparada', () => {
    expect(generateOpportunities(base)).toEqual([]);
  });

  // Regra 1 — Funding alto
  it('dispara funding-high-short quando funding > 15bps', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: 20 });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('funding-high-short');
    expect(ops[0].direction).toBe('short');
  });

  it('funding-high-short confidence=high quando funding > 25bps', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: 30 });
    expect(ops[0].confidence).toBe('high');
  });

  it('funding-high-short confidence=medium quando 15 < funding <= 25bps', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: 20 });
    expect(ops[0].confidence).toBe('medium');
  });

  it('não dispara funding-high-short quando funding == 15bps (boundary)', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: 15 });
    expect(ops.find(o => o.id === 'funding-high-short')).toBeUndefined();
  });

  // Regra 2 — Funding negativo
  it('dispara funding-negative-long quando funding < -8bps', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: -10 });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('funding-negative-long');
    expect(ops[0].direction).toBe('long');
  });

  it('funding-negative-long confidence=high quando funding < -15bps', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: -20 });
    expect(ops[0].confidence).toBe('high');
  });

  it('funding-negative-long confidence=medium quando -15 <= funding < -8bps', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: -10 });
    expect(ops[0].confidence).toBe('medium');
  });

  it('não dispara funding-negative-long quando funding == -8bps (boundary)', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: -8 });
    expect(ops.find(o => o.id === 'funding-negative-long')).toBeUndefined();
  });

  // Regra 3 — Medo extremo + risco baixo
  it('dispara fear-contrarian-long quando fearGreed < 20 e riskScore < 25', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 15, riskScore: 20 });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('fear-contrarian-long');
    expect(ops[0].direction).toBe('long');
  });

  it('fear-contrarian-long confidence=high quando fearGreed < 10', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 5, riskScore: 20 });
    expect(ops[0].confidence).toBe('high');
  });

  it('fear-contrarian-long confidence=medium quando 10 <= fearGreed < 20', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 15, riskScore: 20 });
    expect(ops[0].confidence).toBe('medium');
  });

  it('não dispara fear-contrarian-long quando riskScore >= 25', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 15, riskScore: 30 });
    expect(ops.find(o => o.id === 'fear-contrarian-long')).toBeUndefined();
  });

  it('não dispara fear-contrarian-long quando fearGreed >= 20', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 25, riskScore: 20 });
    expect(ops.find(o => o.id === 'fear-contrarian-long')).toBeUndefined();
  });

  // Regra 4 — Ganância extrema + risco alto
  it('dispara greed-risk-short quando fearGreed > 80 e riskScore > 75', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 85, riskScore: 80 });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('greed-risk-short');
    expect(ops[0].direction).toBe('short');
  });

  it('greed-risk-short confidence=high quando fearGreed > 90', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 95, riskScore: 80 });
    expect(ops[0].confidence).toBe('high');
  });

  it('greed-risk-short confidence=medium quando 80 < fearGreed <= 90', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 85, riskScore: 80 });
    expect(ops[0].confidence).toBe('medium');
  });

  it('não dispara greed-risk-short quando riskScore <= 75', () => {
    const ops = generateOpportunities({ ...base, fearGreedIndex: 85, riskScore: 75 });
    expect(ops.find(o => o.id === 'greed-risk-short')).toBeUndefined();
  });

  // Regra 5 — IV Rank baixo
  it('dispara iv-low-buy-options quando ivRank < 20', () => {
    const ops = generateOpportunities({ ...base, ivRank: 15 });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('iv-low-buy-options');
    expect(ops[0].direction).toBe('neutral');
  });

  it('iv-low-buy-options confidence=high quando ivRank < 10', () => {
    const ops = generateOpportunities({ ...base, ivRank: 5 });
    expect(ops[0].confidence).toBe('high');
  });

  it('iv-low-buy-options confidence=low quando 10 <= ivRank < 20', () => {
    const ops = generateOpportunities({ ...base, ivRank: 15 });
    expect(ops[0].confidence).toBe('low');
  });

  it('não dispara iv-low-buy-options quando ivRank == 20 (boundary)', () => {
    const ops = generateOpportunities({ ...base, ivRank: 20 });
    expect(ops.find(o => o.id === 'iv-low-buy-options')).toBeUndefined();
  });

  // Regra 6 — IV Rank alto
  it('dispara iv-high-sell-premium quando ivRank > 80', () => {
    const ops = generateOpportunities({ ...base, ivRank: 85 });
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('iv-high-sell-premium');
    expect(ops[0].direction).toBe('neutral');
  });

  it('iv-high-sell-premium confidence=high quando ivRank > 90', () => {
    const ops = generateOpportunities({ ...base, ivRank: 95 });
    expect(ops[0].confidence).toBe('high');
  });

  it('iv-high-sell-premium confidence=medium quando 80 < ivRank <= 90', () => {
    const ops = generateOpportunities({ ...base, ivRank: 85 });
    expect(ops[0].confidence).toBe('medium');
  });

  // Multi-regra
  it('retorna múltiplas regras quando várias condições se aplicam', () => {
    const ops = generateOpportunities({
      fundingRateBps: 30,   // rule 1
      fearGreedIndex: 95,
      riskScore:      85,   // rule 4
      ivRank:         95,   // rule 6
    });
    expect(ops.length).toBe(3);
    expect(ops.map(o => o.id)).toContain('funding-high-short');
    expect(ops.map(o => o.id)).toContain('greed-risk-short');
    expect(ops.map(o => o.id)).toContain('iv-high-sell-premium');
  });

  it('retorna múltiplas regras no cenário de crash/medo extremo', () => {
    const ops = generateOpportunities({
      fundingRateBps: -20,  // rule 2
      fearGreedIndex: 5,    // rule 3 (+ low risk needed)
      riskScore:      20,   // rule 3
      ivRank:         5,    // rule 5
    });
    expect(ops.length).toBe(3);
    expect(ops.map(o => o.id)).toContain('funding-negative-long');
    expect(ops.map(o => o.id)).toContain('fear-contrarian-long');
    expect(ops.map(o => o.id)).toContain('iv-low-buy-options');
  });

  it('rationale menciona o valor do funding', () => {
    const ops = generateOpportunities({ ...base, fundingRateBps: 20 });
    expect(ops[0].rationale).toContain('20.0bps');
  });

  it('rationale menciona o iv rank', () => {
    const ops = generateOpportunities({ ...base, ivRank: 85 });
    expect(ops[0].rationale).toContain('85');
  });
});
