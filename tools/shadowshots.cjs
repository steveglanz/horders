// Screenshots the world boss shadow fight for each boss in the rotation (X1): Grandmother Slag, the Cinder
// Colossus, Old Vorhulm and the Furnace Regent, each drawn from its own sheet under the purple shadow tint.
// Also a sheet of the four sprites untinted, from their textures. The run starts on the shadow fight.
// Usage: npm run build && node tools/shadowshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const BOSSES = [['slag', 'Grandmother Slag'], ['colossus', 'The Cinder Colossus'], ['vorhulm', 'Old Vorhulm'], ['regent', 'The Furnace Regent']];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const [id, name] of BOSSES) {
    await page.evaluate((name) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 3, cls: 'emberwright', dungeon: 'kiln', route: ['worldShadow'], tier: 5, invulnerable: true, worldBoss: name }, hud: s.hud, onEnd: () => {} });
    }, name);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    await page.waitForFunction(() => {
      const s = window.__ember.scene(); const w = s.world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'worldShadow');
      return !!e && w.time - e.spawnedAt > 3 && !(s.warp = 0);
    }, null, { timeout: 60000, polling: 'raf' }).catch(() => errs.push('timeout ' + id));
    // Frozen: set the shadow beside the hero, between hits, so the shot shows its resting look.
    await page.evaluate(() => {
      const w = window.__ember.scene().world; const p = w.player;
      const e = w.enemies.find((o) => o.alive && o.kind === 'worldShadow');
      if (e) { e.x = e.px = p.x + 170; e.y = e.py = p.y - 20; e.flash = -1; }
    });
    await page.waitForTimeout(300);
    const key = await page.evaluate(() => { const s = window.__ember.scene(); const i = s.world.enemies.findIndex((o) => o.alive && o.kind === 'worldShadow'); return s.enemySprites[i]?.texture.key; });
    if (!key) errs.push('no shadow sprite ' + id);
    await page.screenshot({ path: path.join(out, `${tag}-shadow-${id}.png`) });
  }
  const png = await page.evaluate(() => {
    const s = window.__ember.scene(); const keys = ['slagCrone', 'colossus', 'vorhulm', 'regent']; const D = 256;
    const c = document.createElement('canvas'); c.width = D * 4; c.height = D;
    const g = c.getContext('2d'); g.fillStyle = '#1a1412'; g.fillRect(0, 0, c.width, c.height);
    keys.forEach((k, i) => { const fr = s.textures.getFrame(k, '0'); g.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, i * D, 0, D, D); });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(out, `${tag}-shadow-0-sprites.png`), Buffer.from(png.split(',')[1], 'base64'));
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
