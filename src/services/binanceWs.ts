/**
 * binanceWs.ts — Binance WebSocket singleton para preço BTC em tempo real
 *
 * Stream: wss://stream.binance.com:9443/ws/btcusdt@miniTicker
 * Push: ~1s, sem autenticação necessária.
 *
 * Padrão: singleton com Set de callbacks, reconnect com backoff exponencial.
 * Consumidores: subscribeBtcPrice(cb) → retorna unsubscribe().
 */

import { IS_LIVE } from '@/lib/env';

const WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@miniTicker';

// Backoff em ms: 1s, 2s, 4s, 8s, 30s (cap)
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 30_000];

export type PriceCallback = (price: number) => void;
export type StatusCallback = (connected: boolean) => void;

// ─── Estado singleton ──────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<PriceCallback>();
const statusSubscribers = new Set<StatusCallback>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function backoffMs(): number {
  return BACKOFF_MS[Math.min(reconnectAttempt, BACKOFF_MS.length - 1)];
}

function broadcast(price: number): void {
  subscribers.forEach(cb => cb(price));
}

function broadcastStatus(connected: boolean): void {
  statusSubscribers.forEach(cb => cb(connected));
}

function connect(): void {
  if (ws) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    reconnectAttempt = 0;
    broadcastStatus(true);
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as { c?: string };
      const price = parseFloat(msg.c ?? '');
      if (!Number.isNaN(price) && price > 0) {
        broadcast(price);
      }
    } catch {
      // payload inesperado — ignorar
    }
  };

  ws.onclose = () => {
    ws = null;
    broadcastStatus(false);
    if (subscribers.size > 0) scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt += 1;
    if (subscribers.size > 0) connect();
  }, backoffMs());
}

function disconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
  reconnectAttempt = 0;
  broadcastStatus(false);
}

// ─── API pública ───────────────────────────────────────────────────────────────

/**
 * subscribeBtcPrice — registra callback para preço BTC em tempo real.
 * Retorna função de cancelamento.
 *
 * Em modo mock/teste (IS_LIVE=false) não abre WebSocket.
 */
export function subscribeBtcPrice(cb: PriceCallback): () => void {
  if (!IS_LIVE) return () => {};

  subscribers.add(cb);
  if (subscribers.size === 1) connect();

  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0) disconnect();
  };
}

/**
 * subscribeStatus — notifica quando o WebSocket conecta (true) ou desconecta (false).
 * Permite que o hook limpe o preço stale ao perder a conexão.
 */
export function subscribeStatus(cb: StatusCallback): () => void {
  if (!IS_LIVE) return () => {};
  statusSubscribers.add(cb);
  return () => { statusSubscribers.delete(cb); };
}

/** Expõe estado da conexão para testes e indicadores de UI */
export function isWsConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

/** Reset completo do singleton — usado apenas em testes */
export function _resetSingleton(): void {
  disconnect();
  subscribers.clear();
  statusSubscribers.clear();
}
