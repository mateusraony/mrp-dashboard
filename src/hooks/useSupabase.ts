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
  fetchAlertEvents,
  insertAlertEvent,
  fetchThresholdHistory,
  insertThresholdChange,
  type AlertRule,
  type PortfolioPosition,
  type UserSettings,
  type AlertEvent,
  type ThresholdChange,
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

// ─── Governance — Alert Events ────────────────────────────────────────────────

/** useAlertEvents — feed de disparos recentes de alertas */
export function useAlertEvents(limit = 20) {
  return useQuery({
    queryKey: ['supabase', 'alert-events', limit],
    queryFn:  () => fetchAlertEvents(limit),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/** useLogAlertEvent — mutation para registrar disparo */
export function useLogAlertEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: Omit<AlertEvent, 'id'>) => insertAlertEvent(event),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'alert-events'] }),
  });
}

/** useThresholdHistory — histórico de mudanças de limiar */
export function useThresholdHistory(ruleId?: string) {
  return useQuery({
    queryKey: ['supabase', 'threshold-history', ruleId ?? 'all'],
    queryFn:  () => fetchThresholdHistory(ruleId),
    staleTime: Infinity,
    refetchInterval: false,
  });
}

/** useLogThresholdChange — mutation para registrar mudança de threshold */
export function useLogThresholdChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: Omit<ThresholdChange, 'id'>) => insertThresholdChange(change),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['supabase', 'threshold-history'] }),
  });
}

// Re-export types for convenience in pages
export type { AlertRule, PortfolioPosition, UserSettings, AlertEvent, ThresholdChange };
