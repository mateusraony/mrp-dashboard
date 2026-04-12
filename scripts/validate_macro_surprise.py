#!/usr/bin/env python3
"""
validate_macro_surprise.py — Macro Surprise Index (Z-Score)

Fase 4 Sprint 4.4 — MRP Dashboard

Conceito:
  Dado um evento macro (CPI, NFP, FOMC, etc.), a "surpresa" é a diferença
  entre o resultado real (actual) e a expectativa de consenso.
  O Z-Score normaliza essa surpresa pela volatilidade histórica das surpresas.

Fórmula:
  surprise_raw = actual - consensus
  z_score = surprise_raw / std_dev(historical_surprises)

Onde:
  historical_surprises = [actual_i - consensus_i for event_i in últimos N eventos]

Interpretação:
  z > +2 → surpresa fortemente positiva → hawkish (CPI alto = ruim para BTC)
  z < -2 → surpresa fortemente negativa → dovish (dados fracos = bom para BTC)
  -1 < z < +1 → dentro do esperado → mínima reação

Impacto BTC esperado (empírico):
  Para CPI/NFP (inflação/emprego):
    z > +2 → BTC −3% a −6% em 4h
    z < -2 → BTC +2% a +5% em 24h
    |z| < 1 → BTC ±1% (sell-the-news typical)
"""

import math
import statistics
from typing import List, Optional

class MacroSurprise:
    def __init__(self, date: str, event: str, actual: float, consensus: float,
                 btc_move_1h: float = 0.0, btc_move_24h: float = 0.0):
        self.date         = date
        self.event        = event
        self.actual       = actual
        self.consensus    = consensus
        self.surprise_raw = actual - consensus
        self.btc_move_1h  = btc_move_1h
        self.btc_move_24h = btc_move_24h


def compute_surprise_zscore(current_actual: float, current_consensus: float,
                             historical: List[MacroSurprise]) -> dict:
    """
    Computa o Z-Score de surpresa para o evento atual, baseado no histórico.

    Parâmetros:
      current_actual:    valor real do evento atual
      current_consensus: expectativa de consenso do evento atual
      historical:        lista de eventos passados do mesmo tipo

    Retorna:
      z_score: float (negativo = abaixo exp, positivo = acima exp)
      surprise_raw: float
      direction: 'above' | 'below' | 'inline'
      btc_expected_move_1h: float (% estimado baseado em histórico)
      btc_expected_move_24h: float (% estimado)

    Borda: histórico vazio → z_score = 0, usa surpresa normalizada simples
    """
    surprise_raw = current_actual - current_consensus

    # Histórico de surpresas
    hist_surprises = [h.surprise_raw for h in historical]

    if len(hist_surprises) >= 2:
        hist_std = statistics.stdev(hist_surprises)
        hist_mean = statistics.mean(hist_surprises)
    elif len(hist_surprises) == 1:
        hist_std = abs(hist_surprises[0]) or 0.1
        hist_mean = hist_surprises[0]
    else:
        # Sem histórico: normaliza pela magnitude do consenso (1% threshold)
        hist_std  = max(0.01, abs(current_consensus) * 0.01)
        hist_mean = 0.0

    z_score = (surprise_raw - hist_mean) / hist_std if hist_std != 0 else 0.0

    # Direção da surpresa
    if z_score > 0.5:
        direction = 'above'
    elif z_score < -0.5:
        direction = 'below'
    else:
        direction = 'inline'

    # BTC move esperado baseado em histórico de eventos similares
    above_events = [h for h in historical if h.surprise_raw > 0]
    below_events = [h for h in historical if h.surprise_raw < 0]

    if direction == 'above' and above_events:
        btc_1h  = statistics.mean([h.btc_move_1h  for h in above_events])
        btc_24h = statistics.mean([h.btc_move_24h for h in above_events])
    elif direction == 'below' and below_events:
        btc_1h  = statistics.mean([h.btc_move_1h  for h in below_events])
        btc_24h = statistics.mean([h.btc_move_24h for h in below_events])
    else:
        btc_1h  = 0.0
        btc_24h = 0.0

    # Confiança: baseada no tamanho do histórico (máx 5 eventos para alta confiança)
    confidence = min(1.0, len(historical) / 5.0)

    return {
        'z_score':              round(z_score, 2),
        'surprise_raw':         round(surprise_raw, 3),
        'direction':            direction,
        'btc_expected_move_1h': round(btc_1h, 2),
        'btc_expected_move_24h': round(btc_24h, 2),
        'confidence':           round(confidence, 2),
        'hist_std':             round(hist_std, 4),
        'n_events':             len(historical),
    }


