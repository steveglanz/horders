// Phase 18 Halls H1: screenshots of the Kiln map in the 2D look (or 3D with `3d`): the start room, a sleeping pack's red
// ring, the big room with B and C asleep, a corridor (the edge arrow and the camera lead), the corner map (opened on a
// phone), and the arena after the boss door. The hero is placed by hand for each shot (invulnerable), so the shots
// don't depend on how a fight goes.
// Usage: npm run build && node tools/hallsshots.cjs <outDir> [phone|p360] [3d]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const phone = process.argv.includes('phone') || p360;
const three = process.argv.includes('3d');
fs.mkdirSync(out, { recursive: true });
const files = { '/': 'dist/index.html', '/hd2d.js': 'dist/hd2d.js' };
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const k = p === '/hd2d.js' ? p : '/';
  r.writeHead(200, { 'content-type': k === '/' ? 'text/html' : 'text/javascript' });
  r.end(fs.readFileSync(path.resolve(files[k])));
}).listen(0);
const OPTS = { cls: 'emberwright', dungeon: 'kiln', tier: 2, invulnerable: true, heroName: 'Emberwright 9', halls: true, seed: 2 };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = `${p360 ? 'p360' : phone ? 'phone' : 'desk'}-${three ? '3d' : '2d'}`;
  const ctx = await b.newContext(p360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1&halls=1&hd2d=${three ? 1 : 0}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
  await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 60000 });
  const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: path.join(out, `${tag}-halls-${name}.png`) }); };
  // Teleport the hero (and keep the sim from waking anything else by standing still).
  const put = (x, y) => page.evaluate(([x, y]) => { const p = window.__ember.scene().world.player; p.x = p.px = x; p.y = p.py = y; }, [x, y]);
  const banner = (on) => page.evaluate((on) => { const el = document.getElementById('banner'); if (el) el.style.visibility = on ? '' : 'hidden'; }, on);
  await page.waitForTimeout(500);
  await shot('1-start');
  await banner(false);
  const m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__ember.scene().world.halls)));
  const pk = (r) => m.packs.find((p) => p.role === r);
  // 2. Walking up to A: its red ring shows (inside 400, outside 200).
  await put(pk('A').x, pk('A').y + 300);
  await shot('2-ring');
  // 3. The corridor from R1 to R3: the camera leads ahead, the arrow points on (A asleep behind, B ahead).
  await put(0, (m.rooms[1].y + m.rooms[3].y) / 2);
  await page.evaluate(() => { const p = window.__ember.scene().world.player; p.px = p.x; p.py = p.y + 3; });
  await shot('3-corridor');
  // 4. R3, the big room: zoomed out to fit, B and C asleep (C off the path).
  await put(-20, m.rooms[3].y);
  await page.evaluate(() => { const w = window.__ember.scene().world; for (const p of w.halls.packs) p.state = p.state === 'awake' ? 'asleep' : p.state; });
  await shot('4-bigroom');
  // 5. The corner map (on a phone: tapped open).
  if (phone) await page.evaluate(() => document.getElementById('hallsMapBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await shot('5-map');
  if (phone) await page.evaluate(() => document.getElementById('hallsMapBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  // 6. Through the door: clear the guard by hand, walk in, the arena takes over.
  await page.evaluate(() => { const w = window.__ember.scene().world; for (const p of w.halls.packs) if (p.guard) p.state = 'cleared'; for (const e of w.enemies) if (e.alive) { e.alive = false; w.aliveEnemies--; } w.phase = 'cleared'; });
  await put(m.door.x, m.door.y);
  await page.waitForFunction(() => window.__ember.scene().world.bossSpawned, null, { timeout: three ? 60000 : 20000 }).catch(() => errs.push('no boss after the door'));
  await shot('6-arena');
  const state = await page.evaluate(() => { const w = window.__ember.scene().world; return { done: w.halls.done, boss: w.bossSpawned, map: !document.getElementById('hallsMap') || document.getElementById('hallsMap').hidden }; });
  console.log(tag, JSON.stringify(state), errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
