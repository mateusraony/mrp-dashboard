/**
 * send-telegram-digest — Edge Function Supabase (Deno)
 *
 * Envia resumo diário de mercado via Telegram Bot API.
 * Chamada via pg_cron (SELECT net.http_post(...)) ou manualmente via HTTP.
 *
 * Variáveis de ambiente necessárias no Supabase Dashboard:
 *   SUPABASE_URL        — definida automaticamente
 *   SUPABASE_SERVICE_ROLE_KEY — definida automaticamente
 *
 * As configurações do bot (token, chat_id, schedule) são lidas da tabela
 * user_settings diretamente — editáveis pela aba Settings do dashboard.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TelegramSettings {
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_bot_token: string | null;
  telegram_schedule: string;
}

interface MarketSnapshot {
  btc_price: number;
  funding_rate: number;
  mvrv: number;
  fear_greed: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  try {
    // BTC preço + funding via Binance (público)
    const [tickerRes, fundingRes, fngRes] = await Promise.allSettled([
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT'),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
      fetch('https://api.alternative.me/fng/?limit=1'),
    ]);

    let btc_price = 0;
    let funding_rate = 0;
    let fear_greed = 50;

    if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
      const d = await tickerRes.value.json();
      btc_price = parseFloat(d.lastPrice ?? '0');
    }
    if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
      const d = await fundingRes.value.json();
      funding_rate = parseFloat(d.lastFundingRate ?? '0') * 100;
    }
    if (fngRes.status === 'fulfilled' && fngRes.value.ok) {
      const d = await fngRes.value.json();
      fear_greed = parseInt(d.data?.[0]?.value ?? '50', 10);
    }

    return { btc_price, funding_rate, mvrv: 0, fear_greed };
  } catch {
    return { btc_price: 0, funding_rate: 0, mvrv: 0, fear_greed: 50 };
  }
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtFunding(f: number): string {
  const sign = f >= 0 ? '+' : '';
  const color = Math.abs(f) > 0.05 ? '🔴' : f >= 0 ? '🟢' : '🟡';
  return `${color} ${sign}${f.toFixed(4)}%/8h`;
}

function fmtFng(v: number): string {
  if (v >= 75) return `${v} 🔴 Extreme Greed`;
  if (v >= 55) return `${v} 🟡 Greed`;
  if (v >= 45) return `${v} ⚪ Neutral`;
  if (v >= 25) return `${v} 🟡 Fear`;
  return `${v} 🔴 Extreme Fear`;
}

function buildMessage(snap: MarketSnapshot, schedule: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  return [
    `📊 *MRP Dashboard — Resumo Diário*`,
    `_${dateStr} · ${timeStr} BRT_`,
    ``,
    `💰 *BTC* ${snap.btc_price > 0 ? fmtPrice(snap.btc_price) : 'N/A'}`,
    `📈 *Funding* ${fmtFunding(snap.funding_rate)}`,
    `🧠 *Fear & Greed* ${fmtFng(snap.fear_greed)}`,
    ``,
    `🔗 [Abrir Dashboard](https://mrp-dashboard.onrender.com)`,
    ``,
    `_Agendado: ${schedule} UTC · Via MRP Dashboard_`,
  ].join('\n');
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Telegram API error:', err);
    return false;
  }

  const result = await res.json();
  return result.ok === true;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const sb = createClient(supabaseUrl, serviceKey);

    // Lê configurações do Telegram da tabela user_settings
    const { data: settings, error: settingsError } = await sb
      .from('user_settings')
      .select('telegram_enabled, telegram_chat_id, telegram_bot_token, telegram_schedule')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao ler configurações: ' + settingsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cfg: TelegramSettings = {
      telegram_enabled:    settings?.telegram_enabled    ?? false,
      telegram_chat_id:    settings?.telegram_chat_id    ?? null,
      telegram_bot_token:  settings?.telegram_bot_token  ?? null,
      telegram_schedule:   settings?.telegram_schedule   ?? '11:00',
    };

    // Verifica se está habilitado
    if (!cfg.telegram_enabled) {
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'Telegram desabilitado nas configurações' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!cfg.telegram_chat_id || !cfg.telegram_bot_token) {
      return new Response(
        JSON.stringify({ status: 'error', reason: 'telegram_chat_id ou telegram_bot_token não configurados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Busca dados de mercado
    const snapshot = await fetchMarketSnapshot();

    // Monta e envia a mensagem
    const message = buildMessage(snapshot, cfg.telegram_schedule);
    const sent    = await sendTelegram(cfg.telegram_bot_token, cfg.telegram_chat_id, message);

    return new Response(
      JSON.stringify({
        status: sent ? 'sent' : 'failed',
        btc_price: snapshot.btc_price,
        timestamp: new Date().toISOString(),
      }),
      { status: sent ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
