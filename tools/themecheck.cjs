const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
// Records each theme's music bus (no sound effects) for 14 s, to measure it as a phone speaker plays it.
// Usage: npm run build && node tools/themecheck.cjs <outDir> hub kiln:1 ...  (id[:intensity])
// then: THEMES_DIR=<outDir> npx vite-node tools/mixcheck.ts
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const ids = process.argv.slice(3);
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=3');
  await page.tap('.logo'); await page.waitForTimeout(300);
  for (const spec of ids) {
    const [id, inten] = spec.split(':');
    const b64 = await page.evaluate(async ({ id, inten }) => {
      const a = window.__ember.audio;
      a.theme(null); await new Promise((r) => setTimeout(r, 2500));
      a.theme(id); a.intensity(Number(inten || 0));
      await new Promise((r) => setTimeout(r, 1500));
      const dest = a.ctx.createMediaStreamDestination();
      a.musicDuck.connect(dest);
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
      const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start(); await new Promise((r) => setTimeout(r, 14000)); rec.stop(); await done;
      a.musicDuck.disconnect(dest);
      const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, { id, inten });
    fs.writeFileSync(path.join(out, `${id}-${inten || 0}.webm`), Buffer.from(b64, 'base64'));
  }
  console.log('errors', errors);
  await browser.close();
})();
