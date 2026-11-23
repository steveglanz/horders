import { defineConfig } from 'vite';

/**
 * HD-2D look test: builds client/hd2d/renderer.ts and three.js into one file, dist/hd2d.js, next to the
 * single-file dist/index.html. Runs after the main build (which empties dist/), so it must not empty it.
 * The game imports ./hd2d.js only when you press Delve with ?hd2d=1 (client/hd2d/api.ts), so the first
 * page load is unchanged. A deploy has to upload this file along with index.html.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    // three.js alone is about 560 KB minified; this file is fetched only for the HD-2D test.
    chunkSizeWarningLimit: 700,
    // Not lib mode: Vite's lib build leaves the whitespace in an ES file (970 KB against about 520 KB minified).
    rollupOptions: {
      input: 'client/hd2d/renderer.ts',
      preserveEntrySignatures: 'strict',
      output: { format: 'es', entryFileNames: 'hd2d.js', inlineDynamicImports: true },
    },
  },
});
