-- ═══════════════════════════════════════════════════════════════════════════════
-- MRP Finance Agents — Tabelas de Domínio de Supply Chain
-- Versão: 20260526000000
-- Módulo independente — zero dependência das tabelas cripto existentes.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- TABELA 1: mrp_suppliers — cadastro de fornecedores
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mrp_suppliers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  cnpj                text,
  country             text        NOT NULL DEFAULT 'BR',
  category            text        NOT NULL DEFAULT 'raw_material',
  avg_lead_time_days  integer     NOT NULL DEFAULT 7,
  on_time_rate_pct    numeric     NOT NULL DEFAULT 100 CHECK (on_time_rate_pct BETWEEN 0 AND 100),
  risk_score          numeric                          CHECK (risk_score BETWEEN 0 AND 100),
  risk_label          text,
  risk_updated_at     timestamptz,
  active              boolean     NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mrp_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrp_suppliers: leitura pública"    ON public.mrp_suppliers;
DROP POLICY IF EXISTS "mrp_suppliers: inserção pública"   ON public.mrp_suppliers;
DROP POLICY IF EXISTS "mrp_suppliers: atualização pública" ON public.mrp_suppliers;
CREATE POLICY "mrp_suppliers: leitura pública"    ON public.mrp_suppliers FOR SELECT USING (true);
CREATE POLICY "mrp_suppliers: inserção pública"   ON public.mrp_suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "mrp_suppliers: atualização pública" ON public.mrp_suppliers FOR UPDATE USING (true);

