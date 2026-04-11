// ─── CALENDÁRIO MACRO — CPI · FOMC · NFP · Volatilidade Histórica · Alertas ──
import { useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, BarChart, Legend,
} from 'recharts';
import { macroEvents, eventVolatilityData, avgVolatilityByEvent, getNextTier1Event } from '../components/data/mockDataMacroCalendar';
import { ModeBadge } from '../components/ui/DataBadge';
import GoldenRule from '../components/ui/GoldenRule';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendNotificationEmail } from '@/lib/notificationClient';

const AGENCY_COLOR = {
  BLS: '#3b82f6', Fed: '#a78bfa', BEA: '#10b981', ISM: '#f59e0b', default: '#64748b',
};

const RESULT_COLOR = { above: '#ef4444', below: '#10b981', inline: '#f59e0b' };
const RESULT_LABEL = { above: '▲ Acima', below: '▼ Abaixo', inline: '= Conforme' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeUntil(dt) {
  const h = differenceInHours(dt, new Date());
  const d = differenceInDays(dt, new Date());
  if (h < 0) return { label: 'Encerrado', color: '#334155' };
  if (h <= 1) return { label: `${h}h`, color: '#ef4444' };
  if (h <= 24) return { label: `${h}h`, color: '#f59e0b' };
  return { label: `${d}d`, color: '#64748b' };
}

// ─── COUNTDOWN BANNER ─────────────────────────────────────────────────────────
function CountdownBanner() {
  const next = getNextTier1Event();
  if (!next) return null;
  const h = differenceInHours(new Date(next.datetime_brt), new Date());
  const d = Math.floor(h / 24);
  const rem = h % 24;
  const color = h <= 24 ? '#ef4444' : h <= 72 ? '#f59e0b' : '#60a5fa';

  return (
    <div style={{ marginBottom: 14, padding: '12px 18px', borderRadius: 10, background: `${color}0d`, border: `1px solid ${color}30`, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 24 }}>⏱️</div>
      <div>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Próximo Evento Tier-1</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>{next.title}</div>
        <div style={{ fontSize: 10, color: '#64748b' }}>{format(new Date(next.datetime_brt), "EEE dd/MM HH:mm", { locale: ptBR })} BRT · Prev: {next.expected}</div>
      </div>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color, lineHeight: 1 }}>
          {d > 0 ? `${d}d ` : ''}{rem}h
        </div>
        <div style={{ fontSize: 9, color: '#475569' }}>até o evento</div>
      </div>
      {next.alert_enabled && (
        <div style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 9, color: '#10b981', fontWeight: 700 }}>
          🔔 Alerta em {next.alert_minutes_before}min antes
        </div>
      )}
    </div>
  );
}

