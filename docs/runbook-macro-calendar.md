# Runbook — MacroCalendar Production

## 1. Configurar Telegram Bot

### Criar bot
1. Abra o Telegram e inicie conversa com `@BotFather`
2. Envie `/newbot` e siga as instruções
3. Guarde o token no formato `123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

### Obter Chat ID
1. Envie `/start` para o seu novo bot
2. Abra `@userinfobot` no Telegram e envie qualquer mensagem
3. Ele responde com seu `Id:` — esse é o `chat_id`

### Configurar no Dashboard
1. Acesse **Configurações → Telegram**
2. Preencha **Bot Token** e **Chat ID**
3. Clique **Salvar**
4. Clique **Enviar Teste** — confirme recebimento no Telegram

### Testar via API direta
```bash
curl -X POST https://<SUPABASE_URL>/functions/v1/telegram-ping \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"token": "<BOT_TOKEN>", "chat_id": "<CHAT_ID>"}'
```
Resposta esperada: `{"ok": true, "message_id": ..., "latency_ms": ...}`

---

## 2. Deploy das Edge Functions no Supabase

```bash
# Login (uma vez)
npx supabase login

# Link ao projeto
npx supabase link --project-ref <PROJECT_REF>

# Deploy de todas as funções
npx supabase functions deploy fred-proxy
npx supabase functions deploy macro-actual-fetcher
npx supabase functions deploy macro-alert-worker
npx supabase functions deploy send-telegram-digest
npx supabase functions deploy telegram-ping

# Configurar secrets
npx supabase secrets set FRED_API_KEY=<sua_chave_fred>
```

Chave FRED gratuita: https://fred.stlouisfed.org/docs/api/api_key.html

---

## 3. Configurar pg_cron (agendamento automático)

No Supabase Dashboard → **SQL Editor**, execute:

```sql
-- Habilitar extensão (só precisa uma vez)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Variáveis de projeto (substitua os valores)
ALTER DATABASE postgres SET app.supabase_url = 'https://<PROJECT_REF>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<SERVICE_ROLE_KEY>';

-- Job 1: buscar actuals do FRED (a cada 15min)
SELECT cron.schedule(
  'macro-actual-fetcher',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/macro-actual-fetcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Job 2: worker de alertas Telegram (a cada 5min)
SELECT cron.schedule(
  'macro-alert-worker',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/macro-alert-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Job 3: digest diário (11h UTC)
SELECT cron.schedule(
  'send-telegram-digest',
  '0 11 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-telegram-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
);
```

Verificar jobs ativos:
```sql
SELECT jobname, schedule, active FROM cron.job;
```

---

## 4. Aplicar migration

```bash
# Via Supabase CLI
npx supabase db push

# Ou manualmente: copiar conteúdo de
# supabase/migrations/20260423000000_macro_production_hardening.sql
# e executar no SQL Editor do Dashboard
```

---

## 5. Monitoramento — Dashboard de Saúde

```sql
-- Últimas execuções de jobs
SELECT * FROM public.v_job_health ORDER BY job_name;

-- Eventos com actual ainda pendente
SELECT event_code, release_time_utc, retry_count, last_error
FROM public.v_macro_actual_pending
LIMIT 20;

-- Últimos envios Telegram (24h)
SELECT delivery_key, status, telegram_status, error_message, created_at
FROM public.telegram_delivery_log
WHERE created_at >= now() - interval '24 hours'
ORDER BY created_at DESC;

-- Falhas de job nas últimas 24h
SELECT job_name, status, error_message, created_at
FROM public.system_job_log
WHERE status = 'error'
  AND created_at >= now() - interval '24 hours'
ORDER BY created_at DESC;
```

---

## 6. Reprocessar evento com actual pendente

```sql
-- Resetar retry_count para que o worker tente novamente
UPDATE public.macro_event_schedule
SET retry_count = 0, last_error = NULL
WHERE event_code = 'US_CPI'
  AND release_time_utc = '2026-05-15 12:30:00+00';

-- Triggerar manualmente o fetcher
-- (via curl ou Supabase Dashboard → Edge Functions → Invoke)
```

---

## 7. Erros comuns e soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `FRED_API_KEY secret not configured` | Secret não deploy | `npx supabase secrets set FRED_API_KEY=...` |
| `Telegram HTTP 401 Unauthorized` | Token inválido | Recrie bot com @BotFather |
| `chat not found` | Chat ID errado ou /start não enviado | Envie /start ao bot, use @userinfobot |
| `Forbidden` | Usuário bloqueou o bot | Usuário deve desbloquear ou reiniciar |
| `retry_count = 5` | FRED sem dados para série | Evento manual; verificar série no FRED |
| RLS `new row violates row-level security` | Tentativa de escrita por anon em tabela protegida | Usar service_role key na Edge Function |

---

## 8. Variáveis de ambiente necessárias

| Variável | Onde definir | Obrigatório |
|----------|-------------|-------------|
| `VITE_SUPABASE_URL` | `.env.local` (Render env) | Sim |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` (Render env) | Sim |
| `VITE_FRED_API_KEY` | `.env.local` (Render env) | Para actuals reais |
| `FRED_API_KEY` | Supabase secrets | Para Edge Functions |
| `VITE_CONSENSUS_PROVIDER` | `.env.local` | Não (free tier = null) |
