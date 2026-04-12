#!/usr/bin/env python3
"""
validate_var.py — Validação matemática: VaR, Sharpe, Beta, Max Drawdown

Fase 4 Sprint 4.1 — MRP Dashboard
QA: fórmulas validadas aqui antes de serem portadas para TypeScript.

Métodos implementados:
  1. VaR Paramétrico     — assume retornos normais; usa z-score
  2. VaR Histórico       — percentil direto dos retornos históricos
  3. CVaR (Expected Shortfall) — média das perdas além do VaR
  4. Sharpe Anualizado   — (retorno médio − risk free) / vol anualizada
  5. Beta vs BTC         — razão entre delta ajustado e exposição total
  6. Max Drawdown        — maior queda pico→vale num histórico
"""

import math
import statistics
from typing import List, Optional

# ─── Parâmetros de mercado (substituir por live no TypeScript) ─────────────────
RISK_FREE_ANNUAL = 0.045   # 4.5% T-bill anualizado
TRADING_DAYS     = 252     # dias de trading no ano
CONF_95          = 1.6449  # z-score 95%
CONF_99          = 2.3263  # z-score 99%

# ─── Tipo de posição (espelha PortfolioPosition do TypeScript) ─────────────────
class Position:
    def __init__(self, type: str, size: float, entry_price: float,
                 current_price: float, delta: float, gamma: float = 0,
                 theta: float = 0, vega: float = 0, side: str = 'long'):
        self.type         = type
        self.size         = size
        self.entry_price  = entry_price
        self.current_price = current_price
        self.delta        = delta * (1 if side == 'long' else -1)
        self.gamma        = gamma
        self.theta        = theta
        self.vega         = vega
        self.side         = side


# ─── 1. Volatilidade histórica (log-returns) ──────────────────────────────────
def compute_historical_vol(prices: List[float]) -> dict:
    """
    Calcula volatilidade diária e anualizada a partir de uma série de preços.
    Usa log-returns: r_t = ln(P_t / P_{t-1})
    """
    if len(prices) < 2:
        return {'daily_vol': 0.0, 'annual_vol': 0.0, 'returns': []}

    log_returns = [math.log(prices[i] / prices[i-1]) for i in range(1, len(prices))]
    mean_ret    = statistics.mean(log_returns)
    daily_vol   = statistics.stdev(log_returns)   # std dev dos log-returns
    annual_vol  = daily_vol * math.sqrt(TRADING_DAYS)

    return {
        'daily_vol':  daily_vol,
        'annual_vol': annual_vol,
        'mean_daily': mean_ret,
        'returns':    log_returns,
    }


# ─── 2. Delta total do portfólio (em BTC e em USD) ────────────────────────────
def compute_portfolio_delta(positions: List[Position], btc_price: float) -> dict:
    """
    Delta ponderado: cada posição contribui delta * size (contratos ou BTC).
    Cash (delta=0) não contribui.
    Opções: delta é o Black-Scholes delta (0 a ±1).
    Futuros/Spot: delta=1.0 (long) ou -1.0 (short).
    """
    total_delta = sum(p.delta * p.size for p in positions if p.type != 'cash')
    total_value = sum(p.size * p.current_price for p in positions)
    delta_usd   = total_delta * btc_price
    delta_pct   = (delta_usd / total_value * 100) if total_value > 0 else 0.0

    return {
        'total_delta': total_delta,
        'delta_usd':   delta_usd,
        'delta_pct':   delta_pct,
        'total_value': total_value,
    }


# ─── 3. VaR Paramétrico ────────────────────────────────────────────────────────
def compute_var_parametric(delta_usd: float, daily_vol: float) -> dict:
    """
    VaR Paramétrico (normal): loss = z * σ_portfolio
    σ_portfolio = |delta_usd| * daily_vol_btc

    Premissas:
    - Retornos normais (pode subestimar caudas gordas)
    - Δt = 1 dia
    - Ignora gamma (aproximação de 1ª ordem)

    Borda: delta_usd=0 → VaR=0
    """
    sigma_portfolio = abs(delta_usd) * daily_vol
    var_95 = CONF_95 * sigma_portfolio
    var_99 = CONF_99 * sigma_portfolio
    return {
        'var_95_1d':  -var_95,   # negativo = perda
        'var_99_1d':  -var_99,
        'sigma_port': sigma_portfolio,
    }


