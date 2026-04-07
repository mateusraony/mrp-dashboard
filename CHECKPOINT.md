# CHECKPOINT.md — MRP Dashboard
> Atualizado em: 2026-04-06

---

## ✅ Concluído
- [x] Base44 removido completamente (SDK, plugin, auth, variáveis de ambiente)
- [x] Build funcionando (`npm run build` passa)
- [x] Repositório GitHub criado: https://github.com/mateusraony/mrp-dashboard
- [x] Deploy no Render: https://mrp-dashboard.onrender.com
- [x] CLAUDE.md criado com regras do projeto
- [x] Análise completa do projeto (2 agentes: financeiro + UX)

---

## 🔄 Em progresso
- [ ] Merges de páginas duplicadas
- [ ] Redesign visual completo (Dashboard + Layout + todas as páginas)
- [ ] Nova estrutura de navegação (20 → 13 itens)

---

## 📋 Próximos passos (ordem de execução)

### FASE 1 — Merges estruturais (eliminar duplicidade)
- [ ] Merge: Alerts → SmartAlerts (abas: Feed | Histórico | Configurar)
- [ ] Merge: SentimentSocial → MarketSentiment (conteúdo único absorvido)
- [ ] Merge: Calendar → MacroCalendar (MacroCalendar absorve)
- [ ] Merge: News → NewsIntelligence (NewsIntelligence vira "Notícias")
- [ ] Merge: Derivatives + DerivativesAdvanced → Derivatives (abas: Overview | Avançado | Liquidações)
- [ ] Merge: ETFFlows + StablecoinFlow → InstitutionalFlows (abas: ETFs | Stablecoins)
- [ ] Merge: Automations + BotAutomations → Automations (abas: Regras | Bots | Log)
- [ ] Merge: ActionDashboard + Strategies → Opportunities (abas: Setups | Performance)
- [ ] Deletar arquivos originais após merges
- [ ] Atualizar pages.config.js
- [ ] Atualizar Layout.jsx (nova estrutura de nav)

### FASE 2 — Redesign visual
- [ ] Dashboard: redesign completo (hero Risk Score → AI summary → dados compactos)
- [ ] Layout/Sidebar: Lucide icons, nova estrutura de grupos
- [ ] Todas as páginas: migrar emojis → Lucide icons
- [ ] Implementar skeleton loaders (Shadcn skeleton.jsx)
- [ ] Implementar toast feedback para ações do usuário
- [ ] Unificar badges via Shadcn badge.jsx
- [ ] Adicionar filtro de timeframe global

### FASE 3 — Novas features financeiras
- [ ] NOVO: Página Altcoins (dominância BTC/ETH, rotação de capital, alts season)
- [ ] Portfolio: adicionar VaR, Sharpe ratio, drawdown, beta vs BTC
- [ ] Análise de sessões (Ásia/Europa/EUA) em SpotFlow
- [ ] MacroCalendar: filtro por Tier de evento

### FASE 4 — APIs reais (substituir mock data)
Ver `memory/checkpoint_api_plan.md` para mapa completo de APIs por página.
- APIs prioritárias: Binance (público), CoinGecko (público), Alternative.me (público)
- Persistência: Supabase (alertas, portfólio, configurações)

---

## 🗂 Arquivos importantes
- `src/pages/` — todas as páginas da aplicação
- `src/components/data/mockData*.jsx` — dados temporários a eliminar
- `src/components/ui/` — Shadcn components disponíveis
- `src/Layout.jsx` — navegação principal
- `src/pages.config.js` — registro de rotas
