import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || '/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        '/vendor/plantuml/plantuml.js'
      ]
    }
  }
});
