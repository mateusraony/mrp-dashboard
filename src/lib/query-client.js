import { QueryClient } from '@tanstack/react-query';
import { reportApiFailure, reportApiRecovery } from './apiHealthMonitor';

// Mapa de queryKey[0] → nome da fonte no SOURCE_REGISTRY
const QUERY_KEY_TO_SOURCE = {
  btc:       'binance_futures',
  market:    'coingecko',
  sentiment: 'alternative_me',
  gdelt:     'gdelt',
  macro:     'fred',
  onchain:   'coinmetrics',
  mempool:   'mempool_basic',
  options:   'deribit',
  multi:     'multi_venue',
  risk:      'risk_score',
  supabase:  'supabase',
  altcoins:  'coingecko',
  bcb:       'bcb',
  venue:     'multi_venue',
};

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

// ─── Monitoramento global de saúde das queries ────────────────────────────────
// Detecta erros/recuperações de qualquer useQuery e repassa ao health monitor.
// O monitor loga no Supabase system_logs quando ≥3 APIs falham simultaneamente.

queryClientInstance.getQueryCache().subscribe((event) => {
  if (event.type !== 'updated') return;
  const { state, queryKey } = event.query;
  const keyPrefix = String(queryKey[0] ?? '');
  const source = QUERY_KEY_TO_SOURCE[keyPrefix] ?? keyPrefix;

  if (state.status === 'error') {
    reportApiFailure(source);
  } else if (state.status === 'success') {
    reportApiRecovery(source);
  }
});
