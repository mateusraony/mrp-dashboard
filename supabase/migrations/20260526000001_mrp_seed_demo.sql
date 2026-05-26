-- ═══════════════════════════════════════════════════════════════════════════════
-- MRP Finance Agents — Dados Demonstrativos
-- Execute APÓS 20260526000000_mrp_core_tables.sql
-- Idempotente: INSERT ... ON CONFLICT DO NOTHING
-- ═══════════════════════════════════════════════════════════════════════════════

-- Fornecedores
INSERT INTO public.mrp_suppliers (id, name, cnpj, country, category, avg_lead_time_days, on_time_rate_pct, notes)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'MetalPrime Indústria Ltda',   '12.345.678/0001-90', 'BR', 'raw_material',  5,  94.0, 'Fornecedor principal de aço e alumínio'),
  ('a1000000-0000-0000-0000-000000000002', 'QuimicaSul Distribuidora',     '98.765.432/0001-11', 'BR', 'chemical',      8,  87.5, 'Solventes e reagentes industriais'),
  ('a1000000-0000-0000-0000-000000000003', 'GlobalParts Import & Export',  NULL,                 'CN', 'electronics',  21,  76.0, 'Componentes eletrônicos — prazo longo'),
  ('a1000000-0000-0000-0000-000000000004', 'Embalagens FlexPack S.A.',     '55.111.222/0001-33', 'BR', 'packaging',     4,  98.2, 'Embalagens plásticas e papelão'),
  ('a1000000-0000-0000-0000-000000000005', 'LogiRápido Transportes',       '44.333.111/0001-55', 'BR', 'logistics',     2, 100.0, 'Frete expresso nacional')
ON CONFLICT (id) DO NOTHING;

-- Produtos / Insumos
INSERT INTO public.mrp_products (id, sku, name, category, unit, cost_price, sale_price, primary_supplier_id)
VALUES
  ('b2000000-0000-0000-0000-000000000001', 'AÇO-HRC-001',   'Bobina de Aço HRC',           'insumo',      'ton',  3850.00, NULL,     'a1000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', 'ALU-LING-002',  'Lingote de Alumínio 99.7%',    'insumo',      'kg',     12.40, NULL,     'a1000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000003', 'SOLV-IPA-003',  'Álcool Isopropílico 99%',      'chemical',    'L',       8.75, NULL,     'a1000000-0000-0000-0000-000000000002'),
  ('b2000000-0000-0000-0000-000000000004', 'COMP-MCU-004',  'Microcontrolador STM32F4',     'electronics', 'un',     42.00, NULL,     'a1000000-0000-0000-0000-000000000003'),
  ('b2000000-0000-0000-0000-000000000005', 'EMB-CX-005',    'Caixa Papelão 30x20x15cm',     'packaging',   'un',      1.85, NULL,     'a1000000-0000-0000-0000-000000000004'),
  ('b2000000-0000-0000-0000-000000000006', 'PROD-FIN-006',  'Painel de Controle Industrial', 'produto',     'un',    320.00, 890.00,  'a1000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000007', 'PROD-FIN-007',  'Módulo Sensor IoT v2',          'produto',     'un',    185.00, 420.00,  'a1000000-0000-0000-0000-000000000003')
ON CONFLICT (sku) DO NOTHING;

-- Estoque atual
INSERT INTO public.mrp_inventory (product_id, quantity, reorder_point, max_stock, last_movement)
VALUES
  ('b2000000-0000-0000-0000-000000000001',  18.5,  10.0,   50.0, now() - interval '3 days'),
  ('b2000000-0000-0000-0000-000000000002', 840.0, 500.0, 2000.0, now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000003', 120.0, 200.0,  600.0, now() - interval '5 days'),
  ('b2000000-0000-0000-0000-000000000004',  45.0,  50.0,  200.0, now() - interval '2 days'),
  ('b2000000-0000-0000-0000-000000000005', 3200.0, 1000.0, 8000.0, now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000006',  12.0,   5.0,   30.0, now() - interval '7 days'),
  ('b2000000-0000-0000-0000-000000000007',   8.0,  10.0,   40.0, now() - interval '4 days')
ON CONFLICT (product_id) DO NOTHING;

-- Ordens de Compra
INSERT INTO public.mrp_purchase_orders (id, supplier_id, status, total_value, ordered_at, expected_at, received_at)
VALUES
  ('c3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'received',  38500.00, now()-interval '20 days', now()-interval '15 days', now()-interval '14 days'),
  ('c3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'shipped',    3062.50, now()-interval '10 days', now()-interval '2 days',  NULL),
  ('c3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'approved',  12600.00, now()-interval '5 days',  now()+interval '16 days', NULL),
  ('c3000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'received',   1480.00, now()-interval '8 days',  now()-interval '4 days',  now()-interval '3 days'),
  ('c3000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'pending',    9720.00, now()-interval '1 day',   now()+interval '4 days',  NULL)
ON CONFLICT (id) DO NOTHING;

-- Itens das OCs
INSERT INTO public.mrp_po_items (po_id, product_id, quantity, unit_price)
VALUES
  ('c3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 10.0, 3850.00),
  ('c3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000003', 350.0, 8.75),
  ('c3000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000004', 300.0, 42.00),
  ('c3000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000005', 800.0, 1.85),
  ('c3000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000002', 784.0, 12.40)
ON CONFLICT DO NOTHING;

-- Lançamentos de pagamento (inclui 1 divergência intencional para demo)
INSERT INTO public.mrp_payment_entries (po_id, amount, payment_date, method, status, divergence_flag, divergence_note, reconciled_at)
VALUES
  -- PO 001: pago correto
  ('c3000000-0000-0000-0000-000000000001', 38500.00, CURRENT_DATE - 13, 'boleto', 'paid',    false, NULL, now()-interval '13 days'),
  -- PO 004: pago com valor DIVERGENTE (demo Feature B)
  ('c3000000-0000-0000-0000-000000000004',  1380.00, CURRENT_DATE - 3,  'pix',    'paid',    true,  'Valor pago (R$1.380) difere da OC (R$1.480) em R$100 — aguarda nota fiscal de ajuste', NULL),
  -- PO 002: pagamento pendente
  ('c3000000-0000-0000-0000-000000000002',  3062.50, CURRENT_DATE + 2,  'boleto', 'pending', false, NULL, NULL)
ON CONFLICT DO NOTHING;
