# CHECKPOINT.md — MRP Dashboard
> Memória técnica viva do projeto. Atualizar ao final de cada bloco importante.
> Última atualização: 2026-04-12 (Fase 3 — 100% CONCLUÍDA — Sprints 3.1–3.9)

---

## 🗂 ESTADO GERAL

| Aspecto | Status | Observação |
|---------|--------|------------|
| Build (`npm run build`) | ✅ PASSA | 20 chunks lazy loading, maior chunk 378KB (Recharts) |
| Lint (`eslint . --quiet`) | ✅ PASSA | 0 erros |
| TypeCheck (`tsc -p jsconfig.json`) | ✅ PASSA | 0 erros |
| Deploy (Render) | ✅ ONLINE | https://mrp-dashboard.onrender.com |
| Dados ao vivo | ⚠️ PRONTO / NÃO ATIVO | DATA_MODE=mock (serviços criados, `.env.local` pendente) |
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
| Fase 4 — Cálculos Python | ⏳ AGUARDA AUTORIZAÇÃO | — |

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

---

## 🏗 ARQUITETURA ATUAL (2026-04-12)

```
src/
  pages/          → 20 páginas roteadas (19 originais + Altcoins)
  components/
    ui/           → 40+ componentes Shadcn/Radix
    data/         → 15 arquivos mock (TEMPORÁRIO — eliminação gradual pela Fase 3)
    dashboard/    → 4 componentes
    derivatives/  → 2 componentes
    onchain/      → 1 componente
    options/      → 3 componentes
    ai/           → 1 componente AI
  hooks/
    use-mobile.jsx
    useBtcData.ts      ← Sprint 3.3
    useDeribit.ts      ← NOVO (Sprint 3.8)
    useFred.ts         ← NOVO (Sprint 3.8)
    useMempool.ts      ← NOVO (Sprint 3.8)
    useSupabase.ts     ← NOVO (Sprint 3.8)
  lib/
    env.ts             ← NOVO (Sprint 3.1)
    errorBoundary.tsx  ← NOVO (Sprint 3.1)
    AuthContext.jsx    (stub — ainda hardcoded)
    query-client.js    (atualizado Sprint 3.1)
    utils, app-params, notificationClient
  services/            ← CRIADO (Fase 3)
    binance.ts         ← Sprint 3.1
    coingecko.ts       ← Sprint 3.1
    alternative.ts     ← Sprint 3.1
    deribit.ts         ← Sprint 3.4
    fred.ts            ← Sprint 3.5
    mempool.ts         ← Sprint 3.6
    supabase.ts        ← Sprint 3.7
  utils/
    index.ts
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
| M2 | Páginas com sub-componentes | Sub-componentes usam module-level mock vars; live data ativo via cache, mas não renderizado | Fase 4 — prop-passing completo para sub-componentes |

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

### Aguarda Fase 4
- [ ] Script Python: Risk Score composto (BTC, funding, IV, on-chain)
- [ ] Script Python: VaR paramétrico vs histórico vs Monte Carlo
- [ ] Script Python: GEX/Dealer positioning formula validation
- [ ] Script Python: Macro Surprise Index

### Gaps de produto ainda presentes
- [ ] Spot Sessions Analytics — CVD intraday por sessão Ásia/Europa/EUA
- [ ] Crypto Institutional Upgrade — GEX live, cohort flow por exchange
- [ ] OnChain Cycle Pack — MVRV Z-score live, HODL Waves (requer Glassnode pago)
- [ ] Cross-venue microstructure — taker imbalance, funding/basis arbitrage
- [ ] Auth real — Supabase Auth (email ou OAuth) para proteger portfólio/alertas do usuário

---

## 📝 DECISÕES PENDENTES

1. **Glassnode/CryptoQuant** — autorizar integração paga para NUPL/MVRV/Netflow live?
2. **Fase 4** — Autorizar scripts Python de cálculo? (plano apresentado pelo conselho técnico)

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
