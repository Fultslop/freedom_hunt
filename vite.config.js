import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";
import yaml from '@modyfi/vite-plugin-yaml'

export default defineConfig({
  plugins: [react(), cloudflare(), yaml()],
  server: {
    historyApiFallback: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    passWithNoTests: true,
  },
})
