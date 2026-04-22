// ─── SMART ALERTS MOCK DATA ───────────────────────────────────────────────────
import { btcFutures } from './mockData';
import { futuresBasis } from './mockDataExtended';
import { newsSentimentAggregate } from './mockDataNews';

export const SPOT_PRICE = 84298.70;

// ─── ALERT TYPES CONFIG ───────────────────────────────────────────────────────
export const ALERT_TYPES = {
  LONG_FLUSH: {
    id: 'LONG_FLUSH', label: 'Long Flush Risk',
    icon: '⬇️', color: '#ef4444',
    description: 'Risco de liquidação em cascata de posições compradas',
    defaultThreshold: 70,
  },
  SHORT_SQUEEZE: {
    id: 'SHORT_SQUEEZE', label: 'Short Squeeze Risk',
    icon: '⬆️', color: '#10b981',
    description: 'Risco de compra forçada de posições vendidas',
    defaultThreshold: 65,
  },
  FUNDING_EXTREME: {
    id: 'FUNDING_EXTREME', label: 'Funding Extremo',
    icon: '💸', color: '#f59e0b',
    description: 'Taxa de funding acima/abaixo de níveis históricos extremos',
    defaultThreshold: 0.10, // %
  },
  BASIS_DEVIATION: {
    id: 'BASIS_DEVIATION', label: 'Desvio de Basis',
    icon: '📐', color: '#a78bfa',
    description: 'Basis anualizado desviando significativamente da média',
    defaultThreshold: 3.0, // pp acima/abaixo da média
  },
  SENTIMENT_SHOCK: {
    id: 'SENTIMENT_SHOCK', label: 'Choque de Sentimento',
    icon: '🧠', color: '#06b6d4',
    description: 'Score de sentimento das notícias despencando para zona bearish',
    defaultThreshold: -0.5,
  },
  LIQUIDATION_CLUSTER: {
    id: 'LIQUIDATION_CLUSTER', label: 'Cluster de Liquidação',
    icon: '🔥', color: '#f97316',
    description: 'Preço se aproximando de zona densa de liquidações',
    defaultThreshold: 2.0, // % de distância
  },
  IV_SPIKE: {
    id: 'IV_SPIKE', label: 'Spike de IV',
    icon: '📊', color: '#8b5cf6',
    description: 'Volatilidade implícita em spike anormal intraday',
    defaultThreshold: 5.0, // % de aumento em 4h
  },
};

// ─── DEFAULT ALERT RULES ──────────────────────────────────────────────────────
export const defaultAlertRules = [
  {
    id: 'a0000001-0000-4000-8000-000000000001', type: 'LONG_FLUSH', enabled: true,
    label: 'Long Flush Score ≥ 70',
    condition: 'risk_score >= threshold',
    threshold: 70, threshold_unit: 'pontos',
    current_value: btcFutures.risk_score,        // 68 — quase no gatilho
    triggered: false,
    notify: ['in-app', 'badge'],
    cooldown_min: 60,
    last_triggered: null,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000002', type: 'FUNDING_EXTREME', enabled: true,
    label: 'Funding Rate ≥ 0.10%',
    condition: 'funding_rate >= threshold',
    threshold: 0.10, threshold_unit: '%',
    current_value: btcFutures.funding_rate * 100,  // 0.0712%
    triggered: false,
    notify: ['in-app'],
    cooldown_min: 120,
    last_triggered: new Date(Date.now() - 6 * 3600000),
  },
  {
    id: 'a0000001-0000-4000-8000-000000000003', type: 'BASIS_DEVIATION', enabled: true,
    label: 'Basis Jun-26 ≥ 13% ann.',
    condition: 'basis_annualized >= threshold',
    threshold: 13.0, threshold_unit: '% ann.',
    current_value: futuresBasis.futures[1].basis_annualized,  // ~9.8%
    triggered: false,
    notify: ['in-app'],
    cooldown_min: 240,
    last_triggered: null,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000004', type: 'SENTIMENT_SHOCK', enabled: true,
    label: 'Sentiment Score 24h ≤ −0.5',
    condition: 'sentiment_score <= threshold',
    threshold: -0.5, threshold_unit: 'score',
    current_value: newsSentimentAggregate.avg_score_24h,  // ~0.27
    triggered: false,
    notify: ['in-app'],
    cooldown_min: 180,
    last_triggered: null,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000005', type: 'LIQUIDATION_CLUSTER', enabled: true,
    label: 'Preço a ≤ 2% de cluster $83K',
    condition: 'price_distance_to_cluster <= threshold',
    threshold: 2.0, threshold_unit: '%',
    current_value: Math.abs((SPOT_PRICE - 83000) / 83000 * 100),  // ~1.55%
    triggered: true,    // JÁ ATIVADO — spot está a 1.55% do cluster $83K
    notify: ['in-app', 'badge'],
    cooldown_min: 30,
    last_triggered: new Date(Date.now() - 15 * 60000),
  },
  {
    id: 'a0000001-0000-4000-8000-000000000006', type: 'SHORT_SQUEEZE', enabled: false,
    label: 'Short Squeeze Score ≥ 65',
    condition: 'short_score >= threshold',
    threshold: 65, threshold_unit: 'pontos',
    current_value: 28,   // score atual de squeeze
    triggered: false,
    notify: ['in-app'],
    cooldown_min: 60,
    last_triggered: null,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000007', type: 'IV_SPIKE', enabled: true,
    label: 'IV ATM +5% em 4h',
    condition: 'iv_change_4h >= threshold',
    threshold: 5.0, threshold_unit: '%',
    current_value: 1.8,  // variação atual 4h
    triggered: false,
    notify: ['in-app'],
    cooldown_min: 120,
    last_triggered: null,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000008', type: 'FUNDING_EXTREME', enabled: false,
    label: 'Funding Rate ≤ −0.05% (short squeeze setup)',
    condition: 'funding_rate <= negative_threshold',
    threshold: -0.05, threshold_unit: '%',
    current_value: btcFutures.funding_rate * 100,
    triggered: false,
    notify: ['in-app'],
    cooldown_min: 120,
    last_triggered: null,
  },
];

