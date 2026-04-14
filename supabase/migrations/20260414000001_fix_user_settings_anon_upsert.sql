-- ─── MRP Dashboard — Fix: upsert anon user_settings ─────────────────────────
-- Versão: 2026-04-14
-- Problema: o código antigo fazia upsert em user_id sem incluir o user_id no
-- payload. Em Postgres, NULL != NULL, então cada save criava uma nova linha ao
-- invés de atualizar a existente. Resultado: múltiplas linhas com user_id NULL
-- na tabela user_settings, e fetchUserSettings falhava com "multiple rows".
--
-- Correção aplicada no código (src/services/supabase.ts):
--   - ANON_USER_ID = '00000000-0000-0000-0000-000000000000' incluído em todo upsert.
--   - fetchUserSettings filtra .eq('user_id', ANON_USER_ID) antes de .maybeSingle().
--
-- Esta migration:
--   1. Remove linhas órfãs (user_id IS NULL) — geradas pelo bug antigo.
--   2. Garante que a constraint UNIQUE em user_id permite o sentinel anônimo
--      (já existe na definição original — este bloco é documentação de segurança).

-- Remove linhas com user_id NULL (podem ter sido criadas pelo bug de upsert antigo)
delete from public.user_settings where user_id is null;
