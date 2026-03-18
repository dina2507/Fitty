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
  }
})
