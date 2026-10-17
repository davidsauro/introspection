import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    // pdfmake (~1 MB) is its own chunk, only loaded when a PDF is created.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
