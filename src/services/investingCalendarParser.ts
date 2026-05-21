/**
 * investingCalendarParser.ts — Lógica pura de análise AI e parsing de importância
 * para eventos do Investing.com. Browser-safe (sem cheerio).
 *
 * Lógica idêntica ao script fetch-investing-calendar.mjs para que os testes
 * Vitest possam validar as regras sem dependências de DOM ou Node.js.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AiAnalysisInput {
  title:    string;
  forecast: string | null;
  previous: string | null;
  currency: string | null;
}

export interface AiAnalysisResult {
  analysis:    string;
  direction:   'up' | 'down' | 'neutral';
  probability: number;
}

// ─── generateAiAnalysis ───────────────────────────────────────────────────────

/**
 * Gera análise macro rule-based para um evento do Investing.com.
 * Considera título, forecast e previous para determinar direção e probabilidade.
 */
export function generateAiAnalysis(event: AiAnalysisInput): AiAnalysisResult {
  const t   = (event.title   ?? '').toLowerCase();
  const frc = event.forecast ?? '';
  const prv = event.previous ?? '';

  const fNum = parseFloat(frc);
  const pNum = parseFloat(prv);
  const canCompare = !isNaN(fNum) && !isNaN(pNum);

  // FOMC / Interest Rate decision
  if (/fomc|federal open|interest rate decision|fed rate/.test(t)) {
    return {
      analysis:    'Decisão do Fed. Volatilidade extrema esperada. Manutenção: neutro. Alta: bearish BTC. Corte: bullish.',
      direction:   'neutral',
      probability: 0.60,
    };
  }

  // CPI / PCE / Inflation
  if (/\bcpi\b|consumer price|pce|inflation|infla/.test(t)) {
    if (canCompare) {
      if (fNum > pNum) {
        return {
          analysis:    'CPI/PCE acima do anterior → pressão inflacionária → Fed hawkish → BTC cai.',
          direction:   'down',
          probability: 0.63,
        };
      }
      if (fNum < pNum) {
        return {
          analysis:    'CPI/PCE abaixo do anterior → desaceleração inflacionária → Fed dovish → BTC favorável.',
          direction:   'up',
          probability: 0.59,
        };
      }
    }
    return {
      analysis:    'Dado de inflação. Monitorar resultado vs consenso: acima=bearish BTC, abaixo=bullish.',
      direction:   'neutral',
      probability: 0.50,
    };
  }

  // NFP / Non-Farm Payroll
  if (/nfp|nonfarm|non-farm|payroll|non farm/.test(t)) {
    return {
      analysis:    'NFP acima do esperado = hawkish → BTC cai. Abaixo = dovish → BTC sobe.',
      direction:   'neutral',
      probability: 0.55,
    };
  }

  // GDP / PIB
  if (/\bgdp\b|gross domestic|pib|produto interno/.test(t)) {
    return {
      analysis:    'Crescimento forte = Fed hawkish. Crescimento fraco = Fed dovish, favorável BTC.',
      direction:   'up',
      probability: 0.52,
    };
  }

  // Initial Jobless Claims / Unemployment
  if (/initial claims|jobless claims|unemployment claims/.test(t)) {
    return {
      analysis:    'Aumento de pedidos = fraqueza do emprego → Fed dovish → BTC favorável.',
      direction:   'up',
      probability: 0.51,
    };
  }

  // JOLTS / Job Openings
  if (/jolts|job openings|vagas/.test(t)) {
    return {
      analysis:    'Vagas de emprego. Queda = mercado esfriando → possivelmente dovish.',
      direction:   'neutral',
      probability: 0.50,
    };
  }

  // Padrão
  return {
    analysis:    'Evento macro de alta importância. Monitorar resultado vs consenso.',
    direction:   'neutral',
    probability: 0.50,
  };
}

// ─── parseImportanceFromHtmlClass ────────────────────────────────────────────

/**
 * Determina importância (1–3) a partir de um array de nomes de classes CSS
 * dos ícones de "touro" do Investing.com.
 *
 * Ícone preenchido = class NÃO contém "Empty" (case-insensitive).
 * Ícone vazio     = class contém "Empty".
 *
 * @param iconClasses - Array de strings com as classes de cada ícone na linha
 * @returns 1 | 2 | 3
 */
export function parseImportanceFromHtmlClass(iconClasses: string[]): 1 | 2 | 3 {
  const filled = iconClasses.filter(cls => !cls.toLowerCase().includes('empty')).length;
  if (filled >= 3) return 3;
  if (filled === 2) return 2;
  return 1;
}

// ─── getEventStatus ───────────────────────────────────────────────────────────

/**
 * Determina o status de um evento com base na hora UTC e presença de valor actual.
 *
 * @param datetimeUtc - ISO string do horário do evento (UTC)
 * @param actual      - Valor realizado (null se ainda não liberado)
 * @returns 'scheduled' | 'released'
 */
export function getEventStatus(
  datetimeUtc: string,
  actual:      string | null,
): 'scheduled' | 'released' {
  if (actual !== null && actual.trim() !== '') return 'released';
  return 'scheduled';
}

// ─── generateEventId ─────────────────────────────────────────────────────────

/**
 * Gera ID estável para um evento no formato inv_<eventId>_<YYYYMMDD>.
 */
export function generateEventId(eventId: string, datetimeUtc: string): string {
  const dateSlug = datetimeUtc.slice(0, 10).replace(/-/g, '');
  return `inv_${eventId}_${dateSlug}`;
}
