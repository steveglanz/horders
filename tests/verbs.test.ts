import { describe, expect, it } from 'vitest';
import { World, TICK, PARRY, LIGHT_MOTE, CHARGE, HOLD, SLAG_KIT } from '../sim/world';
import { CLASSES as CLASS_DEFS } from '../sim/content/classes';
import { MAX_HEAT } from '../sim/content/emberwright';
import { botInput } from '../sim/bot';
import { cueFor } from '../client/audio/cues';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  addTelegraph(shape: 'circle' | 'cone', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number, kind?: 'hit' | 'soak' | 'bloom', owner?: number): void;
  spawn(kind: string, x: number, y: number): number;
  makeBrittle(i: number): void;
};

/** An empty Kiln room for `cls`, every foe cleared, so only the test's own foes and marks count. */
function room(cls: ClassId): World {
  const w = new World({ seed: 3, omens: [], cls });
  for (const e of w.enemies) e.alive = false;
  return w;
}
const inner = (w: World) => w as unknown as Inner;
const ticks = (s: number) => Math.ceil(s / TICK);

describe('Bulwark Parry (1.0 CP2, hold E)', () => {
  it('a red mark landing just after the shield goes up is parried: no damage, Resolve full, the caster staggers', () => {
    const w = room('bulwark');
    const p = w.player;
    const i = inner(w).spawn('ashling', p.x + 300, p.y);
    inner(w).addTelegraph('circle', p.x, p.y, 120, 0, 0, TICK * 3, 40, 'hit', i);
    p.heat = 10;
    const hp = p.hp;
    for (let k = 0; k < 5; k++) w.step({ x: 0, y: 0, hold: 1 });
    expect(p.hp).toBe(hp);
    expect(p.heat).toBe(MAX_HEAT);
    expect(p.parries).toBe(1);
    expect(w.enemies[i].stunT).toBeGreaterThan(0);
    expect(w.shieldRaised).toBe(true);
  });

  it('raised late (after the window) the shield only blocks part; unraised the mark hits in full', () => {
    const hurt = (raiseEarly: number | null) => {
      const w = room('bulwark');
      const p = w.player;
      inner(w).addTelegraph('circle', p.x, p.y, 120, 0, 0, 1, 40);
      const hp = p.hp;
      for (let k = 0; k < ticks(1.1); k++) w.step({ x: 0, y: 0, hold: raiseEarly !== null && k * TICK >= raiseEarly ? 1 : undefined });
      return hp - p.hp;
    };
    const full = hurt(null);
    const late = hurt(0.2); // up 0.8 s before it lands: past PARRY.window
    expect(full).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(full * (1 - PARRY.block) + 1);
  });

  it('a re-raise inside PARRY.rest has no window, so tapping cannot keep one open', () => {
    const w = room('bulwark');
    const p = w.player;
    w.step({ x: 0, y: 0, hold: 1 });
    w.step({ x: 0, y: 0 });
    w.step({ x: 0, y: 0, hold: 1 });
    expect(p.parryOpen).toBe(false);
    for (let k = 0; k < ticks(PARRY.rest); k++) w.step({ x: 0, y: 0 });
    w.step({ x: 0, y: 0, hold: 1 });
    expect(p.parryOpen).toBe(true);
  });

  it('slows the Bulwark while the shield is up, and only the Bulwark holds E', () => {
    const w = room('bulwark');
    const free = w.moveSpeed;
    w.step({ x: 0, y: 0, hold: 1 });
    expect(w.moveSpeed / free).toBeCloseTo(PARRY.slow, 5);
    const e = room('emberwright');
    e.step({ x: 0, y: 0, hold: 1 });
    expect(e.player.holdSlot ?? -1).toBe(-1);
  });

  it('the Bulwark bot raises its shield for a mark about to land', () => {
    const w = room('bulwark');
    w.phase = 'fight';
    const p = w.player;
    inner(w).addTelegraph('circle', p.x, p.y, 80, 0, 0, 1.2, 30);
    expect(botInput(w).hold).toBeUndefined();
    w.telegraphs.find((t) => t.alive)!.t = 1.1;
    const a = botInput(w);
    expect(a.hold).toBe(1);
    expect(a.roll).toBeUndefined();
  });
});

