import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/betfair': {
        target: 'http://localhost:3002',
        changeOrigin: true
        // No rewrite rule here
      },
      '/api/health': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/health/, '/health')
      },
      '/api/hedge': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  }
});