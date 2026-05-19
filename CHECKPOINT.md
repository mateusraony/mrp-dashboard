# CHECKPOINT.md — MRP Dashboard
> Memória técnica viva do projeto. Atualizar ao final de cada bloco importante.
> Última atualização: 2026-05-19 (Fase de confiança de dados | Páginas 1-17 concluídas)

---

## 🛡 FASE DE CONFIANÇA DE DADOS (iniciada 2026-05-19)

**Objetivo:** Tornar impossível confundir dado real com mock, página por página.
**Branch:** `claude/inspect-github-project-K4Leg`
**Commit inicial:** `3d1260d`
**Regra:** Uma página por vez. Não avança sem confirmação do usuário + build OK.

### Mapa de Páginas — Fase de Confiança

| # | Página | Status | Classificação | Pode usar? | Commit |
|---|---|---|---|---|---|
| 1 | **DataSources** | ✅ CONCLUÍDA | A | Sim, com confiança | PR #130 mergeado |
| 2 | **Settings** | ✅ CONCLUÍDA | B→A | Sim, com confiança | PR #131 mergeado |
| 3 | **NewsIntelligence** | ✅ CONCLUÍDA | A | Sim | PR #132 mergeado |
| 4 | **Altcoins** | ✅ CONCLUÍDA | A | Sim | PR #134 mergeado |
| 5 | **SpotFlow** | ✅ CONCLUÍDA | A | Sim | PR #135 (em revisão) |
| 6 | **Portfolio** | ✅ CONCLUÍDA | A | Sim | PR #136 (em revisão) |
| 7 | **Derivatives** | ✅ CONCLUÍDA | A | Sim | PR #137 |
| 8 | **SmartAlerts** | ✅ CONCLUÍDA | A | Sim | PR #138 |
| 9 | **MacroCalendar** | ✅ CONCLUÍDA | A | Sim | PR #139 |
| 10 | **Macro** | ✅ CONCLUÍDA | A | Sim | PR #140 |
| 11 | **GlobalMarkets** | ✅ CONCLUÍDA | A | Sim | PR #141 |
| 12 | **Dashboard** | ✅ CONCLUÍDA | A | Sim | PR #142 |
| 13 | **ExecutiveReport** | ✅ CONCLUÍDA | A | Sim | PR #143 |
| 14 | **MarketRegime** | ✅ CONCLUÍDA | A | Sim | PR #144 |
| 15 | **PredictivePanel** | ✅ CONCLUÍDA | A | Sim | PR #145 |
| 16 | **OnChain** | ✅ CONCLUÍDA | A | Sim | sem PR — já conforme |
| 17 | **Options** | ✅ CONCLUÍDA | A | Sim | PR #146 |
| 18 | **MarketSentiment** | ✅ CONCLUÍDA | A | Sim | PR #147 |
| 19 | InstitutionalFlows | ⏳ Aguarda | — | — | — |
| 20 | Opportunities | ⏳ Aguarda | — | — | — |
| 21 | Automations | ⏳ Aguarda | — | — | — |

### Auditoria de rotas (revalidada 2026-05-19)

**Conclusão: NENHUMA página é órfã.** Todos os 29 arquivos em `src/pages/` são utilizados.
- 21 são rotas diretas em `pages.config.js`
- 8 são sub-componentes de páginas wrapper (Derivatives, DerivativesAdvanced, Automations, BotAutomations, ETFFlows, StablecoinFlow, ActionDashboard, Strategies)

### DataSources — Auditoria detalhada

**Status antes:** B — Bom, mas incompleto
**Status depois:** A — Pronta para uso como central de auditoria

**O que estava live:**
- Tabela de fontes via `SOURCE_REGISTRY` (estática, mas correta)
- `getRuntimeMode()` calculado de DATA_MODE + isSupabaseConfigured()
- Badges DataTrustBadge por fonte

**O que estava faltando / foi corrigido:**
- `SOURCE_REGISTRY` não listava: DeFiLlama, SoSoValue, CryptoCompare, Yahoo Finance, Glassnode, X/Twitter, Binance WebSocket, Reddit
- Sem seção de Edge Functions (7 existem: fred-proxy, ai-analysis, macro-actual-fetcher, macro-alert-worker, send-telegram-digest, telegram-ping, health-check)
- Sem status do Supabase na tela
- Sem exibição do override de localStorage separado do DATA_MODE de build

**Alterações feitas:**

| Arquivo | Alteração | Motivo |
|---|---|---|
| `src/utils/dataStatus.ts` | +8 entradas no SOURCE_REGISTRY (defillama, sosovalue, reddit, cryptocompare, yahoo_finance, glassnode, x_twitter, binance_ws) | Transparência — fontes reais não listadas |
| `src/utils/dataStatus.ts` | getRuntimeMode() agora verifica env.VITE_SOSOVALUE_KEY para sosovalue | ETF flows devem mostrar paid_required quando key ausente |
| `src/pages/DataSources.jsx` | `EnvironmentPanel` — Supabase status, DATA_MODE, localStorage override | Usuário sabia o modo mas não o status do Supabase ou override |
| `src/pages/DataSources.jsx` | `EdgeFunctionsPanel` — lista 7 edge functions com propósito e status | Página não mostrava edge functions de nenhuma forma |
| `src/pages/DataSources.jsx` | Substituiu "Data Mode Banner" por `EnvironmentPanel` (mais completo) | Evitar redundância com informação nova mais rica |

**Testes executados:**

| Comando | Resultado |
|---|---|
| `npm run build` | ✅ 0 erros |
| `npx eslint src/pages/DataSources.jsx src/utils/dataStatus.ts --quiet` | ✅ 0 warnings |
| `npx tsc -p ./jsconfig.json` | ✅ 0 erros |

**Classificação final:** A — Pode usar com confiança como central de auditoria do sistema

---

### Settings — Auditoria detalhada

**Status antes:** B — Labels Base44 fantasmas, segurança enganosa
**Status depois:** A

**Alterações feitas:**
- Removido badge `POST /admin/settings` (resíduo Base44 — rota não existe)
- Removido bloco "Security: X-TICK-TOKEN" (token fictício não implementado)
- Banner de autenticação agora mostra status real do Supabase (verde/amarelo)
- Seção Alert Thresholds: banner "ℹ️ não persistido" — claro que é localStorage
- Seção FRED Series: banner "ℹ️ não persistido" — claro que é localStorage
- CRYPTO_SYMBOLS SettingRow substituído por display read-only de "BTCUSDT"
- Source Health panel: nota TCP-only adicionada

