import { useState } from 'react';
import { econCalendar } from '../components/data/mockData';
import { ModeBadge } from '../components/ui/DataBadge';
import GoldenRule from '../components/ui/GoldenRule';
import { format, differenceInHours, differenceInDays, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MARKET_HOURS_BRT = [
  { name: 'B3 (Ações)', open: '10:00', close: '17:30', tz: 'BRT', color: '#10b981', note: 'Após-hora: 17:30–18:00' },
  { name: 'NYSE / NASDAQ', open: '10:30', close: '17:00', tz: 'BRT', color: '#60a5fa', note: 'Pré-mkt: 08:00 · Após: 21:00 BRT' },
  { name: 'Forex / Cripto (24h)', open: '00:00', close: '23:59', tz: 'BRT', color: '#f59e0b', note: 'BTC opera 24/7' },
  { name: 'CME Futures', open: 'Dom 19:00', close: 'Sex 18:00', tz: 'BRT', color: '#a78bfa', note: 'Pausa: Sex 18:00 – Dom 19:00 BRT' },
  { name: 'Deribit (Cripto Derivs)', open: '00:00', close: '23:59', tz: 'UTC', color: '#06b6d4', note: 'Liquida opções às 08:00 UTC sexta' },
];

const agencyColors = {
  BLS: { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
  Fed: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
  BEA: { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
};

const IMPACT_CONFIG = {
  1: { label: 'CRÍTICO', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: '🔴' },
  2: { label: 'MÉDIO',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: '🟡' },
  3: { label: 'BAIXO',   color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', icon: '⚪' },
};

function TimeDistance({ dt }) {
  const now = new Date();
  const diffH = differenceInHours(dt, now);
  const diffD = differenceInDays(dt, now);
  if (diffH < 0) return <span style={{ color: '#334155', fontSize: 10 }}>Encerrado</span>;
  if (diffH <= 6) return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>🚨 {diffH}h</span>;
  if (diffH <= 24) return <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 10 }}>Hoje +{diffH}h</span>;
  return <span style={{ color: '#64748b', fontSize: 10 }}>Em {diffD}d</span>;
}

// ─── TABELA DE AGENDA ─────────────────────────────────────────────────────────
function AgendaTable({ events }) {
  const [filterTier, setFilterTier] = useState('Todos');
  const [filterAgency, setFilterAgency] = useState('Todas');
  const [sortBy, setSortBy] = useState('data');
  const [sortDir, setSortDir] = useState('asc');

  const agencies = ['Todas', ...new Set(events.map(e => e.agency))];
  const tierOptions = ['Todos', '1', '2'];

  const filtered = events
    .filter(e => filterTier === 'Todos' || String(e.tier) === filterTier)
    .filter(e => filterAgency === 'Todas' || e.agency === filterAgency)
    .sort((a, b) => {
      let va, vb;
      if (sortBy === 'data') { va = a.datetime_brt; vb = b.datetime_brt; }
      else if (sortBy === 'tier') { va = a.tier; vb = b.tier; }
      else if (sortBy === 'agency') { va = a.agency; vb = b.agency; }
      else { va = a.title; vb = b.title; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortBtn = ({ col, label }) => (
    <button onClick={() => toggleSort(col)} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: sortBy === col ? '#60a5fa' : '#334155',
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      display: 'flex', alignItems: 'center', gap: 3, padding: 0,
    }}>
      {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </button>
  );

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden' }}>
      {/* Filtros */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a2535', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Filtros:</span>

        {/* Importância */}
        <div style={{ display: 'flex', gap: 4 }}>
          {tierOptions.map(t => {
            const cfg = t !== 'Todos' ? IMPACT_CONFIG[parseInt(t)] : null;
            return (
              <button key={t} onClick={() => setFilterTier(t)} style={{
                padding: '3px 10px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: filterTier === t ? (cfg ? cfg.bg : 'rgba(59,130,246,0.12)') : 'transparent',
                borderColor: filterTier === t ? (cfg ? cfg.border : 'rgba(59,130,246,0.35)') : '#1a2535',
                color: filterTier === t ? (cfg ? cfg.color : '#60a5fa') : '#475569',
              }}>
                {cfg ? `${cfg.icon} Tier-${t}` : 'Todos'}
              </button>
            );
          })}
        </div>

        {/* Agência */}
        <div style={{ display: 'flex', gap: 4 }}>
          {agencies.map(a => {
            const aStyle = agencyColors[a] || null;
            return (
              <button key={a} onClick={() => setFilterAgency(a)} style={{
                padding: '3px 10px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: filterAgency === a ? (aStyle ? aStyle.bg : 'rgba(59,130,246,0.12)') : 'transparent',
                borderColor: filterAgency === a ? (aStyle ? aStyle.border : 'rgba(59,130,246,0.35)') : '#1a2535',
                color: filterAgency === a ? (aStyle ? aStyle.color : '#60a5fa') : '#475569',
              }}>
                {a}
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#334155' }}>{filtered.length} eventos</div>
      </div>

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1a2535' }}>
              <th style={{ padding: '8px 14px', textAlign: 'left', width: 90 }}>
                <SortBtn col="tier" label="Impacto" />
              </th>
              <th style={{ padding: '8px 14px', textAlign: 'left' }}>
                <SortBtn col="title" label="Evento" />
              </th>
              <th style={{ padding: '8px 14px', textAlign: 'left', width: 80 }}>
                <SortBtn col="agency" label="Agência" />
              </th>
              <th style={{ padding: '8px 14px', textAlign: 'left', width: 160 }}>
                <SortBtn col="data" label="Data / Hora BRT" />
              </th>
              <th style={{ padding: '8px 14px', textAlign: 'center', width: 90 }}>
                <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tempo</span>
              </th>
              <th style={{ padding: '8px 14px', textAlign: 'center', width: 60 }}>
                <span style={{ fontSize: 9, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Link</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, idx) => {
              const cfg = IMPACT_CONFIG[e.tier] || IMPACT_CONFIG[3];
              const a = agencyColors[e.agency] || agencyColors.BEA;
              const hoursAway = differenceInHours(e.datetime_brt, new Date());
              const isImminent = hoursAway <= 6 && hoursAway >= 0;

              return (
                <tr key={e.id} style={{
                  borderBottom: '1px solid rgba(26,37,53,0.5)',
                  background: isImminent ? 'rgba(239,68,68,0.04)' : idx % 2 === 0 ? 'transparent' : 'rgba(13,20,33,0.3)',
                }}>
                  {/* Impacto */}
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  {/* Título + tags */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>
                      {isImminent && <span style={{ fontSize: 10, marginRight: 6 }}>🚨</span>}
                      {e.title}
                    </div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {e.tags.map(t => (
                        <span key={t} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#0D1421', color: '#4a5568', border: '1px solid #1e2d45', fontFamily: 'JetBrains Mono, monospace' }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  {/* Agência */}
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: a.bg, color: a.color, border: `1px solid ${a.border}`, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                      {e.agency}
                    </span>
                  </td>
                  {/* Data */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>
                      {format(e.datetime_brt, "EEE dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa', fontWeight: 700 }}>
                      {format(e.datetime_brt, "HH:mm")} BRT
                    </div>
                  </td>
                  {/* Tempo */}
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <TimeDistance dt={e.datetime_brt} />
                  </td>
                  {/* Link */}
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 10, color: '#3b82f6', textDecoration: 'none',
                      padding: '3px 8px', borderRadius: 4,
                      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                      fontWeight: 600,
                    }}>
                      Oficial ↗
                    </a>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#334155', fontSize: 12 }}>
                  Nenhum evento encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── WEEKLY MINI CALENDAR ─────────────────────────────────────────────────────
function WeeklyCalendar({ events }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
        Semana Atual
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 8 }}>Dom → Sáb · padrão BRL</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((day, i) => {
          const dayEvents = events.filter(e => {
            const ed = new Date(e.datetime_brt);
            return ed.getDate() === day.getDate() && ed.getMonth() === day.getMonth() && ed.getFullYear() === day.getFullYear();
          });
          const isToday = day.toDateString() === today.toDateString();
          const isWeekend = i === 0 || i === 6;

          return (
            <div key={i} style={{
              background: isToday ? 'rgba(59,130,246,0.1)' : isWeekend ? 'rgba(30,45,69,0.3)' : '#0D1421',
              border: isToday ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1a2535',
              borderRadius: 8, padding: '8px 6px', minHeight: 64,
            }}>
              <div style={{ fontSize: 10, color: isToday ? '#60a5fa' : isWeekend ? '#475569' : '#64748b', fontWeight: isToday ? 700 : 500, marginBottom: 4, textAlign: 'center' }}>
                {dayLabels[i]}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? '#f1f5f9' : '#64748b', textAlign: 'center', marginBottom: 6 }}>
                {format(day, 'dd')}
              </div>
              {dayEvents.map(e => {
                const cfg = IMPACT_CONFIG[e.tier] || IMPACT_CONFIG[3];
                return (
                  <div key={e.id} style={{
                    fontSize: 9, background: cfg.bg, color: cfg.color,
                    borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    border: `1px solid ${cfg.border}`,
                  }}>
                    {cfg.icon} {e.agency}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(IMPACT_CONFIG).map(([tier, cfg]) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10 }}>{cfg.icon}</span>
            <span style={{ fontSize: 9, color: cfg.color, fontWeight: 600 }}>Tier-{tier} {cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MARKET HOURS TABLE ────────────────────────────────────────────────────────
function MarketHoursTable() {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2535', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🕐 Horários de Mercado</span>
        <span style={{ fontSize: 9, color: '#475569' }}>BRT</span>
      </div>
      {MARKET_HOURS_BRT.map((m, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '9px 14px',
          borderBottom: i < MARKET_HOURS_BRT.length - 1 ? '1px solid rgba(26,37,53,0.6)' : 'none',
          gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{m.name}</div>
            <div style={{ fontSize: 9, color: '#475569' }}>{m.note}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: m.color, fontWeight: 700 }}>
              {m.open} – {m.close}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CALENDAR PAGE ────────────────────────────────────────────────────────────
export function CalendarContent() {
  const now = new Date();
  const allUpcoming = econCalendar.filter(e => e.datetime_brt >= now).sort((a, b) => a.datetime_brt - b.datetime_brt);
  const todayEvents = allUpcoming.filter(e => differenceInHours(e.datetime_brt, now) <= 24);
  const weekEvents = allUpcoming.filter(e => differenceInDays(e.datetime_brt, now) <= 7);
  const tier1Events = allUpcoming.filter(e => e.tier === 1);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
            ◷ Calendário Econômico
          </h1>
          <ModeBadge />
        </div>
        <p style={{ fontSize: 11, color: '#4a5568', margin: 0 }}>
          Fed · BEA · BLS · Tier-1 &amp; Tier-2 · Ordenável · Filtrável · Semana: Dom → Sáb (BRL)
        </p>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Hoje', count: todayEvents.length, color: '#ef4444', icon: '🔴' },
          { label: 'Esta Semana', count: weekEvents.length, color: '#f59e0b', icon: '🟡' },
          { label: 'Tier-1 (Crítico)', count: tier1Events.length, color: '#a78bfa', icon: '🔴' },
          { label: 'Total Upcoming', count: allUpcoming.length, color: '#4a5568', icon: '📅' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: `1px solid ${s.color}20`, borderLeft: `3px solid ${s.color}`, borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#4a5568' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Regra de Ouro */}
      <GoldenRule />

      {/* Weekly mini calendar */}
      <WeeklyCalendar events={allUpcoming} />

      {/* Layout: Tabela + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) clamp(240px,300px,100%)', gap: 16, alignItems: 'flex-start' }}>
        {/* Tabela principal */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>📋 Agenda Completa</span>
            <span style={{ fontSize: 10, color: '#475569' }}>Clique nos cabeçalhos para ordenar</span>
          </div>
          <AgendaTable events={allUpcoming} />
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Tier-1 Priority */}
          <div style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>🔴 Tier-1 CRÍTICO</span>
            </div>
            {tier1Events.map(e => (
              <div key={e.id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(26,37,53,0.5)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{e.title}</div>
                <div style={{ fontSize: 9, color: '#8899a6', fontFamily: 'JetBrains Mono, monospace' }}>
                  {format(e.datetime_brt, "EEE dd/MM HH:mm", { locale: ptBR })} BRT
                </div>
                <div style={{ marginTop: 4 }}><TimeDistance dt={e.datetime_brt} /></div>
              </div>
            ))}
            {tier1Events.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: '#334155', textAlign: 'center' }}>Sem eventos Tier-1 próximos</div>
            )}
          </div>

          {/* Legenda de importância */}
          <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>📖 Classificação de Importância</div>
            {Object.entries(IMPACT_CONFIG).map(([tier, cfg]) => (
              <div key={tier} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, padding: '7px 9px', borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <span style={{ fontSize: 13 }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>Tier-{tier} — {cfg.label}</div>
                  <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5, marginTop: 1 }}>
                    {tier === '1' && 'Máximo impacto em BTC. CPI, FOMC, NFP, PCE, GDP. Move ±3-8%.'}
                    {tier === '2' && 'Impacto moderado. Jobless Claims, PMI, dados secundários.'}
                    {tier === '3' && 'Baixo impacto. Dados regionais, revisões, indicadores menores.'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Alerta macro */}
          <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📅 Alerta MACRO_EVENT</div>
            <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.6 }}>
              Alerta dispara quando qualquer evento Tier-1 está a menos de{' '}
              <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>6h</span>{' '}
              (configurável em Settings)
            </div>
          </div>

          <MarketHoursTable />
        </div>
      </div>
    </div>
  );
}