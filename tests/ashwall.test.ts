import { describe, expect, it } from 'vitest';
import { World, ASHWALL } from '../sim/world';
import { botInput } from '../sim/bot';
import { DUNGEONS, ENCOUNTERS } from '../sim/content/dungeon';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  runAbilities(i: number, dt: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  route: string[];
};

/** A Kiln run whose first fight is the Ashwall, with every foe cleared so a test can place its own. */
function ashwallFight(): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  inner.route[0] = 'ashwall';
  for (const e of w.enemies) e.alive = false;
  // Already in the fight, so stepping doesn't spawn the encounter's own foes.
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}

/** Damage dealt to foe i by one 100-point hit from the hero where they stand. */
function hit(w: World, inner: Inner, i: number): number {
  const e = w.enemies[i];
  e.hp = e.maxHp = 1e6;
  inner.damageEnemy(i, 100, false);
  return 1e6 - e.hp;
}

describe('Phase 16 U2: the Ashwall (the Kiln)', () => {
  it('is a Kiln opener: one Ashwall and two Ember Spitters', () => {
    expect(DUNGEONS.kiln.openers).toContain('ashwall');
    expect(ENCOUNTERS.ashwall.spawns).toEqual([{ kind: 'ashwall', n: 1 }, { kind: 'emberSpitter', n: 2 }]);
  });

  it('comes in facing the hero, and its front takes less than its side', () => {
    const { w, inner } = ashwallFight();
    const a = inner.spawn('ashwall', 200, 0);
    expect(w.enemies[a].aux).toBeCloseTo(Math.PI, 5); // toward the hero at the origin
    const front = hit(w, inner, a);
    expect(front).toBeCloseTo(100 * ASHWALL.front, 3);
    w.player.x = 200; w.player.y = 200; // round to its side
    expect(hit(w, inner, a)).toBeCloseTo(100, 3);
  });

  it('shelters a foe behind it from the front only', () => {
    const { w, inner } = ashwallFight();
    inner.spawn('ashwall', 200, 0);
    const s = inner.spawn('emberSpitter', 300, 0); // behind it, seen from the hero
    expect(hit(w, inner, s)).toBeCloseTo(100 * ASHWALL.sheltered, 3);
    // Out of the wedge behind it: full damage.
    const o = inner.spawn('emberSpitter', 200, 250);
    expect(hit(w, inner, o)).toBeCloseTo(100, 3);
    // From its side the shield isn't between them: full damage.
    w.player.x = 200; w.player.y = -300;
    expect(hit(w, inner, s)).toBeCloseTo(100, 3);
  });

  it('turns no faster than ASHWALL.turn and plants itself in front of the foe it guards', () => {
    const { w, inner } = ashwallFight();
    const a = inner.spawn('ashwall', 200, 0);
    const s = inner.spawn('emberSpitter', 260, 120);
    w.enemies[a].abilityT = w.enemies[s].abilityT = 99;
    const e = w.enemies[a];
    w.player.x = 200; w.player.y = 400; // the hero jumps to its side
    const before = e.aux;
    for (let k = 0; k < 30; k++) w.step({ x: 0, y: 0 });
    const turned = Math.abs(((e.aux - before + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    expect(turned).toBeLessThanOrEqual(ASHWALL.turn * 1.0001 + 1e-6);
    expect(turned).toBeGreaterThan(ASHWALL.turn * 0.9);
    // It walks to the hero's side of its spitter, ASHWALL.guardGap in front of it.
    const o = w.enemies[s];
    const gap = () => {
      const d = Math.hypot(w.player.x - o.x, w.player.y - o.y);
      return Math.hypot(o.x + ((w.player.x - o.x) / d) * ASHWALL.guardGap - e.x, o.y + ((w.player.y - o.y) / d) * ASHWALL.guardGap - e.y);
    };
    const g0 = gap();
    for (let k = 0; k < 150; k++) w.step({ x: 0, y: 0 });
    expect(gap()).toBeLessThan(Math.min(40, g0 * 0.4));
  });

  it('a hit its shield cut is a glance (for sound); a full hit is not', () => {
    const { w, inner } = ashwallFight();
    const a = inner.spawn('ashwall', 200, 0);
    const glances = () => w.events.filter((ev) => ev.type === 'hit').map((ev) => !!(ev as { glance?: true }).glance);
    w.events.length = 0;
    hit(w, inner, a);
    expect(glances()).toEqual([true]);
    w.events.length = 0;
    w.player.x = 200; w.player.y = 200;
    hit(w, inner, a);
    expect(glances()).toEqual([false]);
  });

  it('Shield Bash is a cone off its front when the hero is close', () => {
    const { w, inner } = ashwallFight();
    const a = inner.spawn('ashwall', 80, 0);
    w.enemies[a].abilityT = 0;
    inner.runAbilities(a, 0.01);
    expect(w.enemies[a].castId).toBe('shieldBash');
    const t = w.telegraphs.find((q) => q.alive && q.owner === a)!;
    expect(t.shape).toBe('cone');
    expect(t.angle).toBeCloseTo(Math.PI, 5);
  });

  it('a melee bot in front of an Ashwall walks round it', () => {
    const w0 = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'bulwark' });
    const inner = w0 as unknown as Inner;
    inner.route[0] = 'ashwall';
    for (const e of w0.enemies) e.alive = false;
    (w0 as unknown as { phase: string }).phase = 'fight';
    w0.player.x = 0; w0.player.y = 0;
    const w = w0;
    inner.spawn('ashwall', 200, 10);
    const inp = botInput(w, 1);
    // Off its front a little to +y, so the bot keeps going that way round (away from y = 0).
    expect(inp.y).toBeLessThan(0);
  });
});
