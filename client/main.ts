import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Hud } from './ui';
import { Hub } from './hub';
import { loadHero, resetHero, saveHero } from './save';
import { applyRun, equippedItems, HeroProfile } from '../sim/hero';
import { World, WorldOptions } from '../sim/world';

const params = new URLSearchParams(location.search);
let stress = params.has('stress');
const hud = new Hud();
hud.showPerf = stress || params.has('debug');
let hero: HeroProfile = loadHero();
const save = () => saveHero(hero);
const hub = new Hub(() => hero, save);
hub.tier = hero.maxTier;
hub.render();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#120b0a',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  banner: false,
});

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
  const rewards = applyRun(hero, runSeed, w.summary(), w.eliteKilled, w.runDrops, w.runEquipped);
  save();
  hub.render();
  return rewards;
}

function startRun(): void {
  if (game.scene.getScene('game')) game.scene.stop('game');
  runSeed = seed();
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

const el = (id: string) => document.getElementById(id)!;
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
