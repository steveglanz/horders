// Screenshots the talent draft cards with their branch glyphs (BRANCH_GLYPH in client/icons.ts):
// one draft per class, plus a sheet of every branch glyph in its colour. No network.
// Usage: npm run build && node tools/talentshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
// The glyphs and colours, read from the source so the sheet can't drift from the game.
const icons = fs.readFileSync(path.resolve('client/icons.ts'), 'utf8');
const ui = fs.readFileSync(path.resolve('client/ui.ts'), 'utf8');
const block = (src, name) => src.slice(src.indexOf(name), src.indexOf('};', src.indexOf(name)));
const pairs = (b) => [...b.matchAll(/^\s+(\w+): '([^']+)'/gm)].map((m) => [m[1], m[2]]);
const glyphs = pairs(block(icons, 'BRANCH_GLYPH'));
const colors = Object.fromEntries(pairs(block(ui, 'BRANCH_COLOR')));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const cls of ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder']) {
    await page.evaluate((cls) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, cls, dungeon: 'kiln', tier: 3, invulnerable: true }, hud: s.hud, onEnd: () => {} }); }, cls);
    await page.waitForTimeout(600);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = false; s.warp = 3; });
    await page.waitForFunction(() => !document.getElementById('draft').hidden && document.querySelectorAll('#cards .card').length > 0, null, { timeout: 90000, polling: 50 }).catch(() => errs.push('timeout ' + cls));
    await page.waitForTimeout(600); // let the cards' entrance finish
    await page.screenshot({ path: path.join(out, `${tag}-talents-${cls}.png`) });
    await page.evaluate(() => { window.__ember.scene().autoPick = true; });
  }
  if (!phone) {
    await page.close();
    const sheet = await ctx.newPage();
    await sheet.setContent(`<body style="margin:0;background:#140c0a;font:12px system-ui;color:#c9b8a8;display:grid;grid-template-columns:repeat(4,150px);gap:14px;padding:20px">${glyphs.map(([k, d]) => `<div style="display:flex;align-items:center;gap:10px"><span style="display:inline-grid;place-items:center;width:44px;height:44px;border-radius:12px;color:${colors[k]};background:color-mix(in srgb, ${colors[k]} 14%, transparent)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></span>${k}</div>`).join('')}</body>`);
    await sheet.setViewportSize({ width: 700, height: 300 });
    await sheet.screenshot({ path: path.join(out, 'branch-glyphs.png'), fullPage: true });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
