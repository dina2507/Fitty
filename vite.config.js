import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    hmr: false,
    watch: {
      usePolling: false
    }
  },
  define: {
    __VITE_SKIP_HMR__: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          'pdf-export': ['jspdf', 'jspdf-autotable'],
          'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
        },
      },
    },
  },
})
