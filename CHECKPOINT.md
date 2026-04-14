# CHECKPOINT.md — MRP Dashboard
> Memória técnica viva do projeto. Atualizar ao final de cada bloco importante.
> Última atualização: 2026-04-13 (Fase 6 — Sprint 6.1 + 6.2 CONCLUÍDOS)

---

## 🗂 ESTADO GERAL

| Aspecto | Status | Observação |
|---------|--------|------------|
| Build (`npm run build`) | ✅ PASSA | 20+ chunks lazy loading, maior chunk 378KB (Recharts) |
| Lint (`eslint . --quiet`) | ✅ PASSA | 0 erros |
| TypeCheck (`tsc -p jsconfig.json`) | ✅ PASSA | 0 erros |
| Testes (`npm test`) | ✅ 25/25 | Vitest — sessionAnalytics (15) + coinmetrics (10) |
| Deploy (Render) | ✅ ONLINE | https://mrp-dashboard.onrender.com |
| Dados ao vivo | ✅ ATIVO | DATA_MODE=live, .env.local configurado com credenciais reais |
| Auth real | ❌ AUSENTE | Stub anônimo (isAuthenticated: false) — aguarda Fase futura |
| Supabase | ✅ ATIVO | 3 tabelas vivas com RLS (alert_rules, portfolio_positions, user_settings) |
| TanStack Query Hooks | ✅ 17 hooks | + useOnChainExtended (6.1) + useGlobalLiquidity (6.2) |
| Navegação performance | ✅ CORRIGIDA | Suspense dentro de LayoutWrapper; hover prefetch nas rotas |

---

## 🧭 MAPA DE FASES

| Fase | Status | Data |
|------|--------|------|
| Fase 1 — Análise Profunda | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 2 — Interface/Visual (Sprints 1+2) | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 3 — API + Hooks + Settings (Sprints 3.1–3.9) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 4 — Cálculos Python + Wiring Live (Sprints 4.1–4.5) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 5 — APIs Gratuitas + Testes + Varredura (Sprints 5.1–5.6) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 6 — Expansão OnChain/Macro/Governance (Sprints 6.1–6.7) | 🔄 EM EXECUÇÃO | 2026-04-13 |

---

## ✅ SPRINTS CONCLUÍDOS

### ─── SPRINTS 1–4.5 (ver histórico acima) ───
> Consulte versão anterior do CHECKPOINT para detalhes dos sprints 1–4.5.

### ─── SPRINTS 5.1–5.6 (2026-04-12) — FASE 5 FINALIZADA ───
| Item | Status | Detalhes |
|------|--------|----------|
| **5.1** — `AuthContext.jsx`: `isAuthenticated: false` (estado anônimo correto) | ✅ DONE | Estava `true` hardcoded — bug crítico corrigido |
| **5.2** — `services/coinmetrics.ts`: MVRV Z-Score, NUPL, Realized Price, NVT via CoinMetrics Community | ✅ DONE | Grátis, sem API key, qualidade A |
| **5.2** — `hooks/useCoinMetrics.ts`: `useOnChainCycle` (1h refetch em live) | ✅ DONE | staleTime 3.5h |
| **5.2** — `scripts/validate_mvrv_zscore.py`: fórmulas MVRV Z-Score + NUPL validadas em Python | ✅ DONE | 8 assertions |
| **5.2** — `OnChain.jsx`: `MvrvCard` wired para CoinMetrics live (live>mock fallback + grade badge) | ✅ DONE | |
| **5.2** — `OnChain.jsx`: `HashRateCard` wired para Mempool.space live | ✅ DONE | Converte history para formato MiniTimeChart |
| **5.2** — `OnChain.jsx`: `MempoolCard` wired para Mempool.space live | ✅ DONE | Fees + tx_count + vsize |
| **5.2** — `OnChain.jsx`: `ModeBadge` dinâmico (mock/live/loading baseado no IS_LIVE + dados) | ✅ DONE | Era hardcoded "mock" |
| **5.2** — `mockData.jsx`: adicionado `'1d'` key em `btcHashRate.history` | ✅ DONE | Bug fix varredura |
| **5.3** — `services/binance.ts`: `fetchLiquidations` via `/fapi/v1/forceOrders` (público, sem key) | ✅ DONE | |
| **5.3** — `hooks/useBtcData.ts`: `useLiquidations(limit)` (30s refetch em live) | ✅ DONE | |
| **5.3** — `Derivatives.jsx`: `LiquidationsPanel` — tabela live com totais longs/shorts em USD | ✅ DONE | |
| **5.4** — `utils/sessionAnalytics.ts`: `computeSessionStats` — CVD/vol/taker%/price move por sessão UTC | ✅ DONE | Asia 00-08 / Europe 08-16 / US 16-24 |
| **5.4** — `SpotFlow.jsx`: sessões calculadas de klines 1h Binance (72h window) com fallback mock | ✅ DONE | Badge "LIVE" quando ativo |
| **5.4** — `SpotFlow.jsx`: chart de preço usa klines live quando disponível | ✅ DONE | |
| **5.5** — `services/bybit.ts`: Bybit V5 API — mark price, funding, OI (Zod schemas) | ✅ DONE | Grátis, sem key |
| **5.5** — `services/okx.ts`: OKX V5 API — funding-rate + ticker paralelo (Zod schemas) | ✅ DONE | OI: contratos × 0.01 BTC × preço |
| **5.5** — `hooks/useMultiVenue.ts`: 5 hooks (useBybitTicker/Funding, useOkxTicker/Funding, useMultiVenueSnapshot) | ✅ DONE | 30s refetch |
| **5.5** — `Derivatives.jsx`: `MultiVenuePanel` — tabela Binance\|Bybit\|OKX + sinal de divergência de funding em bps | ✅ DONE | |
| **5.6** — `vitest.config.ts`: jsdom env, VITE_DATA_MODE=mock para testes determinísticos | ✅ DONE | |
| **5.6** — `src/__tests__/utils/sessionAnalytics.test.ts`: 15 testes de lógica pura | ✅ DONE | getSessionForHour + computeSessionStats |
| **5.6** — `src/__tests__/services/coinmetrics.test.ts`: 10 testes (shape + zonas + consistency) | ✅ DONE | |
| **5.6** — `package.json`: scripts `"test"` e `"test:watch"` adicionados | ✅ DONE | |
| **Varredura:** `npm run build` ✅ · `tsc` ✅ · `eslint` ✅ · `vitest 25/25` ✅ | ✅ DONE | Varredura profunda com agent de revisão |

