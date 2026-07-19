import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  publicDir: false,
  plugins: [vue()],
  build: {
    outDir: path.resolve(rootDir, '../public'),
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(rootDir, 'src/main.js'),
      output: {
        entryFileNames: 'assets/vue-app.js',
        chunkFileNames: 'assets/vue-[name].js',
        assetFileNames: (assetInfo) => assetInfo.name && assetInfo.name.endsWith('.css')
          ? 'assets/vue-app.css'
          : 'assets/[name][extname]',
      },
    },
  },
});
