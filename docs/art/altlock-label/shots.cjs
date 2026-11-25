const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; let f = path.join(dist, p === '/' ? 'index.html' : p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : 'text/html' }); r.end(fs.readFileSync(path.resolve(f))); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'hub.png'), fullPage: true });
  await page.getByText('Hero', { exact: true }).last().click(); await page.waitForTimeout(600);
  const bw = await page.$('[data-cls="bulwark"]'); if (bw) { await bw.click(); await page.waitForTimeout(500); }
  await page.screenshot({ path: path.join(out, 'hero.png') });
  const el = await page.$('#classes'); if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(out, 'classes.png') }); }
  await b.close(); srv.close();
})();