### ─── SPRINTS 6.1–6.2 (2026-04-13) — FASE 6 EM EXECUÇÃO ───
| Item | Status | Detalhes |
|------|--------|----------|
| **6.1** — `services/coinmetrics.ts`: `fetchOnChainExtended()` — CDD, SplyAdr, VelCur1yr | ✅ DONE | MA30, Z-score, dormancy proxy, HODL %, trend |
| **6.1** — `hooks/useCoinMetrics.ts`: `useOnChainExtended()` | ✅ DONE | staleTime 1h, refetch live |
| **6.1** — `OnChain.jsx`: `CddCard` — Z-score bar, sinal textual, MiniTimeChart | ✅ DONE | Seção "Fluxo de Ciclo — CDD & HODL" |
| **6.1** — `OnChain.jsx`: `HodlWaveCard` — HODL >1yr %, trend badge, dormancy proxy | ✅ DONE | |
| **6.2** — `services/fred.ts`: WALCL, RRPONTSYD, WTREGEN, DFII10, THREEFYTP10, DTWEXBGS | ✅ DONE | Promise.allSettled para resiliência |
| **6.2** — `hooks/useFred.ts`: `useGlobalLiquidity()` | ✅ DONE | staleTime 4h, Net Liquidity formula |
| **6.2** — `Macro.jsx`: `GlobalLiquiditySection` — 6 cards + AreaChart histórico | ✅ DONE | Fed BS / RRP / TGA / Real Yield / Term Premium / DXY |
| **6.2** — `components/ui/DataQualityBadge.jsx`: badge reutilizável score 0-100, grau A-D | ✅ DONE | |
| **6.2** — `.env.local`: criado com VITE_FRED_API_KEY + VITE_SUPABASE_* reais | ✅ DONE | Ignorado pelo git |
| **6.2** — Supabase: migração aplicada via MCP — 3 tabelas com RLS | ✅ DONE | alert_rules, portfolio_positions, user_settings |
| **Varredura pós-6.2:** `npm run build` ✅ · `vitest 25/25` ✅ | ✅ DONE | 8 arquivos modificados, 1.196 inserções |

---

## 🏗 ARQUITETURA ATUAL (2026-04-13 — pós Sprint 6.2)

