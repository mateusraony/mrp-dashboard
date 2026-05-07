/**
 * useAiCalibration — busca últimas 200 previsões e calcula pesos calibrados.
 *
 * Cache: 1h (recalibrar com frequência excessiva não agrega valor).
 * Disabled: quando IS_LIVE=false ou Supabase não configurado.
 * Fallback: DEFAULT_WEIGHTS (equiponderado) enquanto dados insuficientes.
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { fetchRecentPredictions } from '@/services/aiPredictions';
import { computeCalibrationWeights, type CalibrationResult } from '@/services/aiCalibration';
import { DEFAULT_WEIGHTS } from '@/utils/ruleBasedAnalysis';

const FALLBACK: CalibrationResult = {
  weights: DEFAULT_WEIGHTS,
  accuracy: {
    derivatives: { correct: 0, total: 0, accuracy: 0.5 },
    spot:        { correct: 0, total: 0, accuracy: 0.5 },
    options:     { correct: 0, total: 0, accuracy: 0.5 },
    macro:       { correct: 0, total: 0, accuracy: 0.5 },
  },
  sampleCount:  0,
  isCalibrated: false,
};

export function useAiCalibration() {
  return useQuery({
    queryKey:    ['ai', 'calibration'],
    queryFn:     async (): Promise<CalibrationResult> => {
      const predictions = await fetchRecentPredictions(200);
      return computeCalibrationWeights(predictions);
    },
    staleTime:        60 * 60 * 1000,  // 1h
    enabled:          IS_LIVE && isSupabaseConfigured(),
    placeholderData:  FALLBACK,
  });
}
