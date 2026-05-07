/**
 * useZScoreAlerts — hook de alertas estatísticos Z-score (1D)
 *
 * Busca 31 candles diários (30 histórico + 1 atual em formação),
 * computa Z-score de retorno e volume, e retorna os alertas ativos
 * (|z| >= 1.0 = elevado / |z| >= 2.0 = extremo).
 * Retorna array vazio quando dados indisponíveis ou IS_LIVE=false.
 */

import { useMemo } from 'react';
import { IS_LIVE } from '@/lib/env';
import { useKlines } from '@/hooks/useBtcData';
import { buildZScoreAlerts, type ZScoreAlert } from '@/utils/zScore';

export type { ZScoreAlert } from '@/utils/zScore';

export function useZScoreAlerts(): ZScoreAlert[] {
  const { data: candles } = useKlines('1d', 31);

  return useMemo(() => {
    if (!IS_LIVE || !candles || candles.length < 4) return [];
    return buildZScoreAlerts(candles);
  }, [candles]);
}
