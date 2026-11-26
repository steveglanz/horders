// Draw calls near walls and rims, not only at room centres (1.0 M4, cost bar 96 at 320x568).
// For each dungeon: a Halls run (4 heroes in group dungeons and raids, the worst case), the camera stands at every
// room's centre, 8 points just inside its outer wall and each corridor's middle; then the party goes through the boss
// door and the camera stands at the arena centre and 8 points just inside its rim with the boss up.
// Usage: npm run build && node docs/art/rim-draws/sweep.cjs <dist> <outDir> [dungeon,dungeon...]
// Env: WAIT=ms per point (default 900), ARENA_ONLY=1 skips the map, SHOTS=1 saves a shot of each dungeon's worst arena point.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const ALL = 'kiln,foundry,glarewell,coldmarrow,wrackline,hammerdeep,ashvents,pressworks,crucible,hoard,smeltery,flue';
const LIST = (process.argv[4] || ALL).split(',');
const GROUP = new Set(['hammerdeep', 'ashvents', 'pressworks', 'crucible', 'hoard', 'smeltery', 'flue']);
const WAIT = +(process.env.WAIT || 900);
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html'); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(path.resolve(f))); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: +(process.env.DSF || 1), isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full', look: '3d' })));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=8&god=1&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0 && window.__ember.scene().hd2d, null, { timeout: 120000 });
  const calls = () => page.evaluate(() => window.__ember.scene().hd2d?.stats()?.calls ?? null);
  // Stand the hero at (x, y), the other heroes round it (as in docs/art/raid-halls), clear foes on the map.
  const stand = (x, y, kill) => page.evaluate(([x, y, kill]) => { const s = window.__ember.scene(), w = s.world; s.autopilot = false; s.warp = 0;
    const p = w.heroData(0).player; p.x = p.px = x; p.y = p.py = y;
    for (let k = 1; k < w.heroes.length; k++) { const q = w.heroData(k).player; const a = k * 2.1; q.x = q.px = x + Math.cos(a) * 70; q.y = q.py = y + Math.sin(a) * 50; }
    if (kill) for (const e of w.enemies) e.alive = false; }, [x, y, kill]);
  const summary = [];
  for (const dungeon of LIST) {
    const group = GROUP.has(dungeon);
    await page.evaluate(([dungeon, group]) => { const s = window.__ember.scene(); s.warp = 1;
      const opts = { seed: 8, cls: 'emberwright', dungeon, tier: 6, invulnerable: true, halls: true };
      if (group) Object.assign(opts, { party: [{ cls: 'bulwark' }, { cls: 'lumen' }, { cls: 'duskblade' }], partySize: 4, fillBots: 3 });
      s.scene.restart({ opts, hud: s.hud, onEnd: () => {} }); }, [dungeon, group]);
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
    const pts = await page.evaluate(() => { const w = window.__ember.scene().world, m = w.halls; if (!m) return null; const o = [];
      m.rooms.forEach((r, i) => { o.push([`r${i}-centre`, r.x, r.y]);
        const loop = r.edge?.[0];
        for (let k = 0; k < 8; k++) { let x, y;
          if (loop) { const n = loop.length / 2, j = Math.floor(k * n / 8); x = loop[2 * j]; y = loop[2 * j + 1]; }
          else { const a = k / 8 * 2 * Math.PI; x = r.x + Math.cos(a) * r.r; y = r.y + Math.sin(a) * r.r; }
          const dx = r.x - x, dy = r.y - y, d = Math.hypot(dx, dy) || 1; o.push([`r${i}-rim${k}`, x + dx / d * 60, y + dy / d * 60]); } });
      m.corridors.forEach((c, i) => { const A = m.rooms[c.a], B = m.rooms[c.b]; const ax = c.ax ?? A.x, ay = c.ay ?? A.y, bx = c.bx ?? B.x, by = c.by ?? B.y; o.push([`c${i}-mid`, (ax + bx) / 2, (ay + by) / 2]); });
      o.push(['door', m.door.x, m.door.y + 120]); return o; });
    const rows = [];
    if (!pts) console.log(dungeon, 'no Halls map');
    else if (!process.env.ARENA_ONLY) for (const [name, x, y] of pts) { await stand(x, y, true); await page.waitForTimeout(WAIT); rows.push([name, await calls()]); }
    // Through the boss door: the arena, boss up.
    await page.evaluate(() => { const s = window.__ember.scene(), w = s.world, m = w.halls; s.warp = 1; if (m) { for (const pk of m.packs) pk.state = 'cleared'; const p = w.heroData(0).player; p.x = p.px = m.door.x; p.y = p.py = m.door.y; } });
    try { await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.bossSpawned; }, null, { timeout: 240000 }); } catch { console.log(dungeon, 'boss fight did not start; phase', await page.evaluate(() => window.__ember.scene().world.phase)); }
    const R = await page.evaluate(() => window.__ember.scene().world.arenaR);
    const arena = [['arena-centre', 0, 0], ['arena-south', 0, R * 0.8]];
    for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * Math.PI; arena.push([`arena-rim${k}`, Math.cos(a) * (R - 60), Math.sin(a) * (R - 60)]); }
    for (const [name, x, y] of arena) { await stand(x, y, false); await page.waitForTimeout(WAIT); rows.push([name, await calls()]); }
    const worst = rows.reduce((a, r) => (r[1] > a[1] ? r : a), ['', -1]);
    const centres = rows.filter((r) => /centre/.test(r[0])).map((r) => r[1]);
    const over = rows.filter((r) => r[1] > 96);
    console.log(`${dungeon} (${group ? 4 : 1} heroes): max ${worst[1]} at ${worst[0]}; centres max ${Math.max(...centres)}; over 96: ${over.map((r) => r.join('=')).join(', ') || 'none'}`);
    fs.writeFileSync(path.join(out, `${dungeon}.json`), JSON.stringify(rows));
    summary.push({ dungeon, heroes: group ? 4 : 1, max: worst[1], at: worst[0], centreMax: Math.max(...centres), over: over.length });
    if (process.env.SHOTS) { const aw = rows.filter((r) => r[0].startsWith('arena')).reduce((a, r) => (r[1] > a[1] ? r : a), ['', -1]); const p = arena.find((q) => q[0] === aw[0]);
      await stand(p[1], p[2], false); await page.waitForTimeout(WAIT); await page.screenshot({ path: path.join(out, `${process.env.TAG || ''}${dungeon}-${aw[0]}.jpg`), quality: 82 }); }
  }
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(errs.slice(0, 5).join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
