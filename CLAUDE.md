# CLAUDE.md — MRP Dashboard
> Arquivo de contexto mestre. Leia integralmente antes de qualquer ação.
> Projeto: MRP Dashboard (CryptoWatch Institutional)
> Stack: React, Tailwind, Lucide, Vite, Node.js (ESM), TypeScript, Zod.
> Repositório: https://github.com/mateusraony/mrp-dashboard
> Deploy: https://mrp-dashboard.onrender.com
> Última atualização: 2026-04-14

---

## ⛔ REGRA DE OURO #0: VERIFICAÇÃO ANTES DE AFIRMAÇÃO
**"I trust no one, not even myself."**
Antes de declarar uma tarefa como "concluída", "corrigida" ou "pronta":
1. **Build Check:** O comando `npm run build` deve passar sem erros.
2. **Lint & Type Check:** `npx eslint . --quiet` e `npx tsc -p ./jsconfig.json` não devem retornar erros.
3. **Evidência Real:** Proibido usar termos como "deve funcionar" ou "provavelmente".
4. **Diferenciação obrigatória:** Sempre diferenciar o que está confirmado, mockado, ausente ou quebrado.

---

## 🏗 CONTEXTO DO PROJETO

### O que é
Dashboard profissional de inteligência de mercado cripto (foco em Bitcoin). Painel analítico com dados de derivativos, on-chain, macro, sentimento, ETF flows, opções e automações. Foco institucional.

### Regras absolutas de dados
- **ZERO mock data** a longo prazo. Os 14 arquivos `mockData*.jsx` são temporários.
- **100% dados reais**, online, automático, tempo real.
- **ZERO dependência do Base44.** Foi removido. Resíduos identificados em `index.html` e `app-params.js`.
- Todo dado de mercado vem de APIs externas (Binance, CoinGecko, Alternative.me, CoinGlass, Deribit, FRED, etc.)
- Persistência de dados do usuário (alertas, portfólio, configurações) vai para **Supabase** (free tier).

### Arquitetura atual (estado real — 2026-04-13)
```
src/
  pages/          → 20 páginas roteadas
  components/
    ui/           → 40+ componentes Shadcn/Radix + DataQualityBadge (NOVO Sprint 6.2)
    data/         → 15 arquivos mock (TEMPORÁRIO — eliminação gradual)
    dashboard/    → 4 componentes
    derivatives/  → 2 componentes
    onchain/      → 1 componente
    options/      → 3 componentes
    ai/           → 1 componente AI
  hooks/
    useBtcData.ts       ← 7 hooks (ticker, klines, liquidações, etc.)
    useCoinMetrics.ts   ← useOnChainCycle + useOnChainExtended (NOVO Sprint 6.1)
    useDeribit.ts       ← options IV, term structure
    useFred.ts          ← macro yields + useGlobalLiquidity (NOVO Sprint 6.2)
    useMempool.ts       ← hashrate, fees, mempool
    useMultiVenue.ts    ← Bybit/OKX snapshot + divergência
    useRiskScore.ts     ← Risk Score composto
    useSupabase.ts      ← alertas, portfólio, settings
  services/
    alternative.ts, binance.ts, bybit.ts, coingecko.ts,
    coinmetrics.ts (CDD/Dormancy/HODL proxy — NOVO Sprint 6.1),
    deribit.ts, fred.ts (Global Liquidity — NOVO Sprint 6.2),
    mempool.ts, okx.ts, supabase.ts
  utils/
    index.ts, riskCalculations.ts, sessionAnalytics.ts
  lib/
    env.ts, errorBoundary.tsx, AuthContext.jsx (stub anônimo)
    query-client.js, app-params.js, notificationClient.js
  __tests__/
    utils/sessionAnalytics.test.ts   ← 15 testes
    services/coinmetrics.test.ts      ← 10 testes
scripts/
  validate_var.py, validate_risk_score.py, validate_gex.py,
  validate_macro_surprise.py, validate_mvrv_zscore.py
supabase/migrations/20260412000000_create_core_tables.sql
vitest.config.ts
.env.local (criado com credenciais reais — ignorado pelo git)
```

---

## 👥 CONSELHO TÉCNICO — 5 ESPECIALISTAS

### Instrução fixa do usuário
"siga exatamente sempre o que te instrui no começo do programa NUNCA SAIA DO QUE ESTA LA E FAÇA EXATAMENTE O QUE TE PEDIR, se tiver duvida ou coisa do tipo me pergunte e de a melhor opção."