---

### NewsIntelligence — Auditoria detalhada

**Status antes:** B — Labels "AI" para análise por palavras-chave
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Artigos Feed Geral | `LIVE_REAL` — GDELT DOC 2.0 |
| Artigos Institucionais | `LIVE_REAL` — GDELT query institucional |
| Sentimento (bullish/bearish) | `CALCULADO` — 14 pos / 15 neg keywords em `gdelt.ts` |
| Score por artigo (SentimentGauge) | `CALCULADO` — lista local 14/14 keywords |
| Narrativa de Mercado | `CALCULADO` — ratio + categoria dominante |
| Sinal de Mercado (signalMap) | `HARDCODED` — lookup estático por categoria |
| Histórico 7d | `LIVE_REAL` — Supabase `gdelt_articles` |

**Alterações:**
- Tab "Inteligência AI" → "Análise Institucional"
- h1 "Inteligência AI" → "Análise Institucional"
- "Narrativa de Mercado AI" → "Narrativa de Mercado"
- "Sinal de Mercado" + qualificador "(por categoria)"
- Banner de metodologia: "14 pos / 15 neg em gdelt.ts — não por modelo de linguagem"
- Bug fix: estado vazio agora distingue `!IS_LIVE` (mock) de `IS_LIVE` (API indisponível)
- Bug fix: `useGdelt.ts` select propaga erro quando data===null, ativando isError no TanStack Query

---

### Altcoins — Auditoria detalhada

**Status antes:** B — isFallback ignorado, sem fonte visível, condição de badge errada
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Preços, retornos 7/30/90d, mcap | `LIVE_REAL` — CoinGecko `/coins/markets` |
| BTC/ETH Dominance | `LIVE_REAL` — CoinGecko global |
| Alt Season Index | `CALCULADO` — % alts > BTC em 90d |
| Rotação Setorial | `CALCULADO` — média ponderada por mcap |
| Setor por ativo | `HARDCODED` — SECTOR_MAP estático |

**Alterações:**
- Expõe `isFallback` + `lastUpdated` do hook select → indicador `⚠ Cache · data`
- Badge "CoinGecko · top 50" em live mode
- DataTrustBadge condition: `!data` → `!alts.length` (select nunca retorna null)
- Nota "setores: classificação manual" no rodapé da tabela

---

### Portfolio — Auditoria detalhada

**Status antes:** B — label "Max Drawdown" enganosa para resultado de stress test
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| BTC mark price | `LIVE_REAL` — Binance Futures |
| Klines 1d/30d | `LIVE_REAL` — Binance (para vol histórica do VaR) |
| Posições do usuário | `LIVE_REAL` — Supabase persistido |
| Greeks, P&L, totais | `CALCULADO` — soma das posições + preço live |
| VaR 95/99, Sharpe, Beta, Vol | `CALCULADO` — computeLiveRiskMetrics com vol real |
| "Max Drawdown" (era) | ⚠️ LABEL ERRADO — era stressTest(-20%), não historical MDD |
| Stress Test chart | `CALCULADO` — stressTest por cenário |

**Pontos positivos pré-existentes:**
- `StaleIndicator` já implementado quando ticker ausente ✅
- Nota "⚠ Modelo paramétrico" no VaR ✅
- `computeLiveRiskMetrics` usa vol real dos klines ✅

**Alteração:**
- Label "Max Drawdown" → "Stress −20% BTC"
- Descrição "Cenário stress -20% BTC" → "P&L simulado em queda de 20%"

---

### SpotFlow — Auditoria detalhada

**Status antes:** B — "AI Analysis" para análise rule-based
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Klines 1h/15m/1d | `LIVE_REAL` — Binance `/klines` |
| CVD, retornos multi-período | `CALCULADO` — derivado dos klines |
| Sessões Ásia/Europa/EUA | `CALCULADO` — computeSessionStats |
| Sinal/score do AIModuleCard | `CALCULADO` por regras — computeRuleBasedAnalysis (if/else) |
| AI_SPOT_FALLBACK (sem klines) | `HARDCODED` — neutral estático |
| Claude Haiku insight | `LIVE_REAL` — quando useAiInsight configurado |

**Alteração:**
- "🤖 AI Analysis — Spot Flow" → "Análise Spot Flow" + nota "(sinal por regras · Claude Haiku quando configurado)"

---

### Derivatives — Auditoria detalhada

**Status antes:** B — "🤖 AI Analysis" para análise rule-based; mode badges enganosos no fallback
**Status depois:** A

**Arquivos auditados:**
- `src/pages/DerivativesPage.jsx` — wrapper com tabs, sem problemas
- `src/pages/Derivatives.jsx` — Overview tab
- `src/pages/DerivativesAdvanced.jsx` — Avançado tab (6 sub-seções)
- `src/components/options/IVRankPanel.jsx` — já conforme ✅
- `src/components/options/TakerFlowPanel.jsx` — já conforme ✅

**Classificação de dados (Overview):**
| Dado | Classificação |
|------|--------------|
| Mark price, funding rate | `LIVE_REAL` — Binance Futures |
| OI delta, open interest | `LIVE_REAL` — Binance Futures |
| OI por Exchange | `LIVE_REAL` — Binance Futures |
| OI/Market Cap ratio | `CALCULADO` — OI Binance ÷ mcap CoinGecko |
| Perp vs Dated | `PAGO_INDISPONIVEL` — CoinGlass requer auth |
| Sinal AIModuleCard | `CALCULADO` — computeRuleBasedAnalysis (if/else) |
| Claude Haiku insight | `LIVE_REAL` — quando useAiInsight configurado |
| Histórico funding (funding_history) | `HARDCODED` — array vazio `[]`, nunca populado do ticker |
| risk_score, risk_factors | `HARDCODED` — zeros no BTC_FUTURES_FALLBACK |

**Classificação de dados (Advanced):**
| Dado | Classificação |
|------|--------------|
| Liq Clusters (Heatmap) | `LIVE_REAL` quando `useLiquidations` retorna ≥3 pontos; `MOCK` caso contrário |
| probLongFlush | `CALCULADO` — ratio longs/shorts em risco ±10% |
| Claude Haiku no Heatmap | `LIVE_REAL` — useAiInsight ✅ |
| OI por Strike BTC | `LIVE_REAL` quando Deribit live; `MOCK` fallback |
| OI por Strike ETH | `MOCK` — escalado 0.12× do BTC mock |
| Carry Calculator basis | `LIVE_REAL` via useFuturesBasis (Binance /premiumIndex); `MOCK` fallback |
| US10Y no Carry Calc | `LIVE_REAL` via FRED |
| Term Structure IV | `LIVE_REAL` quando Deribit retorna dados; `MOCK` fallback |
| IV Rank | `LIVE_PARCIAL` — ATM IV ao vivo, limites 52w do mock |
| Taker Flow | `PAGO_INDISPONIVEL` — requer auth Deribit |

