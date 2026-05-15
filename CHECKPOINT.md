# CHECKPOINT.md — MRP Dashboard
> Memória técnica viva do projeto. Atualizar ao final de cada bloco importante.
> Última atualização: 2026-05-15 (Sprint 7.4 — Page migrations batch C: remove mockData imports de Dashboard/ExecutiveReport/PredictivePanel/StablecoinFlow/ActionDashboard)

---

## 🗂 ESTADO GERAL (verificado em 2026-05-15)

| Aspecto | Status | Evidência Real |
|---------|--------|---------------|
| Build (`npm run build`) | ✅ PASSA | 0 erros — Sprint 7.4 (PR #98) |
| Testes (`npm test`) | ✅ 217/217 | 14 suites |
| Deploy (Render) | ✅ ONLINE | https://mrp-dashboard.onrender.com |
| FRED API Key | ✅ CONFIGURADA | VITE_FRED_API_KEY em .env.local |
| Supabase URL + ANON_KEY | ✅ CONFIGURADO | .env.local presente |
| **RLS Supabase** | ✅ CORRIGIDO (PR #58+#59) | Policies `USING (true)` substituídas por sentinel UUID em alert_rules, portfolio_positions, user_settings |
| **upsert user_id sentinel** | ✅ CORRIGIDO (PR #59) | `upsertAlertRule` e `upsertPortfolioPosition` injetam `ANON_USER_ID` antes do payload |
| **Backfill user_id NULL** | ✅ CORRIGIDO (PR #59) | Migration backfilla linhas antigas sem user_id antes de ativar novas policies |
| MacroCalendar eventos | ✅ 13 eventos | CPI, Core CPI, NFP, Unemployment, GDP, Core PCE, Initial Claims (semanal), JOLTS, PPI, Retail Sales, Durable Goods, UMich, Housing Starts, FOMC |
| MacroCalendar agenda | ✅ REAL | Eventos passados 45d + actual via FRED client-side |
| MacroCalendar alertas | ✅ ATIVO | macro_alert_preferences + macro-alert-worker rodando a cada 5min |
| Secrets expostos | ✅ CORRIGIDO | Removidos de sql-migration.sql e deploy-supabase.sh |
| persistMacroSchedule | ✅ REMOVIDO | Client-side não tenta mais escrever em macro_event_schedule (RLS) |
| Telegram test Settings | ✅ CORRIGIDO | telegram-ping lê token do banco server-side (service_role) — token nunca trafega no body |
| Rota alert worker | ✅ CORRIGIDO | /MacroCalendar (era /macro-calendar) |
| pg_cron UI | ✅ CORRIGIDO | Badge falso removido, instrução honesta |
| Migration hardening | ✅ APLICADA | 3 tabelas criadas pelo usuário no SQL Editor |
| Edge Functions | ✅ DEPLOYED | telegram-ping, macro-alert-worker, macro-actual-fetcher, send-telegram-digest |
| pg_cron jobs | ✅ ATIVO | 3 jobs ativos: macro-actual-fetcher (*/15min), macro-alert-worker (*/5min), send-telegram-digest (11h UTC) |
| pg_cron duplicata | ✅ RESOLVIDO | Job duplicado `telegram-daily-digest` removido pelo usuário via SQL Editor |
| Auth real | ❌ AUSENTE | Stub anônimo — aguarda decisão futura |
| **Mock que requer API paga** | ⚠️ AGUARDA | SOPR/Netflow/Baleias: Glassnode ~$29/mês · Sentimento Social (Twitter/Reddit): LunarCrush ~$19/mês · LiquidationHeatmap real: requer auth Binance · IV Delta 1D/1W/1M: sem API gratuita |
| **Module toggles enforcement** | ✅ PR #90 | Settings escreve em localStorage; hooks têm `enabled: readModuleFlag(...)`; páginas mostram `DisabledModuleBanner` — zero fetch de rede quando módulo off |
| **Rule-based AI Analysis** | ✅ MERGEADO (PR #49) | `ruleBasedAnalysis.ts` + wiring em Dashboard/Derivatives/SpotFlow/Options/Macro/DerivativesAdvanced/SmartAlerts/ExecutiveReport |
| **Sprint 7.1 — Portfolio Live** | ✅ MERGEADO (PR #50) | mark_price live via useBtcTicker; VaR/Sharpe/Drawdown/Beta calculados com preço real |
| **Sprint 7.2 — PredictivePanel Live** | ✅ MERGEADO (PR #50) | ATR(14) via useKlines(1d,30); cenários price = spot ± ATR*mult; direction via ruleBasedAnalysis |
| **Sprint 7.3 — Automações Live** | ✅ MERGEADO (PR #50) | regras avaliadas com btc.price=mark_price + funding.rate=last_funding_rate×100 + riskScore live |
| **Sprint 7.4 — Opportunities Rule-Based** | ✅ MERGEADO (PR #50+51) | liveOpportunities de computeRuleBasedAnalysis; grade A/B/C por score; Strategies usa mc live |
| **Supabase config.toml** | ✅ MERGEADO (PR #51) | site_url prod + redirect wildcard + sem openai_api_key inválido — Preview CI desbloqueado |
| **Data Reliability Audit** | ✅ MERGEADO (PR #51) | ETFFlows/StablecoinFlow: ModeBadge→DataTrustBadge paid_required; BotAutomations: mantido mock (dado genuinamente mock) |
| **Lint limpo** | ✅ | ModeBadge unused imports removidos de ETFFlows.jsx e StablecoinFlow.jsx |
| **Auditoria + Bug fixes** | ✅ MERGEADO (PR #65) | 7 bugs críticos (div/0, null guards, Zod parse, health monitor map) + DataTrustBadge mock em 4 páginas |
| **BTC header live** | ✅ MERGEADO (PR #66) | Layout.jsx usa useBtcTicker(); dot LIVE/MOCK dinâmico; refetch 5s em produção |
| **BotAutomations live** | ✅ MERGEADO (PR #67) | Regime/score/funding/F&G reais em testBot e testFireRule; import morto removido |
| **Medium live wiring** | ✅ PR #68 | BasisPanel (funding Binance/Bybit/OKX live); LthSthCard (HODL wave CoinMetrics); ExecutiveReport (NUPL/MVRV/Regime live + PDF exportado com dados reais) |
| **AI Track Record real** | ✅ PR #69 | Dashboard.jsx: AITrackRecord detecta isSupabaseConfigured(); empty state quando tabela vazia; DataTrustBadge mock→live; IS_LIVE gate corrige Codex P2 |
| **Mock audit — badges hardcoded** | ✅ PR #70 | DerivativesAdvanced (3 badges); SmartAlerts (1 badge); AIAnalysisPanel (1 badge): todos condicionais IS_LIVE agora; mockData.jsx export DATA_MODE='mock' órfão removido; Altcoins badge condition refinada |
| **Prioridade 1 — Confiança do usuário** | ✅ PR #71 | Macro.jsx: data "2026-03-06" → "Dados de demonstração" em mock mode; GlobalMarkets: banner amber + links "Ver ↗" desativados em demo; MacroCalendar: eventos gerados relativos à data atual (nunca mais "ENCERRADO"); BotAutomations: banner ⚠️ + status "Demo" (âmbar) em vez de "Conectado" (verde); ActionDashboard Performance: banner 🧪 + badge DEMO no win rate |
| **Prioridade 2 — Confiabilidade de dados** | ✅ PR #72 | DerivativesAdvanced: US10Y ao vivo via FRED + SPOT ao vivo via ticker no Carry Calculator; SmartAlerts: sugestões de IA dinâmicas via computeRuleBasedAnalysis (fallback para fixas); ExecutiveReport: botão "Agendar" removido, PDF/email footer IS_LIVE condicional |
| **Prioridade 3 — Cosmético/UX** | ✅ PR #73 | Settings: toggles de módulo escrevem em localStorage + banner "Recarregue para aplicar" + botão reload; MarketRegime: histórico 90d usa seed diário (estável no dia, muda no dia seguinte) + badge "ESTIMADO"; Dashboard/DataBadge: modo "estimated" adicionado ao ModeBadge (badge azul〜ESTIMADO) |
| **Máxima cobertura live** | ✅ PR #73 | Derivatives: OI/Market Cap ao vivo (Binance OI ÷ CoinGecko mcap); binance.ts: fetchFuturesBasis() via /fapi/v1/premiumIndex (basis real perp vs quarterly); useFuturesBasis() hook; DerivativesAdvanced CarryCalculator usa basis real; ExecutiveReport LTH/STH via CoinMetrics useOnChainExtended; MarketRegime/ExecutiveReport: "Carregando..." em vez de mock durante loading |
| **Sprint A — Market Cache** | ✅ PR #74 | `market_cache` tabela Supabase; `marketCache.ts` withCache wrapper (TTL, timeout 2s, fire-and-forget); CoinGecko fetchDominance + fetchTopAltcoins com cache 5min — protege 30 req/min |
| **Sprint B — apiClient + CryptoCompare** | ✅ PR #75 | `apiClient.ts` RateLimitError + retry 5xx backoff [2s,4s,8s]; `providers/cryptoCompare.ts` fallback automático em 429; 13 testes; cobertura 11.52% ✅ |
| **Sprint C — Binance WebSocket** | ✅ PR #76+#77 | `binanceWs.ts` singleton WS backoff 1s→30s; `useBtcPriceWs()` hook; Layout.jsx indicador WS/REST/MOCK; `subscribeStatus` fix stale price (P2 Codex); 150/150 ✅ |
| **Sprint D — telegram.ts** | ✅ PR #78 | `src/services/telegram.ts` com `pingTelegram()`; fetch inline removido de Settings.jsx; build ✅ 150/150 ✅ |
| **AI Etapa 1 — pesos calibrados** | ✅ PR #79 | `aiCalibration.ts` + `useAiCalibration` hook; `projectWeights()` iterativo garante 10%/40% pós-norm; Dashboard passa pesos ao engine; 163/163 ✅ |
| **AI Etapa 2 — confluência MTF** | ✅ PR #80 | `mtfAnalysis.ts` frameFromKlines+computeConfluence; `useMtfAnalysis` hook; widget em Zona D Dashboard; 19 testes; 179/179 ✅ |
| **AI Etapa 3 — Z-score alerts** | ✅ PR #81 | `zScore.ts` mean/stddev/computeZScore/buildZScoreAlerts; `useZScoreAlerts` hook; widget em Zona D; 32 testes; 211/211 ✅ · P2 fix: volume usa candle fechado |
| **Fix MTF + mock isolation** | ✅ PR #82+#83 | Widget MTF sempre visível (AGUARDANDO em mock); `useKlines(enabled)` — zero fetch em mock mode |
| **Fix SPA routing — Web Service** | ✅ PR #84 | `server.js` Node.js built-in com fallback index.html (útil se migrar para Web Service) |
| **Fix SPA routing — Static Site** | ✅ PR #85 | `public/404.html` sessionStorage redirect + `main.jsx` replaceState; `render.yaml` revertido para env:static |
| **AI Etapa 4 — Claude Haiku** | ✅ PR #86 | Edge Function `ai-analysis` (Deno + SDK Anthropic); `aiInsight.ts` cliente; `useAiInsight.ts` hook time-bucket 15min; widget "Análise Natural" em Zona D Dashboard; 6 testes novos; 217/217 ✅ |
| **config.toml Edge Functions** | ✅ PR #86 | 7 funções declaradas em `[functions.*]` — Supabase Branching auto-deploya em preview |
| **StaleIndicator** | ✅ PR #88 | `StaleIndicator.jsx` — `?` âmbar com tooltip "Última atualização: HH:MM:SS" quando dado live indisponível |
| **Portfolio live + stale** | ✅ PR #88 | `StaleIndicator` em P&L, VaR 95%/99%, preço spot — sem labels DEMO; dados live sempre |
| **Strategies live + stale** | ✅ PR #88 | `StaleIndicator` em `bull_bear`/`basis`; nota discreta em dados históricos sem IS_LIVE guard |
| **npm audit fix** | ✅ PR #88 | dompurify + postcss corrigidos — 0 vulnerabilidades |
| **GDELT upsert** | ✅ PR #88 | `upsertGdeltArticles()` em supabase.ts; `useGdelt.ts` persiste artigos novos (fire-and-forget); colunas corretas: `domain`, `sentiment_label` (fix Codex P2) |
| **P4 — FRED key server-side** | ✅ commit `11a718f` | `VITE_FRED_API_KEY` removido de todos os arquivos cliente; `fred.ts` usa `callFredProxy()` via Edge Function `fred-proxy`; `env.ts` sem a variável; badges usam `isSupabaseConfigured()` (Dashboard, GlobalMarkets, DataSources); build ✅ · 217 testes ✅ · `grep VITE_FRED_API_KEY dist/` = 0 |
| **P5 — Module toggles enforcement** | ✅ PR #90 | `moduleFlags.ts` + `DisabledModuleBanner.jsx`; `enabled: readModuleFlag(...)` em 6 hooks (useDeribit, useMempool, useCoinMetrics, useGdelt, useBtcData#useFearGreed); early-return banner em Options/SpotFlow/OnChain/NewsIntelligence; Codex P2 fixes: link `/Settings`, `useBtcTicker(enabled)`, `useOnChainCycle/Extended(pageEnabled)` |
| **P6 — Produção DB + fred-proxy** | ✅ PR #91 | 4 erros de log corrigidos: `system_logs` criada; `macro_event_catalog` criada + seed 8 eventos; 5 colunas adicionadas a `macro_event_schedule` (`actual_source`, `actual_updated_at`, `is_revised`, `retry_count`, `last_error`); `v_macro_actual_pending` + `v_job_health` recriadas com JOIN correto; tabelas `macro_alert_preferences`, `telegram_delivery_log`, `system_job_log` criadas; `fred-proxy` v9 com `AbortSignal.timeout(15_000)` |
| **P7 — Macro Audit + fred-proxy resiliência** | ✅ PR #92 | Auditoria profunda da página Macro: 5 bugs confirmados em `fred.ts` + `Macro.jsx`; `Promise.all` → `Promise.allSettled` em `fetchMacroBoard` + `fetchGlobalLiquidity`; fred-proxy v10 com logging de erros FRED 4xx; null-guard `yieldSpread` em `Macro.jsx:543` (fix Codex P1); valores verificados vs APIs reais (S&P ~7399, Gold ~$4740, VIX ~17.19, Fed BS ~$6.7T, RRP ~$0.6B, Net Liq ~$5.8T); plano Macro Production Hardening gerado |
| **Sprint 7.3 — Page migrations batch B + P2 fixes** | ✅ PR #97 mergeado | Derivatives.jsx: remove imports `mockData`+`mockDataExtended` → `fmtNum`/`fmtPct` inline; fallbacks `BTC_FUTURES_FALLBACK`, `LIQUIDITY_BINS_STATIC`, `OI_RATIO_FALLBACK`, `PERP_VS_DATED_FALLBACK`, `AI_DERIVATIVES_FALLBACK`; `hasLiveFutures` flag; DataTrustBadge em Perp vs Dated. Options.jsx + SpotFlow.jsx: idem com seus fallbacks. Strategies.jsx: DataTrustBadge. **P2 fixes (Codex):** (1) `AI_*_FALLBACK` em Derivatives/Options/SpotFlow corrigidos para shape completo de `AIModuleCard` (direction/signal/score/probability/confidence/timeframe/trigger/analysis); (2) `useDerivativesData()` calcula `index_price: ticker.mark_price` e `open_interest_usdt: ticker.open_interest * ticker.mark_price` — `BtcTickerData` não expõe esses campos diretamente. Conflito de merge resolvido via `git rebase origin/main` + `--ours` em 4 arquivos. Build ✅ |
| **Sprint 7.4 — Page migrations batch C + Codex P1 fixes** | ✅ PR #98 mergeado | **5 páginas limpas de mockData**. Dashboard.jsx: `fmtNum`/`fmtPct` inline + 8 fallback consts. ExecutiveReport.jsx: 30 consts fallback; imports reordenados (todos `import` antes de `const`); fallbacks completos com todos os campos usados (funding_history, smoothed_7d, exchange_reserves, netflow_7d, usdt/usdc net_7d_m, funds[], total_shorts_at_risk_10pct, NUPL history como objeto `{1d:[],1w:[],1m:[]}`). PredictivePanel.jsx: 4 consts fallback (SCENARIOS_24H_FALLBACK baseado em SPOT_FALLBACK=84K). StablecoinFlow.jsx: 7 consts fallback. ActionDashboard.jsx: 7 consts fallback. **Post-merge Codex P1 fixes:** (1) Dashboard.jsx:184 `fearGreed.history` → `FEAR_GREED_FALLBACK.history` (tsc CI falhou, corrigido); (2) StablecoinFlow.jsx:345 `dailyMintBurn` → `DAILY_MINT_BURN_FALLBACK` (tsc CI, corrigido); (3) `STABLECOIN_SNAPSHOT_FALLBACK.usdt/usdc` ganhou `net_7d_m: 0` (crash no tab Emissões, Codex review). Build ✅ tsc ✅ |

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
| **Fase 7 — Live Wiring: Portfolio / Predictive / Automações / Opportunities** | ✅ CONCLUÍDA | 2026-04-30 |

*Sprint 6.6 (Telegram) desbloqueado — Bot Token configurado.

---

## 🔍 AUDITORIA TÉCNICA — 2026-05-03

Auditoria fria e completa conduzida em 7 agentes especializados (arquitetura, dados, segurança, UI, QA, DevOps). Inventário de 176 arquivos, 31 hooks/services, 15 arquivos mock, 11 migrations, 5 Edge Functions.

### Fases da Auditoria

| Fase | Status | Data | PR |
|------|--------|------|----|
| **Fase 0 — Diagnóstico e inventário** | ✅ CONCLUÍDA | 2026-05-03 | — |
| **Fase 1 — Segurança mínima séria** | ✅ CONCLUÍDA | 2026-05-03 | #58 + #59 |
| **Fase 2 — Eliminar ilusão de dados** | 🔜 PRÓXIMA | — | — |
| **Fase 3 — Dados reais gratuitos** | ⏳ PENDENTE | — | — |
| **Fase 4 — Testes e CI** | ⏳ PENDENTE | — | — |
| **Fase 5 — Deploy seguro** | ⏳ PENDENTE | — | — |
| **Fase 6 — Observabilidade** | ⏳ PENDENTE | — | — |

### Fase 0 — Diagnóstico (✅ CONCLUÍDA)

Achados principais:
- **Build/Testes/Lint/TypeCheck**: todos passando — confirmado com evidência
- **RLS completamente aberta**: 5 tabelas com `USING (true)` — qualquer anon key = acesso total
- **Telegram token plaintext**: coluna `text` sem criptografia em `user_settings`
- **~70 chamadas a Math.random()** em mock data shippeado em produção (dist/assets/mockData*.js)
- **15 arquivos mockData** com dados financeiros inventados — 20 de 29 páginas importam algum
- **AI Recommendation hardcoded**: `"CAUTION — REDUCE LONGS"` é string fixa em mockData.jsx
- **10 artigos de notícias fabricados**: atribuídos a Bloomberg/Reuters/CoinDesk — todos falsos
- **Liquidações 24h sempre mock**: `/fapi/v1/forceOrders` requer auth, retorna `[]`
- **FRED API key exposta**: prefixo `VITE_` inclui a chave no bundle JS visível no DevTools
- **Auth stub completo**: `AuthContext.jsx` com `isAuthenticated: false` e logout vazio
- **2 vulnerabilidades npm**: dompurify e postcss — severity moderate

### Fase 1 — Segurança (✅ CONCLUÍDA — PRs #58 e #59)

| Correção | Arquivo | PR |
|----------|---------|-----|
| RLS: `USING (true)` → sentinel UUID em `alert_rules`, `portfolio_positions`, `user_settings` | `supabase/migrations/20260502000001_fix_rls_policies.sql` | #58 |
| Token Telegram: removido do body da requisição do cliente | `supabase/functions/telegram-ping/index.ts` | #58 |
| Settings.jsx: body do ping agora vazio `{}` | `src/pages/Settings.jsx` | #58 |
| Backfill: `UPDATE ... SET user_id = sentinel WHERE user_id IS NULL` | `supabase/migrations/20260502000001_fix_rls_policies.sql` | #59 |
| upsertAlertRule: injeta `user_id: ANON_USER_ID` antes do payload | `src/services/supabase.ts` | #59 |
| upsertPortfolioPosition: injeta `user_id: ANON_USER_ID` antes do payload | `src/services/supabase.ts` | #59 |

**Ação manual necessária (usuário):** aplicar a migration `20260502000001_fix_rls_policies.sql` no Supabase Dashboard (prod e preview). É idempotente.

### Riscos ainda abertos (pós Fase 1)

| Risco | Severidade | Fase que resolve |
|-------|------------|-----------------|
| ~~FRED API key exposta via `VITE_` no bundle~~ | ~~Alto~~ | ✅ RESOLVIDO — P4 (commit `11a718f`) |
| Auth stub sem isolamento real | Alto | Fase 5 / decisão de negócio |
| Dados mock sem aviso visual claro | Crítico (UX) | **Fase 2** |
| AI recommendation hardcoded | Crítico (UX) | **Fase 2** |
| Artigos de notícias fabricados | Crítico (UX) | **Fase 2** |
| NUPL/SOPR/Whales sempre mock | Médio | Fase 3 |
| Liquidações sempre mock | Médio | Fase 3 |
| 2 vulnerabilidades npm | Médio | Fase 5 |

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
| **Sprint 10 — Data Reliability Audit** | ✅ | `DataTrustBadge.tsx`, `DataSources.jsx`, `dataStatus.ts`, badges em Dashboard/OnChain/Derivatives/GlobalMarkets/Settings |
| **Sprint 10 — Live Wiring** | ✅ | Options: PCR/skew/regime/oi_by_strike from Deribit chain. SpotFlow: ret_1h/4h/1d + volume_* + CVD from Binance klines. Macro: historyToWindows (macroHistory mock removed) |
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
| **FRED API** | `fred.ts` → `fred-proxy` Edge Fn | `FRED_API_KEY` (Supabase Secret — sem prefixo VITE_) | ✅ Server-side via fred-proxy — chave nunca exposta no bundle JS |
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
| ~~RLS `USING (true)` em todas as tabelas~~ | ~~Crítica~~ | ✅ RESOLVIDO (PR #58+#59) | Migration + backfill + upserts corrigidos |
| ~~Token Telegram no body do cliente~~ | ~~Alta~~ | ✅ RESOLVIDO (PR #58) | telegram-ping lê do banco server-side |
| **FRED API key exposta via VITE_** | Alta | Pendente (Fase 5) | Mover chamadas FRED para Edge Function fred-proxy |
| **Auth stub anônimo** (`AuthContext.jsx`) | Alta | Pendente (decisão) | Supabase Auth (email/OAuth) — aguarda decisão de negócio |
| **Dados mock sem aviso visual** | Alta | Pendente (Fase 2) | Banner DEMO global + remoção de dados fabricados |
| ~~AI recommendation hardcoded~~ | ~~Alta~~ | ✅ RESOLVIDO (Fase 2) | mockData.jsx já tem string vazia |
| ~~Artigos de notícias fabricados~~ | ~~Alta~~ | ✅ RESOLVIDO (Fase 2) | mockDataNews.jsx array vazio |
| pg_cron duplicata | Baixa | Pendente | `SELECT cron.unschedule('telegram-digest');` no SQL Editor |
| SOPR/Netflow/Whale via Glassnode | Média | Pendente (Fase 3) | Requer plano pago ~$29/mês ou marcar PAID-ONLY |
| ~~2 vulnerabilidades npm (dompurify, postcss)~~ | ~~Média~~ | ✅ RESOLVIDO (PR #88) | `npm audit fix` — 0 vulnerabilidades |
| ~~Base44 favicon residual (`index.html`)~~ | ~~Baixa~~ | ✅ RESOLVIDO | Favicon SVG customizado — sem referência Base44 |
| ~~Stripe instalado sem uso~~ | ~~Baixa~~ | ✅ RESOLVIDO | Removido do package.json |
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

## 🧪 COBERTURA DE TESTES (217 testes — 14 suites)

| Arquivo | Testes | O que cobre |
|---------|--------|-------------|
| `sessionAnalytics.test.ts` | 15 | `getSessionForHour` + `computeSessionStats` (Ásia/Europa/EUA CVD) |
| `coinmetrics.test.ts` | 10 | Shape, ranges MVRV/NUPL, zonas, history, updated_at |
| `dealerGreeks.test.ts` | 27 | `computeGreeks` null guards, delta ATM, put-call parity, GEX sign |
| `macroCalendar.test.ts` | 27 | parsePrevToNumeric, dedup delivery key, DST ET→BRT, janelas de alerta |
| `marketCache.test.ts` | 5 | withCache TTL, anti-poisoning, IS_LIVE guard |
| `apiClient.test.ts` | 13 | apiFetch retry 5xx, RateLimitError 429, backoff |
| `binanceWs.test.ts` | 13 | singleton WS, backoff 1s→30s, unsubscribe |
| `aiCalibration.test.ts` | — | pesos calibrados, projectWeights normalização |
| `mtfAnalysis.test.ts` | 19 | frameFromKlines, computeConfluence FORTE/MODERADA/FRACA |
| `zScore.test.ts` | 32 | mean/stddev, computeZScore, buildZScoreAlerts, volume candle fechado |
| `aiInsight.test.ts` | 6 | fetchAiInsight payload, headers, zAlerts, erros 4xx/5xx |

---

## 🚨 PLANO PRÓXIMA SESSÃO — MACRO PRODUCTION HARDENING

> Objetivo: Página Macro 100% online, confiável e automática. Zero mock, zero dado defasado, zero crash.
> Todos os bugs abaixo foram confirmados por leitura direta do código + comparação com APIs reais em 2026-05-10.

---

### VALORES REAIS VERIFICADOS (referência para validação pós-fix)

| Indicador | Fonte | Valor verificado (2026-05-10) | Comportamento atual (bug) |
|-----------|-------|-------------------------------|--------------------------|
| S&P 500 | Yahoo Finance `%5EGSPC` | ~5.270 pts | FRED `SP500` (licença S&P Global — risco legal) |
| VIX | Yahoo Finance `%5EVIX` | ~18.5 | FRED `VIXCLS` (licença CBOE — risco legal) |
| Gold spot | FRED `GOLDAMGBD228NLBM` | ~$3.230/oz | ✅ OK — série livre |
| DXY | FRED `DTWEXBGS` | ~100,8 | ✅ OK — série livre |
| Fed Funds Rate | FRED `DFF` (diário) | ~4.33% | `FEDFUNDS` (mensal, 30 dias de atraso) + `fed_funds: 5.25` hardcoded |
| Fed Balance Sheet | FRED `WALCL` ÷ 1000 | ~6.700 B | ✅ OK (conversão /1000 correta) |
| RRP (Overnight) | FRED `RRPONTSYD` | ~0,6 B | Fallback `?? 300` = 500× errado |
| TGA (Tesouro) | FRED `WTREGEN` ÷ 1000 | ~700 B | ✅ OK (conversão /1000 correta) |
| Net Liquidity | Fed BS − RRP − TGA | ~5.839 B | Cálculo correto mas RRP corrompido distorce o total |
| US10Y | FRED `DGS10` | ~4.4% | ✅ OK |
| US2Y | FRED `DGS2` | ~3.9% | ✅ OK |
| DFII10 (Real Yield) | FRED `DFII10` | ~2.1% | ✅ OK |
| Term Premium | FRED `THREEFYTP10` | ~0.5% | ✅ OK |

---

### AGENTE 1 — QA/Backend: Bug Fixes em fred.ts + Macro.jsx

**Prioridade: CRÍTICA — executar primeiro**

#### BUG-1 — `fed_funds` hardcoded com valor errado
- **Arquivo:** `src/services/fred.ts` (aprox. linha 132)
- **Problema:** `fed_funds: 5.25` é um mock fixo. Taxa atual é 4.33% (DFF).
- **Fix:** Remover o mock; deixar o valor vir da série `DFF` via `fetchSeries`.

#### BUG-2 — Série errada para Fed Funds Rate
- **Arquivo:** `src/services/fred.ts` (aprox. linha 475, objeto `MACRO_SERIES`)
- **Problema:** `series_id: 'FEDFUNDS'` — série mensal, atraso de ~30 dias.
- **Fix:** Trocar por `series_id: 'DFF'` — taxa diária efetiva, sem atraso.
- **Impacto:** MacroBoard e YieldCurve passam a mostrar taxa do dia anterior (correto).

#### BUG-3 — Fallback RRP 500× errado
- **Arquivo:** `src/services/fred.ts` (aprox. linhas 325 e 396, getter de `RRPONTSYD`)
- **Problema:** `?? 300` — fallback de 300 bilhões quando RRPONTSYD falha ou retorna vazio. Valor real é ~0,6 bilhão.
- **Fix:** Trocar `?? 300` por `?? 1` (ou `?? 0`). Nunca usar fallback de produção com mock embarcado.

#### BUG-4 — Cálculo `rrp4w/fed4w/tga4w` por índice em vez de por data
- **Arquivo:** `src/services/fred.ts` (aprox. linhas 400–402, bloco `4w-ago`)
- **Problema:** `liqGet(i)[liqGet(i).length - 5]?.value` pega o 5º ponto do final assumindo que todos os arrays têm o mesmo espaçamento temporal. FRED retorna frequências distintas (WALCL semanal, RRPONTSYD diário, WTREGEN semanal) — o índice −5 corresponde a datas diferentes em cada série.
- **Fix:** Para cada série, encontrar o ponto mais próximo de `targetDate = today − 28d` por lookup de data (`arr.find(p => p.date <= target)` em ordem reversa). Garante alinhamento temporal real.

#### BUG-5 — Condição de erro redundante/invertida em Macro.jsx
- **Arquivo:** `src/pages/Macro.jsx` (aprox. linha 511, render do `BrMacroPanel`)
- **Problema:** `(isLoading || isError || m.value === null) && !isLoading` — a condição `isLoading` dentro do OR nunca é verdadeira quando o `&& !isLoading` externo é verdadeiro. Na prática, mostra "Sem dados" durante o carregamento inicial se `m.value` ainda for `null`.
- **Fix:** Reescrever como `!isLoading && (isError || m.value === null)`.

---

### AGENTE 2 — API Integration: Migrar SP500 + VIX para Yahoo Finance

**Prioridade: ALTA — risco legal com FRED SP500/VIXCLS**

#### TAREFA-A — Criar `src/services/yahooFinance.ts`

```typescript
// Contrato esperado
export interface YahooQuote {
  ticker: string;
  price: number;
  change1d: number;       // variação percentual 1 dia
  history: Array<{ date: string; value: number }>; // últimos 30d
  fetchedAt: string;      // ISO
}

export async function fetchYahooQuote(ticker: string, days = 35): Promise<YahooQuote>
```

- **Endpoint:** `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range={days}d`
- **Tickers:** S&P 500 = `%5EGSPC`, VIX = `%5EVIX`
- **Validação Zod obrigatória** no shape `chart.result[0].indicators.quote[0].close`
- **Sem chave de API** — Yahoo Finance é gratuito para uso básico
- **CORS:** Chamar via fred-proxy OU criar novo edge function `yahoo-proxy` se CORS bloquear

#### TAREFA-B — Remover SP500 + VIXCLS do `MACRO_SERIES` em `fred.ts`
- Identificar onde `series_id: 'SP500'` e `series_id: 'VIXCLS'` são declarados
- Substituir por chamada a `fetchYahooQuote('%5EGSPC')` e `fetchYahooQuote('%5EVIX')`
- Garantir que o shape de retorno (`history`, `value`, `change1d`) seja idêntico ao que `MacroBoard` e `Macro.jsx` esperam

#### TAREFA-C — Atualizar fred-proxy (se necessário) para aceitar `type: 'yahoo'`
- Se `fetchYahooQuote` enfrentar CORS no browser → adicionar branch `type === 'yahoo'` no `fred-proxy/index.ts`
- Alternativamente, criar `supabase/functions/yahoo-proxy/index.ts` espelhando a lógica do fred-proxy

---

### AGENTE 3 — Performance & Polish

**Prioridade: MÉDIA — executa após Agente 1 e 2**

#### PERF-1 — `useMemo` em `yieldSpread` e `deltaChartData` (Macro.jsx)
- **Arquivo:** `src/pages/Macro.jsx` (linhas 543–555)
- **Problema:** `yieldSpread` e `deltaChartData` são recalculados em todo re-render da página. Ambos dependem de `macroBoard.data` que muda apenas a cada 1h.
- **Fix:** Envolver em `useMemo(() => ..., [macroBoard.data])`.

#### PERF-2 — `refetchInterval` muito frequente para séries semanais
- **Arquivo:** `src/hooks/useFred.ts` — `useGlobalLiquidity`
- **Problema:** `refetchInterval: IS_LIVE ? 3_600_000 : false` (1h). WALCL e WTREGEN são publicados uma vez por semana — buscar a cada hora é desperdício puro.
- **Fix:** `refetchInterval: IS_LIVE ? 6 * 3_600_000 : false` (6h para Global Liquidity). MacroBoard pode ficar em 1h (dados diários como DFF/DGS10).

#### PERF-3 — Labels enganosos em `historyToWindows()` (Macro.jsx)
- **Arquivo:** `src/pages/Macro.jsx` (linhas 35–43)
- **Problema:** Label `'1d'` retorna 5 pontos, label `'1w'` retorna 7 pontos — nomes inverídicos para o usuário.
- **Fix:** Renomear para `'5d'` e `'7d'`, ou ajustar a contagem real para 1 ponto e 5 pontos respectivamente. Documentar a intenção no código.

---

### CRITÉRIOS DE ACEITE (todos obrigatórios antes do merge)

```bash
# 1. Build limpo
npm run build

# 2. Testes sem regressão
npm test

# 3. Lint sem warnings novos
npx eslint . --quiet

# 4. TypeScript sem erros
npx tsc -p ./jsconfig.json

# 5. Validação manual dos valores
# Abrir DevTools → Network → filtrar "fred-proxy"
# Confirmar que DFF retorna valor próximo de 4.33%
# Confirmar que RRPONTSYD retorna valor próximo de 0.6 (bilhões)
# Confirmar que SP500 vem do Yahoo Finance (não do FRED)
```

---

## 🗺 O QUE FALTA / EM ANDAMENTO

| Item | Descrição | Status |
|------|-----------|--------|
| **🔴 MACRO PRODUCTION HARDENING** | 5 bugs fred.ts + Macro.jsx; migração SP500/VIX Yahoo Finance; useMemo; refetchInterval; labels | **PRÓXIMA SESSÃO — ver seção acima** |
| **Sprint 7.3 — mockData removals batch B** | Derivatives/Options/SpotFlow/Strategies — imports de mockData/mockDataExtended/mockDataAltcoins removidos; fallbacks inline; DataTrustBadge | ✅ CONCLUÍDO (2026-05-15) |
| **Sprint 7.4 — mockData removals batch C** | Dashboard.jsx, ExecutiveReport.jsx, PredictivePanel.jsx, StablecoinFlow.jsx, ActionDashboard.jsx | 🔜 PRÓXIMO |
| **Telegram Digest** | Edge Functions + pg_cron ativos | ✅ CONCLUÍDO — remover job duplicado `telegram-digest` no SQL Editor |
| **GDELT→Supabase wiring** | upsert de artigos novos | ✅ RESOLVIDO (PR #88) — `upsertGdeltArticles` fire-and-forget em `useGdelt.ts` |
| **MacroCalendar bronze pipeline** | `persistMacroSchedule()` + macro-actual-fetcher | ✅ IMPLEMENTADO — funcional |
| **FRED API key no bundle** | `VITE_FRED_API_KEY` visível no bundle JS | ✅ RESOLVIDO (commit `11a718f`) — fred-proxy server-side |
| **Module toggles enforcement** | Settings escreve flags mas páginas não lêem | ✅ RESOLVIDO (PR #90) |
| **pg_cron duplicata** | Job `telegram-digest` duplica `send-telegram-digest` | ⚠️ Usuário executa: `SELECT cron.unschedule('telegram-digest');` |
| **Auth real** | Login com email/Google via Supabase Auth | Aguarda decisão de negócio |
| **APIs pagas** | SOPR, Netflow, Whale via Glassnode/CryptoQuant | ~$29/mês — confirmar se vale |

---

## 🗂 SPRINT A — MARKET CACHE + RESILIÊNCIA DE API (2026-05-07)

### Objetivo
Organizar resiliência de API com cache no Supabase para nunca estourar limites gratuitos (CoinGecko 30 req/min) e reduzir latência em cold starts.

### O que já existia (NÃO foi refeito)
- `src/services/` com 16 arquivos — estrutura modular já completa (score 98/100)
- TypeScript estrito, Zod validation, retornos padronizados — já implementados
- Segurança com VITE_ vars — já em `src/lib/env.ts`
- Fallback mock/live — já em todos os serviços

### Sprint B — apiClient retry/429 + CryptoCompare fallback — PR #75 ✅ MERGEADO
| Item | Arquivo | Status |
|------|---------|--------|
| `apiFetch` com retry 5xx + `RateLimitError` em 429 | `src/lib/apiClient.ts` | ✅ |
| Fallback CryptoCompare para altcoins em 429 | `src/services/providers/cryptoCompare.ts` | ✅ |
| `VITE_CRYPTOCOMPARE_KEY` opcional | `src/lib/env.ts` | ✅ |
| `coingecko.ts` usa `apiFetch` + fallback automático | `src/services/coingecko.ts` | ✅ |
| 13 testes cobrindo todos os cenários de retry/429 | `src/__tests__/lib/apiClient.test.ts` | ✅ |
| `src/lib/apiClient.ts` adicionado ao include de coverage | `vitest.config.ts` | ✅ |
| build ✅ · lint ✅ · tsc ✅ · tests 134/134 ✅ · lines 11.52% · functions 11.13% | — | ✅ |

### O que foi adicionado no Sprint A — PR #74 ✅ MERGEADO
| Item | Arquivo | Status |
|------|---------|--------|
| Tabela `market_cache` no Supabase | `supabase/migrations/20260507000000_market_cache.sql` | ✅ Aplicada via MCP |
| Serviço de cache de borda | `src/services/marketCache.ts` | ✅ |
| Cache integrado em CoinGecko | `src/services/coingecko.ts` | ✅ |

### Como funciona
1. `withCache(key, ttlSec, source, fetcher)` — wrapper transparente
2. Verifica `market_cache` no Supabase: se `updated_at < ttlSec` → retorna JSON do banco
3. Se stale/ausente → chama API real, salva no banco (fire-and-forget), retorna resultado
4. Timeout de 2s na leitura do cache — se banco lento, chama API diretamente
5. Se Supabase não configurado ou `IS_LIVE=false` → pula cache completamente

### Endpoints com cache ativo
| Endpoint | Cache Key | TTL | Proteção |
|----------|-----------|-----|----------|
| CoinGecko `/global` | `coingecko:dominance` | 300s (5 min) | 429 multi-usuário |
| CoinGecko `/coins/markets` | `coingecko:altcoins:{limit}` | 300s (5 min) | 429 multi-usuário |

### Verificação completa (teste como usuário — 2026-05-07)
- ✅ Migration aplicada via MCP — tabela criada no Supabase WorkSpace MRP
- ✅ INSERT + upsert por `cache_key` testados — freshness check `age_sec=8 → FRESH`
- ✅ `npm run build` — 0 erros (8.42s)
- ✅ `npm test:coverage` — 122/122 testes · lines 10.04% · functions 10.23%
- ✅ PR #74 mergeado (incluindo correções P1/P2 do Codex Review)

### Bugs corrigidos durante CI do Sprint A (commit b56ef6b)
| # | Severidade | Bug | Fix |
|---|------------|-----|-----|
| P2 | Crítico | `setCached` sem `?on_conflict=cache_key` — PostgREST conflitava no PK (uuid novo), silenciava todos os writes após o 1º insert | URL: `/rest/v1/market_cache?on_conflict=cache_key` |
| P1 | Alto | Cache hits devolvidos sem validação — anon key exposta permite escrever dados envenenados em market_cache | `withCache` aceita `validate?` opcional; `coingecko.ts` passa `validateDominance` e `validateAltcoins` |
| CI | Alto | `marketCache.ts` sem testes derrubou coverage de lines para 9.86% (threshold 10%) | 5 testes em `marketCache.test.ts` → lines 10.04% ✅ |

---

## 🤖 AI ETAPAS — INTELIGÊNCIA ADAPTATIVA (2026-05-07/08)

| Etapa | Status | PR | O que foi entregue |
|-------|--------|----|--------------------|
| **Etapa 1 — Pesos calibrados** | ✅ PR #79 | `aiCalibration.ts` + `useAiCalibration`; `projectWeights()` garante 10%/40% pós-norm; Dashboard passa pesos ao engine |
| **Etapa 2 — Confluência MTF** | ✅ PR #80 | `mtfAnalysis.ts` frameFromKlines + computeConfluence; `useMtfAnalysis` (enabled=IS_LIVE); widget Zona D sempre visível (AGUARDANDO em mock); 19 testes |
| **Etapa 3 — Z-score alerts** | ✅ PR #81 | `zScore.ts` mean/stddev/computeZScore/buildZScoreAlerts; `useZScoreAlerts`; widget condicional em Zona D; 32 testes; P2 fix: volume usa candle fechado (`candles[-2]`) |
| **Etapa 4 — Claude Haiku NLG** | ✅ PR #86 | Edge Function `ai-analysis` (Deno + `npm:@anthropic-ai/sdk`); prompt caching ~90% redução custo; `useAiInsight` time-bucket 15min (evita chamada por tick); widget "Análise Natural — Claude Haiku" em Zona D; 6 testes; ~R$2/mês |

### Ativação da Etapa 4
- Supabase Dashboard → Settings → Edge Functions → Secrets → `ANTHROPIC_API_KEY`
- Deploy: `supabase functions deploy ai-analysis`
- Widget só aparece com IS_LIVE=true + Supabase configurado

### Bugs corrigidos durante CI do PR #86
| # | Bug | Fix | Commit |
|---|-----|-----|--------|
| P1 | `TS2448`: `aiInsightPayload` usava `activeScore`/`activeRegime` antes de declarados (temporal dead zone) | Movido bloco para após as declarações | `2a21e57` |
| P2 | Query key com dados live (riskScore, fundingRate) mudava a cada tick de 30s, bypassando staleTime | Substituído por `timeBucket = floor(Date.now() / 15min)` | `2637630` |
| CI | Edge Functions não listadas em `config.toml` → Supabase Preview warning ⚠️ | 7 entradas `[functions.*]` adicionadas | `66958c4` |

---

## 🔜 FASE 2 — ELIMINAR ILUSÃO DE DADOS (PRÓXIMA)

**Objetivo:** Garantir que o usuário nunca confunda dado falso com real. Nenhuma feature nova — apenas transparência.

**Regra:** é melhor não mostrar um dado do que mostrar dado inventado bonito.

### Tarefas em ordem de execução

| # | Tarefa | Arquivo(s) | Critério de aceite |
|---|--------|-----------|-------------------|
| 2.1 | Adicionar banner global `"🧪 MODO DEMO"` sticky no Layout quando `DATA_MODE=mock` | `src/Layout.jsx` | Banner visível em todas as páginas quando DATA_MODE=mock; invisível em live |
| 2.2 | Remover artigos fabricados de `mockDataNews.jsx` | `src/components/data/mockDataNews.jsx` | Array exportado vazio ou com placeholder sem fontes inventadas |
| 2.3 | Remover AI recommendation hardcoded de `mockData.jsx` | `src/components/data/mockData.jsx` linha ~691 | `aiAnalysis.overall.recommendation` substituído por string vazia ou template explícito |
| 2.4 | Adicionar badge/overlay DEMO no `ActionDashboard.jsx` | `src/pages/ActionDashboard.jsx` | Cards de oportunidades com selo visual "DEMO" e botões de ação desabilitados em mock |
| 2.5 | Adicionar label DEMO no `Portfolio.jsx` | `src/pages/Portfolio.jsx` | Seção de posições com aviso "Portfólio Demo — sem posições reais" quando usando mock |
| 2.6 | Adicionar label DEMO em `Strategies.jsx` | `src/pages/Strategies.jsx` | P&L histórico com label "Simulado" |

**Risco:** Baixo — somente visual/lógica de exibição. Nenhuma API, hook ou schema de banco alterado.
**Tempo estimado:** 3–5 horas.
**Gratuito:** Sim — sem dependências pagas.
**Build/Testes exigidos ao final:** `npm run build && npm run test && npm run lint`