// ─── EVENT CARD ───────────────────────────────────────────────────────────────
function EventCard({ event, onToggleAlert }) {
  const color = AGENCY_COLOR[event.agency] || AGENCY_COLOR.default;
  const { label: timeLabel, color: timeColor } = timeUntil(new Date(event.datetime_brt));
  const impactColor = event.btc_impact_hist_avg < 0 ? '#ef4444' : '#10b981';

  return (
    <div style={{ background: '#111827', border: `1px solid ${event.tier === 1 ? 'rgba(239,68,68,0.2)' : '#1e2d45'}`, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${color}14`, color, border: `1px solid ${color}30`, fontWeight: 700 }}>{event.agency}</span>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: event.tier === 1 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', color: event.tier === 1 ? '#ef4444' : '#f59e0b', border: `1px solid ${event.tier === 1 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`, fontWeight: 700 }}>TIER-{event.tier}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: timeColor, fontFamily: 'JetBrains Mono, monospace' }}>Em {timeLabel}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{event.title}</div>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {format(new Date(event.datetime_brt), "EEE dd/MM/yyyy HH:mm", { locale: ptBR })} BRT
          </div>
        </div>
        <button onClick={() => onToggleAlert(event.id)} style={{ padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, background: event.alert_enabled ? 'rgba(16,185,129,0.12)' : '#0d1421', border: `1px solid ${event.alert_enabled ? 'rgba(16,185,129,0.3)' : '#1a2535'}`, color: event.alert_enabled ? '#10b981' : '#475569', whiteSpace: 'nowrap' }}>
          {event.alert_enabled ? '🔔 ON' : '🔕 OFF'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Esperado</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{event.expected}</div>
        </div>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Anterior</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>{event.previous}</div>
        </div>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Impacto BTC (hist.)</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: impactColor }}>
            {event.btc_impact_hist_avg > 0 ? '+' : ''}{event.btc_impact_hist_avg}%
          </div>
        </div>
      </div>

      {event.description && (
        <div style={{ marginTop: 8, fontSize: 9, color: '#475569', lineHeight: 1.6, padding: '6px 8px', borderRadius: 5, background: '#0a1018', border: '1px solid #0f1d2e' }}>
          {event.description}
        </div>
      )}
    </div>
  );
}

// ─── VOLATILITY CHART ─────────────────────────────────────────────────────────
function VolatilityChart({ selectedEvent }) {
  if (!selectedEvent) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
        ← Selecione um evento histórico para ver a volatilidade
      </div>
    );
  }
  const rc = RESULT_COLOR[selectedEvent.result_vs_expected];
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{selectedEvent.event}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{selectedEvent.date}</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${rc}10`, color: rc, border: `1px solid ${rc}25`, fontWeight: 700 }}>
          {RESULT_LABEL[selectedEvent.result_vs_expected]} — {selectedEvent.actual} (exp: {selectedEvent.expected})
        </span>
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
          IV antes: {selectedEvent.iv_before}% → depois: {selectedEvent.iv_after}%
          <span style={{ color: selectedEvent.vol_spike_pct > 0 ? '#ef4444' : '#10b981', fontWeight: 700, marginLeft: 6 }}>
            {selectedEvent.vol_spike_pct > 0 ? '+' : ''}{selectedEvent.vol_spike_pct.toFixed(1)}%
          </span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={selectedEvent.windows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, borderRadius: 6 }} formatter={v => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n.toFixed(2)}%`, 'BTC Move']; }} />
          <ReferenceLine y={0} stroke="#1e2d45" />
          <Bar dataKey="btc_move" radius={[3, 3, 0, 0]} name="BTC Move">
            {selectedEvent.windows.map((w, i) => (
              <Cell key={i} fill={w.btc_move >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── AVG VOLATILITY CHART ─────────────────────────────────────────────────────
function AvgVolatilityChart() {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Impacto Médio BTC por Tipo de Evento (resultado vs expectativa)
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={avgVolatilityByEvent} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,69,0.4)" vertical={false} />
          <XAxis dataKey="event" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, borderRadius: 6 }} formatter={(v, n) => { const n2 = Number(v); return [`${n2 > 0 ? '+' : ''}${n2}%`, n === 'above_exp' ? '▲ Acima Exp.' : n === 'below_exp' ? '▼ Abaixo Exp.' : '= Conforme']; }} />
          <Legend wrapperStyle={{ fontSize: 9, color: '#475569' }} formatter={v => v === 'above_exp' ? '▲ Acima' : v === 'below_exp' ? '▼ Abaixo' : '= Conforme'} />
          <ReferenceLine y={0} stroke="#1e2d45" />
          <Bar dataKey="above_exp" fill="#ef4444" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
          <Bar dataKey="below_exp" fill="#10b981" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
          <Bar dataKey="inline"    fill="#f59e0b" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── ALERT SETTINGS ───────────────────────────────────────────────────────────
function AlertPanel({ events, onToggleAlert, onSendTestAlert }) {
  const active = events.filter(e => e.alert_enabled);
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        🔔 Alertas Push Configurados — {active.length} de {events.length}
      </div>
      {events.map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', background: '#0d1421', border: `1px solid ${e.alert_enabled ? 'rgba(16,185,129,0.2)' : '#1a2535'}`, borderRadius: 8, marginBottom: 6 }}>
          <button onClick={() => onToggleAlert(e.id)} style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: e.alert_enabled ? '#10b981' : '#1a2535', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: '#fff', position: 'absolute', top: 3, left: e.alert_enabled ? 17 : 3, transition: 'left 0.2s' }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: e.alert_enabled ? '#e2e8f0' : '#475569' }}>{e.title}</div>
            <div style={{ fontSize: 8, color: '#334155' }}>{format(new Date(e.datetime_brt), "dd/MM HH:mm", { locale: ptBR })} BRT · TIER-{e.tier}</div>
          </div>
          <div style={{ fontSize: 9, color: '#334155' }}>{e.alert_minutes_before}min antes</div>
          {e.alert_enabled && (
            <button onClick={() => onSendTestAlert(e)} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', cursor: 'pointer', fontWeight: 700 }}>
              Testar
            </button>
          )}
        </div>
      ))}
      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 9, color: '#f59e0b', lineHeight: 1.6 }}>
        💡 Alertas push requerem Backend (Builder+) para disparo automático. Envio por e-mail disponível agora.
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = ['Agenda', 'Volatilidade', 'Alertas'];

export default function MacroCalendar() {
  const [tab, setTab] = useState('Agenda');
  const [events, setEvents] = useState(macroEvents);
  const [selectedHistEvent, setSelectedHistEvent] = useState(eventVolatilityData[0]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, color = '#10b981') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleAlert = (id) => {
    setEvents(ev => ev.map(e => e.id === id ? { ...e, alert_enabled: !e.alert_enabled } : e));
  };

  const sendTestAlert = async (event) => {
    showToast(`Enviando alerta de teste: ${event.title}...`, '#60a5fa');
    await sendNotificationEmail({
      to: 'alerts@cryptowatch.io',
      subject: `🚨 [TESTE] Evento Macro em ${event.alert_minutes_before}min: ${event.title}`,
      body: `ALERTA MACRO — TESTE\n\nEvento: ${event.title}\nAgência: ${event.agency} · TIER-${event.tier}\nData: ${format(new Date(event.datetime_brt), "dd/MM/yyyy HH:mm")} BRT\nEsperado: ${event.expected}\nAnterior: ${event.previous}\n\nImpacto histórico médio BTC: ${event.btc_impact_hist_avg > 0 ? '+' : ''}${event.btc_impact_hist_avg}%\n\n— CryptoWatch Macro Calendar`,
    });
    showToast(`✅ Alerta de teste enviado!`, '#10b981');
  };

  const tier1 = events.filter(e => e.tier === 1);
  const tier2 = events.filter(e => e.tier === 2);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 300, padding: '10px 18px', borderRadius: 8, background: '#111827', border: `1px solid ${toast.color}50`, color: toast.color, fontSize: 12, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>📅 Calendário Macro</h1>
            <ModeBadge mode="mock" />
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>CPI · FOMC · NFP · PCE · GDP · Volatilidade Histórica BTC · Alertas Push</p>
        </div>
      </div>

      {/* Regra de Ouro */}
      <GoldenRule />

      {/* Countdown */}
      <CountdownBanner />

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Eventos Tier-1', value: tier1.length, color: '#ef4444' },
          { label: 'Eventos Tier-2', value: tier2.length, color: '#f59e0b' },
          { label: 'Alertas Ativos', value: events.filter(e => e.alert_enabled).length, color: '#10b981' },
          { label: 'Próximos 30d', value: events.length, color: '#60a5fa' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: tab === t ? 800 : 500, background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent', color: tab === t ? '#60a5fa' : '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      {/* TAB: Agenda */}
      {tab === 'Agenda' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🔴 TIER-1 — Alta Relevância</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {tier1.map(e => <EventCard key={e.id} event={e} onToggleAlert={toggleAlert} />)}
            </div>
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🟡 TIER-2 — Relevância Moderada</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tier2.map(e => <EventCard key={e.id} event={e} onToggleAlert={toggleAlert} />)}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📊 Impacto Histórico Médio</div>
              <AvgVolatilityChart />
            </div>
            <GoldenRule compact />
          </div>
        </div>
      )}

      {/* TAB: Volatilidade */}
      {tab === 'Volatilidade' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📈 Volatilidade Pré/Pós Evento</div>
            <VolatilityChart selectedEvent={selectedHistEvent} />
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📋 Selecionar Evento Histórico</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventVolatilityData.map((ev, i) => {
                const rc = RESULT_COLOR[ev.result_vs_expected];
                const isSelected = selectedHistEvent?.event === ev.event;
                return (
                  <button key={i} onClick={() => setSelectedHistEvent(ev)} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : '#1a2535'}`, background: isSelected ? 'rgba(59,130,246,0.08)' : '#0d1421', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#60a5fa' : '#94a3b8' }}>{ev.event}</div>
                        <div style={{ fontSize: 9, color: '#475569' }}>{ev.date} · {ev.actual}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: ev.max_drawdown >= 0 ? '#10b981' : '#ef4444' }}>
                          {ev.max_drawdown >= 0 ? '+' : ''}{ev.max_drawdown}%
                        </div>
                        <div style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${rc}10`, color: rc, border: `1px solid ${rc}20` }}>{RESULT_LABEL[ev.result_vs_expected]}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📊 Comparativo por Tipo de Evento</div>
            <AvgVolatilityChart />
          </div>
        </div>
      )}

      {/* TAB: Alertas */}
      {tab === 'Alertas' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <AlertPanel events={events} onToggleAlert={toggleAlert} onSendTestAlert={sendTestAlert} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>⚙️ Como Funcionam os Alertas</div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.8 }}>
                <div style={{ marginBottom: 8 }}>1. <span style={{ color: '#94a3b8' }}>Configure o canal em Bots & Webhooks</span></div>
                <div style={{ marginBottom: 8 }}>2. <span style={{ color: '#94a3b8' }}>Ative o alerta por evento abaixo</span></div>
                <div style={{ marginBottom: 8 }}>3. <span style={{ color: '#94a3b8' }}>Receba push 30min antes via Telegram/Discord</span></div>
                <div>4. <span style={{ color: '#94a3b8' }}>Mensagem inclui: evento, esperado, histórico de impacto BTC e recomendação AI</span></div>
              </div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📨 Template do Alerta</div>
              <pre style={{ fontSize: 9, color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
{`🚨 MACRO ALERT — 30min
━━━━━━━━━━━━━━━━━━
📅 CPI Release (Tier-1)
🕐 09:30 BRT
📊 Esperado: +0.3% MoM
📈 Anterior: +0.4% MoM

🤖 Impacto histórico BTC:
• Acima exp → avg -5.8%
• Abaixo exp → avg +3.4%

⚡ Ação: Reduzir exposure
━━━━━━━━━━━━━━━━━━
CryptoWatch Intelligence`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}