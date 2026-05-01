// ─── AUTOMATIONS — Rule Engine Page ──────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import {
  defaultRules, fireLog, AVAILABLE_METRICS, NOTIFICATION_CHANNELS, PRIORITY_CONFIG,
} from '../components/data/mockDataAutomations';
import { ModeBadge } from '../components/ui/DataBadge';
import { formatDistanceToNow } from 'date-fns';
import { useBtcTicker } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const CATEGORIES = [...new Set(AVAILABLE_METRICS.map(m => m.category))];

function Badge({ label, color, bg, border }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, color, background: bg, border: `1px solid ${border}` }}>{label}</span>
  );
}

// ─── CONDITION CHIP ──────────────────────────────────────────────────────────
function ConditionChip({ cond, idx }) {
  const metric = AVAILABLE_METRICS.find(m => m.id === cond.metric_id);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {idx > 0 && cond.logic && (
        <span style={{ fontSize: 9, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 4, padding: '1px 6px', fontWeight: 800 }}>
          {cond.logic}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, padding: '4px 8px' }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{metric?.label || cond.metric_id}</span>
        <span style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{cond.operator}</span>
        <span style={{ fontSize: 10, color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
          {typeof cond.value === 'string' ? `"${cond.value}"` : cond.value}
          {metric?.unit ? ` ${metric.unit}` : ''}
        </span>
      </div>
    </div>
  );
}

// ─── RULE CARD ───────────────────────────────────────────────────────────────
function RuleCard({ rule, onToggle, onSelect, selected }) {
  const pc = PRIORITY_CONFIG[rule.priority];
  const ch = NOTIFICATION_CHANNELS.find(c => c.id === rule.action.channel);
  return (
    <div onClick={() => onSelect(rule.id)} style={{
      background: selected ? '#131e2e' : '#111827',
      border: `1px solid ${selected ? rule.color + '50' : rule.triggered ? rule.color + '30' : '#1e2d45'}`,
      borderLeft: `4px solid ${rule.color}`,
      borderRadius: 11, padding: '13px 15px', cursor: 'pointer',
      transition: 'all 0.14s',
      boxShadow: selected ? `0 0 16px ${rule.color}12` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{rule.name}</span>
            <Badge label={rule.priority} color={pc.color} bg={pc.bg} border={pc.border} />
            {rule.triggered && <Badge label="ATIVO" color="#10b981" bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.25)" />}
          </div>
          <div style={{ fontSize: 9, color: '#334155' }}>
            {ch?.icon} {ch?.label} · Cooldown {rule.cooldown_min}min · Disparos: {rule.fire_count}
          </div>
        </div>
        {/* Toggle */}
        <div onClick={e => { e.stopPropagation(); onToggle(rule.id); }} style={{
          width: 38, height: 20, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
          background: rule.enabled ? rule.color : '#1a2535',
          position: 'relative', transition: 'background 0.2s',
          border: `1px solid ${rule.enabled ? rule.color : '#2a3f5f'}`,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 1, transition: 'left 0.2s',
            left: rule.enabled ? 19 : 1,
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }} />
        </div>
      </div>
      {/* Conditions */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {rule.conditions.map((c, i) => <ConditionChip key={i} cond={c} idx={i} />)}
      </div>
      {/* Current values */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(rule.current_values).map(([key, val]) => {
          const metric = AVAILABLE_METRICS.find(m => m.id === key);
          const cond = rule.conditions.find(c => c.metric_id === key);
          const exceeded = cond ? (
            cond.operator === '>'  ? val > cond.value :
            cond.operator === '>=' ? val >= cond.value :
            cond.operator === '<'  ? val < cond.value :
            cond.operator === '<=' ? val <= cond.value :
            String(val) === String(cond.value)
          ) : false;
          return (
            <div key={key} style={{ fontSize: 9, color: '#334155' }}>
              {metric?.label || key}: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: exceeded ? '#10b981' : '#475569', fontWeight: 700 }}>
                {typeof val === 'number' ? val.toFixed(val < 1 ? 4 : 1) : val}{metric?.unit ? ` ${metric.unit}` : ''}
              </span>
              {exceeded && <span style={{ color: '#10b981', marginLeft: 3 }}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RULE BUILDER FORM ────────────────────────────────────────────────────────
function RuleBuilder({ onSave, onCancel }) {
  const [name, setName]       = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [conditions, setConditions] = useState([{ metric_id: '', operator: '>', value: '', logic: null }]);
  const [channel, setChannel] = useState('telegram');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(60);

  const addCondition = () => setConditions(prev => [...prev, { metric_id: '', operator: '>', value: '', logic: 'AND' }]);
  const removeCondition = (i) => setConditions(prev => prev.filter((_, idx) => idx !== i));
  const updateCond = (i, key, val) => setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: val } : c));

  const inputStyle = {
    background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6,
    color: '#e2e8f0', fontSize: 11, padding: '6px 10px', width: '100%',
    outline: 'none',
  };
  const labelStyle = { fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, display: 'block' };

  return (
    <div style={{ background: '#111827', border: '1px solid #2a3f5f', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 16 }}>➕ Nova Regra de Automação</div>

      {/* Name + Priority */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Nome da Regra</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Carry Trade Alert" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Prioridade</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            {Object.keys(PRIORITY_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Conditions */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Condições (SE)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conditions.map((cond, i) => {
            const selectedMetric = AVAILABLE_METRICS.find(m => m.id === cond.metric_id);
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {i > 0 && (
                  <select value={cond.logic || 'AND'} onChange={e => updateCond(i, 'logic', e.target.value)}
                    style={{ ...inputStyle, width: 68, flexShrink: 0 }}>
                    <option>AND</option><option>OR</option>
                  </select>
                )}
                {i === 0 && <span style={{ fontSize: 10, color: '#475569', minWidth: 26 }}>SE</span>}

                {/* Metric selector — grouped by category */}
                <select value={cond.metric_id} onChange={e => updateCond(i, 'metric_id', e.target.value)}
                  style={{ ...inputStyle, flex: '2 1 160px' }}>
                  <option value="">Selecionar métrica…</option>
                  {CATEGORIES.map(cat => (
                    <optgroup key={cat} label={cat}>
                      {AVAILABLE_METRICS.filter(m => m.category === cat).map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {/* Operator */}
                <select value={cond.operator} onChange={e => updateCond(i, 'operator', e.target.value)}
                  style={{ ...inputStyle, width: 60, flexShrink: 0 }}>
                  {(selectedMetric?.operators || ['>', '<', '>=', '<=', '==']).map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                  {selectedMetric?.type === 'enum' && <option value="==">==</option>}
                </select>

                {/* Value */}
                {selectedMetric?.type === 'enum' ? (
                  <select value={cond.value} onChange={e => updateCond(i, 'value', e.target.value)}
                    style={{ ...inputStyle, flex: '1 1 120px' }}>
                    <option value="">Valor…</option>
                    {selectedMetric.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input type="number" value={cond.value} onChange={e => updateCond(i, 'value', e.target.value)}
                    placeholder={selectedMetric?.example || '0'}
                    style={{ ...inputStyle, flex: '1 1 80px' }} />
                )}
                {selectedMetric?.unit && <span style={{ fontSize: 9, color: '#334155', flexShrink: 0 }}>{selectedMetric.unit}</span>}

                {conditions.length > 1 && (
                  <button onClick={() => removeCondition(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>✕</button>
                )}
              </div>
            );
          })}
          <button onClick={addCondition} style={{ background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.3)', borderRadius: 6, color: '#60a5fa', cursor: 'pointer', fontSize: 10, padding: '6px', fontWeight: 700 }}>
            + Adicionar condição
          </button>
        </div>
      </div>

      {/* Action */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Ação — Enviar via</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {NOTIFICATION_CHANNELS.map(ch_opt => (
            <button key={ch_opt.id} onClick={() => setChannel(ch_opt.id)} style={{
              padding: '5px 12px', borderRadius: 7,
              background: channel === ch_opt.id ? `${ch_opt.color}18` : 'transparent',
              border: `1px solid ${channel === ch_opt.id ? ch_opt.color + '50' : '#1a2535'}`,
              color: channel === ch_opt.id ? ch_opt.color : '#475569',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
            }}>
              {ch_opt.icon} {ch_opt.label}
              {!ch_opt.configured && <span style={{ fontSize: 8, color: '#334155', marginLeft: 4 }}>(não configurado)</span>}
            </button>
          ))}
        </div>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Mensagem do alerta... Use {metric} para inserir valores dinâmicos"
          style={{ ...inputStyle, height: 72, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
      </div>

      {/* Cooldown */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Cooldown (minutos entre disparos)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[30, 60, 120, 240, 480, 1440].map(v => (
            <button key={v} onClick={() => setCooldown(v)} style={{
              padding: '4px 10px', borderRadius: 6,
              background: cooldown === v ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: `1px solid ${cooldown === v ? 'rgba(59,130,246,0.4)' : '#1a2535'}`,
              color: cooldown === v ? '#60a5fa' : '#475569',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
            }}>{v === 1440 ? '24h' : v >= 60 ? `${v/60}h` : `${v}m`}</button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ name, priority, conditions, channel, message, cooldown })}
          style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
          💾 Salvar Regra
        </button>
        <button onClick={onCancel}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid #1a2535', color: '#475569', cursor: 'pointer', fontSize: 11 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function RuleDetail({ rule, onClose }) {
  if (!rule) return null;
  const pc = PRIORITY_CONFIG[rule.priority];
  const ch = NOTIFICATION_CHANNELS.find(c => c.id === rule.action.channel);
  const ruleLogs = fireLog.filter(l => l.rule_id === rule.id);
  return (
    <div style={{ background: '#111827', border: `1px solid ${rule.color}30`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>{rule.name}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Badge label={rule.priority} color={pc.color} bg={pc.bg} border={pc.border} />
            <Badge label={rule.enabled ? 'ATIVO' : 'DESATIVADO'} color={rule.enabled ? '#10b981' : '#334155'} bg={rule.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(51,65,85,0.3)'} border={rule.enabled ? 'rgba(16,185,129,0.25)' : '#1a2535'} />
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Logic */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Lógica</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rule.conditions.map((c, i) => <ConditionChip key={i} cond={c} idx={i} />)}
        </div>
      </div>

      {/* Action */}
      <div style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ação</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 14 }}>{ch?.icon}</span>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{ch?.label}</span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, fontStyle: 'italic' }}>"{rule.action.message}"</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 8, color: '#334155' }}>COOLDOWN</div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {rule.cooldown_min >= 60 ? `${rule.cooldown_min / 60}h` : `${rule.cooldown_min}m`}
          </div>
        </div>
        <div style={{ background: '#0d1421', borderRadius: 7, padding: '8px 10px' }}>
          <div style={{ fontSize: 8, color: '#334155' }}>DISPAROS TOTAL</div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{rule.fire_count}</div>
        </div>
      </div>

      {/* Fire log */}
      {ruleLogs.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Histórico de Disparos</div>
          {ruleLogs.map(log => (
            <div key={log.id} style={{ padding: '8px 10px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 7, marginBottom: 5 }}>
              <div style={{ fontSize: 9, color: '#334155', marginBottom: 2 }}>{formatDistanceToNow(log.fired_at, { addSuffix: true })}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{log.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── METRICS MONITOR PANEL ────────────────────────────────────────────────────
function MetricsMonitor({ liveMetrics }) {
  // Valores estáticos de fallback para métricas ainda sem feed live
  const staticFallback = {
    'regime.label': 'Neutral', 'regime.score': 58,
    'oi.delta_1d': 2.34, 'basis.annualized': 10.2, 'risk.long_flush': 68,
    'vix.value': 22.14, 'dxy.delta_30d': -3.4, 'yield_spread': 28.1,
    'nupl.value': 0.48, 'netflow.24h': -4820, 'stable.net_24h': 420.6,
    'stable.dev_7d': 287.7, 'btc.ret_1h': 0.31,
  };
  // Mescla: valores live sobrepõem o fallback estático
  const liveValues = { ...staticFallback, ...liveMetrics };
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>📡 Métricas Monitoradas em Tempo Real</span>
        <ModeBadge />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {CATEGORIES.map(cat => (
          <div key={cat}>
            <div style={{ fontSize: 8, color: '#1e3048', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 0 3px' }}>{cat}</div>
            {AVAILABLE_METRICS.filter(m => m.category === cat).map(m => {
              const val = liveValues[m.id];
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #0f1a28' }}>
                  <span style={{ fontSize: 10, color: '#475569' }}>{m.label}</span>
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontWeight: 700 }}>
                    {val !== undefined ? (typeof val === 'number' ? (Math.abs(val) < 1 ? val.toFixed(4) : val.toFixed(1)) : val) : '—'}
                    {m.unit ? ` ${m.unit}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AVALIAÇÃO DE CONDIÇÃO ────────────────────────────────────────────────────
function evalCondition(cond, metricsMap) {
  const val = metricsMap[cond.metric_id];
  if (val === undefined) return false;
  switch (cond.operator) {
    case '>':  return val >  cond.value;
    case '>=': return val >= cond.value;
    case '<':  return val <  cond.value;
    case '<=': return val <= cond.value;
    default:   return String(val) === String(cond.value);
  }
}

function evaluateRule(rule, metricsMap) {
  if (!rule.enabled) return false;
  let result = evalCondition(rule.conditions[0], metricsMap);
  for (let i = 1; i < rule.conditions.length; i++) {
    const cond = rule.conditions[i];
    const res  = evalCondition(cond, metricsMap);
    result = cond.logic === 'OR' ? result || res : result && res;
  }
  return result;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TABS = ['Regras Ativas', 'Criar Regra', 'Histórico', 'Métricas'];

export default function Automations() {
  const [rules, setRules]         = useState(defaultRules);
  const [tab, setTab]             = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // ── Hooks de dados live ──────────────────────────────────────────────────
  const { data: ticker }    = useBtcTicker();
  const { data: riskScore } = useRiskScore();

  // ── Mapa de valores live para as métricas presentes no AVAILABLE_METRICS ──
  const liveMetrics = useMemo(() => ({
    'btc.price':    ticker?.mark_price        ?? 84312,
    'funding.rate': ticker
      ? ticker.last_funding_rate * 100        // decimal → percentual (%unit)
      : 0.0712,
    'risk.long_flush': riskScore?.score       ?? 68,
  }), [ticker, riskScore]);

  // ── Sincroniza current_values das regras com dados live ──────────────────
  useEffect(() => {
    setRules(/** @type {any} */ (prev => prev.map(rule => {
      // Atualiza apenas as chaves que temos dado live
      const updatedCurrentValues = { ...rule.current_values };
      Object.keys(liveMetrics).forEach(key => {
        if (key in updatedCurrentValues) {
          updatedCurrentValues[key] = liveMetrics[key];
        }
      });
      // Reavalia se a regra está disparada com dados atuais
      const allMetrics = { ...rule.current_values, ...liveMetrics };
      const triggered  = evaluateRule({ ...rule, current_values: updatedCurrentValues }, allMetrics);
      return { ...rule, current_values: updatedCurrentValues, triggered };
    })));
  }, [liveMetrics]); // re-roda sempre que dado live chegar

  const selectedRule = rules.find(r => r.id === selectedId);
  const active = rules.filter(r => r.enabled).length;
  const triggered = rules.filter(r => r.triggered).length;

  const toggleRule = (id) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const saveRule = (data) => {
    const newRule = {
      id: `rl${Date.now()}`, ...data,
      conditions: data.conditions,
      action: { channel: data.channel, message: data.message },
      cooldown_min: data.cooldown,
      enabled: true, fire_count: 0, triggered: false, last_fired: null,
      current_values: {},
      color: PRIORITY_CONFIG[data.priority]?.color || '#3b82f6',
    };
    setRules(prev => [newRule, ...prev]);
    setTab(0);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Automações & Alertas</h1>
          <ModeBadge />
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Crie regras baseadas em métricas de mercado · Disparos via Telegram · In-App · Webhook</p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Regras Ativas',   value: active,      color: '#10b981' },
          { label: 'Disparadas Hoje', value: triggered,   color: '#ef4444' },
          { label: 'Total no Log',    value: fireLog.length, color: '#60a5fa' },
          { label: 'Métricas Monit.', value: AVAILABLE_METRICS.length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 9, padding: '10px 13px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #0f1d2e', marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); if (i === 1) setShowBuilder(true); else setShowBuilder(false); }} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 11,
            fontWeight: tab === i ? 700 : 400, background: 'transparent',
            color: tab === i ? '#60a5fa' : '#475569',
            borderBottom: tab === i ? '2px solid #3b82f6' : '2px solid transparent',
          }}>{t}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <button onClick={() => setTab(1)} style={{ padding: '5px 14px', borderRadius: 7, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 800 }}>
            ➕ Nova Regra
          </button>
        </div>
      </div>

      {/* ── REGRAS ATIVAS ── */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 360px' : '1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map(rule => (
              <RuleCard key={rule.id} rule={rule} onToggle={toggleRule}
                onSelect={setSelectedId} selected={selectedId === rule.id} />
            ))}
          </div>
          {selectedId && <RuleDetail rule={selectedRule} onClose={() => setSelectedId(null)} />}
        </div>
      )}

      {/* ── CRIAR REGRA ── */}
      {tab === 1 && (
        <RuleBuilder onSave={saveRule} onCancel={() => setTab(0)} />
      )}

      {/* ── HISTÓRICO ── */}
      {tab === 2 && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #0f1a28' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Log de Disparos</div>
          </div>
          {fireLog.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 11 }}>Nenhum disparo registrado ainda.</div>
          )}
          {fireLog.map(log => {
            const pc = PRIORITY_CONFIG[log.priority];
            const ch = NOTIFICATION_CHANNELS.find(c => c.id === log.channel);
            return (
              <div key={log.id} style={{ padding: '11px 16px', borderBottom: '1px solid #0f1a28', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 16 }}>{pc?.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{log.rule_name}</span>
                    <Badge label={log.priority} color={pc?.color} bg={pc?.bg} border={pc?.border} />
                    <span style={{ fontSize: 9, color: '#334155' }}>{ch?.icon} {ch?.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5, marginBottom: 4 }}>{log.message}</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Object.entries(log.values_at_fire).map(([k, v]) => {
                      const metric = AVAILABLE_METRICS.find(m => m.id === k);
                      return <span key={k} style={{ fontSize: 9, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>{metric?.label || k}: {typeof v === 'number' ? v.toFixed(4) : v}</span>;
                    })}
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#334155', flexShrink: 0, textAlign: 'right' }}>{formatDistanceToNow(log.fired_at, { addSuffix: true })}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MÉTRICAS ── */}
      {tab === 3 && <MetricsMonitor liveMetrics={liveMetrics} />}
    </div>
  );
}