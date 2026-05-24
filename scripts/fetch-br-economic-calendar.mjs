#!/usr/bin/env node
/**
 * fetch-br-economic-calendar.mjs — Calendário econômico brasileiro
 *
 * Fontes:
 *   1. BCB OpenData API — eventos do Banco Central (Copom, Notas de Crédito, etc.)
 *      https://www.bcb.gov.br/api/servico/sitebcb/agendadivulgacoes/obter
 *   2. Calendário estático IBGE/FGV/MTE/STN para 2026 (datas publicadas oficialmente)
 *      Fonte: https://www.ibge.gov.br/metodos-e-ferramentas/calendarios.html
 *
 * Todas as datas são de calendários oficiais publicados antecipadamente pelas agências.
 * actual = null enquanto não liberado; atualizado via fetch-actual-values.mjs
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Calendário estático IBGE/FGV/MTE/STN para 2026 ─────────────────────────
// Datas de referência: calendários oficiais das respectivas agências.
// Horários padrão de publicação em BRT (horário de Brasília, UTC-3):
//   IBGE publica às 09:00 BRT
//   FGV publica às 08:00 BRT
//   BCB/STN publicam às 08:30 BRT
//   MTE/CAGED publica às 14:00 BRT

const STATIC_BR_CALENDAR_2026 = [
  // ─── Janeiro 2026 ───────────────────────────────────────────────────────────
  { date: '2026-01-08T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-01-08T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-01-09T11:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-01-28T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-01-28T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-01-28T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-01-29T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-01-29T11:30:00Z', title: 'Investimento Estrangeiro Direto (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-01-29T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Fevereiro 2026 ─────────────────────────────────────────────────────────
  { date: '2026-02-05T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-02-05T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-02-05T11:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-02-26T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-02-26T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-02-26T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-02-26T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-02-26T11:30:00Z', title: 'Investimento Estrangeiro Direto (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-02-26T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Março 2026 ─────────────────────────────────────────────────────────────
  { date: '2026-03-05T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-03-05T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-03-05T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-03-27T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-03-27T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-03-31T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-03-26T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-03-26T11:30:00Z', title: 'Investimento Estrangeiro Direto (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-03-31T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Abril 2026 ─────────────────────────────────────────────────────────────
  { date: '2026-04-09T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-04-09T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-04-09T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-04-24T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-04-24T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-04-30T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-04-24T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-04-24T11:30:00Z', title: 'Investimento Estrangeiro Direto (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-04-30T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Maio 2026 ──────────────────────────────────────────────────────────────
  { date: '2026-05-08T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-05-08T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-05-26T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2, actual: '-6.04B', status: 'released' },
  { date: '2026-05-26T11:30:00Z', title: 'Investimento Estrangeiro Direto (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2, actual: '6.04B', status: 'released' },
  { date: '2026-05-27T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3, actual: '0.89%', status: 'released' },
  { date: '2026-05-27T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3, actual: '4.37%', status: 'released' },
  { date: '2026-05-28T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3, actual: '2.73%', status: 'released' },
  { date: '2026-05-29T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3, actual: '6.1%', status: 'released' },
  { date: '2026-05-29T11:00:00Z', title: 'PIB do Brasil (Trimestral)', agency: 'IBGE', category: 'pib', unit: '%', importance: 3, actual: '0.1%', status: 'released' },
  { date: '2026-05-29T11:00:00Z', title: 'PIB do Brasil (Anual)', agency: 'IBGE', category: 'pib', unit: '%', importance: 3, actual: '1.8%', status: 'released' },
  { date: '2026-05-29T11:30:00Z', title: 'Superávit Orçamentário', agency: 'STN', category: 'fiscal', unit: 'B', importance: 2, actual: '-80.676B', status: 'released' },
  { date: '2026-05-29T12:00:00Z', title: 'Dívida Bruta/PIB', agency: 'BCB/STN', category: 'fiscal', unit: '%', importance: 2, actual: '80.1%', status: 'released' },
  { date: '2026-05-29T17:30:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2, actual: '228.21K', status: 'released' },

  // ─── Junho 2026 ─────────────────────────────────────────────────────────────
  { date: '2026-06-04T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-06-04T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-06-04T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-06-26T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-06-26T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-06-30T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-06-26T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-06-26T11:30:00Z', title: 'Investimento Estrangeiro Direto (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-06-30T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Julho 2026 ─────────────────────────────────────────────────────────────
  { date: '2026-07-09T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-07-09T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-07-09T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-07-10T11:00:00Z', title: 'PIB do Brasil (Trimestral)', agency: 'IBGE', category: 'pib', unit: '%', importance: 3 },
  { date: '2026-07-10T11:00:00Z', title: 'PIB do Brasil (Anual)', agency: 'IBGE', category: 'pib', unit: '%', importance: 3 },
  { date: '2026-07-24T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-07-24T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-07-31T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-07-24T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-07-31T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Agosto 2026 ────────────────────────────────────────────────────────────
  { date: '2026-08-06T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-08-06T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-08-06T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-08-28T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-08-28T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-08-31T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-08-28T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-08-31T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Setembro 2026 ──────────────────────────────────────────────────────────
  { date: '2026-09-10T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-09-10T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-09-10T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-09-25T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-09-25T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-09-30T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-09-25T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-09-30T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Outubro 2026 ───────────────────────────────────────────────────────────
  { date: '2026-10-08T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-10-08T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-10-08T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-10-30T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-10-30T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-10-30T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-10-30T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-10-30T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Novembro 2026 ──────────────────────────────────────────────────────────
  { date: '2026-11-05T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-11-05T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-11-05T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
  { date: '2026-11-27T11:00:00Z', title: 'IPCA-15 (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-11-27T11:00:00Z', title: 'IPCA-15 Acumulado 12 meses (Anual)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-11-30T11:00:00Z', title: 'IGP-M (Mensal)', agency: 'FGV', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-11-27T11:30:00Z', title: 'Transações Correntes (USD)', agency: 'BCB', category: 'balanco_pagamentos', unit: 'B', importance: 2 },
  { date: '2026-11-30T17:00:00Z', title: 'Índice de Evolução de Emprego do CAGED', agency: 'MTE', category: 'emprego', unit: 'K', importance: 2 },

  // ─── Dezembro 2026 ──────────────────────────────────────────────────────────
  { date: '2026-12-10T11:00:00Z', title: 'IPCA (Mensal)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-12-10T11:00:00Z', title: 'IPCA (Acumulado 12m)', agency: 'IBGE', category: 'inflacao', unit: '%', importance: 3 },
  { date: '2026-12-10T12:00:00Z', title: 'Taxa de Desemprego no Brasil (PNAD Contínua)', agency: 'IBGE', category: 'emprego', unit: '%', importance: 3 },
];

// ─── Copom 2026 (Banco Central — datas oficiais publicadas em nov/2025) ───────
// Fonte: https://www.bcb.gov.br/controleinflacao/reunioescopom
const COPOM_2026 = [
  { date: '2026-01-28T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', previous: '12.25%', importance: 3 },
  { date: '2026-03-18T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', previous: '13.25%', importance: 3 },
  { date: '2026-05-06T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', previous: '14.25%', importance: 3 },
  { date: '2026-06-17T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', importance: 3 },
  { date: '2026-07-29T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', importance: 3 },
  { date: '2026-09-16T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', importance: 3 },
  { date: '2026-11-04T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', importance: 3 },
  { date: '2026-12-09T22:00:00Z', title: 'Decisão da Taxa de Juros — Copom', importance: 3 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function generateBrEventId(title, dateUtc, agency) {
  const dt  = new Date(dateUtc).toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const slug = slugify(title);
  const src  = agency.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6);
  return `br_${src}_${slug}_${dt}`;
}

function toBrtIso(utcDate) {
  const brtMs = utcDate.getTime() - 3 * 60 * 60 * 1000;
  return new Date(brtMs).toISOString().replace('Z', '-03:00');
}

function ruleBasedAnalysis(title) {
  const t = title.toLowerCase();
  if (/ipca|inflac/.test(t))    return { analysis: 'IPCA acima do esperado = hawkish Copom → real pressionado. Abaixo = descompressão inflacionária.', direction: 'neutral', probability: 0.50 };
  if (/pib|gdp/.test(t))         return { analysis: 'PIB forte = economia saudável. Fraco = risco de estagflação.', direction: 'neutral', probability: 0.50 };
  if (/desemprego|pnad/.test(t)) return { analysis: 'Desemprego alto = fraqueza econômica. Baixo = aquecimento = pressão inflacionária.', direction: 'neutral', probability: 0.50 };
  if (/igp|fgv/.test(t))         return { analysis: 'IGP-M elevado pressiona contratos indexados (aluguel, infraestrutura).', direction: 'neutral', probability: 0.50 };
  if (/caged|emprego/.test(t))   return { analysis: 'CAGED positivo = geração de empregos. Negativo = fraqueza do mercado formal.', direction: 'neutral', probability: 0.50 };
  if (/copom|selic|juros/.test(t)) return { analysis: 'Copom: manutenção = neutro. Corte = dovish = bullish BRL ativos. Alta = hawkish = bearish.', direction: 'neutral', probability: 0.50 };
  if (/transac|balan|ied/.test(t)) return { analysis: 'Saldo do balanço de pagamentos. IED positivo = entrada de capital externo.', direction: 'neutral', probability: 0.50 };
  return { analysis: 'Dado econômico brasileiro de relevância para câmbio e mercado doméstico.', direction: 'neutral', probability: 0.50 };
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    apikey:          SUPABASE_SERVICE_ROLE_KEY,
    Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type':  'application/json',
  };
}

async function upsertToSupabase(rows) {
  if (rows.length === 0) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/economic_calendar_events`, {
    method:  'POST',
    headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upsert falhou: ${res.status} — ${text.slice(0, 300)}`);
  }
  return rows.length;
}

async function logJobToSupabase(jobData) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/system_job_log`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
      body:    JSON.stringify({
        job_name:       'fetch-br-economic-calendar',
        status:         jobData.status,
        events_found:   jobData.total_events ?? 0,
        events_updated: jobData.upserted ?? 0,
        duration_ms:    jobData.duration_ms ?? 0,
        error_message:  jobData.error ?? null,
        metadata:       jobData,
      }),
    });
  } catch { /* não crítico */ }
}