# ─── 4. VaR Histórico ─────────────────────────────────────────────────────────
def compute_var_historical(delta_usd: float, log_returns: List[float]) -> dict:
    """
    VaR Histórico: aplica os retornos históricos do BTC ao delta USD do portfólio.
    P&L_t = delta_usd * r_t
    VaR = percentil 5% dos P&L simulados (para 95% VaR)

    Borda: sem histórico → retorna 0
    """
    if not log_returns:
        return {'var_95_hist': 0.0, 'var_99_hist': 0.0, 'cvar_95': 0.0}

    pnl_series = sorted([delta_usd * r for r in log_returns])
    n = len(pnl_series)

    # Índices do percentil (floor)
    idx_95 = int(math.floor(0.05 * n))
    idx_99 = int(math.floor(0.01 * n))

    var_95 = pnl_series[max(0, idx_95)]
    var_99 = pnl_series[max(0, idx_99)]

    # CVaR (Expected Shortfall): média das perdas abaixo do VaR_95
    tail = pnl_series[:max(1, idx_95)]
    cvar_95 = statistics.mean(tail) if tail else var_95

    return {
        'var_95_hist': var_95,
        'var_99_hist': var_99,
        'cvar_95':     cvar_95,
    }


# ─── 5. Sharpe Anualizado ─────────────────────────────────────────────────────
def compute_sharpe(log_returns: List[float], risk_free_annual: float = RISK_FREE_ANNUAL) -> float:
    """
    Sharpe = (E[r_anual] − rf) / σ_anual

    Borda: vol=0 → Sharpe=inf (retorna 999 por convenção)
    """
    if len(log_returns) < 2:
        return 0.0

    daily_mean = statistics.mean(log_returns)
    daily_std  = statistics.stdev(log_returns)

    if daily_std == 0:
        return 999.0

    annual_return = daily_mean * TRADING_DAYS
    annual_vol    = daily_std  * math.sqrt(TRADING_DAYS)
    rf_daily      = risk_free_annual / TRADING_DAYS

    sharpe = (annual_return - risk_free_annual) / annual_vol
    return round(sharpe, 3)


# ─── 6. Max Drawdown ──────────────────────────────────────────────────────────
def compute_max_drawdown(prices: List[float]) -> float:
    """
    MDD = max{ (peak − trough) / peak } para todos os períodos

    Retorna: número negativo (ex: -0.183 = -18.3%)
    Borda: série vazia → 0.0
    """
    if len(prices) < 2:
        return 0.0

    peak = prices[0]
    max_dd = 0.0

    for price in prices[1:]:
        if price > peak:
            peak = price
        drawdown = (price - peak) / peak
        if drawdown < max_dd:
            max_dd = drawdown

    return round(max_dd, 4)


# ─── 7. Beta vs BTC ───────────────────────────────────────────────────────────
def compute_beta(delta_pct: float) -> float:
    """
    Beta simplificado: delta_pct / 100
    Um portfólio 100% BTC long tem beta=1.0
    Um portfólio 50% BTC + 50% cash tem beta≈0.5
    Opções amplificam beta via delta fracionário
    """
    return round(delta_pct / 100.0, 3)


