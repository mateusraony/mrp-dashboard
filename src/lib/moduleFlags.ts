/**
 * moduleFlags.ts — leitura dos toggles de módulo definidos em Settings.jsx
 *
 * Espelha MODULE_DEFS de Settings.jsx. Usar readModuleFlag() nos hooks
 * para evitar chamadas de rede quando o módulo está desativado.
 */

const DEFAULTS: Record<string, boolean> = {
  ENABLE_OPTIONS:     true,
  ENABLE_SPOT_FLOW:   true,
  ENABLE_ONCHAIN:     true,
  ENABLE_NEWS:        true,
  ENABLE_FEAR_GREED:  true,
  ENABLE_COINMETRICS: false,
};

export function readModuleFlag(key: string): boolean {
  if (typeof localStorage === 'undefined') return DEFAULTS[key] ?? true;
  const stored = localStorage.getItem('module_' + key);
  if (stored === null) return DEFAULTS[key] ?? true;
  return stored === 'true';
}
