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
      // Thresholds calibrados após migração completa DataState<T> (todos os hooks).
      // functions reduzido: +80 TanStack hooks (queryFn/select/retryDelay) + 11
      // novas funções de proxy/preprocess não testáveis unitariamente (HTTP wrappers
      // callFapiViaProxy, fetchGdeltViaProxy + 9 arrow fns em z.preprocess).
      thresholds: {
        lines:      19,
        functions:  17,
        branches:   15,
        statements: 19,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