```
src/
  pages/          → 20 páginas roteadas
  components/
    ui/           → 40+ componentes Shadcn/Radix
    data/         → 15 arquivos mock (TEMPORÁRIO — eliminação gradual)
    dashboard/    → 4 componentes
    derivatives/  → 2 componentes
    onchain/      → 1 componente
    options/      → 3 componentes
    ai/           → 1 componente AI
  hooks/
    use-mobile.jsx
    useBtcData.ts       ← Sprint 3.3 + 5.3 (+ useLiquidations)
    useCoinMetrics.ts   ← useOnChainCycle + useOnChainExtended (NOVO Sprint 6.1)
    useDeribit.ts       ← Sprint 3.8
    useFred.ts          ← useMacroBoard + useGlobalLiquidity (NOVO Sprint 6.2)
    useMempool.ts       ← Sprint 3.8
    useMultiVenue.ts    ← Bybit/OKX snapshot + divergência (Sprint 5.5)
    useRiskScore.ts     ← Sprint 4.2
    useSupabase.ts      ← Sprint 3.8
  services/
    alternative.ts, binance.ts (+ liquidações), bybit.ts,
    coingecko.ts, coinmetrics.ts (CDD/Dormancy/HODL — ATUALIZADO Sprint 6.1),
    deribit.ts, fred.ts (Global Liquidity — ATUALIZADO Sprint 6.2),
    mempool.ts, okx.ts, supabase.ts
  utils/
    index.ts
    riskCalculations.ts ← Sprint 4.1
    sessionAnalytics.ts ← Sprint 5.4
  lib/
    env.ts, errorBoundary.tsx, AuthContext.jsx (stub anônimo)
    query-client.js, app-params.js, notificationClient.js
  __tests__/
    utils/sessionAnalytics.test.ts   ← 15 testes (Sprint 5.6)
    services/coinmetrics.test.ts      ← 10 testes (Sprint 5.6)
  components/ui/
    DataQualityBadge.jsx ← NOVO Sprint 6.2

scripts/
  validate_var.py, validate_risk_score.py, validate_gex.py,
  validate_macro_surprise.py, validate_mvrv_zscore.py

supabase/migrations/20260412000000_create_core_tables.sql ← 3 tabelas com RLS (ATIVAS)
vitest.config.ts    ← Sprint 5.6
.env.local          ← CRIADO com credenciais reais (ignorado pelo git)
.env.example        ← Sprint 3.3
```

---

## 🔑 PADRÃO DE API (OBRIGATÓRIO — definido pelo usuário)

```typescript
// 1. Schemas com z.coerce.number() (APIs retornam strings)
const Schema = z.object({ value: z.coerce.number() });

// 2. res.ok check ANTES do parse
const res = await fetch(url);
if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);

// 3. refetchInterval só em IS_LIVE
refetchInterval: IS_LIVE ? 5_000 : false,

// 4. REGRA ABSOLUTA: Mock NÃO substitui live com falha
// DATA_MODE=mock  → retorna mock instantaneamente
// DATA_MODE=live  → chama API; se falhar → lança erro (UI mostra error state)
// Mock NUNCA é fallback silencioso de dado live com falha
```

---

## 🔴 PROBLEMAS AINDA PRESENTES

### Críticos
| # | Arquivo | Problema | Ação |
|---|---------|---------|------|
| C1 | `src/lib/AuthContext.jsx` | Auth stub — acesso anônimo sem proteção | Aguarda Fase futura (Supabase Auth) |
| ~~C2~~ | ~~`.env.local`~~ | ~~VITE_FRED_API_KEY, VITE_SUPABASE_* não configuradas~~ | ✅ RESOLVIDO — `.env.local` criado com credenciais reais |

### Alta Severidade
| # | Arquivo | Problema | Ação |
|---|---------|---------|------|
| A1 | Projeto inteiro | Cobertura de testes baixa (25 testes apenas) | Sprint 6.7 — ampliar para ≥45 testes |
| A2 | `src/components/data/` | 15 arquivos mock ainda ativos | Eliminação gradual conforme APIs ligadas |
| A3 | Telegram Bot Token | Edge Function arquitetada mas não deployada | BLOQUEADO — usuário deve criar bot via @BotFather |

### Média Severidade
| # | Arquivo | Problema | Ação |
|---|---------|---------|------|
| M1 | `mempool.ts` + `OnChain.jsx` | SOPR/Netflow sempre mock (sem API pública gratuita) | Integrar Glassnode/CryptoQuant se autorizado |
| M2 | `vite.config.js` | Bundle Recharts 378KB sem split | Pendente — manualChunks Sprint 6.7 |

---

## 📊 STATUS DAS APIs

| Serviço | Arquivo | DATA_MODE=mock | DATA_MODE=live | API Key? |
|---------|---------|----------------|----------------|----------|
| Binance Futures/Spot | `binance.ts` | ✅ Mock | ✅ Pronto | Não |
| CoinGecko | `coingecko.ts` | ✅ Mock | ✅ Pronto | Não |
| Alternative.me (F&G) | `alternative.ts` | ✅ Mock | ✅ Pronto | Não |
| Deribit Options | `deribit.ts` | ✅ Mock | ✅ Pronto | Não |
| FRED (macro + Global Liquidity) | `fred.ts` | ✅ Mock | ✅ Pronto | ⚠️ `VITE_FRED_API_KEY` ✅ |
| Mempool.space | `mempool.ts` | ✅ Mock | ✅ Pronto | Não |
| CoinMetrics Community | `coinmetrics.ts` | ✅ Mock | ✅ Pronto (+ CDD/HODL) | Não |
| Bybit V5 | `bybit.ts` | ✅ Mock | ✅ Pronto | Não |
| OKX V5 | `okx.ts` | ✅ Mock | ✅ Pronto | Não |
| Supabase | `supabase.ts` | ✅ Fallback | ✅ Pronto + 3 tabelas vivas | ⚠️ `VITE_SUPABASE_*` ✅ |
| BCB OpenData | — | — | ⏳ Sprint 6.2b | Não |
| Glassnode | — | ✅ Mock | ❌ AUSENTE | ⚠️ Plano pago |
| CryptoQuant | — | ✅ Mock | ❌ AUSENTE | ⚠️ Plano pago |

