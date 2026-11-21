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

/**
 * L2: Phaser's source checks build flags with `if (typeof WEBGL_RENDERER)`,
 * which its own webpack build replaces whole (webpack/config.js DefinePlugin).
 * Do the same here, for Phaser's files only: both renderers on; sound off, since
 * all game sound is synthesized in client/audio and never uses Phaser's; the
 * optional plugins and the WebGL debug layer off.
 */
const PHASER_FLAGS: Record<string, string> = {
  WEBGL_RENDERER: 'true',
  CANVAS_RENDERER: 'true',
  FEATURE_SOUND: 'false',
  PLUGIN_CAMERA3D: 'false',
  PLUGIN_FBINSTANT: 'false',
  WEBGL_DEBUG: 'false',
};
function phaserFlags(): Plugin {
  const re = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
  return {
    name: 'horders-phaser-flags',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/node_modules/phaser/src/')) return null;
      return code.search(re) >= 0 ? { code: code.replace(re, (_m, k: string) => PHASER_FLAGS[k]), map: null } : null;
    },
  };
}

// Single-file build so the prototype can be shared as one private web page.
export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2020' },
  // L2: the trimmed Phaser (client/vendor/phaser-lite.js). Tests and types still use the full package.
  resolve: { alias: [{ find: /^phaser$/, replacement: new URL('./client/vendor/phaser-lite.js', import.meta.url).pathname }] },
  plugins: [phaserFlags(), viteSingleFile(), scriptLast()],
  test: { root: '.', include: ['tests/**/*.test.ts'] },
} as any);
