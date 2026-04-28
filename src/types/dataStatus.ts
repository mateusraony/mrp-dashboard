/**
 * dataStatus.ts — Tipos centrais de confiabilidade e proveniência de dados
 *
 * Toda métrica exibida no painel deve declarar seu DataPoint para que
 * o usuário saiba exatamente de onde vem o dado e quão confiável é.
 */

/** Origem/tipo do dado */
export type DataMode =
  | 'live'          // API pública real funcionando
  | 'mock'          // dado vindo de mockData (DATA_MODE=mock ou fallback)
  | 'estimated'     // cálculo/proxy, não fonte oficial direta
  | 'paid_required' // dado confiável depende de API paga
  | 'error';        // falha ao buscar live

/** Grau de confiança na qualidade do dado */
export type DataConfidence = 'A' | 'B' | 'C' | 'D';

/**
 * DataPoint — wrapper padrão para qualquer dado exibido no painel.
 *
 * Convenção:
 *   - mode !== 'live' → reason deve ser preenchido
 *   - updatedAt em unix ms (Date.now())
 */
export interface DataPoint<T = unknown> {
  data: T;
  mode: DataMode;
  source: string;
  sourceUrl?: string;
  updatedAt: number;
  confidence: DataConfidence;
  reason?: string;
}
