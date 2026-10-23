import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Phase 12.5: each build stamps the service worker so phones drop the old copy.
function stampServiceWorker() {
  let outDir = 'dist'
  return {
    name: 'etnara-stamp-sw',
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      if (!existsSync(file)) return
      const build = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
      writeFileSync(file, readFileSync(file, 'utf8').replace('__ETNARA_BUILD__', build))
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), stampServiceWorker()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
