# CHECKPOINT.md — MRP Dashboard
> Memória técnica viva do projeto. Atualizar ao final de cada bloco importante.
> Última atualização: 2026-04-11 (Fase 1 — Análise Profunda Completa)

---

## 🗂 ESTADO GERAL

| Aspecto | Status | Observação |
|---------|--------|------------|
| Build (`npm run build`) | ✅ PASSA | Bundle único 1.35MB — warning de chunk size |
| Lint (`eslint . --quiet`) | ❌ FALHA | 17 erros em 8 arquivos (unused imports) |
| TypeCheck (`tsc -p jsconfig.json`) | ❌ FALHA | 17+ erros em 12 arquivos |
| Deploy (Render) | ✅ ONLINE | https://mrp-dashboard.onrender.com |
| Dados ao vivo | ❌ NENHUM | 100% mock data |
| Auth real | ❌ AUSENTE | Stub hardcoded (isAuthenticated: true) |
| Supabase | ❌ NÃO INSTALADO | Apenas mencionado em Settings UI |
| Serviços externos | ❌ ZERO | Nenhuma chamada HTTP/fetch real |

---

## ✅ O QUE FOI CONCLUÍDO

- [x] Base44 SDK removido completamente do runtime
- [x] Build funcionando (`npm run build` passa)
- [x] Repositório GitHub criado: https://github.com/mateusraony/mrp-dashboard
- [x] Deploy no Render: https://mrp-dashboard.onrender.com
- [x] CLAUDE.md criado com regras do projeto
- [x] Remoção de referências Base44 em runtime
- [x] Criação de fallback `notificationClient`
- [x] Ajuste de parâmetros legados (`app_*`, `VITE_APP_*`)
- [x] Merge de páginas duplicadas (pages.config.js atualizado com 19 páginas)
- [x] Redesign de navegação (5 grupos + settings, emojis ainda presentes)
- [x] **FASE 1 — Análise Profunda Completa** (2026-04-11)

---

## 🔄 EM PROGRESSO

- [ ] Fase 1: Atualização de CLAUDE.md e CHECKPOINT.md com memória técnica (em andamento)

---

## 🗺 MAPA COMPLETO DO PROJETO (Estado Real — 2026-04-11)

### Arquivos de Página (31 total)
**19 ROTEADOS** (em `pages.config.js`):
- Dashboard, DerivativesPage (wrapper), InstitutionalFlows (wrapper), Opportunities (wrapper)
- AutomationsPage (wrapper), Macro, OnChain, Options, Settings
- SpotFlow, NewsIntelligence, Portfolio, SmartAlerts, MarketRegime
- PredictivePanel, ExecutiveReport, MacroCalendar, MarketSentiment, GlobalMarkets

**12 ÓRFÃOS** (em `src/pages/` mas fora do `pages.config.js`):
- ActionDashboard.jsx (21KB) — conteúdo possivelmente dentro de Opportunities wrapper
- Alerts.jsx (8.6KB) — conteúdo possivelmente dentro de SmartAlerts
- Automations.jsx (28KB) — conteúdo possivelmente dentro de AutomationsPage wrapper
- BotAutomations.jsx (28KB) — conteúdo possivelmente dentro de AutomationsPage wrapper
- Calendar.jsx (23KB) — substituído por MacroCalendar
- DerivativesAdvanced.jsx (31KB) — possivelmente dentro de DerivativesPage wrapper
- Derivatives.jsx (20KB) — possivelmente dentro de DerivativesPage wrapper
- ETFFlows.jsx (13KB) — possivelmente dentro de InstitutionalFlows wrapper
- News.jsx (6.9KB) — substituído por NewsIntelligence
- SentimentSocial.jsx (24KB) — substituído por MarketSentiment
- StablecoinFlow.jsx — possivelmente dentro de InstitutionalFlows wrapper
- Strategies.jsx (21KB) — possivelmente dentro de Opportunities wrapper

**AÇÃO PENDENTE:** Confirmar quais órfãos são importados dentro dos wrappers vs. quais são realmente dead code. Só executar remoção com autorização.

### Mock Data (14 arquivos — 100% dos dados)
```
src/components/data/
  mockData.jsx              — Principal (BTC futures, spot, sourceHealth, THRESHOLDS)
  mockDataActionDashboard.jsx
  mockDataAlerts.jsx
  mockDataAutomations.jsx
  mockDataExtended.jsx
  mockDataGlobalMarkets.jsx
  mockDataMacroCalendar.jsx
  mockDataNews.jsx
  mockDataPortfolio.jsx
  mockDataPredictive.jsx
  mockDataRegime.jsx
  mockDataSentiment.jsx
  mockDataStablecoin.jsx
  mockDataStrategies.jsx
```

---

## 🔴 PROBLEMAS CONFIRMADOS NO CÓDIGO

