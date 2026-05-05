import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api/v1': {
        // Match `localhost` in the browser URL bar so cookies + SameSite behavior stay consistent.
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
