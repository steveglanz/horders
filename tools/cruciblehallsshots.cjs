// The Crucible raid on the Halls map on phones (H5a, design 25 Nov): a Bulwark with three bot allies (Lumen,
// Emberwright, Duskblade), four heroes, at 320x568 or 568x320 in the 3D look: as tools/hammerhallsshots.cjs's halls
// mode, plus a vent flaring under its circle (2b) and, in portrait, an elite set where 3D draws it under the party
// frames, which fade (2c). Pass `hoard` for the Hoard raid's map (H5b) instead.
//   halls  (?hallsbeta=1): the party in a corridor and in a fight, the hero stood outside a sealed room (grates let
//          heroes in, never out: a green "Walk in" tag on the grate), and the map.
// Usage: npm run build && node tools/cruciblehallsshots.cjs <outDir> [p320|l568] [hoard] [maponly] [seed]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const seed = Number(process.argv.slice(3).find((a) => /^\d+$/.test(a)) || 3);
const mode = process.argv.includes('ondrel') ? 'ondrel' : 'halls';
const raid = process.argv.includes('hoard') ? { id: 'hoard', tier: 9 } : { id: 'crucible', tier: 8 };
const v2 = process.argv.includes('v2');
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${seed}&god=1&halls=1&hallsbeta=1&hd2d=1${v2 ? '&ondrelv2=1' : ''}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); const hud = s.hud; window.__banners = []; const orig = hud.banner.bind(hud); hud.banner = (t, sub, ...a) => { window.__banners.push(`${Math.round(window.__ember.scene().world.time * 10) / 10} ${t} | ${sub}`); return orig(t, sub, ...a); }; });
  await page.evaluate(({ seed, mode, v2, raid }) => {
    const s = window.__ember.scene(); s.warp = 1;
    const party = [{ cls: 'lumen', name: 'Lumen (bot)' }, { cls: 'emberwright', name: 'Emberwright (bot)' }, { cls: 'duskblade', name: 'Duskblade (bot)' }];
    const opts = { cls: 'bulwark', dungeon: raid.id, tier: raid.tier, invulnerable: true, seed, party, partySize: 4, fillBots: 3 };
    if (mode === 'halls') Object.assign(opts, { halls: true, hallsBeta: true }); else Object.assign(opts, { route: ['ondrel'], ondrelV2: v2 });
    s.scene.restart({ opts, hud: s.hud, onEnd: () => {} });
  }, { seed, mode, v2, raid });
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
  const info = () => page.evaluate(() => {
    const s = window.__ember.scene(), w = s.world, v = s.hd2d;
    const at = (x, y) => { const q = v?.project?.(x, y); return q ? [Math.round(q.x), Math.round(q.y)] : null; };
    return {
      t: Math.round(w.time * 10) / 10, phase: w.phase, heroes: w.heroes.map((h, k) => { const p = w.heroData(k).player; return `${h.cls} ${p.hp > 0 ? 'up' : 'down'} ${JSON.stringify(at(p.x, p.y))}${(p.sunderT ?? 0) > 0 ? ' SUNDERED' : ''}`; }),
      sealed: w.halls ? w.halls.rooms.map((r, i) => (r.lock ?? -1) >= 1 && !r.lifted ? i : -1).filter((i) => i >= 0) : null,
      slag: w.slagPatches?.length ?? 0, stage: w.ondrelStage ?? 0,
    };
  });
  const report = {};
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${size}-${raid.id}-${name}.png`) }); report[name] = await info(); };
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 1; });
  if (mode === 'halls') {
    await page.waitForTimeout(2500);
    await shot('1-start');
    // 1b: the map (phones show it behind the Map button, never in a fight).
    const tapMap = () => page.evaluate(() => { const b = document.getElementById('hallsMapBtn'); if (b && !b.hidden) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b && !b.hidden; });
    report.mapBtn = await tapMap();
    await page.waitForTimeout(900);
    await shot('1b-map');
    await tapMap();
    report.mapBox = await page.evaluate(() => { const r = (id) => { const b = document.getElementById(id)?.getBoundingClientRect(); return b ? [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] : null; }; return { party: r('party') }; });
  }
  if (mode === 'halls' && !process.argv.includes('maponly')) {
    // 2: the first pack awake and its room sealed, the party inside.
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.phase === 'fight' && w.halls.rooms.some((r) => (r.lock ?? -1) >= 1.2 && !r.lifted)) { s.warp = 0; return true; } return false; }, null, { timeout: 600000, polling: 30 }).catch(() => errs.push('no sealed fight'));
    await page.waitForTimeout(1200);
    await shot('2-fight-sealed');
    // 2b: a vent flaring under its circle in the sealed room (the rings in the rooms), with four heroes about.
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.events.some((e) => e.type === 'ventFlare') || w.telegraphs.some((t) => t.alive && t.owner === -1 && t.t > t.dur * 0.4)) { s.warp = 0; return true; } return false; }, null, { timeout: 900000, polling: 30 }).catch(() => errs.push('no vent flare'));
    await page.waitForTimeout(1200);
    await shot('2b-vent-flare');
    report['2b-vent-flare'].partyFaded = await page.evaluate(() => document.getElementById('party').classList.contains('under'));
    // 2c (portrait): an elite set down where the 3D view draws it under the party frames, which then fade.
    if (size === 'p320') {
      report.under = await page.evaluate(() => {
        const s = window.__ember.scene(), w = s.world, v = s.hd2d;
        const e = w.enemies.find((q) => q.alive && q.def.rank !== 'normal'); if (!e || !v) return 'no elite';
        const pr = document.getElementById('party').getBoundingClientRect(), c = s.game.canvas.getBoundingClientRect();
        const gx = (pr.left + pr.right) / 2 - c.left, gy = (pr.top + pr.bottom) / 2 - c.top;
        let best = null, bd = Infinity;
        for (let dx = -900; dx <= 900; dx += 15) for (let dy = -900; dy <= 900; dy += 15) {
          const q = v.project(w.player.x + dx, w.player.y + dy); if (!q) continue;
          const d = Math.hypot(q.x - gx, q.y - gy); if (d < bd) { bd = d; best = [w.player.x + dx, w.player.y + dy]; }
        }
        e.x = e.px = best[0]; e.y = e.py = best[1]; e.speed0 = e.def.speed; window.__underFoe = w.enemies.indexOf(e);
        return { foe: e.def.name, miss: Math.round(bd) };
      });
      await page.evaluate(() => { const s = window.__ember.scene(), w = s.world, e = w.enemies[window.__underFoe]; s.warp = 0.05; window.__pin = setInterval(() => { if (e && window.__pinAt) { e.x = e.px = window.__pinAt[0]; e.y = e.py = window.__pinAt[1]; } }, 16); window.__pinAt = [e.x, e.y]; });
      await page.waitForTimeout(1500);
      await page.evaluate(() => { window.__ember.scene().warp = 0; });
      await page.waitForTimeout(600);
      await shot('2c-elite-under-frames');
      report['2c-elite-under-frames'].partyFaded = await page.evaluate(() => document.getElementById('party').classList.contains('under'));
      await page.evaluate(() => { clearInterval(window.__pin); window.__pinAt = null; });
    }
    // 3: the hero set down in the corridor just outside the sealed room's doorway (allies stay inside).
    await page.evaluate(() => {
      const s = window.__ember.scene(); const w = s.world; const m = w.halls;
      const ri = m.rooms.findIndex((r) => (r.lock ?? -1) >= 1 && !r.lifted); const rm = m.rooms[ri];
      const c = m.corridors.find((q) => q.a === ri || q.b === ri);
      const e = { x1: c.ax ?? m.rooms[c.a].x, y1: c.ay ?? m.rooms[c.a].y, x2: c.bx ?? m.rooms[c.b].x, y2: c.by ?? m.rooms[c.b].y };
      const [sx, sy, tx, ty] = c.a === ri ? [e.x1, e.y1, e.x2, e.y2] : [e.x2, e.y2, e.x1, e.y1];
      let k = 0; while (k < 1 && Math.hypot(sx + (tx - sx) * k - rm.x, sy + (ty - sy) * k - rm.y) < rm.r + 70) k += 0.01;
      w.player.x = w.player.px = sx + (tx - sx) * k; w.player.y = w.player.py = sy + (ty - sy) * k;
      window.__outside = { room: ri, r: rm.r, at: [Math.round(w.player.x), Math.round(w.player.y)] };
      s.autopilot = false; s.warp = 0.3;
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__ember.scene().warp = 0; });
    await page.waitForTimeout(800);
    await shot('3-outside-sealed');
    report['3-outside-sealed'].hud = await page.evaluate(() => ({ outside: window.__outside, arrow: document.getElementById('hallsArrow')?.className || '', tag: document.getElementById('hallsSealTag')?.hidden === false ? document.getElementById('hallsSealTag').textContent : '', mapBtn: !document.getElementById('hallsMapBtn')?.hidden }));
  } else if (mode === 'ondrel') {
    // 1: a tank Sundered by Anvilfall (the tank swap).
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.heroes.some((h, k) => (w.heroData(k).player.sunderT ?? 0) > 0)) { s.warp = 0; return true; } return false; }, null, { timeout: 900000, polling: 30 }).catch(() => errs.push('no sunder'));
    await page.waitForTimeout(1200);
    await shot('1-sundered');
    if (v2) {
      // Hurry him to stage 2 (60%), then wait for two Anvilfalls' slag.
      await page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies[w.bossIndex]; if (e && e.hp > e.maxHp * 0.59) e.hp = e.maxHp * 0.59; window.__ember.scene().warp = 1; });
      await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.slagPatches.length >= 2 && w.ondrelStage >= 2) { s.warp = 0; return true; } return false; }, null, { timeout: 1500000, polling: 30 }).catch(() => errs.push('no slag'));
      await page.waitForTimeout(1200);
      await shot('2-slag');
      // Stage 3: hurry him there, then wait for the bursts' glow.
      await page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies[w.bossIndex]; if (e && e.hp > e.maxHp * 0.3) e.hp = e.maxHp * 0.3; window.__ember.scene().warp = 1; });
      await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.ondrelStage >= 3 && w.slagPatches.some((a) => a.glow > 0)) { s.warp = 0; return true; } return false; }, null, { timeout: 1500000, polling: 30 }).catch(() => errs.push('no burst glow'));
      await page.waitForTimeout(1200);
      await shot('3-burst-warn');
    }
  }
  report.banners = await page.evaluate(() => window.__banners);
  console.log(JSON.stringify(report, null, 1));
  console.log(size, mode, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
