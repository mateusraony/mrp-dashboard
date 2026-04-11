# CLAUDE.md — MRP Dashboard
> Arquivo de contexto mestre. Leia integralmente antes de qualquer ação.
> Projeto: MRP Dashboard (CryptoWatch Institutional)
> Stack: React, Tailwind, Lucide, Vite, Node.js (ESM), TypeScript, Zod.
> Repositório: https://github.com/mateusraony/mrp-dashboard
> Deploy: https://mrp-dashboard.onrender.com
> Última atualização: 2026-04-11

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

### Arquitetura atual (estado real — 2026-04-11)
```
src/
  pages/          → 31 arquivos de página (19 roteados, 12 órfãos/legados)
  components/ui/  → 40+ componentes Shadcn/Radix (prontos)
  components/data/→ 14 arquivos de mock data (TEMPORÁRIO — a ser eliminado)
  components/dashboard/ → 4 componentes de dashboard
  components/derivatives/ → 2 componentes
  components/onchain/ → 1 componente
  components/options/ → 3 componentes
  components/ai/ → 1 componente AI
  hooks/          → use-mobile.jsx
  lib/            → AuthContext (stub), utils, query-client, app-params, notificationClient
  utils/          → index.ts (createPageUrl)
  api/            → (vazio/excluído do jsconfig)
  services/       → NÃO EXISTE (a criar na Fase 3)
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

## 🔍 GAPS PRIORITÁRIOS IDENTIFICADOS (Fase 1)

### Implementar (ordem de prioridade):
1. **Portfolio Risk Pack Institucional** — VaR, Sharpe, Max Drawdown, Beta vs BTC. Impacto: muito alto | Complexidade: média.
2. **Spot Sessions Analytics** — Quebrar SpotFlow por sessões Ásia/Europa/EUA com CVD/vol/agressão por sessão. Impacto: alto.
3. **Macro Surprise Layer** — actual vs consensus vs reação histórica no calendário macro. Impacto: alto para timing tático.
4. **Altcoins Page** — dominância BTC/ETH, rotação de capital, alts season index. (página nova, não existe).
5. **Crypto Institutional Upgrade** — GEX/Dealer positioning, cohort flow por exchange, microstructure cross-venue. Impacto: altíssimo, complexidade alta.
6. **OnChain Cycle Pack** — MVRV Z-score, Realized Cap HODL Waves, Coin Days Destroyed, dormancy flow.

---

## ⚠️ DÍVIDA TÉCNICA IDENTIFICADA (Fase 1)

| Item | Arquivo | Severidade | Status |
|------|---------|------------|--------|
| Base44 favicon URL | index.html | Baixa | Pendente |
| Base44 app_id param | src/lib/app-params.js | Baixa | Pendente |
| useLocation não usado | src/Layout.jsx:2 | Baixa | Pendente |
| 17 erros de lint (unused imports) | 8 arquivos | Média | Pendente |
| 17+ erros de typecheck | 12 arquivos | Alta | Pendente |
| Bundle único 1.35MB | vite.config.js | Alta | Pendente |
| Auth stub hardcoded | src/lib/AuthContext.jsx | Alta | Pré-Fase 3 |
| services/ não existe | src/services/ | Crítica | Criar na Fase 3 |
| Supabase não instalado | package.json | Crítica | Pré-Fase 3 |
| Preço BTC hardcoded no topbar | src/Layout.jsx:265 | Média | Fase 2/3 |
| Emojis no nav (não Lucide) | src/Layout.jsx | Média | Fase 2 |
| Stripe instalado sem uso aparente | package.json | Baixa | Avaliar |
| ErrorBoundary ausente | App.jsx | Alta | Pré-produção |
| Zero testes | projeto todo | Alta | Fase 4+ |
| 12 arquivos de página órfãos | src/pages/ | Média | Fase 2 |

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

| Fase | Status | Autorização |
|------|--------|-------------|
| Fase 1 — Análise Profunda | EM EXECUÇÃO | ✅ Autorizada |
| Fase 2 — Interface/Visual | PENDENTE | Aguarda usuário |
| Fase 3 — API com Mocks | PENDENTE | Aguarda usuário |
| Fase 4 — Script Python | PENDENTE | Aguarda usuário |

### Instrução permanente
Antes de qualquer avanço estrutural fora da fase atual → apresentar debate dos especialistas e pedir autorização.
