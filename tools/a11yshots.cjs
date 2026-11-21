// Screenshots the display options: the same telegraphs (attack circle, attack cone,
// soak circle, bloom) in the standard and colour-blind palettes, the pause menu and
// the main menu's options. Usage: npm run build && node tools/a11yshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://*.supabase.co/**', (r) => r.abort());
  const tag = phone ? 'phone' : 'desk';
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=2&god=1');
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelector('details.how').open = true; });
  await (await page.$('#hubOpts')).screenshot({ path: path.join(out, `${tag}-a11y-hub-options.png`) });
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.phase === 'fight', null, { timeout: 30000 });
  // Freeze the run and lay out one of each telegraph around the hero.
  await page.evaluate(() => {
    const s = window.__ember.scene(); s.warp = 0;
    const w = s.world; const p = w.player;
    for (const e of w.enemies) e.alive = false;
    w.addTelegraph('circle', p.x - 150, p.y - 40, 90, 0, 0, 10, 0, 'hit');
    w.addTelegraph('cone', p.x + 60, p.y - 30, 200, -0.4, 1.2, 10, 0, 'hit');
    w.addTelegraph('circle', p.x - 60, p.y + 150, 70, 0, 0, 10, 0, 'soak');
    w.addTelegraph('circle', p.x + 150, p.y + 140, 70, 0, 0, 10, 0, 'bloom');
    for (const t of w.telegraphs) if (t.alive) t.t = t.dur * 0.45;
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, `${tag}-a11y-standard.png`) });
  await page.click('#pauseBtn');
  await page.waitForTimeout(200);
  await page.click('#pauseOpts [data-v="colorblind"]');
  await page.click('#pauseOpts [data-v="reduced"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `${tag}-a11y-pause.png`) });
  await page.click('#resumeBtn');
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, `${tag}-a11y-colorblind.png`) });
  const saved = await page.evaluate(() => localStorage.getItem('horders.display.v1'));
  console.log('saved settings:', saved, errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
