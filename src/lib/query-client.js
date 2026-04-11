import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados de mercado: nunca stale por menos de 10s
      staleTime: 10_000,
      // Refetch apenas em modo live (cada hook define o seu refetchInterval)
      refetchOnWindowFocus: false,
      // Retry com backoff para não sobrecarregar APIs
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Erros de rede não devem travar a UI
      throwOnError: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
