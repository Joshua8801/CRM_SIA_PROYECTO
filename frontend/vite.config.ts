import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const episApi = process.env.EPIS_API;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: episApi
      ? {
        '/api': {
          target: episApi,
          changeOrigin: true,
        },
      }
      : undefined,
  },
});

