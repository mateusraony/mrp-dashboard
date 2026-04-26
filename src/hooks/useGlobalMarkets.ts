/**
 * useGlobalMarkets.ts — TanStack Query hooks para mercados globais
 *
 * Fontes:
 *   FRED API   — FX, commodities, bancos centrais (via fred-proxy Edge Function)
 *   BCB        — USD/BRL, SELIC (sem auth)
 *   Binance    — klines BTC 1d para correlações
 *
 * Cache: 1h (FRED atualiza diário; correlações BTC mudam lentamente)
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import {
  fetchGlobalMarketsData,
  computeBtcCorrelations,
  type GlobalMarketsData,
} from '@/services/globalMarkets';
import { useKlines } from '@/hooks/useBtcData';
import { fetchMacroBoard } from '@/services/fred';

const GM_INTERVAL = IS_LIVE ? 3_600_000 : false;  // 1h — FRED é diário

/**
 * useGlobalMarketsBase — FX rates, commodities e taxas de banco central.
 *
 * Não inclui correlações BTC (calculadas em useGlobalMarkets via klines).
 */
export function useGlobalMarketsBase() {
  return useQuery({
    queryKey:        ['global-markets', 'base'],
    queryFn:         fetchGlobalMarketsData,
    staleTime:       3_500_000,                    // ~58min
    refetchInterval: GM_INTERVAL,
    retry:           1,
  });
}

/**
 * useGlobalMarkets — dados completos: FX + commodities + CB rates + correlações BTC.
 *
 * Correlações calculadas localmente com Pearson usando klines 1d Binance (90 candles)
 * e séries históricas FRED (SP500, DXY, Gold, VIX) do useMacroBoard.
 *
 * Se klines ou macro não estiverem disponíveis, retorna correlações null.
 */
export function useGlobalMarkets() {
  const { data: base }    = useGlobalMarketsBase();
  const { data: klines }  = useKlines('1d', 90);

  return useQuery({
    queryKey: ['global-markets', 'full', base?.updated_at, klines?.length],
    queryFn: async (): Promise<GlobalMarketsData> => {
      const marketData = base ?? await fetchGlobalMarketsData();

      // Sem klines → retorna sem correlações calculadas (usa mock interno)
      if (!klines || klines.length < 10) {
        return {
          ...marketData,
          btcCorrelations: [
            { asset: 'SP500', label: 'S&P 500',   corr_7d: null, corr_30d: null, corr_90d: null },
            { asset: 'DXY',   label: 'DXY (USD)', corr_7d: null, corr_30d: null, corr_90d: null },
            { asset: 'GOLD',  label: 'Gold',       corr_7d: null, corr_30d: null, corr_90d: null },
            { asset: 'VIX',   label: 'VIX',        corr_7d: null, corr_30d: null, corr_90d: null },
          ],
        };
      }

      // Constrói série BTC diária a partir dos klines Binance
      const btcPrices = klines.map(k => ({
        date:  new Date(k.time).toISOString().slice(0, 10),
        value: k.close,
      }));

      // Busca séries FRED para correlação (macro board já tem as séries históricas)
      let fredSeries: Record<string, Array<{ date: string; value: number }>> = {};
      try {
        const macro = await fetchMacroBoard();
        // MacroBoard expõe series[].history → transforma para o formato esperado
        for (const s of macro.series ?? []) {
          if (['SP500', 'DXY', 'GOLD', 'VIX'].includes(s.id) && s.history) {
            fredSeries[s.id] = s.history.map((h: { date: string; value: number }) => ({
              date:  h.date,
              value: h.value,
            }));
          }
        }
      } catch {
        // Correlações ficam null — não quebra o resto dos dados
      }

      return {
        ...marketData,
        btcCorrelations: computeBtcCorrelations(btcPrices, fredSeries),
      };
    },
    enabled:         !!base,
    staleTime:       3_500_000,
    refetchInterval: GM_INTERVAL,
    retry:           1,
  });
}
