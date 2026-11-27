import { describe, expect, it } from 'vitest';
import { World, ROLL, TICK, OVERHEAT } from '../sim/world';
import { CLASSES as CLASS_DEFS } from '../sim/content/classes';
import { botInput } from '../sim/bot';
import { cueFor } from '../client/audio/cues';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  addTelegraph(shape: 'circle' | 'cone', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number, kind?: 'hit' | 'soak' | 'bloom', owner?: number): void;
};

const CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];

/** An empty Kiln room for `cls`, every foe cleared, so only the test's own telegraphs can hurt. */
function room(cls: ClassId): World {
  const w = new World({ seed: 3, omens: [], cls });
  for (const e of w.enemies) e.alive = false;
  return w;
}

describe('dodge roll for every class (1.0 CP2 grey box)', () => {
  it('rolls ROLL.dist the way the stick points, then needs ROLL.cd to recharge', () => {
    for (const cls of CLASSES) {
      const w = room(cls);
      const x0 = w.player.x;
      w.step({ x: 1, y: 0, roll: true });
      expect(w.events.some((e) => e.type === 'roll')).toBe(true);
      for (let k = 0; k < Math.ceil(ROLL.time / TICK); k++) w.step({ x: 0, y: 0 });
      expect(w.player.x - x0, cls).toBeGreaterThan(ROLL.dist * 0.95);
      expect(w.player.x - x0, cls).toBeLessThan(ROLL.dist * 1.05);
      expect(w.rollReady).toBe(false);
      w.step({ x: 0, y: 0, roll: true });
      expect(w.events.some((e) => e.type === 'roll'), 'no second roll before the recharge').toBe(false);
      for (let k = 0; k < Math.ceil(ROLL.cd / TICK); k++) w.step({ x: 0, y: 0 });
      expect(w.rollReady).toBe(true);
    }
  });

  it('a red mark that lands mid-roll does no damage; standing still in it does', () => {
    for (const roll of [true, false]) {
      const w = room('emberwright');
      const p = w.player;
      // A wide circle the roll can't leave in time, landing two ticks after the press.
      (w as unknown as Inner).addTelegraph('circle', p.x, p.y, 400, 0, 0, TICK * 2, 30);
      const hp = p.hp;
      w.step({ x: 1, y: 0, roll });
      for (let k = 0; k < 3; k++) w.step({ x: 0, y: 0 });
      if (roll) {
        expect(w.player.hp).toBe(hp);
        expect(w.player.rolled).toBe(1);
      } else expect(w.player.hp).toBeLessThan(hp);
    }
  });

  it('bots roll on red: inside a mark about to land, with the roll ready', () => {
    const w = room('bulwark');
    const p = w.player;
    (w as unknown as Inner).addTelegraph('circle', p.x, p.y, 80, 0, 0, 1.2, 30);
    // Early on, the bot walks out; it doesn't burn the roll.
    expect(botInput(w).roll).toBeUndefined();
    w.telegraphs.find((t) => t.alive)!.t = 1.1;
    const a = botInput(w);
    expect(a.roll).toBe(true);
    expect(Math.hypot(a.x, a.y)).toBeGreaterThan(0.5);
    // A gold soak is never rolled out of.
    const s = room('bulwark');
    (s as unknown as Inner).addTelegraph('circle', s.player.x, s.player.y, 80, 0, 0, 0.1, 30, 'soak');
    expect(botInput(s).roll).toBeUndefined();
  });

  it('has a sound of its own', () => {
    const cue = cueFor({ type: 'roll', x: 0, y: 0, angle: 0, hero: 0 }, { cls: 'lumen', acting: 0 });
    expect(cue?.id).toBe('dodgeRoll');
  });
});

type Verbs = {
  spawn(kind: string, x: number, y: number): number;
  addHeat(v: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
};

describe('signature verbs (1.0 CP2 grey box)', () => {
  it('Overheat: the Emberwright\'s fire doubles from 80 Heat, and full Heat in a fight scorches and vents', () => {
    const w = room('emberwright');
    const p = w.player;
    p.heat = OVERHEAT.from - 1;
    const cool = w.dmgMult;
    p.heat = OVERHEAT.from;
    expect(w.overheated).toBe(true);
    expect(w.dmgMult / cool).toBeCloseTo(OVERHEAT.mult, 5);
    // Out of a fight Heat just fills.
    p.heat = 99;
    w.phase = 'intro';
    (w as unknown as Verbs).addHeat(5);
    expect(p.heat).toBe(100);
    w.phase = 'fight';
    p.heat = 99;
    const hp = p.hp;
    (w as unknown as Verbs).addHeat(5);
    expect(p.heat).toBe(OVERHEAT.vent);
    expect(hp - p.hp).toBeCloseTo(p.maxHp * OVERHEAT.scorch, 3);
    expect(w.events.some((e) => e.type === 'overheat')).toBe(true);
    // Other classes have no Overheat.
    const b = room('bulwark');
    b.player.heat = 95;
    expect(b.overheated).toBe(false);
  });

  it('Backstab: a Cutwick hit from behind always crits, and a kill from behind readies Rending Dash', () => {
    const w = room('duskblade');
    const v = w as unknown as Verbs;
    const p = w.player;
    const i = v.spawn('ashling', p.x + 40, p.y);
    const e = w.enemies[i];
    // Facing the hero: no sure crit.
    e.face = Math.PI;
    expect(w.behindFoe(e)).toBe(false);
    // Facing away: every hit crits.
    e.face = 0;
    expect(w.behindFoe(e)).toBe(true);
    for (let k = 0; k < 5; k++) {
      w.events.length = 0;
      e.hp = e.maxHp = 1e6;
      v.damageEnemy(i, 1, true);
      expect(w.events.find((x) => x.type === 'hit')).toMatchObject({ crit: true });
      expect(w.events.some((x) => x.type === 'backstab')).toBe(true);
    }
    p.cds[0] = 4;
    e.hp = 1;
    v.damageEnemy(i, 10, true);
    expect(e.alive).toBe(false);
    expect(p.cds[0]).toBe(0);
    // Other classes don't backstab.
    const o = room('emberwright');
    const j = (o as unknown as Verbs).spawn('ashling', o.player.x + 40, o.player.y);
    o.enemies[j].face = 0;
    o.enemies[j].hp = o.enemies[j].maxHp = 1e6;
    (o as unknown as Verbs).damageEnemy(j, 1, true);
    expect(o.events.some((x) => x.type === 'backstab')).toBe(false);
  });

  it('foes turn toward where they move, slowly enough that a dash through lands behind them', () => {
    const w = room('duskblade');
    const p = w.player;
    const i = (w as unknown as Verbs).spawn('ashling', p.x + 60, p.y);
    const e = w.enemies[i];
    e.face = 0;
    // The hero jumps behind it; it needs more than one tick to turn round.
    w.step({ x: 0, y: 0 });
    expect(Math.abs(e.face!)).toBeLessThan(Math.PI / 2);
  });

  it('names each built verb in the class tip, with a sound for each', () => {
    expect(CLASS_DEFS.emberwright.verb?.name).toBe('Overheat');
    // Not 'Backstab', a WoW Rogue ability (rename-map section 4).
    expect(CLASS_DEFS.duskblade.verb?.name).toBe('Snip');
    expect(cueFor({ type: 'overheat', x: 0, y: 0, hero: 0 }, { cls: 'emberwright', acting: 0 })?.id).toBe('overheatScorch');
    expect(cueFor({ type: 'backstab', x: 0, y: 0, hero: 0 }, { cls: 'duskblade', acting: 0 })?.id).toBe('backstab');
  });
});
