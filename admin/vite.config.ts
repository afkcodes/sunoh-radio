import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served by the Fastify API at /admin in production; Vite dev server proxies
// /admin/api to the local API (npm run dev on :4000) so cookies are same-origin.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/admin/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
