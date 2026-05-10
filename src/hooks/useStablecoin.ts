import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchStablecoinData } from '@/services/defillama';

export function useStablecoinData() {
  return useQuery({
    queryKey:        ['stablecoin', 'data'],
    queryFn:         fetchStablecoinData,
    staleTime:       58 * 60_000,   // 58 min
    refetchInterval: IS_LIVE ? 60 * 60_000 : false,
    retry:           2,
  });
}