def compute_surprise_index_series(events: List[MacroSurprise]) -> list:
    """
    Computa série temporal do Z-Score de surpresa para toda a lista de eventos.
    Para cada evento, usa os eventos ANTERIORES como histórico (rolling).

    Retorna lista ordenada por data com z_scores calculados.
    """
    results = []
    for i, event in enumerate(events):
        hist = events[:i]  # Apenas eventos anteriores ao atual
        z_data = compute_surprise_zscore(event.actual, event.consensus, hist)
        results.append({
            'date':            event.date,
            'event':           event.event,
            'actual':          event.actual,
            'consensus':       event.consensus,
            'surprise_raw':    z_data['surprise_raw'],
            'z_score':         z_data['z_score'],
            'direction':       z_data['direction'],
            'btc_move_1h':     event.btc_move_1h,
            'btc_move_24h':    event.btc_move_24h,
        })
    return results


# ─── TESTES ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=== Macro Surprise Index — Validação ===\n")

    # CPI histórico (últimos 6 meses simulados)
    cpi_history = [
        MacroSurprise('2025-10-10', 'CPI', 3.2, 3.1, btc_move_1h=-2.1, btc_move_24h=-3.5),  # acima
        MacroSurprise('2025-11-13', 'CPI', 3.0, 3.1, btc_move_1h=1.8,  btc_move_24h=3.2),   # abaixo
        MacroSurprise('2025-12-11', 'CPI', 3.1, 3.0, btc_move_1h=-1.5, btc_move_24h=-2.8),  # acima
        MacroSurprise('2026-01-15', 'CPI', 2.9, 3.0, btc_move_1h=2.1,  btc_move_24h=4.1),   # abaixo
        MacroSurprise('2026-02-12', 'CPI', 3.0, 3.0, btc_move_1h=0.2,  btc_move_24h=-0.8),  # inline
    ]

    # Evento atual: CPI de Março 2026
    result = compute_surprise_zscore(
        current_actual=3.4,      # CPI muito acima
        current_consensus=3.0,
        historical=cpi_history,
    )
    print(f"CPI atual: 3.4% vs consenso 3.0%")
    print(f"  Z-Score:   {result['z_score']}")
    print(f"  Direção:   {result['direction']}")
    print(f"  BTC +1h:   {result['btc_expected_move_1h']:.1f}%")
    print(f"  BTC +24h:  {result['btc_expected_move_24h']:.1f}%")
    print(f"  Confiança: {result['confidence']*100:.0f}%")
    assert result['direction'] == 'above', "CPI muito acima deve ser 'above'"
    assert result['z_score'] > 1.0, "Z-score deve ser alto"

    # Série histórica
    print(f"\n=== Série histórica CPI ===")
    series = compute_surprise_index_series(cpi_history)
    for s in series:
        print(f"  {s['date']} | Z={s['z_score']:+.2f} | {s['direction']:6} | BTC 1h={s['btc_move_1h']:+.1f}%")

    # Casos de borda
    print("\n=== Casos de borda ===")
    # Sem histórico
    z_empty = compute_surprise_zscore(3.2, 3.0, [])
    print(f"Sem histórico: z={z_empty['z_score']}, n={z_empty['n_events']}")

    # Inline (z perto de 0)
    z_inline = compute_surprise_zscore(3.0, 3.0, cpi_history)
    assert z_inline['direction'] == 'inline', "Sem surpresa deve ser inline"
    print(f"✅ Inline (sem surpresa): direction={z_inline['direction']}")

    print("\n✅ TODOS OS TESTES PASSARAM — Macro Surprise validado para TypeScript")
