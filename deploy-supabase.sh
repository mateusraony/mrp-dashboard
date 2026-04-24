#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# deploy-supabase.sh
# Execute este script NA SUA MAQUINA dentro da pasta mrp-dashboard
# Requisito: Node.js instalado (https://nodejs.org)
# ─────────────────────────────────────────────────────────────────

set -e

PROJECT_REF="gvhkjfsngxrnjavstsju"
FRED_API_KEY="aca67f6bd6899b5cc3ed0fc943f54016"

echo ""
echo "=== PASSO 1: Login no Supabase (abre o navegador) ==="
npx supabase login

echo ""
echo "=== PASSO 2: Linkando projeto ==="
npx supabase link --project-ref "$PROJECT_REF"

echo ""
echo "=== PASSO 3: Deploy das Edge Functions ==="
npx supabase functions deploy fred-proxy
npx supabase functions deploy macro-actual-fetcher
npx supabase functions deploy macro-alert-worker
npx supabase functions deploy telegram-ping
npx supabase functions deploy send-telegram-digest

echo ""
echo "=== PASSO 4: Configurando secret FRED ==="
npx supabase secrets set FRED_API_KEY="$FRED_API_KEY"

echo ""
echo "=========================================="
echo "CONCLUIDO! Edge Functions deployadas."
echo "Agora va ao SQL Editor do Supabase e"
echo "execute o SQL do arquivo: sql-migration.sql"
echo "=========================================="