DROP TRIGGER IF EXISTS mrp_suppliers_updated_at ON public.mrp_suppliers;
CREATE TRIGGER mrp_suppliers_updated_at
  BEFORE UPDATE ON public.mrp_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- TABELA 2: mrp_products — catálogo de produtos e insumos
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mrp_products (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku               text        NOT NULL UNIQUE,
  name              text        NOT NULL,
  category          text        NOT NULL DEFAULT 'insumo',
  unit              text        NOT NULL DEFAULT 'kg',
  cost_price        numeric     NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price        numeric                       CHECK (sale_price >= 0),
  margin_pct        numeric     GENERATED ALWAYS AS (
                      CASE WHEN cost_price > 0 AND sale_price IS NOT NULL AND sale_price > 0
                           THEN ROUND(((sale_price - cost_price) / sale_price) * 100, 2)
                           ELSE NULL END
                    ) STORED,
  primary_supplier_id uuid      REFERENCES public.mrp_suppliers(id) ON DELETE SET NULL,
  active            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mrp_products_supplier_idx ON public.mrp_products(primary_supplier_id);

ALTER TABLE public.mrp_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrp_products: leitura pública"     ON public.mrp_products;
DROP POLICY IF EXISTS "mrp_products: inserção pública"    ON public.mrp_products;
DROP POLICY IF EXISTS "mrp_products: atualização pública" ON public.mrp_products;
CREATE POLICY "mrp_products: leitura pública"     ON public.mrp_products FOR SELECT USING (true);
CREATE POLICY "mrp_products: inserção pública"    ON public.mrp_products FOR INSERT WITH CHECK (true);
CREATE POLICY "mrp_products: atualização pública" ON public.mrp_products FOR UPDATE USING (true);

DROP TRIGGER IF EXISTS mrp_products_updated_at ON public.mrp_products;
CREATE TRIGGER mrp_products_updated_at
  BEFORE UPDATE ON public.mrp_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- TABELA 3: mrp_inventory — saldo atual de estoque por produto
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mrp_inventory (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid        NOT NULL UNIQUE REFERENCES public.mrp_products(id) ON DELETE CASCADE,
  quantity        numeric     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_point   numeric     NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  max_stock       numeric                       CHECK (max_stock >= 0),
  last_movement   timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mrp_inventory_product_idx ON public.mrp_inventory(product_id);

ALTER TABLE public.mrp_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrp_inventory: leitura pública"     ON public.mrp_inventory;
DROP POLICY IF EXISTS "mrp_inventory: inserção pública"    ON public.mrp_inventory;
DROP POLICY IF EXISTS "mrp_inventory: atualização pública" ON public.mrp_inventory;
CREATE POLICY "mrp_inventory: leitura pública"     ON public.mrp_inventory FOR SELECT USING (true);
CREATE POLICY "mrp_inventory: inserção pública"    ON public.mrp_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "mrp_inventory: atualização pública" ON public.mrp_inventory FOR UPDATE USING (true);

DROP TRIGGER IF EXISTS mrp_inventory_updated_at ON public.mrp_inventory;
CREATE TRIGGER mrp_inventory_updated_at
  BEFORE UPDATE ON public.mrp_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- TABELA 4: mrp_purchase_orders — ordens de compra
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mrp_purchase_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number       text        NOT NULL UNIQUE DEFAULT ('PO-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  supplier_id     uuid        NOT NULL REFERENCES public.mrp_suppliers(id) ON DELETE RESTRICT,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','shipped','received','cancelled')),
  total_value     numeric     NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  ordered_at      timestamptz NOT NULL DEFAULT now(),
  expected_at     timestamptz,
  received_at     timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mrp_po_supplier_idx ON public.mrp_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS mrp_po_status_idx   ON public.mrp_purchase_orders(status);
CREATE INDEX IF NOT EXISTS mrp_po_ordered_idx  ON public.mrp_purchase_orders(ordered_at DESC);

ALTER TABLE public.mrp_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrp_po: leitura pública"     ON public.mrp_purchase_orders;
DROP POLICY IF EXISTS "mrp_po: inserção pública"    ON public.mrp_purchase_orders;
DROP POLICY IF EXISTS "mrp_po: atualização pública" ON public.mrp_purchase_orders;
CREATE POLICY "mrp_po: leitura pública"     ON public.mrp_purchase_orders FOR SELECT USING (true);
CREATE POLICY "mrp_po: inserção pública"    ON public.mrp_purchase_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "mrp_po: atualização pública" ON public.mrp_purchase_orders FOR UPDATE USING (true);

DROP TRIGGER IF EXISTS mrp_po_updated_at ON public.mrp_purchase_orders;
CREATE TRIGGER mrp_po_updated_at
  BEFORE UPDATE ON public.mrp_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- TABELA 5: mrp_po_items — itens de cada ordem de compra
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mrp_po_items (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       uuid    NOT NULL REFERENCES public.mrp_purchase_orders(id) ON DELETE CASCADE,
  product_id  uuid    NOT NULL REFERENCES public.mrp_products(id) ON DELETE RESTRICT,
  quantity    numeric NOT NULL CHECK (quantity > 0),
  unit_price  numeric NOT NULL CHECK (unit_price >= 0),
  total_line  numeric GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS mrp_po_items_po_idx      ON public.mrp_po_items(po_id);
CREATE INDEX IF NOT EXISTS mrp_po_items_product_idx ON public.mrp_po_items(product_id);

ALTER TABLE public.mrp_po_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrp_po_items: leitura pública"     ON public.mrp_po_items;
DROP POLICY IF EXISTS "mrp_po_items: inserção pública"    ON public.mrp_po_items;
DROP POLICY IF EXISTS "mrp_po_items: atualização pública" ON public.mrp_po_items;
CREATE POLICY "mrp_po_items: leitura pública"     ON public.mrp_po_items FOR SELECT USING (true);
CREATE POLICY "mrp_po_items: inserção pública"    ON public.mrp_po_items FOR INSERT WITH CHECK (true);
CREATE POLICY "mrp_po_items: atualização pública" ON public.mrp_po_items FOR UPDATE USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- TABELA 6: mrp_payment_entries — lançamentos de pagamento
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mrp_payment_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            uuid        NOT NULL REFERENCES public.mrp_purchase_orders(id) ON DELETE RESTRICT,
  amount           numeric     NOT NULL CHECK (amount > 0),
  payment_date     date        NOT NULL DEFAULT CURRENT_DATE,
  method           text        NOT NULL DEFAULT 'boleto'
                               CHECK (method IN ('boleto','pix','wire','card')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','paid','failed','reversed')),
  divergence_flag  boolean     NOT NULL DEFAULT false,
  divergence_note  text,
  reconciled_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mrp_payment_po_idx          ON public.mrp_payment_entries(po_id);
CREATE INDEX IF NOT EXISTS mrp_payment_date_idx        ON public.mrp_payment_entries(payment_date DESC);
CREATE INDEX IF NOT EXISTS mrp_payment_divergence_idx  ON public.mrp_payment_entries(divergence_flag) WHERE divergence_flag = true;

ALTER TABLE public.mrp_payment_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mrp_payment: leitura pública"     ON public.mrp_payment_entries;
DROP POLICY IF EXISTS "mrp_payment: inserção pública"    ON public.mrp_payment_entries;
DROP POLICY IF EXISTS "mrp_payment: atualização pública" ON public.mrp_payment_entries;
CREATE POLICY "mrp_payment: leitura pública"     ON public.mrp_payment_entries FOR SELECT USING (true);
CREATE POLICY "mrp_payment: inserção pública"    ON public.mrp_payment_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "mrp_payment: atualização pública" ON public.mrp_payment_entries FOR UPDATE USING (true);

DROP TRIGGER IF EXISTS mrp_payment_updated_at ON public.mrp_payment_entries;
CREATE TRIGGER mrp_payment_updated_at
  BEFORE UPDATE ON public.mrp_payment_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_mrp_inventory_status — visão consolidada de estoque + produto + fornecedor
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_mrp_inventory_status AS
SELECT
  i.id              AS inventory_id,
  p.sku,
  p.name            AS product_name,
  p.category,
  p.unit,
  p.cost_price,
  p.sale_price,
  p.margin_pct,
  i.quantity,
  i.reorder_point,
  i.max_stock,
  CASE WHEN i.quantity <= i.reorder_point THEN true ELSE false END AS below_reorder,
  s.name            AS supplier_name,
  s.avg_lead_time_days,
  s.on_time_rate_pct,
  s.risk_score      AS supplier_risk_score,
  s.risk_label      AS supplier_risk_label
FROM public.mrp_inventory i
JOIN public.mrp_products p  ON p.id = i.product_id
LEFT JOIN public.mrp_suppliers s ON s.id = p.primary_supplier_id
WHERE p.active = true;

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_mrp_po_reconciliation — visão de POs pendentes vs pagamentos
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_mrp_po_reconciliation AS
SELECT
  po.id           AS po_id,
  po.po_number,
  s.name          AS supplier_name,
  po.status       AS po_status,
  po.total_value  AS po_value,
  COALESCE(SUM(pe.amount) FILTER (WHERE pe.status = 'paid'), 0) AS total_paid,
  po.total_value - COALESCE(SUM(pe.amount) FILTER (WHERE pe.status = 'paid'), 0) AS balance_due,
  COUNT(pe.id) FILTER (WHERE pe.divergence_flag = true) AS divergence_count,
  po.ordered_at,
  po.expected_at,
  po.received_at
FROM public.mrp_purchase_orders po
JOIN public.mrp_suppliers s ON s.id = po.supplier_id
LEFT JOIN public.mrp_payment_entries pe ON pe.po_id = po.id
GROUP BY po.id, po.po_number, s.name, po.status, po.total_value, po.ordered_at, po.expected_at, po.received_at;

COMMENT ON TABLE public.mrp_suppliers           IS 'Cadastro de fornecedores da cadeia de suprimentos';
COMMENT ON TABLE public.mrp_products            IS 'Catálogo de produtos e insumos com margem calculada';
COMMENT ON TABLE public.mrp_inventory           IS 'Saldo atual de estoque por produto';
COMMENT ON TABLE public.mrp_purchase_orders     IS 'Ordens de compra geradas pelo MRP';
COMMENT ON TABLE public.mrp_po_items            IS 'Itens de cada ordem de compra';
COMMENT ON TABLE public.mrp_payment_entries     IS 'Lançamentos de pagamento vinculados a OCs';
