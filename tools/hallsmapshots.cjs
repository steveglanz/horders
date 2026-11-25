// Phase 18 Halls H2c on phones: the opened map for several generated maps (room outlines, corridor ends, a sealed room
// of each shape), at 320x568 or 568x320. The map is DOM over the game, so the 2D look is used (faster); `3d` for the 3D.
// Every room is marked seen and one room with a pack in it is sealed by hand (world frozen), so each shot shows the whole map.
// Usage: npm run build && node tools/hallsmapshots.cjs <outDir> [p320|l568] [3d]   (SEEDS=1,2,3; SEAL=twin seals a room of that shape)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const look = process.argv.includes('3d') ? '3d' : '2d';
const SEEDS = (process.env.SEEDS || '1,2,3,4,5,6').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const dist = process.env.DIST || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const VIEW = { p320: { width: 320, height: 568 }, l568: { width: 568, height: 320 } };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1&halls=1&hd2d=${look === '3d' ? 1 : 0}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  const report = [];
  for (const seed of SEEDS) {
    await page.evaluate((seed) => { const s = window.__ember.scene(); s.warp = 1; s.scene.restart({ opts: { cls: 'bulwark', dungeon: 'kiln', tier: 2, invulnerable: true, halls: true, seed }, hud: s.hud, onEnd: () => {} }); }, seed);
    await page.waitForFunction((seed) => { const w = window.__ember.scene()?.world; return w?.halls && w.tick > 2 && w.seed === seed; }, seed, { timeout: 120000 }).catch(() => page.waitForTimeout(1500));
    await page.waitForTimeout(look === '3d' ? 2000 : 500);
    const info = await page.evaluate((want) => {
      const s = window.__ember.scene(); s.warp = 0; const w = s.world, m = w.halls;
      const el = document.getElementById('banner'); if (el) el.style.visibility = 'hidden';
      m.seen.fill(true);
      // Seal the first room with a pack that isn't round (else the first with a pack).
      const withPack = m.packs.map((p) => m.rooms.findIndex((r, i) => i === p.room));
      const pick = (want && withPack.find((i) => m.rooms[i].shape === want)) ?? withPack.find((i) => m.rooms[i].shape && m.rooms[i].shape !== 'round') ?? withPack[0];
      m.rooms.forEach((r, i) => { r.lock = i === pick ? 2 : -1; });
      const b = document.getElementById('hallsMapBtn'); if (b && !b.hidden) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return { shapes: m.rooms.map((r) => r.shape || 'circle').join(','), sealed: pick, sealedShape: m.rooms[pick].shape || 'circle' };
    }, process.env.SEAL || '');
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => { const r = document.getElementById('hallsMap').getBoundingClientRect(); const bar = document.getElementById('actionbar').getBoundingClientRect(); return { map: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], barTop: Math.round(bar.top) }; });
    await page.screenshot({ path: path.join(out, `${look}-${size}-map-seed${seed}.png`) });
    report.push({ seed, ...info, ...box });
    await page.evaluate(() => { const b = document.getElementById('hallsMapBtn'); if (b && !b.hidden) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  }
  console.log(JSON.stringify(report));
  console.log(look, size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