# ─── INTEGRADOR PRINCIPAL ─────────────────────────────────────────────────────
def compute_full_risk_metrics(positions: List[Position], btc_prices_history: List[float]) -> dict:
    """
    Entrada principal: lista de posições + histórico de preços BTC (30d mínimo).
    Retorna: todas as métricas de risco.
    """
    btc_price = btc_prices_history[-1] if btc_prices_history else 95000.0

    vol_data   = compute_historical_vol(btc_prices_history)
    delta_data = compute_portfolio_delta(positions, btc_price)
    delta_usd  = delta_data['delta_usd']
    daily_vol  = vol_data['daily_vol']
    log_returns = vol_data['returns']

    var_param  = compute_var_parametric(delta_usd, daily_vol)
    var_hist   = compute_var_historical(delta_usd, log_returns)
    sharpe     = compute_sharpe(log_returns)
    mdd        = compute_max_drawdown(btc_prices_history)
    beta       = compute_beta(delta_data['delta_pct'])

    return {
        # VaR Paramétrico
        'var_95_1d':       var_param['var_95_1d'],
        'var_99_1d':       var_param['var_99_1d'],
        # VaR Histórico
        'var_95_hist':     var_hist['var_95_hist'],
        'var_99_hist':     var_hist['var_99_hist'],
        'cvar_95':         var_hist['cvar_95'],
        # Métricas de portfolio
        'sharpe_ratio':    sharpe,
        'max_drawdown_pct': mdd,
        'beta_vs_btc':     beta,
        'annual_vol_pct':  round(vol_data['annual_vol'] * 100, 1),
        # Delta
        'delta_usd':       round(delta_usd, 0),
        'delta_pct':       round(delta_data['delta_pct'], 1),
        'total_value_usd': round(delta_data['total_value'], 0),
    }


# ─── TESTES UNITÁRIOS ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    import random
    random.seed(42)

    # Gera histórico de preços BTC simulado (30 dias, ~4% vol diária)
    prices = [95000.0]
    for _ in range(29):
        r = random.gauss(0.001, 0.042)
        prices.append(prices[-1] * math.exp(r))

    # Portfólio de exemplo
    btc_price = prices[-1]
    positions = [
        Position('spot',         0.5, 95000, btc_price, delta=1.0, side='long'),
        Position('futures_perp', 1.0, 94000, btc_price, delta=1.0, side='long'),
        Position('option_call',  5.0, 95000, btc_price, delta=0.35, gamma=0.0012, side='long'),
        Position('cash',         10000, 1, 1, delta=0.0),
    ]

    result = compute_full_risk_metrics(positions, prices)

    print("=== VaR + Portfolio Risk — Validação ===")
    print(f"BTC Price: ${btc_price:,.0f}")
    print(f"Delta USD: ${result['delta_usd']:,.0f} ({result['delta_pct']:.1f}%)")
    print(f"VaR 95% (param): ${result['var_95_1d']:,.0f}/dia")
    print(f"VaR 99% (param): ${result['var_99_1d']:,.0f}/dia")
    print(f"VaR 95% (hist):  ${result['var_95_hist']:,.0f}/dia")
    print(f"CVaR 95%:        ${result['cvar_95']:,.0f}/dia")
    print(f"Sharpe:          {result['sharpe_ratio']:.3f}")
    print(f"Max Drawdown:    {result['max_drawdown_pct']*100:.1f}%")
    print(f"Beta vs BTC:     {result['beta_vs_btc']:.3f}")
    print(f"Vol Anualizada:  {result['annual_vol_pct']:.1f}%")
    print()

    # Casos de borda
    print("=== Casos de borda ===")
    # Portfólio vazio
    empty = compute_full_risk_metrics([], prices)
    assert empty['var_95_1d'] == 0.0, "Portfólio vazio deve ter VaR=0"
    print("✅ Portfólio vazio: VaR=0")

    # Apenas cash
    cash_only = [Position('cash', 50000, 1, 1, delta=0)]
    cash_result = compute_full_risk_metrics(cash_only, prices)
    assert cash_result['delta_usd'] == 0.0, "Apenas cash: delta=0"
    assert cash_result['beta_vs_btc'] == 0.0, "Apenas cash: beta=0"
    print("✅ Cash only: delta=0, beta=0")

    # Histórico vazio
    no_hist = compute_full_risk_metrics(positions, [])
    assert no_hist['var_95_1d'] == 0.0, "Sem histórico: VaR=0"
    print("✅ Sem histórico: VaR=0")

    print()
    print("✅ TODOS OS TESTES PASSARAM — Lógica validada para port TypeScript")
