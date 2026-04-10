# CLAUDE.md — MRP Dashboard
> Arquivo de contexto mestre. Leia integralmente antes de qualquer ação.
> Projeto: MRP Dashboard (CryptoWatch Institutional)
> Stack: React, Tailwind, Lucide, Vite, Node.js (ESM), TypeScript, Zod.
> Repositório: https://github.com/mateusraony/mrp-dashboard
> Deploy: https://mrp-dashboard.onrender.com

---

## ⛔ REGRA DE OURO #0: VERIFICAÇÃO ANTES DE AFIRMAÇÃO
**"I trust no one, not even myself."**
Antes de declarar uma tarefa como "concluída", "corrigida" ou "pronta":
1. **Build Check:** O comando `npm run build` (ou equivalente) DEVE passar.
2. **Lint & Type Check:** `npx tsc --noEmit` não deve retornar erros.
3. **Evidência Real:** Você deve rodar o código/teste e ler o output. Proibido usar termos como "deve funcionar" ou "provavelmente".

---

## 🏗 CONTEXTO DO PROJETO

### O que é
Dashboard profissional de inteligência de mercado cripto (foco em Bitcoin). Painel analítico com dados de derivativos, on-chain, macro, sentimento, ETF flows, opções e automações.

### Regras absolutas de dados
- **ZERO mock data.** Nenhum arquivo mockData*.jsx deve ser mantido a longo prazo.
- **100% dados reais**, online, automático, tempo real.
- **ZERO dependência do Base44.** Foi removido completamente.
- Todo dado de mercado vem de APIs externas (Binance, CoinGecko, Alternative.me, CoinGlass, Deribit, FRED, etc.)
- Persistência de dados do usuário (alertas, portfólio, configurações) vai para **Supabase** (free tier).

### Arquitetura atual
```
src/
  pages/          → Páginas da aplicação (React)
  components/ui/  → Shadcn/Radix components
  components/data/→ TEMPORÁRIO — mock data (a ser eliminado)
  services/       → (a criar) — integrações com APIs reais
  api/            → base44Client.js (esvaziado, sem uso)
  lib/            → AuthContext, utils, query-client
```

---

## 🛠 SKILLS & WORKFLOW (Obrigatório)

### 1. Pensamento "Ultrathink"
Sempre que enfrentar um problema complexo, arquitetura nova ou bug persistente:
- Analise a causa raiz (Root Cause Analysis).
- Liste 3 abordagens possíveis antes de codar.
- Escolha a que menos quebra o código existente.

### 2. Automação GSD (Get Shit Done)
- `/gsd:plan-phase` → Antes de grandes mudanças.
- `/gsd:progress` → Para alinhar o que falta.
- `/checkpoint` → Ao final de cada tarefa relevante para atualizar o `CHECKPOINT.md`.

### 3. UI-UX Pro Max
Para qualquer componente visual:
- Use `lucide-react` para ícones (substituir todos os emojis da UI).
- Siga padrões de acessibilidade (Aria labels).
- Garanta responsividade (Mobile-first).
- Use os componentes Shadcn existentes em `src/components/ui/` (tabs, badge, skeleton, dialog, sheet, toast, progress).

---

## 🏗 PADRÕES DE DESENVOLVIMENTO (Core)

### Arquitetura & Código
- **TypeScript Strict:** Novos arquivos devem ser `.tsx`/`.ts`. Proibido `any`. Use `unknown` ou interfaces precisas.
- **Validação:** Todo input externo (API/Form) DEVE passar por um schema **Zod**.
- **Clean Code:** Funções pequenas, nomes descritivos em inglês, comentários explicativos em português.
- **Sem inline styles desnecessários:** Preferir classes Tailwind. Inline styles apenas para valores dinâmicos/calculados.

### Design System
- **Background:** `#070B14` (app), `#0A1220` (sidebar), `#0d1421` (cards)
- **Borders:** `#162032` (padrão), `#1e3048` (sutil)
- **Texto:** `#f1f5f9` (primário), `#94a3b8` (secundário), `#4a6580` (terciário)
- **Azul accent:** `#3b82f6` (ativo/destaque), `#60a5fa` (hover)
- **Verde:** `#10b981` (positivo/buy)
- **Vermelho:** `#ef4444` (negativo/sell/risco)
- **Amarelo:** `#f59e0b` (warning/neutro)
- **Fonte mono:** `JetBrains Mono, monospace` (números e dados)

### Estrutura de Páginas (após refactor)
```
VISÃO GERAL
  - Dashboard (Overview) — hero: Risk Score → AI summary → BTC/Macro compacto → Alertas
  - Regime de Mercado
  - Relatório Executivo

CRIPTO — MERCADO
  - Preditivo BTC (24h)
  - Derivatives (tabs: Overview | Avançado | Liquidações)
  - Spot Flow
  - Options
  - Fluxos Institucionais (tabs: ETFs | Stablecoins)
  - Altcoins (NOVO — dominância, rotação, BTC.D/ETH)

ON-CHAIN & MACRO
  - On-Chain
  - Macro Board
  - Mercados Globais
  - Calendário (MacroCalendar unificado)

INTELIGÊNCIA AI
  - Notícias (tabs: Institucional | Social/Sentimento)
  - Sentimento (MarketSentiment unificado)

AUTOMAÇÕES
  - Oportunidades (tabs: Setups/Ações | Performance)
  - Alertas & Regras (tabs: Feed | Configurar | Bots)
  - Configurações
```

### Fluxo Git & Commits
- **Commits Atômicos:** Uma funcionalidade/correção por commit.
- **Mensagens:** Padrão Conventional Commits (ex: `feat: add auth layer`, `fix: header overflow`).

---

## ⚡ COMANDOS DE VERIFICAÇÃO RÁPIDA

```bash
# Verificação Total
npm run build && npx tsc --noEmit

# Dev server
npm run dev

# Push após mudanças
git add -A && git commit -m "..." && git push
```

---

## 📋 CHECKPOINT
Ver `CHECKPOINT.md` na raiz para estado atual e próximos passos.

---

## 🧠 MEMÓRIA VIVA — PROTOCOLO FASE 1 (2026-04-10)

### Instrução fixa do usuário (copiada literalmente)
"siga exatamente sempre o que te instrui no começo do programa NUNCA SAIA DO QUE ESTA LA E FAÇA EXATAMENTE O QUE TE PEDIR, se tiver duvida ou coisa do tipo me pergunte e de a melhor opção."

### Status de execução atual
- Fase ativa: **FASE 1 — Análise profunda e diagnóstico**.
- Sem API real nesta fase.
- Mocks permanecem válidos nesta etapa.
- Cálculos só entram no sistema principal após validação isolada em Python.
