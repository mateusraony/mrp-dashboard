#!/usr/bin/env python3
"""
validate_risk_score.py — Risk Score Composto (0–100)

Fase 4 Sprint 4.2 — MRP Dashboard
Composto de 5 fatores ponderados, cada um normalizado 0–100.

Fórmula final:
  score = w1*funding_score + w2*oi_score + w3*vol_score + w4*fng_score + w5*price_score

Pesos:
  funding_rate   → 0.30 (fator mais direto de squeeze/flush)
  oi_delta_pct   → 0.20 (acumulação/liquidação)
  dvol (DVOL 30d)→ 0.20 (vol implícita — medo/ganância)
  fear_greed     → 0.20 (sentimento retail)
  price_deviation→ 0.10 (desvio vs EMA20 — extensão do move)

Score > 70 → RISCO ELEVADO (flush/squeeze iminente)
Score 40–70 → MODERADO
Score < 40 → SAUDÁVEL (sem sinais de estresse)
"""

def score_funding_rate(funding_rate: float) -> float:
    """
    funding_rate: taxa por 8h (ex: 0.0001 = 0.01%)
    Valores típicos: -0.001 a +0.003
    Score sobe com magnitude — tanto positivo quanto negativo é risco.
    Pico em ±0.003 → score=100

    Borda: funding_rate=0 → score=0 (neutro)
    """
    magnitude = abs(funding_rate)
    # Normaliza: 0.0003 = score 10, 0.001 = score 33, 0.003 = score 100
    score = min(100.0, magnitude / 0.003 * 100.0)
    return round(score, 1)


def score_oi_delta(oi_delta_pct: float) -> float:
    """
    oi_delta_pct: variação % do OI nas últimas 24h
    Magnitude importa — OI caindo muito = liquidação (risco), OI subindo muito = euforia (risco)
    ±5% = score 50, ±10% = score 100

    Borda: oi_delta=0 → score=0
    """
    magnitude = abs(oi_delta_pct)
    score = min(100.0, magnitude / 10.0 * 100.0)
    return round(score, 1)


def score_dvol(dvol_30d: float) -> float:
    """
    dvol_30d: Deribit DVOL (vol implícita BTC, annualizada %)
    Baseline saudável: 40–60%
    DVOL > 80% = crise, DVOL < 30% = complacência (também risco de spike)

    score alto = ambiente estressado
    """
    if dvol_30d >= 80:
        # Crise — DVOL muito alto
        score = min(100.0, 70.0 + (dvol_30d - 80.0) / 40.0 * 30.0)
    elif dvol_30d >= 60:
        # Elevado
        score = 40.0 + (dvol_30d - 60.0) / 20.0 * 30.0
    elif dvol_30d >= 40:
        # Normal
        score = (dvol_30d - 40.0) / 20.0 * 40.0
    elif dvol_30d >= 20:
        # Comprimido — pode ser perigoso (spike risk)
        score = 20.0 + (40.0 - dvol_30d) / 20.0 * 20.0
    else:
        # Muito comprimido
        score = 40.0
    return round(score, 1)


def score_fear_greed(fng_value: float) -> float:
    """
    fng_value: 0–100 (0=medo extremo, 100=ganância extrema)
    Extremos em ambos os lados = risco (reversão iminente)
    50 = neutro → score baixo
    0 ou 100 → score alto

    score = 2 * |fng - 50|  (máx 100 quando fng=0 ou fng=100)
    Borda: fng=50 → score=0
    """
    score = min(100.0, abs(fng_value - 50.0) * 2.0)
    return round(score, 1)


def score_price_deviation(price: float, ema20: float) -> float:
    """
    price_deviation: % de desvio do preço atual vs EMA-20
    ±5% = score 50, ±10% = score 100
    Extensão acima da EMA (euforia) ou abaixo (capitulação) = risco de reversão.

    EMA20 calculada externamente (ex: dos últimos 20 candles diários)
    Borda: price=ema20 → score=0
    """
    if ema20 <= 0:
        return 0.0
    deviation_pct = abs((price - ema20) / ema20) * 100.0
    score = min(100.0, deviation_pct / 10.0 * 100.0)
    return round(score, 1)


def compute_ema(prices: list, period: int = 20) -> float:
    """EMA simples para uma série de preços."""
    if len(prices) < period:
        return prices[-1] if prices else 0.0
    k = 2.0 / (period + 1)
    ema = prices[0]
    for p in prices[1:]:
        ema = p * k + ema * (1 - k)
    return ema


