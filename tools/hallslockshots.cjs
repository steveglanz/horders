// Phase 18 Halls H2b on phones: how a sealing and a sealed room read on the corner map, and the co-op "shut out" arrow,
// at 320x568 or 568x320 in the 3D look (`2d` for the fallback). The world is frozen (warp 0) and the room's lock time is
// set by hand, so the shots don't depend on a fight.
// Usage: npm run build && node tools/hallslockshots.cjs <outDir> [p320|l568] [2d]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const look = process.argv.includes('2d') ? '2d' : '3d';
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
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1&halls=1&hd2d=${look === '3d' ? 1 : 0}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; s.scene.restart({ opts: { cls: 'bulwark', dungeon: 'kiln', tier: 2, invulnerable: true, halls: true, seed: 2 }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 120000 });
  await page.waitForTimeout(look === '3d' ? 2500 : 800);
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 0; const el = document.getElementById('banner'); if (el) el.style.visibility = 'hidden'; });
  const m = await page.evaluate(() => JSON.parse(JSON.stringify(window.__ember.scene().world.halls)));
  const big = m.packs.find((p) => p.role === 'B').room;
  const put = (x, y) => page.evaluate(([x, y]) => { const p = window.__ember.scene().world.player; p.x = p.px = x; p.y = p.py = y; }, [x, y]);
  const lock = (room, t) => page.evaluate(([room, t]) => { const w = window.__ember.scene().world; w.halls.rooms.forEach((r, i) => { r.lock = i === room ? t : -1; }); for (const i of w.halls.seen.keys()) if (i <= room) w.halls.seen[i] = true; }, [room, t]);
  const mapBtn = () => page.evaluate(() => { const b = document.getElementById('hallsMapBtn'); if (b && !b.hidden) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  const rect = (id) => page.evaluate((id) => { const el = document.getElementById(id); if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }, id);
  const report = {};
  const shot = async (name) => { await page.waitForTimeout(look === '3d' ? 700 : 300); await page.screenshot({ path: path.join(out, `${look}-${size}-lock-${name}.png`) }); report[name] = { map: await rect('hallsMap'), mapBtn: await rect('hallsMapBtn'), arrow: await rect('hallsArrow'), tag: await rect('hallsSealTag'), bar: await rect('actionbar'), target: await rect('target') }; };
  const r = m.rooms[big];
  // 1. Inside the big room as it starts to seal (0.5 s of the 1 s warning), map opened.
  await put(r.x, r.y + r.r * 0.4);
  await lock(big, 0.5);
  await mapBtn();
  await shot('1-warn-map');
  // 2. Sealed (grates down).
  await lock(big, 2);
  await shot('2-sealed-map');
  await mapBtn();
  await shot('3-sealed-play');
  // 4. Co-op shut out: the room sealed with you outside, back in the entrance.
  const back = m.rooms[0];
  await put(back.x, back.y);
  await shot('4-shut-out');
  await mapBtn();
  await shot('5-shut-out-map');
  console.log(JSON.stringify(report, null, 1));
  console.log(look, size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