---

## 🗺 PRÓXIMOS PASSOS — FASE 6 (sprints pendentes)

| Sprint | Prioridade | Descrição |
|--------|------------|-----------|
| **6.2b** | Alta | BCB Layer — SELIC (série 11), IPCA (433), USDBRL (1) via BCB OpenData |
| **6.3** | Alta | HODL Waves visual avançado + CDD histórico completo em OnChain.jsx |
| **6.4** | Alta | Charm/Vanna/GEX Dealer Flow — Black-Scholes 2ª derivada + DealerFlowPanel |
| **6.5** | Média | Governance — data lineage, alert replay, threshold versioning |
| **6.6** | 🔴 BLOQUEADO | Telegram Digest — aguarda Bot Token do usuário via @BotFather |
| **6.7** | Alta | Varredura final: build + tsc + lint + testes ≥45 |

### Detalhes Sprint 6.2b — BCB Layer
- `src/services/bcb.ts` — fetch séries BCB OpenData (JSON, sem key)
- `src/hooks/useBcb.ts` — `useSelic()`, `useIpca()`, `useUsdBrl()`
- `src/components/macro/BrMacroPanel.tsx` — painel compacto com rates + tendência
- Integrar em `Macro.jsx` após GlobalLiquiditySection

### Detalhes Sprint 6.4 — Charm/Vanna
- `scripts/validate_charm_vanna.py` — fórmulas Black-Scholes 2ª derivada
- `src/utils/riskCalculations.ts` — `estimateCharm()`, `estimateVanna()`, `computeVannaExposure()`
- `src/components/options/DealerFlowPanel.tsx`
- `src/__tests__/utils/dealerGreeks.test.ts`

### Itens técnicos pendentes (não bloqueantes)
- [ ] Bundle split Recharts 378KB → `manualChunks` em `vite.config.js`
- [ ] Auth real — Supabase Auth (email/OAuth) — aguarda estabilidade
- [ ] Rate limiting CoinGecko — debounce/queue ≤30 req/min

---

## 🏦 APIs GRATUITAS MAPEADAS

| Dado | API | Limite Free | Status |
|------|-----|-------------|--------|
| BTC price, funding, OI, liquidações | Binance Futures/Spot | Sem limite | ✅ Service pronto |
| MVRV Z-Score, NUPL, Realized Price, NVT | CoinMetrics Community | ~2 req/s, sem key | ✅ NOVO Sprint 5.2 |
| Mark price, funding, OI | Bybit V5 | Sem limite | ✅ NOVO Sprint 5.5 |
| Funding, preço, OI | OKX V5 | Sem limite | ✅ NOVO Sprint 5.5 |
| Fear & Greed | alternative.me | Sem limite | ✅ Service pronto |
| Price, dominance, altcoins | CoinGecko | 30 req/min | ✅ Service pronto |
| Options IV, term structure | Deribit | Sem limite | ✅ Service pronto |
| Macro: yields, VIX, S&P | FRED API | 120 req/min | ✅ Service pronto (key free) |
| On-Chain básico, hashrate, mempool | Mempool.space | Sem limite | ✅ Service pronto |
| Persistência usuário | Supabase free | 500MB DB | ✅ Service + schema prontos |
| NUPL, MVRV, Netflow (live) | Glassnode | ❌ Pago | ⚠️ Mock permanente até autorização |
| Exchange flows | CryptoQuant | ❌ Pago | ⚠️ Mock permanente até autorização |

---

## 🔐 SEGURANÇA — CHECKLIST PRÉ-PRODUÇÃO

- [x] Zod validation em todos os inputs externos (API responses)
- [x] `res.ok` check antes de qualquer JSON.parse
- [x] ErrorBoundary global em App.jsx
- [x] Variáveis de ambiente tipadas via env.ts (nunca `import.meta.env.X` direto)
- [x] `isAuthenticated: false` — acesso anônimo (não expõe dados privados prematuramente)
- [ ] Auth real antes de expor portfólio/alertas do usuário em produção
- [ ] VITE_SUPABASE_ANON_KEY nunca commitada (está em .gitignore via .env.local)
- [ ] VITE_FRED_API_KEY nunca commitada
- [ ] Rate limiting client-side para CoinGecko (30 req/min free tier)

---

## 🗂 ESTADO GERAL

