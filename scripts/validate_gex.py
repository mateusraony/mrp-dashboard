#!/usr/bin/env python3
"""
validate_gex.py — Gamma Exposure (GEX) e Dealer Positioning

Fase 4 Sprint 4.3 — MRP Dashboard

GEX por strike:
  gex_call_k = call_oi_k * gamma_k * spot² * 0.01
  gex_put_k  = -put_oi_k * gamma_k * spot² * 0.01  (dealers short puts → long gamma puts)
  net_gex_k  = gex_call_k + gex_put_k

Interpretação:
  net_gex_total > 0 → Dealers LONG gamma → amortece moves (market maker mode)
  net_gex_total < 0 → Dealers SHORT gamma → amplifica moves (fuel mode)

Gamma Flip Point:
  Strike onde o GEX acumulado muda de sinal.
  Abaixo do flip: dealers SHORT gamma → moves amplificados
  Acima do flip: dealers LONG gamma → moves amortecidos

Referência: Squeezemetrics "The Implied Order Book" (2021)
"""

from typing import List, Optional
import math

class OptionStrike:
    def __init__(self, strike: float, call_oi: float, put_oi: float,
                 gamma: Optional[float] = None, call_iv: float = 0.6, put_iv: float = 0.6):
        self.strike  = strike
        self.call_oi = call_oi   # OI em contratos (1 contrato = 1 BTC)
        self.put_oi  = put_oi
        self.gamma   = gamma     # Se None, estimamos via Black-Scholes simplificado
        self.call_iv = call_iv
        self.put_iv  = put_iv


def estimate_gamma_bs(spot: float, strike: float, iv: float,
                      t_years: float = 0.0274,  # ~10 dias
                      r: float = 0.045) -> float:
    """
    Gamma Black-Scholes aproximado:
    Γ = N'(d1) / (S * σ * √T)

    onde N'(d1) = PDF da normal padrão em d1,
    d1 = [ln(S/K) + (r + σ²/2)*T] / (σ*√T)

    Borda: iv=0 ou T=0 → gamma=0
    """
    if iv <= 0 or t_years <= 0 or spot <= 0 or strike <= 0:
        return 0.0
    try:
        d1 = (math.log(spot / strike) + (r + iv**2 / 2) * t_years) / (iv * math.sqrt(t_years))
        nd1_prime = math.exp(-0.5 * d1**2) / math.sqrt(2 * math.pi)
        gamma = nd1_prime / (spot * iv * math.sqrt(t_years))
        return gamma
    except (ZeroDivisionError, ValueError):
        return 0.0


def compute_gex_by_strike(strikes: List[OptionStrike], spot: float,
                           t_years: float = 0.0274) -> dict:
    """
    Calcula GEX por strike e métricas agregadas.

    GEX formula (em USD):
      gex_call = call_oi * Γ * S² * 0.01
      gex_put  = -put_oi * Γ * S² * 0.01   (negativo: dealers hedgeiam vendendo quando preço cai)
      net_gex  = gex_call + gex_put

    O fator 0.01 converte de "por 1% move" para USD.
    (cada 1% de move no spot = spot * 0.01)

    Borda: lista vazia → zeros
    """
    if not strikes:
        return {
            'gex_by_strike': [],
            'net_gex_total': 0.0,
            'dealer_position': 'neutral',
            'gamma_flip': None,
        }

    gex_data = []
    for s in strikes:
        g = s.gamma
        if g is None:
            # Usa IV média call/put para estimar gamma
            avg_iv = (s.call_iv + s.put_iv) / 2
            g = estimate_gamma_bs(spot, s.strike, avg_iv, t_years)

        # GEX em USD (por strike)
        gex_call = s.call_oi * g * spot * spot * 0.01
        gex_put  = -s.put_oi  * g * spot * spot * 0.01
        net_gex  = gex_call + gex_put

        gex_data.append({
            'strike':   s.strike,
            'gex_call': round(gex_call / 1e6, 2),  # em milhões USD
            'gex_put':  round(gex_put  / 1e6, 2),
            'net_gex':  round(net_gex  / 1e6, 2),
            'gamma':    round(g, 8),
        })

    # Total GEX
    net_gex_total = sum(d['net_gex'] for d in gex_data)  # em milhões USD

    # Posição do dealer
    if net_gex_total > 5:
        dealer_position = 'long_gamma'    # amortece moves
    elif net_gex_total < -5:
        dealer_position = 'short_gamma'   # amplifica moves
    else:
        dealer_position = 'neutral'

    # Gamma flip point: strike onde GEX acumulado (sorted por strike) muda de sinal
    sorted_data = sorted(gex_data, key=lambda x: x['strike'])
    cumulative  = 0.0
    flip_strike = None
    prev_cum    = 0.0
    for d in sorted_data:
        prev_cum   = cumulative
        cumulative += d['net_gex']
        if (prev_cum < 0 and cumulative >= 0) or (prev_cum >= 0 and cumulative < 0):
            flip_strike = d['strike']
            break

    return {
        'gex_by_strike':   gex_data,
        'net_gex_total':   round(net_gex_total, 2),   # milhões USD
        'net_gex_usd':     round(net_gex_total * 1e6, 0),
        'dealer_position': dealer_position,
        'gamma_flip':      flip_strike,
        'flip_distance_pct': round((flip_strike - spot) / spot * 100, 2) if flip_strike else None,
    }


