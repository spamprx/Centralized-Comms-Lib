import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Avoid CORS + make HttpOnly cookies work in dev by proxying API calls
      '/api/v1': {
        target: 'http://168.144.22.124:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
