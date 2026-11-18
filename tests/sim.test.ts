import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { World } from '../sim/world';
import { runBot, botInput, botChoose } from '../sim/bot';
import { CAPSTONE_RANKS, TALENTS } from '../sim/content/emberwright';

describe('simulation', () => {
  it('is deterministic: same seed and inputs give the same state', () => {
    const a = runBot(42, 1, 120);
    const b = runBot(42, 1, 120);
    expect(a.hash()).toBe(b.hash());
    expect(a.tick).toBe(b.tick);
    const c = runBot(43, 1, 120);
    expect(c.hash()).not.toBe(a.hash());
  });

  it('never imports rendering or browser code', () => {
    const files = readdirSync('sim', { recursive: true }) as string[];
    for (const f of files.filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join('sim', f), 'utf8');
      expect(src, f).not.toMatch(/from ['"]phaser['"]/);
      expect(src, f).not.toMatch(/Math\.random\(|Date\.now\(|performance\.now\(|\bwindow\.|\bdocument\./);
    }
  });

  it('offers three valid, distinct talents on level-up', () => {
    const w = new World({ seed: 7 });
    while (w.state !== 'draft' && w.time < 120) w.step(botInput(w));
    expect(w.state).toBe('draft');
    expect(w.choices).toHaveLength(3);
    expect(new Set(w.choices.map((c) => c.id)).size).toBe(3);
    for (const c of w.choices) expect(TALENTS[c.id]).toBeDefined();
  });

  it('always offers a capstone once its branch has enough ranks', () => {
    const w = new World({ seed: 9 });
    w.talents = { extraOrb: 2, quickcast: 2 };
    expect(w.branchRanks('kindling')).toBe(CAPSTONE_RANKS);
    expect(w.rollDraft().map((c) => c.id)).toContain('phoenixLance');
  });

  it('plays a dungeon route through to the boss', () => {
    const w = runBot(1);
    expect(w.route).toHaveLength(5);
    expect(w.route[4]).toBe('kilnMother');
    expect(w.encounter).toBeGreaterThanOrEqual(4);
    expect(w.bossSpawned).toBe(true);
    expect(w.state).toBe('ended');
  });

  it('opens a talent draft only between fights', () => {
    const w = new World({ seed: 11 });
    let sawDraftInFight = false;
    while (w.state !== 'ended' && w.time < 200) {
      if (w.state === 'draft') {
        if (w.phase === 'fight') sawDraftInFight = true;
        w.choose(botChoose(w));
      } else w.step(botInput(w));
    }
    expect(sawDraftInFight).toBe(false);
    expect(w.encounter).toBeGreaterThanOrEqual(2);
  });

  it('interrupting a cast removes its telegraph and stuns the caster', () => {
    const w = new World({ seed: 5, route: ['brute', 'brute', 'brute', 'brute', 'kilnMother'] });
    while (!w.enemies.some((e) => e.alive && e.castId === 'groundPound') && w.time < 60) w.step({ x: 0, y: 0 });
    const i = w.enemies.findIndex((e) => e.alive && e.castId === 'groundPound');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(w.telegraphs.some((t) => t.alive && t.owner === i)).toBe(true);
    w.step({ x: 0, y: 0, cast: 3 });
    expect(w.enemies[i].castId).toBe('');
    expect(w.enemies[i].stunT).toBeGreaterThan(0);
    expect(w.telegraphs.some((t) => t.alive && t.owner === i)).toBe(false);
  });

  it('simulates 600 enemies well inside a frame budget', () => {
    const w = new World({ seed: 3, stress: true });
    for (let i = 0; i < 90; i++) {
      if (w.state === 'draft') w.choose(botChoose(w));
      w.step({ x: 1, y: 0 });
    }
    expect(w.aliveEnemies).toBeGreaterThanOrEqual(550);
    const t0 = performance.now();
    const n = 300;
    for (let i = 0; i < n; i++) {
      if (w.state === 'draft') w.choose(botChoose(w));
      w.step({ x: Math.cos(i / 30), y: Math.sin(i / 30) });
    }
    const ms = (performance.now() - t0) / n;
    console.log(`sim step with ~${w.aliveEnemies} enemies: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(4);
  });
});
