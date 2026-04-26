/**
 * useAltcoins.ts — TanStack Query hooks para dados de altcoins
 *
 * Fonte: CoinGecko /coins/markets (free tier, sem auth)
 * Rate limit: 30 req/min — staleTime 5min é conservador o suficiente.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchAltcoinsExtended } from '@/services/altcoins';

const ALT_INTERVAL = IS_LIVE ? 300_000 : false;  // 5min — respeita rate limit CoinGecko

/**
 * useAltcoinsData — top 50 altcoins + Alt Season Index + rotação setorial
 *
 * Em modo mock → dados simulados com 5 altcoins representativas.
 * Em modo live → refetch a cada 5 minutos.
 */
export function useAltcoinsData(limit = 50) {
  return useQuery({
    queryKey:        ['altcoins', 'extended', limit],
    queryFn:         () => fetchAltcoinsExtended(limit),
    staleTime:       290_000,                        // 4m50s
    refetchInterval: ALT_INTERVAL,
    retry:           2,
  });
}
