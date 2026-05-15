// ─── DERIVATIVES — Overview + Avançado ───────────────────────────────────────
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DerivativesOverview } from './Derivatives';
import { AdvancedContent } from './DerivativesAdvanced';

const TABS = [
  { id: 'overview', label: '⟆ Overview' },
  { id: 'advanced', label: '⚗️ Avançado' },
];

export default function DerivativesPage() {
  const { state } = useLocation();
  const [tab, setTab] = useState(state?.tab ?? 'overview');
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
      {tab === 'overview' && <DerivativesOverview />}
      {tab === 'advanced' && <AdvancedContent />}
    </div>
  );
}
