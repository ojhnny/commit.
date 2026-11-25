import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src'), obsidian: resolve(import.meta.dirname, 'harness/vault-mock.ts') } },
  test: { include: ['src/**/*.test.ts'] },
})
