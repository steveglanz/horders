import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build so the prototype can be shared as one private web page.
export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2020' },
  plugins: [viteSingleFile()],
  test: { root: '.', include: ['tests/**/*.test.ts'] },
} as any);
