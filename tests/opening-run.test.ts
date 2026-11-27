import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { ENEMIES } from '../sim/content/enemies';
import { FIRST_DELVE, OPENING_LINES } from '../sim/content/firstdelve';
import { OpeningCoach } from '../client/coach';
import { botChoose, botInput } from '../sim/bot';

// CP3 opening, PR 2 (docs/design/opening.md "What engineering builds" 2): the opening run itself.
type Inner = {
  hurtPlayer(amount: number, src?: number): void;
  spawn(kind: string, x: number, y: number): number;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): boolean;
  quench(): void;
  dropLoot(x: number, y: number, source: string): void;
  hallsWake(k: number): void;
  drops: { alive: boolean }[];
};
const opening = (extra: Record<string, unknown> = {}) => new World({ seed: 5, dungeon: 'kiln', tier: 1, cls: 'emberwright', firstDelve: true, halls: true, unlockLevel: 1, ...extra });
const inner = (w: World) => w as unknown as Inner;

describe('the opening run', () => {
  it("can't be lost: the hero holds at 1 health, and the blows that would have felled it are counted", () => {
    const w = opening();
    // (Second Wind, the novice aid, may heal it straight after, as in any tier 1-3 run.)
    inner(w).hurtPlayer(99999);
    expect(w.player.hp).toBeGreaterThanOrEqual(1);
    inner(w).hurtPlayer(99999);
    expect(w.player.hp).toBe(1);
    expect(w.summary().floorSaves).toBe(2);
    // Any other run still goes down.
    const b = new World({ seed: 5, dungeon: 'kiln', tier: 1, cls: 'emberwright', halls: true });
    inner(b).hurtPlayer(99999);
    expect(b.player.hp).toBeLessThanOrEqual(0);
    expect('floorSaves' in b.summary()).toBe(false);
  });

  it('has no world-boss bonus fight, no Omens and no bags from foes', () => {
    const w = opening({ worldBoss: 'Old Vorhulm', bossOmen: 'frenzy', omens: ['frenzy'] });
    expect(w.worldBoss).toBe('');
    expect(w.omens).toEqual([]);
    expect(w.relicsOn).toBe(false);
    inner(w).dropLoot(0, 0, 'elite');
    expect(inner(w).drops.some((d) => d.alive)).toBe(false);
    expect(new World({ seed: 5, dungeon: 'kiln', tier: 1, worldBoss: 'Old Vorhulm' }).worldBoss).toBe('Old Vorhulm');
  });

  it("R1's three hounds are bigger and slower, and don't lunge", () => {
    const w = opening();
    inner(w).hallsWake(0);
    const hounds = w.enemies.filter((e) => e.alive && e.kind === 'cinderhound');
    expect(hounds).toHaveLength(3);
    for (const h of hounds) {
      expect(h.def.speed).toBeCloseTo(ENEMIES.cinderhound.speed * FIRST_DELVE.hound.speed);
      expect(h.def.radius).toBeGreaterThan(ENEMIES.cinderhound.radius);
      expect(h.def.size).toBe(FIRST_DELVE.hound.size);
    }
    // The shared Cinderhound is untouched.
    expect(ENEMIES.cinderhound.size).toBeUndefined();
    const pk = w.halls!.packs[0];
    w.player.x = w.player.px = pk.x;
    w.player.y = w.player.py = pk.y + 150;
    // Kiting them round the room for 20 s: they chase the hero, but never lunge.
    let lunged = false;
    for (let k = 0; k < 60 * 20 && w.state === 'running'; k++) {
      const a = Math.floor(k / 90) * (Math.PI / 2);
      w.step({ x: Math.cos(a), y: Math.sin(a) });
      if (w.enemies.some((e) => e.alive && (e.lungeW > 0 || e.lungeD > 0))) lunged = true;
    }
    expect(lunged).toBe(false);
  });

  it("R5: a Quenched cast staggers the caster, so it takes double damage for 3 s", () => {
    const w = opening({ unlockLevel: 4 });
    const x = inner(w);
    const i = x.spawn('cinderBrute', w.player.x + 40, w.player.y);
    const e = w.enemies[i];
    x.startCast(i, 'groundPound', 'Ground Pound', 1.4, true);
    x.quench();
    expect(e.castId).toBe('');
    expect(e.staggerT).toBe(FIRST_DELVE.stagger.time);
    expect(w.events.some((ev) => ev.type === 'staggered')).toBe(true);
    const before = e.hp;
    x.damageEnemy(i, 100, false);
    expect(before - e.hp).toBeCloseTo(100 * FIRST_DELVE.stagger.taken, 0);
    // Outside the opening, a Quench stuns as before, with no stagger.
    const n = new World({ seed: 5, dungeon: 'kiln', tier: 2, cls: 'emberwright' });
    const j = inner(n).spawn('cinderBrute', n.player.x + 40, n.player.y);
    inner(n).startCast(j, 'groundPound', 'Ground Pound', 1.4, true);
    inner(n).quench();
    expect(n.enemies[j].staggerT ?? 0).toBe(0);
  });

  it('a novice bot finishes it every time, and never needs the floor more than a few times', () => {
    for (const seed of [1, 2, 3]) {
      const w = new World({ seed, dungeon: 'kiln', tier: 1, cls: 'emberwright', firstDelve: true, halls: true, unlockLevel: 1 });
      while (w.state !== 'ended' && w.time < 400) {
        if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
        w.step(botInput(w));
      }
      expect(w.summary().victory).toBe(true);
      expect(w.summary().floorSaves).toBeLessThan(5);
    }
  });
});

describe('the opening coach', () => {
  const button = () => ({ hidden: false, classList: { contains: () => false }, querySelector: () => null }) as unknown as HTMLElement;
  it('teaches move, cast, then the roll on the first red and Quench on the first blue cast', () => {
    const w = opening({ unlockLevel: 4 });
    const c = new OpeningCoach(true);
    const bar = [button(), button(), button(), button()];
    const roll = button();
    expect(c.tick(w, bar, roll)?.text).toBe('Drag anywhere to move.');
    w.player.x += 200;
    w.phase = 'fight';
    expect(c.tick(w, bar, roll)?.kind).toBe('cast');
    w.player.cds[0] = 3;
    expect(c.tick(w, bar, roll)).toBeNull();
    expect(c.step).toBe('roll');
    // The slammer's red lands near the hero.
    const t = w.telegraphs[0];
    Object.assign(t, { alive: true, kind: 'hit', shape: 'circle', x: w.player.x, y: w.player.y, r: 115 });
    const say = c.tick(w, bar, roll);
    expect(say?.text).toBe(OPENING_LINES.roll);
    expect(say?.anchor).toBe(roll);
    w.player.rollT = 0.3;
    c.tick(w, bar, roll);
    expect(c.step).toBe('quench');
    t.alive = false;
    const x = inner(w);
    const i = x.spawn('cinderBrute', w.player.x + 40, w.player.y);
    x.startCast(i, 'groundPound', 'Ground Pound', 1.4, true);
    const q = c.tick(w, bar, roll);
    expect(q?.text).toBe(OPENING_LINES.quench('Quench'));
    expect(q?.anchor).toBe(bar[3]);
    w.player.interrupts = 1;
    c.tick(w, bar, roll);
    expect(c.finished).toBe(true);
  });

  it('without F yet, it ends after the roll', () => {
    const w = opening();
    const c = new OpeningCoach(true);
    c.step = 'quench';
    expect(c.tick(w, [button(), button(), button(), button()], button())).toBeNull();
    expect(c.finished).toBe(true);
  });
});
