/**
 * telegram.ts — cliente para as Edge Functions de Telegram
 *
 * telegram-ping: dispara uma mensagem de teste para o bot configurado.
 * O token/chat_id são lidos pelo servidor (service_role) — nunca trafegam no body.
 */

import { env } from '@/lib/env';

export interface TelegramPingResult {
  ok:          boolean;
  latency_ms?: number;
  error?:      string;
  hint?:       string;
  reason?:     string;
}

/**
 * pingTelegram — chama a Edge Function `telegram-ping` e retorna o resultado.
 * Lança Error se Supabase não estiver configurado.
 */
export async function pingTelegram(): Promise<TelegramPingResult> {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey     = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase não configurado.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/telegram-ping`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({}),
  });

  const body = await res.json().catch(() => ({})) as TelegramPingResult;
  return { ...body, ok: res.ok && (body.ok ?? false) };
}
