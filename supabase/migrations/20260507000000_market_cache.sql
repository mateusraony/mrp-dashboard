-- market_cache: cache de borda no Supabase para APIs externas
--
-- Protege limites gratuitos (CoinGecko 30 req/min) e reduz latência
-- em cold starts quando múltiplos usuários abrem o dashboard simultaneamente.
--
-- TTL gerenciado pelo cliente via campo updated_at.
-- cache_key é UNIQUE — upsert por conflict resolution.
--
-- Aplicar: Supabase Dashboard → SQL Editor → executar este arquivo.

CREATE TABLE IF NOT EXISTS market_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text        NOT NULL,
  value_json  jsonb       NOT NULL,
  source      text        NOT NULL DEFAULT 'api',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS market_cache_key_idx
  ON market_cache (cache_key);

ALTER TABLE market_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_cache_public_read"
  ON market_cache FOR SELECT USING (true);

CREATE POLICY "market_cache_anon_insert"
  ON market_cache FOR INSERT WITH CHECK (true);

CREATE POLICY "market_cache_anon_update"
  ON market_cache FOR UPDATE USING (true);
