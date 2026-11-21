// Screenshots the P2 season glows under the hero, one Kiln fight per glow, frozen a few seconds in.
// Usage: npm run build && node tools/glowshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const GLOWS = (process.env.GLOWS || 'tideSilver,hollowViolet,undertowTeal,bellowsOrange,kilnRed,whiteHeat').split(',');
const CLS = ['emberwright', 'bulwark', 'duskblade', 'lumen'];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (let k = 0; k < GLOWS.length; k++) {
    const glow = GLOWS[k];
    await page.evaluate(({ glow, cls }) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 3, cls, dungeon: 'kiln', tier: 3, invulnerable: true }, hud: s.hud, glow, onEnd: () => {} });
    }, { glow, cls: CLS[k % CLS.length] });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    await page.waitForFunction(() => {
      const s = window.__ember.scene(); const w = s.world;
      const ok = w.phase === 'fight' && w.time > 6; // after the encounter banner fades
      if (ok) s.warp = 0;
      return ok;
    }, null, { timeout: 60000, polling: 20 }).catch(() => errs.push('timeout ' + glow));
    await page.waitForTimeout(300);
    const hasGlow = await page.evaluate(() => !!window.__ember.scene().heroGlow);
    if (!hasGlow) errs.push('no glow ' + glow);
    await page.screenshot({ path: path.join(out, `${tag}-glow-${k + 1}-${glow}.png`) });
    // A close crop around the hero.
    const vp = page.viewportSize();
    const w = Math.round(vp.width * (phone ? 0.6 : 0.3)); const h = Math.round(w * 0.75);
    await page.screenshot({ path: path.join(out, `${tag}-glow-${k + 1}-${glow}-hero.png`), clip: { x: (vp.width - w) / 2, y: vp.height / 2 - h * 0.45, width: w, height: h } });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
