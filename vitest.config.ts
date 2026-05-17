import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Força DATA_MODE=mock em todos os testes (sem chamadas reais à API)
    env: {
      VITE_DATA_MODE: 'mock',
    },
    // Exclui worktrees temporários dos agentes para evitar testes duplicados
    exclude: ['.claude/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/services/**',
        'src/utils/**',
        'src/hooks/**',
        'src/lib/apiClient.ts',
      ],
      exclude: [
        'src/components/data/**',
        'src/**/__mocks__/**',
      ],
      // Thresholds calibrados ao estado atual (285 testes — Fase 4 completa).
      thresholds: {
        lines:      20,
        functions:  20,
        branches:   15,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
