// Screenshots the Forge flourish: an item card just after Upgrade (ember flash, item level lit) and after Temper
// (blue flash, the rerolled stat lit). Gives the hero two items and embers, then uses the real buttons.
// Usage: npm run build && node tools/forgeshots.cjs <outDir>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const ITEMS = [
  { id: 'f1', slot: 'head', rarity: 'rare', ilvl: 2, name: 'Tempered Helm', stats: [{ stat: 'vitality', value: 35.2 }, { stat: 'haste', value: 3.4 }, { stat: 'crit', value: 2.6 }] },
  { id: 'f2', slot: 'trinket', rarity: 'epic', ilvl: 7, name: 'Gleaming Charm', stats: [{ stat: 'crit', value: 5.8 }, { stat: 'power', value: 6.1 }, { stat: 'reach', value: 7.4 }, { stat: 'swiftness', value: 2.2 }] },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const url = `http://127.0.0.1:${srv.address().port}/?seed=2`;
    await page.goto(url);
    await page.waitForTimeout(600);
    await page.evaluate((items) => {
      const h = window.__ember.hero();
      h.runs = Math.max(h.runs, 3); h.embers = 5000; h.maxTier = Math.max(h.maxTier, 4);
      h.inventory.push(...items);
      h.nextItemId = Math.max(h.nextItemId ?? 0, 100);
      localStorage.setItem('horders.hero.v1', JSON.stringify(h));
    }, ITEMS);
    await page.goto(url);
    await page.waitForTimeout(800);
    await page.evaluate(() => document.getElementById('bagBtn').click());
    await page.waitForTimeout(400);
    for (const [id, btn, name] of [['f1', 'u', 'upgrade'], ['f2', 'tm', 'temper']]) {
      if (tag === 'phone') {
        await page.evaluate((id) => document.querySelector(`[data-i="${id}"]`)?.click(), id);
        await page.waitForTimeout(400);
      }
      const sel = tag === 'phone' ? `#sheetBody [data-${btn}="${id}"]` : `#bagList [data-${btn}="${id}"]`;
      if (tag !== 'phone') await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
      const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el || el.disabled) return false; el.click(); return true; }, sel);
      if (!ok) { errs.push(`no ${name} button for ${id}`); continue; }
      await page.waitForTimeout(160);
      const card = await page.evaluate((id) => { const el = document.querySelector(`.forged[data-it="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, id);
      if (!card) { errs.push(`no flourish on ${id}`); continue; }
      const pad = 24; const vp = page.viewportSize();
      const x = Math.max(0, card.x - pad); const y = Math.max(0, card.y - pad);
      await page.screenshot({ path: path.join(out, `${tag}-forge-${name}.png`), clip: { x, y, width: Math.min(vp.width - x, card.width + pad * 2), height: Math.min(vp.height - y, card.height + pad * 2) } });
      await page.waitForTimeout(1500);
      if (tag === 'phone') await page.evaluate(() => { document.getElementById('sheet').hidden = true; });
    }
    console.log(tag, errs.length ? errs.join('\n') : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
