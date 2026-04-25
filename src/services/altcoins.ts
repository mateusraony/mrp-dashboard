/**
 * altcoins.ts — Alt Season Index, rotação setorial, top altcoins
 *
 * Fonte: CoinGecko /coins/markets — retornos 7d/30d/90d (gratuito, sem auth)
 *
 * Funções puras (sem rede):
 *   computeAltSeasonIndex — % das top N alts acima do BTC em 90d
 *   computeSectorRotation — retorno médio ponderado por mcap por setor
 */

import { fetchTopAltcoins, AltcoinMarketData } from '@/services/coingecko';
import { DATA_MODE } from '@/lib/env';

// ─── Mapeamento symbol → setor ────────────────────────────────────────────────

export const SECTOR_MAP: Record<string, string> = {
  // L1 Blockchains
  BTC: 'L1', ETH: 'L1', BNB: 'L1', SOL: 'L1', ADA: 'L1',
  AVAX: 'L1', DOT: 'L1', ATOM: 'L1', NEAR: 'L1', APT: 'L1', SUI: 'L1',
  // L2 / Scaling
  OP: 'L2', ARB: 'L2', MATIC: 'L2', IMX: 'L2', STRK: 'L2', MNT: 'L2',
  // DeFi
  UNI: 'DeFi', AAVE: 'DeFi', MKR: 'DeFi', CRV: 'DeFi', LDO: 'DeFi',
  SNX: 'DeFi', CAKE: 'DeFi', GMX: 'DeFi', RUNE: 'DeFi', JUP: 'DeFi',
  // Oracle
  LINK: 'Oracle', BAND: 'Oracle',
  // Payments
  XRP: 'Payments', XLM: 'Payments', ALGO: 'Payments', XDC: 'Payments',
  // Meme
  DOGE: 'Meme', SHIB: 'Meme', PEPE: 'Meme', FLOKI: 'Meme', BONK: 'Meme',
  // AI
  FET: 'AI', RNDR: 'AI', WLD: 'AI', TAO: 'AI', AGIX: 'AI',
  // GameFi
  SAND: 'GameFi', AXS: 'GameFi', MANA: 'GameFi', ENJ: 'GameFi',
};

const STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'USDE', 'FRAX', 'PYUSD',
]);

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface AltSeasonResult {
  value:             number;  // 0-100
  phase:             'altseason' | 'bitcoin' | 'neutral';
  signal:            string;
  top_outperformers: AltcoinMarketData[];
  total_alts:        number;
  alts_above_btc:    number;
}

export interface SectorRotation {
  sector:       string;
  ret_7d:       number;
  ret_30d:      number;
  ret_90d:      number;
  coin_count:   number;
  top_coin:     string;
  mcap_total_b: number;
}

export interface AltcoinsExtendedData {
  alts:           AltcoinMarketData[];
  altSeasonIndex: AltSeasonResult;
  sectorRotation: SectorRotation[];
  btcRet7d:       number;
  btcRet30d:      number;
  btcRet90d:      number;
  updated_at:     number;
}

// ─── Funções puras ────────────────────────────────────────────────────────────

/**
 * computeAltSeasonIndex — % das top N alts (ex-BTC, ex-stablecoins) acima do BTC em 90d.
 * ≥ 75 = alt season · ≤ 25 = bitcoin season · entre = neutro.
 */
export function computeAltSeasonIndex(
  alts:      AltcoinMarketData[],
  btcRet90d: number,
): AltSeasonResult {
  const eligible = alts.filter(
    a => a.symbol !== 'BTC' && !STABLECOINS.has(a.symbol),
  );

  if (eligible.length === 0) {
    return {
      value: 50, phase: 'neutral',
      signal: 'Dados insuficientes',
      top_outperformers: [], total_alts: 0, alts_above_btc: 0,
    };
  }

  const above = eligible.filter(a => a.price_change_percentage_90d > btcRet90d);
  const value = Math.round((above.length / eligible.length) * 100);

  const phase: AltSeasonResult['phase'] =
    value >= 75 ? 'altseason' : value <= 25 ? 'bitcoin' : 'neutral';

  const signal =
    phase === 'altseason'
      ? `${value}% das alts superam BTC em 90d — rotação ativa`
      : phase === 'bitcoin'
      ? `Apenas ${value}% das alts superam BTC — dominância elevada`
      : `${value}% das alts acima do BTC — mercado sem direção clara`;

  const top_outperformers = [...above]
    .sort((a, b) => b.price_change_percentage_90d - a.price_change_percentage_90d)
    .slice(0, 5);

  return { value, phase, signal, top_outperformers, total_alts: eligible.length, alts_above_btc: above.length };
}

