/**
 * useMarketRegime.ts — Regime de mercado composto ao vivo
 *
 * Combina 6 fontes para classificar o regime atual:
 *   - Yield Curve  (useMacroBoard)     → peso 20%
 *   - DXY Trend    (useMacroBoard)     → peso 18%
 *   - VIX          (useMacroBoard)     → peso 22%
 *   - S&P 500      (useMacroBoard)     → peso 15%
 *   - Funding Rate (useBtcTicker)      → peso 12%
 *   - NUPL         (useOnChainCycle)   → peso 13%
 *
 * ≥ 62 = Risk-On · ≤ 38 = Risk-Off · entre = Neutral
 *
 * Fórmula idêntica ao mockDataRegime.jsx para compatibilidade de UI.
 */

import { useQuery } from '@tanstack/react-query';
import { useBtcTicker } from '@/hooks/useBtcData';
import { useMacroBoard } from '@/hooks/useFred';
import { useOnChainCycle } from '@/hooks/useCoinMetrics';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface RegimeComponent {
  key:         string;
  label:       string;
  score:       number;   // 0-100
  raw:         string;   // valor formatado para exibição
  icon:        string;
  description: string;
  weight:      number;
}

export interface MarketRegimeResult {
  score:       number;
  label:       'Risk-On' | 'Risk-Off' | 'Neutral';
  color:       string;
  bg:          string;
  border:      string;
  components:  RegimeComponent[];
  radarData:   Array<{ metric: string; value: number; fullMark: number }>;
  updated_at:  number;
}

// ─── Fallback (mock conservador enquanto dados carregam) ──────────────────────

const FALLBACK: MarketRegimeResult = {
  score: 50, label: 'Neutral',
  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',
  components: [], radarData: [],
  updated_at: Date.now(),
};

// ─── Helpers de score ─────────────────────────────────────────────────────────

function yieldScore(spread: number): number {
  return spread >= 0.5 ? 80 : spread >= 0 ? 60 : spread >= -0.5 ? 30 : 10;
}
function dxyScore(trend1m: number): number {
  return trend1m <= -2 ? 75 : trend1m <= 0 ? 60 : trend1m <= 2 ? 40 : 20;
}
function vixScore(vix: number): number {
  return vix <= 15 ? 85 : vix <= 20 ? 70 : vix <= 25 ? 50 : vix <= 30 ? 30 : 10;
}
function sp500Score(delta30d: number): number {
  return delta30d >= 0.04 ? 80 : delta30d >= 0 ? 65 : delta30d >= -0.05 ? 40 : 20;
}
function fundingScore(fundingPct: number): number {
  return fundingPct <= 0 ? 80 : fundingPct <= 0.05 ? 65 : fundingPct <= 0.08 ? 50 : 30;
}
function nuplScore(nupl: number): number {
  return nupl >= 0.75 ? 20 : nupl >= 0.5 ? 55 : nupl >= 0.25 ? 70 : 80;
}

/**
 * useMarketRegime — regime composto ao vivo.
 *
 * Agrega dados de macro + derivativos + on-chain.
 * Retorna fallback neutro se qualquer fonte ainda estiver carregando.
 */