**Pontos positivos pré-existentes:**
- DataTrustBadge em OI/Market Cap (fonte CALCULADO) ✅
- DataTrustBadge em Perp vs Dated (PAGO) ✅
- ModeBadge no header do Advanced ✅
- IVRankPanel e TakerFlowPanel com badge PAGO e banner locked ✅
- AIInsightPanel (LiqHeatmap) usa useAiInsight real ✅

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/Derivatives.jsx` | 368 | `🤖 AI Analysis — Derivatives` → `Análise Derivatives` + nota metodologia |
| `src/pages/DerivativesAdvanced.jsx` | 443 | CarryCalculator mode badge: `IS_LIVE ? 'live' : 'mock'` → `(liveBasis?.length > 0) ? 'live' : 'mock'` |
| `src/pages/DerivativesAdvanced.jsx` | 603 | TermStructurePanel fallback mode badge: `IS_LIVE ? 'live' : 'mock'` → `'mock'` |

---

### SmartAlerts — Auditoria detalhada

**Status antes:** B — tab e card expandido com label "AI" para análise rule-based
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Funding Rate (RiskGauge) | `LIVE_REAL` — Binance Futures via `useBtcTicker` |
| Long Flush score | `CALCULADO` — ratio longs/total via `useLiquidations` + riskScore blend |
| Short Squeeze score | `CALCULADO` — ratio shorts BUY / total via `useLiquidations` |
| Funding cross-venue | `LIVE_REAL` — média Binance/Bybit/OKX via `useMultiVenueSnapshot` |
| Basis Deviation (RiskGauge) | `MOCK` — `riskDashboard.basis_deviation` de `mockDataAlerts` |
| Sentimento (RiskGauge) | `LIVE_REAL` — Fear & Greed via `useFearGreed`; fallback mock |
| Cluster BTC (RiskGauge) | `CALCULADO` — cluster mais próximo via `useLiquidations`; fallback mock |
| Sugestões (tab Sinais) | `CALCULADO` — `computeRuleBasedAnalysis` when live; `AI_SUGGESTIONS` hardcoded when mock |
| Histórico (tab Histórico) | `LIVE_REAL` — Supabase `alertEvents` quando disponível; `alertHistory` mock como seed |
| Regras configuradas | `LIVE_REAL` — Supabase `savedRules`; `defaultAlertRulesMock` como seed |

**Pontos positivos pré-existentes:**
- `DataQualityBadge` em cada RiskGauge com `source='MOCK'` quando fallback ✅
- Badge "● LIVE · Rule-based" vs "demo · aguardando dados" na tab de sugestões ✅
- Aviso "não constituem recomendação de investimento" no rodapé ✅
- Histórico: nota "demo · histórico real acumula com o uso" quando Supabase vazio ✅
- `ModeBadge` no header condicionado a `IS_LIVE && ticker` ✅

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/SmartAlerts.jsx` | 433 | Tab label `🤖 AI & Sugestões` → `Sinais & Sugestões` |
| `src/pages/SmartAlerts.jsx` | 223 | `🤖 Raciocínio da AI` → `Raciocínio` (card expandido) |

---

### MacroCalendar — Auditoria detalhada

**Status antes:** B — label "AI" em dois pontos do template de alertas; tab Surpresa sem badge live/mock
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Eventos macro (agenda) | `LIVE_REAL` — FRED API + FOMC estático via `useMacroCalendar` |
| Datas futuras | `LIVE_REAL` — geradas relativamente à data atual (nunca "Encerrado" no futuro) |
| Resultado actual | `LIVE_REAL` — FRED via macro-actual-fetcher Edge Function |
| Z-Score de surpresa | `CALCULADO` — fórmula validada em `scripts/validate_macro_surprise.py` |
| Volatilidade pré/pós evento | `LIVE_REAL` — Binance klines via `useEventVolatility`; fallback mock |
| Impacto médio BTC por evento | `LIVE_REAL` ou `MOCK` — depende de `hasLiveVol` |
| btc_impact_hist_avg por evento | `ESTIMADO` — campo estimado na geração do evento |
| Preferências de alerta | `LIVE_REAL` — Supabase `macro_alert_preferences` |

**Pontos positivos pré-existentes:**
- Loading state e error state com retry no header ✅
- Badge "FRED + FOMC Oficial" no header quando IS_LIVE ✅
- Badge live/mock na Volatilidade sidebar e tab Volatilidade ✅
- `GoldenRule` component exibido ✅
- RefreshButton com `lastUpdated` ✅

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/MacroCalendar.jsx` | 610 | `"recomendação AI"` → `"histórico de impacto BTC"` (template não inclui AI) |
| `src/pages/MacroCalendar.jsx` | 623 | `🤖 Impacto histórico BTC:` → `📊 Impacto histórico BTC:` (robô em dado histórico) |
| `src/pages/MacroCalendar.jsx` | 463 | Tab Surpresa: badge live/mock adicionado ao banner de contextualização |

---

### Macro — Auditoria detalhada

**Status antes:** B — `🤖 AI Analysis — Macro` para output de `computeRuleBasedAnalysis`
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Series macro (yields, DXY, VIX, S&P, etc.) | `LIVE_REAL` — FRED via `useMacroBoard` |
| Global Liquidity (Fed BS, RRP, TGA) | `LIVE_REAL` — FRED via `useGlobalLiquidity` |
| BCB Layer (SELIC, IPCA, USDBRL) | `LIVE_REAL` — BCB OpenData via `useBcbData` |
| Sinal AIModuleCard | `CALCULADO` — `computeRuleBasedAnalysis` (if/else de threshold) |
| Claude Haiku insight | `LIVE_REAL` — `useAiInsight` quando configurado |
| Fallback mock quando FRED offline | `MOCK` — `macroBoardMock` de mockData |

**Pontos positivos pré-existentes:**
- Banner de fallback mock explícito quando `IS_LIVE && !isLiveMacro` ✅
- `ModeBadge` no header ✅
- DataQualityBadge por série ✅
- "Dados de demonstração" quando IS_LIVE=false ✅
- `ClaudeInsight` separado do AIModuleCard — Claude Haiku real ✅

**Alteração feita:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/Macro.jsx` | 677 | `🤖 AI Analysis — Macro` → `Análise Macro` + nota metodologia |

