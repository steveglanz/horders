// The Glarewell on the Halls map on phones (H3b, design 25 Nov): pillars, light and shadow, and the Glare warning, at
// 320x568 or 568x320 in the 3D look, with ?hallsbeta=1. Autopilot (invulnerable) until a Lensbearer's Glare starts in a
// room, shoots the warning, then the flash as it lands, then a Glare with the hero in a pillar's shadow. (The Lensmother fights in the
// usual arena after the boss door, so her Glare isn't shot here.) For each shot it lists the
// banner, the cast bar text and the boxes of the HUD parts the warning sits near, so clipping can be checked.
// Usage: npm run build && node tools/glarehallsshots.cjs <outDir> [p320|l568] [seed] [round|ring|cross|hall|twin]
// A shape moves the hero into the first room of that shape whose pack has a Lensbearer (seed 6 cross, 9 ring, 4 hall);
// the shrine room (always room 2, its own warm theme) only when no other room fits.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const shape = ['round', 'ring', 'cross', 'hall', 'twin'].find((s) => process.argv.includes(s));
const seed = Number(process.argv.slice(3).find((a) => /^\d+$/.test(a)) || 8);
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${seed}&god=1&halls=1&hallsbeta=1&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate((seed) => { const s = window.__ember.scene(); s.warp = 1; s.scene.restart({ opts: { cls: 'emberwright', dungeon: 'glarewell', tier: 6, invulnerable: true, halls: true, hallsBeta: true, seed }, hud: s.hud, onEnd: () => {} }); }, seed);
  await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 120000 });
  // Every banner the HUD is asked to show, with the run time (the HUD survives a restart, so wrap it once).
  await page.evaluate(() => { const s = window.__ember.scene(); const hud = s.hud; window.__banners = []; const orig = hud.banner.bind(hud); hud.banner = (t, sub, ...a) => { window.__banners.push(`${Math.round(window.__ember.scene().world.time * 10) / 10} ${t} | ${sub}`); return orig(t, sub, ...a); }; });
  const info = () => page.evaluate(() => {
    const box = (id) => { const el = document.getElementById(id); if (!el) return null; const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.05) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const w = window.__ember.scene().world;
    const caster = w.enemies.find((e) => e.alive && e.castId === 'glare');
    const pr = window.__ember.scene().hd2d?.project?.(w.player.x, w.player.y);
    return {
      t: Math.round(w.time * 10) / 10, phase: w.phase, inBoss: w.bossUp,
      banner: document.getElementById('banner')?.classList.contains('show') ? document.getElementById('bannerTitle').textContent + ' | ' + document.getElementById('bannerSub').textContent : '',
      bannerBox: box('banner'), castBox: box('tCast'), castText: document.getElementById('tCast')?.hidden ? '' : document.getElementById('tCastName').textContent,
      caster: caster ? caster.kind : null, pillars: w.pillars.length, fixed: w.pillars.filter((c) => c.fixed).length, shadowed: w.shadowed?.(w.player.x, w.player.y), hero: pr ? [Math.round(pr.x), Math.round(pr.y)] : null,
      flash: window.__ember.scene().glareFlash,
    };
  });
  const report = {};
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${size}${shape ? '-' + shape : ''}-${name}.png`) }); report[name] = await info(); };
  if (shape) {
    const moved = await page.evaluate((shape) => {
      const w = window.__ember.scene().world; const m = w.halls;
      const fits = (p) => p.state === 'asleep' && m.rooms[p.room].shape === shape && p.foes.some((f) => f.kind === 'lensbearer');
      const pk = m.packs.find((p) => fits(p) && m.rooms[p.room].theme !== 'shrine') ?? m.packs.find(fits);
      if (!pk) return null;
      const rm = m.rooms[pk.room]; const f = pk.foes[0];
      // Stand between the room's middle and its first foe, so the pack wakes at once.
      w.player.x = w.player.px = (rm.x + f.x) / 2; w.player.y = w.player.py = (rm.y + f.y) / 2;
      return pk.room;
    }, shape);
    if (moved === null) errs.push(`no ${shape} room with a Lensbearer on seed ${seed}`);
  }
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
  // Autopilot interrupts every Lensbearer's Glare (Quench), so wait for a woken pack with a Lensbearer, take the hero
  // off autopilot, and zero its ability timer so runGlareElite starts a Glare on the next tick (a cast started between
  // ticks would lose its castStart event, and with it the banner).
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.phase === 'fight' && w.pillars.length && w.enemies.some((e) => e.alive && e.kind === 'lensbearer')) { s.warp = 0; return true; } return false; }, null, { timeout: 400000, polling: 30 }).catch(() => errs.push('no lensbearer pack'));
  await page.evaluate(() => { const s = window.__ember.scene(); const w = s.world; s.autopilot = false; const i = w.enemies.findIndex((e) => e.alive && e.kind === 'lensbearer'); if (i >= 0) { w.enemies[i].abilityT = 0; w.enemies[i].castId = ''; } s.warp = 1; });
  // 1: as the 'Glare!' banner comes up (it lasts 3.2 s of real time, so a slow software-GL frame rate would miss it).
  await page.waitForFunction(() => { const s = window.__ember.scene(); const e = s.world.enemies.find((o) => o.alive && o.castId === 'glare'); const b = document.getElementById('banner'); if (e && b.classList.contains('show') && document.getElementById('bannerTitle').textContent === 'Glare!') { s.warp = 0; return true; } return false; }, null, { timeout: 60000, polling: 16 }).catch(() => errs.push('no glare warn'));
  await page.waitForTimeout(450);
  await shot('1-room-glare-warn');
  // 2: the moment it lands.
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); if (s.glareFlash > 0) { s.warp = 0; return true; } return false; }, null, { timeout: 60000, polling: 16 }).catch(() => errs.push('no flash'));
  await page.waitForTimeout(150);
  await shot('2-room-glare-lands');
  // 3: the same Glare with the hero moved into a pillar's shadow (to see the safe wedge round the hero).
  await page.evaluate(() => { const s = window.__ember.scene(); const w = s.world; const c = w.pillars.find((q) => !q.cracked); if (c) { const dx = c.x - w.lightX, dy = c.y - w.lightY, d = Math.hypot(dx, dy) || 1; w.player.x = c.x + (dx / d) * (c.r + 60); w.player.y = c.y + (dy / d) * (c.r + 60); } const i = w.enemies.findIndex((e) => e.alive && e.kind === 'lensbearer'); if (i >= 0) { w.enemies[i].abilityT = 0; w.enemies[i].castId = ''; } s.warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const e = s.world.enemies.find((o) => o.alive && o.castId === 'glare'); const b = document.getElementById('banner'); if (e && b.classList.contains('show') && document.getElementById('bannerTitle').textContent === 'Glare!') { s.warp = 0; return true; } return false; }, null, { timeout: 60000, polling: 16 }).catch(() => errs.push('no glare warn 2'));
  await page.waitForTimeout(450);
  await shot('3-in-shadow-warn');
  report.banners = await page.evaluate(() => window.__banners);
  console.log(JSON.stringify(report, null, 1));
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
