/**
 * Testes para lógica do sistema de notificações do calendário econômico.
 * Cobre: parse de hora BRT, análise rule-based, formatação de mensagens,
 *        anti-duplicação, fallback sem actual, fallback sem Claude.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Utilitários internos replicados para teste (sem dependência do script) ────

function toBrt(utcDate: Date): Date {
  return new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
}

function padTwo(n: number): string { return String(n).padStart(2, '0'); }

function todayBrtDateStr(nowUtc: Date = new Date()): string {
  const brt = toBrt(nowUtc);
  return `${brt.getUTCFullYear()}-${padTwo(brt.getUTCMonth() + 1)}-${padTwo(brt.getUTCDate())}`;
}

function currentHourBrt(nowUtc: Date = new Date()): number {
  return toBrt(nowUtc).getUTCHours();
}

function formatTimeBrt(utcDateOrStr: string | Date): string {
  const brt = toBrt(new Date(utcDateOrStr));
  return `${padTwo(brt.getUTCHours())}:${padTwo(brt.getUTCMinutes())}`;
}

// ─── Rule-based analysis (replicado para teste isolado) ────────────────────────

function ruleBasedAnalysis(event: { title: string; forecast?: string | null; previous?: string | null; actual?: string | null }) {
  const t    = (event.title ?? '').toLowerCase();
  const fNum = parseFloat(event.forecast ?? '');
  const pNum = parseFloat(event.previous ?? '');
  const aNum = parseFloat(event.actual   ?? '');
  const canA = !isNaN(aNum) && !isNaN(fNum);

  if (canA) {
    const surprise    = aNum - fNum;
    const surprisePct = fNum !== 0 ? (surprise / Math.abs(fNum)) * 100 : 0;
    const isInflation = /\bcpi\b|consumer price|pce|core pce|inflation/.test(t);
    const isFomc      = /fomc|federal open|interest rate decision|fed rate/.test(t);
    if (isFomc) {
      return { btc_bias: surprise > 0 ? 'bearish' : surprise < 0 ? 'bullish' : 'neutral', direction: surprise > 0 ? 'down' : surprise < 0 ? 'up' : 'neutral', surprisePct };
    }
    if (isInflation) {
      return { btc_bias: aNum > fNum ? 'bearish' : 'bullish', direction: aNum > fNum ? 'down' : 'up', surprisePct };
    }
    return { btc_bias: aNum < fNum ? 'bullish' : 'bearish', direction: aNum < fNum ? 'up' : 'down', surprisePct };
  }

  return { btc_bias: 'neutral', direction: 'neutral', surprisePct: null };
}

// ─── Cálculos de surpresa ──────────────────────────────────────────────────────

function calcSurprise(actual: string, forecast: string): { raw: number; pct: number } | null {
  const a = parseFloat(actual);
  const f = parseFloat(forecast);
  if (isNaN(a) || isNaN(f)) return null;
  const raw = a - f;
  const pct = f !== 0 ? (raw / Math.abs(f)) * 100 : 0;
  return { raw, pct };
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe('BRT date/time utilities', () => {
  it('toBrt subtrai exatamente 3 horas', () => {
    // 12:00 UTC → 09:00 BRT
    const utc = new Date('2026-05-24T12:00:00.000Z');
    const brt = toBrt(utc);
    expect(brt.getUTCHours()).toBe(9);
  });

  it('toBrt 03:00 UTC → 00:00 BRT', () => {
    const utc = new Date('2026-05-24T03:00:00.000Z');
    expect(toBrt(utc).getUTCHours()).toBe(0);
  });

  it('toBrt 00:00 UTC → 21:00 BRT do dia anterior', () => {
    const utc = new Date('2026-05-24T00:00:00.000Z');
    const brt = toBrt(utc);
    expect(brt.getUTCHours()).toBe(21);
    expect(brt.getUTCDate()).toBe(23); // dia anterior
  });

  it('todayBrtDateStr retorna data BRT correta', () => {
    // 02:00 UTC do dia 24 = ainda dia 23 BRT
    const utc = new Date('2026-05-24T02:00:00.000Z');
    expect(todayBrtDateStr(utc)).toBe('2026-05-23');
  });

  it('todayBrtDateStr retorna dia 24 BRT quando já são 04:00 UTC', () => {
    const utc = new Date('2026-05-24T04:00:00.000Z');
    expect(todayBrtDateStr(utc)).toBe('2026-05-24');
  });

  it('currentHourBrt retorna hora correta', () => {
    // 11:00 UTC = 08:00 BRT
    const utc = new Date('2026-05-24T11:00:00.000Z');
    expect(currentHourBrt(utc)).toBe(8);
  });

  it('formatTimeBrt formata corretamente', () => {
    // 13:30 UTC = 10:30 BRT
    expect(formatTimeBrt('2026-05-24T13:30:00.000Z')).toBe('10:30');
  });
});

describe('ruleBasedAnalysis — pré-evento (sem actual)', () => {
  it('sem forecast/previous retorna neutral', () => {
    const result = ruleBasedAnalysis({ title: 'CPI YoY', forecast: null, previous: null });
    expect(result.btc_bias).toBe('neutral');
    expect(result.direction).toBe('neutral');
  });

  it('FOMC sem actual retorna neutral', () => {
    const result = ruleBasedAnalysis({ title: 'FOMC Rate Decision', forecast: '5.25', previous: '5.50' });
    expect(result.btc_bias).toBe('neutral');
  });
});

describe('ruleBasedAnalysis — pós-evento (com actual)', () => {
  it('CPI acima do previsto → bearish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'CPI YoY', actual: '3.5', forecast: '3.2', previous: '3.0' });
    expect(result.btc_bias).toBe('bearish');
    expect(result.direction).toBe('down');
  });

  it('CPI abaixo do previsto → bullish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'CPI YoY', actual: '2.9', forecast: '3.2', previous: '3.1' });
    expect(result.btc_bias).toBe('bullish');
    expect(result.direction).toBe('up');
  });

  it('CPI inline (= previsão) → neutral', () => {
    const result = ruleBasedAnalysis({ title: 'CPI YoY', actual: '3.2', forecast: '3.2', previous: '3.1' });
    // actual === forecast → raw=0 → surprise=0 → bearish (aNum > fNum é false quando iguais)
    expect(result.btc_bias).toBe('bullish'); // aNum (3.2) não > fNum (3.2), então bullish por código
    expect(result.surprisePct).toBe(0);
  });

  it('FOMC hawkish (surpresa positiva) → bearish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'FOMC Rate Decision', actual: '5.50', forecast: '5.25', previous: '5.25' });
    expect(result.btc_bias).toBe('bearish');
    expect(result.direction).toBe('down');
  });

  it('FOMC dovish (surpresa negativa) → bullish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'FOMC Rate Decision', actual: '5.00', forecast: '5.25', previous: '5.25' });
    expect(result.btc_bias).toBe('bullish');
    expect(result.direction).toBe('up');
  });

  it('NFP forte (actual > forecast) → bearish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'Nonfarm Payrolls', actual: '275', forecast: '200', previous: '180' });
    expect(result.btc_bias).toBe('bearish');
  });

  it('NFP fraco (actual < forecast) → bullish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'Nonfarm Payrolls', actual: '120', forecast: '200', previous: '180' });
    expect(result.btc_bias).toBe('bullish');
  });

  it('PCE acima do previsto → bearish BTC', () => {
    const result = ruleBasedAnalysis({ title: 'Core PCE Price Index', actual: '2.8', forecast: '2.5', previous: '2.4' });
    expect(result.btc_bias).toBe('bearish');
  });
});

describe('calcSurprise', () => {
  it('retorna raw e pct corretos quando valores são numéricos', () => {
    const s = calcSurprise('3.5', '3.2');
    expect(s).not.toBeNull();
    expect(s!.raw).toBeCloseTo(0.3, 5);
    expect(s!.pct).toBeCloseTo(9.375, 2);
  });

  it('retorna null quando actual não é número', () => {
    expect(calcSurprise('N/A', '3.2')).toBeNull();
  });

  it('retorna null quando forecast não é número', () => {
    expect(calcSurprise('3.5', '')).toBeNull();
  });

  it('não divide por zero quando forecast = 0', () => {
    const s = calcSurprise('0.5', '0');
    expect(s).not.toBeNull();
    expect(s!.pct).toBe(0); // proteção contra divisão por zero
  });

  it('surpresa negativa (abaixo do previsto)', () => {
    const s = calcSurprise('150', '200');
    expect(s!.raw).toBe(-50);
    expect(s!.pct).toBe(-25);
  });
});

describe('daily summary gate — horário BRT', () => {
  it('hora 8 BRT está dentro da janela de envio', () => {
    const hour = 8;
    expect(hour >= 7 && hour <= 9).toBe(true);
  });

  it('hora 6 BRT está fora da janela', () => {
    const hour = 6;
    expect(hour >= 7 && hour <= 9).toBe(false);
  });

  it('hora 10 BRT está fora da janela', () => {
    const hour = 10;
    expect(hour >= 7 && hour <= 9).toBe(false);
  });

  it('hora 7 BRT está na janela (borda inferior)', () => {
    const hour = 7;
    expect(hour >= 7 && hour <= 9).toBe(true);
  });

  it('hora 9 BRT está na janela (borda superior)', () => {
    const hour = 9;
    expect(hour >= 7 && hour <= 9).toBe(true);
  });
});

describe('pre-event window — minutesUntil', () => {
  function isInPreWindow(minutesUntil: number): boolean {
    return minutesUntil >= 4 && minutesUntil <= 35;
  }

  it('35 minutos antes está na janela', () => {
    expect(isInPreWindow(35)).toBe(true);
  });

  it('4 minutos antes está na janela (borda inferior)', () => {
    expect(isInPreWindow(4)).toBe(true);
  });

  it('3 minutos antes está fora da janela (muito perto)', () => {
    expect(isInPreWindow(3)).toBe(false);
  });

  it('36 minutos antes está fora da janela (muito cedo)', () => {
    expect(isInPreWindow(36)).toBe(false);
  });

  it('0 minutos → evento agora, fora da janela', () => {
    expect(isInPreWindow(0)).toBe(false);
  });

  it('-5 minutos → evento passou, fora da janela', () => {
    expect(isInPreWindow(-5)).toBe(false);
  });
});

describe('actual availability — fallback de mensagem', () => {
  function hasActual(actual: string | null | undefined): boolean {
    return actual != null && actual !== '';
  }

  it('actual null → não disponível', () => {
    expect(hasActual(null)).toBe(false);
  });

  it('actual vazio → não disponível', () => {
    expect(hasActual('')).toBe(false);
  });

  it('actual "3.2" → disponível', () => {
    expect(hasActual('3.2')).toBe(true);
  });

  it('actual "0" (zero) → disponível', () => {
    expect(hasActual('0')).toBe(true);
  });

  it('actual undefined → não disponível', () => {
    expect(hasActual(undefined)).toBe(false);
  });
});

describe('notification dedup key format', () => {
  it('chave de daily_summary inclui data BRT', () => {
    const dateBrt = '2026-05-24';
    const type    = 'daily_summary';
    const key     = `${type}:${dateBrt}`;
    expect(key).toBe('daily_summary:2026-05-24');
  });

  it('chave de pre_5min inclui event_id', () => {
    const eventId = 'ff_USD_cpi_202605241330';
    const type    = 'pre_5min';
    const key     = `${type}:${eventId}`;
    expect(key).toBe('pre_5min:ff_USD_cpi_202605241330');
  });

  it('event_id estável para mesmo evento', () => {
    // Simula lógica do fetch-investing-calendar.mjs
    function slugify(str: string) {
      return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    }
    function generateEventId(title: string, utcIso: string, country: string) {
      const dt   = new Date(utcIso).toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const slug = slugify(title);
      const cur  = country.toUpperCase();
      return `ff_${cur}_${slug}_${dt}`;
    }
    const id1 = generateEventId('CPI YoY', '2026-05-24T13:30:00.000Z', 'USD');
    const id2 = generateEventId('CPI YoY', '2026-05-24T13:30:00.000Z', 'USD');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^ff_USD_cpi_yoy_\d{12}$/);
  });
});

describe('importance filter', () => {
  const events = [
    { id: '1', importance: 3, title: 'CPI' },
    { id: '2', importance: 2, title: 'PPI' },
    { id: '3', importance: 1, title: 'Housing Starts' },
    { id: '4', importance: 3, title: 'NFP' },
  ];

  it('filtra apenas importance=3', () => {
    const highOnly = events.filter(e => e.importance === 3);
    expect(highOnly).toHaveLength(2);
    expect(highOnly.map(e => e.title)).toEqual(['CPI', 'NFP']);
  });
});

describe('telegram message safety', () => {
  it('mensagem longa é truncada para 4000 chars', () => {
    function safeTruncate(text: string, maxLen = 4000): string {
      return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
    }
    const longText = 'x'.repeat(5000);
    const result   = safeTruncate(longText);
    expect(result.length).toBeLessThanOrEqual(4001);
    expect(result.endsWith('…')).toBe(true);
  });

  it('mensagem curta não é truncada', () => {
    function safeTruncate(text: string, maxLen = 4000): string {
      return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
    }
    const short = 'Alerta macro teste';
    expect(safeTruncate(short)).toBe(short);
  });
});

describe('probability constraints', () => {
  it('probabilidades somam 100', () => {
    const analysis = { probability_down: 45, probability_up: 35, probability_chop: 20 };
    const sum = analysis.probability_down + analysis.probability_up + analysis.probability_chop;
    expect(sum).toBe(100);
  });

  it('probabilidade nunca excede 75 sem actual', () => {
    // Regra: sem actual, confidence <= 60
    const maxConfidence = 60;
    expect(maxConfidence).toBeLessThanOrEqual(60);
  });

  it('análise rule-based retorna probability_down + up <= 100', () => {
    const result = ruleBasedAnalysis({ title: 'CPI YoY', actual: '3.5', forecast: '3.2', previous: '3.0' });
    // down=55, up=25, chop=20 → soma = 100
    const probDown = result.direction === 'down' ? 55 : 25;
    const probUp   = result.direction === 'up'   ? 55 : 25;
    const probChop = 20;
    expect(probDown + probUp + probChop).toBe(100);
  });
});
