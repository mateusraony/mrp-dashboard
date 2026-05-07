/**
 * useMtfAnalysis — hook de análise multi-timeframe (1H / 4H / 1D)
 *
 * Busca a vela mais recente de cada intervalo via useKlines (2 candles, cache já ativo)
 * e computa a confluência direcional.
 *
 * IS_LIVE=true : queries ativas, frames calculados com dados reais da Binance.
 * IS_LIVE=false: queries desabilitadas (enabled=false, zero fetch), frames AGUARDANDO.
 *               Widget ainda visível no Dashboard — sem mistura de sinal real com demo.
 */

import { useMemo } from 'react';
import { IS_LIVE } from '@/lib/env';
import { useKlines } from '@/hooks/useBtcData';
import { frameFromKlines, computeConfluence, type MtfResult } from '@/utils/mtfAnalysis';

export function useMtfAnalysis(): MtfResult {
  // enabled=IS_LIVE: em mock mode, queries não montam nem fazem fetch
  const { data: k1h } = useKlines('1h', 2, IS_LIVE);
  const { data: k4h } = useKlines('4h', 2, IS_LIVE);
  const { data: k1d } = useKlines('1d', 2, IS_LIVE);

  return useMemo(() => {
    const frames = [
      frameFromKlines(k1h ?? [], '1H'),
      frameFromKlines(k4h ?? [], '4H'),
      frameFromKlines(k1d ?? [], '1D'),
    ];

    return computeConfluence(frames);
  }, [k1h, k4h, k1d]);
}
