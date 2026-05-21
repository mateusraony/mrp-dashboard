/**
 * Tests for pure functions in src/services/altcoins.ts
 * Focus: null-handling for 7d/30d/90d return fields (CoinGecko omits these for new coins).
 */

import { describe, it, expect } from 'vitest';
import {
  computeAltSeasonIndex,
  computeAltSeasonTrend,
  computeSectorRotation,
} from '@/services/altcoins';
import type { AltcoinMarketData } from '@/services/coingecko';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAlt(
  symbol: string,
  ret7d: number | null,
  ret30d: number | null,
  ret90d: number | null,
  mcap = 1e9,
): AltcoinMarketData {
  return {
    id: symbol.toLowerCase(),
    symbol,
    name: symbol,
    current_price: 100,
    market_cap: mcap,
    price_change_percentage_7d:  ret7d,
    price_change_percentage_30d: ret30d,
    price_change_percentage_90d: ret90d,
    price_change_percentage_24h: 0,
  };
}

const BTC_FULL  = makeAlt('BTC', 2, 8, 15, 1.6e12);
const ETH_UP    = makeAlt('ETH', 5, 20, 40, 3e11);   // beats BTC in all windows
const SOL_DOWN  = makeAlt('SOL', -1, 4, 10, 7e10);   // beats BTC only in 30d/90d
const NULL_COIN = makeAlt('NEW', null, null, null, 5e9); // brand new coin — no windows

// ─── computeAltSeasonIndex ────────────────────────────────────────────────────

describe('computeAltSeasonIndex', () => {
  it('counts only alts with non-null 90d return', () => {
    const alts = [BTC_FULL, ETH_UP, SOL_DOWN, NULL_COIN];
    const res = computeAltSeasonIndex(alts, 15);
    // ETH (40) > 15 ✓, SOL (10) < 15 ✗ — NULL_COIN excluded
    expect(res.total_alts).toBe(2);
    expect(res.alts_above_btc).toBe(1);
    expect(res.value).toBe(50);
    expect(res.phase).toBe('neutral');
  });

  it('returns neutral when all non-BTC alts have null 90d', () => {
    const res = computeAltSeasonIndex([BTC_FULL, NULL_COIN], 15);
    expect(res.total_alts).toBe(0);
    expect(res.value).toBe(50);
    expect(res.signal).toBe('Dados insuficientes');
  });

  it('handles null btcRet90d — uses 0 as reference', () => {
    const res = computeAltSeasonIndex([BTC_FULL, ETH_UP, SOL_DOWN], null);
    // ETH (40) > 0 ✓, SOL (10) > 0 ✓ — BTC excluded
    expect(res.alts_above_btc).toBe(2);
    expect(res.value).toBe(100);
    expect(res.phase).toBe('altseason');
  });

  it('detects bitcoin season when few alts outperform', () => {
    const weakAlts = [
      makeAlt('ETH', 1, 2, 5),
      makeAlt('SOL', 0, 1, 3),
    ];
    const res = computeAltSeasonIndex([BTC_FULL, ...weakAlts], 15);
    expect(res.value).toBe(0);
    expect(res.phase).toBe('bitcoin');
  });
});

// ─── computeAltSeasonTrend ────────────────────────────────────────────────────

describe('computeAltSeasonTrend', () => {
  it('returns null for a window when BTC ref is null', () => {
    const alts = [BTC_FULL, ETH_UP, SOL_DOWN];
    const trend = computeAltSeasonTrend(alts, null, 8, 15);
    const t7 = trend.find(t => t.window === '7d');
    expect(t7?.value).toBeNull();
    const t30 = trend.find(t => t.window === '30d');
    expect(t30?.value).not.toBeNull();
  });

  it('returns null for a window when no alt has data for it', () => {
    const noData = [makeAlt('ETH', null, 20, 40), makeAlt('SOL', null, 4, 10)];
    const trend = computeAltSeasonTrend([BTC_FULL, ...noData], 2, 8, 15);
    const t7 = trend.find(t => t.window === '7d');
    expect(t7?.value).toBeNull();
  });

  it('excludes null-return coins per window', () => {
    // ETH has all three, SOL has null 7d
    const mixed = [
      makeAlt('ETH', 5, 20, 40),
      makeAlt('SOL', null, 4, 10),
    ];
    const trend = computeAltSeasonTrend([BTC_FULL, ...mixed], 2, 8, 15);
    // 7d: only ETH is valid (5 > 2 → 100%)
    expect(trend.find(t => t.window === '7d')?.value).toBe(100);
    // 30d: ETH (20>8 ✓) SOL (4<8 ✗) → 50%
    expect(trend.find(t => t.window === '30d')?.value).toBe(50);
  });

  it('returns empty array when no eligible alts', () => {
    expect(computeAltSeasonTrend([], 2, 8, 15)).toHaveLength(0);
  });

  it('produces 3 trend points with correct windows', () => {
    const trend = computeAltSeasonTrend([BTC_FULL, ETH_UP], 2, 8, 15);
    expect(trend).toHaveLength(3);
    expect(trend.map(t => t.window)).toEqual(['7d', '30d', '90d']);
  });
});

// ─── computeSectorRotation ────────────────────────────────────────────────────

describe('computeSectorRotation', () => {
  it('excludes null-return coins from weighted average', () => {
    const alts = [
      makeAlt('ETH', 5,   20, 40, 3e11),  // L1
      makeAlt('SOL', null, 4, 10, 7e10),  // L1 — null 7d
    ];
    const sectors = computeSectorRotation(alts);
    const l1 = sectors.find(s => s.sector === 'L1');
    // ETH is only valid coin for 7d — weighted avg = 5%
    expect(l1?.ret_7d).toBe(5);
    // 30d: both valid → (20*3e11 + 4*7e10) / (3e11+7e10)
    const expected30 = (20 * 3e11 + 4 * 7e10) / (3e11 + 7e10);
    expect(l1?.ret_30d).toBeCloseTo(expected30, 1);
  });

  it('returns 0 when all coins in sector have null for a window', () => {
    const alts = [makeAlt('ETH', null, null, null, 3e11)];
    const sectors = computeSectorRotation(alts);
    const l1 = sectors.find(s => s.sector === 'L1');
    expect(l1?.ret_7d).toBe(0);
    expect(l1?.ret_30d).toBe(0);
  });

  it('skips stablecoins', () => {
    const alts = [makeAlt('USDT', 0, 0, 0), makeAlt('ETH', 5, 20, 40)];
    const sectors = computeSectorRotation(alts);
    expect(sectors.find(s => s.sector === 'Stablecoin')).toBeUndefined();
    expect(sectors.find(s => s.sector === 'L1')).toBeDefined();
  });

  it('sorts sectors by 7d return descending', () => {
    const alts = [
      makeAlt('ETH',  10, 5, 5, 3e11),  // L1
      makeAlt('UNI',  20, 5, 5, 1e10),  // DeFi
      makeAlt('DOGE',  5, 5, 5, 2e10),  // Meme
    ];
    const sectors = computeSectorRotation(alts);
    expect(sectors[0].sector).toBe('DeFi');
    expect(sectors[sectors.length - 1].sector).toBe('Meme');
  });
});
