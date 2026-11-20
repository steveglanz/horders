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

  it('plays the Bulwark through a run with only Bulwark talents', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const w = new World({ seed: 5, cls: 'bulwark' });
    let drafts = 0;
    while (w.state !== 'ended' && w.time < 500) {
      if (w.state === 'draft') {
        for (const c of w.choices) expect([undefined, 'bulwark']).toContain(TALENTS[c.id].cls);
        drafts++;
        w.choose(botChoose(w));
      } else w.step(botInput(w, 1));
    }
    expect(drafts).toBeGreaterThanOrEqual(3);
    expect(w.encounter).toBeGreaterThanOrEqual(3);
  });

  it('Bulwark armor and Bastion cut damage, and Bastion turns some back', async () => {
    const { World } = await import('../sim/world');
    const w = new World({ seed: 2, cls: 'bulwark' });
    const hurt = (w as unknown as { hurtPlayer(a: number, s?: number): void }).hurtPlayer.bind(w);
    const hp0 = w.player.hp;
    hurt(100);
    expect(hp0 - w.player.hp).toBeCloseTo(80, 5);
    w.player.hp = w.player.maxHp;
    w.player.heat = 100;
    w.step({ x: 0, y: 0, cast: 2 });
    expect(w.player.bastionT).toBeGreaterThan(5);
    w.step({ x: 0, y: 0, cast: 2 });
    const hp1 = w.player.hp;
    hurt(100);
    expect(hp1 - w.player.hp).toBeCloseTo(32, 5);
    expect(w.player.prevented).toBeCloseTo(68, 5);
  });

  it('Shield Block cuts hits from the foe the shield faces', async () => {
    const { World } = await import('../sim/world');
    // Tier 4: no novice aid, so only the sweep target is blocked.
    const w = new World({ seed: 2, cls: 'bulwark', tier: 4 });
    const hurt = (w as unknown as { hurtPlayer(a: number, s?: number): void }).hurtPlayer.bind(w);
    w.player.guardId = 0;
    w.enemies[0].alive = true;
    const hp0 = w.player.hp;
    hurt(100, 0);
    expect(hp0 - w.player.hp).toBeCloseTo(80 * 0.65, 5);
    const hp1 = w.player.hp;
    hurt(100, 1);
    expect(hp1 - w.player.hp).toBeCloseTo(80, 5);
  });

  it('Ward shields absorb hits before health', async () => {
    const { World } = await import('../sim/world');
    const w = new World({ seed: 2, cls: 'bulwark' });
    w.talents = { ward: 2 };
    for (let k = 0; k < 8 * 30 + 2; k++) w.step({ x: 0, y: 0 });
    expect(w.player.ward).toBeCloseTo(w.player.maxHp * 0.16, 5);
  });

  it('is deterministic for the Bulwark too', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const play = () => {
      const w = new World({ seed: 11, cls: 'bulwark' });
      for (let k = 0; k < 3000 && w.state !== 'ended'; k++) {
        if (w.state === 'draft') w.choose(botChoose(w));
        else w.step(botInput(w, 1));
      }
      return w.hash();
    };
    expect(play()).toBe(play());
  });

  it('Duskblade ability talents change Sidestep and Rending Dash', async () => {
    const { World } = await import('../sim/world');
    const w = new World({ seed: 4, cls: 'duskblade' });
    w.talents = { counterstep: 2, flurryStep: 2 };
    expect(w.abilityCost(0)).toBe(w.abilities[0].cost - 10);
    w.step({ x: 1, y: 0, cast: 1 });
    expect(w.player.shieldT).toBeGreaterThan(1.3);
  });
});

describe('world boss shadow fight', () => {
  it('follows a won delve, lasts 60 seconds and keeps the victory', async () => {
    const { World, SHADOW_TIME } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const w = new World({ seed: 5, worldBoss: 'Grandmother Slag', invulnerable: true });
    while (w.state !== 'ended' && w.time < 900) {
      if (w.state === 'draft') w.choose(botChoose(w));
      else w.step(botInput(w, 1));
    }
    const s = w.summary();
    expect(s.victory).toBe(true);
    expect(w.route[w.route.length - 1]).toBe('worldShadow');
    expect(s.shadowTime).toBe(SHADOW_TIME);
    expect(s.shadowDamage).toBeGreaterThan(0);
    expect(s.damageDealt).toBeGreaterThanOrEqual(s.shadowDamage!);
  });

  it('skips the shadow fight when no world boss is known', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const w = new World({ seed: 5, invulnerable: true });
    while (w.state !== 'ended' && w.time < 900) {
      if (w.state === 'draft') w.choose(botChoose(w));
      else w.step(botInput(w, 1));
    }
    expect(w.victory).toBe(true);
    expect(w.route).not.toContain('worldShadow');
    expect(w.summary().shadowTime).toBe(0);
  });

  it('plays the Lumen through a run with only Lumen talents', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const w = new World({ seed: 6, cls: 'lumen' });
    let drafts = 0;
    while (w.state !== 'ended' && w.time < 600) {
      if (w.state === 'draft') {
        for (const c of w.choices) expect([undefined, 'lumen']).toContain(TALENTS[c.id].cls);
        drafts++;
        w.choose(botChoose(w));
      } else w.step(botInput(w, 1));
    }
    expect(drafts).toBeGreaterThanOrEqual(3);
    expect(w.encounter).toBeGreaterThanOrEqual(3);
  });

  it('Lumen overhealing is stored as Brilliance', async () => {
    const { World } = await import('../sim/world');
    const w = new World({ seed: 2, cls: 'lumen' });
    w.player.hp = w.player.maxHp - 10;
    expect(w.healPlayer(30)).toBeCloseTo(10, 5);
    expect(w.player.brilliance).toBeCloseTo(20, 5);
    w.talents = { kindledLight: 1 };
    w.healPlayer(10);
    expect(w.player.brilliance).toBeCloseTo(33, 5);
  });

  it("Martyr's Halo stops one killing blow per fight", async () => {
    const { World } = await import('../sim/world');
    const w = new World({ seed: 2, cls: 'lumen' });
    w.talents = { martyrsHalo: 1 };
    const hurt = (w as unknown as { hurtPlayer(a: number): void }).hurtPlayer.bind(w);
    hurt(500);
    expect(w.player.hp).toBe(1);
    expect(w.player.shieldT).toBeGreaterThan(1.9);
    w.player.shieldT = 0;
    hurt(500);
    expect(w.player.hp).toBeLessThan(0);
  });

  it('is deterministic for the Lumen too', async () => {
    const { World } = await import('../sim/world');
    const { botChoose, botInput } = await import('../sim/bot');
    const play = () => {
      const w = new World({ seed: 11, cls: 'lumen' });
      for (let k = 0; k < 3000 && w.state !== 'ended'; k++) {
        if (w.state === 'draft') w.choose(botChoose(w));
        else w.step(botInput(w, 1));
      }
      return w.hash();
    };
    expect(play()).toBe(play());
  });
});
