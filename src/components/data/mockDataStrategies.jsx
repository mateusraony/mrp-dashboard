// ─── STRATEGIES MOCK DATA ─────────────────────────────────────────────────────
// Setups operacionais baseados em IV Rank, Basis, Funding, Sentiment
// Cada estratégia tem: setup, entrada, saída, probabilidade histórica, risco

import { ivRank, futuresBasis, optionsTakerFlow } from './mockDataExtended';

// ─── ENGINE DE SCORING ────────────────────────────────────────────────────────
// Verifica condições reais dos dados para scoring das estratégias

const spot = 84298.70;
const ivr = ivRank.iv_rank;           // 52.7
const fundingRate = 0.000712;         // 0.0712%
const basis3m = futuresBasis.futures[1].basis_annualized; // ~9.8% ann.
const us10y = 4.512;
const carrySpread = basis3m - us10y;  // ~5.3pp
const bullBearIdx = optionsTakerFlow.bull_bear_index; // 0.117

// ─── ESTRATÉGIAS ──────────────────────────────────────────────────────────────
export const strategies = [
  // ─── 1. CASH-AND-CARRY ────────────────────────────────────────────────────
  {
    id: 'S001',
    name: 'Cash-and-Carry (Carry Trade)',
    category: 'arbitrage',
    category_label: 'Arbitragem',
    category_color: '#10b981',
    status: 'ACTIVE',                  // ACTIVE | WATCH | INACTIVE
    status_reason: `Basis anualizado ${basis3m.toFixed(1)}% vs US10Y ${us10y}% = spread de ${carrySpread.toFixed(1)}pp > threshold 3pp`,
    probability_historical: 0.84,
    profit_factor: 2.4,                // histórico: 2.4:1 risk/reward
    recommended: true,
    urgency: 'HIGH',

    // Condições de entrada
    conditions: [
      { label: 'Basis ann. > US10Y + 3pp', met: carrySpread > 3, value: `${basis3m.toFixed(1)}% vs ${us10y}%`, detail: `Spread: +${carrySpread.toFixed(1)}pp` },
      { label: 'Funding positivo (longs pagam)', met: fundingRate > 0, value: `${(fundingRate * 100).toFixed(4)}%`, detail: 'Compra spot recebe funding de shorts' },
      { label: 'IV ATM < 70% (sem stress extremo)', met: ivRank.iv_current < 0.70, value: `${(ivRank.iv_current * 100).toFixed(1)}%`, detail: 'Volatilidade moderada' },
    ],
    conditions_met: 3,
    conditions_total: 3,

    // Setup
    entry: {
      leg1: { action: 'BUY', instrument: 'BTC Spot (ou IBIT ETF)', price: `$${spot.toLocaleString()}`, sizing: '1 BTC' },
      leg2: { action: 'SELL', instrument: 'BTC-Jun-27-2026 Futures', price: '$87,240', sizing: '1 BTC' },
      net_cost_pct: 0,
      carry_earned_ann: `+${basis3m.toFixed(1)}%`,
    },
    exit: {
      trigger: 'Vencimento do futuro (Jun-27-2026) ou basis < 4%',
      stop: 'Basis cair < US10Y (carry negativo)',
      max_hold: '108 dias',
    },
    metrics: {
      carry_spread_pp: carrySpread,
      basis_annualized: basis3m,
      net_return_ann_est: carrySpread,
      max_drawdown_hist: 2.1,
      sharpe_hist: 2.8,
    },
    explanation: `Com o futuro de Jun-26 negociando a $87,240 (+${futuresBasis.futures[1].basis_pct.toFixed(2)}%), comprar 1 BTC spot e vender o futuro captura ~${carrySpread.toFixed(1)}pp anualizados acima do US10Y. Trade neutro ao preço (delta zero), risco principal é contraparte/exchange. Funding positivo adiciona P&L extra enquanto o carry se realiza.`,
    risk_warnings: [
      'Risco de execução: spread bid/ask ao abrir/fechar posição',
      'Risco de margem: futures mark-to-market — manter collateral adequado',
      'Risco de contraparte em exchange não regulada',
    ],
    history_pnl: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      pnl: parseFloat((i * (carrySpread / 365) + (Math.random() - 0.5) * 0.05).toFixed(3)),
    })),
  },

  // ─── 2. SHORT VOL — CREDIT SPREAD ────────────────────────────────────────
  {
    id: 'S002',
    name: 'Short Vol — Bull Put Spread',
    category: 'options_vol',
    category_label: 'Options Vol',
    category_color: '#a78bfa',
    status: 'WATCH',
    status_reason: `IVR ${ivr.toFixed(1)}% em zona Neutra — aguardar IVR > 60 para execução ideal`,
    probability_historical: 0.68,
    profit_factor: 1.8,
    recommended: false,
    urgency: 'MEDIUM',

    conditions: [
      { label: 'IVR > 60 (vol cara — sell)', met: ivr > 60, value: `IVR ${ivr.toFixed(1)}%`, detail: ivr > 60 ? 'Condição atingida' : `Faltam ${(60 - ivr).toFixed(1)}pp para atingir` },
      { label: 'Put/Call Ratio > 0.8 (hedging ativo)', met: true, value: 'P/C 0.82', detail: 'Compradores de put pagando prêmio elevado' },
      { label: 'NUPL > 0.4 (mercado em lucro, menos pânico)', met: true, value: 'NUPL 0.48', detail: 'Zona de Crença — risco de capitulação baixo' },
    ],
    conditions_met: 2,
    conditions_total: 3,

    entry: {
      leg1: { action: 'SELL', instrument: 'BTC Put $82,000 (Mar-28)', price: '$1,840 prêmio', sizing: '1 contrato' },
      leg2: { action: 'BUY', instrument: 'BTC Put $80,000 (Mar-28)', price: '$1,120 prêmio', sizing: '1 contrato' },
      net_cost_pct: 0,
      carry_earned_ann: '+$720 net premium',
    },
    exit: {
      trigger: 'Vencimento (Mar-28) ou recompra com 50% do prêmio capturado',
      stop: 'Preço BTC < $83,500 (fechar imediatamente)',
      max_hold: '18 dias',
    },
    metrics: {
      max_profit: 720,
      max_loss: 1280,
      breakeven: 81280,
      prob_profit_hist: 0.72,
      theta_per_day: 40,
    },
    explanation: `Vender o put $82K e comprar proteção em $80K cria um spread de crédito com risco limitado. Prêmio líquido recebido: $720/contrato. Lucro máximo se BTC mantiver acima de $82K no vencimento. Com IVR em ${ivr.toFixed(1)}%, opções ainda em zona neutra — ideal acima de 60 para maximizar o prêmio coletado. Monitorar condição IVR.`,
    risk_warnings: [
      'Perda máxima limitada a $1,280 por contrato (diferença de strikes - prêmio)',
      'Executar somente quando IVR > 60 para melhor edge histórico',
      'Gap risk: movimento rápido abaixo de $80K pode não permitir stop',
    ],
    history_pnl: Array.from({ length: 18 }, (_, i) => ({
      day: i + 1,
      pnl: parseFloat((Math.min(720, i * 40 + (Math.random() - 0.5) * 50) / 720 * 100).toFixed(1)),
    })),
  },

  // ─── 3. LONG VOL — STRADDLE ──────────────────────────────────────────────
  {
    id: 'S003',
    name: 'Long Vol — ATM Straddle (Pre-FOMC)',
    category: 'options_vol',
    category_label: 'Options Vol',
    category_color: '#a78bfa',
    status: 'WATCH',
    status_reason: 'FOMC em 19/Mar (8 dias) — janela de compra de volatilidade se abre em ~5 dias',
    probability_historical: 0.61,
    profit_factor: 2.1,
    recommended: false,
    urgency: 'LOW',

    conditions: [
      { label: 'Evento macro Tier-1 em < 10 dias', met: true, value: 'FOMC 19/Mar', detail: '8 dias para o evento' },
      { label: 'IVR < 50 (vol barata — comprar)', met: ivr < 50, value: `IVR ${ivr.toFixed(1)}%`, detail: ivr < 50 ? 'Vol barata — bom momento' : 'Vol ainda neutra/cara' },
      { label: 'Term Structure em contango (curto >longo)', met: true, value: 'Front-back: +1.0pp', detail: 'Mercado ansioso no curto prazo' },
    ],
    conditions_met: 2,
    conditions_total: 3,

    entry: {
      leg1: { action: 'BUY', instrument: 'BTC Call $84,000 (Mar-28)', price: '$2,840 prêmio', sizing: '1 contrato' },
      leg2: { action: 'BUY', instrument: 'BTC Put $84,000 (Mar-28)', price: '$2,620 prêmio', sizing: '1 contrato' },
      net_cost_pct: 0,
      carry_earned_ann: '-$5,460 custo total',
    },
    exit: {
      trigger: 'Move > 6.5% em qualquer direção OU 2 dias antes do FOMC',
      stop: 'Perda de 40% do prêmio pago ($2,184)',
      max_hold: '12 dias',
    },
    metrics: {
      breakeven_up: 84000 + 5460,
      breakeven_down: 84000 - 5460,
      move_needed_pct: 6.48,
      ivr_threshold: 50,
      theta_per_day: -455,
    },
    explanation: `Comprar straddle ATM antes do FOMC captura o aumento de IV (vega) e o move direcional pós-anúncio. BTC precisa mover >6.5% ($5,460) para breakeven. Historicamente, FOMC hawkish/dovish surprise move BTC 4-12% em 24h. Risco: IV crush pós-evento destrói valor mesmo com move adequado — sair antes ou imediatamente após.`,
    risk_warnings: [
      'IV Crush pós-evento pode zerar ganho direcional (sair antes do evento)',
      'Theta (decaimento temporal): -$455/dia — tempo é inimigo',
      'Breakeven requer move de 6.5% — eventos inline não geram lucro',
    ],
    history_pnl: null,
  },

  // ─── 4. FUNDING HARVEST ───────────────────────────────────────────────────
  {
    id: 'S004',
    name: 'Funding Rate Harvest (Delta-Neutral)',
    category: 'arbitrage',
    category_label: 'Arbitragem',
    category_color: '#10b981',
    status: 'ACTIVE',
    status_reason: `Funding em ${(fundingRate * 100).toFixed(4)}% — 1.4× acima da referência (0.05%). Short perp + Long spot = coletando funding`,
    probability_historical: 0.91,
    profit_factor: 3.2,
    recommended: true,
    urgency: 'HIGH',

    conditions: [
      { label: 'Funding > 0.06% (acima referência)', met: fundingRate > 0.0006, value: `${(fundingRate * 100).toFixed(4)}%`, detail: '+42% acima da referência' },
      { label: 'Funding positivo por >3 ciclos consecutivos', met: true, value: '8 ciclos consecutivos', detail: 'Tendência estável de longs pagando' },
      { label: 'OI crescendo (longs acumulando)', met: true, value: 'OI +2.34% 1D', detail: 'Posicionamento comprado se expandindo' },
    ],
    conditions_met: 3,
    conditions_total: 3,

    entry: {
      leg1: { action: 'BUY', instrument: 'BTC Spot $84,298', price: `$${spot.toLocaleString()}`, sizing: '1 BTC' },
      leg2: { action: 'SELL', instrument: 'BTC-USDT Perpetual Short', price: `$${(spot + 14).toFixed(0)}`, sizing: '1 BTC' },
      net_cost_pct: 0,
      carry_earned_ann: `+${(fundingRate * 3 * 365 * 100).toFixed(1)}% ann. (funding)`,
    },
    exit: {
      trigger: 'Funding cair abaixo de 0.04% por 2 ciclos consecutivos',
      stop: 'Funding negativo (posição inverte)',
      max_hold: 'Rolling — sem prazo fixo',
    },
    metrics: {
      funding_8h: (fundingRate * 100).toFixed(4) + '%',
      funding_daily: (fundingRate * 3 * 100).toFixed(4) + '%',
      funding_ann: (fundingRate * 3 * 365 * 100).toFixed(1) + '%',
      delta_exposure: 0,
      risk_adjusted: 'Baixo (delta-neutral)',
    },
    explanation: `Funding rate de ${(fundingRate * 100).toFixed(4)}% a cada 8h = ${(fundingRate * 3 * 100).toFixed(3)}%/dia = ${(fundingRate * 3 * 365 * 100).toFixed(1)}% anualizado. Com posição delta-neutral (long spot + short perp), o trader coleta o funding pago pelos longs sem exposição direcional. Estratégia de baixo risco mas requer gestão ativa de collateral e monitoramento do funding.`,
    risk_warnings: [
      'Funding pode reverter para negativo — monitorar cada ciclo de 8h',
      'Risco de exchange: manter collateral em exchange separada do spot',
      'Slippage na abertura/fechamento come parte do retorno',
    ],
    history_pnl: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      pnl: parseFloat((i * fundingRate * 3 * 100 + (Math.random() - 0.5) * 0.002).toFixed(4)),
    })),
  },

  // ─── 5. MACRO HEDGE ──────────────────────────────────────────────────────
  {
    id: 'S005',
    name: 'Macro Hedge — Put Spread FOMC',
    category: 'hedge',
    category_label: 'Hedge',
    category_color: '#f59e0b',
    status: 'WATCH',
    status_reason: 'FOMC em 8 dias — janela de hedge antes do evento de risco binário',
    probability_historical: 0.54,
    profit_factor: 3.8,
    recommended: false,
    urgency: 'MEDIUM',

    conditions: [
      { label: 'Evento macro Tier-1 em < 14 dias', met: true, value: 'FOMC 19/Mar', detail: '8 dias para o evento' },
      { label: 'VIX > 20 (ambiente de risco adverso)', met: true, value: 'VIX 22.14', detail: '+14.1% no mês — stress crescendo' },
      { label: 'Funding positivo (longs vulneráveis)', met: true, value: `${(fundingRate * 100).toFixed(4)}%`, detail: 'Flush de longs amplia move bearish' },
    ],
    conditions_met: 3,
    conditions_total: 3,

    entry: {
      leg1: { action: 'BUY', instrument: 'BTC Put $82,000 (Mar-28)', price: '$1,840 prêmio', sizing: '1 contrato' },
      leg2: { action: 'SELL', instrument: 'BTC Put $79,000 (Mar-28)', price: '$980 prêmio', sizing: '1 contrato' },
      net_cost_pct: 0,
      carry_earned_ann: '-$860 custo do hedge',
    },
    exit: {
      trigger: 'FOMC event day ou BTC > $87,000 (hedge desnecessário)',
      stop: 'Perda total do prêmio ($860)',
      max_hold: '18 dias',
    },
    metrics: {
      max_profit: 3000 - 860,
      cost: 860,
      breakeven: 82000 - 860,
      protection_from: 82000,
      protection_to: 79000,
      payoff_ratio: (3000 - 860) / 860,
    },
    explanation: `Hedge assimétrico para proteger posições long BTC contra surprise hawkish do FOMC. Custo de $860 por contrato protege de $82K até $79K (zona de maior concentração de longs liquidáveis). Payoff ratio 2.5:1. Economicamente eficiente dado cenário de funding elevado + VIX em alta.`,
    risk_warnings: [
      'Hedge protege apenas de $82K até $79K — quedas maiores não cobertas',
      'Custo de $860 é perdido se BTC não cair abaixo de $82K',
      'FOMC inline (sem surpresa) = hedge expira sem valor',
    ],
    history_pnl: null,
  },

  // ─── 6. ETF PREMIUM ARBI ─────────────────────────────────────────────────
  {
    id: 'S006',
    name: 'ETF NAV Arbitrage (GBTC→IBIT Rotation)',
    category: 'arbitrage',
    category_label: 'Arbitragem',
    category_color: '#10b981',
    status: 'INACTIVE',
    status_reason: 'GBTC atualmente negociando com desconto de 0.2% — spread insuficiente para arb líquido',
    probability_historical: 0.78,
    profit_factor: 1.6,
    recommended: false,
    urgency: 'LOW',

    conditions: [
      { label: 'GBTC discount > 1.5%', met: false, value: 'Desconto atual: 0.2%', detail: 'Abaixo do threshold de arb' },
      { label: 'IBIT premium > 0.3%', met: false, value: 'IBIT premium: 0.05%', detail: 'Spread insuficiente' },
      { label: 'Diferencial de taxas > custo de transação', met: false, value: 'GBTC: 1.5% vs IBIT: 0.25%', detail: 'Custo de rotação ativo' },
    ],
    conditions_met: 0,
    conditions_total: 3,

    entry: {
      leg1: { action: 'SELL', instrument: 'GBTC (Grayscale)', price: 'NAV - 1.5%', sizing: 'A definir' },
      leg2: { action: 'BUY', instrument: 'IBIT (BlackRock)', price: 'NAV + 0.05%', sizing: 'Equivalente' },
      net_cost_pct: 0,
      carry_earned_ann: '+1.25% estimado (diferencial de fees + desconto)',
    },
    exit: {
      trigger: 'Desconto GBTC fechar para < 0.3%',
      stop: 'N/A — rotação estrutural sem risco direcional',
      max_hold: '6–12 meses',
    },
    metrics: {
      gbtc_fee: '1.50% aa',
      ibit_fee: '0.25% aa',
      fee_saving_ann: '1.25% aa',
      liquidity: 'Alta — ambos listados em bolsas reguladas',
    },
    explanation: `Rotação de GBTC (fee 1.5%) para IBIT (fee 0.25%) captura 1.25% ao ano em economia de taxa mais qualquer desconto de NAV no GBTC. Setup atualmente inativo — desconto muito pequeno. Monitorar: quando GBTC desconto > 1.5%, a rotação torna-se atrativa.`,
    risk_warnings: [
      'Imposto sobre ganhos de capital na venda do GBTC pode superar o benefício',
      'Liquidez pode variar — executar em blocos para minimizar impacto de mercado',
    ],
    history_pnl: null,
  },
];

// ─── MARKET CONDITIONS SUMMARY ────────────────────────────────────────────────
export const marketConditionsSummary = {
  updated_at: new Date(),
  conditions: {
    ivr: { value: ivRank.iv_rank, label: 'IV Rank', status: ivRank.iv_rank < 25 ? 'buy_vol' : ivRank.iv_rank > 75 ? 'sell_vol' : 'neutral', color: '#f59e0b' },
    basis: { value: basis3m, label: 'Basis Ann.', status: basis3m > us10y + 3 ? 'carry_on' : 'carry_off', color: '#10b981' },
    funding: { value: fundingRate * 100, label: 'Funding 8h', status: fundingRate > 0.0006 ? 'harvest' : 'normal', color: '#f59e0b' },
    bull_bear: { value: bullBearIdx, label: 'Bull-Bear Idx', status: bullBearIdx > 0.2 ? 'bullish' : bullBearIdx < -0.2 ? 'bearish' : 'neutral', color: '#94a3b8' },
  },
  active_setups: strategies.filter(s => s.status === 'ACTIVE').length,
  watch_setups: strategies.filter(s => s.status === 'WATCH').length,
  recommended: strategies.filter(s => s.recommended),
};