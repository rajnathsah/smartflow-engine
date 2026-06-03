import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://api:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    tsconfigPaths: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('zustand')) {
              return 'vendor'
            }
            if (id.includes('lucide-react') || id.includes('framer-motion') || id.includes('sonner')) {
              return 'ui'
            }
            if (id.includes('three') || id.includes('@react-three')) {
              return '3d'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query'
            }
            return 'vendor'
          }
        }
      }
    }
  }
})

