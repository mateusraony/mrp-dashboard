import { useState, useEffect } from 'react';
import { THRESHOLDS, sourceHealth } from '../components/data/mockData';
import { logError, logInfo } from '@/lib/debugLog';
import { ModeBadge, GradeBadge } from '../components/ui/DataBadge';
import { DATA_MODE, setDataMode, env } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { useUserSettings, useUpdateSettings } from '@/hooks/useSupabase';

function SettingRow({ label, value, description, type = 'text', options = undefined }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0',
      borderBottom: '1px solid rgba(30,45,69,0.5)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: '#4a5568' }}>{description}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {type === 'select' ? (
          <select value={v} onChange={e => setV(e.target.value)} style={{
            background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
            color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'toggle' ? (
          <div
            onClick={() => setV(v => !v)}
            style={{
              width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
              background: v ? '#3b82f6' : '#1e2d45',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: v ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
        ) : (
          <input
            type={type}
            value={v}
            onChange={e => setV(e.target.value)}
            style={{
              background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
              color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace', width: 120,
            }}
          />
        )}
        <button
          onClick={handleSave}
          style={{
            background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)',
            color: saved ? '#10b981' : '#60a5fa',
            border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.25)'}`,
            borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {saved ? '✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2d45',
      borderRadius: 12, padding: '16px 20px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

// ─── DATA MODE TOGGLE ─────────────────────────────────────────────────────────
function DataModeToggle() {
  const isLive = DATA_MODE === 'live';
  const [confirming, setConfirming] = useState(false);
  const supabaseOk = isSupabaseConfigured();

  const handleToggle = () => {
    if (!confirming) { setConfirming(true); return; }
    setDataMode(isLive ? 'mock' : 'live');
  };

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
            DATA_MODE
          </div>
          <div style={{ fontSize: 11, color: '#4a5568' }}>
            Alterna entre mock data (sem rede) e APIs reais (Binance, CoinGecko, Deribit, FRED, Mempool).
            A página recarrega ao trocar.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Status badge */}
          <span style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            padding: '3px 8px', borderRadius: 4,
            background: isLive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.1)',
            color: isLive ? '#10b981' : '#f59e0b',
            border: `1px solid ${isLive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.25)'}`,
            letterSpacing: '0.06em',
          }}>
            {isLive ? 'LIVE' : 'MOCK'}
          </span>
          {/* Toggle switch */}
          <div
            onClick={handleToggle}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
              background: isLive ? '#10b981' : '#1e2d45',
              position: 'relative', transition: 'background 0.2s',
              border: `1px solid ${isLive ? 'rgba(16,185,129,0.5)' : '#2a3f5f'}`,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
              left: isLive ? 22 : 3,
            }} />
          </div>
        </div>
      </div>

      {/* Confirmação antes de trocar */}
      {confirming && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 8,
          background: isLive ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
          border: `1px solid ${isLive ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
          fontSize: 11,
        }}>
          <div style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: 600 }}>
            {isLive
              ? 'Mudar para MOCK? As páginas usarão dados simulados. A página vai recarregar.'
              : 'Mudar para LIVE? As páginas buscarão dados reais de todas as APIs configuradas. A página vai recarregar.'}
          </div>
          {!isLive && !supabaseOk && (
            <div style={{ color: '#f59e0b', fontSize: 10, marginBottom: 8 }}>
              ⚠️ Supabase não configurado — portfólio e alertas usarão estado local (sem persistência).
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleToggle} style={{
              background: isLive ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
              color: isLive ? '#f59e0b' : '#10b981',
              border: `1px solid ${isLive ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
              borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>
              Confirmar e recarregar
            </button>
            <button onClick={() => setConfirming(false)} style={{
              background: 'transparent', color: '#4a5568',
              border: '1px solid rgba(30,45,69,0.8)',
              borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botão: restaurar padrão do servidor */}
      <div style={{ paddingTop: 12, borderTop: '1px solid rgba(30,45,69,0.4)', marginTop: 12 }}>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>
          Se o modo acima não reflete o esperado, pode haver um override salvo no localStorage.
          Clique abaixo para removê-lo e usar o padrão configurado no build do Render (<code style={{ fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>VITE_DATA_MODE</code>).
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('mrp_data_mode');
            window.location.reload();
          }}
          style={{
            background: 'rgba(239,68,68,0.07)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6, padding: '5px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
        >
          Restaurar padrão do servidor (Render)
        </button>
      </div>
    </div>
  );
}

// ─── TELEGRAM SECTION (real persistence) ─────────────────────────────────────

const SCHEDULE_OPTIONS = [
  '07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00',
  '19:00','20:00','21:00','22:00',
];

function TelegramSection() {
  const { data: settings, isLoading } = useUserSettings();
  const updateSettings = useUpdateSettings();

  const [enabled, setEnabled]       = useState(false);
  const [token, setToken]           = useState('');
  const [chatId, setChatId]         = useState('');
  const [schedule, setSchedule]     = useState('11:00');
  const [showToken, setShowToken]   = useState(false);
  const [saveStatus, setSaveStatus] = useState(/** @type {'idle'|'saving'|'saved'|'error'} */('idle'));
  const [testStatus, setTestStatus] = useState(/** @type {'idle'|'sending'|'sent'|'error'} */('idle'));
  const [testMsg, setTestMsg]       = useState('');

  // Populate form from Supabase settings on load
  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.telegram_enabled ?? false);
    setToken(settings.telegram_bot_token ?? '');
    setChatId(settings.telegram_chat_id ?? '');
    setSchedule(settings.telegram_schedule ?? '11:00');
  }, [settings]);

  const handleSave = async () => {
    setSaveStatus('saving');
    logInfo('Tentativa de save das configurações do Telegram', { enabled, schedule }, 'Settings.TelegramSection');
    try {
      await updateSettings.mutateAsync({
        telegram_enabled:   enabled,
        telegram_bot_token: token.trim() || null,
        telegram_chat_id:   chatId.trim() || null,
        telegram_schedule:  schedule,
      });
      setSaveStatus('saved');
      logInfo('Configurações do Telegram salvas com sucesso', undefined, 'Settings.TelegramSection');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (/** @type {unknown} */ err) {
      setSaveStatus('error');
      logError('Falha ao salvar configurações do Telegram no Supabase', err, 'Settings.TelegramSection');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleTest = async () => {
    if (!token.trim() || !chatId.trim()) {
      setTestMsg('Bot Token e Chat ID são obrigatórios.');
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
      return;
    }

    setTestStatus('sending');
    setTestMsg('');

    try {
      const supabaseUrl = env.VITE_SUPABASE_URL;
      const anonKey     = env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) throw new Error('Supabase não configurado.');

      // Salva antes de testar para que a Edge Function leia o token atualizado
      await updateSettings.mutateAsync({
        telegram_enabled:   true,
        telegram_bot_token: token.trim(),
        telegram_chat_id:   chatId.trim(),
        telegram_schedule:  schedule,
      });

      // telegram-ping: valida token + chat_id e envia mensagem de teste isolada
      const res = await fetch(`${supabaseUrl}/functions/v1/telegram-ping`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ token: token.trim(), chat_id: chatId.trim() }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok && body.ok) {
        setTestStatus('sent');
        setTestMsg(`Mensagem enviada! (latência: ${body.latency_ms ?? '?'}ms)`);
      } else {
        setTestStatus('error');
        setTestMsg(body.hint ?? body.error ?? body.reason ?? `HTTP ${res.status}`);
      }
    } catch (/** @type {any} */ err) {
      setTestStatus('error');
      setTestMsg(err?.message ?? 'Erro desconhecido.');
    } finally {
      setTimeout(() => { setTestStatus('idle'); setTestMsg(''); }, 5000);
    }
  };

  const row = (label, description, control) => (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0',
      borderBottom: '1px solid rgba(30,45,69,0.5)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: '#4a5568' }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );

  if (isLoading) {
    return (
      <Section title="📨 Reports & Telegram">
        <div style={{ fontSize: 12, color: '#4a5568', padding: '12px 0' }}>Carregando configurações…</div>
      </Section>
    );
  }

  return (
    <Section title="📨 Reports & Telegram">
      {/* Supabase not configured warning */}
      {!isSupabaseConfigured() && (
        <div style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 11,
          background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
          color: '#f59e0b',
        }}>
          ⚠️ Supabase não configurado — configurações não serão persistidas.
        </div>
      )}

      {/* Enable toggle */}
      {row(
        'TELEGRAM_ENABLED',
        'Ativa o envio automático do resumo diário via Telegram Bot.',
        <div
          onClick={() => setEnabled(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
            background: enabled ? '#3b82f6' : '#1e2d45',
            position: 'relative', transition: 'background 0.2s',
            border: `1px solid ${enabled ? 'rgba(59,130,246,0.5)' : '#2a3f5f'}`,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s', left: enabled ? 22 : 3,
          }} />
        </div>
      )}

      {/* Bot Token */}
      {row(
        'TELEGRAM_BOT_TOKEN',
        'Token do bot obtido via @BotFather no Telegram.',
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="1234567890:AABBcc..."
            style={{
              background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
              color: '#e2e8f0', padding: '5px 8px', fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace', width: 210,
            }}
          />
          <button
            onClick={() => setShowToken(v => !v)}
            title={showToken ? 'Ocultar' : 'Mostrar'}
            style={{
              background: 'rgba(59,130,246,0.08)', color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
              padding: '5px 8px', fontSize: 11, cursor: 'pointer',
            }}
          >
            {showToken ? '👁‍🗨' : '👁'}
          </button>
        </div>
      )}

      {/* Chat ID */}
      {row(
        'TELEGRAM_CHAT_ID',
        'ID do chat ou canal. Use @userinfobot no Telegram para obter.',
        <input
          type="text"
          value={chatId}
          onChange={e => setChatId(e.target.value)}
          placeholder="-100123456789"
          style={{
            background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
            color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace', width: 160,
          }}
        />
      )}

      {/* Schedule */}
      {row(
        'TELEGRAM_SCHEDULE',
        'Horário exibido no digest (UTC). O disparo automático ocorre às 11:00 UTC via pg_cron.',
        <select
          value={schedule}
          onChange={e => setSchedule(e.target.value)}
          style={{
            background: '#0D1421', border: '1px solid #2a3f5f', borderRadius: 6,
            color: '#e2e8f0', padding: '5px 8px', fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {SCHEDULE_OPTIONS.map(t => (
            <option key={t} value={t}>{t} UTC</option>
          ))}
        </select>
      )}

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          style={{
            background: saveStatus === 'saved'  ? 'rgba(16,185,129,0.15)'
                      : saveStatus === 'error'  ? 'rgba(239,68,68,0.12)'
                      : 'rgba(59,130,246,0.12)',
            color:      saveStatus === 'saved'  ? '#10b981'
                      : saveStatus === 'error'  ? '#ef4444'
                      : '#60a5fa',
            border: `1px solid ${
                        saveStatus === 'saved'  ? 'rgba(16,185,129,0.35)'
                      : saveStatus === 'error'  ? 'rgba(239,68,68,0.3)'
                      : 'rgba(59,130,246,0.25)'}`,
            borderRadius: 7, padding: '7px 18px', fontSize: 12,
            fontWeight: 600, cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saveStatus === 'saving' ? 'Salvando…'
         : saveStatus === 'saved'  ? '✓ Salvo'
         : saveStatus === 'error'  ? '✗ Erro ao salvar'
         : 'Salvar configurações'}
        </button>

        {/* Test button */}
        <button
          onClick={handleTest}
          disabled={testStatus === 'sending'}
          style={{
            background: testStatus === 'sent'    ? 'rgba(16,185,129,0.1)'
                      : testStatus === 'error'   ? 'rgba(239,68,68,0.08)'
                      : 'rgba(245,158,11,0.08)',
            color:      testStatus === 'sent'    ? '#10b981'
                      : testStatus === 'error'   ? '#ef4444'
                      : '#f59e0b',
            border: `1px solid ${
                        testStatus === 'sent'    ? 'rgba(16,185,129,0.3)'
                      : testStatus === 'error'   ? 'rgba(239,68,68,0.25)'
                      : 'rgba(245,158,11,0.2)'}`,
            borderRadius: 7, padding: '7px 18px', fontSize: 12,
            fontWeight: 600, cursor: testStatus === 'sending' ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {testStatus === 'sending' ? '📤 Enviando…'
         : testStatus === 'sent'    ? '✓ Enviado!'
         : testStatus === 'error'   ? '✗ Falhou'
         : '📤 Enviar teste'}
        </button>

        {/* Feedback message */}
        {testMsg && (
          <span style={{
            fontSize: 11,
            color: testStatus === 'error' ? '#ef4444' : '#10b981',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {testMsg}
          </span>
        )}
      </div>

      {/* pg_cron status — instrução honesta, sem falso "ativo" */}
      <div style={{
        marginTop: 14, padding: '10px 12px', borderRadius: 7, fontSize: 11,
        background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)',
        color: '#4a6580', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{ fontSize: 13, marginTop: 1 }}>⚙️</span>
        <div>
          <strong style={{ color: '#f59e0b' }}>Agendamento automático</strong>
          {' — '}para ativar os jobs automáticos (digest diário + alertas por evento), execute o SQL da{' '}
          <strong>Parte 4</strong> do arquivo <code style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>sql-migration.sql</code>{' '}
          no{' '}<strong style={{ color: '#60a5fa' }}>Supabase Dashboard → SQL Editor</strong>{' '}
          após o deploy das Edge Functions.
        </div>
      </div>
    </Section>
  );
}

export default function Settings() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>
          Settings
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: '#4a5568', margin: 0 }}>
            Configuration · Persistent via Supabase ·
          </p>
          <ModeBadge />
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>POST /admin/settings</span>
        </div>
      </div>

      {/* Auth note */}
      <div style={{
        marginBottom: 16, padding: '10px 14px',
        background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8, fontSize: 11, color: '#4a5568',
      }}>
        <strong style={{ color: '#f59e0b' }}>Security:</strong>{' '}
        In production, /admin/settings requires header{' '}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>X-TICK-TOKEN</span>.
        Changes are persisted to Supabase <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>settings</span> table.
      </div>

      {/* Data Mode */}
      <Section title="📡 Data Mode">
        <DataModeToggle />
        <SettingRow
          label="CRYPTO_SYMBOLS"
          value="BTCUSDT"
          description="Comma-separated symbols to monitor (Binance USDⓈ-M Futures)"
        />
      </Section>

      {/* Modules */}
      <Section title="🔧 Module Toggles">
        {[
          ['ENABLE_OPTIONS', true, 'Deribit options data (IV, skew, smile)'],
          ['ENABLE_SPOT_FLOW', true, 'Binance Spot CVD and taker flow'],
          ['ENABLE_ONCHAIN', true, 'mempool.space on-chain data'],
          ['ENABLE_NEWS', true, 'GDELT news feed'],
          ['ENABLE_FEAR_GREED', true, 'Alternative.me Fear & Greed Index'],
          ['ENABLE_COINMETRICS', false, 'CoinMetrics community (optional, may be slow)'],
        ].map(([k, v, d]) => (
          <SettingRow key={String(k)} label={String(k)} value={v} type="toggle" description={String(d)} />
        ))}
      </Section>

      {/* Reports & Telegram — real persistence */}
      <TelegramSection />

      {/* Thresholds */}
      <Section title="⚡ Alert Thresholds">
        {Object.entries(THRESHOLDS).map(([k, v]) => (
          <SettingRow
            key={k}
            label={k}
            value={String(v)}
            type="number"
            description={
              k === 'RISK_ALERT_SCORE' ? 'Score to trigger SQUEEZE/FLUSH alerts' :
              k === 'GLOBAL_RISKOFF_SCORE' ? 'Global score below this = RISK-OFF alert' :
              k === 'GLOBAL_RISKON_SCORE' ? 'Global score above this = RISK-ON alert' :
              k === 'MACRO_EVENT_LEAD_HOURS' ? 'Hours before Tier-1 event to alert' :
              k === 'EVAL_WINDOW_MIN' ? 'Window to evaluate alert outcome (minutes)' :
              k === 'FUNDING_REF' ? 'Funding rate normalization reference' :
              k === 'OI_REF_PCT' ? 'OI delta % normalization reference' :
              undefined
            }
          />
        ))}
      </Section>

      {/* FRED Series */}
      <Section title="📊 FRED Macro Series">
        <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 10 }}>
          FRED series IDs fetched daily. Data is not intraday.
        </div>
        {[
          ['SP500', 'SP500', 'S&P 500 Index'],
          ['USD_INDEX', 'DTWEXBGS', 'USD Broad Index (proxy DXY)'],
          ['GOLD', 'GOLDAMGBD228NLBM', 'Gold USD LBMA AM'],
          ['VIX', 'VIXCLS', 'CBOE VIX'],
          ['US10Y', 'DGS10', 'US 10-Year Treasury Yield'],
          ['US2Y', 'DGS2', 'US 2-Year Treasury Yield'],
        ].map(([k, v, d]) => (
          <SettingRow key={k} label={k} value={v} description={d} />
        ))}
      </Section>

      {/* Source health read-only */}
      <div style={{
        background: '#111827', border: '1px solid #1e2d45',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📡 Source Health (read-only)</div>
        </div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Source</th>
              <th style={{ textAlign: 'right' }}>Latency</th>
              <th style={{ textAlign: 'right' }}>Staleness</th>
              <th style={{ textAlign: 'right' }}>Fail 24h</th>
              <th style={{ textAlign: 'right' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {sourceHealth.map(s => (
              <tr key={s.source}>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8899a6' }}>{s.source}</td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#4a5568' }}>
                  {s.latency_ms ? `${s.latency_ms}ms` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#4a5568' }}>
                  {s.staleness_sec ? (s.staleness_sec < 60 ? `${s.staleness_sec}s` : `${Math.round(s.staleness_sec/60)}m`) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: s.fail_count_24h > 0 ? '#ef4444' : '#4a5568' }}>
                  {s.fail_count_24h}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <GradeBadge grade={s.grade} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}