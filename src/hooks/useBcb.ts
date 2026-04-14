/**
 * useBcb.ts — TanStack Query hook para dados do BCB (Banco Central do Brasil)
 *
 * Dados: SELIC (% a.a.), IPCA (% ao mês), USDBRL (R$ por USD)
 * Fonte: BCB OpenData — sem autenticação
 * Frequência: BCB atualiza diariamente → poll a cada 4h é suficiente
 */

import { useQuery } from '@tanstack/react-query';
import { fetchBcbData } from '@/services/bcb';
import { IS_LIVE } from '@/lib/env';

/**
 * useBcbData — SELIC, IPCA e USDBRL via BCB OpenData
 * staleTime: 4h — dados diários, não precisam de refresco frequente
 */
export function useBcbData() {
  return useQuery({
    queryKey:        ['bcb', 'macro'],
    queryFn:         fetchBcbData,
    staleTime:       4 * 60 * 60 * 1000,                   // 4h
    refetchInterval: IS_LIVE ? 4 * 60 * 60 * 1000 : false, // 4h em live, desligado em mock
  });
}
