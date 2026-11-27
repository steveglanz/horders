import { describe, expect, it } from 'vitest';
import { World, MAELRA_HITS } from '../sim/world';
import { ENEMIES } from '../sim/content/enemies';

const GLASS_HEIR = ENEMIES.lensmother.name;

/**
 * 1.0 CP4 (vision section 6 item 6): every boss attack has a melee answer. docs/design/melee-answers.md lists each
 * launch boss's attacks and the answer; these tests pin the ones a PR changed.
 */
type Q = {
  spawn(kind: string, x: number, y: number): number;
  runAbilities(i: number, dt: number): void;
  bossIndex: number;
  bossSpawned: boolean;
};

/** A Foundry room with only Maelra up, the hero `dx` east of her. */
function maelra(dx: number): { w: World; q: Q; b: number } {
  const w = new World({ seed: 3, dungeon: 'foundry', tier: 4, omens: [], cls: 'duskblade' });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  w.player.x = dx; w.player.y = 0;
  const b = q.spawn('maelra', 0, 0);
  q.bossIndex = b; q.bossSpawned = true;
  return { w, q, b };
}
const others = (w: World) => { for (const e of w.enemies) if (e.alive && e.kind !== 'maelra') e.alive = false; };

describe('melee answers: Maelra (the Dowager Bellows)', () => {
  it('never hurts by touch: a melee hero standing against her takes nothing between her red marks', () => {
    const { w, b } = maelra(40);
    const e = w.enemies[b];
    const hp = w.player.hp;
    for (let n = 0; n < 30 * 3; n++) {
      e.abilityT = 99; e.touchCd = 0; e.x = 0; e.y = 0;
      w.player.x = 40; w.player.y = 0;
      for (const t of w.telegraphs) t.alive = false;
      others(w);
      w.step({ x: 0, y: 0 });
    }
    expect(w.player.hp).toBeGreaterThanOrEqual(hp);
  });

  it('her cone is hers (a Bulwark can parry it, and a loss names her), her circle under the hero is not', () => {
    let cone = false, circle = false;
    for (let seed = 0; seed < 40 && !(cone && circle); seed++) {
      const { w, q, b } = maelra(60);
      (w as unknown as { rng: { int(n: number): number } }).rng.int = () => seed % 2;
      w.enemies[b].abilityT = 0;
      q.runAbilities(b, 0.01);
      const t = w.telegraphs.find((x) => x.alive)!;
      if (t.shape === 'cone') { cone = true; expect(t.owner).toBe(b); expect(t.dmg).toBe(MAELRA_HITS.cone); }
      else { circle = true; expect(t.owner).toBe(-1); }
    }
    expect(cone && circle).toBe(true);
  });
});

/** A Glarewell room with only the Glass Heir up, the hero `dx` east of her. */
function heir(dx: number): { w: World; q: Q; b: number } {
  const w = new World({ seed: 3, dungeon: 'glarewell', tier: 7, omens: [], cls: 'duskblade' });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  w.player.x = dx; w.player.y = 0;
  const b = q.spawn('lensmother', 0, 0);
  q.bossIndex = b; q.bossSpawned = true;
  return { w, q, b };
}