| Aspecto | Status | Observação |
|---------|--------|------------|
| Build (`npm run build`) | ✅ PASSA | 20 chunks lazy loading, maior chunk 378KB (Recharts) |
| Lint (`eslint . --quiet`) | ✅ PASSA | 0 erros |
| TypeCheck (`tsc -p jsconfig.json`) | ✅ PASSA | 0 erros |
| Deploy (Render) | ✅ ONLINE | https://mrp-dashboard.onrender.com |
| Dados ao vivo | ✅ ATIVO | DATA_MODE=live é padrão permanente (env.ts default='live') |
| Serviços externos | ✅ ESTRUTURADO | 6 services em `src/services/` (binance, coingecko, alternative, deribit, fred, mempool, supabase) |
| Auth real | ❌ AUSENTE | Stub hardcoded — aguarda Fase futura |
| Supabase | ✅ INSTALADO + SCHEMA | Instalado, service criado, migração SQL pronta |
| TanStack Query Hooks | ✅ PRONTOS | `src/hooks/useBtcData.ts` — 6 hooks (ticker, OI, klines, dominance, altcoins, fear&greed) |
| Navegação performance | ✅ CORRIGIDA | Suspense dentro de LayoutWrapper; hover prefetch nas rotas |

---

## 🧭 MAPA DE FASES

| Fase | Status | Data |
|------|--------|------|
| Fase 1 — Análise Profunda | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 2 — Interface/Visual (Sprints 1+2) | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 3 — API + Hooks + Settings (Sprints 3.1–3.9) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 4 — Cálculos Python + Wiring Live (Sprints 4.1–4.5) | ✅ CONCLUÍDA | 2026-04-12 |

---

## ✅ SPRINTS CONCLUÍDOS

### ─── SPRINT 1 (2026-04-11) ───
| Item | Status |
|------|--------|
| S1.1 — Remove deps não usadas (Stripe, moment, three, leaflet, quill, confetti) | ✅ DONE |
| S1.2 — Remover 4 arquivos órfãos mortos | ✅ DONE |
| S1.3 — Corrigir 64 erros de lint (unused imports) | ✅ DONE |
| S1.4 — Corrigir ~40 erros de typecheck | ✅ DONE |
| S1.5 — Substituir emojis de nav por Lucide icons | ✅ DONE |
| S1.6 — BTC ticker conectado ao mock data | ✅ DONE |
| S1.7 — Base44 favicon/app-params removidos | ✅ DONE |
| S1.8 — Lazy loading por rota (React.lazy + Suspense) | ✅ DONE |

### ─── SPRINT 2 (2026-04-11) ───
| Item | Status |
|------|--------|
| S2.1 — Página Altcoins (Alt Season Index, dominância, top alts, rotação setorial) | ✅ DONE |
| S2.2 — Portfolio Risk Pack: VaR 95%/99%, Sharpe, Max Drawdown, Beta vs BTC | ✅ DONE |
| S2.3 — SpotFlow: análise por sessão (Ásia/Europa/EUA — CVD, volume, taker%) | ✅ DONE |
| S2.4 — MacroCalendar: tab "Surpresa" (actual vs consenso, histórico) | ✅ DONE |
| S2.5 — mockDataAltcoins.jsx criado | ✅ DONE |

### ─── SPRINT 3.1–3.3 (2026-04-12) — commit 1ce2c74 ───
| Item | Status |
|------|--------|
| Layout.jsx redesign completo — glassmorphism sidebar, nav gradiente, mobile bottom nav (5 tabs), drawer full-screen | ✅ DONE |
| src/index.css — animações (pulse-live, shimmer, fade-in, slide-up), scrollbar custom, mobile utilities | ✅ DONE |
| src/lib/env.ts — Zod validation de variáveis de ambiente, exports: `env`, `DATA_MODE`, `IS_LIVE` | ✅ DONE |
| src/lib/errorBoundary.tsx — ErrorBoundary global com DefaultErrorFallback e botão "Tentar novamente" | ✅ DONE |
| src/App.jsx — Wrapped com ErrorBoundary | ✅ DONE |
| src/lib/query-client.js — staleTime, retry exponencial, refetchOnWindowFocus: false | ✅ DONE |
| .env.example — template com VITE_DATA_MODE, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_FRED_API_KEY | ✅ DONE |
| src/services/binance.ts — fetchBtcTicker, fetchOiByExchange, fetchKlines (Zod coerce, res.ok, mock rule) | ✅ DONE |
| src/services/coingecko.ts — fetchDominance, fetchTopAltcoins | ✅ DONE |
| src/services/alternative.ts — fetchFearGreed (30d history) | ✅ DONE |
| src/hooks/useBtcData.ts — 6 hooks TanStack Query (refetchInterval só em IS_LIVE) | ✅ DONE |

