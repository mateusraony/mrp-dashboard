# CHECKPOINT.md — MRP Dashboard
> Memória técnica viva do projeto. Atualizar ao final de cada bloco importante.
> Última atualização: 2026-04-25 (Sprint 9 — Edge Functions deployed + pg_cron ativo — MacroCalendar 100% operacional)

---

## 🗂 ESTADO GERAL (verificado em 2026-04-25)

| Aspecto | Status | Evidência Real |
|---------|--------|---------------|
| Build (`npm run build`) | ✅ PASSA | 0 erros |
| Testes (`npm test`) | ✅ 79/79 | 4 suites |
| Deploy (Render) | ✅ ONLINE | https://mrp-dashboard.onrender.com |
| FRED API Key | ✅ CONFIGURADA | VITE_FRED_API_KEY em .env.local |
| Supabase URL + ANON_KEY | ✅ CONFIGURADO | .env.local presente |
| MacroCalendar eventos | ✅ 13 eventos | CPI, Core CPI, NFP, Unemployment, GDP, Core PCE, Initial Claims (semanal), JOLTS, PPI, Retail Sales, Durable Goods, UMich, Housing Starts, FOMC |
| MacroCalendar agenda | ✅ REAL | Eventos passados 45d + actual via FRED client-side |
| MacroCalendar alertas | ✅ ATIVO | macro_alert_preferences + macro-alert-worker rodando a cada 5min |
| Secrets expostos | ✅ CORRIGIDO | Removidos de sql-migration.sql e deploy-supabase.sh |
| persistMacroSchedule | ✅ REMOVIDO | Client-side não tenta mais escrever em macro_event_schedule (RLS) |
| Telegram test Settings | ✅ CORRIGIDO | Usa telegram-ping (token+chat_id no body, retorna latência) |
| Rota alert worker | ✅ CORRIGIDO | /MacroCalendar (era /macro-calendar) |
| pg_cron UI | ✅ CORRIGIDO | Badge falso removido, instrução honesta |
| Migration hardening | ✅ APLICADA | 3 tabelas criadas pelo usuário no SQL Editor |
| Edge Functions | ✅ DEPLOYED | telegram-ping, macro-alert-worker, macro-actual-fetcher, send-telegram-digest |
| pg_cron jobs | ✅ ATIVO | 3 jobs ativos: macro-actual-fetcher (*/15min), macro-alert-worker (*/5min), send-telegram-digest (11h UTC) |
| pg_cron duplicata | ⚠️ PENDENTE | Job antigo `telegram-digest` duplica o `send-telegram-digest` — remover com SELECT cron.unschedule('telegram-digest') |
| Auth real | ❌ AUSENTE | Stub anônimo — aguarda decisão futura |

---

## 🧭 MAPA DE FASES

| Fase | Status | Data |
|------|--------|------|
| Fase 1 — Análise Profunda | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 2 — Interface/Visual (Sprints 1+2) | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 3 — API + Hooks + Settings (Sprints 3.1–3.9) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 4 — Cálculos Python + Wiring Live (Sprints 4.1–4.5) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 5 — APIs Gratuitas + Testes (Sprints 5.1–5.6) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 6 — Expansão OnChain/Macro/Governance | ✅ CONCLUÍDA* | 2026-04-14 |

*Sprint 6.6 (Telegram) bloqueado externamente — aguarda Bot Token do usuário.

---

## ✅ TODOS OS SPRINTS CONCLUÍDOS

### Fase 6 — Sub-sprints

