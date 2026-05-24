// ─── CALENDÁRIO MACRO — CPI · FOMC · NFP · Volatilidade Histórica · Alertas ──
import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, BarChart, Legend,
} from 'recharts';
import { eventVolatilityData, avgVolatilityByEvent as avgVolatilityMock } from '../components/data/mockDataMacroCalendar';
import { ModeBadge } from '../components/ui/DataBadge';
import { RefreshButton } from '../components/ui/RefreshButton';
import GoldenRule from '../components/ui/GoldenRule';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendNotificationEmail } from '@/lib/notificationClient';
import { useMacroCalendar, useMacroAlertPreferences, useToggleMacroAlert } from '@/hooks/useMacroCalendar';
import { useEventVolatility } from '@/hooks/useEventVolatility';
import { IS_LIVE } from '@/lib/env';
import { useInvestingCalendar, useInvestingCalendarState } from '@/hooks/useInvestingCalendar';

const AGENCY_COLOR = {
  BLS: '#3b82f6', Fed: '#a78bfa', BEA: '#10b981', ISM: '#f59e0b', default: '#64748b',
};

const RESULT_COLOR = { above: '#ef4444', below: '#10b981', inline: '#f59e0b' };
const RESULT_LABEL = { above: '▲ Acima', below: '▼ Abaixo', inline: '= Conforme' };

// ─── Macro Surprise Z-Score (validado em scripts/validate_macro_surprise.py) ──
/**
 * Calcula Z-Score de surpresa para cada evento histórico.
 * z = (actual - consensus) / std_dev(histórico de surpresas)
 */
function computeSurpriseZScores(events) {
  return events.map((ev, i) => {
    const hist = events.slice(0, i);
    const surprises = hist.map(h => h.actual - h.consensus).filter(s => typeof s === 'number' && !isNaN(s));
    const surpriseRaw = (typeof ev.actual === 'number' && typeof ev.consensus === 'number')
      ? ev.actual - ev.consensus
      : null;

    let zScore = null;
    let direction = 'inline';
    if (surpriseRaw !== null) {
      if (surprises.length >= 2) {
        const mean = surprises.reduce((s, r) => s + r, 0) / surprises.length;
        const std  = Math.sqrt(surprises.reduce((s, r) => s + (r - mean) ** 2, 0) / (surprises.length - 1));
        zScore = std > 0 ? (surpriseRaw - mean) / std : 0;
      } else {
        zScore = 0;
      }
      direction = zScore > 0.5 ? 'above' : zScore < -0.5 ? 'below' : 'inline';
    }

    return { ...ev, surprise_raw: surpriseRaw, z_score: zScore !== null ? parseFloat(zScore.toFixed(2)) : null, z_direction: direction };
  });
}

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
function CountdownBanner({ events }) {
  const next = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => e.tier === 1 && new Date(e.datetime_brt) > now)
      .sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc))[0] ?? null;
  }, [events]);

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
        <div style={{ fontSize: 10, color: '#64748b' }}>
          {format(new Date(next.datetime_brt), "EEE dd/MM HH:mm", { locale: ptBR })} BRT
          {next.previous ? ` · Prev: ${next.previous}` : ''}
          {next.source === 'FRED' && <span style={{ color: '#10b981', marginLeft: 6 }}>· FRED ✓</span>}
          {next.source === 'FOMC_STATIC' && <span style={{ color: '#a78bfa', marginLeft: 6 }}>· Fed Oficial ✓</span>}
        </div>
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