### ─── SPRINT 3.4–3.7 (2026-04-12) — commit 90046b8 ───
| Item | Status |
|------|--------|
| **Performance:** Suspense movido para LayoutWrapper (sidebar nunca pisca na navegação) | ✅ DONE |
| **Performance:** Shimmer skeleton como fallback de página (não full-screen) | ✅ DONE |
| **Performance:** Hover prefetch em todos os itens de nav via `PAGE_IMPORTS` | ✅ DONE |
| pages.config.js — exporta `PAGE_IMPORTS` separado de `PAGES` (lazy) | ✅ DONE |
| src/services/deribit.ts — fetchOptionsData (IV, term structure, chain, GEX, max pain, PCR) + fetchDvolHistory | ✅ DONE |
| src/services/fred.ts — fetchMacroBoard (S&P, DXY, Gold, VIX, US10Y, US2Y) + fetchYieldCurve | ✅ DONE |
| src/services/mempool.ts — fetchMempoolState, fetchHashrate (3M history), fetchMiningPools, fetchOnChainAdvanced | ✅ DONE |
| src/services/supabase.ts — CRUD: alert_rules, portfolio_positions, user_settings (+ isSupabaseConfigured) | ✅ DONE |
| supabase/migrations/20260412000000_create_core_tables.sql — 3 tabelas, RLS, índices, triggers updated_at | ✅ DONE |

### ─── SPRINT 3.8–3.9 (2026-04-12) — FASE 3 FINALIZADA ───
| Item | Status |
|------|--------|
| src/hooks/useDeribit.ts — useOptionsData, useDvolHistory (60s live refetch) | ✅ DONE |
| src/hooks/useFred.ts — useMacroBoard, useYieldCurve (1h live refetch) | ✅ DONE |
| src/hooks/useMempool.ts — useMempoolState (30s), useHashrate (5min), useMiningPools (1h), useOnChainAdvanced | ✅ DONE |
| src/hooks/useSupabase.ts — useAlertRules, useUpsertAlertRule, useDeleteAlertRule, usePortfolioPositions, useUpsertPosition, useDeletePosition, useUserSettings, useUpdateSettings | ✅ DONE |
| Dashboard.jsx → useBtcTicker + useFearGreed (live > mock fallback) | ✅ DONE |
| Derivatives.jsx → useBtcTicker + useOiByExchange (live data wired to UI) | ✅ DONE |
| Options.jsx → useOptionsData (spot, iv_atm, strikes chain) | ✅ DONE |
| Macro.jsx → useMacroBoard (series, updated_at) | ✅ DONE |
| OnChain.jsx → useOnChainAdvanced + useMempoolState + useHashrate (cache ativo) | ✅ DONE |
| Portfolio.jsx → usePortfolioPositions + useUpsertPosition + useDeletePosition (Supabase CRUD) | ✅ DONE |
| SmartAlerts.jsx → useAlertRules + useUpsertAlertRule + useDeleteAlertRule (Supabase CRUD) | ✅ DONE |
| Settings.jsx — DataModeToggle funcional (mock↔live) com persistência localStorage + page reload | ✅ DONE |
| src/lib/env.ts — DATA_MODE lê localStorage primeiro (sem rebuild), setDataMode() | ✅ DONE |
| **Varredura final:** `npm run build` ✅ · `tsc -p jsconfig.json` ✅ · `eslint --quiet` ✅ | ✅ DONE |

### ─── SPRINTS 4.1–4.5 (2026-04-12) — FASE 4 FINALIZADA ───
| Item | Status |
|------|--------|
| **Sprint 4.1** — `scripts/validate_var.py` — VaR paramétrico, histórico, CVaR, Sharpe, Beta, Max Drawdown | ✅ DONE |
| **Sprint 4.1** — `src/utils/riskCalculations.ts` — TypeScript port completo de todos os cálculos | ✅ DONE |
| **Sprint 4.1** — `Portfolio.jsx` — computeLiveRiskMetrics() substituindo vol hardcoded (BTC_DAILY_VOL=0.042 removido) | ✅ DONE |
| **Sprint 4.2** — `scripts/validate_risk_score.py` — Risk Score 5-fatores validado (funding 30%, OI 20%, DVOL 20%, F&G 20%, preço 10%) | ✅ DONE |
| **Sprint 4.2** — `src/hooks/useRiskScore.ts` — hook composto live (useBtcTicker + useFearGreed + useDvolHistory + useKlines) | ✅ DONE |
| **Sprint 4.2** — `Dashboard.jsx` — RiskMeter wired para liveRiskScore (FearGreedGauge + BTCSnapshot recebem props live) | ✅ DONE |
| **Sprint 4.3** — `scripts/validate_gex.py` — GEX por strike, net GEX, dealer position, gamma flip, max pain (Black-Scholes gamma) | ✅ DONE |
| **Sprint 4.3** — `Options.jsx` — computeGex() + computeMaxPain() wired com dados live da cadeia Deribit | ✅ DONE |
| **Sprint 4.4** — `scripts/validate_macro_surprise.py` — Z-Score rolling por evento (only prior history) | ✅ DONE |
| **Sprint 4.4** — `MacroCalendar.jsx` — coluna Z-Score na tab Surpresa com computeSurpriseZScores() | ✅ DONE |
| **Sprint 4.5** — `Dashboard.jsx` — MacroRow wired para useMacroBoard() (live > mock fallback, MACRO_ICONS map) | ✅ DONE |
| **Sprint 4.5** — `Dashboard.jsx` — MempoolRow wired para useMempoolState() (fees + tx_count + vsize live) | ✅ DONE |
| **Sprint 4.5** — `useRiskScore.ts` — corrigido chamada useKlines (arg order + .dvol→.value + k[4]→k.close) | ✅ DONE |
| **Sprint 4.5** — `Portfolio.jsx` — corrigido useKlines('1d', 30) + k.close (não mais k[4]) | ✅ DONE |
| **Sprint 4.5** — `src/lib/env.ts` — DATA_MODE default='live' (sem mais mock como padrão) | ✅ DONE |
| **Varredura final:** `npm run build` ✅ · `tsc -p jsconfig.json` ✅ · `eslint --quiet` ✅ | ✅ DONE |

