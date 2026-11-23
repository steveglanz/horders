// Phase 15 Y6 art: the wave marks and the dungeon stirring, in 2D. Forces each by overriding the World's own
// pickers on the live run (waveShapeAt, stirChoices), clears fights on autopilot, and shoots each mark as it shows.
// Moments: ring (closing ring), pincer (chevrons from both flanks), reinforce (the gate's warning, then the burst),
// stir (the beat as the fight starts, then the extra elite's mark).
// Usage: npm run build && node tools/waveartshots.cjs <outDir> [p360|land|desk]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p360', 'land', 'desk'].find((s) => process.argv.includes(s)) || 'p360';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const VIEW = { p360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, land: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1280, height: 720 } } };
const CASES = [
  { name: 'ring', shape: 'ring', fx: 'ring', at: [450] },
  { name: 'pincer', shape: 'pincer', fx: 'pincer', at: [500] },
  { name: 'reinforce', shape: 'reinforce', fx: 'gate', at: [900], then: 'burst', dungeon: 'coldmarrow' },
  { name: 'stir', stir: 'elite', at: [350], near: true },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(VIEW[size]);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 8); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 30000 });
  for (const c of CASES) {
    await page.evaluate((c) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 21, cls: 'emberwright', dungeon: c.dungeon || 'kiln', tier: 6, invulnerable: true }, hud: s.hud, onEnd: () => {} });
    }, c);
    await page.waitForTimeout(600);
    await page.evaluate((c) => {
      const s = window.__ember.scene(); const w = s.world;
      if (c.shape) w.waveShapeAt = (k) => (k === 0 ? 'arc' : c.shape);
      if (c.stir) { w.stirChoices = () => [c.stir]; w.stirNext = true; const keep = w.stirNext; Object.defineProperty(w, 'stirNext', { get: () => w.encounter === 0 ? true : keep, set: () => {}, configurable: true }); }
      s.autopilot = true; s.autoPick = true; s.warp = 4;
    }, c);
    // Waits for the mark, then lets real time run (the sim frozen) so the mark is mid-animation.
    await page.waitForFunction((c) => {
      const s = window.__ember.scene();
      const ok = c.fx ? s.waveFx.some((f) => f.kind === c.fx) : !!s.stirElite;
      if (ok) s.warp = 0;
      return ok;
    }, c, { timeout: 120000, polling: 'raf' }).catch(() => errs.push('timeout ' + c.name));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    let last = 0;
    for (const [n, ms] of c.at.entries()) {
      await page.waitForTimeout(ms - last); last = ms;
      await page.screenshot({ path: path.join(out, `${size}-${c.name}${c.at.length > 1 ? '-' + n : ''}.png`) });
    }
    if (c.near) {
      // The extra elite comes from the far side: let it walk in, then shoot its mark.
      await page.evaluate(() => { window.__ember.scene().warp = 1; window.__ember.scene().autopilot = false; });
      await page.waitForFunction(() => { const s = window.__ember.scene(); const se = s.stirElite; if (!se) return false; const e = s.world.enemies[se.i]; const ok = Math.hypot(e.x - s.world.player.x, e.y - s.world.player.y) < 190; if (ok) s.warp = 0; return ok; }, null, { timeout: 30000, polling: 'raf' }).catch(() => errs.push('timeout elite near'));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(out, `${size}-${c.name}-elite.png`) });
    }
    if (c.then) {
      await page.evaluate(() => { window.__ember.scene().warp = 1; });
      await page.waitForFunction((k) => { const s = window.__ember.scene(); const ok = s.waveFx.some((f) => f.kind === k); if (ok) s.warp = 0; return ok; }, c.then, { timeout: 20000, polling: 'raf' }).catch(() => errs.push('timeout ' + c.then));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(out, `${size}-${c.name}-${c.then}.png`) });
    }
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
  }
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
