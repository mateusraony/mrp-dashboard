/**
 * useOpportunities.ts — Hook que agrega dados de mercado e executa o OpportunitiesEngine.
 */

import { useMemo } from 'react';
import { useBtcTicker, useFearGreed } from '@/hooks/useBtcData';
import { useRiskScore } from '@/hooks/useRiskScore';
import { useMacroBoard } from '@/hooks/useFred';
import { useOptionsData } from '@/hooks/useDeribit';
import { generateOpportunities, type Opportunity } from '@/services/opportunitiesEngine';

export interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  isLoading:     boolean;
  isError:       boolean;
}

export function useOpportunities(): UseOpportunitiesResult {
  const { data: ticker,  isLoading: l1 } = useBtcTicker();
  const { data: fng,     isLoading: l2 } = useFearGreed();
  const { data: risk,    isLoading: l3 } = useRiskScore();
  const { data: _macro,  isLoading: l4 } = useMacroBoard();
  const { data: options, isLoading: l5 } = useOptionsData();

  const isLoading = l1 || l2 || l3 || l4 || l5;
  const isError   = !isLoading && (!ticker || !fng || !risk);

  const opportunities = useMemo(() => {
    if (!ticker || !fng || !risk) return [];

    // funding rate: decimal (ex: 0.0001) → bps (* 10_000)
    const fundingRateBps = (ticker.last_funding_rate ?? 0) * 10_000;

    // iv_atm: decimal fraction (0–1) → iv rank proxy (* 100)
    const ivRank = (options?.iv_atm ?? 0) * 100;

    return generateOpportunities({
      fundingRateBps,
      fearGreedIndex: fng.value ?? 50,
      riskScore:      risk.score ?? 50,
      ivRank,
    });
  }, [ticker, fng, risk, options]);

  return { opportunities, isLoading, isError };
}
