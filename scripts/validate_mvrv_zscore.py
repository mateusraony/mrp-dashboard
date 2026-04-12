#!/usr/bin/env python3
"""
validate_mvrv_zscore.py — Validação do cálculo MVRV Z-Score

Fórmula: z = (mvrv_atual - mean(mvrv_Nd)) / std(mvrv_Nd)
Fonte: CoinMetrics Community API (CapMVRVCur, CapRealUSD, PriceUSD)

NUPL = (MarketCap - RealizedCap) / MarketCap
     = (PriceUSD * SplyCur - CapRealUSD) / (PriceUSD * SplyCur)
"""

import math
import sys


def compute_mvrv_zscore(history: list[float], window: int = 90) -> float:
    """
    Computa o MVRV Z-Score com janela deslizante.

    Args:
        history: série histórica de valores MVRV (cronologicamente ordenada)
        window:  tamanho da janela para cálculo de média/desvio (padrão 90d)

    Returns:
        Z-Score do último valor da série
    """
    if len(history) < 5:
        return 0.0

    # Usa toda a série se menor que a janela
    w = history[-min(window, len(history)):]
    if len(w) < 2:
        return 0.0

    mean = sum(w) / len(w)
    variance = sum((v - mean) ** 2 for v in w) / len(w)
    std = math.sqrt(variance)

    if std < 1e-10:
        return 0.0

    return (history[-1] - mean) / std


def compute_nupl(market_cap: float, realized_cap: float) -> float:
    """
    NUPL = (MarketCap - RealizedCap) / MarketCap

    Range: -1 (capitulação extrema) a +1 (euforia extrema)
    Zonas: <0 Capitulação | 0–0.25 Esperança | 0.25–0.5 Crença | 0.5–0.75 Ganância | >0.75 Euforia
    """
    if market_cap <= 0:
        return 0.0
    return (market_cap - realized_cap) / market_cap


def compute_realized_price(realized_cap: float, supply: float) -> float:
    """Realized Price = Realized Cap / Supply em circulação."""
    if supply <= 0:
        return 0.0
    return realized_cap / supply


# ─── Testes ────────────────────────────────────────────────────────────────────

def run_tests():
    print("=== Testes MVRV Z-Score ===\n")

    # Teste 1: série constante → Z-Score = 0
    hist_flat = [2.5] * 100
    z = compute_mvrv_zscore(hist_flat)
    assert abs(z) < 1e-9, f"Esperado 0, obtido {z}"
    print("✓ T1: série constante → Z=0")

    # Teste 2: série crescente → último valor acima da média → Z > 0
    hist_up = [float(i) for i in range(1, 101)]
    z = compute_mvrv_zscore(hist_up)
    assert z > 0, f"Esperado Z>0, obtido {z}"
    print(f"✓ T2: série crescente → Z={z:.4f} > 0")

    # Teste 3: série decrescente → último valor abaixo da média → Z < 0
    hist_down = [float(100 - i) for i in range(100)]
    z = compute_mvrv_zscore(hist_down)
    assert z < 0, f"Esperado Z<0, obtido {z}"
    print(f"✓ T3: série decrescente → Z={z:.4f} < 0")

    # Teste 4: série muito curta → Z = 0
    hist_short = [2.0, 2.1]
    z = compute_mvrv_zscore(hist_short, window=90)
    assert z == 0.0 or abs(z) < 1e-9, f"Esperado 0 (série curta), obtido {z}"
    print("✓ T4: série muito curta → Z=0")

    # Teste 5: NUPL com valores reais
    # Julho 2021: BTC ~$33K, Realized Cap ~$360B, Supply ~18.7M
    price = 33_000
    supply = 18_700_000
    realized_cap = 360e9
    market_cap = price * supply  # ~617B

    nupl = compute_nupl(market_cap, realized_cap)
    assert 0.4 < nupl < 0.5, f"NUPL esperado ~0.42, obtido {nupl:.4f}"
    print(f"✓ T5: NUPL real-world → {nupl:.4f} (zona Crença)")

    # Teste 6: NUPL negativo = capitulação
    nupl_bear = compute_nupl(300e9, 380e9)  # mercado abaixo do realized
    assert nupl_bear < 0, f"Esperado NUPL<0, obtido {nupl_bear}"
    print(f"✓ T6: NUPL capitulação → {nupl_bear:.4f}")

    # Teste 7: Realized Price
    r_price = compute_realized_price(realized_cap, supply)
    expected = realized_cap / supply  # ~$19.25K
    assert abs(r_price - expected) < 1, f"Expected {expected:.0f}, got {r_price:.0f}"
    print(f"✓ T7: Realized Price → ${r_price:,.0f}")

    # Teste 8: Z-Score com janela menor que a série
    hist_long = [1.0 + 0.01 * i for i in range(200)]
    hist_long[-1] = 5.0  # spike no último valor
    z = compute_mvrv_zscore(hist_long, window=90)
    assert z > 2, f"Esperado Z>2 (spike), obtido {z:.4f}"
    print(f"✓ T8: spike no último valor → Z={z:.4f} (sinal de topo)")

    print("\n✅ Todos os testes passaram!\n")

    # Tabela de referência de zonas
    print("─── Zonas MVRV Ratio ────────────")
    print("< 1.0  → Fundo / Subvalorizado (comprar)")
    print("1–2.5  → Zona neutra / Acumulação")
    print("2.5–3.7 → Caro (reduzir exposição)")
    print("> 3.7  → Euforia / Topo de ciclo (vender)")
    print()
    print("─── Zonas NUPL ─────────────────")
    print("< 0.0  → Capitulação")
    print("0–0.25 → Esperança")
    print("0.25–0.5 → Crença / Otimismo")
    print("0.5–0.75 → Ganância")
    print("> 0.75 → Euforia (topo)")


if __name__ == "__main__":
    run_tests()
    sys.exit(0)
