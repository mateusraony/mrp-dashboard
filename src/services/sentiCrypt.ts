/**
 * sentiCrypt.ts — SentiCrypt: sentimento cripto derivado de análise de tweets
 *
 * API pública, sem autenticação, sem limite documentado.
 * Atualiza a cada ~2 horas. CORS-friendly (browser pode chamar diretamente).
 * Endpoint: https://api.senticrypt.com/v2/all.json
 *
 * Dados: array de objetos diários com sentimento médio e volume de tweets.
 * Sentimento: -1 (negativo extremo) a +1 (positivo extremo).
 */

import { z } from 'zod';
import { apiFetch } from '@/lib/apiClient';

const BASE = 'https://api.senticrypt.com/v2';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SentiCryptEntrySchema = z.object({
  date:  z.string(),
  mean:  z.number(),        // sentimento médio -1 a +1
  count: z.number().int(),  // volume de tweets analisados
});

const SentiCryptResponseSchema = z.array(SentiCryptEntrySchema);

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface SentiCryptData {
  date:      string;  // YYYY-MM-DD
  sentiment: number;  // -1 a +1
  count:     number;  // volume de tweets
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

export async function fetchSentiCrypt(): Promise<SentiCryptData> {
  const raw = await apiFetch(`${BASE}/all.json`);
  const entries = SentiCryptResponseSchema.parse(raw);
  if (entries.length === 0) throw new Error('SentiCrypt: resposta vazia');
  // Pegar o mais recente (último elemento)
  const latest = entries[entries.length - 1];
  return { date: latest.date, sentiment: latest.mean, count: latest.count };
}
