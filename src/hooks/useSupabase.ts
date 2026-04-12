/**
 * useSupabase.ts — TanStack Query hooks para persistência via Supabase
 *
 * Se Supabase não estiver configurado (sem VITE_SUPABASE_URL),
 * os fetchers retornam mock silenciosamente — a UI não quebra.
 *
 * Mutations usam invalidateQueries para forçar re-fetch após write.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAlertRules,
  upsertAlertRule,
  deleteAlertRule,
  fetchPortfolioPositions,
  upsertPortfolioPosition,
  deletePortfolioPosition,
  fetchUserSettings,
  upsertUserSettings,
  type AlertRule,
  type PortfolioPosition,
  type UserSettings,
} from '@/services/supabase';

// ─── Alert Rules ──────────────────────────────────────────────────────────────

/**
 * useAlertRules — lista de regras de alerta do usuário
 * Sem auto-refetch (dado drive-by-user, não de mercado).
 */
export function useAlertRules() {
  return useQuery({
    queryKey: ['supabase', 'alert-rules'],
    queryFn:  fetchAlertRules,
    staleTime: Infinity,  // não re-fetcha automaticamente
    refetchInterval: false,
  });
}

/** useUpsertAlertRule — cria ou atualiza uma regra */
export function useUpsertAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertAlertRule,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'alert-rules'] }),
  });
}

/** useDeleteAlertRule — remove uma regra pelo id */
export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAlertRule(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'alert-rules'] }),
  });
}

// ─── Portfolio Positions ──────────────────────────────────────────────────────

/**
 * usePortfolioPositions — lista de posições do usuário
 */
export function usePortfolioPositions() {
  return useQuery({
    queryKey: ['supabase', 'portfolio'],
    queryFn:  fetchPortfolioPositions,
    staleTime: Infinity,
    refetchInterval: false,
  });
}

/** useUpsertPosition — cria ou atualiza uma posição */
export function useUpsertPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertPortfolioPosition,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'portfolio'] }),
  });
}

/** useDeletePosition — remove uma posição pelo id */
export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePortfolioPosition(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'portfolio'] }),
  });
}

// ─── User Settings ────────────────────────────────────────────────────────────

/**
 * useUserSettings — configurações do usuário (data_mode, tema, etc.)
 */
export function useUserSettings() {
  return useQuery({
    queryKey: ['supabase', 'settings'],
    queryFn:  fetchUserSettings,
    staleTime: Infinity,
    refetchInterval: false,
  });
}

/** useUpdateSettings — atualiza configurações parcialmente */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) => upsertUserSettings(settings),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'settings'] }),
  });
}

// Re-export types for convenience in pages
export type { AlertRule, PortfolioPosition, UserSettings };
