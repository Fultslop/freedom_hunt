import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";
import yaml from '@modyfi/vite-plugin-yaml'

const plugins = [react(), yaml()]
if (!process.env.VITEST) {
  plugins.push(cloudflare())
}

export default defineConfig({
  plugins,
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
