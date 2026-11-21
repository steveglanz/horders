import { defineConfig, Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * viteSingleFile inlines the 2 MB game script into <head>, so the browser has to
 * download all of it before it can parse and paint the title screen in <body>.
 * A module script runs after parsing either way, so moving it to the end of
 * <body> changes nothing at run time and lets the page paint after its first
 * ~40 KB (tools/partyperf.cjs measures this).
 */
function scriptLast(): Plugin {
  return {
    name: 'horders-script-last',
    enforce: 'post',
    generateBundle(_o, bundle) {
      for (const f of Object.values(bundle)) {
        if (f.type !== 'asset' || !f.fileName.endsWith('.html')) continue;
        const html = String(f.source);
        const start = html.indexOf('<script type="module"');
        const end = html.indexOf('</script>', start);
        const close = html.lastIndexOf('</body>');
        if (start < 0 || end < 0 || close < end) continue;
        const tag = html.slice(start, end + '</script>'.length);
        f.source = html.slice(0, start) + html.slice(end + '</script>'.length, close) + tag + '\n' + html.slice(close);
      }
    },
  };
}

// Single-file build so the prototype can be shared as one private web page.
export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2020' },
  plugins: [viteSingleFile(), scriptLast()],
  test: { root: '.', include: ['tests/**/*.test.ts'] },
} as any);