// ─── EVENT CARD (upcoming) ────────────────────────────────────────────────────
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Consenso</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
            {event.consensus ?? '—'}
          </div>
          {event.consensus_label && (
            <div style={{ fontSize: 7, color: '#334155', marginTop: 1 }}>{event.consensus_label}</div>
          )}
        </div>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Anterior</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {event.previous ?? '—'}
          </div>
        </div>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: event.actual ? '#10b981' : '#334155', marginBottom: 2 }}>
            {event.actual ? '✓ Atual' : 'Atual'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: event.actual ? '#10b981' : '#334155' }}>
            {event.actual ?? (event.status === 'released' ? 'Aguardando...' : '—')}
          </div>
          {event.actual_source && (
            <div style={{ fontSize: 7, color: '#334155', marginTop: 1 }}>{event.actual_source.split(':')[0]}</div>
          )}
        </div>
        <div style={{ background: '#0d1421', borderRadius: 6, padding: '6px 9px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 2 }}>Impacto BTC</div>
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

// ─── PAST EVENT ROW (compact) ─────────────────────────────────────────────────
function PastEventRow({ event }) {
  const color  = AGENCY_COLOR[event.agency] || AGENCY_COLOR.default;
  const actual = event.actual;
  const prev   = event.previous;
  // Direction: if actual and previous are numeric strings, compare
  const actualNum = parseFloat(actual);
  const prevNum   = parseFloat(prev);
  const moved  = !isNaN(actualNum) && !isNaN(prevNum) ? actualNum - prevNum : null;
  const moveColor = moved === null ? '#475569' : moved > 0 ? '#ef4444' : moved < 0 ? '#10b981' : '#f59e0b';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 7, background: '#0a1018', border: '1px solid #0f1d2e', fontSize: 10 }}>
      <div style={{ width: 3, height: 28, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
        <div style={{ fontSize: 8, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
          {format(new Date(event.datetime_brt), "dd/MM HH:mm", { locale: ptBR })} BRT
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#334155' }}>Ant: <span style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{prev ?? '—'}</span></div>
        <div style={{ fontSize: 9, color: '#334155' }}>Real: <span style={{ fontWeight: 700, color: actual ? '#94a3b8' : '#334155', fontFamily: 'JetBrains Mono, monospace' }}>{actual ?? '—'}</span></div>
      </div>
      {moved !== null && (
        <div style={{ fontSize: 10, fontWeight: 800, color: moveColor, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
          {moved > 0 ? '▲' : '▼'}
        </div>
      )}
      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: event.tier === 1 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', color: event.tier === 1 ? '#ef444470' : '#f59e0b60', border: `1px solid ${event.tier === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'}`, flexShrink: 0 }}>
        T{event.tier}
      </span>
    </div>
  );
}

// ─── PAST EVENTS SECTION (collapsible) ───────────────────────────────────────
function PastEventsSection({ events }) {
  const [open, setOpen] = useState(events.length <= 3);
  if (events.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', marginBottom: open ? 8 : 0 }}
      >
        <span style={{ fontSize: 9, color: '#334155', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          📋 Eventos Passados ({events.length})
        </span>
        <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>{open ? '▲ recolher' : '▼ expandir'}</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map(e => <PastEventRow key={e.id} event={e} />)}
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
          {selectedEvent.iv_before > 0
            ? `IV antes: ${selectedEvent.iv_before}% → depois: ${selectedEvent.iv_after}%`
            : 'Vol-spike'}
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
function AvgVolatilityChart({ data }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Impacto Médio BTC por Tipo de Evento (resultado vs expectativa)
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
  // Only upcoming events can be alerted — past events are irrelevant
  const upcoming = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.datetime_utc) >= now);
  }, [events]);
  const active = upcoming.filter(e => e.alert_enabled);
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        🔔 Alertas Push Configurados — {active.length} de {upcoming.length}
      </div>
      {upcoming.length === 0 && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: '#0d1421', border: '1px solid #1a2535', fontSize: 10, color: '#334155' }}>
          Nenhum evento futuro disponível no momento.
        </div>
      )}
      {upcoming.map(e => (
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

// ─── EMOJI DE BANDEIRA POR MOEDA ──────────────────────────────────────────────
const CURRENCY_FLAG = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', CHF: '🇨🇭', CNY: '🇨🇳',
  NZD: '🇳🇿', SEK: '🇸🇪', NOK: '🇳🇴', MXN: '🇲🇽',
  BRL: '🇧🇷',
};

// ─── INVESTING.COM EVENT CARD ─────────────────────────────────────────────────
function InvestingEventCard({ event }) {
  const now       = new Date();
  const eventTime = new Date(event.datetime_utc);
  const isPast    = eventTime < now;
  const hasActual = event.actual !== null && event.actual !== '';

  // Cor da borda: liberado com actual=verde; no futuro=azul
  const borderColor = hasActual
    ? '#10b981'
    : isPast
      ? '#334155'
      : '#3b82f6';

  // AI direction
  const dirColor = event.ai_direction === 'up' ? '#10b981' : event.ai_direction === 'down' ? '#ef4444' : '#f59e0b';
  const dirArrow = event.ai_direction === 'up' ? '↑' : event.ai_direction === 'down' ? '↓' : '↔';
  const prob     = event.ai_probability != null ? `${Math.round(event.ai_probability * 100)}%` : '';

  // Formata horário BRT para exibição
  const brtDisplay = (() => {
    try {
      const brtMs  = eventTime.getTime() - 3 * 60 * 60 * 1000;
      const brt    = new Date(brtMs);
      const pad    = (n) => String(n).padStart(2, '0');
      return `${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())} BRT`;
    } catch {
      return '';
    }
  })();

  // Comparação actual vs forecast para exibição
  const comparisonColor = (() => {
    if (!hasActual || !event.forecast) return '#94a3b8';
    const a = parseFloat(event.actual);
    const f = parseFloat(event.forecast);
    if (isNaN(a) || isNaN(f)) return '#94a3b8';
    return a > f ? '#ef4444' : a < f ? '#10b981' : '#f59e0b';
  })();

  const flag = CURRENCY_FLAG[event.currency ?? ''] ?? '🌐';

  return (
    <div style={{
      background:   '#0d1421',
      border:       `1px solid ${borderColor}40`,
      borderLeft:   `3px solid ${borderColor}`,
      borderRadius: 10,
      padding:      '12px 14px',
      marginBottom: 8,
    }}>
      {/* Header linha */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>{flag}</span>
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 700 }}>
              {event.currency ?? '—'} ★★★
            </span>
            {hasActual ? (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>
                ✓ Liberado
              </span>
            ) : isPast ? (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: '#0a1018', color: '#334155', border: '1px solid #1a2535', fontWeight: 700 }}>
                Aguardando
              </span>
            ) : (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 700 }}>
                Agendado
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>{event.title}</div>
          <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{brtDisplay}</div>
        </div>
      </div>

      {/* Dados: actual / forecast / previous */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
        <div style={{ background: '#070B14', borderRadius: 5, padding: '5px 8px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Atual</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: hasActual ? comparisonColor : '#334155' }}>
            {event.actual ?? '—'}
          </div>
        </div>
        <div style={{ background: '#070B14', borderRadius: 5, padding: '5px 8px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Previsão</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
            {event.forecast ?? '—'}
          </div>
        </div>
        <div style={{ background: '#070B14', borderRadius: 5, padding: '5px 8px' }}>
          <div style={{ fontSize: 8, color: '#334155', marginBottom: 1 }}>Anterior</div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
            {event.previous ?? '—'}
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {event.ai_analysis && (
        <div style={{ fontSize: 9, color: '#475569', padding: '5px 8px', borderRadius: 5, background: '#070B14', border: '1px solid #0f1d2e', lineHeight: 1.5 }}>
          <span style={{ color: dirColor, fontWeight: 800, marginRight: 4 }}>{dirArrow} {prob}</span>
          {event.ai_analysis}
        </div>
      )}
    </div>
  );
}

// ─── Helpers de data em BRT ───────────────────────────────────────────────────
const DIAS_PT   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MESES_PT  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function utcToBrtWall(utcDate) {
  // BRT = UTC-3, sem horário de verão
  return new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
}

function formatDateGroupHeader(brtDate) {
  const dayName   = DIAS_PT[brtDate.getUTCDay()];
  const day       = brtDate.getUTCDate();
  const monthName = MESES_PT[brtDate.getUTCMonth()];
  const year      = brtDate.getUTCFullYear();
  return `${dayName}, ${day} de ${monthName} de ${year}`;
}

function formatTimeBrt(utcDate) {
  const brt = utcToBrtWall(utcDate);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}`;
}

function groupEventsByBrtDate(eventList) {
  const groups = {};
  for (const e of eventList) {
    const brt = utcToBrtWall(new Date(e.datetime_utc));
    const key = `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2,'0')}-${String(brt.getUTCDate()).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = { label: formatDateGroupHeader(brt), sortKey: key, events: [] };
    groups[key].events.push(e);
  }
  return Object.values(groups).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

// ─── INVESTING.COM EVENT CARD (v2 — com horário destacado) ───────────────────
function InvestingEventCardV2({ event }) {
  const now       = new Date();
  const eventTime = new Date(event.datetime_utc);
  const isPast    = eventTime < now;
  const hasActual = event.actual != null && event.actual !== '';

  const borderColor = hasActual ? '#10b981' : isPast ? '#1e2d45' : '#3b82f6';
  const dirColor    = event.ai_direction === 'up' ? '#10b981' : event.ai_direction === 'down' ? '#ef4444' : '#f59e0b';
  const dirArrow    = event.ai_direction === 'up' ? '↑' : event.ai_direction === 'down' ? '↓' : '↔';
  const prob        = event.ai_probability != null ? `${Math.round(event.ai_probability * 100)}%` : '';

  const compColor = (() => {
    if (!hasActual || !event.forecast) return '#94a3b8';
    const a = parseFloat(event.actual), f = parseFloat(event.forecast);
    if (isNaN(a) || isNaN(f)) return '#94a3b8';
    return a > f ? '#ef4444' : a < f ? '#10b981' : '#f59e0b';
  })();

  const flag    = CURRENCY_FLAG[event.currency ?? ''] ?? '🌐';
  const timeBrt = formatTimeBrt(eventTime);

  return (
    <div style={{ display: 'flex', gap: 0, background: '#0a1220', border: `1px solid ${borderColor}35`, borderLeft: `3px solid ${borderColor}`, borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
      {/* Coluna de hora */}
      <div style={{ width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#070B14', padding: '10px 4px', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: isPast ? '#475569' : '#e2e8f0', lineHeight: 1 }}>{timeBrt}</div>
        <div style={{ fontSize: 8, color: '#334155' }}>BRT</div>
        <div style={{ fontSize: 11, marginTop: 2 }}>{flag}</div>
      </div>

      {/* Corpo principal */}
      <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
        {/* Título + badges */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: isPast ? '#64748b' : '#e2e8f0', flex: 1, minWidth: 0 }}>{event.title}</span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {event.currency ?? '—'} ★★★
            </span>
            {hasActual
              ? <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>✓ Real</span>
              : isPast
                ? <span title="Valor final não disponível na fonte (ForexFactory)" style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#0a1018', color: '#475569', border: '1px solid #1a2535', fontWeight: 700 }}>Encerrado</span>
                : <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.06)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.15)', fontWeight: 700 }}>Agend.</span>
            }
          </div>
        </div>

        {/* Actual / Previsão / Anterior */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 6 }}>
          <div style={{ background: '#070B14', borderRadius: 4, padding: '4px 7px' }}>
            <div style={{ fontSize: 7, color: '#334155', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Real</div>
            {hasActual
              ? <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: compColor }}>{event.actual}</div>
              : isPast
                ? <div title="ForexFactory (fonte gratuita) não disponibiliza valores reais no feed JSON. Clique em ForexFactory ↗ para ver." style={{ fontSize: 10, fontWeight: 700, color: '#475569', cursor: 'help', letterSpacing: '-0.02em' }}>ver ↗</div>
                : <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>—</div>
            }
          </div>
          {[
            { label: 'Previsão', value: event.forecast, color: '#94a3b8' },
            { label: 'Anterior', value: event.previous, color: '#64748b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#070B14', borderRadius: 4, padding: '4px 7px' }}>
              <div style={{ fontSize: 7, color: '#334155', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color }}>{value ?? '—'}</div>
            </div>
          ))}
        </div>

        {/* AI Analysis */}
        {event.ai_analysis && (
          <div style={{ fontSize: 9, color: '#475569', padding: '4px 8px', borderRadius: 4, background: '#070B14', border: '1px solid #0f1d2e', lineHeight: 1.5 }}>
            <span style={{ color: dirColor, fontWeight: 800, marginRight: 5 }}>{dirArrow} {prob}</span>
            {event.ai_analysis}
          </div>
        )}

        {/* ForexFactory link */}
        <div style={{ marginTop: 4, textAlign: 'right' }}>
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 8, color: '#3b82f6', textDecoration: 'none', opacity: 0.7 }}
          >
            ForexFactory ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── INVESTING CALENDAR SECTION ───────────────────────────────────────────────
function InvestingCalendarSection() {
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [showPast, setShowPast]             = useState(true);

  const { data: events = [], isLoading, isError } = useInvestingCalendar();
  const { data: calState }                        = useInvestingCalendarState();

  const isFallback  = calState?.isFallback  ?? false;
  const lastUpdated = calState?.lastUpdated ?? null;
  const debugError  = calState?.debugError  ?? null;

  const now    = new Date();
  const noData = !isLoading && !isError && events.length === 0;

  const filtered = useMemo(() => currencyFilter === 'ALL'
    ? events
    : events.filter(e => (e.currency ?? 'USD') === currencyFilter),
    [events, currencyFilter],
  );

  const upcoming = useMemo(() =>
    filtered.filter(e => new Date(e.datetime_utc) >= now)
             .sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc)),
    [filtered],
  );

  const pastReleased = useMemo(() =>
    filtered.filter(e => new Date(e.datetime_utc) < now)
             .sort((a, b) => b.datetime_utc.localeCompare(a.datetime_utc))
             .slice(0, 100),
    [filtered],
  );

  // Agrupa por dia (BRT) para exibição estilo Investing.com
  const upcomingGroups  = useMemo(() => groupEventsByBrtDate(upcoming),     [upcoming]);
  const pastGroups      = useMemo(() => groupEventsByBrtDate(pastReleased), [pastReleased]);

  // Próximo evento
  const nextEvent       = upcoming[0] ?? null;
  const minsUntilNext   = nextEvent
    ? Math.max(0, Math.round((new Date(nextEvent.datetime_utc).getTime() - now.getTime()) / 60_000))
    : null;

  // lastUpdated formatado em BRT
  const lastUpdatedBrt = lastUpdated ? (() => {
    try {
      const brt = utcToBrtWall(new Date(lastUpdated));
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(brt.getUTCDate())}/${pad(brt.getUTCMonth() + 1)} ${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())} BRT`;
    } catch { return ''; }
  })() : null;

  return (
    <div>
      {/* Status LIVE / fallback */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {isFallback ? (
          <span style={{ fontSize: 9, padding: '3px 9px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 700 }}>
            ⚠ Cache — última coleta falhou
          </span>
        ) : !isLoading && !noData ? (
          <span style={{ fontSize: 9, padding: '3px 9px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700 }}>
            ● LIVE: ForexFactory
          </span>
        ) : null}
        {lastUpdatedBrt && <span style={{ fontSize: 9, color: '#334155' }}>Atualizado: {lastUpdatedBrt}</span>}
        {debugError && <span style={{ fontSize: 9, color: '#ef444460', cursor: 'help' }} title={debugError}>⚠ {debugError.slice(0, 50)}</span>}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #1e2d45', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#475569' }}>Buscando calendário econômico…</span>
        </div>
      )}

      {/* Sem dados (tabela não criada ou GitHub Action ainda não rodou) */}
      {noData && !isError && (
        <div style={{ padding: '20px 18px', borderRadius: 10, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', fontSize: 11, color: '#475569', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>📅 Calendário econômico não disponível ainda</div>
          <div>
            O GitHub Action <code style={{ color: '#94a3b8', background: '#0a1018', padding: '1px 5px', borderRadius: 3 }}>fetch-investing-calendar</code> ainda não executou ou a migração Supabase está pendente.
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: '#334155' }}>
            Para ativar: configure os secrets <code style={{ color: '#64748b' }}>SUPABASE_URL</code> e <code style={{ color: '#64748b' }}>SUPABASE_SERVICE_ROLE_KEY</code> no GitHub, depois acesse <strong>Actions → "Fetch Economic Calendar" → Run workflow</strong>.
          </div>
        </div>
      )}

      {/* Erro de rede/API */}
      {isError && !isLoading && (
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, color: '#ef4444' }}>
          ⚠ Falha ao buscar eventos do calendário econômico. Verifique o Debug Panel para detalhes.
        </div>
      )}

      {/* Conteúdo principal */}
      {events.length > 0 && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Próximos',    value: upcoming.length,      color: '#3b82f6' },
              { label: 'Liberados',   value: pastReleased.length,  color: '#10b981' },
              { label: 'Próximo em',  value: minsUntilNext != null ? (minsUntilNext >= 60 ? `${Math.floor(minsUntilNext/60)}h${minsUntilNext%60 > 0 ? String(minsUntilNext%60).padStart(2,'0')+'m' : ''}` : `${minsUntilNext}min`) : '—', color: minsUntilNext != null && minsUntilNext <= 30 ? '#ef4444' : '#f59e0b' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filtros por moeda */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {['USD', 'EUR', 'GBP', 'JPY', 'ALL'].map(cur => (
              <button key={cur} onClick={() => setCurrencyFilter(cur)} style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                fontWeight: currencyFilter === cur ? 700 : 500,
                border:     `1px solid ${currencyFilter === cur ? 'rgba(59,130,246,0.4)' : '#162032'}`,
                background: currencyFilter === cur ? 'rgba(59,130,246,0.12)' : '#0d1421',
                color:      currencyFilter === cur ? '#60a5fa' : '#475569',
              }}>
                {cur === 'ALL' ? '🌐 Todos' : `${CURRENCY_FLAG[cur] ?? ''} ${cur}`}
              </button>
            ))}
          </div>

          {/* Próximos — agrupados por dia */}
          {upcomingGroups.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                ⏰ Próximos Eventos ({upcoming.length})
              </div>
              {upcomingGroups.map(group => (
                <div key={group.sortKey} style={{ marginBottom: 14 }}>
                  {/* Header de dia */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ height: 1, flex: 1, background: '#162032' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                      📅 {group.label}
                    </span>
                    <div style={{ height: 1, flex: 1, background: '#162032' }} />
                  </div>
                  {group.events.map(e => <InvestingEventCardV2 key={e.id} event={e} />)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e', fontSize: 10, color: '#475569', marginBottom: 12, lineHeight: 1.7 }}>
              {currencyFilter !== 'ALL'
                ? `Nenhum evento (${currencyFilter}) próximo. Tente "🌐 Todos" para ver outras moedas.`
                : pastReleased.length > 0
                  ? <>
                      ⬇ Nenhum evento High Impact agendado para os próximos dias.<br/>
                      <span style={{ fontSize: 9, color: '#334155' }}>
                        O ForexFactory não possui eventos críticos ★★★ listados para a próxima semana neste momento. Próximos grandes eventos macro (CPI, NFP, FOMC, PMI Flash) geralmente ocorrem na 1ª–2ª semana do mês.
                      </span>
                    </>
                  : 'Nenhum evento High Impact no período. O cron atualiza a cada 30 min nos dias úteis.'}
            </div>
          )}

          {/* Passados com resultado — agrupados por dia */}
          {pastGroups.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <button onClick={() => setShowPast(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', marginBottom: showPast ? 10 : 0 }}>
                <span style={{ fontSize: 9, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  📋 Eventos das últimas 2 semanas ({pastReleased.length})
                </span>
                <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>{showPast ? '▲ recolher' : '▼ expandir'}</span>
              </button>
              {showPast && pastGroups.map(group => (
                <div key={group.sortKey} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ height: 1, flex: 1, background: '#162032' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                      📅 {group.label}
                    </span>
                    <div style={{ height: 1, flex: 1, background: '#162032' }} />
                  </div>
                  {group.events.map(e => <InvestingEventCardV2 key={e.id} event={e} />)}
                </div>
              ))}
            </div>
          )}

          {/* Rodapé */}
          <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 6, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 9, color: '#334155', lineHeight: 1.7 }}>
            Fonte: ForexFactory (faireconomy.media) · Eventos críticos ★★★ (High + PMI Flash + Retail Sales + outros) · Horários em BRT (UTC-3) · Coleta automática a cada 30min<br/>
            <span style={{ color: '#3b82f660' }}>⚠ A fonte gratuita não disponibiliza valores reais (actual) no feed JSON — clique em "ForexFactory ↗" em cada card para ver o resultado publicado.</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = ['Agenda', 'Calendário Econômico ★★★', 'Surpresa', 'Volatilidade', 'Alertas'];

export default function MacroCalendar() {
  const [tab, setTab] = useState('Agenda');
  const [toast, setToast] = useState(null);

  // ─── Hooks live — FRED API + FOMC estático + alertas persistidos ──────────
  const {
    data: liveEvents = [],
    isLoading: calLoading,
    isFetching: calFetching,
    isError: calError,
    refetch: calRefetch,
    dataUpdatedAt: calUpdatedAt,
  } = useMacroCalendar();

  const { data: alertPrefs } = useMacroAlertPreferences();
  const toggleAlertMutation  = useToggleMacroAlert();

  // Mescla preferências de alerta persistidas com dados do hook
  const events = useMemo(
    () => liveEvents.map(e => {
      const pref = alertPrefs?.get(e.code);
      return {
        ...e,
        alert_enabled:        pref ? pref.alert_enabled        : e.alert_enabled,
        alert_minutes_before: pref ? pref.alert_minutes_before : e.alert_minutes_before,
      };
    }),
    [liveEvents, alertPrefs],
  );

  // ─── Volatilidade real via Binance klines ─────────────────────────────────
  const pastEvents = useMemo(
    () => events
      .filter(e => e.actual !== null && new Date(e.datetime_utc) < new Date())
      .map(e => ({ name: e.title, code: e.code, datetime_utc: e.datetime_utc, actual: e.actual, previous: e.previous })),
    [events],
  );
  const { data: evVol } = useEventVolatility(pastEvents);

  const hasLiveVol     = IS_LIVE && evVol && evVol.rows.length > 0;
  const volatilityData = hasLiveVol ? evVol.rows : eventVolatilityData;
  const avgVolData     = hasLiveVol ? evVol.avg  : avgVolatilityMock;

  const [selectedHistEvent, setSelectedHistEvent] = useState(null);
  const activeHistEvent = selectedHistEvent ?? volatilityData[0] ?? null;

  // Enriquece volatilityData com Z-Score de surpresa (fórmula validada Python)
  const surpriseData = useMemo(() => computeSurpriseZScores(volatilityData), [volatilityData]);

  const showToast = (msg, color = '#10b981') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleAlert = (id) => {
    const event = events.find(e => e.id === id);
    if (!event) return;
    const newEnabled = !event.alert_enabled;
    toggleAlertMutation.mutate({
      eventCode:          event.code,
      alertEnabled:       newEnabled,
      alertMinutesBefore: event.alert_minutes_before,
    });
  };

  const sendTestAlert = async (event) => {
    showToast(`Enviando alerta de teste: ${event.title}...`, '#60a5fa');
    await sendNotificationEmail({
      to: 'alerts@cryptowatch.io',
      subject: `🚨 [TESTE] Evento Macro em ${event.alert_minutes_before}min: ${event.title}`,
      body: `ALERTA MACRO — TESTE\n\nEvento: ${event.title}\nAgência: ${event.agency} · TIER-${event.tier}\nData: ${format(new Date(event.datetime_brt), "dd/MM/yyyy HH:mm")} BRT\nAnterior: ${event.previous ?? '—'}\n\nImpacto histórico médio BTC: ${event.btc_impact_hist_avg > 0 ? '+' : ''}${event.btc_impact_hist_avg}%\n\n— CryptoWatch Macro Calendar`,
    });
    showToast(`✅ Alerta de teste enviado!`, '#10b981');
  };

  const upcoming = useMemo(() => { const t = new Date(); return events.filter(e => new Date(e.datetime_utc) >= t).sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc)); }, [events]);
  const past     = useMemo(() => { const t = new Date(); return events.filter(e => new Date(e.datetime_utc) < t).sort((a, b) => b.datetime_utc.localeCompare(a.datetime_utc)); }, [events]);

  const upcomingTier1 = upcoming.filter(e => e.tier === 1);
  const upcomingTier2 = upcoming.filter(e => e.tier === 2);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 300, padding: '10px 18px', borderRadius: 8, background: '#111827', border: `1px solid ${toast.color}50`, color: toast.color, fontSize: 12, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>📅 Calendário Macro</h1>
            <ModeBadge mode={IS_LIVE ? 'live' : 'mock'} />
            {IS_LIVE && (
              <span style={{ fontSize: 9, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>
                FRED + FOMC Oficial
              </span>
            )}
            <RefreshButton
              onRefresh={() => { calRefetch(); }}
              isLoading={calFetching}
              lastUpdated={calUpdatedAt}
              label="Atualizar Calendário Macro"
            />
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>CPI · FOMC · NFP · PCE · GDP · Volatilidade Histórica BTC · Alertas Push</p>
        </div>
      </div>

      {/* Regra de Ouro */}
      <GoldenRule />

      {/* Loading state */}
      {calLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', marginBottom: 14, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #1e2d45', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#475569' }}>Buscando eventos macro via FRED API…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error state */}
      {calError && !calLoading && (
        <div style={{ padding: '12px 16px', marginBottom: 14, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#ef4444' }}>
          ⚠ Falha ao buscar datas FRED. Exibindo dados locais. <button onClick={() => calRefetch()} style={{ marginLeft: 10, fontSize: 10, color: '#60a5fa', background: 'none', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      )}

      {/* Countdown */}
      <CountdownBanner events={events} />

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Tier-1 Próximos', value: upcomingTier1.length, color: '#ef4444' },
          { label: 'Tier-2 Próximos', value: upcomingTier2.length, color: '#f59e0b' },
          { label: 'Alertas Ativos', value: upcoming.filter(e => e.alert_enabled).length, color: '#10b981' },
          { label: 'Eventos Passados', value: past.length, color: '#475569' },
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
            {/* Upcoming Tier-1 */}
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🔴 TIER-1 — Alta Relevância</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {upcomingTier1.length > 0
                ? upcomingTier1.map(e => <EventCard key={e.id} event={e} onToggleAlert={toggleAlert} />)
                : <div style={{ padding: '12px 14px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e', fontSize: 10, color: '#334155' }}>Nenhum evento Tier-1 próximo no calendário.</div>
              }
            </div>

            {/* Upcoming Tier-2 */}
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>🟡 TIER-2 — Relevância Moderada</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingTier2.length > 0
                ? upcomingTier2.map(e => <EventCard key={e.id} event={e} onToggleAlert={toggleAlert} />)
                : <div style={{ padding: '12px 14px', borderRadius: 8, background: '#0a1018', border: '1px solid #0f1d2e', fontSize: 10, color: '#334155' }}>Nenhum evento Tier-2 próximo no calendário.</div>
              }
            </div>

            {/* Past events — collapsible compact rows */}
            <PastEventsSection events={past} />
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '16px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>📊 Impacto Histórico Médio</span>
                {hasLiveVol
                  ? <span style={{ fontSize: 9, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>● Binance klines · B</span>
                  : <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>mock · D</span>
                }
              </div>
              <AvgVolatilityChart data={avgVolData} />
            </div>
            <GoldenRule compact />
          </div>
        </div>
      )}

      {/* TAB: Calendário Econômico */}
      {tab === 'Calendário Econômico ★★★' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <InvestingCalendarSection />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#0d1421', border: '1px solid #162032', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>ℹ️ Sobre esta seção</div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}>Eventos macroeconômicos <strong style={{ color: '#60a5fa' }}>críticos ★★★</strong> coletados via <strong style={{ color: '#94a3b8' }}>ForexFactory</strong> (faireconomy.media) — feed JSON gratuito, sem bloqueio de IP. Inclui PMI Flash, Retail Sales e outros eventos críticos para os mercados.</div>
                <div style={{ marginBottom: 6 }}>O GitHub Action roda a cada <strong style={{ color: '#94a3b8' }}>30 minutos</strong> nos dias úteis durante o horário de mercado US. Alertas Telegram automáticos pré e pós evento.</div>
                <div style={{ marginBottom: 4 }}>A análise AI é gerada com <strong style={{ color: '#94a3b8' }}>Claude</strong> (se ANTHROPIC_API_KEY configurada) ou análise rule-based local.</div>
                <div style={{ fontSize: 8, color: '#334155', marginTop: 6, padding: '4px 6px', background: '#0a1018', borderRadius: 4, border: '1px solid #162032' }}>
                  ⚠ <em>A fonte gratuita não disponibiliza valores reais (actual) no feed JSON automático. Valores "ver ↗" indicam dado disponível no site mas não no feed.</em>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>⚠️ Aviso de uso</div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.7 }}>
                A análise AI é rule-based e não substitui análise profissional. Probabilidades são estimativas baseadas em padrões históricos, não previsões garantidas.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Surpresa */}
      {tab === 'Surpresa' && (
        <div>
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8, fontSize: 11, color: '#475569', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span><strong style={{ color: '#60a5fa' }}>Surprise Layer:</strong>{' '}Compara o resultado real (actual) vs a expectativa de consenso. A magnitude da surpresa é o motor principal da reação do BTC.</span>
            {hasLiveVol
              ? <span style={{ fontSize: 9, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 600, flexShrink: 0 }}>● Binance klines · B</span>
              : <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 600, flexShrink: 0 }}>mock · D</span>
            }
          </div>

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Acima do Esperado', count: volatilityData.filter(e => e.result_vs_expected === 'above').length, color: '#ef4444', icon: '▲', desc: 'Inflação/jobs > consenso → hawkish → BTC ↓' },
              { label: 'Abaixo do Esperado', count: volatilityData.filter(e => e.result_vs_expected === 'below').length, color: '#10b981', icon: '▼', desc: 'Dados fracos → dovish → BTC ↑' },
              { label: 'Conforme Esperado',  count: volatilityData.filter(e => e.result_vs_expected === 'inline').length, color: '#f59e0b', icon: '=', desc: 'Sem surpresa → vol cai · sell-the-news' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111827', border: `1px solid ${s.color}20`, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 16, color: s.color, fontWeight: 900 }}>{s.icon}</span>
                  <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{s.label}</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color, lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 9, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Surpresa table */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #1e2d45', fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              Histórico de Surpresas — Actual vs Consenso vs Reação BTC
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d45' }}>
                  {['Evento', 'Data', 'Esperado', 'Atual', 'Z-Score', 'Surpresa', 'BTC +1h', 'BTC +24h', 'IV Spike'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: i <= 1 ? 'left' : 'right', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {surpriseData.map((ev, i) => {
                  const rc = RESULT_COLOR[ev.result_vs_expected];
                  const rl = RESULT_LABEL[ev.result_vs_expected];
                  const move1h = ev.windows.find(w => w.label === '+1h')?.btc_move ?? 0;
                  const move24h = ev.windows.find(w => w.label === '+24h')?.btc_move ?? 0;
                  const zColor = ev.z_score > 0 ? '#ef4444' : ev.z_score < 0 ? '#10b981' : '#f59e0b';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(30,45,69,0.4)', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#e2e8f0' }}>{ev.event}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', fontSize: 10 }}>{ev.date}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{ev.expected}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: rc }}>{ev.actual}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: ev.z_score !== null ? zColor : '#334155' }}>
                        {ev.z_score !== null ? `${ev.z_score > 0 ? '+' : ''}${ev.z_score}σ` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${rc}10`, color: rc, border: `1px solid ${rc}25`, fontWeight: 700 }}>
                          {rl}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: move1h >= 0 ? '#10b981' : '#ef4444' }}>
                        {move1h >= 0 ? '+' : ''}{move1h.toFixed(1)}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: move24h >= 0 ? '#10b981' : '#ef4444' }}>
                        {move24h >= 0 ? '+' : ''}{move24h.toFixed(1)}%
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: ev.vol_spike_pct > 0 ? '#ef4444' : '#10b981' }}>
                        {ev.vol_spike_pct > 0 ? '+' : ''}{ev.vol_spike_pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Insight */}
          <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: '14px 16px', fontSize: 11, color: '#64748b', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>Regra Empírica — Macro Surpresa</div>
            <div>• <strong style={{ color: '#ef4444' }}>Acima exp. (CPI/NFP quentes):</strong> BTC cai −3% a −6% em média nas 4h seguintes. IV sobe &gt;15%.</div>
            <div>• <strong style={{ color: '#10b981' }}>Abaixo exp. (dados fracos):</strong> BTC sobe +2% a +5% em 24h. IV comprime.</div>
            <div>• <strong style={{ color: '#f59e0b' }}>Inline/conforme:</strong> Reação mínima. IV cai (sell volatility pré-evento).</div>
            <div style={{ marginTop: 6, fontSize: 9, color: '#334155' }}>⚠ N=5 eventos. Horizonte curto. Não usar isoladamente para decisões.</div>
          </div>
        </div>
      )}

      {/* TAB: Volatilidade */}
      {tab === 'Volatilidade' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📈 Volatilidade Pré/Pós Evento</span>
              {hasLiveVol
                ? <span style={{ fontSize: 9, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>● Binance klines · {evVol.rows.length} eventos</span>
                : <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>mock · D</span>
              }
            </div>
            <VolatilityChart selectedEvent={activeHistEvent} />
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>📋 Selecionar Evento Histórico</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {volatilityData.map((ev, i) => {
                const rc = RESULT_COLOR[ev.result_vs_expected];
                const isSelected = activeHistEvent?.event === ev.event;
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
            <AvgVolatilityChart data={avgVolData} />
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
                <div>4. <span style={{ color: '#94a3b8' }}>Mensagem inclui: evento, esperado e histórico de impacto BTC</span></div>
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

📊 Impacto histórico BTC:
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