---

### GlobalMarkets — Auditoria detalhada

**Status antes:** B — manchetes editoriais hardcoded apareciam sem disclaimer em IS_LIVE
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| FX rates (EUR/USD, USD/BRL, GBP/USD, etc.) | `LIVE_REAL` — FRED API + BCB via `useGlobalMarkets` |
| Commodities (Gold, Silver, WTI) | `LIVE_REAL` — FRED API |
| Bancos Centrais (Fed, ECB, BoJ, BCB) | `LIVE_REAL` — FRED + BCB via `useBcbData` |
| Correlações BTC vs SP500/DXY/Gold/VIX | `ESTIMADO` — Pearson de séries FRED (proxy, não fonte direta) ✅ badge já existia |
| Análise BRL → BTC | `HARDCODED` — texto editorial estático |
| "Notícias de Impacto Global" | `HARDCODED` — `GLOBAL_NEWS` const, manchetes editoriais fixas |

**Pontos positivos pré-existentes:**
- `ModeBadge` + `DataTrustBadge` no header ✅
- `DataTrustBadge mode="estimated"` nas Correlações ✅
- Loading state e empty states por tab ✅
- Links "Ver ↗" em IS_LIVE vão para fontes reais ✅

**Problema:**
- `GLOBAL_NEWS` = manchetes editoriais hardcoded. Disclaimer `"Conteúdo de demonstração"` era condicionado a `!IS_LIVE` — sumia em produção, tornando notícias fixas indistinguíveis de live.

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/GlobalMarkets.jsx` | 200 | `"Notícias de Impacto Global"` → `"Contexto de Mercado Global"` + subtítulo honesto |
| `src/pages/GlobalMarkets.jsx` | 216 | Disclaimer sempre visível (removido guard `!IS_LIVE`); tom mais suave, texto mais claro |

---

### Dashboard — Auditoria detalhada

**Status antes:** B — seção "AI Analysis & Previsões" + `🤖 AI · rule-based-v1` no painel de análise
**Status depois:** A

**Classificação de dados (Zona D — Análise):**
| Dado | Classificação |
|------|--------------|
| Confluência Multi-Timeframe | `CALCULADO` — `useMtfAnalysis` de klines reais |
| Alertas Z-Score | `CALCULADO` — `useZScoreAlerts` de klines + funding |
| Análise Natural — Claude Haiku | `LIVE_REAL` — `useAiInsight` (só aparece quando IS_LIVE + Supabase) |
| AIAnalysisPanel (rule-based) | `CALCULADO` — `computeRuleBasedAnalysis` (if/else threshold) |
| AITrackRecord | `LIVE_REAL` — Supabase predictions; demo data quando não configurado |

**Pontos positivos pré-existentes:**
- Confluência MTF, Z-Score, Claude Haiku: todos já têm labels honestos ✅
- AITrackRecord: `DataTrustBadge mode="mock"` quando demo; `mode="live"` quando Supabase real ✅
- `ModeBadge` no header principal ✅
- Risk Score live via `useRiskScore` ✅

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/Dashboard.jsx` | 687 | `🤖 AI Analysis & Previsões` → `📊 Análise & Previsões` + sub-texto honesto |
| `src/components/ui/AIAnalysisPanel.jsx` | 131 | `🤖 AI · {model}` → `Análise Automática · {model}` (model=`rule-based-v1` auto-descreve) |

---

### ExecutiveReport — Auditoria detalhada

**Status antes:** B — `AIInsightPanel` exibia `🤖 AI ANALYSIS · EXECUTIVE_REPORT` e `🤖 Modelo: mock_quant_v1 · EXECUTIVE_REPORT` mesmo quando Claude Haiku não era usado (apenas regras)
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| BTC price, funding rate, OI | `LIVE_REAL` — Binance Futures via `useBtcTicker` |
| Fear & Greed | `LIVE_REAL` — Alternative.me via `useFearGreed` |
| Risk Score | `LIVE_REAL` — `useRiskScore` (funding + liquidações + FNG) |
| Market Regime | `LIVE_REAL` — `useMarketRegime` (if/else threshold) |
| Regime history 90d | `LIVE_REAL` — Supabase `marketRegime` via `useRegimeHistory` |
| On-chain cycle (NUPL, MVRV) | `LIVE_PARCIAL` — CoinMetrics Community (NUPL, MVRV proxy) |
| OI history | `LIVE_REAL` — Binance via `useBtcOiHistory` |
| Recomendação AIInsightPanel | `CALCULADO` — `computeRuleBasedAnalysis` (if/else funding · FNG · riskScore) |
| Claude Haiku insight | `LIVE_REAL` — `useAiInsight` (quando IS_LIVE + liveTicker/liveFng) |
| NUPL/SOPR/MVRV display | `MOCK` — `BTC_NUPL_FALLBACK`, `BTC_SOPR_FALLBACK`, `BTC_REALIZED_METRICS_FALLBACK` (zeros/valores neutros) |
| Exchange Netflow/Whale data | `MOCK` — `BTC_EXCHANGE_NETFLOW_FALLBACK`, `BTC_WHALE_ACTIVITY_FALLBACK` (zeros) |
| ETF Flows section | `MOCK` — `ETF_FLOWS_FALLBACK` (AUM=0, funds=[]) |
| Stablecoin Supply | `MOCK` — `STABLECOIN_SUPPLY_FALLBACK` (zeros) |
| Correlações BTC | `MOCK` — `BTC_CORRELATIONS_FALLBACK` (pairs=[]) |
| S&P500, DXY, VIX, Gold | `MOCK` — `MACRO_BOARD_FALLBACK.series` vazio (sem FRED aqui) |
| Yield Spread, Credit Spread | `MOCK` — `YIELD_CURVE_SPREAD_FALLBACK`, `CREDIT_SPREAD_FALLBACK` (zeros) |
| Tabela Comparativo Multi-Período | `HARDCODED` — `PeriodSummaryTable` usa BTC_FUTURES_MOCK_FALLBACK + stubs fixos ('Anual' +124.8% etc.) |
| Análise BRL→BTC | `HARDCODED` — texto editorial estático |

