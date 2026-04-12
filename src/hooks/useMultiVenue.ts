/**
 * useMultiVenue.ts — TanStack Query hooks para dados multi-exchange
 *
 * Exchanges suportadas:
 *   - Binance (já existente via useBtcTicker)
 *   - Bybit   (bybit.ts)
 *   - OKX     (okx.ts)
 *
 * Usado no painel Cross-venue de Derivatives.jsx para comparar:
 *   - Funding rates entre exchanges
 *   - OI por exchange
 *   - Divergência de funding (sinal de arbitragem)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchBybitTicker, fetchBybitFunding } from '@/services/bybit';
import { fetchOkxTicker, fetchOkxFunding } from '@/services/okx';

const VENUE_INTERVAL = IS_LIVE ? 30_000 : false;  // 30s — mesma freq do Binance OI

/**
 * useBybitTicker — mark price, funding rate, OI da Bybit
 */
export function useBybitTicker() {
  return useQuery({
    queryKey:        ['venue', 'bybit', 'ticker'],
    queryFn:         fetchBybitTicker,
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
  });
}

/**
 * useBybitFunding — histórico das últimas 8 sessões de funding (Bybit)
 */
export function useBybitFunding() {
  return useQuery({
    queryKey:        ['venue', 'bybit', 'funding'],
    queryFn:         fetchBybitFunding,
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
  });
}

/**
 * useOkxTicker — preço, funding rate, OI da OKX
 */
export function useOkxTicker() {
  return useQuery({
    queryKey:        ['venue', 'okx', 'ticker'],
    queryFn:         fetchOkxTicker,
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
  });
}

/**
 * useOkxFunding — histórico das últimas 8 sessões de funding (OKX)
 */
export function useOkxFunding() {
  return useQuery({
    queryKey:        ['venue', 'okx', 'funding'],
    queryFn:         fetchOkxFunding,
    staleTime:       25_000,
    refetchInterval: VENUE_INTERVAL,
  });
}

/**
 * useMultiVenueSnapshot — snapshot consolidado das 3 exchanges (Binance já no caller)
 * Retorna Bybit + OKX juntos para facilitar comparação na UI.
 */
export function useMultiVenueSnapshot() {
  const bybit = useBybitTicker();
  const okx   = useOkxTicker();

  return {
    bybit:    bybit.data ?? null,
    okx:      okx.data  ?? null,
    isLoading: bybit.isLoading || okx.isLoading,
    isError:   bybit.isError   || okx.isError,
  };
}
