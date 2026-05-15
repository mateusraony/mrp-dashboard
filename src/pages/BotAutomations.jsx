// ─── AUTOMAÇÕES — Telegram · Discord · Webhooks ───────────────────────────────
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { automationRules, botConnections, recentBotMessages } from '../components/data/mockDataActionDashboard';
import { globalRisk, fearGreed, btcFutures } from '../components/data/mockData';
import { ModeBadge } from '../components/ui/DataBadge';
import { sendNotificationEmail } from '@/lib/notificationClient';
import { useBtcTicker, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useMarketRegime } from '@/hooks/useMarketRegime';
import { IS_LIVE } from '@/lib/env';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_STYLE = {
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  LOW:    { color: '#64748b', bg: 'rgba(100,116,139,0.1)',border: 'rgba(100,116,139,0.25)' },
};

const CHANNEL_STYLE = {
  telegram: { color: '#29b6f6', icon: '✈️', label: 'Telegram' },
  discord:  { color: '#7289da', icon: '🎮', label: 'Discord' },
  webhook:  { color: '#10b981', icon: '🔗', label: 'Webhook' },
};

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.LOW;
  return <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{priority}</span>;
}

function ChannelChip({ channel }) {
  const s = CHANNEL_STYLE[channel] || CHANNEL_STYLE.webhook;
  return <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: s.color }}>{s.icon} {s.label}</span>;
}