def compute_risk_score(
    funding_rate: float,
    oi_delta_pct: float,
    dvol_30d: float,
    fear_greed: float,
    btc_price: float,
    btc_prices_20d: list,
) -> dict:
    """
    Parâmetros:
      funding_rate  — taxa 8h (float, ex: 0.0002)
      oi_delta_pct  — variação OI 24h em % (float, ex: 3.5)
      dvol_30d      — DVOL Deribit em % anualizado (float, ex: 65.0)
      fear_greed    — índice 0–100
      btc_price     — preço atual BTC em USD
      btc_prices_20d — lista de preços dos últimos 20 dias

    Retorna:
      score: int 0–100
      regime: 'RISCO ELEVADO' | 'MODERADO' | 'SAUDÁVEL'
      module_scores: dict com cada componente
    """
    WEIGHTS = {
        'funding': 0.30,
        'oi':      0.20,
        'vol':     0.20,
        'fng':     0.20,
        'price':   0.10,
    }

    ema20  = compute_ema(btc_prices_20d, 20)
    scores = {
        'funding': score_funding_rate(funding_rate),
        'oi':      score_oi_delta(oi_delta_pct),
        'vol':     score_dvol(dvol_30d),
        'fng':     score_fear_greed(fear_greed),
        'price':   score_price_deviation(btc_price, ema20),
    }

    composite = sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)
    composite = round(min(100.0, max(0.0, composite)), 1)

    if composite >= 65:
        regime = 'RISCO ELEVADO'
    elif composite >= 35:
        regime = 'MODERADO'
    else:
        regime = 'SAUDÁVEL'

    return {
        'score':         int(composite),
        'score_raw':     composite,
        'regime':        regime,
        'module_scores': scores,
        'ema20':         round(ema20, 0),
    }


# ─── TESTES ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import math, random
    random.seed(7)

    # Simula 20 dias de preços BTC
    prices = [94000.0]
    for _ in range(19):
        prices.append(prices[-1] * math.exp(random.gauss(0.001, 0.03)))

    print("=== Risk Score Composto — Validação ===\n")

    # Cenário 1: Ambiente Saudável
    r = compute_risk_score(
        funding_rate=0.00008,
        oi_delta_pct=1.2,
        dvol_30d=52.0,
        fear_greed=48,
        btc_price=95000,
        btc_prices_20d=prices,
    )
    print(f"Cenário SAUDÁVEL:       score={r['score']} regime={r['regime']}")
    print(f"  Componentes: {r['module_scores']}")
    assert r['regime'] == 'SAUDÁVEL', f"Esperado SAUDÁVEL, got {r['regime']}"

    # Cenário 2: Ambiente de Risco Elevado
    r2 = compute_risk_score(
        funding_rate=0.0025,   # funding muito alto
        oi_delta_pct=8.5,      # OI subindo muito
        dvol_30d=82.0,         # vol implícita em crise
        fear_greed=88,         # ganância extrema
        btc_price=prices[-1] * 1.12,  # 12% acima da EMA
        btc_prices_20d=prices,
    )
    print(f"\nCenário RISCO ELEVADO: score={r2['score']} regime={r2['regime']}")
    print(f"  Componentes: {r2['module_scores']}")
    assert r2['regime'] == 'RISCO ELEVADO', f"Esperado RISCO ELEVADO, got {r2['regime']} (score={r2['score']})"

    # Cenário 3: Moderado (funding elevado mas não extremo, dvol 70%, fng 65)
    r3 = compute_risk_score(
        funding_rate=0.0012,
        oi_delta_pct=5.5,
        dvol_30d=70.0,
        fear_greed=65,
        btc_price=prices[-1] * 1.06,
        btc_prices_20d=prices,
    )
    print(f"\nCenário MODERADO:      score={r3['score']} regime={r3['regime']}")
    assert r3['regime'] == 'MODERADO', f"Esperado MODERADO, got {r3['regime']}"

    # Borda: funding=0, oi=0, fng=50, dvol=50, price=ema
    r_zero = compute_risk_score(0, 0, 50, 50, prices[-1], prices)
    print(f"\nCenário NEUTRO PURO:   score={r_zero['score']}")
    assert r_zero['score'] < 30, "Neutro deve ter score baixo"

    print("\n✅ TODOS OS TESTES PASSARAM — Risk Score validado para port TypeScript")