export function useMarketRegime() {
  const { data: ticker }  = useBtcTicker();
  const { data: macro }   = useMacroBoard();
  const { data: onchain } = useOnChainCycle();

  return useQuery({
    queryKey: [
      'market-regime',
      ticker?.last_funding_rate,
      macro?.updated_at,
      onchain?.nupl,
    ],
    queryFn: (): MarketRegimeResult => {
      // Sem dados mínimos → fallback
      if (!ticker && !macro) return FALLBACK;

      // Extrai séries do macro board
      const us10y  = macro?.series?.find(s => s.id === 'US10Y');
      const us2y   = macro?.series?.find(s => s.id === 'US2Y');
      const vix    = macro?.series?.find(s => s.id === 'VIX');
      const sp500  = macro?.series?.find(s => s.id === 'SP500');
      const dxy    = macro?.series?.find(s => s.id === 'DXY');

      const spread    = (us10y?.value ?? 4.3) - (us2y?.value ?? 4.0);
      const dxyTrend  = (dxy?.delta_30d ?? 0) * 100;
      const vixValue  = vix?.value ?? 18;
      const sp500D30  = sp500?.delta_30d ?? 0;
      const funding   = (ticker?.last_funding_rate ?? 0.0001) * 100;
      const nupl      = onchain?.nupl ?? 0.35;

      const scores = {
        yield:   yieldScore(spread),
        dxy:     dxyScore(dxyTrend),
        vix:     vixScore(vixValue),
        sp500:   sp500Score(sp500D30),
        funding: fundingScore(funding),
        nupl:    nuplScore(nupl),
      };

      const weights = { yield: 0.20, dxy: 0.18, vix: 0.22, sp500: 0.15, funding: 0.12, nupl: 0.13 };

      const score = Math.round(
        scores.yield   * weights.yield   +
        scores.dxy     * weights.dxy     +
        scores.vix     * weights.vix     +
        scores.sp500   * weights.sp500   +
        scores.funding * weights.funding +
        scores.nupl    * weights.nupl,
      );

      const label: MarketRegimeResult['label'] =
        score >= 62 ? 'Risk-On' : score <= 38 ? 'Risk-Off' : 'Neutral';

      const color  = label === 'Risk-On' ? '#10b981' : label === 'Risk-Off' ? '#ef4444' : '#f59e0b';
      const bg     = label === 'Risk-On' ? 'rgba(16,185,129,0.08)' : label === 'Risk-Off' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
      const border = label === 'Risk-On' ? 'rgba(16,185,129,0.25)' : label === 'Risk-Off' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';

      const components: RegimeComponent[] = [
        {
          key: 'yield', label: 'Yield Curve', score: scores.yield, icon: '📊',
          raw: `${spread >= 0 ? '+' : ''}${(spread * 100).toFixed(1)}bp`,
          description: 'US10Y−US2Y: normal = risk-on, invertida = risk-off',
          weight: weights.yield,
        },
        {
          key: 'dxy', label: 'DXY Trend', score: scores.dxy, icon: '💵',
          raw: `${dxyTrend >= 0 ? '+' : ''}${dxyTrend.toFixed(2)}% 1M`,
          description: 'Queda do dólar = risk-on para ativos de risco',
          weight: weights.dxy,
        },
        {
          key: 'vix', label: 'VIX', score: scores.vix, icon: '🌡️',
          raw: vixValue.toFixed(2),
          description: 'VIX < 20 = risk-on, VIX > 25 = cautela',
          weight: weights.vix,
        },
        {
          key: 'sp500', label: 'S&P 500', score: scores.sp500, icon: '📈',
          raw: `${sp500D30 >= 0 ? '+' : ''}${(sp500D30 * 100).toFixed(2)}% 1M`,
          description: 'Trend positivo do S&P = ambiente de risco favorável',
          weight: weights.sp500,
        },
        {
          key: 'funding', label: 'Funding Rate', score: scores.funding, icon: '💸',
          raw: `${funding >= 0 ? '+' : ''}${funding.toFixed(4)}%`,
          description: 'Funding extremo = sobreaquecimento = risco de reversão',
          weight: weights.funding,
        },
        {
          key: 'nupl', label: 'NUPL On-Chain', score: scores.nupl, icon: '⛓',
          raw: nupl.toFixed(2),
          description: 'NUPL < 0.5 = saudável, > 0.75 = euforia = risco',
          weight: weights.nupl,
        },
      ];

      const radarData = components.map(c => ({
        metric: c.label, value: c.score, fullMark: 100,
      }));

      return { score, label, color, bg, border, components, radarData, updated_at: Date.now() };
    },
    staleTime:       25_000,
    refetchInterval: 30_000,
  });
}