describe('melee answers: the Glass Heir (the Glarewell)', () => {
  it('never hurts by touch: a melee hero standing against her takes nothing between her red marks', () => {
    const { w, b } = heir(50);
    const e = w.enemies[b];
    const hp = w.player.hp;
    const g = w as unknown as { glareT: number; bossBrandT: number };
    for (let n = 0; n < 30 * 3; n++) {
      e.abilityT = 99; e.touchCd = 0; e.x = 0; e.y = 0; g.glareT = 99; g.bossBrandT = 99;
      w.player.x = 50; w.player.y = 0;
      for (const t of w.telegraphs) t.alive = false;
      for (const o of w.enemies) if (o.alive && o.kind !== 'lensmother') o.alive = false;
      w.step({ x: 0, y: 0 });
    }
    expect(w.player.hp).toBeGreaterThanOrEqual(hp);
  });

  it('her Lens Sweep is still hers when it lands, even when a Quickened cast ends first (parryable, named on a loss)', () => {
    // Quickened shortens her cast bar but not the cone, so the cast used to end first and leave the cone unowned.
    for (const omens of [[], ['quickened']]) {
      const w = new World({ seed: 3, dungeon: 'glarewell', tier: 7, omens: omens as never, cls: 'duskblade' });
      const q = w as unknown as Q & { glareT: number; bossBrandT: number };
      for (const e of w.enemies) e.alive = false;
      const b = q.spawn('lensmother', 0, 0);
      q.bossIndex = b; q.bossSpawned = true;
      const e = w.enemies[b];
      const by: (string | undefined)[] = [];
      for (let n = 0; n < 30 * 8; n++) {
        w.player.x = 60; w.player.y = 0; e.x = 0; e.y = 0; q.glareT = 99; q.bossBrandT = 99;
        w.player.hp = w.player.maxHp; w.player.lastHurtBy = undefined;
        for (const o of w.enemies) if (o.alive && o.kind !== 'lensmother') o.alive = false;
        w.step({ x: 0, y: 0 });
        if (w.player.lastHurtBy) by.push(w.player.lastHurtBy);
      }
      expect(by.length).toBeGreaterThan(1);
      expect(new Set(by)).toEqual(new Set([GLASS_HEIR]));
    }
  });
});