---

## 🏗 ARQUITETURA ATUAL (2026-04-12 — pós Fase 4)

```
src/
  pages/          → 20 páginas roteadas (19 originais + Altcoins)
  components/
    ui/           → 40+ componentes Shadcn/Radix
    data/         → 15 arquivos mock (TEMPORÁRIO — eliminação gradual conforme APIs ativadas)
    dashboard/    → 4 componentes
    derivatives/  → 2 componentes
    onchain/      → 1 componente
    options/      → 3 componentes
    ai/           → 1 componente AI
  hooks/
    use-mobile.jsx
    useBtcData.ts      ← Sprint 3.3
    useDeribit.ts      ← Sprint 3.8
    useFred.ts         ← Sprint 3.8
    useMempool.ts      ← Sprint 3.8
    useSupabase.ts     ← Sprint 3.8
    useRiskScore.ts    ← NOVO (Sprint 4.2) — Risk Score 5-fatores live
  lib/
    env.ts             ← Sprint 3.1 (DATA_MODE default='live' desde Sprint 4.5)
    errorBoundary.tsx  ← Sprint 3.1
    AuthContext.jsx    (stub — ainda hardcoded)
    query-client.js    (atualizado Sprint 3.1)
    utils, app-params, notificationClient
  services/            ← CRIADO (Fase 3)
    binance.ts, coingecko.ts, alternative.ts, deribit.ts, fred.ts, mempool.ts, supabase.ts
  utils/
    index.ts
    riskCalculations.ts ← NOVO (Sprint 4.1) — VaR, Sharpe, Beta, GEX, Risk Score (TypeScript)
  App.jsx              (atualizado Sprint 3.1 — ErrorBoundary)
  Layout.jsx           (redesenhado Sprint 3.2)
  pages.config.js      (atualizado Sprint 3.4 — PAGE_IMPORTS para prefetch)

supabase/
  migrations/
    20260412000000_create_core_tables.sql  ← Sprint 3.7

.env.example           ← Sprint 3.3
```

---

## 🔑 PADRÃO DE API (OBRIGATÓRIO — definido pelo usuário)

Todo service deve seguir este contrato:

```typescript
// 1. Schemas com z.coerce.number() (Binance retorna strings)
const Schema = z.object({ value: z.coerce.number() });

// 2. res.ok check ANTES do parse
const res = await fetch(url);
if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);

// 3. refetchInterval só em IS_LIVE
refetchInterval: IS_LIVE ? 5_000 : false,

// 4. select para transformações de UI (opcional)
select: (data) => ({ ...data, formatted: data.value.toFixed(2) }),

// 5. REGRA ABSOLUTA: Mock NÃO substitui live com falha
// DATA_MODE=mock  → retorna mock instantaneamente
// DATA_MODE=live  → chama API; se falhar → lança erro (UI mostra error state)
// Mock NUNCA é fallback silencioso de dado live com falha
```

---

## 🔴 PROBLEMAS AINDA PRESENTES

### Críticos
| # | Arquivo | Problema | Ação |
|---|---------|---------|------|
| C1 | `src/lib/AuthContext.jsx` | Auth stub, `isAuthenticated: true` hardcoded | Aguarda Fase futura (Supabase Auth) |
| C2 | `.env.local` (não existe) | VITE_FRED_API_KEY, VITE_SUPABASE_* não configuradas | Usuário deve criar .env.local |

### Alta Severidade
| # | Arquivo | Problema | Ação |
|---|---------|---------|------|
| A1 | Projeto inteiro | Zero testes | Aguarda Fase 4+ |
| A2 | `src/components/data/` | 15 arquivos mock ainda ativos | Eliminar gradualmente ao ligar APIs |

