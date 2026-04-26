/**
 * useMarketSentiment.ts — Sentimento de mercado composto ao vivo
 *
 * Score 0-100 calculado como:
 *   Fear & Greed (alternative.me)   → peso 50%
 *   Funding Rate (Binance)           → peso 30%  (normalizado 0-100)
 *   GDELT News Tone                  → peso 20%  (normalizado 0-100)
 *
 * Classificação:
 *   ≥ 75 = Extreme Greed  · ≥ 55 = Greed  · ≥ 45 = Neutral
 *   ≥ 25 = Fear           · < 25 = Extreme Fear
 */

import { useQuery } from '@tanstack/react-query';
import { IS_LIVE } from '@/lib/env';
import { useBtcTicker, useFearGreed } from '@/hooks/useBtcData';
import { useGdeltNews } from '@/hooks/useGdelt';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface SentimentSource {
  label:   string;
  score:   number;   // 0-100
  weight:  number;   // 0-1
  raw:     string;   // valor original formatado
}

export interface MarketSentimentResult {
  score:          number;
  classification: string;
  label_pt:       string;
  color:          string;
  prev_24h:       number;
  delta_24h:      number;
  sources:        SentimentSource[];
  updated_at:     number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyScore(score: number): { classification: string; label_pt: string; color: string } {
  if (score >= 75) return { classification: 'Extreme Greed',  label_pt: 'Ganância Extrema', color: '#ef4444' };
  if (score >= 55) return { classification: 'Greed',          label_pt: 'Ganância',          color: '#f59e0b' };
  if (score >= 45) return { classification: 'Neutral',        label_pt: 'Neutro',            color: '#94a3b8' };
  if (score >= 25) return { classification: 'Fear',           label_pt: 'Medo',              color: '#10b981' };
  return                  { classification: 'Extreme Fear',   label_pt: 'Medo Extremo',      color: '#60a5fa' };
}

/** Normaliza funding rate anualizado para escala 0-100 de sentimento. */
function fundingToScore(fundingRate: number): number {
  // fundingRate é por 8h (ex: 0.0001 = 0.01%)
  // < 0 = bearish → 20-40; ~0 = neutro → 50; alto positivo = overheated → 70-85
  const pct = fundingRate * 100;
  if (pct <= -0.05) return 15;
  if (pct <= -0.01) return 30;
  if (pct <=  0.00) return 45;
  if (pct <=  0.03) return 58;
  if (pct <=  0.06) return 68;
  if (pct <=  0.10) return 78;
  return 88;
}

/** Normaliza sentimento GDELT (-1/0/1) para escala 0-100. */
function gdeltSentimentToScore(articles: Array<{ sentiment?: number }>): number {
  if (articles.length === 0) return 50;
  const sentiments = articles.map(a => a.sentiment ?? 0);
  const avg = sentiments.reduce((s, v) => s + v, 0) / sentiments.length;
  // avg entre -1 e +1 → normaliza para 0-100 com 50 como neutro
  return Math.round(Math.max(0, Math.min(100, 50 + avg * 35)));
}

const FALLBACK: MarketSentimentResult = {
  score: 50, classification: 'Neutral', label_pt: 'Neutro', color: '#94a3b8',
  prev_24h: 50, delta_24h: 0, sources: [], updated_at: Date.now(),
};

/**
 * useMarketSentiment — score composto ao vivo.
 *
 * Agrega Fear & Greed + Funding + GDELT em um único score 0-100.
 * Retorna fallback neutro enquanto dados carregam.
 */
export function useMarketSentiment() {
  const { data: ticker } = useBtcTicker();
  const { data: fng }    = useFearGreed();
  const { data: news }   = useGdeltNews('bitcoin crypto');

  return useQuery({
    queryKey: [
      'market-sentiment',
      fng?.value,
      ticker?.last_funding_rate,
      news?.length,
    ],
    queryFn: (): MarketSentimentResult => {
      const fngScore     = fng?.value ?? 50;
      const fundScore    = ticker ? fundingToScore(ticker.last_funding_rate) : 50;
      const gdeltScore   = news ? gdeltSentimentToScore(news as Array<{ sentiment?: number }>) : 50;

      const score = Math.round(
        fngScore   * 0.50 +
        fundScore  * 0.30 +
        gdeltScore * 0.20,
      );

      const { classification, label_pt, color } = classifyScore(score);

      const sources: SentimentSource[] = [
        {
          label:  'Fear & Greed',
          score:  fngScore,
          weight: 0.50,
          raw:    `${fngScore} — ${fng?.label ?? '—'}`,
        },
        {
          label:  'Funding Rate',
          score:  fundScore,
          weight: 0.30,
          raw:    ticker
            ? `${(ticker.last_funding_rate * 100).toFixed(4)}% / 8h`
            : '—',
        },
        {
          label:  'GDELT News Tone',
          score:  gdeltScore,
          weight: 0.20,
          raw:    news ? `${news.length} artigos` : '—',
        },
      ];

      // Constrói prev composto usando previous_close do FnG (única fonte com dado anterior)
      const fngPrev   = fng?.previous_close ?? fngScore;
      const prev24h   = Math.round(fngPrev * 0.50 + fundScore * 0.30 + gdeltScore * 0.20);
      const delta24h  = score - prev24h;

      return { score, classification, label_pt, color, prev_24h: prev24h, delta_24h: delta24h, sources, updated_at: Date.now() };
    },
    staleTime:       4_000,
    refetchInterval: IS_LIVE ? 30_000 : false,
  });
}
