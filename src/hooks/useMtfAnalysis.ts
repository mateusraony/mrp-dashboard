/**
 * useMtfAnalysis — hook de análise multi-timeframe (1H / 4H / 1D)
 *
 * Busca a vela mais recente de cada intervalo via useKlines (2 candles, cache já ativo)
 * e computa a confluência direcional.
 * Sempre retorna um resultado (com frames "AGUARDANDO" se klines ainda carregando).
 */

import { useMemo } from 'react';
import { useKlines } from '@/hooks/useBtcData';
import { frameFromKlines, computeConfluence, type MtfResult } from '@/utils/mtfAnalysis';

export function useMtfAnalysis(): MtfResult {
  const { data: k1h } = useKlines('1h', 2);
  const { data: k4h } = useKlines('4h', 2);
  const { data: k1d } = useKlines('1d', 2);

  return useMemo(() => {
    const frames = [
      frameFromKlines(k1h ?? [], '1H'),
      frameFromKlines(k4h ?? [], '4H'),
      frameFromKlines(k1d ?? [], '1D'),
    ];

    return computeConfluence(frames);
  }, [k1h, k4h, k1d]);
}