### 1. Líder do Projeto (Líder)
- Orquestra o fluxo e garante objetivos de negócio.
- Resume consenso técnico e toma decisão final sem conflito.
- Se houver divergência: resume os caminhos e pede decisão do usuário.
- Impede saída de escopo. Garante que nenhuma fase seja pulada.
- Skills: writing-plans, dispatching-parallel-agents, brainstorming, ralph loop, xquads-squads.

### 2. Arquiteto de Sistemas (Sistemas)
- Infraestrutura, escalabilidade, arquitetura geral.
- Integração Supabase, deploy Render, riscos de build/runtime/observabilidade.
- Skills: systematic-debugging, security guidance, hookify, code review, pr review toolkit.

### 3. Especialista em APIs e Integrações (API)
- Comunicação entre sistemas, estrutura da API, contratos e payloads.
- Antes de qualquer API real: valida o fluxo com mocks.
- Skills: code review, systematic-debugging, security guidance, verification-before-completion.

### 4. Lead UI/UX Designer (Design)
- Estética, acessibilidade, alinhamento visual, experiência do usuário.
- Aplica ui-ux-pro-max em toda construção visual.
- Responsividade e validação funcional antes de avançar para lógica.
- Skills: ui-ux-pro-max, Design System, visualization-expert, code review.

### 5. Engenheiro de QA e Lógica/Cálculos (QA)
- Erros, falhas, causa raiz, precisão matemática.
- Para toda fórmula: cria script Python isolado antes de qualquer implementação no sistema.
- Skills: test-driven-development, systematic-debugging, security guidance, verification-before-completion.

---

## 🛠 SKILLS & WORKFLOW (Obrigatório)

### Skills Nativas do Claude Code (sempre ativas)
- writing-plans, dispatching-parallel-agents, verification-before-completion
- ui-ux-pro-max, brainstorming, systematic-debugging
- test-driven-development, requesting-code-review
- Pensamento estendido em problemas complexos de API, cálculo, arquitetura, segurança ou fluxo.

### Skills/Toolkits Adicionais (usar quando disponíveis e válidos)
- visualization-expert: sempre que houver análise de layout, fluxo visual, dashboard, hierarquia.
- code review: sempre que houver revisão técnica de alteração, risco, estilo, consistência.
- pr review toolkit: sempre que houver revisão de mudanças agrupadas ou risco de regressão.
- security guidance: sempre que houver auth, secrets, env, APIs, storage, permissões.
- hookify: sempre que houver oportunidade de automatizar verificações por hooks.
- ralph loop / ralph: execução iterativa por fases, checkpoints, validação incremental.
- claude-code-usage-monitor: risco de desperdício de contexto ou loops excessivos.
- xquads-squads: dividir trabalho em subtarefas sem perder controle do Líder.

### Automação GSD
- `/gsd:plan-phase` → Antes de grandes mudanças.
- `/gsd:progress` → Para alinhar o que falta.
- `/checkpoint` → Ao final de cada tarefa relevante para atualizar o `CHECKPOINT.md`.

---

## 🚦 FASES DE EXECUÇÃO

### FASE 1 — Análise Profunda e Diagnóstico ✅ (em execução)
- Apenas leitura, inspeção e diagnóstico.
- Nenhum código de funcionalidade.
- Exceção: atualizar CLAUDE.md e CHECKPOINT.md.
- Entregar análise estruturada com: executivo, arquitetura, gaps, riscos, design, dados externos, checkpoint zero.

### FASE 2 — Interface, Visualização e Validação Visual (aguarda autorização)
- Estruturar layout, alinhar textos, revisar design, garantir responsividade.
- Aplicar ui-ux-pro-max. Validar visual antes de qualquer lógica.
- Não avançar para lógica ainda.

### FASE 3 — Estrutura da API com Mocks (aguarda autorização)
- Criar src/services/ com clientes para cada fonte.
- Usar dados fictícios primeiro para testar o fluxo.
- Cada API com: contrato, payload de exemplo, regra de erro, fallback, validação, risco.
- Não conectar API real sem validação aprovada.

### FASE 4 — Script Python de Cálculos (aguarda autorização)
- Validar toda lógica matemática em Python isolado antes de entrar no sistema.
- Cada cálculo com: fórmula, variável, unidade, borda, risco, estratégia de validação.

---

## 🏗 PADRÕES DE DESENVOLVIMENTO (Core)

### Arquitetura & Código
- **TypeScript Strict:** Novos arquivos devem ser `.tsx`/`.ts`. Proibido `any`. Use `unknown` ou interfaces precisas.
- **Validação:** Todo input externo (API/Form) DEVE passar por um schema **Zod**.
- **Clean Code:** Funções pequenas, nomes descritivos em inglês, comentários em português.
- **Sem inline styles desnecessários:** Preferir classes Tailwind. Inline styles apenas para valores dinâmicos.

