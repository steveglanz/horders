// Look test clips (vision v2 Checkpoint 2, visuals queue item 3).
// Renders the scripted 15-second Kiln fight frame by frame (so slow software GL still gives a smooth clip),
// then joins the frames into an mp4 with ffmpeg.
// Usage: node docs/art/look-test/clips.cjs <outDir> [diorama|pixel|both] [fps]
//   env STILLS=1 writes only 4 stills per version (t = 2, 4.3, 7.2, 10.35) for a quick look.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path'); const os = require('os');
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(process.argv[2] || 'looktest-out');
const which = process.argv[3] || 'both';
const fps = +(process.argv[4] || 30);
const SEC = 15;
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'looktest-'));

function bundle(name) {
  const js = path.join(tmp, `${name}.js`);
  execFileSync(path.join(root, 'node_modules/.bin/esbuild'), [path.join(root, `client/looktest/${name}.ts`), '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning']);
  const html = path.join(tmp, `${name}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#0e0b0a;overflow:hidden}canvas{display:block}</style><body><script src="${name}.js"></script>`);
  return html;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const name of which === 'both' ? ['diorama', 'pixel'] : [which]) {
    const html = bundle(name);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('file://' + html);
    await page.waitForFunction(() => window.lookTest && window.lookTest.ready, null, { timeout: 60000 });
    if (name === 'diorama') console.log(name, 'hero', JSON.stringify(await page.evaluate(() => window.lookTest.measure('hero', 1.0))), 'foe', JSON.stringify(await page.evaluate(() => window.lookTest.measure('foe', 5.0))), 'draw calls', await page.evaluate(() => { window.lookTest.render(6.0); return window.lookTest.calls(); }));
    if (process.env.STILLS) {
      for (const t of (process.env.T || '2,4.3,7.2,10.35,13.8').split(',').map(Number)) {
        await page.evaluate((t) => window.lookTest.render(t), t);
        await page.screenshot({ path: path.join(out, `${name}-t${String(t).replace('.', '_')}.png`) });
      }
    } else {
      const fdir = path.join(tmp, name); fs.mkdirSync(fdir, { recursive: true });
      const n = Math.round(SEC * fps);
      for (let i = 0; i < n; i++) {
        await page.evaluate((t) => window.lookTest.render(t), i / fps);
        await page.screenshot({ path: path.join(fdir, `f${String(i).padStart(4, '0')}.png`) });
      }
      const mp4 = path.join(out, `${name}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(fdir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
      console.log('wrote', mp4);
    }
    console.log(name, errs.length ? errs.join('\n') : 'no errors');
    await ctx.close();
  }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
