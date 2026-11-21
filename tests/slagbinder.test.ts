import { describe, expect, it } from 'vitest';
import { World, SLAG_KIT, Stance } from '../sim/world';
import { TALENTS } from '../sim/content/emberwright';
import { CLASSES } from '../sim/content/classes';
import { roleOf } from '../sim/content/dungeon';
import { mythicPool, weaponFxFor, WEAPON_NAMES } from '../sim/content/items';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  rebuildHash(): void;
  hurtPlayer(amount: number, src?: number, unblockable?: boolean): void;
  damageEnemy(i: number, amount: number, canCrit: boolean, silent?: boolean, forceCrit?: boolean): void;
  moltenPlating(): void;
  interpose(input: { x: number; y: number }): void;
  coolingShell(): void;
  updatePlates(): void;
  quench(): void;
  bossIndex: number;
  time: number;
};

/** A world for `cls` with no foes alive (a party if `rest` is given). */
function world(cls: ClassId, rest: ClassId[] = [], stance?: Stance): { w: World; inner: Inner } {
  const w = new World({ seed: 5, cls, stance, tier: 4, omens: [], party: rest.length ? rest.map((c) => ({ cls: c })) : undefined });
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

describe('Slagbinder (fifth class)', () => {
  it('has a full class: four abilities, three branches with two capstones, weapon effects, Mythics and weapon names', () => {
    expect(CLASSES.slagbinder.abilities).toHaveLength(4);
    for (const b of ['forge', 'clinker', 'crust']) {
      const defs = Object.values(TALENTS).filter((d) => d.branch === b);
      expect(defs.every((d) => d.cls === 'slagbinder')).toBe(true);
      expect(defs.filter((d) => d.capstone)).toHaveLength(2);
    }
    // An Epic weapon drop rolls a real weapon effect (weaponFxFor would be undefined with none).
    expect(weaponFxFor('slagbinder', 'i7')).toBeDefined();
    expect(mythicPool('slagbinder')).toContain('moltenCore');
    expect(WEAPON_NAMES.slagbinder).toHaveLength(4);
  });

  it('stance sets the party role and threat: Anvil tanks, Bellows (the default) fills a damage slot', () => {
    expect(roleOf('slagbinder', 'anvil')).toBe('tank');
    expect(roleOf('slagbinder', 'bellows')).toBe('damage');
    expect(roleOf('slagbinder')).toBe('damage');
    expect(world('slagbinder').w.player.stance).toBe('bellows');
    expect(world('slagbinder', [], 'anvil').w.threatMult).toBe(4);
    expect(world('slagbinder').w.threatMult).toBe(SLAG_KIT.bellowsThreat);
    // Other classes carry no stance.
    expect(world('bulwark').w.player.stance).toBeUndefined();
  });

  it('Molten Plating wards you, and bursts on nearby foes when it breaks', () => {
    const { w, inner } = world('slagbinder');
    const e = w.enemies[inner.spawn('cinderBrute', w.player.x + 60, w.player.y)];
    e.hp = 1e6;
    inner.rebuildHash();
    inner.moltenPlating();
    const plate = w.player.maxHp * SLAG_KIT.plateShare;
    expect(w.player.plate).toBeCloseTo(plate);
    const hp = w.player.hp;
    inner.hurtPlayer(plate + 10);
    expect(w.player.hp).toBeCloseTo(hp - 10, 0);
    // Plating stops blows, not unblockable ticks.
    expect(w.player.plate).toBe(0);
    const before = e.hp;
    inner.updatePlates();
    expect(e.hp).toBeLessThan(before);
    expect(w.player.plateUntil).toBeUndefined();
  });

  it('Molten Plating never soaks an unblockable tick', () => {
    const { w, inner } = world('slagbinder');
    inner.moltenPlating();
    const plate = w.player.plate ?? 0;
    const hp = w.player.hp;
    inner.hurtPlayer(10, -1, true);
    expect(w.player.plate).toBeCloseTo(plate);
    expect(hp - w.player.hp).toBeCloseTo(10);
  });

  it('Brittle makes a foe take 15% more damage from everyone', () => {
    const { w, inner } = world('emberwright');
    const e = w.enemies[inner.spawn('cinderBrute', w.player.x + 100, w.player.y)];
    e.hp = 1e6;
    inner.damageEnemy(w.enemies.indexOf(e), 100, false);
    const plain = 1e6 - e.hp;
    e.hp = 1e6;
    e.brittleUntil = w.time + 5;
    inner.damageEnemy(w.enemies.indexOf(e), 100, false);
    expect(1e6 - e.hp).toBeCloseTo(plain * SLAG_KIT.brittleMult);
  });

  it('Interpose takes most of a direct hit on the covered ally, but never a percent tick or an unsourced hit', () => {
    const { w, inner } = world('slagbinder', ['lumen']);
    const ally = w.heroes[1].player;
    ally.x = w.player.x + 200;
    ally.y = w.player.y;
    ally.hp = ally.maxHp * 0.4;
    const src = inner.spawn('cinderBrute', ally.x + 50, ally.y);
    inner.rebuildHash();
    inner.interpose({ x: 0, y: 0 });
    expect(ally.interposeBy).toBe(0);
    const me = w.player;
    me.shieldT = 0;
    const myHp = me.hp;
    inner.use(1);
    const hp0 = w.player.hp;
    inner.hurtPlayer(20, src);
    expect(hp0 - w.player.hp).toBeCloseTo(20 * (1 - SLAG_KIT.interposeShare));
    // An unblockable percent tick and an unsourced telegraph hit stay on the ally.
    const hp1 = w.player.hp;
    inner.hurtPlayer(10, src, true);
    inner.hurtPlayer(5);
    expect(hp1 - w.player.hp).toBeCloseTo(15);
    inner.use(0);
    expect(myHp - me.hp).toBeCloseTo(20 * SLAG_KIT.interposeShare * (1 - SLAG_KIT.interposeCut));
  });

  it('Cooling Shell cuts damage and makes the attacker Brittle', () => {
    const { w, inner } = world('slagbinder');
    const src = inner.spawn('cinderBrute', w.player.x + 50, w.player.y);
    inner.coolingShell();
    const hp = w.player.hp;
    inner.hurtPlayer(20, src);
    expect(hp - w.player.hp).toBeCloseTo(20 * (1 - SLAG_KIT.shellCut));
    expect(w.enemies[src].brittleUntil ?? 0).toBeGreaterThan(w.time);
  });

  it('co-op Clinker with nothing to interrupt makes the boss Brittle, and an Anvil takes the boss back', () => {
    const { w, inner } = world('slagbinder', ['duskblade'], 'anvil');
    const b = inner.spawn('ondrel', w.player.x + 200, w.player.y);
    inner.bossIndex = b;
    inner.rebuildHash();
    inner.quench();
    expect(w.enemies[b].brittleUntil ?? 0).toBeGreaterThan(w.time);
    expect(w.bossTarget).toBe(0);
  });
});
