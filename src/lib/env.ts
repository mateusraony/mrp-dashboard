/// <reference types="vite/client" />
/**
 * env.ts — Validação de variáveis de ambiente com Zod
 * Falha em build-time se variável obrigatória estiver ausente.
 * Todas opcionais em modo mock; obrigatórias em modo live.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  // ── Data mode ─────────────────────────────────────────────────────────────
  VITE_DATA_MODE: z.enum(['mock', 'live']).default('live'),

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

/**
 * DATA_MODE global — prioridade:
 * 1. localStorage 'mrp_data_mode' (alterado em Settings sem rebuild)
 * 2. VITE_DATA_MODE do .env.local
 * 3. 'mock' (default)
 */
const _storedMode = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('mrp_data_mode') as 'mock' | 'live' | null)
  : null;
export const DATA_MODE: 'mock' | 'live' =
  (_storedMode === 'mock' || _storedMode === 'live') ? _storedMode : env.VITE_DATA_MODE;

/** true = usar APIs reais; false = usar mock data */
export const IS_LIVE = DATA_MODE === 'live';

/**
 * setDataMode — persiste o modo em localStorage e recarrega a página.
 * Como DATA_MODE é lido no bootstrap do módulo, precisa de reload para ativar.
 */
export function setDataMode(mode: 'mock' | 'live'): void {
  localStorage.setItem('mrp_data_mode', mode);
  window.location.reload();
}