| Sprint | Status | Entregue |
|--------|--------|----------|
| **6.1** | ✅ | `fetchOnChainExtended()` — CDD, Dormancy proxy, HODL %. `useOnChainExtended()`. `CddCard` + `HodlWaveCard` em OnChain.jsx |
| **6.2** | ✅ | `fetchGlobalLiquidity()` — WALCL, RRP, TGA, Real Yield, Term Premium, DXY. `useGlobalLiquidity()`. `GlobalLiquiditySection` em Macro.jsx. `DataQualityBadge.jsx` |
| **6.2b** | ✅ | `fetchBcbData()` — SELIC, IPCA, USDBRL via BCB OpenData. `useBcbData()`. `BrMacroPanel` em Macro.jsx |
| **6.3** | ✅ | `HodlWavesPanel.jsx` (5 coortes CSS stacked bar). `CddCard` + `ComposedChart` 30d. `HodlWaveCard` + `AreaChart` supply activity |
| **6.4** | ✅ | `computeGreeks()` + `computeContractGreeks()` (Black-Scholes 2ª derivada). `DealerFlowPanel.jsx`. `dealerGreeks.test.ts` (27 testes) |
| **6.5** | ✅ | `AlertAuditPanel.jsx` (Disparos / Limiares / Data Lineage). `useAlertEvents()` + `useThresholdHistory()`. Aba "Auditoria" em SmartAlerts.jsx |
| **6.6** | ✅ CONCLUÍDO | Edge Function deploy-ready. Settings.jsx com persistência real. Bot Token configurado. |
| **6.7** | ✅ ANTECIPADO | build ✅ · tsc ✅ · eslint ✅ · 52/52 testes ✅ |
| **Bundle split** | ✅ | `vite.config.js` manualChunks: index.js 284KB→90KB |
| **Migration** | ✅ | `alert_events` + `threshold_history` aplicadas via MCP Supabase |
| **Migration conflict fix** | ✅ | 5 stubs (`SELECT 1`) + `20260420000000_full_schema.sql` + versões pré-registradas em prod + preview via execute_sql |
| **GDELT** | ✅ | `gdelt.ts` + `useGdelt.ts` — NewsIntelligence substituiu mock por feed real |
| **SmartAlerts live** | ✅ | Gauges: Funding (multi-venue avg), Flush/Squeeze (liquidações SELL/BUY), Risk Score, DataQualityBadge |
| **Debug/log interno** | ✅ | `debugLog.ts` intercepta window.onerror + DebugPanel.jsx flutuante com badge de erros |
| **Render SPA fix** | ✅ | `public/_redirects` → sem 404 em refresh de rota |
| **Sprint 7 — GDELT AI** | ✅ | Aba "Inteligência AI" live via `useGdeltNews` query institucional + `GdeltAICard` + RefreshButton |
| **Sprint 7 — MacroCalendar** | ✅ | `macroCalendarService.ts` + `useMacroCalendar.ts` — FRED API + FOMC 2026 hardcoded |
| **Sprint 7 — RefreshButton** | ✅ | `RefreshButton.jsx` orbital animado — 2 abas NewsIntelligence + 2 abas MacroCalendar |
| **Sprint 7 — Debug→Supabase** | ✅ | `logError()` persiste em `system_logs` via raw fetch sem import circular |
| **Sprint 7 — Migrations (3)** | ✅ | `gdelt_articles`, `system_logs`, `macro_pipeline` (5 tabelas + 8 seeds) — preview em apply |

---

## 📡 STATUS REAL DAS APIs (auditado 2026-04-14)

### ✅ CONFIRMADO LIVE — Funcionando sem limitação

| API | Service | Endpoint | Auth | Dados fornecidos |
|-----|---------|---------|------|-----------------|
| **Binance Futures** | `binance.ts` | `fapi.binance.com` | Sem key | BTC price, funding, OI, liquidações, klines |
| **Mempool.space** | `mempool.ts` | `mempool.space/api` | Sem key | Hashrate, fees, mempool, difficulty adj |
| **CoinMetrics Community** | `coinmetrics.ts` | `community-api.coinmetrics.io/v4` | Sem key | MVRV, NUPL, CDD, HODL %, Dormancy, NVT |
| **Bybit V5** | `bybit.ts` | `api.bybit.com/v5` | Sem key | Funding rate, mark price, OI |
| **OKX V5** | `okx.ts` | `www.okx.com/api/v5` | Sem key | Funding rate, preço |
| **CoinGecko** | `coingecko.ts` | `api.coingecko.com/api/v3` | Sem key | Preço, dominância, altcoins (limite 30 req/min) |
| **Alternative.me** | `alternative.ts` | `api.alternative.me` | Sem key | Fear & Greed Index |
| **Deribit** | `deribit.ts` | `deribit.com/api/v2/public` | Sem key | IV ATM, term structure, opções BTC |
| **BCB OpenData** | `bcb.ts` | `api.bcb.gov.br` | Sem key | SELIC, IPCA, USD/BRL |

### ⚠️ CONFIGURADO — Precisa de chave (já configurada em .env.local)

| API | Service | Key necessária | Status |
|-----|---------|---------------|--------|
| **FRED API** | `fred.ts` | `VITE_FRED_API_KEY` | ✅ Configurada — WALCL, RRP, TGA, Real Yield, Term Premium, DXY |
| **Supabase** | `supabase.ts` | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | ✅ Configurado — 5 tabelas ativas com RLS |

### ❌ AUSENTE — Requer plano pago (não implementado)

