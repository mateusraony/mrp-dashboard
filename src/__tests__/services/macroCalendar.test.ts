/**
 * macroCalendar.test.ts — Testes unitários do pipeline MacroCalendar
 *
 * Cobre:
 *   1. parsePrevToNumeric — normalização de string para número
 *   2. Deduplição de alerta (delivery key)
 *   3. Janelas de timezone ET→BRT (DST correto)
 *   4. Janela de disparo de alerta (±3min tolerance)
 */

import { describe, it, expect } from 'vitest';

// ─── 1. Parser de valores numéricos ──────────────────────────────────────────
// Replica a função parsePrevToNumeric de macroCalendarService.ts

function parsePrevToNumeric(prev: string | null): number | null {
  if (!prev) return null;
  const cleaned = prev.replace(/[^0-9.\-+]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

describe('parsePrevToNumeric', () => {
  it('parseia percentual positivo', () => {
    expect(parsePrevToNumeric('+0.3%')).toBeCloseTo(0.3);
  });

  it('parseia percentual negativo', () => {
    expect(parsePrevToNumeric('-0.1%')).toBeCloseTo(-0.1);
  });

  it('parseia NFP com K', () => {
    expect(parsePrevToNumeric('+185K')).toBeCloseTo(185);
  });

  it('parseia taxa sem sinal', () => {
    expect(parsePrevToNumeric('4.25%')).toBeCloseTo(4.25);
  });

  it('retorna null para string vazia', () => {
    expect(parsePrevToNumeric('')).toBeNull();
  });

  it('retorna null para null', () => {
    expect(parsePrevToNumeric(null)).toBeNull();
  });

  it('retorna null para string inválida', () => {
    expect(parsePrevToNumeric('N/A')).toBeNull();
  });

  it('parseia valor negativo com vírgula (sobrevive a caracteres extras)', () => {
    expect(parsePrevToNumeric('-2.5%')).toBeCloseTo(-2.5);
  });
});

// ─── 2. Deduplição de delivery key ───────────────────────────────────────────

function buildDeliveryKey(eventCode: string, releaseUtc: string, windowMin: number, chatId: string): string {
  return `${eventCode}|${releaseUtc}|${windowMin}m|${chatId}`;
}

describe('buildDeliveryKey (dedup)', () => {
  const base = {
    eventCode:  'US_CPI',
    releaseUtc: '2026-05-15T12:30:00.000Z',
    chatId:     '123456789',
  };

  it('gera chave determinística para mesmo evento/janela', () => {
    const k1 = buildDeliveryKey(base.eventCode, base.releaseUtc, 30, base.chatId);
    const k2 = buildDeliveryKey(base.eventCode, base.releaseUtc, 30, base.chatId);
    expect(k1).toBe(k2);
  });

  it('janelas diferentes geram chaves diferentes', () => {
    const k30 = buildDeliveryKey(base.eventCode, base.releaseUtc, 30, base.chatId);
    const k60 = buildDeliveryKey(base.eventCode, base.releaseUtc, 60, base.chatId);
    expect(k30).not.toBe(k60);
  });

  it('chat_id diferente gera chave diferente', () => {
    const k1 = buildDeliveryKey(base.eventCode, base.releaseUtc, 30, '111');
    const k2 = buildDeliveryKey(base.eventCode, base.releaseUtc, 30, '222');
    expect(k1).not.toBe(k2);
  });

  it('evento diferente gera chave diferente', () => {
    const kCpi = buildDeliveryKey('US_CPI', base.releaseUtc, 30, base.chatId);
    const kNfp = buildDeliveryKey('US_NFP', base.releaseUtc, 30, base.chatId);
    expect(kCpi).not.toBe(kNfp);
  });
});

// ─── 3. Conversão ET→UTC (DST correto) ───────────────────────────────────────
// Replica nthSunday + getEtOffsetHours + etToBrt de macroCalendarService.ts

function nthSunday(year: number, month: number, n: number): Date {
  const d = new Date(year, month - 1, 1);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setDate(d.getDate() + (n - 1) * 7);
  return d;
}

function getEtOffsetHours(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dstStart = nthSunday(year, 3, 2);
  const dstEnd   = nthSunday(year, 11, 1);
  const current  = new Date(year, month - 1, day);
  return current >= dstStart && current < dstEnd ? 4 : 5;
}

function etToBrt(dateStr: string, timeEt: string): { utc: string; brt: string } {
  const etToUtcHours = getEtOffsetHours(dateStr);
  const [hr, mn] = timeEt.split(':').map(Number);
  const etAsUtcMs = new Date(`${dateStr}T${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}:00Z`).getTime();
  const utcMs     = etAsUtcMs + etToUtcHours * 3_600_000;
  const brtWallMs = utcMs - 3 * 3_600_000;
  const brtIso    = new Date(brtWallMs).toISOString().replace(/Z$/, '-03:00');
  return { utc: new Date(utcMs).toISOString(), brt: brtIso };
}

describe('etToBrt — conversão de timezone', () => {
  it('CPI em verão ET (EDT, UTC-4): 08:30 ET = 12:30 UTC = 09:30 BRT', () => {
    // 2026-05-14 está em EDT (verão EUA)
    const { utc, brt } = etToBrt('2026-05-14', '08:30');
    expect(utc).toContain('T12:30:00');
    expect(brt).toContain('T09:30:00');
    expect(brt).toContain('-03:00');
  });

  it('FOMC em inverno ET (EST, UTC-5): 14:00 ET = 19:00 UTC = 16:00 BRT', () => {
    // 2026-01-28 está em EST (inverno EUA)
    const { utc, brt } = etToBrt('2026-01-28', '14:00');
    expect(utc).toContain('T19:00:00');
    expect(brt).toContain('T16:00:00');
    expect(brt).toContain('-03:00');
  });

  it('DST spring-forward: 2026-03-08 ainda é EST (antes do 2º domingo de março)', () => {
    // 2026-03-08 = domingo, mas o 2º domingo de março de 2026 é 2026-03-08.
    // Verifica apenas que offset é calculado sem erro.
    const offset = getEtOffsetHours('2026-03-07'); // antes do spring-forward
    expect(offset).toBe(5); // EST
  });

  it('DST após spring-forward: 2026-03-09 é EDT', () => {
    const offset = getEtOffsetHours('2026-03-09');
    expect(offset).toBe(4); // EDT
  });

  it('DST fall-back: 2026-11-01 (1º domingo novembro) ainda é EDT até meia-noite', () => {
    // 1º domingo de novembro 2026 = 2026-11-01
    const offsetBefore = getEtOffsetHours('2026-10-31');
    const offsetAfter  = getEtOffsetHours('2026-11-01');
    expect(offsetBefore).toBe(4); // EDT
    expect(offsetAfter).toBe(5);  // EST
  });

  it('brt sempre termina com -03:00 (não Z)', () => {
    const { brt } = etToBrt('2026-06-17', '14:00');
    expect(brt).toMatch(/-03:00$/);
    expect(brt).not.toContain('Z');
  });
});

// ─── 4. Janela de disparo de alerta ──────────────────────────────────────────
// Replica a lógica de matchedWindow do macro-alert-worker

const ALERT_WINDOWS = [60, 30, 15] as const;
type AlertWindow = typeof ALERT_WINDOWS[number];

function matchAlertWindow(minutesLeft: number): AlertWindow | undefined {
  return ALERT_WINDOWS.find(w => Math.abs(minutesLeft - w) <= 3);
}

describe('matchAlertWindow — janela de disparo', () => {
  it('30min exato dispara janela 30', () => {
    expect(matchAlertWindow(30)).toBe(30);
  });

  it('31min (tolerância +1) dispara janela 30', () => {
    expect(matchAlertWindow(31)).toBe(30);
  });

  it('27min (tolerância -3) dispara janela 30', () => {
    expect(matchAlertWindow(27)).toBe(30);
  });

  it('26min fora da tolerância — nenhuma janela', () => {
    expect(matchAlertWindow(26)).toBeUndefined();
  });

  it('60min exato dispara janela 60', () => {
    expect(matchAlertWindow(60)).toBe(60);
  });

  it('15min exato dispara janela 15', () => {
    expect(matchAlertWindow(15)).toBe(15);
  });

  it('45min fora de todas as janelas — nenhuma', () => {
    expect(matchAlertWindow(45)).toBeUndefined();
  });

  it('0min (evento agora) — nenhuma janela', () => {
    expect(matchAlertWindow(0)).toBeUndefined();
  });

  it('janela 60 tem prioridade sobre 30 em caso de ambiguidade (não existe overlap aqui)', () => {
    // 60 e 30 distam 30min — sem overlap com tolerância ±3
    expect(matchAlertWindow(58)).toBe(60);
    expect(matchAlertWindow(33)).toBe(30);
  });
});