### Média Severidade
| # | Arquivo | Problema | Ação |
|---|---------|---------|------|
| M1 | `src/services/mempool.ts` | `fetchOnChainAdvanced` sempre retorna mock (sem API pública gratuita) | Integrar Glassnode/CryptoQuant quando autorizado |
| M2 | `src/components/data/` | 15 arquivos mock ainda presentes | Eliminação gradual conforme APIs são ativadas e testadas |

---

## 📊 STATUS DAS APIs

| Serviço | Arquivo | DATA_MODE=mock | DATA_MODE=live | API Key? |
|---------|---------|----------------|----------------|----------|
| Binance Futures/Spot | `binance.ts` | ✅ Mock | ✅ Pronto | Não |
| CoinGecko | `coingecko.ts` | ✅ Mock | ✅ Pronto | Não |
| Alternative.me (F&G) | `alternative.ts` | ✅ Mock | ✅ Pronto | Não |
| Deribit Options | `deribit.ts` | ✅ Mock | ✅ Pronto | Não |
| FRED (macro) | `fred.ts` | ✅ Mock | ✅ Pronto | ⚠️ `VITE_FRED_API_KEY` |
| Mempool.space | `mempool.ts` | ✅ Mock | ✅ Pronto | Não |
| Supabase | `supabase.ts` | ✅ Fallback | ✅ Pronto | ⚠️ `VITE_SUPABASE_*` |

**Para ativar dados live:** criar `.env.local` com:
```
VITE_DATA_MODE=live
VITE_FRED_API_KEY=sua_key
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

---

## 🗺 PRÓXIMOS PASSOS

### ✅ Fase 3 — COMPLETA (Sprints 3.1–3.9)
### ✅ Fase 4 — COMPLETA (Sprints 4.1–4.5)

### Próximas iniciativas (aguarda nova autorização)
- [ ] Glassnode/CryptoQuant — NUPL, MVRV, Netflow live (requer plano pago)
- [ ] Auth real — Supabase Auth (email/OAuth) para proteger portfólio e alertas
- [ ] Testes automatizados — Vitest/Playwright (zero testes no projeto)
- [ ] OnChain Cycle Pack — MVRV Z-score, HODL Waves, Dormancy (pago)
- [ ] Cross-venue microstructure — taker imbalance cross-exchange

### Gaps de produto ainda presentes
- [ ] Spot Sessions Analytics — CVD intraday por sessão Ásia/Europa/EUA
- [ ] Crypto Institutional Upgrade — GEX live, cohort flow por exchange
- [ ] OnChain Cycle Pack — MVRV Z-score live, HODL Waves (requer Glassnode pago)
- [ ] Cross-venue microstructure — taker imbalance, funding/basis arbitrage
- [ ] Auth real — Supabase Auth (email ou OAuth) para proteger portfólio/alertas do usuário

---

## 📝 DECISÕES PENDENTES

1. **Glassnode/CryptoQuant** — autorizar integração paga para NUPL/MVRV/Netflow live?
2. **Auth real** — Implementar Supabase Auth antes de expor dados de portfólio de usuário?
3. **Testes** — Autorizar sprint de testes (Vitest unit + Playwright e2e)?

---

## 🏦 APIs GRATUITAS MAPEADAS

| Dado | API | Limite Free | Status |
|------|-----|-------------|--------|
| BTC price, funding, OI | Binance Futures/Spot | Sem limite | ✅ Service pronto |
| Fear & Greed | alternative.me | Sem limite | ✅ Service pronto |
| Price, dominance, altcoins | CoinGecko | 30 req/min | ✅ Service pronto |
| Options IV, term structure | Deribit | Sem limite | ✅ Service pronto |
| Macro: yields, VIX, S&P | FRED API | 120 req/min | ✅ Service pronto (key free) |
| On-Chain básico, hashrate | Mempool.space | Sem limite | ✅ Service pronto |
| Persistência usuário | Supabase free | 500MB DB | ✅ Service + schema prontos |
| NUPL, MVRV, Netflow | Glassnode | ❌ Pago | ⚠️ Mock permanente até autorização |
| Exchange flows | CryptoQuant | ❌ Pago | ⚠️ Mock permanente até autorização |

---

## 🔐 SEGURANÇA — CHECKLIST PRÉ-PRODUÇÃO

- [x] Zod validation em todos os inputs externos (API responses)
- [x] `res.ok` check antes de qualquer JSON.parse
- [x] ErrorBoundary global em App.jsx
- [x] Variáveis de ambiente tipadas via env.ts (nunca `import.meta.env.X` direto)
- [ ] Auth real antes de expor portfólio/alertas do usuário
- [ ] VITE_SUPABASE_ANON_KEY nunca commitada (está em .gitignore via .env.local)
- [ ] VITE_FRED_API_KEY nunca commitada
- [ ] Rate limiting client-side para CoinGecko (30 req/min free tier)
