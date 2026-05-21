/**
 * investingCalendar.test.ts — Testes do parser de calendário Investing.com
 *
 * Valida que apenas eventos de importância 3 são filtrados,
 * que a análise AI é gerada corretamente e que IDs são estáveis.
 *
 * Não usa cheerio — testa investingCalendarParser.ts (TypeScript puro).
 */

import { describe, it, expect } from 'vitest';
import {
  generateAiAnalysis,
  parseImportanceFromHtmlClass,
  getEventStatus,
  generateEventId,
} from '@/services/investingCalendarParser';

// ─── Fixtures de classes de ícones ───────────────────────────────────────────

/** 3 ícones preenchidos (importância 3) */
const HIGH_IMPORTANCE_CLASSES   = ['grayFullBullishIcon', 'grayFullBullishIcon', 'grayFullBullishIcon'];
/** 2 preenchidos + 1 vazio (importância 2) */
const MEDIUM_IMPORTANCE_CLASSES = ['grayFullBullishIcon', 'grayFullBullishIcon', 'grayEmptyBullishIcon'];
/** 1 preenchido + 2 vazios (importância 1) */
const LOW_IMPORTANCE_CLASSES    = ['grayFullBullishIcon', 'grayEmptyBullishIcon', 'grayEmptyBullishIcon'];

// ─── parseImportanceFromHtmlClass ────────────────────────────────────────────

describe('parseImportanceFromHtmlClass', () => {
  it('retorna 3 para 3 ícones preenchidos', () => {
    expect(parseImportanceFromHtmlClass(HIGH_IMPORTANCE_CLASSES)).toBe(3);
  });

  it('retorna 2 para 2 preenchidos + 1 vazio', () => {
    expect(parseImportanceFromHtmlClass(MEDIUM_IMPORTANCE_CLASSES)).toBe(2);
  });

  it('retorna 1 para 1 preenchido + 2 vazios', () => {
    expect(parseImportanceFromHtmlClass(LOW_IMPORTANCE_CLASSES)).toBe(1);
  });

  it('retorna 1 para array vazio', () => {
    expect(parseImportanceFromHtmlClass([])).toBe(1);
  });

  it('é case-insensitive: "Empty" e "empty" são tratados como vazios', () => {
    const mixed = ['grayFullBullishIcon', 'grayFullBullishIcon', 'icon-EMPTY'];
    expect(parseImportanceFromHtmlClass(mixed)).toBe(2);
  });
});

// ─── generateAiAnalysis — FOMC ────────────────────────────────────────────────

describe('generateAiAnalysis — FOMC', () => {
  it('FOMC: direction=neutral, probability=0.60', () => {
    const result = generateAiAnalysis({
      title:    'FOMC Meeting Minutes',
      forecast: null,
      previous: null,
      currency: 'USD',
    });
    expect(result.direction).toBe('neutral');
    expect(result.probability).toBe(0.60);
    expect(result.analysis.length).toBeGreaterThan(10);
  });

  it('Interest Rate Decision: direction=neutral', () => {
    const result = generateAiAnalysis({
      title:    'Fed Interest Rate Decision',
      forecast: '5.50%',
      previous: '5.50%',
      currency: 'USD',
    });
    expect(result.direction).toBe('neutral');
    expect(result.probability).toBe(0.60);
  });
});

// ─── generateAiAnalysis — CPI ─────────────────────────────────────────────────

describe('generateAiAnalysis — CPI/PCE', () => {
  it('CPI forecast > previous: direction=down (hawkish)', () => {
    const result = generateAiAnalysis({
      title:    'CPI m/m',
      forecast: '0.4',
      previous: '0.2',
      currency: 'USD',
    });
    expect(result.direction).toBe('down');
    expect(result.probability).toBe(0.63);
  });

  it('CPI forecast < previous: direction=up (dovish)', () => {
    const result = generateAiAnalysis({
      title:    'Core CPI y/y',
      forecast: '2.8',
      previous: '3.2',
      currency: 'USD',
    });
    expect(result.direction).toBe('up');
    expect(result.probability).toBe(0.59);
  });

  it('CPI sem forecast/previous: direction=neutral', () => {
    const result = generateAiAnalysis({
      title:    'CPI Release',
      forecast: null,
      previous: null,
      currency: 'USD',
    });
    expect(result.direction).toBe('neutral');
    expect(result.probability).toBe(0.50);
  });

  it('PCE é reconhecido como inflação', () => {
    const result = generateAiAnalysis({
      title:    'Core PCE Price Index',
      forecast: '2.5',
      previous: '2.7',
      currency: 'USD',
    });
    expect(result.direction).toBe('up');
  });
});

// ─── generateAiAnalysis — NFP ─────────────────────────────────────────────────

