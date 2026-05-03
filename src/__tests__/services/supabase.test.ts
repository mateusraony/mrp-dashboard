/**
 * supabase.test.ts — testes de fallback e RLS para serviço Supabase
 *
 * Em ambiente de teste, VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão
 * definidas → isSupabaseConfigured() retorna false → todas as funções usam
 * fallback local (mock data / defaults) sem lançar erro.
 *
 * Valida:
 *   - Fallback gracioso quando Supabase não configurado
 *   - Funções retornam shapes corretos no modo mock
 *   - upsert em mock mode retorna dado com id gerado
 */

import { describe, it, expect } from 'vitest';
import {
  isSupabaseConfigured,
  fetchAlertRules,
  fetchUserSettings,
  upsertAlertRule,
  upsertPortfolioPosition,
  fetchGdeltSentimentHistory,
} from '@/services/supabase';

describe('isSupabaseConfigured (sem credenciais)', () => {
  it('retorna false quando VITE_SUPABASE_URL não está definida', () => {
    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe('fetchAlertRules — fallback quando Supabase não configurado', () => {
  it('retorna array de regras (fallback mock)', async () => {
    const rules = await fetchAlertRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('cada regra tem campos obrigatórios (type, label, threshold)', async () => {
    const rules = await fetchAlertRules();
    for (const r of rules) {
      expect(typeof r.type).toBe('string');
      expect(typeof r.label).toBe('string');
      expect(typeof r.threshold).toBe('number');
    }
  });
});

describe('fetchUserSettings — fallback quando Supabase não configurado', () => {
  it('retorna defaults sem lançar erro', async () => {
    const settings = await fetchUserSettings();
    expect(settings).toHaveProperty('data_mode');
    expect(settings).toHaveProperty('base_currency');
    expect(settings).toHaveProperty('theme');
    expect(settings).toHaveProperty('notifications');
  });

  it('data_mode padrão é mock', async () => {
    const settings = await fetchUserSettings();
    expect(settings.data_mode).toBe('mock');
  });
});

describe('upsertAlertRule — modo mock (sem Supabase)', () => {
  it('retorna regra com id gerado quando id não fornecido', async () => {
    const rule = {
      type: 'funding_rate',
      label: 'Funding Extremo',
      enabled: true,
      condition: '>',
      threshold: 0.08,
      threshold_unit: '%',
      notify: ['in-app'] as string[],
      cooldown_min: 60,
    };
    const result = await upsertAlertRule(rule);
    expect(result.id).toBeTruthy();
    expect(result.label).toBe('Funding Extremo');
    expect(result.threshold).toBe(0.08);
  });

  it('preserva id quando fornecido', async () => {
    const rule = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      type: 'price',
      label: 'Test',
      enabled: true,
      condition: '>',
      threshold: 100000,
      threshold_unit: 'USD',
      notify: ['in-app'] as string[],
      cooldown_min: 30,
    };
    const result = await upsertAlertRule(rule);
    expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });
});

describe('upsertPortfolioPosition — modo mock (sem Supabase)', () => {
  it('retorna posição com id quando não fornecido', async () => {
    const pos = {
      type: 'spot' as const,
      asset: 'BTC',
      size: 0.5,
      side: 'long' as const,
      entry_price: 95000,
    };
    const result = await upsertPortfolioPosition(pos);
    expect(result.id).toBeTruthy();
    expect(result.asset).toBe('BTC');
    expect(result.entry_price).toBe(95000);
  });
});

describe('fetchGdeltSentimentHistory — retorna vazio sem Supabase', () => {
  it('retorna array vazio quando não configurado', async () => {
    const history = await fetchGdeltSentimentHistory(7);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
  });
});
