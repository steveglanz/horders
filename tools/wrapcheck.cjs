const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///tmp/claude-0/wrap.html');
  await p.waitForTimeout(500);
  await p.tap('#startBtn');
  // Drag a touch joystick to the right for 2 seconds.
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600 }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 + i * 8, y: 600 }] }); await p.waitForTimeout(30); }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'tools/shots/wrap-touch.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x = await p.evaluate(() => window.__ember.scene().world.player.x);
  console.log('player x after joystick drag:', x.toFixed(1), errs.length ? errs : 'no errors');
  await b.close();
})();