// ─── Tentativa BCB OpenData (agenda de divulgações) ───────────────────────────

async function fetchBcbAgenda() {
  try {
    const url = 'https://www.bcb.gov.br/api/servico/sitebcb/agendadivulgacoes/obter?quantidade=100&filtro=';
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MRPDashboard/1.0)',
        Accept:       'application/json',
      },
    });
    clearTimeout(tid);
    if (!res.ok) { console.warn(`[bcb-agenda] HTTP ${res.status}`); return []; }
    const data = await res.json();
    // Estrutura BCB: { value: [ { dataAgenda, titulo, subtitulo, dataPublicacao, link } ] }
    const items = data?.value ?? data ?? [];
    if (!Array.isArray(items)) return [];

    const now    = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // últimos 30 dias

    return items
      .filter(item => {
        const dt = new Date(item.dataAgenda ?? item.DataAgenda ?? item.data ?? '');
        return !isNaN(dt.getTime()) && dt >= cutoff;
      })
      .map(item => {
        const rawDate = item.dataAgenda ?? item.DataAgenda ?? item.data ?? '';
        const utcDate = new Date(rawDate);
        const title   = item.titulo ?? item.Titulo ?? item.descricao ?? 'Evento BCB';
        const subtile = item.subtitulo ?? item.Subtitulo ?? null;
        const fullTitle = subtile ? `${title} — ${subtile}` : title;
        const ai = ruleBasedAnalysis(fullTitle);
        const hasActual = false; // BCB agenda não retorna valores, apenas datas

        return {
          id:             generateBrEventId(fullTitle, utcDate.toISOString(), 'BCB'),
          source:         'bcb.gov.br',
          source_url:     'https://www.bcb.gov.br/publicacoes/agendadivulgacoes',
          country:        'BRL',
          currency:       'BRL',
          title:          fullTitle,
          category:       'bcb',
          datetime_utc:   utcDate.toISOString(),
          datetime_brt:   toBrtIso(utcDate),
          importance:     3,
          actual:         null,
          forecast:       null,
          previous:       null,
          unit:           null,
          status:         'scheduled',
          ai_analysis:    ai.analysis,
          ai_probability: ai.probability,
          ai_direction:   ai.direction,
          notify_state:   null,
          raw_payload:    item,
          fetched_at:     new Date().toISOString(),
        };
      });
  } catch (err) {
    console.warn('[bcb-agenda] Erro ao buscar agenda BCB:', String(err));
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  }

  const startTime = Date.now();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  fetch-br-economic-calendar.mjs');
  console.log(`  Início: ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Calendário estático IBGE/FGV/MTE/STN
  const staticRows = [];
  const allStatic  = [...STATIC_BR_CALENDAR_2026, ...COPOM_2026];

  for (const ev of allStatic) {
    const utcDate  = new Date(ev.date);
    const ai       = ruleBasedAnalysis(ev.title);
    const hasActual = ev.actual != null && ev.actual !== '';

    staticRows.push({
      id:             generateBrEventId(ev.title, ev.date, ev.agency ?? 'BR'),
      source:         `${(ev.agency ?? 'BR').toLowerCase().replace(/[^a-z]/g, '')}.gov.br`,
      source_url:     'https://www.ibge.gov.br/metodos-e-ferramentas/calendarios.html',
      country:        'BRL',
      currency:       'BRL',
      title:          ev.title,
      category:       ev.category ?? null,
      datetime_utc:   utcDate.toISOString(),
      datetime_brt:   toBrtIso(utcDate),
      importance:     ev.importance ?? 3,
      actual:         ev.actual ?? null,
      forecast:       ev.forecast ?? null,
      previous:       ev.previous ?? null,
      revised:        null,
      unit:           ev.unit ?? null,
      status:         ev.status ?? (hasActual ? 'released' : utcDate < new Date() ? 'released' : 'scheduled'),
      ai_analysis:    ai.analysis,
      ai_probability: ai.probability,
      ai_direction:   ai.direction,
      notify_state:   null,
      raw_payload:    ev,
      fetched_at:     new Date().toISOString(),
    });
  }
  console.log(`  Calendário estático: ${staticRows.length} eventos`);

  // 2. BCB Agenda (best-effort — não bloqueia se falhar)
  const bcbRows  = await fetchBcbAgenda();
  console.log(`  BCB Agenda API: ${bcbRows.length} eventos`);

  // 3. Deduplicar por ID (estático tem prioridade sobre BCB se mesmo ID)
  const seenIds = new Set(staticRows.map(r => r.id));
  const uniqueBcb = bcbRows.filter(r => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  const allRows = [...staticRows, ...uniqueBcb];
  console.log(`  Total a upsert: ${allRows.length} eventos`);

  // Log dos eventos de hoje e próximos 7 dias para verificação
  const now     = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = allRows.filter(r => {
    const dt = new Date(r.datetime_utc);
    return dt >= new Date(now.getTime() - 24 * 60 * 60 * 1000) && dt <= in7days;
  });
  if (upcoming.length > 0) {
    console.log('  [verify] Próximos 7 dias:');
    upcoming.forEach(r => {
      console.log(`    ${r.datetime_utc.slice(0, 16)} BRL | ${r.importance}★ | ${r.title} | actual=${r.actual ?? '-'}`);
    });
  }

  const upserted   = await upsertToSupabase(allRows);
  const durationMs = Date.now() - startTime;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Upsertados: ${upserted}`);
  console.log(`  Duração:   ${durationMs}ms`);
  console.log(`  Status:    ✅ Sucesso`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await logJobToSupabase({ status: 'success', total_events: allRows.length, upserted, duration_ms: durationMs, static_events: staticRows.length, bcb_events: uniqueBcb.length });
}

main().catch(async (err) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  ERRO FATAL:', String(err));
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await logJobToSupabase({ status: 'error', error: String(err) }).catch(() => {});
  process.exit(1);
});
