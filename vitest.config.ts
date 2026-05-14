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
      // Thresholds calibrados ao estado atual (Phase 4 — 117 testes).
      // Incrementar conforme novos testes forem adicionados.
      thresholds: {
        lines:      10,
        functions:  10,
        branches:    6,
        statements:  9,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
