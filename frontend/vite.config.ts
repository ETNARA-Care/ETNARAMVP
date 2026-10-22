import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ETNARAMVP/',
  plugins: [react()],
  preview: {
    allowedHosts: ['etnara-smartmatch-demo-web-staging.up.railway.app'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
