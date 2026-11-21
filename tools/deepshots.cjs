// Screenshots the C5 deep talent cards: a Bulwark draft of three deep cards, and the moment a
// capstone opens its branch's deep cards (the branch-coloured flare and banner). No network.
// Usage: npm run build && node tools/deepshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
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
  const draft = async (choices) => {
    await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, cls: 'bulwark', dungeon: 'kiln', tier: 3, invulnerable: true }, hud: s.hud, onEnd: () => {} }); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = false; s.warp = 3; });
    await page.waitForFunction(() => !document.getElementById('draft').hidden, null, { timeout: 90000, polling: 50 }).catch(() => errs.push('timeout draft'));
    await page.evaluate((choices) => { const s = window.__ember.scene(); s.world.choices.splice(0, 3, ...choices.map((id) => ({ id, nextRank: 1 }))); s.hud.draftShownFor = -1; s.hud.showDraft(s.world); }, choices);
    await page.waitForTimeout(600);
  };
  await draft(['rivetedPlates', 'hardKnocks', 'broadShoulders']);
  await page.screenshot({ path: path.join(out, `${tag}-deep-cards.png`) });
  await draft(['thornwall', 'rivetedPlates', 'fullWeight']);
  await page.screenshot({ path: path.join(out, `${tag}-deep-mixed.png`) });
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; s.pick(0); s.autoPick = true; });
  // Three frames of the flare as it opens.
  for (const ms of [60, 160, 320]) {
    await page.waitForTimeout(ms === 60 ? 60 : ms === 160 ? 100 : 160);
    await page.screenshot({ path: path.join(out, `${tag}-deep-unlock-${ms}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
