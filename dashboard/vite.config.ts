import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: false, // Don't delete og-image.png, dashboard.html
    rollupOptions: {
      input: 'app.html',
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
      '/parties': {
        target: 'ws://localhost:8787',
        ws: true,
      },
      '/agents': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
});