describe('melee answers: the Banked Queen (the Coldmarrow)', () => {
  it('never hurts by touch: a melee hero standing against her takes nothing between her casts', () => {
    const w = new World({ seed: 3, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'duskblade' });
    const q = w as unknown as Q;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('nhevra', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    const e = w.enemies[b];
    const c = w as unknown as { snuffT: number; tideT: number; nightT: number };
    const hp = w.player.hp;
    for (let n = 0; n < 30 * 3; n++) {
      e.touchCd = 0; e.x = 0; e.y = 0; c.snuffT = 99; c.tideT = 99; c.nightT = 99;
      w.player.x = 50; w.player.y = 0;
      for (const o of w.enemies) if (o.alive && o.kind !== 'nhevra') o.alive = false;
      w.step({ x: 0, y: 0 });
    }
    expect(w.player.hp).toBeGreaterThanOrEqual(hp);
  });
});

describe('melee answers: Aunt Ebb (the Wrackline)', () => {
  it('never hurts by touch: a melee hero standing against her takes nothing between the Ebbs', () => {
    const w = new World({ seed: 3, dungeon: 'wrackline', tier: 13, omens: [], cls: 'duskblade' });
    const q = w as unknown as Q;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('hessa', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    const e = w.enemies[b];
    const c = w as unknown as { tideClockT: number; ebbT: number; ebbWarnT: number; sinkT: number; shoalT: number };
    const hp = w.player.hp;
    for (let n = 0; n < 30 * 3; n++) {
      e.touchCd = 0; e.x = 0; e.y = 0; c.tideClockT = 99; c.ebbT = 0; c.ebbWarnT = 0; c.sinkT = 99; c.shoalT = 99;
      w.player.x = 50; w.player.y = 0;
      for (const o of w.enemies) if (o.alive && o.kind !== 'hessa') o.alive = false;
      w.step({ x: 0, y: 0 });
    }
    expect(w.player.hp).toBeGreaterThanOrEqual(hp);
  });
});

describe('melee answers: the Iron Uncle (the Hammerdeep)', () => {
  type O = Q & { ondrelClock(dt: number): void; finishCast(i: number): void; gripT: number; choirT: number; anvilT: number; ondrelStage: number };
  const party = [{ cls: 'duskblade' as const, name: 'a' }, { cls: 'lumen' as const, name: 'b' }];
  function uncle(omens: string[] = []): { w: World; q: O; b: number } {
    const w = new World({ seed: 3, dungeon: 'hammerdeep', tier: 4, omens: omens as never, cls: 'duskblade', party });
    const q = w as unknown as O;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('ondrel', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    for (let k = 0; k < w.heroes.length; k++) { const p = w.heroData(k).player; p.x = k === 0 ? 50 : 0; p.y = k === 0 ? 0 : 400; }
    return { w, q, b };
  }

  it('never hurts by touch: a melee hero standing against him takes nothing between his casts and his Grip', () => {
    const { w, q, b } = uncle();
    const e = w.enemies[b];
    const p = w.heroData(0).player;
    const hp = p.hp;
    for (let n = 0; n < 30 * 3; n++) {
      e.abilityT = 99; e.touchCd = 0; e.x = 0; e.y = 0; q.gripT = 99; q.choirT = 99; q.anvilT = 99;
      p.x = 50; p.y = 0;
      for (const t of w.telegraphs) t.alive = false;
      for (const o of w.enemies) if (o.alive && o.kind !== 'ondrel') o.alive = false;
      w.step([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    }
    expect(p.hp).toBeGreaterThanOrEqual(hp);
  });

  it('his Hammer Sweep is still his when it lands, with or without Quickened (parryable, named on a loss)', () => {
    for (const omens of [[], ['quickened']]) {
      const { w, q, b } = uncle(omens);
      const e = w.enemies[b];
      e.abilityT = 0; e.x = 0; e.y = 0;
      q.runAbilities(b, 0.01);
      const t = w.telegraphs.find((x) => x.alive && x.shape === 'cone')!;
      expect(t.owner).toBe(b);
      // Run the cast out: it ends as (or before) the cone lands, and the cone must stay his.
      while (e.castId) q.runAbilities(b, 1 / 30);
      expect(t.alive && t.owner).toBe(b);
    }
  });

  it('a cast ending leaves his other marks his: the stage-3 slag bursts', () => {
    const { w, q, b } = uncle();
    const e = w.enemies[b];
    (w as unknown as { slagPatches: { x: number; y: number; tick: number; glow: number }[] }).slagPatches = [{ x: 200, y: 0, tick: 0.5, glow: 0 }];
    q.ondrelStage = 2; e.hp = e.maxHp * 0.1;
    q.ondrelClock(0.01);
    const burst = w.telegraphs.find((x) => x.alive && x.x === 200)!;
    expect(burst.owner).toBe(b);
    e.castId = 'choir'; e.castName = 'Choir of Iron';
    q.finishCast(b);
    expect(burst.owner).toBe(b);
  });
});

describe('melee answers: Cousin Fork (the Ashvents)', () => {
  type Y = Q & { twinVentT: number; scatterT: number; bellowT: number; ysSplit(i: number): void };
  const party = [{ cls: 'duskblade' as const, name: 'a' }, { cls: 'lumen' as const, name: 'b' }];

  it('never hurts by touch, nor do her two flames: a melee hero standing against her takes nothing between her casts', () => {
    for (const split of [false, true]) {
      const w = new World({ seed: 3, dungeon: 'ashvents', tier: 7, omens: [], cls: 'duskblade', party });
      const q = w as unknown as Y;
      for (const e of w.enemies) e.alive = false;
      const b = q.spawn('ysmeret', 0, 0);
      q.bossIndex = b; q.bossSpawned = true;
      if (split) q.ysSplit(b);
      const p = w.heroData(0).player;
      const hp = p.hp;
      for (let n = 0; n < 30 * 3; n++) {
        q.twinVentT = 99; q.scatterT = 99; q.bellowT = 99;
        for (const e of w.enemies) {
          if (!e.alive) continue;
          if (e.kind !== 'ysmeret') { e.alive = false; continue; }
          e.abilityT = 99; e.touchCd = 0; e.castId = '';
        }
        const f = w.enemies[b];
        p.x = f.x + 50; p.y = f.y;
        for (let k = 1; k < w.heroes.length; k++) { const o = w.heroData(k).player; o.x = f.x; o.y = f.y + 120; }
        for (const t of w.telegraphs) t.alive = false;
        w.step([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
      }
      expect(p.hp).toBeGreaterThanOrEqual(hp);
    }
  });
});
