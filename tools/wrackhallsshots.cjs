// The Wrackline on the Halls map on phones (H3d, design 25 Nov): rafts in a quay room, the Ebb's warning line, the Ebb
// pulling toward the room's drain, and a foe shoved off an afloat raft as the Ebb starts (#725), at 320x568 or 568x320 in
// the 3D look, with ?hallsbeta=1. The hero is taken off autopilot once the first pack wakes and stays on the floor, so
// the pull shows on it. For the shove, a foe is set down on a raft during the warning; shots before and after.
// Usage: npm run build && node tools/wrackhallsshots.cjs <outDir> [p320|l568] [seed]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
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
  await page.evaluate((seed) => { const s = window.__ember.scene(); s.warp = 1; s.scene.restart({ opts: { cls: 'emberwright', dungeon: 'wrackline', tier: 13, invulnerable: true, halls: true, hallsBeta: true, seed }, hud: s.hud, onEnd: () => {} }); }, seed);
  await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 120000 });
  // Every banner the HUD is asked to show, with the run time (the HUD survives a restart, so wrap it once).
  await page.evaluate(() => { const s = window.__ember.scene(); const hud = s.hud; window.__banners = []; const orig = hud.banner.bind(hud); hud.banner = (t, sub, ...a) => { window.__banners.push(`${Math.round(window.__ember.scene().world.time * 10) / 10} ${t} | ${sub}`); return orig(t, sub, ...a); }; });
  const info = () => page.evaluate(() => {
    const box = (id) => { const el = document.getElementById(id); if (!el) return null; const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.05) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const w = window.__ember.scene().world;
    
    const pr = window.__ember.scene().hd2d?.project?.(w.player.x, w.player.y);
    return {
      t: Math.round(w.time * 10) / 10, phase: w.phase, inBoss: w.bossUp,
      banner: document.getElementById('banner')?.classList.contains('show') ? document.getElementById('bannerTitle').textContent + ' | ' + document.getElementById('bannerSub').textContent : '',
      bannerBox: box('banner'), castBox: box('tCast'), castText: document.getElementById('tCast')?.hidden ? '' : document.getElementById('tCastName').textContent,
      rafts: w.rafts.map((r) => { const q = window.__ember.scene().hd2d?.project?.(r.x, r.y); return `${q ? Math.round(q.x) + ',' + Math.round(q.y) : '-'}${r.sunkT > 0 ? ' sunk' : ''}`; }), ebbT: Math.round(w.ebbT * 10) / 10, ebbWarnT: Math.round((w.ebbWarnT ?? 0) * 10) / 10, onRaft: w.onRaft(w.player.x, w.player.y), drain: (() => { const q = window.__ember.scene().hd2d?.project?.(w.wrackX, w.wrackY); return q ? [Math.round(q.x), Math.round(q.y)] : null; })(),
      foes: w.enemies.map((e, i) => ({ e, i })).filter((o) => o.e.alive).map(({ e, i }) => { const v = window.__ember.scene().hd2d; const q = v?.project?.(e.x, e.y), h = v?.foeHead?.(i); return `${e.kind} floor ${q ? Math.round(q.x) + ',' + Math.round(q.y) : '-'} head ${h ? Math.round(h.x) + ',' + Math.round(h.y) : '-'}`; }), hero: pr ? [Math.round(pr.x), Math.round(pr.y)] : null,
    };
  });
  const report = {};
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${size}-${name}.png`) }); report[name] = await info(); };
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 1; });
  // 1: the first quay room's pack wakes; the hero comes off autopilot.
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.phase === 'fight' && w.rafts.length && w.wrackRoom >= 0) { s.autopilot = false; s.warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 30 }).catch(() => errs.push('no quay fight'));
  await page.waitForTimeout(1500);
  await shot('1-rafts');
  // 2: the Ebb's warning line.
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const b = document.getElementById('banner'); if (b.classList.contains('show') && /Ebb/.test(document.getElementById('bannerTitle').textContent)) { s.warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 16 }).catch(() => errs.push('no ebb warning'));
  await page.waitForTimeout(450);
  await shot('2-ebb-warn');
  // 3: the last frame of the warning, with a walking foe (not a Lurker or the Conchblower, which keep off rafts anyway)
  // set down on an afloat raft, as one can stand there until the Ebb starts.
  const shoved = () => page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__shoved]; return e ? { kind: e.kind, onRaft: w.onRaft(e.x, e.y), at: (() => { const q = window.__ember.scene().hd2d?.project?.(e.x, e.y); return q ? [Math.round(q.x), Math.round(q.y)] : null; })() } : null; });
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); if (s.world.ebbWarnT > 0 && s.world.ebbWarnT < 0.1) { s.warp = 0; return true; } return false; }, null, { timeout: 600000, polling: 16 }).catch(() => errs.push('no warn end'));
  await page.evaluate(() => { const w = window.__ember.scene().world; const r = w.rafts.find((q) => !(q.sunkT > 0)); const e = w.enemies.find((o) => o.alive && o.def.rank !== 'boss' && !o.def.stationary && o.kind !== 'shoalLurker' && o.kind !== 'conchblower'); window.__shoved = e ? w.enemies.indexOf(e) : -1; if (r && e) { const a = Math.atan2(r.y - w.wrackY, r.x - w.wrackX); e.x = e.px = r.x + Math.cos(a) * 30; e.y = e.py = r.y + Math.sin(a) * 30; } });
  await page.waitForTimeout(600);
  await shot('3-shove-before'); report['3-shove-before'].shoved = await shoved();
  // 4: the first frames of the Ebb, when the shove lands.
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); if (s.world.ebbT > 0) { s.warp = 0; return true; } return false; }, null, { timeout: 120000, polling: 16 }).catch(() => errs.push('no ebb start'));
  await page.waitForTimeout(400);
  await shot('4-shove-after'); report['4-shove-after'].shoved = await shoved(); report['4-shove-after'].splashes = await page.evaluate(() => window.__ember.scene().shoves.length);
  // 5: the Ebb pulling, a second in.
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); if (s.world.ebbT > 0 && s.world.ebbT < 3) { s.warp = 0; return true; } return false; }, null, { timeout: 600000, polling: 16 }).catch(() => errs.push('no pull'));
  await page.waitForTimeout(600);
  await shot('5-ebb-pull');
  report.banners = await page.evaluate(() => window.__banners);
  console.log(JSON.stringify(report, null, 1));
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
