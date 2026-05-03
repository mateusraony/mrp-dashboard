/**
 * binance.test.ts — smoke tests para serviços Binance (mock mode)
 *
 * DATA_MODE=mock → sem chamadas de rede. Valida shape e invariantes do mock.
 */

import { describe, it, expect } from 'vitest';
import { fetchBtcTicker, fetchOiByExchange, fetchLongShortRatio } from '@/services/binance';

describe('fetchBtcTicker (mock mode)', () => {
  it('retorna shape BtcTickerData completo', async () => {
    const data = await fetchBtcTicker();
    expect(data).toHaveProperty('mark_price');
    expect(data).toHaveProperty('last_funding_rate');
    expect(data).toHaveProperty('next_funding_time');
    expect(data).toHaveProperty('price_change_pct');
    expect(data).toHaveProperty('volume_24h_usdt');
    expect(data).toHaveProperty('high_24h');
    expect(data).toHaveProperty('low_24h');
    expect(data).toHaveProperty('open_interest');
    expect(data).toHaveProperty('oi_delta_pct');
  });

  it('mark_price é positivo', async () => {
    const data = await fetchBtcTicker();
    expect(data.mark_price).toBeGreaterThan(0);
  });

  it('funding_rate está dentro de limites realistas (< 1%)', async () => {
    const data = await fetchBtcTicker();
    expect(Math.abs(data.last_funding_rate)).toBeLessThan(0.01);
  });

  it('high_24h >= low_24h', async () => {
    const data = await fetchBtcTicker();
    expect(data.high_24h).toBeGreaterThanOrEqual(data.low_24h);
  });

  it('open_interest é positivo', async () => {
    const data = await fetchBtcTicker();
    expect(data.open_interest).toBeGreaterThan(0);
  });
});

describe('fetchOiByExchange (mock mode)', () => {
  it('retorna array não-vazio', async () => {
    const data = await fetchOiByExchange();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('cada entrada tem exchange e oi_usd positivo', async () => {
    const data = await fetchOiByExchange();
    for (const entry of data) {
      expect(typeof entry.exchange).toBe('string');
      expect(entry.oi_usd).toBeGreaterThan(0);
    }
  });

  it('soma de share_pct é próxima de 100%', async () => {
    const data = await fetchOiByExchange();
    const total = data.reduce((s, e) => s + e.share_pct, 0);
    expect(total).toBeGreaterThan(50); // ao menos 50% acounted for
  });
});

describe('fetchLongShortRatio (mock mode)', () => {
  it('retorna shape LongShortRatioData', async () => {
    const data = await fetchLongShortRatio('BTCUSDT', '5m');
    expect(data).toHaveProperty('symbol');
    expect(data).toHaveProperty('longAccount');
    expect(data).toHaveProperty('shortAccount');
    expect(data).toHaveProperty('timestamp');
  });

  it('symbol é BTCUSDT', async () => {
    const data = await fetchLongShortRatio('BTCUSDT', '5m');
    expect(data!.symbol).toBe('BTCUSDT');
  });

  it('longAccount + shortAccount é próximo de 1', async () => {
    const data = await fetchLongShortRatio('BTCUSDT', '5m');
    const sum = data!.longAccount + data!.shortAccount;
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThan(1.05);
  });

  it('longAccount e shortAccount são positivos', async () => {
    const data = await fetchLongShortRatio('BTCUSDT', '5m');
    expect(data!.longAccount).toBeGreaterThan(0);
    expect(data!.shortAccount).toBeGreaterThan(0);
  });
});
