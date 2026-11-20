// Renders every procedural texture onto one contact sheet for art review.
// Usage: npm run build && node tools/artsheet.cjs [out.png]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots/artsheet.png';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=1&god=1');
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene() && window.__ember.scene().textures.exists('player'));
  const imgs = await page.evaluate(() => {
    const tm = window.__ember.scene().textures;
    const keys = ['player', 'duskblade', 'ashling', 'cinderhound', 'husk', 'cinderBrute', 'ashmaw', 'acolyte', 'kilnMother', 'glassWarden', 'emberTwin', 'emberTwinB', 'sluiceCrawler', 'maelra', 'vent', 'steam', 'water', 'rift', 'vein', 'loot', 'gem', 'bolt', 'hitstar', 'puff', 'ring', 'ground'];
    return keys.filter((k) => tm.exists(k)).map((k) => ({ k, src: tm.get(k).getSourceImage().toDataURL() }));
  });
  const html = `<body style="margin:0;background:#18100e;color:#d9c3b0;font:12px system-ui;padding:16px;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end">${imgs
    .map((i) => `<figure style="margin:0;text-align:center"><img src="${i.src}" style="image-rendering:auto;max-width:${i.k === 'ground' ? 256 : 1240}px"><figcaption>${i.k}</figcaption></figure>`)
    .join('')}</body>`;
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await p2.setContent(html);
  await p2.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log('wrote', out);
})();