// ─── BOT STATUS CARD ──────────────────────────────────────────────────────────
function BotCard({ bot, onTest }) {
  const s = CHANNEL_STYLE[bot.type] || CHANNEL_STYLE.webhook;
  const connected = bot.status === 'connected';
  // Quando IS_LIVE=false, bots "connected" no mock são exibidos como Demo (não realmente conectados)
  const isDemo = !IS_LIVE && connected;
  const dotColor   = isDemo ? '#f59e0b' : connected ? '#10b981' : '#475569';
  const dotGlow    = isDemo ? '0 0 6px #f59e0b' : connected ? '0 0 6px #10b981' : 'none';
  const statusLabel = isDemo ? 'Demo' : connected ? 'Conectado' : 'Desconectado';
  const borderColor = isDemo ? 'rgba(245,158,11,0.2)' : connected ? 'rgba(16,185,129,0.2)' : '#1e2d45';
  const minsAgo = bot.last_ping ? Math.round((Date.now() - bot.last_ping) / 60000) : null;

  return (
    <div style={{ background: '#111827', border: `1px solid ${borderColor}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}15`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{bot.name}</div>
          <div style={{ fontSize: 9, color: '#475569' }}>{s.label}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, boxShadow: dotGlow }} />
          <span style={{ fontSize: 9, color: dotColor, fontWeight: 700 }}>{statusLabel}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div><div style={{ fontSize: 8, color: '#334155' }}>Mensagens enviadas</div><div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#60a5fa' }}>{bot.messages_sent}</div></div>
        {minsAgo !== null && <div><div style={{ fontSize: 8, color: '#334155' }}>Último ping</div><div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{minsAgo < 60 ? `${minsAgo}m atrás` : `${Math.round(minsAgo / 60)}h atrás`}</div></div>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onTest(bot)}
          disabled={!connected}
          style={{ flex: 1, padding: '7px', borderRadius: 6, cursor: connected ? 'pointer' : 'default', fontSize: 10, fontWeight: 700, background: connected ? 'rgba(59,130,246,0.1)' : '#0d1421', border: `1px solid ${connected ? 'rgba(59,130,246,0.3)' : '#1a2535'}`, color: connected ? '#60a5fa' : '#334155' }}
        >
          🔔 Testar Envio
        </button>
        <button style={{ flex: 1, padding: '7px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700, background: 'transparent', border: '1px solid #1a2535', color: '#475569' }}>
          ⚙️ Configurar
        </button>
      </div>
    </div>
  );
}

// ─── RULE CARD ────────────────────────────────────────────────────────────────
function RuleCard({ rule, onToggle, onTestFire }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: '#111827', border: `1px solid ${rule.active ? '#1e2d45' : '#0f1d2e'}`, borderRadius: 10, padding: '14px 16px', opacity: rule.active ? 1 : 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Toggle */}
        <button
          onClick={() => onToggle(rule.id)}
          style={{
            width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
            background: rule.active ? '#10b981' : '#1a2535',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 14, height: 14, borderRadius: 7, background: '#fff',
            position: 'absolute', top: 3, transition: 'left 0.2s',
            left: rule.active ? 19 : 3,
          }} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: rule.active ? '#e2e8f0' : '#64748b', marginBottom: 3 }}>{rule.name}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>{rule.condition}</div>
            </div>
            <PriorityBadge priority={rule.priority} />
          </div>

          {/* Channels */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            {rule.channels.map(ch => <ChannelChip key={ch} channel={ch} />)}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 9, color: '#334155' }}>
              Disparos 24h: <span style={{ color: rule.fires_24h > 0 ? '#f59e0b' : '#475569', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{rule.fires_24h}</span>
            </div>
            {rule.last_fire && (
              <div style={{ fontSize: 9, color: '#334155' }}>
                Último: <span style={{ color: '#475569' }}>{Math.round((Date.now() - rule.last_fire) / 3600000)}h atrás</span>
              </div>
            )}
            <button onClick={() => setExpanded(e => !e)} style={{ marginLeft: 'auto', fontSize: 9, color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
              {expanded ? '▲ Ocultar' : '▼ Template'}
            </button>
            <button
              onClick={() => onTestFire(rule)}
              disabled={!rule.active}
              style={{ fontSize: 9, color: rule.active ? '#10b981' : '#334155', background: 'transparent', border: '1px solid', borderColor: rule.active ? 'rgba(16,185,129,0.3)' : '#1a2535', borderRadius: 4, cursor: rule.active ? 'pointer' : 'default', padding: '3px 8px', fontWeight: 700 }}
            >
              ▶ Disparar Teste
            </button>
          </div>

          {expanded && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: '#0a1018', border: '1px solid #0f1d2e' }}>
              <div style={{ fontSize: 8, color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Template de Mensagem</div>
              <pre style={{ fontSize: 10, color: '#64748b', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>{rule.message_template}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADD BOT MODAL ────────────────────────────────────────────────────────────
function AddBotModal({ onClose, onAdd }) {
  const [type, setType] = useState('telegram');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const handle = () => {
    onAdd({ type, name, token, chat_id: chatId, webhook_url: webhookUrl });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 14, width: '100%', maxWidth: 460, padding: '24px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', marginBottom: 16 }}>➕ Adicionar Canal de Notificação</div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['telegram', 'discord', 'webhook'].map(t => {
            const s = CHANNEL_STYLE[t];
            return (
              <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '10px 8px', borderRadius: 7, border: `1px solid ${type === t ? s.color : '#1e2d45'}`, cursor: 'pointer', background: type === t ? `${s.color}12` : 'transparent', color: type === t ? s.color : '#475569', fontSize: 11, fontWeight: 700 }}>
                {s.icon} {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nome do canal</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Alerts BTC Principal"
              style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '8px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {type === 'telegram' && (
            <>
              <div>
                <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bot Token</label>
                <input value={token} onChange={e => setToken(e.target.value)} placeholder="7xxxxxxx:AAH......"
                  style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '8px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Chat ID</label>
                <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="-100123456789"
                  style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '8px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(41,182,246,0.06)', border: '1px solid rgba(41,182,246,0.15)', fontSize: 9, color: '#29b6f6', lineHeight: 1.6 }}>
                💡 Crie um bot em @BotFather, adicione ao seu grupo e use /getid para obter o Chat ID.
              </div>
            </>
          )}

          {type === 'discord' && (
            <div>
              <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Webhook URL</label>
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
                style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '8px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 6, fontSize: 9, color: '#475569', lineHeight: 1.6 }}>
                💡 Configurações do Discord &rarr; Integrações &rarr; Webhooks &rarr; Criar Webhook
              </div>
            </div>
          )}

          {type === 'webhook' && (
            <div>
              <label style={{ fontSize: 9, color: '#475569', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>URL do Webhook</label>
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://seu-servidor.com/webhook"
                style={{ background: '#0d1421', border: '1px solid #1a2535', borderRadius: 6, color: '#e2e8f0', fontSize: 12, padding: '8px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 6, fontSize: 9, color: '#475569' }}>Payload JSON será enviado via POST a cada disparo.</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, background: 'transparent', border: '1px solid #1a2535', color: '#475569', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
            <button onClick={handle} disabled={!name} style={{ padding: '8px 20px', borderRadius: 7, background: name ? 'rgba(59,130,246,0.15)' : '#0d1421', border: `1px solid ${name ? 'rgba(59,130,246,0.4)' : '#1a2535'}`, color: name ? '#60a5fa' : '#334155', cursor: name ? 'pointer' : 'default', fontSize: 11, fontWeight: 700 }}>
              ✅ Adicionar Canal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = ['Canais', 'Regras', 'Histórico'];

export function BotsContent() {
  const [tab, setTab] = useState('Canais');
  const [rules, setRules] = useState(automationRules);
  const [bots, setBots] = useState(botConnections);
  const [messages, setMessages] = useState(recentBotMessages);
  const [showAddBot, setShowAddBot] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const { data: ticker }     = useBtcTicker();
  const { data: fng }        = useFearGreed(1);
  const { data: riskScore }  = useRiskScore();
  const { data: regimeData } = useMarketRegime();

  const liveRegime  = regimeData?.label  ?? globalRisk.regime;
  const liveScore   = riskScore?.score   ?? globalRisk.score;
  const liveFunding = ticker?.last_funding_rate ?? btcFutures.funding_rate;
  const liveFng     = fng?.value         ?? fearGreed.value;

  const showToast = (msg, color = '#10b981') => {
    setToastMsg({ msg, color });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const toggleRule = (id) => {
    setRules(r => r.map(rule => rule.id === id ? { ...rule, active: !rule.active } : rule));
  };

  const testBot = async (bot) => {
    showToast(`Enviando teste para ${bot.name}...`, '#60a5fa');
    try {
      await sendNotificationEmail({
        to: 'test@cryptowatch.io',
        subject: `[TESTE] CryptoWatch — ${bot.name}`,
        body: `Teste de conexão para o canal: ${bot.name}\nTipo: ${bot.type}\n\nRegime: ${liveRegime} | Score: ${liveScore}/100\nFunding: ${(liveFunding * 100).toFixed(4)}% | F&G: ${liveFng}\n\n— CryptoWatch Bot`,
      });
      showToast(`✅ Teste enviado para ${bot.name}!`, '#10b981');
    } catch (e) {
      showToast('Erro ao enviar teste.', '#ef4444');
    }
  };

  const testFireRule = async (rule) => {
    showToast(`Disparando: ${rule.name}...`, '#f59e0b');
    try {
      const msg = rule.message_template
        .replace('{{regime}}', liveRegime)
        .replace('{{score}}', String(liveScore))
        .replace('{{rate}}', (liveFunding * 100).toFixed(4))
        .replace('{{ann}}', (liveFunding * 3 * 365 * 100).toFixed(1))
        .replace('{{signal}}', 'bullish');
      await sendNotificationEmail({
        to: 'alerts@cryptowatch.io',
        subject: `[TESTE REGRA] ${rule.name} — CryptoWatch`,
        body: msg,
      });
      setMessages(prev => [{
        id: `m${Date.now()}`, channel: rule.channels[0], rule: rule.name,
        message: msg, sent_at: new Date(), status: 'delivered',
      }, ...prev]);
      showToast(`✅ Regra "${rule.name}" disparada!`, '#10b981');
    } catch (e) {
      showToast('Erro ao disparar regra.', '#ef4444');
    }
  };

  const activeRules = rules.filter(r => r.active).length;
  const connectedBots = bots.filter(b => b.status === 'connected').length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 300, padding: '10px 18px', borderRadius: 8, background: '#111827', border: `1px solid ${toastMsg.color}50`, color: toastMsg.color, fontSize: 12, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toastMsg.msg}
        </div>
      )}

      {showAddBot && <AddBotModal onClose={() => setShowAddBot(false)} onAdd={(bot) => setBots(b => [...b, { id: `bot${Date.now()}`, ...bot, status: 'disconnected', messages_sent: 0, last_ping: null }])} />}

      {/* Banner de aviso: nenhum bot real configurado */}
      {!IS_LIVE && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 9,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
          borderLeft: '4px solid #f59e0b',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div>
            <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 800 }}>Nenhum bot real configurado</span>
            <span style={{ fontSize: 11, color: '#92400e', marginLeft: 8 }}>
              — os canais abaixo são demonstração. Para receber alertas reais, configure um bot no Supabase.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
              🤖 Automações & Bots
            </h1>
            <ModeBadge mode={ticker ? 'live' : 'mock'} />
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Telegram · Discord · Webhooks · Regras baseadas em AI</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={createPageUrl('Opportunities')} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 7, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
            ⚡ Dashboard de Ações
          </Link>
          <Link to={createPageUrl('Automations')} style={{ fontSize: 11, padding: '7px 14px', borderRadius: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', textDecoration: 'none', fontWeight: 700 }}>
            ⚙️ Automações Clássicas
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Canais Conectados', value: connectedBots, color: '#10b981', total: bots.length },
          { label: 'Regras Ativas', value: activeRules, color: '#60a5fa', total: rules.length },
          { label: 'Disparos 24h', value: rules.reduce((s, r) => s + r.fires_24h, 0), color: '#f59e0b', total: null },
          { label: 'Msgs Enviadas', value: bots.reduce((s, b) => s + b.messages_sent, 0), color: '#a78bfa', total: null },
        ].map((s, i) => (
          <div key={i} style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: s.color, lineHeight: 1 }}>{s.value}{s.total !== null && <span style={{ fontSize: 12, color: '#334155' }}>/{s.total}</span>}</div>
          </div>
        ))}
      </div>

      {/* Anomaly live banner */}
      <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}>⚡</span>
        <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>Gatilho ativo detectado:</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Stablecoin Mint Anômalo — USDT +287% da média 7D · Net $420.6M</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>Regra 2 ativa → Telegram</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#0d1421', padding: 4, borderRadius: 8, border: '1px solid #1a2535', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: tab === t ? 800 : 500,
            background: tab === t ? 'rgba(59,130,246,0.18)' : 'transparent',
            color: tab === t ? '#60a5fa' : '#475569',
          }}>{t}</button>
        ))}
      </div>

      {/* TAB: Canais */}
      {tab === 'Canais' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Canais de Notificação</div>
            <button onClick={() => setShowAddBot(true)} style={{ padding: '7px 14px', borderRadius: 7, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              ➕ Adicionar Canal
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {bots.map(bot => <BotCard key={bot.id} bot={bot} onTest={testBot} />)}
          </div>

          {/* Setup guide */}
          <div style={{ marginTop: 16, padding: '16px', borderRadius: 10, background: '#0a1018', border: '1px solid #0f1d2e' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 10 }}>📖 Como configurar</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { icon: '✈️', title: 'Telegram', steps: ['1. Acesse @BotFather no Telegram', '2. Digite /newbot e siga as instruções', '3. Copie o token fornecido', '4. Adicione o bot ao seu grupo', '5. Use @RawDataBot para obter o Chat ID'] },
                { icon: '🎮', title: 'Discord', steps: ['1. Abra as configurações do servidor', '2. Integrações → Webhooks', '3. Clique em "Criar webhook"', '4. Copie a URL do webhook', '5. Cole no campo acima e teste'] },
                { icon: '🔗', title: 'Webhook Custom', steps: ['1. Crie um endpoint HTTP POST', '2. Configure para aceitar JSON', '3. Cole a URL no campo acima', '4. O payload inclui: rule, metric, value, timestamp', '5. Teste o disparo manual'] },
              ].map((guide, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>{guide.icon} {guide.title}</div>
                  {guide.steps.map((s, j) => (
                    <div key={j} style={{ fontSize: 9, color: '#475569', marginBottom: 3, paddingLeft: 4 }}>{s}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Regras */}
      {tab === 'Regras' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Regras de Automação</div>
            <div style={{ fontSize: 10, color: '#475569' }}>{activeRules} de {rules.length} ativas</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map(rule => (
              <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onTestFire={testFireRule} />
            ))}
          </div>
        </div>
      )}

      {/* TAB: Histórico */}
      {tab === 'Histórico' && (
        <div style={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>📨 Histórico de Mensagens Enviadas</div>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: 12 }}>Nenhuma mensagem enviada ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map(m => {
                const s = CHANNEL_STYLE[m.channel] || CHANNEL_STYLE.webhook;
                const minsAgo = Math.round((Date.now() - Number(m.sent_at)) / 60000);
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#0d1421', border: '1px solid #1a2535', borderRadius: 8 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 8, color: '#334155' }}>{minsAgo < 60 ? `${minsAgo}m atrás` : `${Math.round(minsAgo / 60)}h atrás`}</span>
                          <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>✓ {m.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: '#475569', marginBottom: 5 }}>Regra: {m.rule}</div>
                      <pre style={{ fontSize: 9, color: '#64748b', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.4 }}>{m.message}</pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer links */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Dashboard de Ações', page: 'Opportunities', icon: '⚡' },
          { label: 'Automações Clássicas', page: 'Automations', icon: '⚙️' },
          { label: 'Smart Alerts', page: 'SmartAlerts', icon: '🔔' },
          { label: 'Relatório Executivo', page: 'ExecutiveReport', icon: '📊' },
        ].map((l, i) => (
          <Link key={i} to={createPageUrl(l.page)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#3b82f6', textDecoration: 'none', padding: '3px 9px', borderRadius: 5, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600 }}>
            {l.icon} {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}