| Dado desejado | API necessária | Custo | Alternativa atual |
|--------------|---------------|-------|------------------|
| SOPR, Netflow exchanges, Whale alerts | Glassnode | ~$29/mês | Mock — `fetchOnChainAdvanced()` retorna mock |
| NUPL avançado, Exchange flows | CryptoQuant | ~$29/mês | Mock — aproximação via CoinMetrics |
| OI por strike (Deribit real) | Deribit (dados históricos) | Pago ou WebSocket | DealerFlowPanel usa OI simulado |
| CDS Brasil, Spread soberano | Bloomberg/Refinitiv | Muito caro | Placeholder no Macro Board |

### 🔴 BLOQUEADO EXTERNAMENTE

| Item | Bloqueio | O que falta |
|------|---------|-------------|
| **Telegram Digest** | ✅ Implementado | Deploy Edge Function + ativar pg_cron no Supabase Dashboard |

---

## 🏗 ARQUITETURA ATUAL (2026-04-14)

```
src/
  pages/          → 20 páginas roteadas
  components/
    ui/           → 40+ Shadcn/Radix + DataQualityBadge.jsx (Sprint 6.2)
    data/         → 15 arquivos mock (temporário — usado como fallback)
    dashboard/    → 4 componentes
    derivatives/  → 2 componentes
    onchain/      → HodlWavesPanel.jsx (Sprint 6.3)
    options/      → DealerFlowPanel.jsx (Sprint 6.4)
    governance/   → AlertAuditPanel.jsx (Sprint 6.5)
    ai/           → 1 componente AI
  hooks/
    useBtcData.ts       ← 7 hooks (ticker, klines, liquidações, OI, F&G...)
    useCoinMetrics.ts   ← useOnChainCycle + useOnChainExtended
    useDeribit.ts       ← useOptionsData + useDvolHistory
    useFred.ts          ← useMacroBoard + useYieldCurve + useGlobalLiquidity
    useMempool.ts       ← useMempoolState + useHashrate + useMiningPools + useOnChainAdvanced
    useMultiVenue.ts    ← useBybitTicker/Funding + useOkxTicker/Funding + useMultiVenueSnapshot
    useRiskScore.ts     ← Risk Score composto
    useSupabase.ts      ← alertas + portfólio + settings + governance hooks
    useBcb.ts           ← useBcbData (SELIC/IPCA/USDBRL)
  services/
    alternative.ts, bcb.ts, binance.ts, bybit.ts, coingecko.ts,
    coinmetrics.ts, deribit.ts, fred.ts, mempool.ts, okx.ts, supabase.ts
    gdelt.ts                          ← Sprint 6.8 — feed GDELT DOC 2.0
    macroCalendarService.ts           ← Sprint 7 — FRED releases + FOMC hardcoded
  hooks/
    ...anteriores...
    useGdelt.ts                       ← Sprint 6.8
    useMacroCalendar.ts               ← Sprint 7
  components/
    ui/
      RefreshButton.jsx               ← Sprint 7 — botão orbital animado
  utils/
    index.ts, riskCalculations.ts (+ computeGreeks/Vanna/Charm), sessionAnalytics.ts
  lib/
    env.ts, errorBoundary.tsx, AuthContext.jsx (stub anônimo)
    debugLog.ts                       ← Sprint 6.8+7 — persiste erros em system_logs
  __tests__/
    services/coinmetrics.test.ts      ← 10 testes
    utils/sessionAnalytics.test.ts    ← 15 testes
    utils/dealerGreeks.test.ts        ← 27 testes

scripts/
  validate_var.py, validate_risk_score.py, validate_gex.py,
  validate_macro_surprise.py, validate_mvrv_zscore.py

supabase/migrations/
  20260412000000_create_core_tables.sql        ← stub (SELECT 1) — evita drift detection
  20260413000001_create_governance_tables.sql  ← stub (SELECT 1)
  20260414000000_add_telegram_and_fix_rls.sql  ← stub (SELECT 1)
  20260414000001_fix_user_settings_anon_upsert.sql ← stub (SELECT 1)
  20260414000002_drop_auth_fk_allow_anon_sentinel.sql ← stub (SELECT 1)
  20260420000000_full_schema.sql               ← schema real, completo, idempotente (5 tabelas)

vite.config.js  ← manualChunks: recharts/supabase/tanstack/react-vendor
vitest.config.ts
.env.local      ← VITE_DATA_MODE=live + FRED_KEY + SUPABASE_* (não commitado)
```

---

## 🔑 PADRÃO DE API (obrigatório em todo service)

```typescript
// 1. Schema Zod com z.coerce.number() (APIs retornam strings)
const Schema = z.object({ value: z.coerce.number() });

// 2. res.ok check ANTES do parse
const res = await fetch(url);
if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
const data = Schema.parse(await res.json());

// 3. refetchInterval só em IS_LIVE
refetchInterval: IS_LIVE ? 30_000 : false,

// 4. REGRA ABSOLUTA: Mock NÃO substitui live com falha
// DATA_MODE=mock  → retorna mock instantaneamente
// DATA_MODE=live  → chama API; se falhar → lança erro (UI mostra error state)
// Mock NUNCA é fallback silencioso de dado live com falha
```

