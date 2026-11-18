import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Hud } from './ui';

const params = new URLSearchParams(location.search);
let stress = params.has('stress');
const hud = new Hud();
hud.showPerf = stress || params.has('debug');

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

function startRun(): void {
  const scene = game.scene.getScene('game');
  if (scene) game.scene.stop('game');
  game.scene.start('game', { seed: seed(), stress, god: params.has('god'), hud });
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
el('againBtn').addEventListener('click', startRun);
el('menuBtn').addEventListener('click', () => {
  game.scene.stop('game');
  el('end').hidden = true;
  el('hud').hidden = true;
  el('title').hidden = false;
});
el('quitBtn').addEventListener('click', () => {
  game.scene.stop('game');
  el('pause').hidden = true;
  el('hud').hidden = true;
  el('bossbar').hidden = true;
  el('title').hidden = false;
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !el('title').hidden) startRun();
  else if (e.key === 'Enter' && !el('end').hidden) startRun();
});

// Pause automatically when the tab or app goes to the background.
document.addEventListener('visibilitychange', () => {
  const scene = game.scene.getScene('game') as GameScene | null;
  if (document.hidden && scene && game.scene.isActive('game')) scene.togglePause(true);
});

// Hook for automated performance checks.
(window as unknown as { __ember: unknown }).__ember = {
  scene: () => game.scene.getScene('game') as GameScene | null,
};
