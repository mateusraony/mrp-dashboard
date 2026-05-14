// ─── SMART ALERTS — CENTRAL DE NOTIFICAÇÕES AI ───────────────────────────────
// Alertas automáticos do sistema + AI com sugestões
// Usuário configura prioridade e tipo de alerta — sem gestão de portfólio
import { useState, useEffect, useRef, useMemo } from 'react';
import { defaultAlertRules as defaultAlertRulesMock, alertHistory, riskDashboard, ALERT_TYPES } from '../components/data/mockDataAlerts';
import { useAlertRules, useUpsertAlertRule, useDeleteAlertRule } from '@/hooks/useSupabase';
import { AlertAuditPanel } from '../components/governance/AlertAuditPanel';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { DataQualityBadge } from '@/components/ui/DataQualityBadge';
import { formatDistanceToNow } from 'date-fns';
// ── Hooks de dados reais ────────────────────────────────────────────────────
import { useBtcTicker, useLiquidations, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useMultiVenueSnapshot } from '@/hooks/useMultiVenue';
import { IS_LIVE } from '@/lib/env';
import { logInfo, logError } from '@/lib/debugLog';
import { computeRuleBasedAnalysis } from '@/utils/ruleBasedAnalysis';

// ─── Componentes do Ciclo de Alertas ─────────────────────────────────────────
const cycleTypeConfig = {
  RISK_ON:      { emoji: '🟢', color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  RISK_OFF:     { emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  SQUEEZE_WATCH:{ emoji: '⚡', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  FLUSH_RISK:   { emoji: '🌊', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  MACRO_EVENT:  { emoji: '📅', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  OPTIONS_VOL:  { emoji: '📊', color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
};

function AlertCycleDetail({ alert }) {
  const c = cycleTypeConfig[alert.type] || cycleTypeConfig.MACRO_EVENT;
  return (
    <div style={{ background: '#111827', border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12, borderLeft: `3px solid ${c.color}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>{c.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{alert.title}</span>
        </div>
        <div style={{ fontSize: 11, color: '#4a5568', flexShrink: 0 }}>{formatDistanceToNow(alert.created_at, { addSuffix: true })}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
        <GradeBadge grade={alert.grade} />
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{alert.type}</span>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#0D1421', color: '#4a5568', border: '1px solid #1e2d45', fontFamily: 'JetBrains Mono, monospace' }}>{alert.asset}</span>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#0D1421', border: '1px solid #1e2d45' }}>
        {[['SCORE', alert.score, c.color, '/100'], ['PROB', `${Math.round(alert.prob * 100)}%`, '#e2e8f0', ''], ['CONF', `${Math.round(alert.conf * 100)}%`, '#8899a6', '']].map(([label, val, color, suffix]) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color }}>{val}<span style={{ fontSize: 11, color: '#4a5568', fontWeight: 400 }}>{suffix}</span></div>
          </div>
        ))}
      </div>
      {Object.keys(alert.metrics).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(alert.metrics).map(([k, v]) => (
            <div key={k} style={{ background: '#0D1421', border: '1px solid #1e2d45', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 9, color: '#2a3f5f', marginBottom: 2, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#8899a6', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: '1px solid #1e2d45', paddingTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f' }}>run: {alert.run_id}</span>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f' }}>cooldown: {alert.cooldown_min}min</span>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#2a3f5f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>key: {alert.dedupe_key}</span>
      </div>
    </div>
  );
}

const SPOT_PRICE = 84298.70;

// ─── CATEGORIAS DE ALERTAS ───────────────────────────────────────────────────
// Agrupadas por tipo de dado fonte
const CATEGORIES = [
  {
    id: 'derivatives', label: 'Derivatives', icon: '⟆', color: '#f59e0b',
    desc: 'Funding Rate, OI, Long/Short Ratio, Liquidações',
    types: ['LONG_FLUSH', 'SHORT_SQUEEZE', 'FUNDING_EXTREME'],
  },
  {
    id: 'onchain', label: 'On-Chain', icon: '⛓', color: '#10b981',
    desc: 'Netflow exchanges, Whale activity, NUPL/MVRV anomalias',
    types: ['LIQUIDATION_CLUSTER'],
  },
  {
    id: 'macro', label: 'Macro / Tradicional', icon: '⊞', color: '#60a5fa',
    desc: 'VIX spike, DXY breakout, Yields, Eventos de calendário',
    types: ['BASIS_DEVIATION'],
  },
  {
    id: 'sentiment', label: 'Sentimento / Notícias', icon: '🧠', color: '#a78bfa',
    desc: 'Score de notícias institucionais, reversão de sentimento',
    types: ['SENTIMENT_SHOCK', 'IV_SPIKE'],
  },
];

// ─── PRIORIDADES ─────────────────────────────────────────────────────────────
const PRIORITIES = [
  { id: 'CRITICAL', label: 'Crítico', color: '#ef4444', desc: 'Ação imediata necessária' },
  { id: 'HIGH',     label: 'Alto',    color: '#f97316', desc: 'Monitorar de perto' },
  { id: 'MEDIUM',   label: 'Médio',   color: '#f59e0b', desc: 'Observar tendência' },
  { id: 'LOW',      label: 'Baixo',   color: '#64748b', desc: 'Informativo' },
];

// ─── AI SUGGESTIONS (mock) ────────────────────────────────────────────────────
const AI_SUGGESTIONS = [
  {
    id: 'ai001', category: 'derivatives', priority: 'HIGH',
    title: 'Long Flush iminente — Funding persistente',
    reasoning: 'Funding rate em +0.0712% por 3 ciclos consecutivos com OI crescendo +13.7% na semana. Historicamente, quando funding mantém-se >0.06% por >24h com OI em expansão, a probabilidade de flush nas próximas 4-12h é de 62%. Padrão similar ocorreu em Nov 2022 (−12%) e Jan 2024 (−8%).',
    suggestion: 'Considere reduzir exposição direcional ou comprar proteção via put $82K. Aguardar funding cair abaixo de 0.04% antes de reentrada.',
    probability: 0.62, confidence: 0.74,
    trigger: 'Funding > 0.08% OU OI Delta 1H > +0.5%',
    data_sources: ['binance_futures', 'coinglass'],
    created_at: new Date(Date.now() - 25 * 60000),
  },
  {
    id: 'ai002', category: 'macro', priority: 'HIGH',
    title: 'CPI em 10 dias — Regime de alta IV',
    reasoning: 'IV ATM em 62.4% com term structure em leve contango indica que o mercado está precificando risco no curto prazo. CPI de Mar/26 em 12/Abr. Nos últimos 6 CPIs acima da estimativa, BTC caiu média de -4.2% nas 48h. O put skew ativo (-3.1pp) confirma hedging institucional.',
    suggestion: 'IV elevada = custo de proteção alto mas justificado. Se tiver posição comprada, straddle ou put spread reduz risco com custo controlado.',
    probability: 0.58, confidence: 0.81,
    trigger: 'CPI publicado OU IV ATM > 70%',
    data_sources: ['fred', 'deribit'],
    created_at: new Date(Date.now() - 3 * 3600000),
  },
  {
    id: 'ai003', category: 'onchain', priority: 'MEDIUM',
    title: 'Exchange netflow negativo — Acumulação de baleias',
    reasoning: 'Saída líquida de 4.820 BTC das exchanges em 24h + whale transactions +11.6% acima da média de 7 dias. LTH acumulando (+1.88% em 30d). Padrão de acumulação silenciosa tipicamente precede movimentos de alta de 2-4 semanas, mas pode ser distribuição disfarçada — checar CVD.',
    suggestion: 'Sinal ambíguo mas net positivo. Não tomar ação isolada — confirmar com CVD e funding. Se CVD virar negativo com netflow negativo = distribuição = sinal de venda.',
    probability: 0.54, confidence: 0.61,
    trigger: 'Netflow > +1.000 BTC em 24h (entrada = reversão)',
    data_sources: ['coinmetrics', 'mempool'],
    created_at: new Date(Date.now() - 6 * 3600000),
  },
  {
    id: 'ai004', category: 'sentiment', priority: 'LOW',
    title: 'Sentimento estável — Fear & Greed em 58',
    reasoning: 'Fear & Greed em 58 (Greed) com histórico de 7d estável entre 63-74. Sem extremos de sentimento no momento. Notícias institucionais com score médio +0.27. Ambiente de complacência moderada — sem divergência alarmante entre sentimento e dados on-chain.',
    suggestion: 'Manter monitoramento de rotina. Alerta será ativado se Fear & Greed superar 75 (Extreme Greed) ou cair abaixo de 35 (Fear).',
    probability: 0.28, confidence: 0.88,
    trigger: 'F&G > 75 OU F&G < 35 OU Sentimento notícias < -0.50',
    data_sources: ['alternative', 'gdelt'],
    created_at: new Date(Date.now() - 12 * 3600000),
  },
];

// Configurações de prioridade padrão (simulando preferências do usuário)
const DEFAULT_PREFS = {
  LONG_FLUSH: 'CRITICAL', SHORT_SQUEEZE: 'HIGH', FUNDING_EXTREME: 'HIGH',
  LIQUIDATION_CLUSTER: 'HIGH', BASIS_DEVIATION: 'MEDIUM',
  SENTIMENT_SHOCK: 'MEDIUM', IV_SPIKE: 'LOW',
};

function ProbBar({ value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#1a2535', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${Math.round(value * 100)}%`, background: `linear-gradient(90deg, ${color}70, ${color})` }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function RiskGauge({ label, icon, value, max = 100, threshold, color, sub }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  const triggered = Math.abs(value) >= Math.abs(threshold);
  return (
    <div style={{ background: triggered ? `${color}08` : '#0d1421', border: `1px solid ${triggered ? color + '35' : '#1a2535'}`, borderRadius: 10, padding: '12px 13px' }}>
      <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: triggered ? color : '#64748b', lineHeight: 1, marginBottom: 5 }}>
        {typeof value === 'number' && value > 0 ? '+' : ''}{typeof value === 'number' ? value.toFixed(value < 1 && value > -1 ? 4 : 1) : value}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: '#1a2535', overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: triggered ? color : `${color}40` }} />
      </div>
      {triggered && <div style={{ fontSize: 8, color, fontWeight: 800 }}>🔔 THRESHOLD ATINGIDO</div>}
      {!triggered && <div style={{ fontSize: 8, color: '#334155' }}>{sub}</div>}
    </div>
  );
}

function AISuggestionCard({ item, prefs }) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES.find(c => c.id === item.category);
  const prio = PRIORITIES.find(p => p.id === item.priority);

  return (
    <div style={{
      background: expanded ? `${prio.color}05` : '#0d1421',
      border: `1px solid ${expanded ? prio.color + '30' : '#1a2535'}`,
      borderLeft: `4px solid ${prio.color}`,
      borderRadius: 10, overflow: 'hidden',
      transition: 'all 0.15s',
    }}>
      {/* Header — clicável */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Cat icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${cat.color}14`, border: `1px solid ${cat.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginTop: 1,
        }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{item.title}</span>
            <span style={{ fontSize: 9, color: prio.color, background: `${prio.color}12`, border: `1px solid ${prio.color}25`, borderRadius: 3, padding: '1px 6px', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {prio.label.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, maxWidth: 200 }}>
              <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Prob.</div>
              <ProbBar value={item.probability} color={prio.color} />
            </div>
            <div style={{ flex: 1, minWidth: 120, maxWidth: 200 }}>
              <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Confiança</div>
              <ProbBar value={item.confidence} color="#475569" />
            </div>
            <div style={{ fontSize: 9, color: '#334155', whiteSpace: 'nowrap' }}>{formatDistanceToNow(item.created_at, { addSuffix: true })}</div>
          </div>
        </div>
        <span style={{ color: '#334155', fontSize: 11, flexShrink: 0, marginTop: 6 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1a2535' }}>
          {/* Reasoning */}
          <div style={{ marginTop: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 6 }}>🤖 Raciocínio da AI</div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7, background: '#070b14', padding: '10px 12px', borderRadius: 8, border: '1px solid #0f1d2e' }}>
              {item.reasoning}
            </div>
          </div>

          {/* Suggestion */}
          <div style={{ marginBottom: 10, padding: '10px 12px', background: `${prio.color}07`, border: `1px solid ${prio.color}20`, borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: prio.color, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>💡 Sugestão</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>{item.suggestion}</div>
          </div>

          {/* Trigger + Sources */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, padding: '8px 10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 7 }}>
              <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 700, marginBottom: 3 }}>🎯 GATILHO</div>
              <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{item.trigger}</div>
            </div>
            <div style={{ padding: '8px 10px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7 }}>
              <div style={{ fontSize: 8, color: '#334155', fontWeight: 700, marginBottom: 3 }}>FONTES</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {item.data_sources.map(s => (
                  <span key={s} style={{ fontSize: 9, color: '#475569', background: '#111827', border: '1px solid #1e2d45', borderRadius: 3, padding: '1px 5px', fontFamily: 'JetBrains Mono, monospace' }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRuleConfig({ rule, prefs, onToggle, onPriorityChange, onThresholdChange }) {
  const type = ALERT_TYPES[rule.type];
  const prio = PRIORITIES.find(p => p.id === (prefs[rule.type] || 'MEDIUM'));
  const [editing, setEditing] = useState(false);
  const [tmpTh, setTmpTh] = useState(rule.threshold);

  return (
    <div style={{
      background: rule.enabled ? '#0d1421' : 'transparent',
      border: `1px solid ${rule.enabled ? '#1a2535' : '#0f1a28'}`,
      borderRadius: 9, padding: '11px 13px',
      opacity: rule.enabled ? 1 : 0.5, transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Toggle */}
        <button onClick={() => onToggle(rule.id)} style={{
          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: rule.enabled ? prio.color : '#1a2535', position: 'relative', transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: rule.enabled ? 18 : 2,
            width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.2s',
          }} />
        </button>
        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11 }}>{type.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: rule.enabled ? '#e2e8f0' : '#334155' }}>{rule.label}</span>
            {rule.triggered && <span style={{ fontSize: 8, color: type.color, background: `${type.color}15`, border: `1px solid ${type.color}30`, borderRadius: 3, padding: '1px 5px', fontWeight: 800 }}>🔔 ATIVO</span>}
          </div>
          {/* Progress bar */}
          {rule.enabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#1a2535', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.abs(rule.current_value) / Math.abs(rule.threshold) * 100)}%`, background: rule.triggered ? type.color : `${type.color}50`, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#334155', whiteSpace: 'nowrap' }}>
                {typeof rule.current_value === 'number' ? rule.current_value.toFixed(rule.threshold_unit === '%' ? 4 : 1) : rule.current_value}
                {rule.threshold_unit} / {rule.threshold}{rule.threshold_unit}
              </span>
            </div>
          )}
        </div>
        {/* Priority selector */}
        <select value={prefs[rule.type] || 'MEDIUM'} onChange={e => onPriorityChange(rule.type, e.target.value)} style={{
          background: '#0d1421', border: `1px solid ${prio.color}35`, borderRadius: 5,
          color: prio.color, fontSize: 9, fontWeight: 700, padding: '2px 6px', cursor: 'pointer', outline: 'none',
        }}>
          {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {/* Threshold edit */}
        <div>
          {editing ? (
            <div style={{ display: 'flex', gap: 3 }}>
              <input type="number" value={tmpTh} onChange={e => setTmpTh(parseFloat(e.target.value))}
                style={{ width: 60, background: '#070b14', border: `1px solid rgba(59,130,246,0.4)`, borderRadius: 4, padding: '2px 5px', color: '#60a5fa', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }} />
              <button onClick={() => { onThresholdChange(rule.id, tmpTh); setEditing(false); }}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer' }}>✓</button>
              <button onClick={() => setEditing(false)}
                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{
              fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#475569',
              background: '#111827', border: '1px solid #1e2d45', borderRadius: 4, padding: '2px 7px', cursor: 'pointer',
            }}>{rule.threshold}{rule.threshold_unit}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cálculo de Short Squeeze Score a partir de liquidações ──────────────────
// Quando há mais liquidações de shorts (side=BUY) = pressão de squeeze
// Retorna score 0–100 proporcional à dominância de short-liq no volume total
function computeShortSqueezeScore(liquidations) {
  if (!liquidations || liquidations.length === 0) return null;
  const totalUsd  = liquidations.reduce((s, l) => s + l.usd_value, 0);
  const shortLiqUsd = liquidations
    .filter(l => l.side === 'BUY') // BUY = short foi liquidado
    .reduce((s, l) => s + l.usd_value, 0);
  if (totalUsd === 0) return null;
  // Score: % de liq que são de shorts × 100, limitado a 100
  return Math.min(100, Math.round((shortLiqUsd / totalUsd) * 100));
}

// ─── Cálculo de Long Flush Score a partir de liquidações ──────────────────────
// Quando há mais liquidações de longs (side=SELL) = risco de flush
function computeLongFlushScore(liquidations, riskScoreValue) {
  if (!liquidations || liquidations.length === 0) return riskScoreValue ?? null;
  const totalUsd   = liquidations.reduce((s, l) => s + l.usd_value, 0);
  const longLiqUsd = liquidations
    .filter(l => l.side === 'SELL') // SELL = long foi liquidado
    .reduce((s, l) => s + l.usd_value, 0);
  if (totalUsd === 0) return riskScoreValue ?? null;
  const liqScore = Math.min(100, Math.round((longLiqUsd / totalUsd) * 100));
  // Combina liq ratio (60%) + risk score composto (40%) para sinal mais robusto
  if (riskScoreValue != null) {
    return Math.round(liqScore * 0.6 + riskScoreValue * 0.4);
  }
  return liqScore;
}

// ─── Nearest Liquidation Cluster a partir de dados reais ─────────────────────
// Agrupa liquidações por faixas de preço de $500 e retorna a mais densa próxima ao spot
function computeNearestCluster(liquidations, spotPrice, mockCluster) {
  if (!liquidations || liquidations.length === 0 || !spotPrice) return mockCluster;
  // Agrupa em buckets de $500
  const BUCKET = 500;
  const buckets = {};
  for (const liq of liquidations) {
    const key = Math.round(liq.price / BUCKET) * BUCKET;
    if (!buckets[key]) buckets[key] = { price: key, usd: 0 };
    buckets[key].usd += liq.usd_value;
  }
  // Seleciona o bucket com maior volume em USD (excluindo spot ± 0.1%)
  const candidates = Object.values(buckets)
    .filter(b => Math.abs(b.price - spotPrice) / spotPrice > 0.001);
  if (candidates.length === 0) return mockCluster;
  const top = candidates.reduce((best, b) => b.usd > best.usd ? b : best, candidates[0]);
  const distance_pct = Math.abs(top.price - spotPrice) / spotPrice * 100;
  return { price: top.price, distance_pct, usd: top.usd };
}

export default function SmartAlerts() {
  // Carrega regras do Supabase (ou mock se não configurado)
  const { data: savedRules } = useAlertRules();
  const { mutate: saveRule } = useUpsertAlertRule();
  const { mutate: removeRule } = useDeleteAlertRule();

  // ── Hooks de dados reais ──────────────────────────────────────────────────
  const { data: ticker,       isLoading: tickerLoading,  isError: tickerError  } = useBtcTicker();
  const { data: liquidations, isLoading: liqLoading,    isError: liqError     } = useLiquidations(100);
  const { data: riskScore,    isLoading: riskLoading,   isError: riskError    } = useRiskScore();
  const { data: fngData } = useFearGreed(1);
  const multiVenue = useMultiVenueSnapshot();

  // ── Logging quando dados live carregam ───────────────────────────────────
  const _loggedRef = useRef(false);
  useEffect(() => {
    if (ticker && riskScore && !_loggedRef.current) {
      _loggedRef.current = true;
      logInfo('SmartAlerts gauges loaded', {
        funding:       ticker.last_funding_rate,
        riskScore:     riskScore.score,
        riskRegime:    riskScore.regime,
        liqCount:      liquidations?.length ?? 0,
        bybitFunding:  multiVenue.bybit?.funding_rate ?? null,
        okxFunding:    multiVenue.okx?.funding_rate   ?? null,
      }, 'alerts');
    }
    if (tickerError) logError('SmartAlerts ticker fetch failed', undefined, 'alerts');
    if (liqError)    logError('SmartAlerts liquidations fetch failed', undefined, 'alerts');
    if (riskError)   logError('SmartAlerts riskScore fetch failed', undefined, 'alerts');
  }, [ticker, riskScore, liquidations, tickerError, liqError, riskError, multiVenue]);

  // ── Valores calculados (com fallback para mock) ──────────────────────────
  const spotPrice       = ticker?.mark_price ?? SPOT_PRICE;
  const fundingCurrent  = ticker != null
    ? ticker.last_funding_rate * 100
    : riskDashboard.funding_current;
  const isFundingLive   = ticker != null;

  const longFlushScore  = computeLongFlushScore(liquidations, riskScore?.score);
  const longFlushLive   = longFlushScore != null;
  const longFlushVal    = longFlushLive ? longFlushScore : riskDashboard.long_flush_score;

  const shortSqueezeScore = computeShortSqueezeScore(liquidations);
  const shortSqueezeLive  = shortSqueezeScore != null;
  const shortSqueezeVal   = shortSqueezeLive ? shortSqueezeScore : riskDashboard.short_squeeze_score;

  const nearestCluster = computeNearestCluster(
    liquidations, spotPrice, riskDashboard.nearest_liq_cluster,
  );
  const isClusterLive  = liquidations != null && liquidations.length > 0;

  // Funding cross-venue: média das 3 exchanges quando disponível
  const fundingCrossVenue = (ticker && multiVenue.bybit && multiVenue.okx)
    ? (ticker.last_funding_rate * 100 + (multiVenue.bybit.funding_rate ?? 0) * 100 + (multiVenue.okx.funding_rate ?? 0) * 100) / 3
    : null;

  // ── Análise AI baseada em regras a partir de dados live ──────────────────────
  // Mapeia módulos de ruleBasedAnalysis para o formato esperado por AISuggestionCard
  const liveSuggestions = useMemo(() => {
    if (!IS_LIVE || (!ticker && !fngData && !riskScore)) return null;

    const analysis = computeRuleBasedAnalysis({
      derivatives: ticker ? {
        fundingRate:  ticker.last_funding_rate,
        oiDeltaPct:   ticker.oi_delta_pct ?? 0,
        openInterest: ticker.open_interest,
      } : undefined,
      spot: ticker ? {
        ret1d:        (ticker.price_change_pct ?? 0) / 100,
        cvd1d:        0,
        volume1dUsdt: ticker.volume_24h_usdt ?? 0,
        price:        ticker.mark_price,
      } : undefined,
      macro: fngData ? {
        fngValue:   fngData.value,
        fngLabel:   fngData.label,
        riskScore:  riskScore?.score ?? 50,
        riskRegime: riskScore?.regime ?? 'MODERADO',
      } : undefined,
    });

    // Mapa de módulo → metadados estáticos da UI
    const MODULE_META = {
      derivatives: {
        id: 'live001', category: 'derivatives',
        data_sources: ['binance_futures', 'coinglass'],
      },
      spot: {
        id: 'live002', category: 'derivatives',
        data_sources: ['binance_spot'],
      },
      options: {
        id: 'live003', category: 'sentiment',
        data_sources: ['deribit'],
      },
      macro: {
        id: 'live004', category: 'sentiment',
        data_sources: ['alternative', 'binance'],
      },
    };

    // Converte score 0–100 → prioridade UI
    const scoreToPriority = (score) => {
      if (score >= 70) return 'CRITICAL';
      if (score >= 58) return 'HIGH';
      if (score >= 45) return 'MEDIUM';
      return 'LOW';
    };

    const now = new Date();
    return Object.entries(analysis.modules).map(([key, mod], idx) => {
      const meta = MODULE_META[key];
      return {
        id:          meta.id,
        category:    meta.category,
        priority:    scoreToPriority(mod.score),
        title:       mod.signal,
        reasoning:   mod.analysis,
        suggestion:  `Gatilho: ${mod.trigger}. Timeframe esperado: ${mod.timeframe}.`,
        probability: mod.probability,
        confidence:  mod.confidence,
        trigger:     mod.trigger,
        data_sources: meta.data_sources,
        created_at:  new Date(now.getTime() - idx * 60000), // offset fictício p/ formatar tempo
      };
    });
  }, [ticker, fngData, riskScore]);

  // Sugestões ativas: usa live quando disponível, cai para mock estático
  const activeSuggestions = liveSuggestions ?? AI_SUGGESTIONS;

  // Estado local inicializado com dados do Supabase (ou mock como fallback)
  const [rules, setRules] = useState(defaultAlertRulesMock);
  const _seededRef = useRef(false);
  useEffect(() => {
    if (savedRules === undefined) return; // ainda carregando
    if (savedRules.length > 0) {
      // @ts-ignore — campos runtime adicionados aqui
      setRules(savedRules.map(r => ({ ...r, id: r.id ?? crypto.randomUUID(), current_value: 0, triggered: false, last_triggered: r.last_triggered ? new Date(r.last_triggered) : null })));
    } else if (!_seededRef.current) {
      // Primeira carga com DB vazio: semeia as regras padrão no Supabase
      _seededRef.current = true;
      defaultAlertRulesMock.forEach(r => saveRule({
        ...r,
        last_triggered: r.last_triggered instanceof Date
          ? r.last_triggered.toISOString()
          : r.last_triggered ?? null,
      }));
    }
  }, [savedRules]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [history, setHistory] = useState(alertHistory);
  const [tab, setTab] = useState('ai');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const _toSavable = rule => ({
    ...rule,
    last_triggered: rule.last_triggered instanceof Date
      ? rule.last_triggered.toISOString()
      : rule.last_triggered,
  });

  const toggleRule = id => {
    setRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const rule = rules.find(r => r.id === id);
    if (rule) saveRule(_toSavable({ ...rule, enabled: !rule.enabled }));
  };
  const changePriority = (type, p) => setPrefs(prev => ({ ...prev, [type]: p }));
  const changeThreshold = (id, val) => {
    setRules(rs => rs.map(r => r.id === id ? { ...r, threshold: val } : r));
    const rule = rules.find(r => r.id === id);
    if (rule) saveRule(_toSavable({ ...rule, threshold: val }));
  };
  const dismissAlert = id => setHistory(h => h.map(a => a.id === id ? { ...a, resolved: true } : a));

  const activeAlerts = history.filter(a => !a.resolved);
  const rd = riskDashboard;

  const filteredSuggestions = categoryFilter === 'all'
    ? activeSuggestions
    : activeSuggestions.filter(s => s.category === categoryFilter);

  const TABS = [
    { id: 'ai',        label: '🤖 AI & Sugestões',  badge: activeSuggestions.filter(s => s.priority === 'HIGH' || s.priority === 'CRITICAL').length },
    { id: 'active',    label: '🔔 Ativos',           badge: activeAlerts.length },
    { id: 'config',    label: '⚙️ Configurar',       badge: rules.filter(r => r.enabled).length },
    { id: 'history',   label: '📋 Histórico',        badge: null },
    { id: 'cycle',     label: '🔄 Ciclo',            badge: null },
    { id: 'auditoria', label: '🔍 Auditoria',        badge: null },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Central de Alertas</h1>
          <ModeBadge mode={IS_LIVE && ticker ? 'live' : 'mock'} />
          {activeAlerts.length > 0 && (
            <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, padding: '2px 8px', fontWeight: 800 }}>
              🔔 {activeAlerts.length} ativo{activeAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Monitoramento automático de mercado · AI identifica anomalias e emite sugestões · Configure prioridade e gatilhos por tipo de sinal
        </p>
      </div>

      {/* Risk gauges — sempre visíveis, conectados a dados reais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8, marginBottom: 16 }}>

        {/* Long Flush — derivado de liquidações (SELL side) + Risk Score composto */}
        <div>
          <RiskGauge label="Long Flush" icon="⬇️" value={longFlushVal} max={100} threshold={70} color="#ef4444" sub={`${Math.max(0, 70 - longFlushVal)}pts p/ ativar`} />
          <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <DataQualityBadge
              freshness={longFlushLive ? 100 : 0}
              completeness={longFlushLive ? 100 : 60}
              fallback_active={!longFlushLive}
              source={longFlushLive ? 'Binance' : 'MOCK'}
            />
          </div>
        </div>

        {/* Short Squeeze — derivado de liquidações (BUY side) */}
        <div>
          <RiskGauge label="Short Squeeze" icon="⬆️" value={shortSqueezeVal} max={100} threshold={65} color="#10b981" sub={`${Math.max(0, 65 - shortSqueezeVal)}pts p/ ativar`} />
          <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <DataQualityBadge
              freshness={shortSqueezeLive ? 100 : 0}
              completeness={shortSqueezeLive ? 100 : 60}
              fallback_active={!shortSqueezeLive}
              source={shortSqueezeLive ? 'Binance' : 'MOCK'}
            />
          </div>
        </div>

        {/* Funding Rate — useBtcTicker (Binance) + cross-venue Bybit/OKX */}
        <div>
          <RiskGauge
            label="Funding Rate"
            icon="💸"
            value={fundingCrossVenue ?? fundingCurrent}
            max={rd.funding_threshold_hi * 1.5}
            threshold={rd.funding_threshold_hi}
            color="#f59e0b"
            sub={fundingCrossVenue
              ? `Cross-venue avg · Threshold: ${rd.funding_threshold_hi}%`
              : `Threshold: ${rd.funding_threshold_hi}%`}
          />
          <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <DataQualityBadge
              freshness={isFundingLive ? 100 : 0}
              completeness={isFundingLive ? 100 : 60}
              fallback_active={!isFundingLive}
              source={fundingCrossVenue ? 'Cross-venue' : isFundingLive ? 'Binance' : 'MOCK'}
            />
          </div>
        </div>

        {/* Basis Dev. — sem hook real; mantém mock com badge explícito */}
        <div>
          <RiskGauge label="Basis Dev." icon="📐" value={rd.basis_deviation} max={5} threshold={3} color="#a78bfa" sub={`${rd.basis_current.toFixed(1)}% ann.`} />
          <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <DataQualityBadge freshness={0} completeness={60} fallback_active={true} source="MOCK" />
          </div>
        </div>

        {/* Sentimento — Fear & Greed real via Alternative.me quando disponível */}
        {(() => {
          const fngScore = fngData != null ? (fngData.value - 50) / 50 : null;
          const sentimentVal = fngScore != null ? Math.abs(fngScore) : Math.abs(rd.sentiment_24h);
          const sentimentSub = fngScore != null
            ? `F&G: ${fngData.value} · ${fngData.label}`
            : `Score: ${rd.sentiment_24h > 0 ? '+' : ''}${rd.sentiment_24h.toFixed(2)}`;
          const isSentLive = fngScore != null && IS_LIVE;
          return (
            <div>
              <RiskGauge label="Sentimento" icon="🧠" value={sentimentVal} max={1} threshold={0.5} color="#06b6d4" sub={sentimentSub} />
              <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <DataQualityBadge freshness={isSentLive ? 100 : 0} completeness={isSentLive ? 100 : 60} fallback_active={!isSentLive} source={isSentLive ? 'Alternative.me' : 'MOCK'} />
              </div>
            </div>
          );
        })()}

        {/* Cluster BTC — derivado de liquidações reais quando disponível */}
        <div>
          <RiskGauge
            label="Cluster BTC"
            icon="🔥"
            value={100 - nearestCluster.distance_pct * 10}
            max={100}
            threshold={80}
            color="#f97316"
            sub={`$${(nearestCluster.price / 1000).toFixed(0)}K · ${nearestCluster.distance_pct.toFixed(1)}% dist`}
          />
          <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <DataQualityBadge
              freshness={isClusterLive ? 100 : 0}
              completeness={isClusterLive ? 100 : 60}
              fallback_active={!isClusterLive}
              source={isClusterLive ? 'Binance' : 'MOCK'}
            />
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            background: 'transparent', color: tab === t.id ? '#60a5fa' : '#475569',
            borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s',
          }}>
            {t.label}
            {t.badge !== null && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8, background: tab === t.id ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.15)', color: tab === t.id ? '#60a5fa' : '#64748b' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── AI & SUGESTÕES ── */}
      {tab === 'ai' && (
        <>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setCategoryFilter('all')} style={{
              padding: '4px 12px', borderRadius: 20, border: `1px solid ${categoryFilter === 'all' ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
              background: categoryFilter === 'all' ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: categoryFilter === 'all' ? '#60a5fa' : '#475569', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            }}>Todos</button>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategoryFilter(c.id)} style={{
                padding: '4px 12px', borderRadius: 20, border: `1px solid ${categoryFilter === c.id ? c.color + '40' : '#1a2535'}`,
                background: categoryFilter === c.id ? `${c.color}12` : 'transparent',
                color: categoryFilter === c.id ? c.color : '#475569', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              }}>{c.icon} {c.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredSuggestions.map(s => <AISuggestionCard key={s.id} item={s} prefs={prefs} />)}
          </div>
          <div style={{ marginTop: 14, padding: '10px 13px', background: 'rgba(30,45,69,0.3)', border: '1px solid #1a2535', borderRadius: 9, fontSize: 10, color: '#334155', lineHeight: 1.7 }}>
            ⚠️ <strong style={{ color: '#475569' }}>Aviso:</strong> Todas as sugestões da AI são baseadas em dados quantitativos históricos e não constituem recomendação de investimento. Probabilidades são estimativas de modelos estatísticos, não garantias.
          </div>
        </>
      )}

      {/* ── ALERTAS ATIVOS ── */}
      {tab === 'active' && (
        <div>
          {activeAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Nenhum alerta ativo</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Todos os indicadores estão abaixo dos thresholds configurados</div>
            </div>
          ) : activeAlerts.map(a => {
            const type = ALERT_TYPES[a.type];
            const sc = a.severity === 'HIGH' ? '#ef4444' : '#f59e0b';
            return (
              <div key={a.id} style={{ background: `${sc}06`, border: `1px solid ${sc}25`, borderLeft: `4px solid ${sc}`, borderRadius: 10, padding: '13px 15px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13 }}>{type.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sc }}>{a.severity}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{type.label}</span>
                    <span style={{ fontSize: 9, color: '#334155' }}>{formatDistanceToNow(a.triggered_at, { addSuffix: true })}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 7 }}>{a.message}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(a.context).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 9, color: '#475569', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 3, padding: '1px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
                        {k}: {typeof v === 'number' ? v.toLocaleString() : String(v)}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => dismissAlert(a.id)} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #1e2d45', cursor: 'pointer', background: 'transparent', color: '#475569', fontSize: 10, flexShrink: 0, whiteSpace: 'nowrap' }}>Dispensar</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CONFIGURAR ── */}
      {tab === 'config' && (
        <div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>
            Configure a prioridade e os gatilhos de cada alerta. <strong style={{ color: '#64748b' }}>Toggle</strong> para ativar/desativar · Clique no <strong style={{ color: '#64748b' }}>threshold</strong> para editar · Selecione a <strong style={{ color: '#64748b' }}>prioridade</strong> para ordenar na aba AI.
          </div>
          {CATEGORIES.map(cat => {
            const catRules = rules.filter(r => cat.types.includes(r.type));
            return (
              <div key={cat.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{cat.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{cat.label}</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>— {cat.desc}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {catRules.map(r => (
                    <AlertRuleConfig key={r.id} rule={r} prefs={prefs} onToggle={toggleRule} onPriorityChange={changePriority} onThresholdChange={changeThreshold} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {tab === 'history' && (
        <div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 12 }}>
            {alertHistory.length} alertas registrados · {alertHistory.filter(a => a.resolved).length} resolvidos
          </div>
          {alertHistory.map(a => {
            const type = ALERT_TYPES[a.type];
            const sc = a.severity === 'HIGH' ? '#ef4444' : '#f59e0b';
            return (
              <div key={a.id} style={{ background: a.resolved ? 'transparent' : `${sc}05`, border: `1px solid ${a.resolved ? '#0f1a28' : sc + '20'}`, borderLeft: `3px solid ${a.resolved ? '#1a2535' : sc}`, borderRadius: 9, padding: '11px 13px', marginBottom: 7, opacity: a.resolved ? 0.55 : 1 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12 }}>{type.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: a.resolved ? '#334155' : sc }}>{a.severity}</span>
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{type.label}</span>
                  <span style={{ fontSize: 9, color: '#1e3048' }}>{formatDistanceToNow(a.triggered_at, { addSuffix: true })}</span>
                  {a.resolved && <span style={{ fontSize: 8, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 3, padding: '1px 5px' }}>✓ Resolvido</span>}
                </div>
                <div style={{ fontSize: 11, color: a.resolved ? '#334155' : '#94a3b8' }}>{a.message}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CICLO ── */}
      {tab === 'cycle' && (
        <div style={{ maxWidth: 1100 }}>
          <div style={{ marginBottom: 20, background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tipos de Alerta</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(cycleTypeConfig).map(([type, c]) => (
                <div key={type} style={{ padding: '4px 10px', borderRadius: 6, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                  {c.emoji} {type}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 20, padding: '12px 16px', background: (riskScore?.regime ?? 'NEUTRAL') === 'NEUTRAL' ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, marginBottom: 4 }}>
              Estado Global: {riskScore?.regime ?? '—'} · Score {riskScore?.score ?? '—'}/100
            </div>
            <div style={{ fontSize: 11, color: '#4a5568' }}>
              {(riskScore?.score ?? 50) >= 65 ? 'RISK-ON threshold não atingido' : (riskScore?.score ?? 50) <= 35 ? '🔴 RISK-OFF threshold atingido' : 'Zona neutra — monitorando'}{' '}
              (RISKON ≥ 65, RISKOFF ≤ 35)
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 12 }}>Ciclo atual · {history.length} alertas · Deduplicados · Anti-spam cooldown</div>
          {history.map(a => <AlertCycleDetail key={a.id} alert={{
            ...a,
            title:       a.title       ?? a.message ?? a.type,
            created_at:  a.created_at  ?? a.triggered_at,
            grade:       a.grade       ?? 'B',
            score:       a.score       ?? 50,
            prob:        a.prob        ?? 0.5,
            conf:        a.conf        ?? 0.5,
            metrics:     a.metrics     ?? {},
            run_id:      a.run_id      ?? `hist-${a.id}`,
            cooldown_min: a.cooldown_min ?? 60,
            dedupe_key:  a.dedupe_key  ?? a.id,
            asset:       a.asset       ?? 'BTC',
          }} />)}
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 8, fontSize: 11, color: '#4a5568' }}>
            <strong style={{ color: '#60a5fa' }}>Deduplicação:</strong> Cada alerta tem <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>dedupe_key</span> = (tipo + ativo + bucket). Cooldown padrão 60min previne spam.
          </div>
        </div>
      )}

      {/* ── AUDITORIA ── */}
      {tab === 'auditoria' && <AlertAuditPanel />}
    </div>
  );
}