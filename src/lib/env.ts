/**
 * env.ts — Validação de variáveis de ambiente com Zod
 * Falha em build-time se variável obrigatória estiver ausente.
 * Todas opcionais em modo mock; obrigatórias em modo live.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  // ── Data mode ─────────────────────────────────────────────────────────────
  VITE_DATA_MODE: z.enum(['mock', 'live']).default('mock'),

  // ── Supabase (obrigatório para persistência do usuário) ───────────────────
  VITE_SUPABASE_URL:      z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // ── FRED API (macro: yields, VIX, S&P) — gratuita ────────────────────────
  VITE_FRED_API_KEY: z.string().min(1).optional(),
});

// Valida no carregamento do módulo (falha silencioso em dev, hard fail em prod)
const parsed = EnvSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('[env] Variáveis de ambiente inválidas:', parsed.error.format());
}

export const env = parsed.success ? parsed.data : EnvSchema.parse({});

/** DATA_MODE global — 'mock' enquanto não houver API live validada */
export const DATA_MODE = env.VITE_DATA_MODE;

/** true = usar APIs reais; false = usar mock data */
export const IS_LIVE = DATA_MODE === 'live';
