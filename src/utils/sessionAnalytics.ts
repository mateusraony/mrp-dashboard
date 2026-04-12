/**
 * sessionAnalytics.ts — Análise de mercado por sessão geográfica
 *
 * Segmenta klines de 1h por janela UTC:
 *   Ásia:   00:00–08:00 UTC (21:00–05:00 BRT)
 *   Europa: 08:00–16:00 UTC (05:00–13:00 BRT)
 *   EUA:    16:00–24:00 UTC (13:00–21:00 BRT)
 *
 * Fórmulas validadas em: scripts/validate_mvrv_zscore.py (referência de padrão)
 * Para as sessões usamos lógica de CVD (taker buy - taker sell) por janela.
 *
 * Recebe o output do hook useKlines (com select aplicado):
 *   Array<{ time, open, high, low, close, volume, taker_buy, bull, bear }>
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface KlinePoint {
  time:       number;
  open:       number;
  high:       number;
  low:        number;
  close:      number;
  volume:     number;
  taker_buy:  number;
  bull:       number;
  bear:       number;
}

export interface SessionStats {
  label:           string;
  utc:             string;
  brt:             string;
  color:           string;
  cvd:             number;      // taker_buy - taker_sell total do período
  volume_btc:      number;      // volume total em BTC
  volume_usd_b:    number;      // volume em bilhões USD (estimado)
  price_move_pct:  number;      // retorno open → close da sessão (%)
  taker_buy_pct:   number;      // % do volume que foi taker buy
  dominant_side:   'buy' | 'sell' | 'neutral';
  signal:          string;
  candles:         number;      // número de klines na sessão
}

// ─── Config das sessões ────────────────────────────────────────────────────────

const SESSION_CONFIG = [
  { key: 'asia',   label: 'Ásia',   utc: '00:00–08:00', brt: '21:00–05:00', color: '#f59e0b', startH: 0,  endH: 8  },
  { key: 'europe', label: 'Europa', utc: '08:00–16:00', brt: '05:00–13:00', color: '#3b82f6', startH: 8,  endH: 16 },
  { key: 'us',     label: 'EUA',    utc: '16:00–24:00', brt: '13:00–21:00', color: '#10b981', startH: 16, endH: 24 },
];

// ─── Funções principais ────────────────────────────────────────────────────────

/**
 * getSessionForHour — determina qual sessão um timestamp (ms) pertence
 */
export function getSessionForHour(timestampMs: number): 'asia' | 'europe' | 'us' {
  const h = new Date(timestampMs).getUTCHours();
  if (h < 8)  return 'asia';
  if (h < 16) return 'europe';
  return 'us';
}

/**
 * computeSessionStats — calcula CVD, volume, taker% e price move por sessão
 *
 * Processa as klines das últimas 24h (ou menos, se disponíveis) agrupadas
 * por sessão. Retorna as 3 sessões com suas métricas.
 *
 * @param klines  Array de KlinePoint (output do hook useKlines transformado)
 * @param btcPrice Preço atual do BTC (para converter volume em USD)
 */
export function computeSessionStats(
  klines: KlinePoint[],
  btcPrice: number,
): SessionStats[] {
  // Usa as últimas 48h para ter pelo menos 1 ciclo de cada sessão
  const recent = klines.slice(-48);

  return SESSION_CONFIG.map(cfg => {
    // Filtra candles que pertencem a esta sessão
    const sessionCandles = recent.filter(k => {
      const h = new Date(k.time).getUTCHours();
      return h >= cfg.startH && h < cfg.endH;
    });

    if (sessionCandles.length === 0) {
      // Sem dados — retorna zeros
      return {
        label:          cfg.label,
        utc:            cfg.utc,
        brt:            cfg.brt,
        color:          cfg.color,
        cvd:            0,
        volume_btc:     0,
        volume_usd_b:   0,
        price_move_pct: 0,
        taker_buy_pct:  50,
        dominant_side:  'neutral' as const,
        signal:         'Sem dados para esta sessão',
        candles:        0,
      };
    }

    // Volumes totais
    const totalVolume  = sessionCandles.reduce((s, k) => s + k.volume, 0);
    const takerBuyVol  = sessionCandles.reduce((s, k) => s + k.taker_buy, 0);
    const takerSellVol = totalVolume - takerBuyVol;
    const cvd          = takerBuyVol - takerSellVol;

    // Price move: close do último candle vs open do primeiro
    const firstOpen  = sessionCandles[0].open;
    const lastClose  = sessionCandles[sessionCandles.length - 1].close;
    const priceMoveP = firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0;

    const takerBuyPct = totalVolume > 0 ? (takerBuyVol / totalVolume) * 100 : 50;
    const dominantSide: 'buy' | 'sell' | 'neutral' =
      takerBuyPct > 52 ? 'buy' : takerBuyPct < 48 ? 'sell' : 'neutral';

    // Volume estimado em USD (volume BTC × preço médio)
    const volumeUsdB = (totalVolume * btcPrice) / 1e9;

    // Sinal textual baseado nos dados
    const signal = buildSignal(cfg.label, cvd, takerBuyPct, priceMoveP);

    return {
      label:          cfg.label,
      utc:            cfg.utc,
      brt:            cfg.brt,
      color:          cfg.color,
      cvd:            Math.round(cvd),
      volume_btc:     parseFloat(totalVolume.toFixed(1)),
      volume_usd_b:   parseFloat(volumeUsdB.toFixed(2)),
      price_move_pct: parseFloat(priceMoveP.toFixed(2)),
      taker_buy_pct:  parseFloat(takerBuyPct.toFixed(1)),
      dominant_side:  dominantSide,
      signal,
      candles:        sessionCandles.length,
    };
  });
}

/**
 * buildSignal — texto interpretativo da sessão baseado nas métricas
 */
function buildSignal(
  label: string,
  cvd: number,
  takerBuyPct: number,
  priceMoveP: number,
): string {
  if (takerBuyPct > 55 && cvd > 0) {
    return `Pressão compradora forte na sessão ${label} — CVD positivo consistente`;
  }
  if (takerBuyPct < 45 && cvd < 0) {
    return `Pressão vendedora ${label} — CVD negativo · fluxo de saída`;
  }
  if (Math.abs(priceMoveP) > 1.0 && takerBuyPct > 52) {
    return `Movimento direcional ${label}: +${priceMoveP.toFixed(2)}% com takers compradores liderando`;
  }
  if (Math.abs(priceMoveP) > 1.0 && takerBuyPct < 48) {
    return `Movimento de queda ${label}: ${priceMoveP.toFixed(2)}% com pressão vendedora`;
  }
  return `Sessão ${label} equilibrada — sem dominância clara de lado`;
}
