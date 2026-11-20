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
    w.talents = { extraOrb: 2, quickcast: 1 };
    expect(w.branchRanks('kindling')).toBe(CAPSTONE_RANKS);
    expect(w.rollDraft().map((c) => c.id)).toContain('phoenixLance');
  });

  it('offers one card per branch while every branch has talents left', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = new World({ seed });
      const branches = w.rollDraft().map((c) => TALENTS[c.id].branch).sort();
      expect(branches).toEqual(['ashguard', 'kindling', 'wildfire']);
    }
  });

  it('a committed build reaches its capstone in a normal run', () => {
    let capstones = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = runBot(seed);
      if (Object.keys(w.talents).some((id) => TALENTS[id as keyof typeof TALENTS].capstone)) capstones++;
    }
    expect(capstones).toBeGreaterThanOrEqual(5);
  });

  it('Blazing Speed rank 2 lets Blink be cast twice in a row', () => {
    const w = new World({ seed: 3 });
    w.talents = { blazingSpeed: 1 };
    w.state = 'draft';
    w.player.pendingLevels = 1;
    w.choices = [{ id: 'blazingSpeed', nextRank: 2 }];
    w.choose(0);
    w.step({ x: 1, y: 0, cast: 1 });
    expect(w.player.cds[1]).toBeGreaterThan(0);
    // Wait out the global cooldown, then Blink again on the stored charge.
    for (let k = 0; k < 13; k++) w.step({ x: 1, y: 0 });
    w.step({ x: 1, y: 0, cast: 1 });
    expect(w.player.blinkCharges).toBe(0);
    expect(w.player.hasteT).toBeGreaterThan(1.5);
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

describe('classes', () => {
  it('drafts only the Duskblade tree when playing a Duskblade', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const w = new World({ seed: 3, cls: 'duskblade' });
    let drafts = 0;
    while (w.state !== 'ended' && w.time < 400) {
      if (w.state === 'draft') {
        for (const c of w.choices) expect([undefined, 'duskblade']).toContain(TALENTS[c.id].cls);
        drafts++;
        w.choose(botChoose(w));
      } else w.step(botInput(w, 1));
    }
    expect(drafts).toBeGreaterThan(0);
    expect(w.damageDealt).toBeGreaterThan(1000);
    expect(w.player.maxHp).toBeGreaterThanOrEqual(190);
  });

  it('is deterministic for the Duskblade too', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const play = () => {
      const w = new World({ seed: 11, cls: 'duskblade' });
      for (let k = 0; k < 3000 && w.state !== 'ended'; k++) {
        if (w.state === 'draft') w.choose(botChoose(w));
        else w.step(botInput(w, 1));
      }
      return w.hash();
    };
    expect(play()).toBe(play());
  });
});
