/**
 * mtfAnalysis.ts — Análise de confluência multi-timeframe (1H / 4H / 1D)
 *
 * Para cada timeframe, avalia a direção da vela mais recente.
 * Confluência = quantos timeframes concordam na direção.
 * Função pura, sem I/O, testável de forma isolada.
 */

export type MtfLabel = '1H' | '4H' | '1D';
export type MtfDirection = 'bullish' | 'bearish' | 'neutral';

export interface KlineCandle {
  open:   number;
  close:  number;
  volume: number;  // em USD (volume * close para pares USDT)
}

export interface TimeframeFrame {
  label:     MtfLabel;
  direction: MtfDirection;
  signal:    string;
  ret:       number;   // retorno da vela, e.g. 0.012 = +1.2%
  volume:    number;   // volume em USD
}

export interface MtfResult {
  frames:        TimeframeFrame[];
  confluence:    'FORTE' | 'MODERADA' | 'FRACA';
  confluenceDir: MtfDirection;
  bullishCount:  number;
  bearishCount:  number;
  neutralCount:  number;
}

// Threshold mínimo para classificar como direcional (0.2% de retorno)
const MIN_RET = 0.002;

/**
 * frameFromKlines — calcula direção da vela mais recente de um array de candles.
 * Usa o último candle (pode estar em formação — mostra momentum atual).
 */
export function frameFromKlines(
  candles: KlineCandle[],
  label: MtfLabel,
): TimeframeFrame {
  if (!candles || candles.length === 0) {
    return { label, direction: 'neutral', signal: 'AGUARDANDO', ret: 0, volume: 0 };
  }

  const c   = candles[candles.length - 1];
  const ret = c.open > 0 ? (c.close - c.open) / c.open : 0;

  let direction: MtfDirection;
  let signal: string;

  if (ret > MIN_RET) {
    direction = 'bullish';
    signal    = `▲ BULLISH`;
  } else if (ret < -MIN_RET) {
    direction = 'bearish';
    signal    = `▼ BEARISH`;
  } else {
    direction = 'neutral';
    signal    = `◆ NEUTRO`;
  }

  return { label, direction, signal, ret, volume: c.volume };
}

/**
 * computeConfluence — avalia se os 3 timeframes concordam na direção.
 */
export function computeConfluence(frames: TimeframeFrame[]): MtfResult {
  const bullishCount = frames.filter(f => f.direction === 'bullish').length;
  const bearishCount = frames.filter(f => f.direction === 'bearish').length;
  const neutralCount = frames.filter(f => f.direction === 'neutral').length;

  const dominated = Math.max(bullishCount, bearishCount);
  let confluence:    MtfResult['confluence'];
  let confluenceDir: MtfDirection;

  if (dominated === frames.length) {
    confluence    = 'FORTE';
    confluenceDir = bullishCount > 0 ? 'bullish' : 'bearish';
  } else if (dominated >= 2) {
    confluence    = 'MODERADA';
    confluenceDir = bullishCount >= bearishCount ? 'bullish' : 'bearish';
  } else {
    confluence    = 'FRACA';
    confluenceDir = 'neutral';
  }

  return { frames, confluence, confluenceDir, bullishCount, bearishCount, neutralCount };
}
