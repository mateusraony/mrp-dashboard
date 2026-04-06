// ─── AUTOMATIONS / RULE ENGINE MOCK DATA ─────────────────────────────────────

// ─── AVAILABLE METRICS (menu para criar regras) ───────────────────────────────
export const AVAILABLE_METRICS = [
  // Regime
  { id: 'regime.label',      category: 'Regime',      label: 'Regime de Mercado',        type: 'enum',   options: ['Risk-On', 'Neutral', 'Risk-Off'],  unit: '',    example: 'Risk-On' },
  { id: 'regime.score',      category: 'Regime',      label: 'Regime Score',             type: 'number', operators: ['>', '<', '>=', '<=', '=='],      unit: 'pts', example: '62' },
  // Derivatives
  { id: 'funding.rate',      category: 'Derivatives', label: 'Funding Rate (atual)',     type: 'number', operators: ['>', '<', '>=', '<='],            unit: '%',   example: '0.08' },
  { id: 'oi.delta_1d',       category: 'Derivatives', label: 'OI Delta 1D',             type: 'number', operators: ['>', '<', '>=', '<='],            unit: '%',   example: '3.0' },
  { id: 'basis.annualized',  category: 'Derivatives', label: 'Basis Anualizado (Jun26)', type: 'number', operators: ['>', '<', '>=', '<='],            unit: '%',   example: '10.2' },
  { id: 'risk.long_flush',   category: 'Derivatives', label: 'Long Flush Risk Score',   type: 'number', operators: ['>=', '>'],                       unit: 'pts', example: '70' },
  // Macro
  { id: 'vix.value',         category: 'Macro',       label: 'VIX',                     type: 'number', operators: ['>', '<', '>=', '<='],            unit: '',    example: '25' },
  { id: 'dxy.delta_30d',     category: 'Macro',       label: 'DXY Delta 30D',           type: 'number', operators: ['>', '<', '>=', '<='],            unit: '%',   example: '-2.0' },
  { id: 'yield_spread',      category: 'Macro',       label: 'Yield Spread (10Y-2Y)',   type: 'number', operators: ['>', '<', '>=', '<='],            unit: 'bp',  example: '0' },
  // On-Chain
  { id: 'nupl.value',        category: 'On-Chain',    label: 'NUPL',                    type: 'number', operators: ['>', '<', '>=', '<='],            unit: '',    example: '0.75' },
  { id: 'netflow.24h',       category: 'On-Chain',    label: 'Exchange Netflow 24h',    type: 'number', operators: ['>', '<', '>=', '<='],            unit: 'BTC', example: '-5000' },
  // Stablecoin
  { id: 'stable.net_24h',    category: 'Stablecoin',  label: 'Stablecoin Net 24h',      type: 'number', operators: ['>', '<', '>=', '<='],            unit: 'M',   example: '300' },
  { id: 'stable.dev_7d',     category: 'Stablecoin',  label: 'Desvio vs Média 7D',      type: 'number', operators: ['>', '<', '>=', '<='],            unit: '%',   example: '150' },
  // BTC
  { id: 'btc.price',         category: 'BTC',         label: 'BTC Preço',               type: 'number', operators: ['>', '<', '>=', '<='],            unit: 'USD', example: '90000' },
  { id: 'btc.ret_1h',        category: 'BTC',         label: 'Retorno 1H',              type: 'number', operators: ['>', '<', '>=', '<='],            unit: '%',   example: '2.0' },
];

// ─── NOTIFICATION CHANNELS ────────────────────────────────────────────────────
export const NOTIFICATION_CHANNELS = [
  { id: 'telegram',  label: 'Telegram',   icon: '✈️',  color: '#2CA5E0', configured: true  },
  { id: 'in_app',    label: 'In-App',     icon: '🔔',  color: '#3b82f6', configured: true  },
  { id: 'email',     label: 'E-mail',     icon: '📧',  color: '#10b981', configured: false },
  { id: 'webhook',   label: 'Webhook',    icon: '🔗',  color: '#a78bfa', configured: false },
];