### Design System
- **Background:** `#070B14` (app), `#0A1220` (sidebar), `#0d1421` (cards)
- **Borders:** `#162032` (padrão), `#1e3048` (sutil)
- **Texto:** `#f1f5f9` (primário), `#94a3b8` (secundário), `#4a6580` (terciário)
- **Azul accent:** `#3b82f6` (ativo/destaque), `#60a5fa` (hover)
- **Verde:** `#10b981` (positivo/buy)
- **Vermelho:** `#ef4444` (negativo/sell/risco)
- **Amarelo:** `#f59e0b` (warning/neutro)
- **Fonte mono:** `JetBrains Mono, monospace` (números e dados)

### Estrutura de Páginas (target após refactor)
```
VISÃO GERAL
  - Dashboard (Overview) — hero: Risk Score → AI summary → BTC/Macro compacto → Alertas
  - Regime de Mercado
  - Relatório Executivo

CRIPTO — MERCADO
  - Preditivo BTC (24h)
  - Derivatives (tabs: Overview | Avançado | Liquidações)
  - Spot Flow (+ sessões Ásia/Europa/EUA — GAP IDENTIFICADO)
  - Options (+ GEX/Dealer positioning — GAP IDENTIFICADO)
  - Fluxos Institucionais (tabs: ETFs | Stablecoins)
  - Altcoins (NOVO — dominância, rotação, BTC.D/ETH — AINDA NÃO EXISTE)

ON-CHAIN & MACRO
  - On-Chain (+ MVRV Z-score, HODL Waves, CDD, Dormancy — GAP IDENTIFICADO)
  - Macro Board (+ Surpresa vs Consenso — GAP IDENTIFICADO)
  - Mercados Globais
  - Calendário (MacroCalendar unificado)

INTELIGÊNCIA AI
  - Notícias (tabs: Institucional | Social/Sentimento)
  - Sentimento (MarketSentiment unificado)

AUTOMAÇÕES
  - Oportunidades (tabs: Setups/Ações | Performance)
  - Alertas & Regras (tabs: Feed | Configurar | Bots)
  - Portfolio (+ VaR, Sharpe, Max Drawdown, Beta vs BTC — GAP IDENTIFICADO)
  - Configurações
```

### Fluxo Git & Commits
- **Commits Atômicos:** Uma funcionalidade/correção por commit.
- **Mensagens:** Padrão Conventional Commits (ex: `feat: add auth layer`, `fix: header overflow`).
- **Branch de desenvolvimento:** `claude/setup-agora-integration-4KNuk`

---

## 🔍 GAPS PRIORITÁRIOS — STATUS ATUAL (2026-04-13)

### Implementados (Sprints 1–6.2):
1. ✅ **Portfolio Risk Pack Institucional** — VaR, Sharpe, Max Drawdown, Beta vs BTC (Sprint 2).
2. ✅ **Spot Sessions Analytics** — Ásia/Europa/EUA com CVD/vol/agressão por sessão (Sprint 5.4).
3. ✅ **Macro Surprise Layer** — actual vs consensus vs z-score no calendário macro (Sprint 4.4).
4. ✅ **Altcoins Page** — dominância BTC/ETH, rotação, BTC.D/ETH (Sprint 2).
5. ✅ **Cross-venue snapshot** — Binance | Bybit | OKX divergência de funding em bps (Sprint 5.5).
6. ✅ **OnChain Cycle Pack** — MVRV Z-score, NUPL, Realized Price, NVT (Sprint 5.2).
7. ✅ **CDD + Dormancy + HODL Waves** — proxy via CoinMetrics Community (Sprint 6.1).
8. ✅ **Global Liquidity** — Fed BS/RRP/TGA Net Liquidity, Real Yield, Term Premium, DXY (Sprint 6.2).
9. ✅ **BCB Layer** — SELIC, IPCA, USDBRL via BCB OpenData (Sprint 6.2b).
10. ✅ **Charm/Vanna/GEX Dealer Flow** — Black-Scholes 2ª derivada + DealerFlowPanel + 27 testes (Sprint 6.4).
11. ✅ **Governance Pack** — Alert audit feed, threshold history, data lineage (Sprint 6.5).
12. ✅ **Testes ≥45** — 52/52 testes (Sprint 6.7 antecipado).

