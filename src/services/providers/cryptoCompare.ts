/**
 * cryptoCompare.ts — Provedor alternativo CryptoCompare (fallback para CoinGecko)
 *
 * Usado automaticamente quando CoinGecko retorna 429 (rate limit).
 * Free tier sem chave: 100 req/min — 10x mais generoso que CoinGecko.
 * Com VITE_CRYPTOCOMPARE_KEY: 50k req/mês (gratuito em https://min-api.cryptocompare.com).
 *
 * Endpoints usados:
 *   /data/top/totalvolfull — top N coins por volume, inclui preço, mcap, variação 24h
 *
 * Limitações vs CoinGecko:
 *   - Sem dados de variação 7d/30d/90d no tier gratuito → retorna 0 como fallback
 *   - Sem dado de dominância (BTC.D) → não substitui fetchDominance
 */

import { z } from 'zod';
import { env } from '@/lib/env';
import type { AltcoinMarketData } from '@/services/coingecko';
import { apiFetch } from '@/lib/apiClient';

const BASE = 'https://min-api.cryptocompare.com/data';

// ─── Schema ───────────────────────────────────────────────────────────────────

const CcCoinRawSchema = z.object({
  CoinInfo: z.object({
    Name:     z.string(),
    FullName: z.string(),
  }),
  RAW: z.object({
    USD: z.object({
      PRICE:            z.coerce.number(),
      MKTCAP:           z.coerce.number(),
      CHANGEPCT24HOUR:  z.coerce.number(),
    }),
  }).optional(),
});

const CcTopVolSchema = z.object({
  Data: z.array(CcCoinRawSchema),
});

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * fetchAltcoinsFromCryptoCompare — fallback para CoinGecko /coins/markets
 *
 * Retorna o mesmo shape AltcoinMarketData que fetchTopAltcoins() de coingecko.ts.
 * Variações 7d/30d/90d retornam 0 (não disponíveis no free tier).
 */
export async function fetchAltcoinsFromCryptoCompare(limit = 20): Promise<AltcoinMarketData[]> {
  const key = env.VITE_CRYPTOCOMPARE_KEY;
  const params = new URLSearchParams({
    limit:  String(Math.min(limit, 100)),
    tsym:   'USD',
    ...(key ? { api_key: key } : {}),
  });

  const res = await apiFetch(`${BASE}/top/totalvolfull?${params}`);
  if (!res.ok) throw new Error(`CryptoCompare /top/totalvolfull error ${res.status}`);

  const raw = await res.json();
  const parsed = CcTopVolSchema.parse(raw);

  return parsed.Data
    .filter(coin => coin.RAW?.USD)
    .map(coin => ({
      id:            coin.CoinInfo.Name.toLowerCase(),
      symbol:        coin.CoinInfo.Name.toUpperCase(),
      name:          coin.CoinInfo.FullName,
      current_price: coin.RAW!.USD.PRICE,
      market_cap:    coin.RAW!.USD.MKTCAP,
      price_change_percentage_24h: coin.RAW!.USD.CHANGEPCT24HOUR,
      // Não disponível no free tier — retorna 0 como placeholder neutro
      price_change_percentage_7d:  0,
      price_change_percentage_30d: 0,
      price_change_percentage_90d: 0,
    }));
}
