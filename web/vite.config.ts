import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forward API calls to the FloodIQ backend so the browser never needs Databricks credentials.
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 2100,
    rollupOptions: {
      output: {
        manualChunks: { mapbox: ['mapbox-gl'], charts: ['recharts'] },
      },
    },
  },
})