// ─── ALERT HISTORY ────────────────────────────────────────────────────────────
export const alertHistory = [
  {
    id: 'ah001', type: 'LIQUIDATION_CLUSTER', triggered_at: new Date(Date.now() - 15 * 60000),
    message: 'BTC spot a 1.55% do cluster de liquidação em $83,000 ($142.4M em longs)',
    severity: 'HIGH', resolved: false,
    context: { spot: SPOT_PRICE, cluster_price: 83000, cluster_usd: 142_400_000 },
  },
  {
    id: 'ah002', type: 'LONG_FLUSH', triggered_at: new Date(Date.now() - 3 * 3600000),
    message: 'Long Flush Score atingiu 68/100 — próximo do threshold de 70',
    severity: 'MEDIUM', resolved: false,
    context: { score: 68, funding: 0.0712, oi_delta: 2.34 },
  },
  {
    id: 'ah003', type: 'FUNDING_EXTREME', triggered_at: new Date(Date.now() - 6 * 3600000),
    message: 'Funding rate atingiu 0.082% — acima da referência 1.6×',
    severity: 'MEDIUM', resolved: true,
    context: { rate: 0.082, reference: 0.05 },
  },
  {
    id: 'ah004', type: 'SENTIMENT_SHOCK', triggered_at: new Date(Date.now() - 18 * 3600000),
    message: 'Sentimento de notícias caiu para −0.71 após ata hawkish do Fed',
    severity: 'HIGH', resolved: true,
    context: { score: -0.71, source: 'Reuters', category: 'MACRO_POLICY' },
  },
];

// ─── RISK DASHBOARD METRICS ───────────────────────────────────────────────────
export const riskDashboard = {
  long_flush_score: btcFutures.risk_score,       // 68
  short_squeeze_score: 28,
  funding_current: btcFutures.funding_rate * 100, // 0.0712%
  funding_threshold_hi: 0.10,
  funding_threshold_lo: -0.05,
  basis_current: futuresBasis.futures[1].basis_annualized,
  basis_avg_30d: 8.4,
  basis_deviation: futuresBasis.futures[1].basis_annualized - 8.4,
  sentiment_24h: newsSentimentAggregate.avg_score_24h,
  nearest_liq_cluster: { price: 83000, distance_pct: Math.abs((SPOT_PRICE - 83000) / 83000 * 100), usd: 142_400_000 },
  total_active_alerts: alertHistory.filter(a => !a.resolved).length,
  total_triggered_rules: defaultAlertRules.filter(r => r.triggered).length,
};