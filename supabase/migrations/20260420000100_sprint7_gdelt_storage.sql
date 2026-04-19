-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 7.1 — GDELT Article Storage
-- Armazena artigos GDELT para aprendizado da IA e histórico de sentimento.
-- Idempotente: seguro para re-aplicação.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gdelt_articles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url           text        UNIQUE NOT NULL,
  title         text        NOT NULL,
  domain        text,
  published_at  timestamptz,
  sentiment     smallint    CHECK (sentiment IN (-1, 0, 1)),
  sentiment_label text      CHECK (sentiment_label IN ('Positivo', 'Negativo', 'Neutro')),
  query         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gdelt_articles_created_at_idx  ON public.gdelt_articles (created_at DESC);
CREATE INDEX IF NOT EXISTS gdelt_articles_sentiment_idx   ON public.gdelt_articles (sentiment);
CREATE INDEX IF NOT EXISTS gdelt_articles_query_idx       ON public.gdelt_articles (query);
CREATE INDEX IF NOT EXISTS gdelt_articles_published_at_idx ON public.gdelt_articles (published_at DESC);

ALTER TABLE public.gdelt_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdelt_articles: leitura pública" ON public.gdelt_articles;
DROP POLICY IF EXISTS "gdelt_articles: inserção pública" ON public.gdelt_articles;

CREATE POLICY "gdelt_articles: leitura pública"
  ON public.gdelt_articles FOR SELECT USING (true);

CREATE POLICY "gdelt_articles: inserção pública"
  ON public.gdelt_articles FOR INSERT WITH CHECK (true);
