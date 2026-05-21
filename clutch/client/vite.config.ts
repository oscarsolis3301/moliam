import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  // Default base is the atlas mount point. Standalone builds (see apps/run.mjs)
  // override this with VITE_BASE=/ so the app can be served at the host root.
  base: process.env.VITE_BASE ?? '/clutch-app/',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, '../server/public'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