---

## ⚠️ DÍVIDA TÉCNICA REMANESCENTE

| Item | Severidade | Status | Ação |
|------|------------|--------|------|
| Auth stub anônimo (`AuthContext.jsx`) | Alta | Pendente | Supabase Auth (email/OAuth) — aguarda decisão |
| pg_cron duplicata | Baixa | Pendente | `SELECT cron.unschedule('telegram-digest');` no SQL Editor — remove job antigo duplicado |
| SOPR/Netflow/Whale via Glassnode | Média | Pendente | Requer plano pago ~$29/mês |
| Base44 favicon residual (`index.html`) | Baixa | Pendente | 1 linha — remover quando conveniente |
| Rate limiting CoinGecko | Baixa | Pendente | Debounce/queue ≤30 req/min no free tier |
| ~~Migration conflict~~ | ~~Alta~~ | ✅ RESOLVIDO | 5 stubs + full_schema + pré-registro no preview DB |

---

## 📊 TABELAS SUPABASE ATIVAS (13 total)

| Tabela | Sprint | RLS | Uso |
|--------|--------|-----|-----|
| `alert_rules` | 3.7 | ✅ | Regras de alerta configuradas pelo usuário |
| `portfolio_positions` | 3.7 | ✅ | Posições abertas do portfólio |
| `user_settings` | 3.7 | ✅ | Configurações gerais (tema, data_mode, etc.) |
| `alert_events` | 6.5 | ✅ | Log de disparos de alertas (governança) |
| `threshold_history` | 6.5 | ✅ | Histórico de mudanças de limiares |
| `gdelt_articles` | 7 | ✅ | Artigos GDELT persistidos (url UNIQUE, sentiment, query) |
| `system_logs` | 7 | ✅ | Erros do DebugLog em produção (session_id, level) |
| `macro_event_catalog` | 7 | ✅ | Catálogo de 8 eventos macro (CPI, NFP, FOMC, GDP, PCE…) |
| `macro_event_schedule` | 7 | ✅ | Datas/hora UTC das releases FRED por evento |
| `macro_event_market_reaction` | 7 | ✅ | Reação histórica BTC por janela de tempo |
| `feature_store_macro` | 7 | ✅ | Features derivadas para inference de AI |
| `ai_inference_log` | 7 | ✅ | Log de inferências/predições do modelo |
| `macro_alert_preferences` | 8 | ✅ | Alertas macro persistidos por usuário/evento (sentinel UUID) |
| `telegram_delivery_log` | 8 | ✅ | Auditoria de envios Telegram (dedup por delivery_key) |
| `system_job_log` | 8 | ✅ | Saúde de jobs agendados (correlation_id, latência, contadores) |

---

## 🧪 COBERTURA DE TESTES (79 testes — 4 suites)

| Arquivo | Testes | O que cobre |
|---------|--------|-------------|
| `sessionAnalytics.test.ts` | 15 | `getSessionForHour` + `computeSessionStats` (Ásia/Europa/EUA CVD) |
| `coinmetrics.test.ts` | 10 | Shape, ranges MVRV/NUPL, zonas, history, updated_at |
| `dealerGreeks.test.ts` | 27 | `computeGreeks` null guards, delta ATM, put-call parity, GEX sign |
| `macroCalendar.test.ts` | 27 | parsePrevToNumeric, dedup delivery key, DST ET→BRT, janelas de alerta |

---

## 🗺 O QUE FALTA

| Item | Descrição | Bloqueio |
|------|-----------|---------|
| **Telegram Digest (Sprint 6.6)** | ✅ CONCLUÍDO | Edge Functions deployed + pg_cron ativo. Pendente: remover job duplicado `telegram-digest` |
| **GDELT→Supabase wiring** | `useGdelt.ts` busca artigos mas não faz upsert em `gdelt_articles` ainda | Tabela criada (Sprint 7) — falta wiring no hook |
| **MacroCalendar bronze pipeline** | `macro_event_schedule` não é populado automaticamente ainda | `macroCalendarService.ts` gera eventos em memória; persitência é Sprint 8 |
| **Auth real** | Login com email/Google via Supabase Auth | Decisão de negócio — quando quiser ativar |
| **APIs pagas** | SOPR, Netflow, Whale via Glassnode/CryptoQuant | Custo ~$29/mês — confirmar se vale |
