// Phone pass (M5, 27 Nov): the fight intro card, the pause screen and the Downstroke call at 320x568 or 568x320 in 3D.
// Shots: 1 a solo Kiln pack's intro, 2 the Kiln Mother's intro, 3 a Hammerdeep pack's intro with two bot allies
// (party frames up), 4 pause. With `oskel`: 5 the Pressworks' first Downstroke with two bot allies (set AFTER=1 to shoot
// as soon as the plate is down, for builds where phones no longer raise the Downstroke warning line).
// Logs where the card, the hero (hd2d.project), the party frames and the action bar are, in CSS px.
// Usage: npm run build && node tools/introbannershots.cjs <outDir> [p320|l568] [oskel]   (DIST=<dir> to shoot another build)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; const size = process.argv[3] || 'p320';
fs.mkdirSync(out, { recursive: true });
const VIEW = { p320: { width: 320, height: 568 }, l568: { width: 568, height: 320 } };
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(process.env.DIST || 'dist', p === '/hd2d.js' ? 'hd2d.js' : 'index.html'); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(path.resolve(f))); }).listen(0);
const HERO = fs.readFileSync(path.resolve('tools/heroes/hero-t6.json'), 'utf8');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((hero) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('horders.hero.v1', hero); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })); }, HERO);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript((a) => { window.__after = a; }, !!process.env.AFTER);
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  const box = () => page.evaluate(() => { const r = (el) => { const b = el?.getBoundingClientRect(); return b && b.width ? [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] : null; }; const s = window.__ember.scene(), w = s.world; const q = s.hd2d?.project?.(w.player.x, w.player.y); return { banner: document.getElementById('banner').classList.contains('show') ? r(document.getElementById('banner')) : null, cls: document.getElementById('banner').className, hero: q ? [Math.round(q.x), Math.round(q.y)] : null, party: r(document.getElementById('party')), bar: r(document.getElementById('actionbar')) }; });
  const rep = {};
  const scene = async (name, opts, until) => {
    await page.evaluate((opts) => { const s = window.__ember.scene(); s.scene.restart({ opts, hud: s.hud, onEnd: () => {} }); }, opts);
    await page.waitForTimeout(800);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 1; });
    await page.waitForFunction(until, null, { timeout: 900000, polling: 30 }).catch(() => errs.push('timeout ' + name));
    await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 0; s.hud.bannerTimer = performance.now() + 60000; });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, `${size}-${name}.png`) }); rep[name] = await box();
  };
  const introUp = () => { const s = window.__ember.scene(); return s.world.time > 0.6 && document.getElementById('banner').classList.contains('show'); };
  if (process.argv.includes('oskel')) {
    await scene('5-downstroke', { seed: 3, invulnerable: true, cls: 'bulwark', dungeon: 'pressworks', tier: 10, route: ['oskel'], party: [{ cls: 'slagbinder', name: 'Slagbinder (bot)' }, { cls: 'lumen', name: 'Lumen (bot)' }], partySize: 3, fillBots: 2 },
      () => { const s = window.__ember.scene(); const w = s.world; return w.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -3) && (window.__after ? true : document.getElementById('banner').classList.contains('show') && /Downstroke/.test(document.getElementById('bannerTitle').textContent)); });
    console.log(JSON.stringify(rep)); console.log(size, errs.length ? errs.join('; ') : 'no errors'); await b.close(); srv.close(); return;
  }
  await scene('1-pack', { seed: 7, invulnerable: true, cls: 'emberwright', dungeon: 'kiln', route: ['pack'], tier: 6 }, introUp);
  await scene('2-boss', { seed: 7, invulnerable: true, cls: 'emberwright', dungeon: 'kiln', route: ['kilnMother'], tier: 6 }, introUp);
  await scene('3-party', { seed: 7, invulnerable: true, cls: 'bulwark', dungeon: 'hammerdeep', tier: 8, party: [{ cls: 'lumen', name: 'Lumen (bot)' }, { cls: 'duskblade', name: 'Duskblade (bot)' }], partySize: 3, fillBots: 2 }, introUp);
  await page.evaluate(() => { window.__ember.scene().warp = 0; document.getElementById('banner').classList.remove('show'); });
  await page.click('#pauseBtn').catch(() => errs.push('no pause'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${size}-4-pause.png`) });
  console.log(JSON.stringify(rep)); console.log(size, errs.length ? errs.join('; ') : 'no errors');
  await b.close(); srv.close();
})();