describe('generateAiAnalysis — NFP', () => {
  it('Nonfarm Payrolls: direction=neutral, probability=0.55', () => {
    const result = generateAiAnalysis({
      title:    'Nonfarm Payrolls',
      forecast: '180K',
      previous: '200K',
      currency: 'USD',
    });
    expect(result.direction).toBe('neutral');
    expect(result.probability).toBe(0.55);
    expect(result.analysis).toContain('NFP');
  });
});

// ─── generateAiAnalysis — GDP ─────────────────────────────────────────────────

describe('generateAiAnalysis — GDP', () => {
  it('GDP: direction=up, probability=0.52', () => {
    const result = generateAiAnalysis({
      title:    'GDP q/q',
      forecast: '2.1',
      previous: '1.8',
      currency: 'USD',
    });
    expect(result.direction).toBe('up');
    expect(result.probability).toBe(0.52);
  });
});

// ─── generateAiAnalysis — Initial Claims ──────────────────────────────────────

describe('generateAiAnalysis — Initial Claims', () => {
  it('Initial Jobless Claims: direction=up (dovish), probability=0.51', () => {
    const result = generateAiAnalysis({
      title:    'Initial Jobless Claims',
      forecast: '225K',
      previous: '210K',
      currency: 'USD',
    });
    expect(result.direction).toBe('up');
    expect(result.probability).toBe(0.51);
  });
});

// ─── generateAiAnalysis — padrão ─────────────────────────────────────────────

describe('generateAiAnalysis — default', () => {
  it('evento desconhecido: direction=neutral, probability=0.50', () => {
    const result = generateAiAnalysis({
      title:    'ISM Manufacturing PMI',
      forecast: '50.5',
      previous: '49.8',
      currency: 'USD',
    });
    expect(result.direction).toBe('neutral');
    expect(result.probability).toBe(0.50);
    expect(result.analysis.length).toBeGreaterThan(5);
  });

  it('análise nunca é string vazia', () => {
    const result = generateAiAnalysis({
      title:    '',
      forecast: null,
      previous: null,
      currency: null,
    });
    expect(result.analysis.length).toBeGreaterThan(0);
  });

  it('probability sempre entre 0 e 1', () => {
    const titles = [
      'FOMC Minutes', 'CPI m/m', 'Nonfarm Payrolls',
      'GDP q/q', 'Initial Jobless Claims', 'JOLTS Job Openings',
      'ISM Services PMI', 'Retail Sales',
    ];
    for (const title of titles) {
      const result = generateAiAnalysis({ title, forecast: null, previous: null, currency: 'USD' });
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    }
  });

  it('direction é sempre um valor válido', () => {
    const validDirections = ['up', 'down', 'neutral'];
    const result = generateAiAnalysis({
      title:    'Building Permits',
      forecast: null,
      previous: null,
      currency: 'USD',
    });
    expect(validDirections).toContain(result.direction);
  });
});

// ─── getEventStatus ───────────────────────────────────────────────────────────

describe('getEventStatus', () => {
  const futureUtc = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const pastUtc   = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  it('retorna "scheduled" quando actual é null', () => {
    expect(getEventStatus(futureUtc, null)).toBe('scheduled');
  });

  it('retorna "scheduled" quando actual é string vazia', () => {
    expect(getEventStatus(futureUtc, '')).toBe('scheduled');
  });

  it('retorna "released" quando actual tem valor', () => {
    expect(getEventStatus(pastUtc, '0.3%')).toBe('released');
  });

  it('retorna "released" para evento futuro com actual (dado adiantado)', () => {
    expect(getEventStatus(futureUtc, '0.3%')).toBe('released');
  });
});

// ─── generateEventId ─────────────────────────────────────────────────────────

describe('generateEventId', () => {
  it('gera ID com prefixo inv_', () => {
    const id = generateEventId('12345', '2026-05-21T13:30:00.000Z');
    expect(id).toMatch(/^inv_/);
  });

  it('ID tem formato esperado: inv_<eventId>_<YYYYMMDD>', () => {
    const id = generateEventId('12345', '2026-05-21T13:30:00.000Z');
    expect(id).toBe('inv_12345_20260521');
  });

  it('ID é estável para mesma entrada', () => {
    const id1 = generateEventId('99', '2026-06-04T15:00:00.000Z');
    const id2 = generateEventId('99', '2026-06-04T15:00:00.000Z');
    expect(id1).toBe(id2);
  });

  it('IDs diferentes para eventos diferentes', () => {
    const id1 = generateEventId('100', '2026-05-21T13:30:00.000Z');
    const id2 = generateEventId('200', '2026-05-21T13:30:00.000Z');
    expect(id1).not.toBe(id2);
  });
});
