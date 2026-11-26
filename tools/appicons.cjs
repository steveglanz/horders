// App icon and splash for the Capacitor shell (roadmap 1.0 M7). One hand-drawn emblem, a hoard
// beast: a horned iron head with slit ember eyes and a fanged, glowing maw, rising over a
// furnace ring and a mound of hoard gold. Original Horders art, no outside assets.
//
//   node tools/appicons.cjs [outDir=assets] [previewDir=docs/art/app-icon]
//
// Writes the @capacitor/assets "custom mode" sources into outDir:
//   icon-only.png (1024, iOS and legacy Android), icon-foreground.png + icon-background.jpg
//   (1024, Android adaptive layers), splash.jpg (2732; the game is dark, so no separate dark
//   splash), and the SVG masters.
// Then `npx @capacitor/assets generate` makes every iOS and Android size from them.
// previewDir gets masks, small sizes and phone-shaped splash crops for review.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const out = path.resolve(process.argv[2] || 'assets');
const prev = path.resolve(process.argv[3] || 'docs/art/app-icon');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(prev, { recursive: true });

const BG = '#120b0a'; // the game's --bg, so the splash hands over to the page with no flash

const DEFS = `
  <radialGradient id="hwBg" cx="50%" cy="46%" r="72%">
    <stop offset="0" stop-color="#4a1c10"/><stop offset=".5" stop-color="#22100b"/><stop offset="1" stop-color="${BG}"/>
  </radialGradient>
  <radialGradient id="hwRing" cx="50%" cy="50%" r="50%">
    <stop offset=".55" stop-color="#ff6a26" stop-opacity="0"/>
    <stop offset=".74" stop-color="#ff8a3d" stop-opacity=".95"/>
    <stop offset=".82" stop-color="#ffd27a"/>
    <stop offset=".9" stop-color="#ff7a2e" stop-opacity=".6"/>
    <stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="hwIron" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4b3934"/><stop offset=".35" stop-color="#2a1e1b"/><stop offset="1" stop-color="#120c0b"/>
  </linearGradient>
  <linearGradient id="hwHorn" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#2a1e1b"/><stop offset=".7" stop-color="#5a463e"/><stop offset="1" stop-color="#c9b39a"/>
  </linearGradient>
  <radialGradient id="hwMaw" cx="50%" cy="35%" r="70%">
    <stop offset="0" stop-color="#ffe7a8"/><stop offset=".35" stop-color="#ff9a3d"/><stop offset=".8" stop-color="#c2361a"/><stop offset="1" stop-color="#5a120a"/>
  </radialGradient>
  <linearGradient id="hwEye" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff6cf"/><stop offset=".6" stop-color="#ffd25a"/><stop offset="1" stop-color="#ff8a2e"/>
  </linearGradient>
  <radialGradient id="hwGold" cx="50%" cy="20%" r="80%">
    <stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#e8a83a"/><stop offset="1" stop-color="#7a4a14"/>
  </radialGradient>
  <filter id="hwBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
`;

// The head, drawn in a 1024 box centred on 512,512. Left half drawn, right half mirrored.
const half = `
  <path d="M430 372 C352 350 270 292 222 168 C210 140 236 132 248 156 C292 236 362 284 462 300 Z" fill="url(#hwHorn)" stroke="#0a0605" stroke-width="10" stroke-linejoin="round"/>
  <path d="M356 548 L250 566 L366 612 Z" fill="url(#hwIron)" stroke="#0a0605" stroke-width="9" stroke-linejoin="round"/>
  <path d="M372 650 L300 700 L398 700 Z" fill="url(#hwIron)" stroke="#0a0605" stroke-width="9" stroke-linejoin="round"/>
`;
const mirror = (s) => `${s}<g transform="translate(1024 0) scale(-1 1)">${s}</g>`;
const eyeL = 'M382 470 L494 524 L478 556 L392 506 Z';
const eyeR = 'M642 470 L530 524 L546 556 L632 506 Z';
const fangs = (y0, y1, xs, w) => xs.map((x) => `<path d="M${x - w} ${y0} L${x} ${y1} L${x + w} ${y0} Z"/>`).join('');
const HEAD = `
  ${mirror(half)}
  <path d="M512 262 C604 262 684 304 704 386 C720 450 704 522 672 584 L646 690 C626 762 574 804 512 818 C450 804 398 762 378 690 L352 584 C320 522 304 450 320 386 C340 304 420 262 512 262 Z"
        fill="url(#hwIron)" stroke="#ff7a2e" stroke-width="12" stroke-linejoin="round"/>
  <path d="M512 290 L540 360 L512 420 L484 360 Z" fill="#5a463e" opacity=".55"/>
  <path d="M340 430 L512 498 L684 430 L680 474 L512 552 L344 474 Z" fill="#0d0807"/>
  <path d="M340 430 L512 498 L684 430" fill="none" stroke="#6e5850" stroke-width="10" stroke-linejoin="round"/>
  <g filter="url(#hwBlur)" fill="#ff9a3d" opacity=".9"><path d="${eyeL}"/><path d="${eyeR}"/></g>
  <path d="${eyeL}" fill="url(#hwEye)"/><path d="${eyeR}" fill="url(#hwEye)"/>
  <path d="M488 606 L500 590 L506 618 Z M536 606 L524 590 L518 618 Z" fill="#0a0605"/>
  <path d="M418 646 Q512 690 606 646 L588 734 Q512 782 436 734 Z" fill="url(#hwMaw)" stroke="#0a0605" stroke-width="9" stroke-linejoin="round"/>
  <g fill="#f3e6cf" stroke="#0a0605" stroke-width="6" stroke-linejoin="round">
    ${fangs(664, 732, [452, 572], 18)}${fangs(674, 704, [486, 512, 538], 10)}
    ${fangs(744, 700, [470, 554], 13)}
  </g>
`;