/**
 * computeSectorRotation — retorno médio ponderado por market cap para cada setor.
 */
export function computeSectorRotation(alts: AltcoinMarketData[]): SectorRotation[] {
  const groups: Record<string, AltcoinMarketData[]> = {};

  for (const alt of alts) {
    if (STABLECOINS.has(alt.symbol)) continue;
    const sector = SECTOR_MAP[alt.symbol] ?? 'Other';
    (groups[sector] ??= []).push(alt);
  }

  return Object.entries(groups)
    .map(([sector, coins]) => {
      const totalMcap = coins.reduce((s, c) => s + c.market_cap, 0);
      const wRet = (field: keyof AltcoinMarketData) =>
        totalMcap > 0
          ? coins.reduce((s, c) => s + (c[field] as number) * c.market_cap, 0) / totalMcap
          : 0;

      const top = [...coins].sort((a, b) => b.market_cap - a.market_cap)[0];

      return {
        sector,
        ret_7d:       parseFloat(wRet('price_change_percentage_7d').toFixed(2)),
        ret_30d:      parseFloat(wRet('price_change_percentage_30d').toFixed(2)),
        ret_90d:      parseFloat(wRet('price_change_percentage_90d').toFixed(2)),
        coin_count:   coins.length,
        top_coin:     top?.symbol ?? '',
        mcap_total_b: parseFloat((totalMcap / 1e9).toFixed(2)),
      };
    })
    .sort((a, b) => b.ret_7d - a.ret_7d);
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

function mockAltcoinsExtended(): AltcoinsExtendedData {
  const btcRet7d = 2.3, btcRet30d = 8.1, btcRet90d = 15.4;
  const alts: AltcoinMarketData[] = [
    { id: 'bitcoin',     symbol: 'BTC', name: 'Bitcoin',  current_price: 85000, market_cap: 1.65e12, price_change_percentage_7d: btcRet7d, price_change_percentage_30d: btcRet30d, price_change_percentage_90d: btcRet90d, price_change_percentage_24h: 0.8 },
    { id: 'ethereum',    symbol: 'ETH', name: 'Ethereum', current_price: 3200,  market_cap: 3.8e11,  price_change_percentage_7d: 3.1,      price_change_percentage_30d: 6.5,       price_change_percentage_90d: 12.0,      price_change_percentage_24h: 1.2 },
    { id: 'solana',      symbol: 'SOL', name: 'Solana',   current_price: 155,   market_cap: 7.2e10,  price_change_percentage_7d: 8.5,      price_change_percentage_30d: 22.0,      price_change_percentage_90d: 45.0,      price_change_percentage_24h: 3.1 },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB',      current_price: 590,   market_cap: 8.6e10,  price_change_percentage_7d: 1.5,      price_change_percentage_30d: 4.0,       price_change_percentage_90d: 9.0,       price_change_percentage_24h: 0.5 },
    { id: 'xrp',         symbol: 'XRP', name: 'XRP',      current_price: 0.55,  market_cap: 3.1e10,  price_change_percentage_7d: -1.0,     price_change_percentage_30d: 5.0,       price_change_percentage_90d: 18.0,      price_change_percentage_24h: -0.3 },
  ];
  return {
    alts,
    altSeasonIndex: computeAltSeasonIndex(alts, btcRet90d),
    sectorRotation: computeSectorRotation(alts),
    btcRet7d, btcRet30d, btcRet90d,
    updated_at: Date.now(),
  };
}

// ─── Fetcher principal ────────────────────────────────────────────────────────

/**
 * fetchAltcoinsExtended — top 50 altcoins com retornos 7/30/90d + Alt Season Index + rotação setorial.
 * Cache recomendado: 5 minutos (rate limit CoinGecko 30 req/min).
 */
export async function fetchAltcoinsExtended(limit = 50): Promise<AltcoinsExtendedData> {
  if (DATA_MODE === 'mock') return mockAltcoinsExtended();

  const alts = await fetchTopAltcoins(limit);

  const btcEntry = alts.find(a => a.symbol === 'BTC');
  const btcRet7d  = btcEntry?.price_change_percentage_7d  ?? 0;
  const btcRet30d = btcEntry?.price_change_percentage_30d ?? 0;
  const btcRet90d = btcEntry?.price_change_percentage_90d ?? 0;

  return {
    alts,
    altSeasonIndex: computeAltSeasonIndex(alts, btcRet90d),
    sectorRotation: computeSectorRotation(alts),
    btcRet7d,
    btcRet30d,
    btcRet90d,
    updated_at: Date.now(),
  };
}