describe('Lumen light motes (1.0 CP2)', () => {
  it('every few Sunmote hits drop a mote that heals a hurt hero who walks over it', () => {
    const w = room('lumen');
    const p = w.player;
    const i = inner(w).spawn('ashling', p.x + 150, p.y);
    w.enemies[i].hp = w.enemies[i].maxHp = 1e6;
    let n = 0;
    for (let k = 0; k < ticks(6) && !w.lightMotes.length; k++) { w.step({ x: 0, y: 0 }); n++; }
    expect(w.lightMotes.length).toBe(1);
    const m = w.lightMotes[0];
    // A full-health hero leaves it lying.
    p.x = m.x; p.y = m.y;
    w.step({ x: 0, y: 0 });
    expect(w.lightMotes.length).toBeGreaterThanOrEqual(1);
    p.hp = p.maxHp * 0.5;
    const hp = p.hp;
    w.step({ x: 0, y: 0 });
    expect(w.events.some((e) => e.type === 'lightMoteTaken')).toBe(true);
    expect(p.hp - hp).toBeGreaterThanOrEqual(p.maxHp * LIGHT_MOTE.heal - 0.5);
  });

  it('motes fade after LIGHT_MOTE.life', () => {
    const w = room('lumen');
    const mote = { x: w.player.x + 300, y: w.player.y, t: LIGHT_MOTE.life, by: 0 };
    w.lightMotes.push(mote);
    w.step({ x: 0, y: 0 });
    expect(w.lightMotes).toContain(mote);
    for (let k = 0; k < ticks(LIGHT_MOTE.life); k++) w.step({ x: 0, y: 0 });
    expect(w.lightMotes).not.toContain(mote);
  });
});

describe('Slagbinder charged shot (1.0 CP2, hold Q)', () => {
  const setup = () => {
    const w = room('slagbinder');
    const p = w.player;
    const i = inner(w).spawn('ashling', p.x + 200, p.y);
    const e = w.enemies[i];
    e.hp = e.maxHp = 1e6;
    return { w, p, i, e };
  };

  it('no cannon fire while charging; a full charge hits CHARGE.mult harder than a plain shot', () => {
    const plain = setup();
    for (let k = 0; k < 30 && !plain.w.events.some((x) => x.type === 'cannon'); k++) plain.w.step({ x: 0, y: 0 });
    const one = plain.e.maxHp - plain.e.hp;
    expect(one).toBeGreaterThan(0);

    const c = setup();
    c.p.volleyT = 0;
    for (let k = 0; k < ticks(CHARGE.time) + 1; k++) {
      c.w.step({ x: 0, y: 0, hold: 0 });
      expect(c.w.events.some((x) => x.type === 'cannon')).toBe(false);
    }
    expect(c.w.chargeLevel).toBe(1);
    c.w.step({ x: 0, y: 0 });
    expect(c.w.events.some((x) => x.type === 'chargedShot')).toBe(true);
    expect((c.e.maxHp - c.e.hp) / one).toBeCloseTo(CHARGE.mult, 1);
  });

  it('a tap (shorter than CHARGE.min) fires nothing extra, and HOLD.tap fits inside it', () => {
    expect(HOLD.tap).toBeLessThan(CHARGE.min);
    const c = setup();
    c.w.step({ x: 0, y: 0, hold: 0 });
    c.w.step({ x: 0, y: 0 });
    expect(c.w.events.some((x) => x.type === 'chargedShot')).toBe(false);
  });

  it('a full charge shatters a Brittle foe (and spends the Brittle); a part charge does not', () => {
    for (const full of [true, false]) {
      const c = setup();
      inner(c.w).makeBrittle(c.i);
      const hold = full ? ticks(CHARGE.time) + 1 : ticks(CHARGE.min) + 2;
      for (let k = 0; k < hold; k++) c.w.step({ x: 0, y: 0, hold: 0 });
      c.w.step({ x: 0, y: 0 });
      expect(c.w.events.some((x) => x.type === 'shatter')).toBe(full);
      expect((c.e.brittleUntil ?? 0) > c.w.time).toBe(!full);
    }
  });

  it('the gunner bot charges at a big foe and lets go at full charge', () => {
    const c = setup();
    c.w.phase = 'fight';
    c.e.def = { ...c.e.def, rank: 'elite' };
    expect(botInput(c.w).hold).toBe(0);
    c.p.holdSlot = 0;
    c.p.holdT = CHARGE.time;
    expect(botInput(c.w).hold).toBeUndefined();
    expect(SLAG_KIT.cannonRange).toBeGreaterThan(200);
  });
});

describe('every class has its verb named, with sounds', () => {
  it('names the three new verbs and gives their events cues', () => {
    expect(CLASS_DEFS.bulwark.verb?.name).toBe('Parry');
    expect(CLASS_DEFS.lumen.verb?.name).toBe('Light motes');
    expect(CLASS_DEFS.slagbinder.verb?.name).toBe('Charged shot');
    expect(cueFor({ type: 'shieldParry', x: 0, y: 0, hero: 0 }, { cls: 'bulwark', acting: 0 })?.id).toBe('shieldParry');
    expect(cueFor({ type: 'lightMoteTaken', x: 0, y: 0, hero: 0 }, { cls: 'lumen', acting: 0 })?.id).toBe('lightMote');
    expect(cueFor({ type: 'chargedShot', x1: 0, y1: 0, x2: 1, y2: 0, c: 1, hero: 0 }, { cls: 'slagbinder', acting: 0 })?.id).toBe('chargedShot');
    expect(cueFor({ type: 'shatter', x: 0, y: 0, hero: 0 }, { cls: 'slagbinder', acting: 0 })?.id).toBe('shatter');
  });
});
