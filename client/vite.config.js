import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // '/' normally; '/claude/' when hosted as a GitHub Pages project site (set by the Pages workflow).
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': env.VITE_API_PROXY || 'http://localhost:4000',
      },
    },
  };
});
