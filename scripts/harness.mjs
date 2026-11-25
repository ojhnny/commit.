import esbuild from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'harness-out')
mkdirSync(out, { recursive: true })
await esbuild.build({
  entryPoints: [resolve(root, 'harness/entry.ts')], bundle: true, format: 'esm', outfile: resolve(out, 'harness.js'),
  alias: { '@': resolve(root, 'src'), obsidian: resolve(root, 'harness/obsidian-mock.ts') },
  define: { 'process.env.NODE_ENV': '"development"' }, jsx: 'automatic', logLevel: 'warning',
})
for (const f of ['index.html', 'obsidian-like.css']) cpSync(resolve(root, 'harness', f), resolve(out, f))
cpSync(resolve(root, 'dist/commit-habits/styles.css'), resolve(out, 'styles.css'))
console.log('harness built')