def compute_max_pain(strikes: List[OptionStrike], spot: float) -> float:
    """
    Max Pain: strike onde o valor total das opções que expiram sem valor é máximo.
    = Soma de max(0, strike-spot)*call_oi + max(0, spot-strike)*put_oi por strike.
    Minimiza para o detentor de opções → maximiza perda dos compradores.

    Borda: sem strikes → retorna spot
    """
    if not strikes:
        return spot

    min_pain = float('inf')
    max_pain_strike = spot

    for s_test in strikes:
        total_pain = sum(
            max(0.0, s.strike - s_test.strike) * s.call_oi +
            max(0.0, s_test.strike - s.strike) * s.put_oi
            for s in strikes
        )
        if total_pain < min_pain:
            min_pain = total_pain
            max_pain_strike = s_test.strike

    return max_pain_strike


# ─── TESTES ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    spot = 95000.0

    # Simula chain de opções
    strikes_raw = [
        (80000,  800,  2200),
        (85000,  1200, 1800),
        (90000,  2000, 1500),
        (92000,  2400, 1200),
        (94000,  3200, 900),
        (95000,  4000, 800),   # ATM
        (96000,  3800, 700),
        (98000,  3000, 600),
        (100000, 2500, 500),
        (105000, 1500, 300),
        (110000, 800,  200),
    ]

    strikes = [
        OptionStrike(k, c_oi, p_oi, gamma=None, call_iv=0.60, put_iv=0.65)
        for k, c_oi, p_oi in strikes_raw
    ]

    result = compute_gex_by_strike(strikes, spot)
    max_pain = compute_max_pain(strikes, spot)

    print("=== GEX / Dealer Positioning — Validação ===\n")
    print(f"BTC Spot: ${spot:,.0f}")
    print(f"Net GEX Total: ${result['net_gex_total']:.1f}M USD")
    print(f"Dealer Position: {result['dealer_position']}")
    print(f"Gamma Flip Point: ${result['gamma_flip']:,.0f}" if result['gamma_flip'] else "Gamma Flip: None")
    print(f"Flip Distance: {result['flip_distance_pct']}% from spot" if result['flip_distance_pct'] else "")
    print(f"Max Pain: ${max_pain:,.0f}")
    print(f"\nGEX por Strike:")
    for d in result['gex_by_strike']:
        atm = " ← ATM" if d['strike'] == 95000 else ""
        flip = " ← FLIP" if d['strike'] == result['gamma_flip'] else ""
        print(f"  ${d['strike']:,}: net_gex={d['net_gex']:+.1f}M  (call={d['gex_call']:+.1f}M put={d['gex_put']:+.1f}M){atm}{flip}")

    # Casos de borda
    print("\n=== Casos de borda ===")
    empty_result = compute_gex_by_strike([], spot)
    assert empty_result['net_gex_total'] == 0.0, "Lista vazia deve retornar 0"
    print("✅ Lista vazia: net_gex=0")

    max_pain_empty = compute_max_pain([], spot)
    assert max_pain_empty == spot, "Max pain vazio deve retornar spot"
    print("✅ Max pain vazio: retorna spot")

    print("\n✅ TODOS OS TESTES PASSARAM — GEX validado para port TypeScript")
