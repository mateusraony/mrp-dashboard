/**
 * bcb.ts — BCB (Banco Central do Brasil) OpenData API
 *
 * Endpoint: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1?formato=json
 * Autenticação: nenhuma — API pública gratuita
 *
 * Séries usadas:
 *   11  — SELIC overnight rate (% ao ano)
 *   433 — IPCA inflação mensal (% ao mês)
 *   1   — USDBRL taxa de câmbio (R$ por USD)
 *
 * Regra de mock: mock APENAS quando IS_LIVE = false (DATA_MODE=mock).
 * Falha de série individual não aborta as demais (Promise.allSettled).
 */

import { z } from 'zod';
import { IS_LIVE } from '@/lib/env';

const BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';

// ─── Schemas ────────────────────────────────────────────────────────────────────────────────

const BcbPointSchema = z.object({
  data:  z.string(),  // "DD/MM/YYYY"
  valor: z.string(),  // valor numérico como string
});

const BcbResponseSchema = z.array(BcbPointSchema);

// ─── Shapes exportadas ─────────────────────────────────────────────────────────────────────────────

export interface BcbData {
  selic:      number | null;  // % ao ano (SELIC overnight)
  ipca:       number | null;  // % ao mês (IPCA mensal)
  usdbrl:     number | null;  // R$ por USD
  updated_at: number;
  quality:    'A' | 'B';
  source:     string;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca o último valor de uma série BCB SGS.
 * Retorna null se a série retornar vazia ou valor inválido.
 */
async function fetchSeries(codigo: number): Promise<number | null> {
  const url = `${BASE}.${codigo}/dados/ultimos/1?formato=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB API error ${res.status}: serie ${codigo}`);

  const json: unknown = await res.json();
  const parsed = BcbResponseSchema.parse(json);
  if (!parsed.length) return null;

  const val = parseFloat(parsed[0].valor);
  return isNaN(val) ? null : val;
}

// ─── Mock ────────────────────────────────────────────────────────────────────────────────────────

function mockBcbData(): BcbData {
  return {
    selic:      14.50,
    ipca:       0.88,
    usdbrl:     4.90,
    updated_at: Date.now(),
    quality:    'B',
    source:     'mock',
  };
}

// ─── Fetcher principal ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchBcbData — SELIC, IPCA e USDBRL via BCB OpenData
 *
 * Cache recomendado: 4h (BCB atualiza dados diariamente).
 * Cada série é buscada de forma independente: uma falha não aborta as demais.
 */
export async function fetchBcbData(): Promise<BcbData> {
  if (!IS_LIVE) return mockBcbData();

  const [selicResult, ipcaResult, usdbrlResult] = await Promise.allSettled([
    fetchSeries(11),   // SELIC overnight
    fetchSeries(433),  // IPCA mensal
    fetchSeries(1),    // USDBRL
  ]);

  const selic  = selicResult.status  === 'fulfilled' ? selicResult.value  : null;
  const ipca   = ipcaResult.status   === 'fulfilled' ? ipcaResult.value   : null;
  const usdbrl = usdbrlResult.status === 'fulfilled' ? usdbrlResult.value : null;

  // Qualidade A quando todos os três valores estão disponíveis
  const allPresent = selic !== null && ipca !== null && usdbrl !== null;

  return {
    selic,
    ipca,
    usdbrl,
    updated_at: Date.now(),
    quality:    allPresent ? 'A' : 'B',
    source:     'BCB OpenData',
  };
}
