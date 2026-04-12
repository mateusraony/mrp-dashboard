/**
 * useRiskScore.ts — Risk Score composto ao vivo
 *
 * Combina 5 fontes de dados live para computar o Risk Score 0–100:
 *   - Funding rate  (Binance)       → peso 30%
 *   - OI delta %    (Binance)       → peso 20%
 *   - DVOL 30d      (Deribit)       → peso 20%
 *   - Fear & Greed  (alternative.me)→ peso 20%
 *   - Price vs EMA20 (Binance klines)→ peso 10%
 *
 * Fórmula validada em scripts/validate_risk_score.py (Fase 4).
 *
 * DATA_MODE=mock → retorna score calculado a partir dos mocks existentes
 * DATA_MODE=live → computa com dados reais (sem reload necessário)
 */

import { useQuery } from '@tanstack/react-query';
import { useBtcTicker, useFearGreed, useKlines } from '@/hooks/useBtcData';
import { useDvolHistory } from '@/hooks/useDeribit';
import { computeRiskScore, computeEMA, type RiskScoreResult } from '@/utils/riskCalculations';

// Fallback para quando dados live não estão disponíveis
const FALLBACK_RESULT: RiskScoreResult = {
  score: 45,
  regime: 'MODERADO',
  module_scores: { funding: 20, oi: 15, vol: 25, fng: 30, price: 10 },
  ema20: 0,
};

/**
 * useRiskScore — hook principal.
 *
 * Retorna o Risk Score composto calculado com dados live.
 * Em modo mock ou se qualquer dado estiver ausente, usa valores conservadores.
 */
export function useRiskScore() {
  const { data: ticker }   = useBtcTicker();
  const { data: fng }      = useFearGreed();
  const { data: dvol }     = useDvolHistory(30);
  // Klines diárias (1d) dos últimos 20 dias para EMA + klines para histórico de vol
  const { data: klines1d } = useKlines('1d', 20);

  return useQuery({
    queryKey: ['risk-score', ticker?.mark_price, fng?.value, dvol?.at(-1)?.value],
    queryFn: () => {
      // Todos os dados necessários
      if (!ticker) return FALLBACK_RESULT;

      const fundingRate = ticker.last_funding_rate;
      const oiDeltaPct  = ticker.oi_delta_pct;
      const fearGreedV  = fng?.value ?? 50;

      // DVOL: último valor disponível (30d history de Deribit) — campo 'value'
      const dvolValue = dvol && dvol.length > 0
        ? dvol[dvol.length - 1].value
        : 60.0;  // baseline conservadora

      // Preços BTC dos últimos 20 candles diários (close price)
      const prices20d = klines1d
        ? klines1d.map(k => k.close)  // campo close da transformação select
        : [ticker.mark_price];

      return computeRiskScore(
        fundingRate,
        oiDeltaPct,
        dvolValue,
        fearGreedV,
        ticker.mark_price,
        prices20d,
      );
    },
    enabled: !!ticker,  // só executa se ticker estiver disponível
    staleTime: 30_000,  // atualiza a cada 30s (mesma frequência do ticker)
    refetchInterval: 30_000,
  });
}

/**
 * useRiskScoreHistory — série histórica do Risk Score (calculada das klines)
 * Útil para gráfico de evolução do score ao longo do tempo.
 */
export function useRiskScoreHistory(days = 30) {
  const { data: ticker }    = useBtcTicker();
  const { data: fng }       = useFearGreed();
  const { data: klines1d }  = useKlines('1d', days + 20);

  return useQuery({
    queryKey: ['risk-score-history', days],
    queryFn: () => {
      if (!klines1d || klines1d.length < 21) return [];

      const closes = klines1d.map(k => k.close);

      // Para cada dia (a partir do 20º), calcula EMA20 e score simplificado
      return klines1d.slice(20).map((kline, i) => {
        const sliceForEma = closes.slice(0, 20 + i + 1);
        const ema20 = computeEMA(sliceForEma, 20);
        const price = kline.close;

        // Score simplificado (sem funding/OI/dvol — apenas price deviation e fng mock)
        const priceDevScore = Math.min(100, Math.abs((price - ema20) / ema20) * 1000);
        const fngScore = Math.min(100, Math.abs((fng?.value ?? 50) - 50) * 2);
        const simpleScore = Math.round(priceDevScore * 0.4 + fngScore * 0.6);

        return {
          time:  kline[0],
          price: price,
          score: simpleScore,
          ema20: Math.round(ema20),
        };
      });
    },
    enabled: !!klines1d,
    staleTime: 3_600_000,  // 1h (histórico muda lentamente)
  });
}