const coins = (() => {
  // A low mound of hoard gold under the jaw, with a few coin faces catching the light.
  const c = [[300, 846], [372, 822], [652, 822], [724, 846], [262, 884], [762, 884], [430, 872], [594, 872], [512, 892]];
  return `<path d="M168 940 Q512 760 856 940 Z" fill="url(#hwGold)" stroke="#3a220a" stroke-width="8"/>` +
    c.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="34" ry="13" fill="#ffd56a" stroke="#7a4a14" stroke-width="6"/>`).join('');
})();

// Ring + coins + head, at a scale. `s`=1 fills the iOS icon; smaller for the adaptive safe zone.
const emblem = (s) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">
  <circle cx="512" cy="500" r="400" fill="url(#hwRing)"/>
  ${coins}${HEAD}</g>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${DEFS}</defs>${body}</svg>`;

// iOS draws the icon full bleed with its own rounded mask, so the art can be large (inside ~86%).
const ICON = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#hwBg)"/>${emblem(0.92)}`);
// Android adaptive: @capacitor/assets wraps both layers in an <inset> of 16.7% (checked in its
// mipmap-anydpi-v26/ic_launcher.xml output), so each image fills the 72dp visible area and the
// 66dp safe circle is the central 92%. The emblem (horn tips about 450 from centre) fits at 0.88.
const FG = svg(1024, 1024, emblem(0.88));
const BGL = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#hwBg)"/>`);
// Splash: 2732 square (the tool crops it per device), emblem in the middle third, no text.
const splash = svg(2732, 2732, `<rect width="2732" height="2732" fill="${BG}"/>
  <radialGradient id="spG" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#4a1c10"/><stop offset="1" stop-color="${BG}"/></radialGradient>
  <circle cx="1366" cy="1366" r="900" fill="url(#spG)"/>
  <g transform="translate(1366 1366) scale(0.78) translate(-512 -512)">${emblem(1)}</g>`);

async function render(browser, markup, w, h, file, transparent) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : BG}">${markup}</body></html>`);
  await page.screenshot(file.endsWith('.jpg') ? { path: file, type: 'jpeg', quality: 92 } : { path: file, omitBackground: !!transparent });
  await page.close();
}

(async () => {
  for (const [n, m] of [['icon', ICON], ['icon-foreground', FG], ['icon-background', BGL], ['splash', splash]]) fs.writeFileSync(path.join(out, `${n}.svg`), m);
  const browser = await chromium.launch();
  await render(browser, ICON, 1024, 1024, path.join(out, 'icon-only.png'));
  await render(browser, FG, 1024, 1024, path.join(out, 'icon-foreground.png'), true);
  await render(browser, BGL, 1024, 1024, path.join(out, 'icon-background.jpg'));
  await render(browser, splash, 2732, 2732, path.join(out, 'splash.jpg')); // one splash: the game is dark either way

  // Previews: iOS rounded square, Android circle / squircle / teardrop masks over the adaptive
  // layers (each layer fills the 72dp visible area after the tool's 16.7% inset), then small sizes.
  const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(out, f)).toString('base64');
  const ic = b64('icon-only.png'), fg = b64('icon-foreground.png'), bg = b64('icon-background.jpg').replace('image/png', 'image/jpeg');
  const ios = (s) => `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.225}px;overflow:hidden;flex:none;background:url(${ic}) center/cover"></div>`;
  const and = (s, r) => `<div style="width:${s}px;height:${s}px;border-radius:${r};overflow:hidden;flex:none;position:relative">
     <div style="position:absolute;inset:0;background:url(${fg}) center/100%,url(${bg}) center/100%"></div></div>`;
  const cap = (t) => `<div style="font:13px Inter,sans-serif;color:#555;text-align:center;margin-top:6px">${t}</div>`;
  const cell = (x, t) => `<div style="display:flex;flex-direction:column;align-items:center">${x}${cap(t)}</div>`;
  const sheet = (bgc) => `<html><body style="margin:0;padding:24px;background:${bgc};display:flex;gap:20px;align-items:flex-end;flex-wrap:nowrap;white-space:nowrap">
    ${cell(ios(150), 'iOS 180 (shown 150)')}${cell(and(150, '50%'), 'Android circle')}${cell(and(150, '30%'), 'Android squircle')}${cell(and(150, '50% 50% 12% 50%'), 'Android teardrop')}
    ${cell(ios(60), 'iOS 60')}${cell(and(48, '50%'), 'Android 48')}${cell(ios(40), 'iOS 40')}${cell(ios(29), 'iOS 29')}</body></html>`;
  for (const [n, c] of [['icon-masks-light', '#e9e4df'], ['icon-masks-dark', '#1d1d1f']]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 240 }, deviceScaleFactor: 2 });
    await page.setContent(sheet(c)); await page.screenshot({ path: path.join(prev, `${n}.png`) }); await page.close();
  }
  // Splash as phones crop it (portrait and landscape centre crops of the 2732 square).
  const sp = b64('splash.jpg').replace('image/png', 'image/jpeg');
  const crop = (w, h, t) => cell(`<div style="width:${w}px;height:${h}px;border-radius:18px;overflow:hidden;background:url(${sp}) center/${Math.max(w, h) * 1.0}px"></div>`, t);
  const page = await browser.newPage({ viewport: { width: 540, height: 470 }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;padding:24px;background:#e9e4df;display:flex;gap:26px;align-items:center">${crop(196, 420, 'phone portrait')}${crop(420, 196, 'phone landscape')}</body></html>`);
  await page.screenshot({ path: path.join(prev, 'splash-crops.png') }); await page.close();
  await browser.close();
  console.log('wrote', out, 'and previews in', prev);
})();