**Pontos positivos pré-existentes:**
- `ModeBadge` no header condicionado a `IS_LIVE && (liveTicker || liveFng)` ✅
- `useAiInsight` real com `execPayload` construído de dados live ✅
- `modelLabel` condicionado a `execInsightText` (só aparece quando Claude respondeu) ✅
- Fallbacks explícitos nomeados `*_FALLBACK` ou `*_MOCK_FALLBACK` — rastreáveis ✅

**Problema:**
- `AIInsightPanel` mostrava `🤖 AI ANALYSIS · EXECUTIVE_REPORT` no header e `🤖 Modelo: mock_quant_v1 · {moduleId}` no rodapé quando `modelLabel` era `undefined` — ou seja, quando Claude Haiku ainda não tinha respondido. Isso sugeria IA onde havia apenas regras de threshold.

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/components/ai/AIInsightPanel.jsx` | 52 | Compact footer: `🤖 Modelo: {modelLabel \|\| 'mock_quant_v1'} · {moduleId}` → `{modelLabel ? \`🤖 ${modelLabel} · ${moduleId}\` : \`Análise por regras · ${moduleId}\`}` |
| `src/components/ai/AIInsightPanel.jsx` | 71 | Full header: `🤖 AI ANALYSIS · {moduleId}` → `{modelLabel ? \`🤖 ${modelLabel}\` : 'Análise Automática'} · {moduleId}` |
| `src/components/ai/AIInsightPanel.jsx` | 137 | Full footer: `🤖 Modelo: {modelLabel \|\| 'mock_quant_v1'} · {moduleId}` → `{modelLabel ? \`🤖 ${modelLabel} · ${moduleId}\` : \`Análise por regras · ${moduleId}\`}` |

**Nota:** `AIInsightPanel` é usado também em `DerivativesAdvanced.jsx` (LiqHeatmap) — beneficia da mesma correção sem alterações adicionais. `modelLabel` já era `'claude-haiku-4-5'` condicionado ao texto Claude naquela página.

**Seções com dados mock não mascarados (pendente futura sprint):**
- `PeriodSummaryTable` — tabela com valores hardcoded. Sem indicador visual de mock. Candidato a sprint posterior de dados reais.
- ETF Flows section — `ETF_FLOWS_FALLBACK` com zeros. Já linkado para `/InstitutionalFlows`.
- Stablecoin section — `STABLECOIN_SUPPLY_FALLBACK` com zeros. Candidato futuro.

**Testes executados:**
| Comando | Resultado |
|---------|----------|
| `npm run build` | ✅ 0 erros |

**Classificação final:** A — Labels honestos. Claude Haiku identificado quando presente. Seções mock não mascaradas são limitações de dados (APIs pagas/indisponíveis), não engano visual.

---

### MarketRegime — Auditoria detalhada

**Status antes:** B — Tab e hero card com labels "AI" para sugestões hardcoded; robô emoji na aba de conteúdo estático
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Score de Regime (score, label, color) | `CALCULADO` — `useMarketRegime` (soma ponderada: VIX 22% · Yield Curve 20% · DXY 18% · NUPL 13% · S&P500 15% · Funding 12%) |
| VIX, DXY, S&P500, Yield Curve | `LIVE_REAL` — FRED via `useMacroBoard` |
| Funding Rate | `LIVE_REAL` — Binance Futures via `useBtcTicker` |
| NUPL (componente) | `LIVE_PARCIAL` — CoinMetrics Community proxy |
| radarData (por componente) | `CALCULADO` — derivado de dados FRED + Binance |
| Histórico 90D | `LIVE_REAL` quando Supabase tem ≥7 registros (`useRegimeHistory`); `ESTIMADO` (seed determinístico) caso contrário |
| Transições de regime | `CALCULADO` — detectadas do histórico (`buildTransitions`) |
| Trigger das transições | `HARDCODED` — `'Score cruzou threshold'` estático |
| EXPOSURE_SUGGESTIONS | `HARDCODED` — sugestões editoriais fixas por regime (Risk-On / Neutral / Risk-Off) |
| TRANSITION_TRIGGERS | `HARDCODED` — gatilhos editoriais típicos por par de regimes |

**Pontos positivos pré-existentes:**
- `ModeBadge` no header (condição correta: `IS_LIVE ? 'live' : 'mock'`) ✅
- Histórico: badge "● Supabase · Nd reais" vs "Estimado — acumula com uso" + `ModeBadge mode="estimated"` ✅
- Disclaimer `⚠️ Sugestões baseadas em modelo quantitativo... Não constituem recomendação de investimento` ✅
- `enabled: IS_LIVE` no hook — sem execução em mock mode ✅

**Problema:**
- Tab `'Sugestões AI'`, label `💡 AI Suggestion` e emoji `🤖` no header da aba — todo o conteúdo vem de `EXPOSURE_SUGGESTIONS` (const hardcoded com sugestões editoriais), sem nenhum LLM envolvido.

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/MarketRegime.jsx` | 185 | Tab `'Sugestões AI'` → `'Sugestões'` |
| `src/pages/MarketRegime.jsx` | 276 | `💡 AI Suggestion` → `💡 Sugestão de Exposição` |
| `src/pages/MarketRegime.jsx` | 278 | `"aba Sugestões AI"` → `"aba Sugestões"` |
| `src/pages/MarketRegime.jsx` | 434 | Emoji `🤖` → `📊` no header da aba de sugestões |

**Testes executados:**
| Comando | Resultado |
|---------|----------|
| `npm run build` | ✅ 0 erros |

**Classificação final:** A — Score de regime é live e bem rotulado. Sugestões de exposição são editoriais hardcoded — agora claramente nomeadas sem referência a AI.

---

### PredictivePanel — Auditoria detalhada

**Status antes:** B — Badge `🧠 AI-Quantitative` sem IA real; descrições de confiança e metodologia com valores hardcoded aparentando ser live
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| BTC spot price | `LIVE_REAL` — Binance Futures via `useBtcTicker` |
| Klines 1d/30 | `LIVE_REAL` — Binance via `useKlines` |
| ATR(14) | `CALCULADO` — média de (high−low) dos últimos 14 klines Binance |
| Fear & Greed | `LIVE_REAL` — Alternative.me via `useFearGreed` |
| Risk Score | `LIVE_REAL` — `useRiskScore` |
| Direção/Sinal (badge) | `CALCULADO` — `computeRuleBasedAnalysis` (if/else funding + FNG + riskScore) |
| Target prices dos cenários | `CALCULADO` — `spotPrice + ATR14 × multiplicador` quando live |
| Probabilidades dos cenários (28/34/18/14/6%) | `HARDCODED` — `SCENARIOS_24H_FALLBACK` estático (nunca muda com dados live) |
| Triggers, drivers, risk dos cenários | `HARDCODED` — `'—'` e `[]` no fallback |
| Claude Haiku insight (`ClaudeInsight`) | `LIVE_REAL` — `useAiInsight` quando ticker + atr14 disponíveis |
| Path chart (trajetórias) | `MOCK` — `PRICE_PATHS_FALLBACK` com arrays vazios (sem renderização) |
| Tabela Prob. Rompimento | `MOCK` — `BREAKOUT_TABLE_FALLBACK = []` (sempre vazia) |
| Pressão Institucional | `MOCK` — `INSTITUTIONAL_PRESSURE_FALLBACK` com score=0, componentes=[] |

**Pontos positivos pré-existentes:**
- `ModeBadge` condicionado a `IS_LIVE && spotPrice` (não apenas IS_LIVE) ✅
- `ClaudeInsight` com `✦ Claude Haiku` claramente separado da análise de regras ✅
- `DataTrustBadge mode="paid_required"` na Pressão Institucional ✅
- Fallbacks nomeados `*_FALLBACK` — rastreáveis ✅
- Spot price mostra `⚠` quando `ticker?.isFallback` ✅

**Problemas:**
1. Badge `🧠 AI-Quantitative` — nem IA (Claude Haiku é separado) nem quantitativo real (probabilidades são estáticas)
2. "Confiança do Modelo" descrevia `(0.68).toFixed(2)`, `(22.14).toFixed(1)`, `(0.0712).toFixed(4)` — floats hardcoded no código, não valores live
3. Tab "Prob. Rompimento" descrevia `ETF +$284M, stablecoin +$421M, Neutral, 58pts` como inputs do cálculo — mas `BREAKOUT_TABLE_FALLBACK = []` (tabela sempre vazia)

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/PredictivePanel.jsx` | 312 | Badge `🧠 AI-Quantitative` → `📐 Quantitativo` |
| `src/pages/PredictivePanel.jsx` | 406 | Substituiu floats hardcoded por descrição honesta: ATR(14) live + probabilidades estáticas |
| `src/pages/PredictivePanel.jsx` | 497 | Substituiu valores hardcoded por nota de requisito de API paga (Glassnode) |

**Testes executados:**
| Comando | Resultado |
|---------|----------|
| `npm run build` | ✅ 0 erros |

**Classificação final:** A — Labels honestos. Preços-alvo via ATR são live. Probabilidades de cenários são referência estática — agora claramente indicadas.

---

### OnChain — Auditoria detalhada

**Status antes:** A — já conforme
**Status depois:** A — sem alterações necessárias

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| NUPL valor atual | `LIVE_PARCIAL` — CoinMetrics Community proxy `(MCap−RCap)/MCap` |
| NUPL zona, cor | `CALCULADO` — derivado do valor CoinMetrics |
| NUPL history chart, deltas 7d/30d | `MOCK` — `btcNUPL` mock (CoinMetrics Community não fornece série histórica facilmente) |
| SOPR (em IS_LIVE) | `PAGO_INDISPONIVEL` — `PaidRequiredCard` com Glassnode |
| Exchange Netflow (em IS_LIVE) | `PAGO_INDISPONIVEL` — `PaidRequiredCard` com Glassnode |
| Whale Activity (em IS_LIVE) | `PAGO_INDISPONIVEL` — `PaidRequiredCard` com Glassnode |
| MVRV ratio, Realized Price | `LIVE_PARCIAL` — CoinMetrics Community via `useOnChainCycle` |
| CDD, MA30, Z-Score | `LIVE_REAL` — CoinMetrics Community via `useOnChainExtended` |
| HODL Wave 1yr+, Dormancy proxy | `LIVE_REAL` — CoinMetrics Community via `useOnChainExtended` |
| Hash Rate, Dificuldade | `LIVE_REAL` — Mempool.space via `useHashrate` |
| Mempool tx count, fees | `LIVE_REAL` — Mempool.space via `useMempoolState` |
| LthSthCard | `LIVE_PARCIAL` — CoinMetrics Community (próprio componente) |

**Pontos positivos pré-existentes (exemplar):**
- Header banner lista fontes e qualidade explicitamente ✅
- Quality banner colorido: AO VIVO (verde) / ESTIMADO (amarelo) / DEMO (amarelo) ✅
- `DataTrustBadge mode="estimated"` no NUPL com nota "proxy — não é Glassnode" ✅
- `PaidRequiredCard` (🔒) para SOPR/Netflow/Whale quando IS_LIVE ✅
- `DataTrustBadge mode="paid_required"` na Pressão Institucional ✅
- `DataQualityBadge` no MvrvCard ✅
- `GradeBadge` por card (A/B/D) ✅
- `ModeBadge` condicionado a `IS_LIVE && hasLiveData` ✅
- Badge "CoinMetrics Community · Grátis · Qualidade A" em cada card quando live ✅
- Nenhum label "AI" ou "🤖" em nenhuma seção ✅

**Alterações feitas:** Nenhuma — página já conforme.

**Classificação final:** A — Melhor página de transparência de dados do projeto. Nenhuma alteração necessária.

---

### Options — Auditoria detalhada

**Status antes:** B — `🤖 AI Analysis — Options` para output de `computeRuleBasedAnalysis`
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| IV ATM, chain strikes, skew | `LIVE_REAL` — Deribit via `useOptionsData` |
| IV deltas 1D/1W/1M | `CALCULADO` — delta da série DVOL do Deribit |
| Put/Call skew médio | `CALCULADO` — média de (put_iv − call_iv) por strike |
| Regime (low_vol/normal/elevated/crisis) | `CALCULADO` — threshold em iv_atm |
| GEX, Max Pain | `CALCULADO` — `computeGex` e `computeMaxPain` com Black-Scholes 2ª deriv. (validado em scripts/) |
| Put/Call Ratio Vol e OI | `LIVE_REAL` — Deribit quando disponível |
| Sinal AIModuleCard | `CALCULADO` — `computeRuleBasedAnalysis` (if/else IV · skew · P/C · max pain) |
| Claude Haiku insight | `LIVE_REAL` — `useAiInsight` quando `hasLiveData` |
| IV Rank | `LIVE_PARCIAL` — IV ao vivo, limites 52w do mock (`IVRankPanel` já tem badge pago) |
| Taker Flow | `PAGO_INDISPONIVEL` — requer Deribit auth (`TakerFlowPanel` já tem badge pago) |
| DealerFlowPanel (GEX/Vanna/Charm) | `CALCULADO` — Black-Scholes 2ª deriv. do spot + IV live |

**Pontos positivos pré-existentes:**
- `ModeBadge` + `GradeBadge` no header ✅
- `ClaudeInsight` com `✦ Claude Haiku` separado e claro ✅
- `IVRankPanel` e `TakerFlowPanel` com `DataTrustBadge paid_required` ✅
- `SectionHeader` com grade por gráfico ✅

**Alteração feita:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/Options.jsx` | 300 | `🤖 AI Analysis — Options` → `Análise Options` + nota de metodologia |

**Testes executados:**
| Comando | Resultado |
|---------|----------|
| `npm run build` | ✅ 0 erros |

**Classificação final:** A — Label honesto. Claude Haiku claramente separado da análise por regras.

---

### MarketSentiment — Auditoria detalhada

**Status antes:** B — badge `AI-Powered`, botão `🤖 Gerar Análise AI` (stub), painel `🤖 Análise AI`, correlações hardcoded sem disclaimer
**Status depois:** A

**Classificação de dados:**
| Dado | Classificação |
|------|--------------|
| Score composto (Fear/Greed + Funding + GDELT) | `CALCULADO` — `useMarketSentiment` pondera FNG 50% + Funding 30% + GDELT 20% |
| Fear & Greed | `LIVE_REAL` — Alternative.me via `useFearGreed` |
| Funding Rate (componente) | `LIVE_REAL` — Binance via `useBtcTicker` (interno ao hook) |
| Sentimento GDELT (componente) | `LIVE_REAL` — `useGdelt` |
| Word Cloud | `LIVE_REAL` quando `gdeltArticles` disponível; `HARDCODED` (`wordCloudData`) como fallback |
| Histórico 7d sentimento + BTC price | `LIVE_REAL` quando `fngHistory + klines` disponíveis; `HARDCODED` (`sentimentHistory7d`) como fallback |
| Cobertura midiática por hora | `LIVE_REAL` — GDELT timeline via `useGdeltMentionsTimeline` quando disponível |
| Trending topics | `LIVE_PARCIAL` — keywords extraídas de `gdeltArticles` quando live; `HARDCODED` (`trendingTopics`) como fallback |
| `generateAIAnalysis()` | `HARDCODED` — stub que retorna string fixa após 800ms; sem LLM |
| Correlações (tab Correlações) | `HARDCODED` — `socialCorrelation` const com valores fixos (0.74, 0.68, lag=4h) |
| KOLs tab | `PAGO_INDISPONIVEL` — `🔒` explícito, requer Twitter API Enterprise ✅ |

**Pontos positivos pré-existentes:**
- `ModeBadge` no header ✅
- `DataTrustBadge mode="mock"` quando `!IS_LIVE` ✅
- Nota "Lag stablecoin ~12h" honesta no footer do score ✅
- Tab KOLs: `🔒` com explicação de custo da API ✅
- Cobertura midiática: label correto "GDELT Doc 2.0" quando live ✅
- Trending: nota "GDELT indisponível — dados de demonstração" quando fallback ✅

**Problemas:**
1. Badge `AI-Powered` — score é FNG + Funding + GDELT (regras de peso fixo), sem modelo de linguagem
2. Botão `🤖 Gerar Análise AI` — stub que retorna texto fixo após timeout
3. Painel resultado com `🤖 Análise AI — Sentimento Social` — stub, não LLM
4. Correlações hardcoded sem disclaimer

**Alterações feitas:**
| Arquivo | Linha | Alteração |
|---|---|---|
| `src/pages/MarketSentiment.jsx` | 257 | Badge `AI-Powered` → `FNG + Funding + GDELT` |
| `src/pages/MarketSentiment.jsx` | 262 | Botão `🤖 Gerar Análise AI` → `ℹ️ Status Integração AI` |
| `src/pages/MarketSentiment.jsx` | 269 | Painel `🤖 Análise AI — Sentimento Social` → `ℹ️ Status da Integração AI` |
| `src/pages/MarketSentiment.jsx` | ~463 | Disclaimer adicionado após correlações hardcoded |

**Testes executados:**
| Comando | Resultado |
|---------|----------|
| `npm run build` | ✅ 0 erros |

**Classificação final:** A — Score composto claramente rotulado por fonte. Stub de AI renomeado. Correlações com disclaimer.

---

## 🗂 ESTADO GERAL (verificado em 2026-05-17)

| Aspecto | Status | Evidência Real |
|---------|--------|---------------|
| Build (`npm run build`) | ✅ PASSA | 0 erros |
| Testes (`npm test`) | ✅ 285/285 | 18 suites |
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
| **Sprint 9 — DeFiLlama + Options engine + Reddit ETF** | ✅ PR #102 MERGEADO | **3 features live.** (1) `StablecoinFlow.jsx`: hook `useStablecoinData()` conectado — `snap.total_supply_b/total_net_24h_m/usdt/usdc` vêm da DeFiLlama API em tempo real (TTL 1h); banner amarelo automático quando rate-limit atingido (`quality==='C'`); badge verde "AO VIVO · DeFiLlama" quando dados frescos; `chainPieData` guarda com `source==='mock'` evita label falso "AO VIVO". (2) `ActionDashboard.jsx`: `useOptionsData()` adicionado; `chainSkew` calculado da chain Deribit; `maxPainDistancePct` do spot; `options: { ivAtm, skew, pcrVol, maxPainDistancePct }` agora passado para `computeRuleBasedAnalysis` — sinais do módulo de opções (IV extrema, put skew, PCR > 1.2) entram na geração de oportunidades. (3) `src/services/reddit.ts` + `src/hooks/useEtfReddit.ts` criados; `ETFFlows.jsx` com seção "Reddit Pulse" — posts ao vivo de r/ETFs e r/Bitcoin sobre BTC ETF flows (sort=new, atualizado a cada 30min); fallback para 3 posts mock em dev. **UX fixes:** badge PAGO D removido do header StablecoinFlow; tabela Por Rede simplificada (Rede/Total/% — DeFiLlama não dá breakdown USDT/USDC por chain); empty states 🔒 nas tabs Visão Geral e Emissões; ActionDashboard Performance sempre mostra banner "Histórico em construção"; Strategies badge mudado de mock D → estimated B. **CI fix:** import `DataTrustBadge` removido (não usado após UX cleanup). Build ✅ · 270/270 testes ✅ |
| **Sprint 8.1 — Claude AI Universal** | ✅ branch `claude/macro-page-fix-prompt-s6hoI` | **Claude Haiku 4.5 em todas as páginas com IA.** Edge Function `ai-analysis` expandida com roteamento por `page` (9 páginas: dashboard, derivatives, derivatives_advanced, options, spot_flow, macro, predictive, executive_report, action_dashboard); `context{}` carrega métricas específicas por página; system prompt permanece em cache ephemeral. `aiInsight.ts`: payload com `page + context`. `useAiInsight.ts`: `page` no queryKey = cache de 15min independente por página. `AIInsightPanel`: props `insight/isLoadingInsight/modelLabel` + skeleton loading + footer dinâmico "claude-haiku-4-5". **Páginas mock → Claude** (3): DerivativesAdvanced, ActionDashboard, ExecutiveReport. **Páginas rule-based + Claude** (5): Derivatives, SpotFlow, Options, Macro, PredictivePanel — componente `ClaudeInsight` inline adicionado após AIModuleCard. **Custo estimado**: $1,50–4,00/mês (Claude Haiku 4.5 com prompt caching). **Sem tier gratuito** na API Anthropic — $5 crédito inicial para novas contas. Build ✅ tsc ✅ |
| **7 rotas 404 + deep-link tabs** | ✅ PR #105 MERGEADO | Auditoria completa de `createPageUrl()` vs rotas registradas: `ActionDashboard`→`Opportunities`, `Alerts`→`SmartAlerts`, `Calendar`→`MacroCalendar`, `ETFFlows`→`InstitutionalFlows`, `StablecoinFlow`→`InstitutionalFlows`, `Strategies`→`Opportunities`, `DerivativesAdvanced`→`Derivatives`. Deep-link via `Link state={{ tab }}` + `useLocation().state?.tab` em InstitutionalFlows/Opportunities/DerivativesPage — links do ExecutiveReport aterrisam na aba correta. Build ✅ |
| **ExecutiveReport crash fix** | ✅ PR #104 MERGEADO | `ExecutiveReport.jsx`: (1) `etf.funds[0].aum_b` → `etf.funds[0]?.aum_b ?? 0` — crashava quando `ETF_FLOWS_FALLBACK.funds` era `[]`; (2) `c.label.split(' ')[0]` → `c.label?.split(' ')?.[0] ?? '—'` — crashava com `components: []`. Auditoria em 8 outras páginas confirmou sem problemas. Build ✅ |
| **DebugPanel full visibility** | ✅ PR #103 MERGEADO | `debugLog.ts`: monkey-patch `console.error/warn` — todos os erros de todos os serviços (`supabase.ts`, `defillama.ts`, `fred.ts`, `yahooFinance.ts`, `aiPredictions.ts`) agora aparecem no painel 🐛 automaticamente, sem tocar em nenhum serviço. Guard `[DebugLog]` evita dupla entrada. Build ✅ |
| **Tier 1–7 — Dados reais (Math.sin/random eliminados)** | ✅ PR #112 MERGEADO | allForceOrders schema flat; IV delta Deribit; SpotFlow klines; ExecutiveReport OI Binance 30d; Automations 6 métricas live; Strategies P&L determinístico; GDELT timelinevolraw 24h |
| **Item 8 — SoSoValue ETF API** | ✅ WIRED | `src/services/sosovalue.ts` + `src/hooks/useSoSoValue.ts` criados; `ETFFlows.jsx` usa dados reais quando chave configurada; fallback para mock quando ausente; env.ts tem VITE_SOSOVALUE_KEY opcional; chave `SOSO-b0a05bd6ca044c2bb8239fb5ff062572` em `.env.local` |
| **Item 10 — MacroCalendar Event Volatility** | ✅ WIRED | `binance.ts` + `fetchKlinesAt()`; `src/utils/eventVolatility.ts` (`computeEventVolatilityRow` + `computeAvgVolatility` + `inferResult`); `src/hooks/useEventVolatility.ts`; `MacroCalendar.jsx` usa dados reais quando `IS_LIVE && pastEvents.length > 0`; fallback mock preservado; 13 testes novos; build ✅ · 283/283 ✅ |
| **Item 9 — Regime Score History Supabase** | ✅ WIRED | `supabase/migrations/20260517100000_regime_score_history.sql` criada; `upsertRegimeScore()`+`fetchRegimeHistory()` em `supabase.ts`; `useMarketRegime.ts` persiste score diariamente (fire-and-forget, guard localStorage `mrp_regime_saved_at`); `useRegimeHistory(90)` hook; `MarketRegime.jsx` usa histórico real (≥7 dias) com fallback estimado; `ExecutiveReport.jsx` usa histórico real (≥3 dias) com fallback linear; badges informativos distintos; build ✅ · 270/270 testes ✅ · **Ação manual necessária:** aplicar migration no Supabase Dashboard SQL Editor |
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
| **Fase 2 — Eliminar ilusão de dados** | ✅ CONCLUÍDA | 2026-05-17 | PRs #70–73 + fix SmartAlerts history badge |
| **Fase 3 — Dados reais gratuitos** | ✅ CONCLUÍDA | 2026-05-17 | Items 1–10 (PRs #112–115) |
| **Fase 4 — Testes e CI** | ✅ CONCLUÍDA | 2026-05-17 | 285 testes · CI .yml existe · thresholds 20%/15%/20%/20% |
| **Fase 5 — Deploy seguro** | ✅ CONCLUÍDA | 2026-05-17 | 0 vulnerabilidades · FRED → Edge Function · auth stub documentado |
| **Fase 6 — Observabilidade** | ✅ CONCLUÍDA | 2026-05-17 | debugLog.ts + DebugPanel + console.error/warn interceptado |

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
| **DeFiLlama** | `defillama.ts` | `stablecoins.llama.fi` | Sem key | Supply total stablecoins, top5 (USDT/USDC/DAI), supply por chain — TTL 1h cache |
| **Reddit JSON API** | `reddit.ts` | `www.reddit.com/r/*/search.json` | Sem key | Posts de r/ETFs + r/Bitcoin sobre BTC ETF flows — TTL 30min |

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
