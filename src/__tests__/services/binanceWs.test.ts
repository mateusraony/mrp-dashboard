/**
 * binanceWs.test.ts — testes para o singleton WebSocket de preço BTC
 *
 * WebSocket é mockado via vi.stubGlobal para controlar eventos sem rede real.
 * IS_LIVE é mockado via vi.mock para habilitar a conexão nos testes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock de IS_LIVE ─────────────────────────────────────────────────────────
vi.mock('@/lib/env', () => ({
  IS_LIVE: true,
  DATA_MODE: 'live',
  env: {},
}));

import {
  subscribeBtcPrice,
  subscribeStatus,
  isWsConnected,
  _resetSingleton,
} from '@/services/binanceWs';

// ─── WebSocket mock ───────────────────────────────────────────────────────────

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen:    ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose:   ((e: CloseEvent) => void) | null = null;
  onerror:   ((e: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.lastInstance = this;
    // Simula abertura assíncrona
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  /** Emite uma mensagem miniTicker fake com o preço informado */
  emit(price: number) {
    const data = JSON.stringify({ e: '24hrMiniTicker', c: String(price) });
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  static lastInstance: MockWebSocket | null = null;
}

beforeEach(() => {
  _resetSingleton();
  MockWebSocket.lastInstance = null;
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', MockWebSocket);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  _resetSingleton();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('subscribeBtcPrice — conexão', () => {
  it('abre WebSocket ao primeiro subscriber', async () => {
    subscribeBtcPrice(() => {});
    expect(MockWebSocket.lastInstance).not.toBeNull();
    expect(MockWebSocket.lastInstance?.url).toContain('btcusdt@miniTicker');
  });

  it('não abre segundo WebSocket para múltiplos subscribers', () => {
    subscribeBtcPrice(() => {});
    const firstWs = MockWebSocket.lastInstance;
    subscribeBtcPrice(() => {});
    expect(MockWebSocket.lastInstance).toBe(firstWs);
  });

  it('fecha WebSocket quando todos os subscribers cancelam', async () => {
    const unsub1 = subscribeBtcPrice(() => {});
    const unsub2 = subscribeBtcPrice(() => {});
    const wsInst = MockWebSocket.lastInstance!;

    unsub1();
    expect(wsInst.readyState).toBe(MockWebSocket.OPEN); // ainda tem unsub2

    unsub2();
    expect(wsInst.readyState).toBe(MockWebSocket.CLOSED); // fechado
  });
});

describe('subscribeBtcPrice — callbacks', () => {
  it('entrega preço ao callback quando mensagem chega', async () => {
    const prices: number[] = [];
    subscribeBtcPrice(p => prices.push(p));
    await vi.runAllTimersAsync(); // dispara onopen

    MockWebSocket.lastInstance!.emit(95_000);
    expect(prices).toEqual([95_000]);
  });

  it('entrega preço a múltiplos subscribers', async () => {
    const a: number[] = [];
    const b: number[] = [];
    subscribeBtcPrice(p => a.push(p));
    subscribeBtcPrice(p => b.push(p));
    await vi.runAllTimersAsync();

    MockWebSocket.lastInstance!.emit(96_000);
    expect(a).toEqual([96_000]);
    expect(b).toEqual([96_000]);
  });

  it('não dispara callback após unsubscribe', async () => {
    const prices: number[] = [];
    const unsub = subscribeBtcPrice(p => prices.push(p));
    await vi.runAllTimersAsync();

    unsub();
    MockWebSocket.lastInstance?.emit(97_000);
    expect(prices).toHaveLength(0);
  });

  it('ignora mensagem com preço inválido', async () => {
    const prices: number[] = [];
    subscribeBtcPrice(p => prices.push(p));
    await vi.runAllTimersAsync();

    const ws = MockWebSocket.lastInstance!;
    ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ c: 'NaN' }) }));
    ws.onmessage?.(new MessageEvent('message', { data: 'texto inválido' }));
    expect(prices).toHaveLength(0);
  });
});

describe('reconexão com backoff', () => {
  it('agenda reconexão quando conexão cai com subscriber ativo', async () => {
    subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync(); // onopen

    const firstWs = MockWebSocket.lastInstance!;
    firstWs.close(); // simula queda
    MockWebSocket.lastInstance = null;

    // Antes do backoff (1s) não houve reconexão
    expect(MockWebSocket.lastInstance).toBeNull();

    // Avança 1s — deve criar novo WebSocket
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockWebSocket.lastInstance).not.toBeNull();
    expect(MockWebSocket.lastInstance).not.toBe(firstWs);
  });

  it('não agenda reconexão se não houver subscribers', async () => {
    const unsub = subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync();

    const ws = MockWebSocket.lastInstance!;
    unsub(); // remove subscriber antes do close
    ws.close();
    MockWebSocket.lastInstance = null;

    await vi.advanceTimersByTimeAsync(2_000);
    expect(MockWebSocket.lastInstance).toBeNull();
  });
});

describe('isWsConnected', () => {
  it('retorna false antes de qualquer conexão', () => {
    expect(isWsConnected()).toBe(false);
  });

  it('retorna true após WebSocket aberto', async () => {
    subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync(); // onopen
    expect(isWsConnected()).toBe(true);
  });

  it('retorna false após fechamento', async () => {
    subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync();

    MockWebSocket.lastInstance!.close();
    expect(isWsConnected()).toBe(false);
  });
});

describe('subscribeStatus — notificações de conexão/desconexão', () => {
  it('notifica true quando WebSocket abre', async () => {
    const statuses: boolean[] = [];
    subscribeStatus(s => statuses.push(s));
    subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync(); // onopen

    expect(statuses).toEqual([true]);
  });

  it('notifica false quando WebSocket fecha', async () => {
    const statuses: boolean[] = [];
    subscribeStatus(s => statuses.push(s));
    subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync();

    MockWebSocket.lastInstance!.close();
    expect(statuses).toContain(false);
  });

  it('não notifica após unsubscribe', async () => {
    const statuses: boolean[] = [];
    const unsub = subscribeStatus(s => statuses.push(s));
    subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync();

    unsub();
    MockWebSocket.lastInstance!.close();
    // Somente o evento true (onopen) chegou antes do unsub
    expect(statuses).toEqual([true]);
  });

  it('notifica false quando último subscriber cancela (disconnect)', async () => {
    const statuses: boolean[] = [];
    subscribeStatus(s => statuses.push(s));
    const unsub = subscribeBtcPrice(() => {});
    await vi.runAllTimersAsync();

    unsub(); // fecha WS via disconnect()
    expect(statuses).toContain(false);
  });
});
