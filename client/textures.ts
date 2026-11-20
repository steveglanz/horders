/**
 * Original placeholder art, drawn in code. Nothing here is borrowed; every
 * texture can be swapped for real art later by loading an image with the same key.
 */
import Phaser from 'phaser';

type Draw = (ctx: CanvasRenderingContext2D, s: number) => void;

function make(scene: Phaser.Scene, key: string, size: number, draw: Draw): void {
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx, size);
  tex.refresh();
}

function glow(ctx: CanvasRenderingContext2D, s: number, inner: string, outer: string, core = 0.15): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(core, inner);
  g.addColorStop(0.55, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

function creature(ctx: CanvasRenderingContext2D, s: number, body: string, rim: string, eye: string, eyeGap: number, spikes: number): void {
  const c = s / 2;
  const r = s * 0.4;
  ctx.save();
  // Jagged ash body.
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.82;
    ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(c, c - r * 0.3, r * 0.1, c, c, r);
  g.addColorStop(0, rim);
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  // Glowing eyes.
  ctx.fillStyle = eye;
  ctx.shadowColor = eye;
  ctx.shadowBlur = s * 0.12;
  const ey = c - r * 0.15;
  const er = Math.max(1.5, s * 0.07);
  ctx.beginPath();
  ctx.arc(c - eyeGap * s, ey, er, 0, Math.PI * 2);
  ctx.arc(c + eyeGap * s, ey, er, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function buildTextures(scene: Phaser.Scene): void {
  // Ground: dark basalt with faint ember cracks, tiles seamlessly.
  make(scene, 'ground', 256, (ctx, s) => {
    ctx.fillStyle = '#17100e';
    ctx.fillRect(0, 0, s, s);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tones = ['#1b1311', '#1e1513', '#150f0d', '#201614'];
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 4 + rnd() * 16;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = '#3a1a10';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      let x = rnd() * s;
      let y = rnd() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (rnd() - 0.5) * 50;
        y += (rnd() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });

  // The Emberwright: a hooded figure with an ember core.
  make(scene, 'player', 48, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#2b1d2e';
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c, 4);
    ctx.lineTo(s - 8, s - 6);
    ctx.quadraticCurveTo(c, s - 14, 8, s - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const g = ctx.createRadialGradient(c, c + 4, 0, c, c + 4, 10);
    g.addColorStop(0, '#fff6d6');
    g.addColorStop(0.4, '#ffb347');
    g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c + 4, 10, 0, Math.PI * 2);
    ctx.fill();
  });
  // The Duskblade: a cloaked figure with two crossed blades.
  make(scene, 'duskblade', 48, (ctx, s) => {
    const c = s / 2;
    ctx.strokeStyle = '#e9dcff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, 10); ctx.lineTo(s - 10, s - 8);
    ctx.moveTo(s - 6, 10); ctx.lineTo(10, s - 8);
    ctx.stroke();
    ctx.fillStyle = '#1f1830';
    ctx.strokeStyle = '#b58cff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c, 6);
    ctx.lineTo(s - 12, s - 8);
    ctx.quadraticCurveTo(c, s - 15, 12, s - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0465a';
    ctx.beginPath();
    ctx.arc(c - 4, c + 1, 2, 0, Math.PI * 2);
    ctx.arc(c + 4, c + 1, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  make(scene, 'aura', 128, (ctx, s) => glow(ctx, s, 'rgba(255,170,80,0.35)', 'rgba(255,90,30,0.10)', 0.02));

  // The Hollow Tide.
  make(scene, 'ashling', 24, (ctx, s) => creature(ctx, s, '#3b3140', '#6d5e72', '#ff5a3c', 0.12, 7));
  make(scene, 'cinderhound', 30, (ctx, s) => creature(ctx, s, '#4a2418', '#9c4a2a', '#ffd23c', 0.1, 5));
  make(scene, 'husk', 54, (ctx, s) => creature(ctx, s, '#231c22', '#4d404b', '#ff3b6b', 0.1, 9));
  make(scene, 'cinderBrute', 64, (ctx, s) => creature(ctx, s, '#3a1712', '#b0452a', '#ffe16b', 0.11, 11));
  make(scene, 'kilnMother', 112, (ctx, s) => {
    creature(ctx, s, '#1d1013', '#7a2b22', '#ff3b6b', 0.09, 14);
    // Furnace mouth.
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c + s * 0.12, 0, c, c + s * 0.12, s * 0.14);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.5, '#ff7a2f');
    g.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c + s * 0.12, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ashmaw the Glutton: a bloated rare with a gaping maw.
  make(scene, 'ashmaw', 60, (ctx, s) => {
    creature(ctx, s, '#2a2c3a', '#6b7aa0', '#9fd0ff', 0.12, 8);
    const c = s / 2;
    ctx.fillStyle = '#120a0c';
    ctx.beginPath();
    ctx.ellipse(c, c + s * 0.12, s * 0.16, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // Hollow Rift: a violet tear in the ground.
  make(scene, 'rift', 56, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#f2d9ff');
    g.addColorStop(0.25, '#a04bff');
    g.addColorStop(0.6, 'rgba(70,20,120,0.75)');
    g.addColorStop(1, 'rgba(20,0,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c, c, c * 0.95, c * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,190,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c, c, c * 0.55, c * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  // Ember Acolyte: a robed channeler.
  make(scene, 'acolyte', 34, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#3a1f12';
    ctx.strokeStyle = '#7dffb0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c, 3);
    ctx.lineTo(s - 5, s - 3);
    ctx.lineTo(5, s - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b6ffd2';
    ctx.beginPath();
    ctx.arc(c, c, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // Ember Vein: a gatherable crystal cluster.
  make(scene, 'vein', 36, (ctx, s) => {
    const shard = (x: number, h: number, w: number) => {
      const g = ctx.createLinearGradient(x, s - h, x, s);
      g.addColorStop(0, '#fff1b8');
      g.addColorStop(0.4, '#ffb347');
      g.addColorStop(1, '#8a2e12');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, s - h);
      ctx.lineTo(x + w, s - 4);
      ctx.lineTo(x - w, s - 4);
      ctx.closePath();
      ctx.fill();
    };
    shard(s * 0.32, s * 0.55, 6);
    shard(s * 0.68, s * 0.65, 6);
    shard(s * 0.5, s * 0.9, 7);
  });
  // Loot bag on the ground, tinted by rarity at draw time.
  make(scene, 'loot', 24, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(c - 6, 6);
    ctx.lineTo(c + 6, 6);
    ctx.lineTo(c + 3, 10);
    ctx.quadraticCurveTo(s - 2, 14, c + 6, s - 2);
    ctx.lineTo(c - 6, s - 2);
    ctx.quadraticCurveTo(2, 14, c - 3, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  make(scene, 'beam', 16, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Player effects (warm palette).
  make(scene, 'orb', 34, (ctx, s) => glow(ctx, s, '#ffd27a', 'rgba(255,110,30,0.6)'));
  make(scene, 'ember', 32, (ctx, s) => glow(ctx, s, '#ffe3a1', 'rgba(255,120,40,0.7)', 0.2));
  make(scene, 'burn', 64, (ctx, s) => glow(ctx, s, 'rgba(255,150,60,0.55)', 'rgba(200,60,20,0.35)', 0.05));
  make(scene, 'blast', 64, (ctx, s) => glow(ctx, s, 'rgba(255,220,140,0.9)', 'rgba(255,100,30,0.5)', 0.1));
  make(scene, 'spark', 8, (ctx, s) => glow(ctx, s, '#ffcf70', 'rgba(255,100,30,0.6)', 0.3));

  // XP: cool teal so it never blends with fire.
  make(scene, 'gem', 14, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#4fe3c1';
    ctx.strokeStyle = '#d8fff4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c, 1);
    ctx.lineTo(s - 2, c);
    ctx.lineTo(c, s - 1);
    ctx.lineTo(2, c);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}
