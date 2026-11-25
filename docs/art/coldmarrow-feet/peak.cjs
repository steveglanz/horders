// The Coldmarrow on the Halls map on phones (H3c, design 25 Nov): the coal light round the hero on the darker floors,
// and the Dimhorn's Dark Call, at 320x568 or 568x320 in the 3D look, with ?hallsbeta=1. Shoots the start, a corridor,
// the Dimhorn's cold ring filling out in the dark, the call itself, and the Rimehounds coming in (the hero is taken off
// autopilot once the Dimhorn's pack wakes, so nobody brings the light over it). Seed 4's first pack has a Dimhorn. For each shot it lists the
// banner, the cast bar text and the boxes of the HUD parts the warning sits near, so clipping can be checked.
// Usage: npm run build && node tools/coldhallsshots.cjs <outDir> [p320|l568] [seed]

const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const seed = Number(process.argv.slice(3).find((a) => /^\d+$/.test(a)) || 4);
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
  await page.evaluate((seed) => { const s = window.__ember.scene(); s.warp = 1; s.scene.restart({ opts: { cls: 'emberwright', dungeon: 'coldmarrow', tier: 8, invulnerable: true, halls: true, hallsBeta: true, seed }, hud: s.hud, onEnd: () => {} }); }, seed);
  await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 120000 });
  // Every banner the HUD is asked to show, with the run time (the HUD survives a restart, so wrap it once).
  await page.evaluate(() => { const s = window.__ember.scene(); const hud = s.hud; window.__banners = []; const orig = hud.banner.bind(hud); hud.banner = (t, sub, ...a) => { window.__banners.push(`${Math.round(window.__ember.scene().world.time * 10) / 10} ${t} | ${sub}`); return orig(t, sub, ...a); }; });
  const info = () => page.evaluate(() => {
    const box = (id) => { const el = document.getElementById(id); if (!el) return null; const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.05) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const w = window.__ember.scene().world;
    const dim = w.enemies.find((e) => e.alive && e.kind === 'dimhorn');
    const pr = window.__ember.scene().hd2d?.project?.(w.player.x, w.player.y);
    return {
      t: Math.round(w.time * 10) / 10, phase: w.phase, inBoss: w.bossUp,
      banner: document.getElementById('banner')?.classList.contains('show') ? document.getElementById('bannerTitle').textContent + ' | ' + document.getElementById('bannerSub').textContent : '',
      bannerBox: box('banner'), castBox: box('tCast'), castText: document.getElementById('tCast')?.hidden ? '' : document.getElementById('tCastName').textContent,
      dimhorn: dim ? { aux: Math.round(dim.aux * 10) / 10, cast: dim.castId, calls: dim.aux2, at: (() => { const q = window.__ember.scene().hd2d?.project?.(dim.x, dim.y); return q ? [Math.round(q.x), Math.round(q.y)] : null; })() } : null,
      hounds: w.enemies.filter((e) => e.alive && e.kind === 'rimehound').length,
      foes: w.enemies.map((e, i) => ({ e, i })).filter((o) => o.e.alive).map(({ e, i }) => { const v = window.__ember.scene().hd2d; const q = v?.project?.(e.x, e.y), h = v?.foeHead?.(i); return `${e.kind} floor ${q ? Math.round(q.x) + ',' + Math.round(q.y) : '-'} head ${h ? Math.round(h.x) + ',' + Math.round(h.y) : '-'}`; }), hero: pr ? [Math.round(pr.x), Math.round(pr.y)] : null,
    };
  });
  const report = {};
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${size}-${name}.png`) }); report[name] = await info(); };
  await page.waitForTimeout(2500);
  await shot('1-start');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 1; });
  // 2: the Dimhorn's pack wakes; take the hero off autopilot and let its cold ring fill out in the dark.
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.phase === 'fight' && w.enemies.some((e) => e.alive && e.kind === 'dimhorn')) { s.autopilot = false; return true; } return false; }, null, { timeout: 300000, polling: 30 }).catch(() => errs.push('no dimhorn pack'));
  await page.waitForFunction(() => { const s = window.__ember.scene(); const d = s.world.enemies.find((e) => e.alive && e.kind === 'dimhorn'); if (d && d.aux >= 4) { s.warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 30 }).catch(() => errs.push('ring never filled'));
  await page.waitForTimeout(1200);
  await shot('2-ring-filling');
  // 3: the Dark Call, as its cast starts.
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const d = s.world.enemies.find((e) => e.alive && e.kind === 'dimhorn'); if (d && d.castId === 'darkCall' && d.castT > 0.4) { s.warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 16 }).catch(() => errs.push('no dark call'));
  await page.waitForTimeout(450);
  await shot('3-dark-call');
  // 4: the hounds coming in (more Rimehounds than before the call).
  await page.evaluate(() => { const s = window.__ember.scene(); window.__hounds0 = s.world.enemies.filter((e) => e.alive && e.kind === 'rimehound').length; s.warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); if (s.world.enemies.filter((e) => e.alive && e.kind === 'rimehound').length > window.__hounds0) { return true; } return false; }, null, { timeout: 60000, polling: 16 }).catch(() => errs.push('no hounds'));
  await page.waitForFunction(() => { const s = window.__ember.scene(), w = s.world; const h = w.enemies.filter((e) => e.alive && e.kind === 'rimehound'); if (h.length && h.every((e) => w.time - e.spawnedAt > 0.8)) { s.warp = 0; return true; } return false; }, null, { timeout: 60000, polling: 16 });
  await page.waitForTimeout(300);
  await shot('4-hounds-in');
  console.log('DBG', JSON.stringify(await page.evaluate(() => {
    const { scene, renderer } = window.__h3; const out = {}; let casters = 0, vis = 0; const lights = [];
    const isVis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    scene.traverse((o) => {
      if (o.isLight && isVis(o)) lights.push(o.type + (o.castShadow ? '*' : '') + ':' + (o.intensity ?? 0).toFixed?.(1));
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !isVis(o)) return;
      vis++; if (o.castShadow) casters++;
      const k = (o.parent && o.parent !== scene ? (o.parent.name || o.parent.type) + '/' : '') + o.geometry?.type + '|' + o.material?.type + (o.isInstancedMesh ? '[I' + o.count + ']' : '') + (o.castShadow ? '*' : '');
      out[k] = (out[k] || 0) + 1;
    });
    return { vis, casters, lights, shadowMap: renderer.shadowMap.enabled, out };
  })));
  const SECS = Number(process.env.SECS || 90);
  const res = await page.evaluate(async (SECS) => {
    const s = window.__ember.scene(); s.warp = 1;
    const { scene } = window.__h3;
    const isVis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const snap = () => { const out = {}; scene.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isLine) || !isVis(o)) return; if (o.isInstancedMesh && o.count === 0) return; const k = (o.parent && o.parent !== scene ? (o.parent.name || o.parent.type) + '/' : '') + o.geometry?.type + '|' + o.material?.type + (o.castShadow ? '*' : ''); out[k] = (out[k] || 0) + 1; }); return out; };
    let best = null; const hist = {};
    const t0 = performance.now();
    while (performance.now() - t0 < SECS * 1000) {
      await new Promise((r) => setTimeout(r, 100));
      const st = s.hd2d?.stats?.(); if (!st) continue;
      const w = s.world; hist[st.calls] = (hist[st.calls] || 0) + 1;
      if (!best || st.calls > best.calls) best = { calls: st.calls, tris: st.triangles, t: Math.round(w.time * 10) / 10, room: w.halls ? w.halls.cur ?? null : null, foes: w.enemies.filter((e) => e.alive).map((e) => e.kind).join(','), snap: snap() };
      if (s.world.phase === 'over' || s.world.over) break;
    }
    return { best, hist };
  }, SECS);
  console.log('PEAK', JSON.stringify(res));
  console.log('STATS', JSON.stringify(await page.evaluate(() => window.__ember.scene().hd2d?.stats?.())));
  report.banners = await page.evaluate(() => window.__banners);
  console.log(JSON.stringify(report, null, 1));
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
