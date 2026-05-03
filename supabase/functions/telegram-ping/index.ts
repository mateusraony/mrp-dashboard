/**
 * telegram-ping — Edge Function Supabase (Deno)
 *
 * Endpoint de teste para validar configuração do Telegram.
 * Lê token e chat_id exclusivamente de user_settings via service_role key.
 * O token NUNCA é aceito no body da requisição — segurança por design.
 *
 * POST /functions/v1/telegram-ping
 * Body: ignorado (token lido do banco servidor-lado)
 *
 * Retorna:
 *   { ok, bot_info, chat_id, message_id, latency_ms } em caso de sucesso
 *   { ok: false, error, telegram_status, telegram_body } em caso de falha
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function log(level: string, msg: string, data?: unknown) {
  console.log(JSON.stringify({ level, msg, data, ts: new Date().toISOString() }));
}

async function getBotInfo(token: string): Promise<{ ok: boolean; username?: string; first_name?: string; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const body = await res.json() as { ok: boolean; result?: { username: string; first_name: string } };
  if (!body.ok) return { ok: false, error: 'Telegram returned ok=false' };
  return { ok: true, username: body.result?.username, first_name: body.result?.first_name };
}

async function sendPingMessage(token: string, chatId: string): Promise<{
  ok: boolean; msgId?: number; telegramStatus?: number; telegramBody?: string; latencyMs: number;
}> {
  const t0  = Date.now();
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const text = [
    `✅ *Telegram Ping — OK*`,
    ``,
    `📡 MRP Dashboard confirmou conexão com sucesso.`,
    `🕐 ${now} BRT`,
    ``,
    `_Bot configurado e pronto para alertas macro._`,
  ].join('\n');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    signal:  AbortSignal.timeout(10_000),
  });

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    const telegramBody = await res.text().catch(() => '');
    return { ok: false, telegramStatus: res.status, telegramBody: telegramBody.slice(0, 500), latencyMs };
  }

  const body = await res.json() as { ok: boolean; result?: { message_id: number } };
  return { ok: body.ok, msgId: body.result?.message_id, telegramStatus: res.status, latencyMs };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Lê token e chat_id exclusivamente do banco via service_role.
    // O token nunca deve trafegar no body da requisição do cliente.
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: settings } = await sb
      .from('user_settings')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('user_id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    const token: string | null  = settings?.telegram_bot_token ?? null;
    const chatId: string | null = settings?.telegram_chat_id   ?? null;

    if (!token || !chatId) {
      return new Response(
        JSON.stringify({
          ok:    false,
          error: 'Bot Token e Chat ID não configurados. Vá em Configurações → Telegram e salve o token e chat_id antes de testar.',
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Valida token via getMe
    const botInfo = await getBotInfo(token);
    if (!botInfo.ok) {
      log('WARN', 'telegram-ping: token inválido', { error: botInfo.error });
      return new Response(
        JSON.stringify({
          ok:    false,
          error: `Token inválido ou expirado. ${botInfo.error}`,
          hint:  'Verifique se o token está correto (formato: 123456789:ABC-DEF...). Crie um novo bot com @BotFather se necessário.',
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Envia mensagem de ping
    const result = await sendPingMessage(token, chatId);

    if (!result.ok) {
      log('WARN', 'telegram-ping: falha ao enviar mensagem', { chatId, status: result.telegramStatus, body: result.telegramBody });

      let hint = 'Verifique o Chat ID.';
      if (result.telegramBody?.includes('chat not found')) {
        hint = 'Chat não encontrado. Envie /start para o bot primeiro, então use @userinfobot para obter seu chat_id.';
      } else if (result.telegramBody?.includes('Forbidden')) {
        hint = 'Bot não tem permissão para enviar mensagens. O usuário deve iniciar a conversa com /start.';
      }

      return new Response(
        JSON.stringify({
          ok:             false,
          error:          `Telegram retornou erro HTTP ${result.telegramStatus}`,
          telegram_body:  result.telegramBody,
          hint,
          latency_ms:     result.latencyMs,
          bot_info:       botInfo,
        }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    log('INFO', 'telegram-ping: sucesso', { chatId, msgId: result.msgId, latencyMs: result.latencyMs });

    return new Response(
      JSON.stringify({
        ok:         true,
        message_id: result.msgId,
        chat_id:    chatId,
        latency_ms: result.latencyMs,
        bot_info:   { username: botInfo.username, first_name: botInfo.first_name },
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', 'telegram-ping: erro crítico', { error: msg });

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
