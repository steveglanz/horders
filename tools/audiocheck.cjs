// Audio smoke test: unlocks sound with a tap, checks the engine, and records
// each theme (plus a real run's sound effects) to webm files for listening.
// Usage: npm run build && node tools/audiocheck.cjs [outDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2] || 'tools/audio';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=3&god=1');
  const before = await page.evaluate(() => window.__ember.audio.unlocked);
  await page.tap('.logo');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ unlocked: window.__ember.audio.unlocked, state: window.__ember.audio.ctx.state, theme: window.__ember.audio.music.theme }));
  console.log('before tap unlocked:', before, '| after tap:', JSON.stringify(after));
  const record = async (name, ms, setup) => {
    const b64 = await page.evaluate(async ({ ms, setup }) => {
      const a = window.__ember.audio;
      if (setup) new Function('a', 'ember', setup)(a, window.__ember);
      const dest = a.ctx.createMediaStreamDestination();
      a.master.connect(dest);
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 96000 });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start();
      await new Promise((r) => setTimeout(r, ms));
      rec.stop();
      await done;
      a.master.disconnect(dest);
      const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, { ms, setup });
    const file = path.join(out, `${name}.webm`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('wrote', file, Math.round(fs.statSync(file).size / 1024) + ' KB');
  };
  await record('1-hub', 16000);
  // A real Kiln Depths delve on autopilot: music plus every combat sound.
  await page.tap('#startBtn');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; });
  await page.waitForTimeout(500);
  const inRun = await page.evaluate(() => window.__ember.audio.music.theme);
  console.log('theme in run:', inRun);
  await record('2-kiln-delve', 30000);
  await record('3-foundry', 16000, "a.theme('foundry')");
  await record('4-glarewell', 16000, "a.theme('glarewell')");
  await record('5-boss-intensity', 12000, "a.theme('kiln'); a.intensity(1)");
  await record('7-hammerdeep', 16000, "a.theme('hammerdeep')");
  await record('8-hammerdeep-boss', 12000, `a.theme('hammerdeep'); a.intensity(1);
    a.play('anvilWarn'); setTimeout(() => a.play('anvilfall'), 2500); setTimeout(() => a.play('sweep'), 5000);
    setTimeout(() => a.play('choir'), 7000); setTimeout(() => a.play('anvilWarn'), 8500); setTimeout(() => a.play('anvilfall'), 11000);`);
  await record('9-coop-cues', 6000, `a.theme(null);
    ['matchFound','partyJoin','allyDown','allyUp','selfDown','partyLeave'].forEach((id, k) => setTimeout(() => a.play(id), k * 900));`);
  await record('6-sfx-tour', 9000, `
    const ids = ['hit','crit','emberWave','emberNova','duskDash','duskExecute','bulwarkSlam','bulwarkBastion','lumenBurst','lumenSanctuary','interrupt','castWarn','levelUp','dropEpic','dropMythic','chest','bossSpawn','victory'];
    a.theme(null); ids.forEach((id, k) => setTimeout(() => a.play(id), k * 480));`);
  await record('10-phase-stings', 11000, `a.theme(null);
    ['targeted','phaseKiln','phaseMaelra','phaseLens','phaseOndrel','phaseShadow'].forEach((id, k) => setTimeout(() => a.play(id), k * 1800));`);
  await record('11-ashvents', 14000, "a.theme('ashvents')");
  await record('12-coldmarrow', 20000, "a.theme('coldmarrow'); a.warmth(1); setTimeout(() => a.warmth(0.5), 7000); setTimeout(() => a.warmth(0.1), 13000)");
  await record('13-raid-phases', 30000, `a.theme('raid'); a.intensity(1);
    setTimeout(() => { a.play('phaseRaid2'); a.intensity(2); }, 10000);
    setTimeout(() => { a.play('phaseRaid3'); a.intensity(3); }, 20000);`);
  await record('14-new-boss-cues', 16000, `a.theme(null);
    ['ventWarn','scatterWarn','scatter','bellowWarn','bellow','longNightWarn','longNight','snuff','phaseIce','ladle'].forEach((id, k) => setTimeout(() => a.play(id), k * 1500));`);
  // Mute should silence everything.
  const muted = await page.evaluate(() => { const a = window.__ember.audio; a.set({ muted: true }); return { muted: a.settings.muted, stored: localStorage.getItem('horders.audio') }; });
  console.log('mute:', JSON.stringify(muted));
  await page.evaluate(() => window.__ember.audio.set({ muted: false }));
  await page.screenshot({ path: path.join(out, 'run-phone.png') });
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})();
