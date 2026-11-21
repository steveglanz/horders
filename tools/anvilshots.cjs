// Screenshots the Anvil Slagbinder (the tank stance) beside a Bellows Slagbinder in a Hammerdeep party, so the two
// read apart at a glance, plus a close crop of both sprites. The bot plays; the shot freezes a few seconds in.
// Usage: npm run build && node tools/anvilshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { seed: 4, cls: 'slagbinder', stance: 'anvil', dungeon: 'hammerdeep', tier: 4, invulnerable: true, heroName: 'Anvil 4', party: [{ cls: 'slagbinder', stance: 'bellows', name: 'Bellows 4' }, { cls: 'lumen', name: 'Lumen 4' }, { cls: 'duskblade', name: 'Duskblade 4' }] };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=4&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
  // Freeze once the Bellows ally stands near the player, so both fit in one view.
  await page.waitForFunction(() => {
    const s = window.__ember.scene(); const w = s.world;
    if (w.time < 6) return false;
    const a = w.heroData(w.acting).player; const q = w.heroData(1).player;
    return Math.hypot(a.x - q.x, a.y - q.y) < 110 && !(s.warp = 0);
  }, null, { timeout: 60000, polling: 'raf' }).catch(() => errs.push('timeout'));
  // The bots crowd together, so set the Bellows ally beside the player and the others a step back (frozen, so it holds).
  await page.evaluate(() => {
    const w = window.__ember.scene().world; const a = w.heroData(w.acting).player;
    [[1, 80, 0], [2, -60, 80], [3, 60, 90]].forEach(([k, dx, dy]) => { const q = w.heroData(k).player; q.x = q.px = a.x + dx; q.y = q.py = a.y + dy; });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${tag}-anvil-1-party.png`) });
  // Close crop: both sprites side by side at 4x, from their textures.
  const png = await page.evaluate(() => {
    const s = window.__ember.scene(); const c = document.createElement('canvas'); c.width = 52 * 2 * 4 + 24; c.height = 52 * 4;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#1a1412'; g.fillRect(0, 0, c.width, c.height);
    ['slagbinder', 'slagbinderAnvil'].forEach((k, i) => { const fr = s.textures.getFrame(k, '0'); g.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, i * (52 * 4 + 24), 0, 52 * 4, 52 * 4); });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(out, `${tag}-anvil-0-sprites.png`), Buffer.from(png.split(',')[1], 'base64'));
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
