// Installs the debug APK on a running Android emulator, opens the app, and plays one delve with the
// autopilot inside the app's own WebView (roadmap 1.0 M7 "done when"). Used by the App shell
// workflow's android-play job. Fails if the delve does not end, if the end screen does not show,
// or if the page throws.
//
// Usage: node tools/apkplay.cjs <apk> <outDir>      (needs adb and a booted emulator)
//        node tools/apkplay.cjs --desktop <outDir>  (same delve in desktop Chromium on dist/, for a
//                                                    quick check of this script without an emulator)
//
// Driven by Playwright's Android support (playwright-core `_android`), which talks to the app's
// WebView over the DevTools socket. Capacitor turns WebView debugging on in debug builds.
const fs = require('fs');
const path = require('path');

const PKG = 'com.steveglanz.horders';
const desktop = process.argv[2] === '--desktop';
const apk = desktop ? null : process.argv[2];
const out = process.argv[3] || 'tools/shots/apk';
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function openPage() {
  if (desktop) {
    const { chromium } = require('playwright');
    const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await b.newPage({ viewport: { width: 412, height: 915 }, hasTouch: true });
    await page.goto('file://' + path.resolve('dist/index.html') + '?seed=1');
    return { page, close: () => b.close(), shot: (f) => page.screenshot({ path: f }), tapEl: (sel) => page.tap(sel) };
  }
  const { _android } = require('playwright-core');
  const [device] = await _android.devices();
  if (!device) throw new Error('no Android device found by adb');
  log('device', device.model(), device.serial());
  log('android', (await device.shell('getprop ro.build.version.release')).toString().trim(),
    'webview', (await device.shell('dumpsys package com.google.android.webview')).toString().match(/versionName=(\S+)/)?.[1] ?? '?');
  await device.installApk(fs.readFileSync(apk));
  log('installed', apk);
  await device.shell(`am start -W -n ${PKG}/.MainActivity`);
  const webview = await device.webView({ pkg: PKG }, { timeout: 120000 });
  const page = await webview.page();
  return {
    page,
    close: () => device.close(),
    // CDP mouse and touch input hangs in the emulator's WebView (26 Nov: page.click timed out on
    // "performing click action"), so tap the real screen through adb, the way a finger would.
    // The WebView's bounds on screen come from the Android view tree; the element's box is in CSS px.
    tapEl: async (sel) => {
      // uiautomator dump, not device.info(), which needs Playwright's separate driver APK.
      // On the CI emulator a system dialog (26 Nov: package "android", over the app; likely a
      // "System UI isn't responding" prompt on a slow first boot) can cover the app, so answer
      // Wait on it and look again.
      let wv = null;
      for (let k = 0; k < 8 && !wv; k++) {
        await device.shell('uiautomator dump /sdcard/ui.xml');
        const xml = (await device.shell('cat /sdcard/ui.xml')).toString();
        const m = xml.match(/class="android\.webkit\.WebView"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if (m) { wv = { bounds: { x: +m[1], y: +m[2], width: m[3] - m[1], height: m[4] - m[2] } }; break; }
        const texts = [...xml.matchAll(/text="([^"]+)"/g)].map((t) => t[1]);
        log('no WebView on screen yet; texts:', JSON.stringify(texts));
        const btn = xml.match(/text="(Wait|OK|Close)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if (btn) {
          const bx = (+btn[2] + +btn[4]) >> 1, by = (+btn[3] + +btn[5]) >> 1;
          log('tapping system dialog button', btn[1], 'at', bx, by);
          await device.shell(`input tap ${bx} ${by}`);
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
      if (!wv) throw new Error('no WebView in the view tree after 8 tries');
      const r = await page.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2, dpr: devicePixelRatio }; }, sel);
      const x = Math.round(wv.bounds.x + r.x * r.dpr), y = Math.round(wv.bounds.y + r.y * r.dpr);
      log('tap', sel, 'at', x, y, 'webview bounds', JSON.stringify(wv.bounds));
      await device.shell(`input tap ${x} ${y}`);
    },
    // The device screenshot shows the whole screen as a player sees it, WebGL included.
    shot: async (f) => fs.writeFileSync(f, await device.screenshot()),
  };
}

(async () => {
  const { page, close, shot, tapEl } = await openPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  log('url', page.url());
  await page.waitForFunction(() => !!window.__ember, null, { timeout: 120000 });
  const info = await page.evaluate(() => ({ ua: navigator.userAgent, w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
    webgl: !!document.createElement('canvas').getContext('webgl2') }));
  log('page', JSON.stringify(info));
  await page.locator('#startBtn').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(`${out}/1-hub.png`);
  await tapEl('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await shot(`${out}/2-delve.png`);
  const st = () => page.evaluate(() => { const w = window.__ember.scene().world;
    return { t: Math.round(w.time), state: w.state, lvl: w.player.level, hp: Math.round(w.player.hp), kills: w.kills, dungeon: w.dungeonId }; });
  log('start', JSON.stringify(await st()), '3D look:', await page.evaluate(() => window.__ember.look3d()));
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 10; });
  let midShot = false;
  const deadline = Date.now() + 20 * 60 * 1000;
  let s = await st();
  for (let k = 0; s.state !== 'ended' && Date.now() < deadline; k++) {
    await page.waitForTimeout(2000);
    s = await st();
    if (k % 15 === 0) log('run', JSON.stringify(s));
    if (!midShot && s.t >= 120) { midShot = true; await shot(`${out}/3-mid.png`); }
  }
  if (s.state !== 'ended') throw new Error('the delve did not end within 20 minutes: ' + JSON.stringify(s));
  const sum = await page.evaluate(() => window.__ember.scene().world.summary());
  log('ended', JSON.stringify({ victory: sum.victory, time: Math.round(sum.time), kills: sum.kills, level: sum.level, fights: sum.fightsCleared }));
  await page.locator('#end').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(`${out}/4-end.png`);
  log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
  await close();
  if (sum.kills <= 0) throw new Error('the delve ended with no kills');
  if (errors.some((e) => e.startsWith('pageerror'))) throw new Error('the page threw during the delve');
  log('OK: played a delve in the app');
})().catch((e) => { console.error(e); process.exit(1); });
