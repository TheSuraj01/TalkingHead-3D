import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      // Resolve root-level module imports to public/ where they actually live
      './modules/': path.resolve(__dirname, 'public/modules/'),
      './siteconfig.js': path.resolve(__dirname, 'siteconfig.js'),
      'three/addons/': path.resolve(__dirname, 'node_modules/three/examples/jsm/'),
      'three/examples/': path.resolve(__dirname, 'node_modules/three/examples/')
    }
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/openai': { target: 'http://localhost:3000', changeOrigin: true },
      '/gtts': { target: 'http://localhost:3000', changeOrigin: true },
      '/gemini': { target: 'http://localhost:3000', changeOrigin: true },
      '/app': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // Exclude large local .mjs modules from bundling — they're served as-is from public/
      external: [
        /^\/modules\//,
        /^\.\/modules\//
      ]
    }
  },
  // Ensure public/ assets are available at build time
  publicDir: 'public'
});
