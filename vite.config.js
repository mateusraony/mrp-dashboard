import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Recharts isolado — evita contaminar o bundle principal (378KB)
          'recharts': ['recharts'],
          // Supabase isolado — 208KB próprio chunk
          'supabase': ['@supabase/supabase-js'],
          // TanStack Query separado
          'tanstack-query': ['@tanstack/react-query'],
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
