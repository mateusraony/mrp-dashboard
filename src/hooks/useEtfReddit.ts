import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { fetchEtfRedditPosts } from '@/services/reddit';

export function useEtfRedditPosts() {
  return useQuery({
    queryKey:        ['etf', 'reddit'],
    queryFn:         fetchEtfRedditPosts,
    staleTime:       30 * 60_000,   // 30 min
    refetchInterval: IS_LIVE ? 30 * 60_000 : false,
    retry:           1,
  });
}
