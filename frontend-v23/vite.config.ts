import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Publica en https://etnara-care.github.io/ETNARAMVP/
// (repositorio de proyecto bajo la organización ETNARA-Care, no un sitio
// de usuario/org) -> requiere base path no-raíz, configurado aquí en
// código -- nunca como parche dinámico en el workflow de GitHub Actions.
export default defineConfig({
  base: '/ETNARAMVP/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
