import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      'three/addons/': path.resolve(__dirname, 'node_modules/three/examples/jsm/'),
      'three/examples/': path.resolve(__dirname, 'node_modules/three/examples/')
    }
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/openai': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/gtts': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/app': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000
  }
});
