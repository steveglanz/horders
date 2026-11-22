// Screenshots the Kiln's arena layouts (V2 sim, V5 art): pillars (basalt stumps that block), the lava channel and the
// kiln vents, one of them flaring. Each scene restarts on a seed whose first fight rolls that layout.
// Usage: npm run build && node tools/layoutshots.cjs <outDir> [phone|p360] [foundry]
// With `foundry`, it shoots the Drowned Foundry's pillars and vents (V8): wet slate stones and steaming vents.
// With `glarewell`, it shoots the Glarewell's vents: cracked skylight lenses that flare with light.
// With `coldmarrow`, it shoots the Coldmarrow's pillars: stones of frosted ice.
// With `hammerdeep`, it shoots the Hammerdeep's pillars and vents (W2): iron-bound granite and forge hearths.
// With `pressworks`, it shoots the Pressworks' pillars and vents (W2): oiled steel bolsters and press exhausts.
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const phone = process.argv.includes('phone') || p360;
const foundry = process.argv.includes('foundry');
const glarewell = process.argv.includes('glarewell');
const coldmarrow = process.argv.includes('coldmarrow');
const hammerdeep = process.argv.includes('hammerdeep');
const pressworks = process.argv.includes('pressworks');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { cls: 'bulwark', dungeon: 'kiln', route: ['warpack'], tier: 2, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
if (foundry) Object.assign(OPTS, { dungeon: 'foundry', route: ['glass'], tier: 5 });
if (glarewell) Object.assign(OPTS, { dungeon: 'glarewell', route: ['shades'], tier: 8 });
if (coldmarrow) Object.assign(OPTS, { dungeon: 'coldmarrow', route: ['rimepack'], tier: 11 });
if (hammerdeep) Object.assign(OPTS, { dungeon: 'hammerdeep', route: ['warpack'], tier: 4 });
if (pressworks) Object.assign(OPTS, { dungeon: 'pressworks', route: ['warpack'], tier: 10 });
const SCENES = pressworks ? [
  { name: 'pressworks-1-pillars', seed: 2, until: 'pillars' },
  { name: 'pressworks-3-vents', seed: 3, until: 'vents' },
] : hammerdeep ? [
  { name: 'hammerdeep-1-pillars', seed: 2, until: 'pillars' },
  { name: 'hammerdeep-3-vents', seed: 3, until: 'vents' },
] : coldmarrow ? [
  { name: 'coldmarrow-1-pillars', seed: 2, until: 'pillars' },
] : glarewell ? [
  { name: 'glarewell-3-vents', seed: 2, until: 'vents' },
] : foundry ? [
  { name: 'foundry-1-pillars', seed: 2, until: 'pillars' },
  { name: 'foundry-3-vents', seed: 3, until: 'vents' },
] : [
  { name: '1-pillars', seed: 3, until: 'pillars' },
  { name: '2-channel', seed: 6, until: 'channel' },
  { name: '3-vents', seed: 2, until: 'vents' },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = p360 ? 'p360' : phone ? 'phone' : 'desk';
  const ctx = await b.newContext(p360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => { document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click(); });
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="delve"]')?.click());
  await page.waitForTimeout(300);
  const card = null;
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, { ...OPTS, seed: sc.seed });
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.phase === 'fight', null, { timeout: 30000, polling: 30 });
    // The predicate freezes the scene itself the moment it holds (a frame can run 0.25 s x warp of sim).
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      let ok = w.layout === sc.until && w.time > 4;
      if (sc.until === 'vents') ok = ok && w.telegraphs.some((t) => t.alive && t.r === 75 && t.t > 0.5);
      return ok && !(s.warp = 0);
    }, sc, { timeout: 100000, polling: 'raf' }).catch(async () => errs.push('timeout ' + sc.name + ' ' + await page.evaluate(() => window.__ember.scene().world.layout)));
    // Between hits, and with the fight banner out of the way, so the shot shows him and the floor marks.
    await page.evaluate(() => { window.__ember.scene().world.enemies.forEach((e) => { e.flash = -1; }); const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-kiln-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
