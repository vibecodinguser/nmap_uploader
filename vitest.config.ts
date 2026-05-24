import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Vitest загружает конфиг при запуске; статического import нет
// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
  },
})
