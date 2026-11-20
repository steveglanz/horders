import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Hud } from './ui';
import { Hub } from './hub';
import { loadHero, resetHero, saveHero } from './save';
import { applyRun, equippedItems, HeroProfile, newerHero } from '../sim/hero';
import { cloud, queueCloudSave } from './cloud';
import { World, WorldOptions } from '../sim/world';

const el = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
let stress = params.has('stress');
const hud = new Hud();
hud.showPerf = stress || params.has('debug');
let hero: HeroProfile = loadHero();
const save = () => {
  saveHero(hero);
  queueCloudSave(() => hero);
};
const hub = new Hub(() => hero, save);
hub.tier = hero.maxTier;
hub.render();

// Pull the cloud save (if any) and keep whichever copy has made more progress.
void (async () => {
  const remote = await cloud.loadHero();
  if (remote && remote.version === 1 && Array.isArray(remote.inventory)) {
    const best = newerHero(hero, remote);
    if (best === remote && el('title').hidden === false) {
      hero = { ...hero, ...remote };
      saveHero(hero);
      hub.tier = hero.maxTier;
    } else if (best !== remote) {
      void cloud.saveHero(hero);
    }
  } else if (cloud.online) {
    void cloud.saveHero(hero);
  }
  hub.render();
  await hub.refreshBoss();
})();

// Render at device resolution, capped at 2x for fill-rate; ?lowres=1 opts out.
const DPR = params.has('lowres') ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
document.documentElement.style.setProperty('--dpr', String(DPR));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#120b0a',
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth * DPR, height: window.innerHeight * DPR, zoom: 1 / DPR },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  banner: false,
});
// NONE scale mode: follow the window ourselves so the backing store stays at device resolution.
const fit = () => game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);

function seed(): number {
  const s = params.get('seed');
  return s ? Number(s) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
}

let runSeed = 0;
let runApplied = true;

/** Banks a finished (or abandoned) run into the saved hero, once. */
function finishRun(w: World) {
  if (runApplied || w.stress) return undefined;
  runApplied = true;
  const summary = w.summary();
  const rewards = applyRun(hero, runSeed, summary, w.eliteKilled, w.runDrops, w.runEquipped);
  save();
  hub.render();
  void strikeBoss(summary.damageDealt, summary.time);
  return rewards;
}

/** Sends a finished delve's damage to the shared world boss. */
async function strikeBoss(damage: number, seconds: number): Promise<void> {
  const out = el('endBoss');
  out.innerHTML = '';
  if (damage <= 0) return;
  const r = await cloud.strike(damage, seconds);
  if (!r) {
    out.innerHTML = cloud.online === false ? '<span class="muted">World boss offline: this delve only counted locally.</span>' : '';
  } else if (r.ok) {
    out.innerHTML = r.defeated
      ? `<b style="color:var(--gold)">Your delve landed the killing blow on ${r.name}!</b> Claim your reward from the main menu.`
      : `Your delve struck <b>${r.name}</b> for ${(r.dealt ?? 0).toLocaleString()}. It has ${r.hp.toLocaleString()} health left.`;
  } else if (r.reason === 'too_soon') {
    out.innerHTML = '<span class="muted">The world boss is recovering. Your next delve can strike it again.</span>';
  }
  await hub.refreshBoss();
}

function startRun(): void {
  if (game.scene.getScene('game')) game.scene.stop('game');
  runSeed = seed();
  hub.bossNote = "";
  runApplied = false;
  const opts: WorldOptions = {
    seed: runSeed,
    stress,
    invulnerable: params.has('god'),
    gear: equippedItems(hero),
    passives: hero.passives,
    heroLevel: hero.level,
    nextItemId: hero.nextItemId,
    tier: hub.tier,
    cls: hero.cls ?? 'emberwright',
  };
  game.scene.start('game', {
    opts,
    hud,
    onEnd: (w: World) => {
      const rewards = finishRun(w);
      hud.showEnd(w, rewards, hero);
    },
  });
}

game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.add('game', GameScene, false);
  if (stress) startRun();
});

el('startBtn').addEventListener('click', () => {
  stress = params.has('stress');
  hud.showPerf = stress || params.has('debug');
  startRun();
});
el('stressLink').addEventListener('click', (e) => {
  e.preventDefault();
  stress = true;
  hud.showPerf = true;
  startRun();
});
el('resetBtn').addEventListener('click', () => {
  hero = resetHero();
  hub.tier = 1;
  save();
  hub.render();
});
el('againBtn').addEventListener('click', startRun);
el('menuBtn').addEventListener('click', () => {
  game.scene.stop('game');
  el('end').hidden = true;
  hud.hideRun();
  hub.render();
  el('title').hidden = false;
});
el('quitBtn').addEventListener('click', () => {
  // Leaving early still keeps the loot and experience earned so far.
  const scene = game.scene.getScene('game') as GameScene | null;
  if (scene?.world) finishRun(scene.world);
  game.scene.stop('game');
  el('pause').hidden = true;
  hud.hideRun();
  el('title').hidden = false;
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!el('title').hidden && el('bag').hidden) startRun();
  else if (!el('end').hidden) startRun();
});

// Pause automatically when the tab or app goes to the background.
document.addEventListener('visibilitychange', () => {
  const scene = game.scene.getScene('game') as GameScene | null;
  if (document.hidden && scene && game.scene.isActive('game')) scene.togglePause(true);
});

// Hook for automated checks.
(window as unknown as { __ember: unknown }).__ember = {
  scene: () => game.scene.getScene('game') as GameScene | null,
  hero: () => hero,
};
