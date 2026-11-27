// CP2 feel kit test scene (client/feel.ts): records a clip of every hit size in the real build, on a phone screen.
// Each size plays three times on the nearest foe of a Kiln room, frozen in place, with its name on screen.
// Usage: npm run build && node tools/feelclips.cjs [distDir] [outDir]   (W=390 H=844; FEELSTOP=<ms> tries another
// heavy-hit stop; LOOK=2d for the 2D look). Writes <size>.webm per size, all.webm, and one <size>.jpg frame each.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const dist = process.argv[2] || 'dist';
const out = path.resolve(process.argv[3] || 'feelclips');
fs.mkdirSync(out, { recursive: true });
const SIZES = ['tap', 'crit', 'heavy', 'kill', 'bigKill', 'bossKill', 'hurt', 'hurtBig'];
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const size = { width: +(process.env.W || 390), height: +(process.env.H || 844) };
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: out, size } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const look = process.env.LOOK === '2d' ? '2d' : '3d';
  await ctx.addInitScript((look) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full', shake: 'full', look })), look);
  await ctx.addInitScript((h) => localStorage.setItem('horders.hero.v1', h), fs.readFileSync(process.env.HERO || 'tools/heroes/hero-t4.json', 'utf8'));
  const page = await ctx.newPage();
  const t0 = Date.now();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const stop = process.env.FEELSTOP ? `&feelstop=${process.env.FEELSTOP}` : '';
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${process.env.SEED || 9}&god=1${stop}`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.time > 0.5, null, { timeout: 120000 });
  // Let the bot walk into the first pack, then freeze the fight with a foe close by.
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 1; });
  await page.waitForFunction(() => {
    const s = window.__ember.scene(), w = s.world, p = w.player;
    const near = w.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 160).length;
    if (near >= 2) { s.warp = 0; return true; }
    return false;
  }, null, { timeout: 120000, polling: 50 });
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id = 'feelLabel';
    d.style.cssText = 'position:fixed;left:0;right:0;top:38%;text-align:center;font:bold 22px system-ui;color:#fff;text-shadow:0 2px 4px #000;z-index:99;pointer-events:none';
    document.body.appendChild(d);
  });
  await page.waitForTimeout(800);
  const marks = [];
  for (const s of SIZES) {
    const start = (Date.now() - t0) / 1000;
    await page.evaluate((s) => { document.getElementById('feelLabel').textContent = s; }, s);
    for (let k = 0; k < 3; k++) {
      await page.evaluate((s) => window.__ember.scene().feelTest(s), s);
      await page.waitForTimeout(700);
      if (k === 0) await page.screenshot({ path: path.join(out, `${s}.jpg`), type: 'jpeg', quality: 80 });
    }
    marks.push({ s, start, end: (Date.now() - t0) / 1000 });
  }
  const video = page.video();
  await ctx.close();
  const all = path.join(out, 'all.webm');
  fs.renameSync(await video.path(), all);
  // The video starts when the page opens (a little before t0): cut each size's stretch out of it.
  for (const m of marks) {
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, m.start - 0.1)), '-to', String(m.end + 0.3), '-i', all, '-c:v', 'libvpx', '-b:v', '1M', path.join(out, `${m.s}.webm`)]); } catch (e) { console.log('ffmpeg failed for', m.s, e.message); }
  }
  console.log(JSON.stringify({ look, marks }, null, 0));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})();
