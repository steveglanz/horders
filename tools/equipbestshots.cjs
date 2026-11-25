// Bags' "Equip best" on phones (Steve, 25 Nov): the button with its gear score gain, then the bag after one tap, at
// 320x568 or 568x320 (or `desk` for 1280x720). The hero gets better copies of two worn pieces and a piece for an empty
// slot, so there is something to put on.
// Usage: npm run build && node tools/equipbestshots.cjs <outDir> [p320|l568|desk]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568', 'desk'].find((s) => process.argv.includes(s)) || 'p320';
fs.mkdirSync(out, { recursive: true });
const dist = process.env.DIST || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const VIEW = { p320: { width: 320, height: 568 }, l568: { width: 568, height: 320 }, desk: { width: 1280, height: 720 } };
(async () => {
  const b = await chromium.launch();
  const phone = size !== 'desk';
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&hd2d=0`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  const setup = await page.evaluate(() => {
    // A worn set of plain pieces, then better copies of two of them and a piece for the empty trinket slot.
    const h = window.__ember.hero();
    const main = { weapon: 'power', head: 'vitality', chest: 'vitality', hands: 'haste', ring: 'crit', trinket: 'swiftness' };
    const mk = (id, slot, rarity, v, extra) => ({ id, slot, rarity, ilvl: 10, name: `${rarity === 'epic' ? 'Ember-forged' : 'Plain'} ${slot}`, stats: [{ stat: main[slot], value: v }, ...(extra ? [{ stat: 'crit', value: extra }] : [])] });
    h.inventory = []; h.equipped = {};
    for (const slot of ['weapon', 'head', 'chest', 'hands', 'ring']) { const it = mk(`w-${slot}`, slot, 'common', 6); h.inventory.push(it); h.equipped[slot] = it.id; }
    h.inventory.push(mk('b-weapon', 'weapon', 'epic', 14, 3), mk('b-ring', 'ring', 'rare', 9, 2), mk('b-trinket', 'trinket', 'rare', 8), mk('x-head', 'head', 'common', 3));
    return { inv: h.inventory.length, worn: Object.keys(h.equipped).length };
  });
  await page.evaluate(() => document.getElementById('bagBtn').click());
  await page.waitForTimeout(500);
  const btn = await page.evaluate(() => { const b = document.querySelector('[data-ebest]'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.textContent, box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] }; });
  const gs0 = await page.evaluate(() => document.querySelector('#bagList .sec-h .gold')?.textContent || document.getElementById('bagSub').textContent);
  await page.screenshot({ path: path.join(out, `${size}-1-before.png`) });
  await page.evaluate(() => document.querySelector('[data-ebest]')?.click());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ btn: !!document.querySelector('[data-ebest]'), gs: document.querySelector('#bagList .sec-h .gold')?.textContent || '', equipped: Object.values(window.__ember.hero().equipped) }));
  await page.screenshot({ path: path.join(out, `${size}-2-after.png`) });
  console.log(JSON.stringify({ setup, btn, gs0, after }));
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