### CRÍTICOS
| # | Arquivo | Problema | Causa Raiz | Impacto |
|---|---------|---------|------------|---------|
| C1 | `src/services/` (inexistente) | Camada de serviços ausente | Não criada | Sem integração real possível |
| C2 | `package.json` | `@supabase/supabase-js` não instalado | Nunca adicionado | Sem persistência real |
| C3 | `src/lib/AuthContext.jsx` | Auth stub, `isAuthenticated: true` hardcoded | Legado Base44 | Qualquer usuário acessa tudo |
| C4 | `src/App.jsx` | Sem ErrorBoundary global | Nunca implementado | Crash sem tratamento |

### ALTA SEVERIDADE
| # | Arquivo | Problema | Causa Raiz | Impacto |
|---|---------|---------|------------|---------|
| A1 | `vite.config.js` | Bundle único de 1.35MB | Sem code splitting/lazy loading | Performance no primeiro load |
| A2 | 12 arquivos | TypeCheck falha (17+ erros) | Props faltando, tipos incorretos em Recharts tooltips | Type safety comprometida |
| A3 | `src/Layout.jsx:265` | Preço BTC hardcoded (`$84,312 +2.15%`) | Não conectado nem ao mock data | Dado completamente estático |
| A4 | Projeto inteiro | Zero testes | Nunca implementados | Sem rede de segurança para refactoring |

### MÉDIA SEVERIDADE
| # | Arquivo | Problema | Causa Raiz | Impacto |
|---|---------|---------|------------|---------|
| M1 | 8 arquivos | Lint falha (17 erros de unused imports) | Imports não limpos | Qualidade de código |
| M2 | `src/Layout.jsx` | Emojis como ícones de navegação | CLAUDE.md exige Lucide | Inconsistência com design system |
| M3 | `src/Layout.jsx:2` | `useLocation` importado mas nunca usado | Import esquecido | Contribui para falha de lint |
| M4 | `src/pages/` | 12 arquivos órfãos | Merges incompletos | Bundle inflado, confusão estrutural |
| M5 | `package.json` | Stripe instalado sem uso aparente | Legado ou futuro não implementado | Dependência desnecessária no bundle |

### BAIXA SEVERIDADE
| # | Arquivo | Problema | Causa Raiz | Impacto |
|---|---------|---------|------------|---------|
| B1 | `index.html:5` | Favicon aponta para `base44.com/logo_v2.svg` | Nunca trocado | Referência CDN externa de ex-plataforma |
| B2 | `src/lib/app-params.js` | Parâmetros `app_id`, `VITE_APP_*` legados | Nunca removidos | Confusão de config |
| B3 | `package.json` | `moment` + `date-fns` instalados juntos | Duplicidade de biblioteca de datas | 70KB a mais no bundle |
| B4 | `src/lib/query-client.js` | TanStack Query configurado mas sem queries | Infraestrutura pronta, não usada | Não é bug, mas peso morto |

---

## 🟡 O QUE ESTÁ MOCKADO (100% dos dados de mercado)

- Preço, funding rate, OI, long/short ratio do BTC
- Fear & Greed Index
- Liquidações, basis, IV, skew, term structure
- NUPL, MVRV, whale netflow, on-chain metrics
- S&P 500, DXY, yields, inflação (tudo FRED mock)
- FX rates, commodities, bancos centrais
- Notícias, sentimento, word cloud
- Alertas, automações, strategies, portfolio Greeks
- Calendar de eventos macro
- sourceHealth (tracking de fontes "ao vivo" completamente simulado)
- **Preço BTC no topbar: hardcoded no Layout.jsx (não usa nem o mock data)**

---

## 🔵 O QUE ESTÁ AUSENTE (Não existe no código)

- `src/services/` — camada de integração com APIs externas
- `@supabase/supabase-js` — cliente Supabase
- Auth real — qualquer provider (Supabase Auth, Auth0, etc.)
- Schemas Zod para validação de responses de API
- Testes (nenhum arquivo `.test.` ou `.spec.` encontrado)
- ErrorBoundary global
- Lazy loading / code splitting
- Variáveis de ambiente (`.env` file não encontrado)
- Página **Altcoins** (mencionada no CLAUDE.md, nunca criada)
- **Portfolio:** VaR, Sharpe Ratio, Max Drawdown, Beta vs BTC (apenas Greeks/stress mock)
- **Spot Flow:** Análise por sessão (Ásia/Europa/EUA)
- **Macro:** Surpresa vs Consenso + reação histórica estatística
- **Options:** GEX/Dealer positioning (Gamma Exposure, Max Pain dinâmico, charm/vanna)
- **OnChain:** MVRV Z-score, Realized Cap HODL Waves, Coin Days Destroyed, Dormancy Flow
- **Cross-venue:** Taker imbalance por exchange, funding/basis arbitrage spread
- **Governança:** Data lineage, replay de sinais, policy de fallback por fonte

---

