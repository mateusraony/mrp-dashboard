-- Adiciona colunas de rastreamento de freshness ao market_cache
ALTER TABLE market_cache
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_live    BOOLEAN     DEFAULT TRUE;

-- Preenche rows existentes
UPDATE market_cache
SET fetched_at = NOW(),
    is_live    = TRUE
WHERE fetched_at IS NULL;

COMMENT ON COLUMN market_cache.fetched_at IS 'Timestamp de quando o dado foi buscado da API de origem';
COMMENT ON COLUMN market_cache.is_live IS 'TRUE = dado veio diretamente da API; FALSE = dado retornado do cache Supabase';
