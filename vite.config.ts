import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

export default defineConfig({
  base: './',
  publicDir: false, // avoid conflict: we use public/ as outDir for the extension
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src') },
  },
  build: {
    outDir: process.env.VITE_OUT_DIR || 'public',
    emptyOutDir: process.env.VITE_OUT_DIR === 'dist',
    rollupOptions: {
      input: {
        background: path.resolve('src/background/background.ts'),
        content: path.resolve('src/content/index.ts'),
        popup: path.resolve('popup.html'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'popup' ? 'assets/[name].js' : '[name].js'),
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    sourcemap: process.env.VITE_OUT_DIR !== 'dist',
    target: 'esnext',
  },
});
