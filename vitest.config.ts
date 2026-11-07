import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname),
    },
  },
  test: {
    // Инжектируемые стили импортируются как `?inline`; без обработки CSS
    // Vitest подменяет их пустой строкой, и тесты стилей теряют смысл.
    // Паттерн не привязан к концу id: у `?inline`-импортов есть query.
    css: { include: [/\.css(\?|$)/] },
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 15_000,
  },
})
