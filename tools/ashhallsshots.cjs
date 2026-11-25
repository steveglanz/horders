// The Ashvents on phones (H4b, design 25 Nov), a group map: a Bulwark with two bot allies (Slagbinder, Lumen) at
// 320x568 or 568x320 in the 3D look.
//   halls   (?hallsbeta=1): the party in a fight in a sealed room, the hero outside a sealed room (the green "Walk in"
//           tag), and the map (maponly stops after it).
//   ysmeret (straight to the boss, `v2` for ?ysmeretv2=1): Scatter Embers' rings; with v2 the two flame rings, a lone
//           flame's build-up, the flare, and the shared boss bar ("Two flames · one health").
// Usage: npm run build && node tools/ashhallsshots.cjs <outDir> [p320|l568] [halls|ysmeret] [v2|maponly] [seed]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const seed = Number(process.argv.slice(3).find((a) => /^\d+$/.test(a)) || 3);
const mode = process.argv.includes('ysmeret') ? 'ysmeret' : 'halls';
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${seed}&god=1&halls=1&hallsbeta=1&hd2d=1${v2 ? '&ysmeretv2=1' : ''}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); const hud = s.hud; window.__banners = []; const orig = hud.banner.bind(hud); hud.banner = (t, sub, ...a) => { window.__banners.push(`${Math.round(window.__ember.scene().world.time * 10) / 10} ${t} | ${sub}`); return orig(t, sub, ...a); }; });
  await page.evaluate(({ seed, mode, v2 }) => {
    const s = window.__ember.scene(); s.warp = 1;
    const party = [{ cls: 'slagbinder', name: 'Slagbinder (bot)' }, { cls: 'lumen', name: 'Lumen (bot)' }];
    const opts = { cls: 'bulwark', dungeon: 'ashvents', tier: 7, invulnerable: true, seed, party, partySize: 3, fillBots: 2 };
    if (mode === 'halls') Object.assign(opts, { halls: true, hallsBeta: true }); else Object.assign(opts, { route: ['ysmeret'], ysmeretV2: v2 });
    s.scene.restart({ opts, hud: s.hud, onEnd: () => {} });
  }, { seed, mode, v2 });
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
  const info = () => page.evaluate(() => {
    const s = window.__ember.scene(), w = s.world, v = s.hd2d;
    const at = (x, y) => { const q = v?.project?.(x, y); return q ? [Math.round(q.x), Math.round(q.y)] : null; };
    return {
      t: Math.round(w.time * 10) / 10, phase: w.phase, heroes: w.heroes.map((h, k) => { const p = w.heroData(k).player; return `${h.cls} ${p.hp > 0 ? 'up' : 'down'} ${JSON.stringify(at(p.x, p.y))}${(p.sunderT ?? 0) > 0 ? ' SUNDERED' : ''}`; }),
      sealed: w.halls ? w.halls.rooms.map((r, i) => (r.lock ?? -1) >= 1 && !r.lifted ? i : -1).filter((i) => i >= 0) : null,
      stage: w.ysStage ?? 0, away: [Math.round((w.ysAway0 ?? 0) * 10) / 10, Math.round((w.ysAway1 ?? 0) * 10) / 10], bossBar: document.querySelector('#target')?.innerText?.replace(/\s+/g, ' ') ?? '',
    };
  });
  const report = {};
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${size}-${mode}${v2 ? 'v2' : ''}-${name}.png`) }); report[name] = await info(); };
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
  } else if (mode === 'ysmeret') {
    await page.evaluate(() => { window.__flares = 0; const s = window.__ember.scene(); const orig = s.handleEvents.bind(s); s.handleEvents = (evs) => { for (const e of evs) if (e.type === 'ysFlare') { window.__flares++; s.warp = 0; } return orig(evs); }; });
    // 1: Scatter Embers (a ring round every hero; overlapping rings turn red).
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; const e = w.enemies[w.bossIndex]; if (e?.alive && e.castId === 'scatter' && e.castT > e.castDur * 0.4) { s.warp = 0; return true; } return false; }, null, { timeout: 1200000, polling: 30 }).catch(() => errs.push('no scatter'));
    await page.waitForTimeout(1200);
    await shot('1-scatter');
    if (v2) {
      // 2: stage 2 (its warning line held on screen: SwiftShader's slow frames outlast its 3.2 s), two flames, each covered or not.
      await page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies[w.bossIndex]; if (e && e.hp > e.maxHp * 0.51) e.hp = e.maxHp * 0.51; window.__ember.scene().warp = 1; });
      await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.ysStage === 2 && w.time > 0) { s.warp = 0; s.hud.bannerTimer = performance.now() + 60000; return true; } return false; }, null, { timeout: 1500000, polling: 30 }).catch(() => errs.push('no stage 2'));
      await page.waitForTimeout(1200);
      await shot('2-two-flames');
      // 3: a lone flame building to its flare: walk every hero to the other flame.
      await page.evaluate(() => { const s = window.__ember.scene(); const w = s.world; s.autopilot = false; s.warp = 1; window.__pin = setInterval(() => { const f = w.enemies[w.ysF1]; if (!f) return; for (let k = 0; k < w.heroes.length; k++) { const p = w.heroData(k).player; p.x = p.px = f.x + 30 * k; p.y = p.py = f.y + 20; } }, 20); });
      await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.ysAway0 >= 2) { s.warp = 0; return true; } return false; }, null, { timeout: 1500000, polling: 30 }).catch(() => errs.push('no build-up'));
      await page.waitForTimeout(1200);
      await shot('3-lone-flame');
      await page.evaluate(() => { window.__ember.scene().warp = 1; });
      await page.waitForFunction(() => window.__flares > 0, null, { timeout: 1500000, polling: 30 }).catch(() => errs.push('no flare'));
      await page.waitForTimeout(400);
      await shot('4-flare');
      await page.evaluate(() => clearInterval(window.__pin));
    }
  }
  report.banners = await page.evaluate(() => window.__banners);
  console.log(JSON.stringify(report, null, 1));
  console.log(size, mode, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
