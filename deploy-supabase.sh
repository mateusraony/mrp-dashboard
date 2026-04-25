#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# deploy-supabase.sh — Deploy das Edge Functions no Supabase
# Execute este script NA SUA MAQUINA dentro da pasta mrp-dashboard
# Requisito: Node.js instalado (https://nodejs.org)
# ─────────────────────────────────────────────────────────────────

set -e

PROJECT_REF="gvhkjfsngxrnjavstsju"

echo "=== PASSO 1: Login no Supabase (abre o navegador) ==="
npx supabase login

echo "=== PASSO 2: Linkando projeto ==="
npx supabase link --project-ref "$PROJECT_REF"

echo "=== PASSO 3: Deploy das Edge Functions ==="
npx supabase functions deploy fred-proxy
npx supabase functions deploy macro-actual-fetcher
npx supabase functions deploy macro-alert-worker
npx supabase functions deploy telegram-ping
npx supabase functions deploy send-telegram-digest

echo "=== PASSO 4: Configurando secrets ==="
echo "Cole sua FRED API Key quando solicitado:"
read -p "FRED_API_KEY: " FRED_KEY
npx supabase secrets set FRED_API_KEY="$FRED_KEY"

echo "Deploy concluido!"
