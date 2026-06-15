/**
 * send-telegram-digest — Edge Function Supabase (Deno)
 *
 * Envia resumo diário de mercado via Telegram Bot API.
 * Chamada via pg_cron (diariamente) ou manualmente via HTTP POST.
 *
 * Estratégia de dados (prioridade):
 *   1. Lê do market_cache (Supabase) — populado pelo browser a cada 30s
 *   2. Fallback: fetch direto à Binance/alternative.me se cache vazio
 *   Isso resolve o problema de BTC = N/A quando Binance bloqueia IPs do Deno Deploy.
 *
 * Requer:
 *   SUPABASE_URL              — injetado automaticamente
 *   SUPABASE_SERVICE_ROLE_KEY — injetado automaticamente
 *   (telegram_bot_token e telegram_chat_id lidos de user_settings)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TelegramSettings {
  telegram_enabled:   boolean;
  telegram_chat_id:   string | null;
  telegram_bot_token: string | null;
  telegram_schedule:  string;
}

interface MarketSnapshot {
  // BTC price
  btc_price:         number;
  btc_change_24h:    number;
  btc_high_24h:      number;
  btc_low_24h:       number;
  // Derivatives
  funding_rate:      number;
  funding_available: boolean;
  open_interest_usd: number;
  long_short_ratio:  number | null;
  // Multi-venue funding
  bybit_funding:     number | null;
  okx_funding:       number | null;
  // Sentiment
  fear_greed:        number;
  // Risk Score (computed client-side, persisted to market_cache by useRiskScore hook)
  risk_score:        number | null;
  risk_regime:       string | null;
  // Regime (from regime_score_history — written daily by browser)
  regime_label:      string | null;
  regime_score:      number | null;
  // Macro (from fred:macro-board cache)
  vix:               number | null;
  us10y:             number | null;
  // Liquidations
  liq_total_usd:     number | null;
  // On-chain + dominance
  btc_dominance:     number | null;
  nupl:              number | null;
  mvrv_zscore:       number | null;
  mvrv_zone:         string | null;
  // Top news
  top_news:          Array<{ title: string; sentiment: -1|0|1; domain: string }> | null;
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', correlationId: string, msg: string, data?: unknown) {
  console.log(JSON.stringify({ level, correlationId, msg, data, ts: new Date().toISOString() }));
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtChange(pct: number): string {
  const sign  = pct >= 0 ? '+' : '';
  const emoji = pct >= 0 ? '🟢' : '🔴';
  return `${emoji} ${sign}${pct.toFixed(2)}%`;
}

function fmtFunding(f: number, available: boolean): string {
  if (!available) return 'N/D';
  const sign  = f >= 0 ? '+' : '';
  const emoji = Math.abs(f) > 0.05 ? '🔴' : f >= 0 ? '🟢' : '🟡';
  return `${emoji} ${sign}${f.toFixed(4)}%/8h`;
}

function fmtFng(v: number): string {
  if (v >= 75) return `${v} 🔴 Extreme Greed`;
  if (v >= 55) return `${v} 🟡 Greed`;
  if (v >= 45) return `${v} ⚪ Neutral`;
  if (v >= 25) return `${v} 🟡 Fear`;
  return `${v} 🔴 Extreme Fear`;
}

function fmtOI(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${usd.toLocaleString('en-US')}`;
}

function fmtLS(ratio: number): string {
  const emoji = ratio >= 1 ? '🟢' : '🔴';
  return `${emoji} ${ratio.toFixed(2)}`;
}

function fmtLiq(usd: number): string {
  const val = fmtOI(usd);
  if (usd > 500_000_000) return `${val} 🔴 extremo`;
  if (usd > 200_000_000) return `${val} 🟡 elevado`;
  return `${val} 🟢 normal`;
}

function fmtRiskScore(score: number, regime: string): string {
  const emoji = score >= 70 ? '🔴' : score >= 40 ? '🟡' : '🟢';
  return `${emoji} ${score}/100 · ${regime}`;
}

function fmtFundingMulti(bnbRate: number, bnbAvailable: boolean, bybit: number | null, okx: number | null): string {
  const parts: string[] = [];
  if (bnbAvailable) {
    const sign = bnbRate >= 0 ? '+' : '';
    parts.push(`BNB ${sign}${bnbRate.toFixed(4)}%`);
  }
  if (bybit != null) {
    const sign = bybit >= 0 ? '+' : '';
    parts.push(`Bybit ${sign}${bybit.toFixed(4)}%`);
  }
  if (okx != null) {
    const sign = okx >= 0 ? '+' : '';
    parts.push(`OKX ${sign}${okx.toFixed(4)}%`);
  }
  return parts.length > 0 ? parts.join('  ·  ') : 'N/D';
}

function fmtMvrv(zscore: number, zone: string): string {
  const emoji = zscore > 2 ? '🔴' : zscore > 0.5 ? '🟡' : '🟢';
  const shortZone = zone.split('/')[0].trim();
  return `${emoji} Z ${zscore.toFixed(2)} · ${shortZone}`;
}

function escapeMd(text: string): string {
  // Escape Markdown v1 control chars so external content never breaks sendMessage
  return text.replace(/[_*`\[\]]/g, (c) => `\\${c}`);
}

function fmtNewsItem(item: { title: string; sentiment: -1|0|1; domain: string }): string {
  const emoji = item.sentiment === 1 ? '🟢' : item.sentiment === -1 ? '🔴' : '⚪';
  return `${emoji} ${escapeMd(item.title)} — ${item.domain}`;
}

function fmtRegime(label: string, score: number): string {
  const upper = label.toUpperCase();
  const emoji = upper === 'RISK-ON' ? '🟢' : upper === 'RISK-OFF' ? '🔴' : '🟡';
  return `${emoji} ${label} · ${score}/100`;
}

function fmtVix(v: number): string {
  if (v > 30) return `${v.toFixed(1)} 🔴`;
  if (v > 20) return `${v.toFixed(1)} 🟡`;
  return `${v.toFixed(1)} ⚪`;
}

function fmtNupl(n: number): string {
  if (n > 0.75) return `${n.toFixed(2)} 🔴 Euforia`;
  if (n > 0.5)  return `${n.toFixed(2)} 🟡 Crença`;
  if (n > 0.25) return `${n.toFixed(2)} 🟢 Esperança`;
  if (n > 0)    return `${n.toFixed(2)} ⚪ Otimismo`;
  return `${n.toFixed(2)} 🔵 Capitulação`;
}

// ─── Leitura do market_cache ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFromCache(sb: ReturnType<typeof createClient>, key: string, maxAgeMinutes = 120): Promise<any | null> {
  const { data } = await sb
    .from('market_cache')
    .select('value_json, updated_at')
    .eq('cache_key', key)
    .maybeSingle();
  if (!data?.value_json) return null;
  // Rejeitar dados obsoletos — se mais velhos que maxAgeMinutes, usar fallback
  const ageMs = Date.now() - new Date(data.updated_at as string).getTime();
  if (ageMs > maxAgeMinutes * 60 * 1000) return null;
  return data.value_json;
}

// ─── Fallback: fetch direto ao Binance / alternative.me ──────────────────────

async function fetchBinanceFallback(): Promise<{
  btc_price: number; btc_change_24h: number; btc_high_24h: number; btc_low_24h: number;
  funding_rate: number; open_interest_usd: number;
} | null> {
  try {
    const [tickerRes, fundingRes, oiRes] = await Promise.allSettled([
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT',  { signal: AbortSignal.timeout(8_000) }),
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', { signal: AbortSignal.timeout(8_000) }),
      fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT', { signal: AbortSignal.timeout(8_000) }),
    ]);

    let btc_price = 0, btc_change_24h = 0, btc_high_24h = 0, btc_low_24h = 0;
    let funding_rate = 0, open_interest_usd = 0;

    if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
      const d = await tickerRes.value.json() as { lastPrice?: string; priceChangePercent?: string; highPrice?: string; lowPrice?: string };
      btc_price      = parseFloat(d.lastPrice ?? '0');
      btc_change_24h = parseFloat(d.priceChangePercent ?? '0');
      btc_high_24h   = parseFloat(d.highPrice ?? '0');
      btc_low_24h    = parseFloat(d.lowPrice ?? '0');
    }
    if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
      const d = await fundingRes.value.json() as { lastFundingRate?: string };
      funding_rate = parseFloat(d.lastFundingRate ?? '0') * 100;
    }
    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      const d = await oiRes.value.json() as { openInterest?: string };
      open_interest_usd = parseFloat(d.openInterest ?? '0') * btc_price;
    }
    if (btc_price === 0) return null;
    return { btc_price, btc_change_24h, btc_high_24h, btc_low_24h, funding_rate, open_interest_usd };
  } catch {
    return null;
  }
}

async function fetchFngFallback(): Promise<number> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return 50;
    const d = await res.json() as { data?: Array<{ value: string }> };
    return parseInt(d.data?.[0]?.value ?? '50', 10);
  } catch {
    return 50;
  }
}

async function fetchBybitFallback(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT',
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const d = await res.json() as { result?: { list?: Array<{ fundingRate?: string }> } };
    const rate = d.result?.list?.[0]?.fundingRate;
    return rate != null ? parseFloat((parseFloat(rate) * 100).toFixed(4)) : null;
  } catch { return null; }
}

async function fetchOkxFallback(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP',
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const d = await res.json() as { data?: Array<{ fundingRate?: string }> };
    const rate = d.data?.[0]?.fundingRate;
    return rate != null ? parseFloat((parseFloat(rate) * 100).toFixed(4)) : null;
  } catch { return null; }
}

// ─── Montagem do snapshot ─────────────────────────────────────────────────────

async function buildSnapshot(
  sb: ReturnType<typeof createClient>,
  correlationId: string,
): Promise<MarketSnapshot> {
  // Lê market_cache e regime_score_history em paralelo
  const [ticker, lsRatioRaw, fng, macroBoardRaw, dominanceRaw, onChainRaw, regimeRow,
         riskScoreRaw, bybitTickerRaw, okxTickerRaw, newsRaw] = await Promise.all([
    fetchFromCache(sb, 'btc:ticker', 10),                // stale > 10 min → fallback Binance
    fetchFromCache(sb, 'binance:longshort:BTCUSDT', 10), // stale > 10 min → omitir L/S
    fetchFromCache(sb, 'fear-greed:1', 360),             // stale > 6h → fallback alternative.me
    fetchFromCache(sb, 'fred:macro-board', 1440),        // stale > 24h → omitir macro
    fetchFromCache(sb, 'coingecko:dominance', 120),      // stale > 2h → omitir BTC.D
    fetchFromCache(sb, 'coinmetrics:cycle', 1440),       // stale > 24h → omitir NUPL/MVRV
    sb.from('regime_score_history').select('score, label').order('scored_at', { ascending: false }).limit(1).maybeSingle(),
    fetchFromCache(sb, 'risk:score', 30),                // score computado pelo browser
    fetchFromCache(sb, 'bybit:ticker', 10),              // funding Bybit (raw decimal)
    fetchFromCache(sb, 'okx:ticker', 10),                // funding OKX (raw decimal)
    fetchFromCache(sb, 'gdelt:news:bitcoin crypto', 60), // top notícias
  ]);

  let btc_price = 0, btc_change_24h = 0, btc_high_24h = 0, btc_low_24h = 0;
  let funding_rate = 0, funding_available = false;
  let open_interest_usd = 0;
  // L/S ratio da própria cache key — não inferido do btc:ticker (que não contém esse dado)
  // Shape: LongShortRatioData { longAccount: 0.53, shortAccount: 0.47, ls_ratio_pct: 53 }
  // Ratio = longAccount / shortAccount. Se cache ausente/stale, omitir do digest.
  const long_short_ratio: number | null = lsRatioRaw?.longAccount > 0 && lsRatioRaw?.shortAccount > 0
    ? parseFloat((lsRatioRaw.longAccount / lsRatioRaw.shortAccount).toFixed(2))
    : null;

  if (ticker && ticker.mark_price > 0) {
    // Shape: BtcTickerData { mark_price, last_funding_rate, price_change_pct, high_24h, low_24h, open_interest }
    btc_price         = ticker.mark_price;
    btc_change_24h    = ticker.price_change_pct ?? 0;
    btc_high_24h      = ticker.high_24h ?? 0;
    btc_low_24h       = ticker.low_24h ?? 0;
    funding_rate      = (ticker.last_funding_rate ?? 0) * 100;
    funding_available = true;
    open_interest_usd = (ticker.open_interest ?? 0) * btc_price;
    log('INFO', correlationId, 'BTC ticker do market_cache', { btc_price, funding_rate });
  } else {
    // Fallback: fetch direto
    log('WARN', correlationId, 'market_cache vazio — tentando Binance direto');
    const live = await fetchBinanceFallback();
    if (live) {
      btc_price         = live.btc_price;
      btc_change_24h    = live.btc_change_24h;
      btc_high_24h      = live.btc_high_24h;
      btc_low_24h       = live.btc_low_24h;
      funding_rate      = live.funding_rate;
      funding_available = true;
      open_interest_usd = live.open_interest_usd;
      // long_short_ratio já lido da cache key dedicada — fallback Binance não sobrescreve
      log('INFO', correlationId, 'BTC ticker do Binance direto', { btc_price });
    } else {
      log('ERROR', correlationId, 'Binance indisponível — BTC price não obtido');
    }
  }

  // Fear & Greed — cache key é 'fear-greed:1' (inclui limit)
  let fear_greed = 50;
  if (fng && typeof fng.value === 'number') {
    fear_greed = fng.value;
  } else if (fng && Array.isArray(fng) && fng[0]?.value) {
    fear_greed = parseInt(fng[0].value, 10);
  } else {
    fear_greed = await fetchFngFallback();
  }

  // Macro (FRED) — { series: [{ id: 'VIX', value: 22.5 }, { id: 'US10Y', value: 4.2 }, ...] }
  let vix: number | null = null;
  let us10y: number | null = null;
  if (macroBoardRaw?.series && Array.isArray(macroBoardRaw.series)) {
    const vixEntry   = macroBoardRaw.series.find((s: { id: string; value?: number }) => s.id === 'VIX');
    const us10yEntry = macroBoardRaw.series.find((s: { id: string; value?: number }) => s.id === 'US10Y');
    if (vixEntry?.value != null)   vix   = parseFloat(vixEntry.value.toFixed(1));
    if (us10yEntry?.value != null) us10y = parseFloat(us10yEntry.value.toFixed(2));
  }

  // Dominância BTC — { btc_dominance: 55.2, eth_dominance: 14.8 }
  const btc_dominance: number | null = dominanceRaw?.btc_dominance != null
    ? parseFloat(dominanceRaw.btc_dominance.toFixed(1))
    : null;

  // On-chain (CoinMetrics) — { nupl: 0.45, mvrv_zscore: 0.84, mvrv_zone: '...', ... }
  const nupl: number | null = onChainRaw?.nupl != null
    ? parseFloat(onChainRaw.nupl.toFixed(3))
    : null;
  const mvrv_zscore: number | null = onChainRaw?.mvrv_zscore != null
    ? parseFloat(onChainRaw.mvrv_zscore.toFixed(2))
    : null;
  const mvrv_zone: string | null = onChainRaw?.mvrv_zone ?? null;

  // Risk Score — persisted to market_cache by useRiskScore hook in browser
  const risk_score: number | null = riskScoreRaw?.score != null ? riskScoreRaw.score as number : null;
  const risk_regime: string | null = riskScoreRaw?.regime ?? null;

  // Multi-venue funding — raw decimal × 100 = %
  // Fallback direto às APIs públicas de Bybit/OKX quando cache estiver vazio
  const bybitFromCache = bybitTickerRaw?.funding_rate != null
    ? parseFloat((bybitTickerRaw.funding_rate * 100).toFixed(4))
    : null;
  const okxFromCache = okxTickerRaw?.funding_rate != null
    ? parseFloat((okxTickerRaw.funding_rate * 100).toFixed(4))
    : null;
  const [bybitFallbackVal, okxFallbackVal] = await Promise.all([
    bybitFromCache == null ? fetchBybitFallback() : Promise.resolve(null),
    okxFromCache   == null ? fetchOkxFallback()   : Promise.resolve(null),
  ]);
  const bybit_funding = bybitFromCache ?? bybitFallbackVal;
  const okx_funding   = okxFromCache   ?? okxFallbackVal;
  if (bybit_funding != null && bybitFromCache == null) log('INFO', correlationId, 'Bybit funding via fallback direto', { bybit_funding });
  if (okx_funding   != null && okxFromCache   == null) log('INFO', correlationId, 'OKX funding via fallback direto',   { okx_funding });

  // Top 3 notícias mais recentes — { title, sentiment, domain, published_at }
  let top_news: Array<{ title: string; sentiment: -1|0|1; domain: string }> | null = null;
  if (Array.isArray(newsRaw) && newsRaw.length > 0) {
    const sorted = [...newsRaw]
      .sort((a, b) => new Date(b.published_at as string).getTime() - new Date(a.published_at as string).getTime())
      .slice(0, 3);
    top_news = sorted.map(n => ({
      title:     (n.title as string).slice(0, 65),
      sentiment: (n.sentiment as -1|0|1) ?? 0,
      domain:    n.domain as string,
    }));
  }

  // Liquidações — cache key 'binance:liquidations:200'
  // Shape: { items: LiqEvent[], ... } — soma total USD dos items
  const liqRaw = await fetchFromCache(sb, 'binance:liquidations:200');
  let liq_total_usd: number | null = null;
  if (liqRaw?.items && Array.isArray(liqRaw.items) && liqRaw.items.length > 0) {
    const total = liqRaw.items.reduce((acc: number, item: { usd_value?: number; qty?: number; price?: number }) => {
      return acc + Math.abs(item.usd_value ?? (item.price ?? 0) * (item.qty ?? 0));
    }, 0);
    if (total > 0) liq_total_usd = total;
  }

  // Regime (regime_score_history — write diário do browser)
  const regime_label: string | null = regimeRow.data?.label ?? null;
  const regime_score: number | null = regimeRow.data?.score ?? null;

  return {
    btc_price, btc_change_24h, btc_high_24h, btc_low_24h,
    funding_rate, funding_available,
    open_interest_usd, long_short_ratio,
    bybit_funding, okx_funding,
    fear_greed,
    risk_score, risk_regime,
    regime_label, regime_score,
    vix, us10y,
    liq_total_usd,
    btc_dominance,
    nupl,
    mvrv_zscore, mvrv_zone,
    top_news,
  };
}

// ─── Montagem da mensagem ─────────────────────────────────────────────────────

function buildDigestMessage(snap: MarketSnapshot, schedule: string): string {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  const priceStr = snap.btc_price > 0
    ? `${fmtPrice(snap.btc_price)} (${fmtChange(snap.btc_change_24h)} 24h)`
    : 'N/D — dashboard indisponível';

  const lines: string[] = [
    `📊 *MRP Dashboard — Resumo Diário*`,
    `_${dateStr} · ${timeStr} BRT_`,
    ``,
  ];

  // Risk Score — logo após o header
  if (snap.risk_score != null && snap.risk_regime) {
    lines.push(`⚡ *Risk Score* ${fmtRiskScore(snap.risk_score, snap.risk_regime)}`);
  }

  lines.push(`💰 *BTC* ${priceStr}`);

  if (snap.btc_high_24h > 0) {
    lines.push(`   Alta ${fmtPrice(snap.btc_high_24h)} · Baixa ${fmtPrice(snap.btc_low_24h)}`);
  }

  lines.push(``);

  if (snap.regime_label && snap.regime_score != null) {
    lines.push(`🌡️ *Regime* ${fmtRegime(snap.regime_label, snap.regime_score)}`);
  }

  // Funding multi-venue (Binance + Bybit + OKX)
  lines.push(`📈 *Funding* ${fmtFundingMulti(snap.funding_rate, snap.funding_available, snap.bybit_funding, snap.okx_funding)}`);

  if (snap.open_interest_usd > 0) {
    const lsStr = snap.long_short_ratio != null ? `  ·  L/S ${fmtLS(snap.long_short_ratio)}` : '';
    lines.push(`📊 *OI* ${fmtOI(snap.open_interest_usd)}${lsStr}`);
  }

  if (snap.liq_total_usd != null && snap.liq_total_usd > 0) {
    lines.push(`🔥 *Liquidações 24h* ${fmtLiq(snap.liq_total_usd)}`);
  }

  lines.push(`🧠 *Fear & Greed* ${fmtFng(snap.fear_greed)}`);

  const macroLines: string[] = [];
  if (snap.vix != null)   macroLines.push(`VIX ${fmtVix(snap.vix)}`);
  if (snap.us10y != null) macroLines.push(`US10Y ${snap.us10y}%`);
  if (macroLines.length > 0) {
    lines.push(``, `🌐 *Macro* ${macroLines.join('  ·  ')}`);
  }

  if (snap.btc_dominance != null) {
    lines.push(`👑 *BTC.D* ${snap.btc_dominance}%`);
  }

  // On-chain — NUPL e MVRV na mesma linha
  const onChainParts: string[] = [];
  if (snap.nupl != null)                          onChainParts.push(`NUPL ${fmtNupl(snap.nupl)}`);
  if (snap.mvrv_zscore != null && snap.mvrv_zone) onChainParts.push(`MVRV ${fmtMvrv(snap.mvrv_zscore, snap.mvrv_zone)}`);
  if (onChainParts.length > 0) {
    lines.push(`⛓️ *On-Chain* ${onChainParts.join('  ·  ')}`);
  }

  // Notícias — top 3 mais recentes (apenas se cache fresco)
  if (snap.top_news && snap.top_news.length > 0) {
    lines.push(``, `📰 *Notícias* (últimas 6h)`);
    for (const item of snap.top_news) {
      lines.push(fmtNewsItem(item));
    }
  }

  lines.push(
    ``,
    `🔗 [Abrir Dashboard](https://mrp-dashboard.onrender.com)`,
    ``,
    `_Agendado: ${schedule} UTC · Via MRP Dashboard_`,
  );

  return lines.join('\n');
}

// ─── Envio Telegram ───────────────────────────────────────────────────────────

async function sendTelegram(
  token:  string,
  chatId: string,
  text:   string,
): Promise<{ ok: boolean; msgId?: number; httpStatus: number; errorBody?: string; latencyMs: number }> {
  const t0  = Date.now();
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false }),
    signal:  AbortSignal.timeout(12_000),
  });

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    return { ok: false, httpStatus: res.status, errorBody: errorBody.slice(0, 500), latencyMs };
  }

  const body = await res.json() as { ok: boolean; result?: { message_id: number } };
  return { ok: body.ok === true, msgId: body.result?.message_id, httpStatus: res.status, latencyMs };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Aceita { force: true } no body para ignorar dedup diário (teste manual via dashboard)
  let forceResend = false;
  try {
    const body = await req.json() as { force?: boolean };
    forceResend = body?.force === true;
  } catch { /* sem body ou JSON inválido — comportamento normal */ }

  const correlationId = crypto.randomUUID();
  const startMs = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  log('INFO', correlationId, 'send-telegram-digest iniciado');

  const { data: jobRow } = await sb
    .from('system_job_log')
    .insert({ job_name: 'send-telegram-digest', correlation_id: correlationId, status: 'started' })
    .select('id')
    .single();
  const jobId = jobRow?.id as string | undefined;

  try {
    const { data: settings, error: settingsError } = await sb
      .from('user_settings')
      .select('telegram_enabled, telegram_chat_id, telegram_bot_token, telegram_schedule')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      log('ERROR', correlationId, 'Erro ao ler user_settings', { error: settingsError.message });
      await sb.from('system_job_log').update({
        status: 'error', error_message: settingsError.message, duration_ms: Date.now() - startMs,
      }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: false, error: 'Erro ao ler configurações: ' + settingsError.message, correlationId }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const cfg: TelegramSettings = {
      telegram_enabled:   settings?.telegram_enabled   ?? false,
      telegram_chat_id:   settings?.telegram_chat_id   ?? null,
      telegram_bot_token: settings?.telegram_bot_token ?? null,
      telegram_schedule:  settings?.telegram_schedule  ?? '11:00',
    };

    if (!cfg.telegram_enabled) {
      await sb.from('system_job_log').update({ status: 'success', duration_ms: Date.now() - startMs, alerts_sent: 0 }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: true, status: 'skipped', reason: 'Telegram desabilitado nas configurações', correlationId }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!cfg.telegram_bot_token) {
      const msg = 'Bot Token não configurado. Vá em Configurações → Telegram → Bot Token e insira o token criado via @BotFather.';
      await sb.from('system_job_log').update({ status: 'error', error_message: msg, duration_ms: Date.now() - startMs }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: false, error: msg, correlationId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!cfg.telegram_chat_id) {
      const msg = 'Chat ID não configurado. Envie /start para o seu bot, então use @userinfobot para obter seu chat_id.';
      await sb.from('system_job_log').update({ status: 'error', error_message: msg, duration_ms: Date.now() - startMs }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: false, error: msg, correlationId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Dedup diário — envios forçados (force=true) usam chave por minuto para não bloquear o cron
    const todayKey = forceResend
      ? `digest_manual|${new Date().toISOString().slice(0, 16)}|${cfg.telegram_chat_id}`
      : `digest|${new Date().toISOString().slice(0, 10)}|${cfg.telegram_chat_id}`;
    const { data: existingDelivery } = await sb
      .from('telegram_delivery_log')
      .select('id, status')
      .eq('delivery_key', todayKey)
      .maybeSingle();

    if (!forceResend && existingDelivery?.status === 'sent') {
      await sb.from('system_job_log').update({ status: 'success', duration_ms: Date.now() - startMs, alerts_sent: 0 }).eq('id', jobId!);
      return new Response(
        JSON.stringify({ ok: true, status: 'skipped', reason: 'Digest já enviado hoje', correlationId }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Monta snapshot com fallback automático: cache → Binance direto
    const snapshot = await buildSnapshot(sb, correlationId);
    log('INFO', correlationId, 'Snapshot final', {
      btc_price: snapshot.btc_price,
      regime: snapshot.regime_label,
      vix: snapshot.vix,
      liq: snapshot.liq_total_usd,
    });

    const message = buildDigestMessage(snapshot, cfg.telegram_schedule);
    const result  = await sendTelegram(cfg.telegram_bot_token, cfg.telegram_chat_id, message);
    const duration = Date.now() - startMs;

    await sb.from('telegram_delivery_log').upsert({
      delivery_key:    todayKey,
      window_label:    forceResend ? 'digest_manual' : 'digest',
      chat_id:         cfg.telegram_chat_id,
      status:          result.ok ? 'sent' : 'failed',
      telegram_msg_id: result.msgId ?? null,
      telegram_status: result.httpStatus,
      error_message:   result.errorBody ?? null,
      latency_ms:      result.latencyMs,
      payload_preview: message.slice(0, 200),
    }, { onConflict: 'delivery_key' });

    if (!result.ok) {
      let hint = 'Verifique as configurações do bot.';
      if (result.errorBody?.includes('chat not found'))
        hint = 'Chat não encontrado. Envie /start ao bot e então atualize o Chat ID.';
      else if (result.errorBody?.includes('Forbidden'))
        hint = 'Bot sem permissão. O usuário deve iniciar a conversa com /start.';
      else if (result.errorBody?.includes('Unauthorized'))
        hint = 'Token inválido. Recrie o bot com @BotFather e atualize o token.';

      log('ERROR', correlationId, 'Telegram retornou erro', { status: result.httpStatus, body: result.errorBody });
      await sb.from('system_job_log').update({
        status: 'error', error_message: `Telegram HTTP ${result.httpStatus}: ${result.errorBody?.slice(0, 200)}`,
        duration_ms: duration, alerts_sent: 0,
      }).eq('id', jobId!);

      return new Response(
        JSON.stringify({ ok: false, status: 'failed', telegram_status: result.httpStatus, telegram_error: result.errorBody, hint, correlationId, latency_ms: result.latencyMs }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    log('INFO', correlationId, 'Digest enviado com sucesso', { msgId: result.msgId, latencyMs: result.latencyMs });
    await sb.from('system_job_log').update({
      status: 'success', alerts_sent: 1, duration_ms: duration,
      metadata: { btc_price: snapshot.btc_price, btc_change_24h: snapshot.btc_change_24h, fear_greed: snapshot.fear_greed, regime: snapshot.regime_label, vix: snapshot.vix },
    }).eq('id', jobId!);

    return new Response(
      JSON.stringify({ ok: true, status: 'sent', message_id: result.msgId, btc_price: snapshot.btc_price, correlationId, timestamp: new Date().toISOString(), latency_ms: result.latencyMs }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('ERROR', correlationId, 'Erro crítico no digest', { error: msg });
    await sb.from('system_job_log').update({ status: 'error', error_message: msg, duration_ms: Date.now() - startMs }).eq('id', jobId!).catch(() => null);
    return new Response(
      JSON.stringify({ ok: false, error: msg, correlationId }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
