import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The browser talks only to this dev server; requests to /api/302/* are proxied
// to https://api.302.ai/* so there are no CORS issues and no hardcoded hosts.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/302': {
        target: 'https://api.302.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/302/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
