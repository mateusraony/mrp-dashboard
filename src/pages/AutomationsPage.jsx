// ─── AUTOMAÇÕES — Regras + Bots & Webhooks ────────────────────────────────────
import { useState } from 'react';
import Automations from './Automations';
import { BotsContent } from './BotAutomations';

const TABS = [
  { id: 'rules', label: '⚙️ Regras' },
  { id: 'bots', label: '🤖 Bots & Webhooks' },
];

export default function AutomationsPage() {
  const [tab, setTab] = useState('rules');
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
      {tab === 'rules' && <Automations />}
      {tab === 'bots' && <BotsContent />}
    </div>
  );
}