// ─── AUTOMATION RULES (defaults) ─────────────────────────────────────────────
export const defaultRules = [
  {
    id: 'rl001', name: 'Carry Trade Opportunity',
    enabled: true, priority: 'HIGH', color: '#10b981',
    conditions: [
      { metric_id: 'regime.label',     operator: '==', value: 'Risk-On',  logic: 'AND' },
      { metric_id: 'basis.annualized', operator: '<',  value: 5,          logic: null },
    ],
    action: { channel: 'telegram', message: '🎯 Carry Trade: Regime Risk-On + Basis < 5% ann. Setup potencial de cash-and-carry com custo baixo.' },
    cooldown_min: 240, last_fired: null, fire_count: 0,
    triggered: false,
    current_values: { 'regime.label': 'Neutral', 'basis.annualized': 10.2 },
  },
  {
    id: 'rl002', name: 'Long Flush Alert',
    enabled: true, priority: 'CRITICAL', color: '#ef4444',
    conditions: [
      { metric_id: 'risk.long_flush',  operator: '>=', value: 70, logic: 'AND' },
      { metric_id: 'funding.rate',     operator: '>=', value: 0.08, logic: null },
    ],
    action: { channel: 'telegram', message: '🚨 FLUSH RISK: Score ≥ 70 + Funding ≥ 0.08%. Probabilidade de liquidação em cascata elevada. Reduzir longs alavancados.' },
    cooldown_min: 60, last_fired: null, fire_count: 3,
    triggered: false,
    current_values: { 'risk.long_flush': 68, 'funding.rate': 0.0712 },
  },
  {
    id: 'rl003', name: 'Stablecoin Whale Alert',
    enabled: true, priority: 'HIGH', color: '#3b82f6',
    conditions: [
      { metric_id: 'stable.net_24h', operator: '>', value: 300, logic: 'AND' },
      { metric_id: 'stable.dev_7d',  operator: '>', value: 200, logic: null },
    ],
    action: { channel: 'in_app', message: '💧 Stablecoin mint anômalo: Net 24h > $300M e desvio > 200% vs 7D. Probabilidade de compra institucional em 6-24h.' },
    cooldown_min: 180, last_fired: new Date(Date.now() - 2 * 3600000), fire_count: 1,
    triggered: true,
    current_values: { 'stable.net_24h': 420.6, 'stable.dev_7d': 287.7 },
  },
  {
    id: 'rl004', name: 'Risk-Off + VIX Spike',
    enabled: true, priority: 'CRITICAL', color: '#ef4444',
    conditions: [
      { metric_id: 'regime.label', operator: '==', value: 'Risk-Off', logic: 'AND' },
      { metric_id: 'vix.value',    operator: '>=', value: 28,         logic: null },
    ],
    action: { channel: 'telegram', message: '🔴 RISK-OFF confirmado: Regime Risk-Off + VIX ≥ 28. Reduzir exposição imediatamente. Ver sugestões AI no módulo de Regime.' },
    cooldown_min: 120, last_fired: null, fire_count: 0,
    triggered: false,
    current_values: { 'regime.label': 'Neutral', 'vix.value': 22.14 },
  },
  {
    id: 'rl005', name: 'Yield Curve Inversão',
    enabled: false, priority: 'MEDIUM', color: '#f59e0b',
    conditions: [
      { metric_id: 'yield_spread', operator: '<', value: 0, logic: null },
    ],
    action: { channel: 'in_app', message: '📊 Yield curve invertida! 10Y-2Y < 0. Sinal recessivo histórico. Revise alocação em risco.' },
    cooldown_min: 1440, last_fired: null, fire_count: 0,
    triggered: false,
    current_values: { 'yield_spread': 28.1 },
  },
];

// ─── FIRE LOG ─────────────────────────────────────────────────────────────────
export const fireLog = [
  {
    id: 'fl001', rule_id: 'rl003', rule_name: 'Stablecoin Whale Alert',
    fired_at: new Date(Date.now() - 2 * 3600000),
    channel: 'in_app', priority: 'HIGH',
    message: '💧 Stablecoin mint anômalo: Net 24h > $300M e desvio > 200% vs 7D.',
    values_at_fire: { 'stable.net_24h': 420.6, 'stable.dev_7d': 287.7 },
  },
  {
    id: 'fl002', rule_id: 'rl002', rule_name: 'Long Flush Alert',
    fired_at: new Date(Date.now() - 18 * 3600000),
    channel: 'telegram', priority: 'CRITICAL',
    message: '🚨 FLUSH RISK: Score ≥ 70 + Funding ≥ 0.08%.',
    values_at_fire: { 'risk.long_flush': 71, 'funding.rate': 0.0842 },
  },
  {
    id: 'fl003', rule_id: 'rl002', rule_name: 'Long Flush Alert',
    fired_at: new Date(Date.now() - 2 * 86400000),
    channel: 'telegram', priority: 'CRITICAL',
    message: '🚨 FLUSH RISK: Score ≥ 70 + Funding ≥ 0.08%.',
    values_at_fire: { 'risk.long_flush': 74, 'funding.rate': 0.0901 },
  },
];

// ─── PRIORITY CONFIG ──────────────────────────────────────────────────────────
export const PRIORITY_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: '🔴' },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', icon: '🟠' },
  MEDIUM:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '🟡' },
  LOW:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)', icon: '🔵' },
};