### Pendentes (próxima sessão):
- ~~**HODL Waves visual avançado**~~ ✅ CONCLUÍDO (Sprint 6.3) — HodlWavesPanel + CDD ComposedChart + AreaChart supply.
- [ ] **Telegram Digest** — Edge Function + pg_cron BLOQUEADO aguarda Bot Token do usuário (Sprint 6.6).
- ~~**Migration Supabase** — tabelas `alert_events` + `threshold_history`~~ ✅ APLICADA via MCP.
- ~~[ ] **Bundle split** — Recharts 378KB → `manualChunks` vite.config.js.~~ ✅ RESOLVIDO

---

## ⚠️ DÍVIDA TÉCNICA — STATUS ATUAL (2026-04-13)

| Item | Arquivo | Severidade | Status |
|------|---------|------------|--------|
| Base44 favicon URL | index.html | Baixa | Pendente |
| Base44 app_id param | src/lib/app-params.js | Baixa | Pendente |
| useLocation não usado | src/Layout.jsx:2 | Baixa | Pendente |
| Lint warnings residuais | múltiplos arquivos | Baixa | Monitorar |
| ~~Bundle grande (Recharts 378KB)~~ | vite.config.js | ~~Média~~ | ✅ RESOLVIDO — index.js 284KB→90KB |
| Auth stub anônimo | src/lib/AuthContext.jsx | Alta | Aguarda Supabase Auth |
| ~~services/ não existe~~ | src/services/ | ~~Crítica~~ | ✅ RESOLVIDO (Sprint 3) |
| ~~Supabase não instalado~~ | package.json | ~~Crítica~~ | ✅ RESOLVIDO (Sprint 3) |
| ~~Zero testes~~ | projeto todo | ~~Alta~~ | ✅ 25 testes (Sprint 5.6) |
| ~~.env.local ausente~~ | — | ~~Alta~~ | ✅ Criado com credenciais reais |
| Cobertura de testes baixa | 25 testes apenas | Alta | Ampliar Sprint 6.7 |
| Telegram Bot Token | Edge Function pronta | Alta | BLOQUEADO — usuário deve criar bot |
| Stripe instalado sem uso | package.json | Baixa | Avaliar |

---

## ⚡ COMANDOS DE VERIFICAÇÃO RÁPIDA

```bash
# Verificação Total
npm run build && npx tsc -p ./jsconfig.json

# Lint
npx eslint . --quiet

# Dev server
npm run dev

# Push após mudanças
git add -A && git commit -m "..." && git push -u origin claude/setup-agora-integration-4KNuk
```

---

## 📋 CHECKPOINT
Ver `CHECKPOINT.md` na raiz para estado atual e próximos passos.

---

## 🧠 MEMÓRIA VIVA — STATUS DE FASES

| Fase | Status | Data |
|------|--------|------|
| Fase 1 — Análise Profunda | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 2 — Interface/Visual (Sprints 1+2) | ✅ CONCLUÍDA | 2026-04-11 |
| Fase 3 — API + Hooks + Settings (Sprints 3.1–3.9) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 4 — Cálculos Python + Wiring (Sprints 4.1–4.5) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 5 — APIs Gratuitas + Testes (Sprints 5.1–5.6) | ✅ CONCLUÍDA | 2026-04-12 |
| Fase 6 — Expansão OnChain/Macro/Governance | 🔄 EM EXECUÇÃO | 2026-04-13 |

### Fase 6 — Sub-sprints

| Sprint | Status | Descrição |
|--------|--------|-----------|
| 6.1 | ✅ CONCLUÍDO | CoinMetrics CDD + Dormancy + HODL Waves proxy |
| 6.2 | ✅ CONCLUÍDO | Global Liquidity (FRED) + DataQualityBadge |
| 6.2b | ✅ CONCLUÍDO | BCB Layer — SELIC/IPCA/USDBRL via BCB OpenData |
| 6.3 | ✅ CONCLUÍDO | HODL Waves visual avançado + CDD histórico completo |
| 6.4 | ✅ CONCLUÍDO | Charm/Vanna/GEX dealer flow (Black-Scholes 2ª deriv.) |
| 6.5 | ✅ CONCLUÍDO | Governance — audit feed, threshold history, data lineage |
| 6.6 | 🔴 BLOQUEADO | Telegram digest — aguarda Bot Token (@BotFather) |
| 6.7 | ✅ ANTECIPADO | Varredura: build ✅ + tsc ✅ + lint ✅ + 52 testes ✅ |
| Bundle split | ✅ CONCLUÍDO | index.js 284KB→90KB, recharts/supabase chunks isolados |
| Migration | ✅ APLICADA | alert_events + threshold_history no Supabase com RLS |

### Instrução permanente
Antes de qualquer avanço estrutural fora da fase atual → apresentar debate dos especialistas e pedir autorização.