## 📊 GAPS PRIORITÁRIOS (Por Horizonte Temporal)

### Diário (impacto imediato no uso)
- [ ] Microstructure: perp/options dealer flow por exchange
- [ ] Flows por cohort (whale, miner, ETF custodian, market maker)
- [ ] Surpresa macro do dia vs consenso

### Semanal (rotação de posições)
- [ ] Rotação de fluxo (ETF/stablecoin/cohorts)
- [ ] Correlação dinâmica de risco cross-asset
- [ ] Liquidez global (Fed balance sheet, RRP, TGA, dólar offshore)

### Mensal (leitura de ciclo)
- [ ] Métricas de ciclo onchain: MVRV Z-score, HODL Waves
- [ ] Regime macro completo
- [ ] Real yields + term premium completo (2s10s, 3m10y, breakevens)

### Anual (framework de ciclo)
- [ ] Stress tests completos
- [ ] Governança + auditoria (data lineage, replay de sinal)
- [ ] Framework de ciclo BTC completo

---

## 📋 PRÓXIMOS PASSOS (Ordem de Implementação Sugerida)

### Pendentes de Autorização do Usuário

**FASE 2 — Interface/Visual:**
- [ ] Substituir emojis de navegação por Lucide icons (Layout.jsx)
- [ ] Corrigir 17 erros de lint
- [ ] Corrigir 17+ erros de typecheck
- [ ] Implementar lazy loading nas rotas (code splitting)
- [ ] Criar página Altcoins (nova)
- [ ] Confirmar e limpar 12 arquivos órfãos de páginas
- [ ] Conectar BTC ticker do topbar ao mock data (não hardcoded)
- [ ] Remover Base44 favicon (trocar por ícone próprio)
- [ ] Limpar `app-params.js` de params legados

**FASE 3 — API com Mocks (estrutura):**
- [ ] Criar `src/services/` com clients para: Binance, CoinGecko, Alternative.me, Deribit, FRED, Mempool, GDELT
- [ ] Instalar e configurar `@supabase/supabase-js`
- [ ] Criar schemas Zod para todos os contratos de API
- [ ] Implementar TanStack Query hooks para substituir mock imports
- [ ] Criar ErrorBoundary global em App.jsx
- [ ] Implementar auth real via Supabase Auth

**FASE 4 — Cálculos (Python isolado primeiro):**
- [ ] Script Python: Risk Score composto
- [ ] Script Python: VaR, Sharpe, Max Drawdown, Beta
- [ ] Script Python: Macro Surprise Index
- [ ] Script Python: GEX/Dealer positioning

---

## 🏦 APIs GRATUITAS MAPEADAS (Para Fase 3)

| Dado | API | Limite Free | Notas |
|------|-----|-------------|-------|
| BTC price, funding, OI | Binance (público) | Sem limite | WebSocket disponível |
| Fear & Greed | alternative.me | Sem limite | JSON simples |
| Price, market cap | CoinGecko | 30 req/min | Free tier generoso |
| Options IV, term | Deribit (público) | Sem limite | WebSocket disponível |
| Macro: yields, VIX, FRED | FRED API | 120 req/min | API Key gratuita |
| On-Chain básico | Mempool.space | Sem limite | REST + WebSocket |
| News AI | CryptoPanic | Free tier | Sentiment básico |
| Stablecoin | CoinGlass (público) | Limitado | Verificar rate limit |
| Exchange flows | Glassnode | ❌ Pago | Alternativa: CryptoQuant free tier limitado |
| MVRV Z-score | Glassnode / LookIntoBitcoin | ❌ Pago / Free com limitação | Verificar viabilidade |
| Persistência user | Supabase free | 500MB DB, 2GB bandwidth | Suficiente para início |

---

## 🔐 SEGURANÇA — ITENS CRÍTICOS PRÉ-PRODUÇÃO

1. `@supabase/supabase-js` e chaves nunca commitadas em código (usar `.env` + Render env vars)
2. `AuthContext` precisa de auth real antes do deploy com dados sensíveis do usuário
3. Rate limiting nas chamadas de API externas (evitar ban por excesso)
4. CORS: todas as APIs listadas acima suportam chamadas diretas do browser (público)
5. Stripe: avaliar se será usado; se não, remover da dependência para reduzir bundle

---

## 📝 DECISÕES PENDENTES — AGUARDAM AUTORIZAÇÃO DO USUÁRIO

1. **Avançar para Fase 2 (visual)?** → Apresentar plano antes.
2. **Remover arquivos órfãos de páginas?** → Confirmar quais são dead code vs. usados em wrappers.
3. **Remover Stripe do package.json?** → Se não há plano de monetização imediato.
4. **Substituir moment por date-fns** (já instalado) para reduzir bundle?
5. **Ordem exata de implementação dos gaps** → Portfolio Risk Pack vs. Altcoins vs. Spot Sessions.
