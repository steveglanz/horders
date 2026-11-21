// Screenshots the Hearthkeeper Warmth display: the HUD chip with its five embers and the glow under the hero.
// Rime pack in the Coldmarrow (many kills); the hero is given the set pieces after the scene starts.
// Usage: npm run build && node tools/warmthshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);

const SCENES = [
  // Two pieces, three Warmth: embers lit, no cut yet.
  { name: '1-two-pieces', pieces: 2, warmth: 3 },
  // Three pieces at full Warmth: the chip glows and the ring of embers circles the hero.
  { name: '2-full', pieces: 3, warmth: 5 },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate(() => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 5, cls: 'emberwright', dungeon: 'coldmarrow', route: ['rimepack'], tier: 10, invulnerable: true }, hud: s.hud, onEnd: () => {} });
    });
    await page.waitForTimeout(700);
    await page.evaluate((n) => { const s = window.__ember.scene(); s.world.loadout.sets = { hearthkeeper: n }; s.autopilot = true; s.autoPick = true; s.warp = 2; }, sc.pieces);
    // The Rime Pack is only five hounds, too few to fill Warmth before the fight ends, so the tool sets the stacks
    // once the hounds close in (the sim decays them as usual) and keeps the set count against loot swaps.
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player;
      w.loadout.sets = { hearthkeeper: sc.pieces };
      const close = w.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 260).length;
      const ok = w.phase === 'fight' && w.time > 2 && close >= 3;
      if (ok) { p.warmth = sc.warmth; p.warmT = 0; s.warp = 0; }
      return ok;
    }, sc, { timeout: 120000, polling: 20 }).catch(() => errs.push('timeout ' + sc.name));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-warmth-${sc.name}.png`) });
    const chip = await page.$('#buffs .warmth');
    if (chip) {
      // A close crop of the hero frame: health bar and the chip under it.
      const bb = await page.evaluate(() => { const r = document.querySelector('#buffs .warmth').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await page.screenshot({ path: path.join(out, `${tag}-warmth-${sc.name}-chip.png`), clip: { x: 0, y: 0, width: Math.max(320, bb.x + bb.width + 16), height: bb.y + bb.height + 10 } });
    }
    else errs.push('no chip ' + sc.name);
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
