/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  // The hash-routed static build uses a relative base so it works under any sub-path.
  // The normal build needs an absolute base: with './', reloading a deep link such as
  // /habits/:id/notes asks for /habits/:id/assets/… and gets a blank page.
  base: process.env.VITE_ROUTER === 'hash' ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
