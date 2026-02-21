import { defineConfig, type PluginOption } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

/** Wraps content script in an IIFE so re-injection in the same tab doesn't cause "Identifier has already been declared". */
function contentScriptIIFE() {
  return {
    name: 'content-script-iife',
    apply: 'build',
    generateBundle(_, bundle) {
      const content = bundle['content.js'];
      if (content && content.type === 'chunk') {
        content.code = `(function(){${content.code}})();`;
      }
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false, // avoid conflict: we use public/ as outDir for the extension
  plugins: [contentScriptIIFE()] as PluginOption[],
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
