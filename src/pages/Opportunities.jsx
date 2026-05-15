// ─── OPORTUNIDADES — Ações AI + Estratégias ───────────────────────────────────
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ActionsContent } from './ActionDashboard';
import { StrategiesContent } from './Strategies';

const TABS = [
  { id: 'actions', label: '⚡ Ações AI' },
  { id: 'strategies', label: '📐 Estratégias' },
];

export default function Opportunities() {
  const { state } = useLocation();
  const [tab, setTab] = useState(state?.tab ?? 'actions');
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: tab === t.id ? 800 : 500,
            background: tab === t.id ? 'rgba(59,130,246,0.18)' : 'transparent',
            color: tab === t.id ? '#60a5fa' : '#475569',
          }}>{t.label}</button>
        ))}
      </div>
      {tab === 'actions' && <ActionsContent />}
      {tab === 'strategies' && <StrategiesContent />}
    </div>
  );
}
