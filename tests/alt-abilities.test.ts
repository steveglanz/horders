import { describe, expect, it } from 'vitest';
import { ALT_KIT, World } from '../sim/world';
import { ALT_ABILITIES, ALT_OPTIONS, ALT_UNLOCK_LEVEL, CLASSES, CLASS_IDS, cleanAlts } from '../sim/content/classes';
import { TALENTS } from '../sim/content/emberwright';
import { altsOn, altsPicked, CHARACTER_KEYS } from '../sim/hero';
import type { ClassId } from '../sim/content/emberwright';
import { botCast } from '../sim/bot';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  rebuildHash(): void;
  hurtPlayer(amount: number, src?: number, unblockable?: boolean): void;
  castAlt(input: { x: number; y: number }, slot?: number): void;
  updateAlt(dt: number): void;
  rollDraft(): void;
  verbHit: boolean;
  time: number;
};

function world(cls: ClassId, rest: ClassId[] = [], alt = true): { w: World; inner: Inner } {
  const w = new World({ seed: 5, cls, alt, tier: 4, omens: [], party: rest.length ? rest.map((c) => ({ cls: c, alt })) : undefined });
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

describe('ability options', () => {
  it('each class swaps exactly one non-interrupt slot, and the bar shows the option', () => {
    for (const cls of CLASS_IDS) {
      const a = ALT_ABILITIES[cls];
      expect(a.slot).toBeLessThan(3);
      expect(CLASSES[cls].abilities[a.slot].name).toBe(a.replaces);
      const { w } = world(cls);
      expect(w.abilities[a.slot].name).toBe(a.def.name);
      expect(w.isAlt(a.slot)).toBe(true);
      expect(w.abilities.filter((_, k) => k !== a.slot).map((d) => d.name)).toEqual(CLASSES[cls].abilities.filter((_, k) => k !== a.slot).map((d) => d.name));
      expect(world(cls, [], false).w.abilities[a.slot].name).toBe(a.replaces);
    }
  });

  it('is saved per character and only applies from level 8', () => {
    expect(CHARACTER_KEYS).toContain('alt');
    expect(CHARACTER_KEYS).toContain('alts');
    // Old saves: `alt: true` reads as the level-8 option.
    expect(altsOn('lumen', { alt: true, level: ALT_UNLOCK_LEVEL - 1 })).toEqual([]);
    expect(altsOn('lumen', { alt: true, level: ALT_UNLOCK_LEVEL })).toEqual(['glowPool']);
    expect(altsOn('lumen', { alt: false, level: 20 })).toEqual([]);
  });

  it('options come at levels 8, 12 and 16, each for its own non-interrupt slot', () => {
    for (const cls of CLASS_IDS) {
      const l = ALT_OPTIONS[cls];
      expect(l[0].level).toBe(ALT_UNLOCK_LEVEL);
      expect(new Set(l.map((o) => o.slot)).size).toBe(l.length);
      l.forEach((o, k) => {
        expect(o.slot).toBeLessThan(3);
        expect(o.level).toBe(8 + 4 * k);
        expect(CLASSES[cls].abilities[o.slot].name).toBe(o.replaces);
        expect(o.def.key).toBe(CLASSES[cls].abilities[o.slot].key);
      });
    }
    expect(ALT_OPTIONS.duskblade.map((o) => o.id)).toEqual(['hamstring', 'wideCut', 'quicken']);
  });

  it('each option unlocks at its own level, and foreign or doubled picks are dropped', () => {
    const h = { alts: ['hamstring', 'wideCut', 'quicken'] as never, level: 12 };
    expect(altsOn('duskblade', h)).toEqual(['hamstring', 'wideCut']);
    expect(altsOn('duskblade', { ...h, level: 16 })).toEqual(['hamstring', 'wideCut', 'quicken']);
    expect(altsPicked('lumen', h)).toEqual([]);
    expect(cleanAlts('duskblade', ['glowPool', 'wideCut', 'wideCut'])).toEqual(['wideCut']);
    const w = new World({ seed: 5, cls: 'duskblade', alts: ['wideCut', 'quicken'], tier: 4, omens: [] });
    expect(w.abilities.map((d) => d.name)).toEqual(['Rending Dash', 'Quicken', 'Wide Cut', 'Kick']);
    expect(w.isAlt(0)).toBe(false);
    expect(new World({ seed: 5, cls: 'lumen', alts: ['wideCut'], tier: 4, omens: [] }).player.alts).toBeUndefined();
  });

  it('Wide Cut hits and bleeds every foe around the Duskblade, and Quicken speeds its swings', () => {
    const w = new World({ seed: 5, cls: 'duskblade', alts: ['wideCut', 'quicken'], tier: 4, omens: [] });
    for (const e of w.enemies) e.alive = false;
    const inner = w as unknown as Inner;
    const a = inner.spawn('slagling', w.player.x + 100, w.player.y);
    const b = inner.spawn('slagling', w.player.x - 100, w.player.y + 30);
    const far = inner.spawn('slagling', w.player.x + 400, w.player.y);
    for (const i of [a, b, far]) w.enemies[i].hp = w.enemies[i].maxHp = 1e6;
    inner.rebuildHash();
    inner.castAlt({ x: 0, y: 0 }, 2);
    for (const i of [a, b]) {
      expect(w.enemies[i].hp).toBeLessThan(1e6);
      expect(w.enemies[i].burnT).toBeGreaterThan(0);
    }
    expect(w.enemies[far].hp).toBe(1e6);
    const cd = w.swingCooldown;
    inner.castAlt({ x: 0, y: 0 }, 1);
    expect(w.swingCooldown).toBeCloseTo(cd / (1 + ALT_KIT.quickenHaste));
    inner.time += ALT_KIT.quickenTime + 0.1;
    expect(w.swingCooldown).toBeCloseTo(cd);
  });

  it('Clout hits one foe hard and mends the Bulwark; Gather pulls the pack in and cuts damage taken', () => {
    const w = new World({ seed: 5, cls: 'bulwark', alts: ['clout', 'gather'], tier: 4, omens: [] });
    for (const e of w.enemies) e.alive = false;
    const inner = w as unknown as Inner;
    expect(w.abilities.map((d) => d.name)).toEqual(['Clout', 'Gather', 'Anvil Skin', 'Shield Toss']);
    const t = inner.spawn('slagling', w.player.x + 60, w.player.y);
    w.enemies[t].hp = w.enemies[t].maxHp = 1e6;
    inner.rebuildHash();
    w.player.hp = w.player.maxHp * 0.5;
    const h0 = w.player.hp;
    inner.castAlt({ x: 0, y: 0 }, 0);
    const dealt = 1e6 - w.enemies[t].hp;
    expect(dealt).toBeGreaterThan(0);
    expect(w.player.hp - h0).toBeCloseTo(dealt * ALT_KIT.cloutMend);
    expect(w.enemies[t].stunT).toBeGreaterThanOrEqual(ALT_KIT.cloutStun);
    const near = inner.spawn('slagling', w.player.x + 220, w.player.y);
    const far = inner.spawn('slagling', w.player.x + 600, w.player.y);
    for (const i of [near, far]) w.enemies[i].hp = w.enemies[i].maxHp = 1e6;
    inner.rebuildHash();
    const b0 = w.player.hp;
    inner.hurtPlayer(20, -1);
    const plain = b0 - w.player.hp;
    inner.castAlt({ x: 0, y: 0 }, 1);
    expect(Math.hypot(w.enemies[near].x - w.player.x, w.enemies[near].y - w.player.y)).toBeLessThan(80);
    expect(w.enemies[far].x - w.player.x).toBeCloseTo(600);
    const hp = w.player.hp;
    inner.hurtPlayer(20, -1);
    expect(hp - w.player.hp).toBeCloseTo(plain * (1 - ALT_KIT.gatherCut));
  });

  it('never drafts talents for the replaced ability', () => {
    for (const cls of CLASS_IDS) {
      const slot = ALT_ABILITIES[cls].slot;
      const { w, inner } = world(cls);
      for (let n = 0; n < 40; n++) {
        inner.rollDraft();
        for (const c of w.choices) {
          const def = TALENTS[c.id as keyof typeof TALENTS];
          if (def) expect(def.ability === slot).toBe(false);
        }
      }
    }
  });

  it('Ember Ward stops a blow and burns the attacker, but not Glare or an unblockable tick', () => {
    const { w, inner } = world('emberwright');
    const src = inner.spawn('cinderBrute', w.player.x + 50, w.player.y);
    inner.rebuildHash();
    inner.castAlt({ x: 0, y: 0 });
    const ward = w.player.maxHp * ALT_KIT.emberWardShare;
    expect(w.player.plate).toBeCloseTo(ward);
    let hp = w.player.hp;
    inner.hurtPlayer(10, src);
    expect(w.player.hp).toBeCloseTo(hp);
    expect(w.enemies[src].burnT).toBeGreaterThan(0);
    hp = w.player.hp;
    inner.hurtPlayer(10, -1, true);
    expect(hp - w.player.hp).toBeCloseTo(10);
    hp = w.player.hp;
    inner.verbHit = true;
    inner.hurtPlayer(10, -1);
    inner.verbHit = false;
    expect(hp - w.player.hp).toBeCloseTo(10);
    // It runs out.
    inner.time += ALT_KIT.emberWardTime + 0.1;
    inner.updateAlt(1 / 30);
    expect(w.player.plate).toBe(0);
  });

  it('Hamstring slows normal foes by half and bosses by at most a fifth', () => {
    const { w, inner } = world('duskblade');
    const normal = inner.spawn('slagling', w.player.x + 30, w.player.y);
    const big = inner.spawn('cinderBrute', w.player.x + 40, w.player.y + 20);
    w.enemies[normal].hp = w.enemies[big].hp = 1e6;
    inner.rebuildHash();
    inner.castAlt({ x: 0, y: 0 });
    expect(w.enemies[normal].slowMult).toBeCloseTo(ALT_KIT.slowNormal);
    expect(w.enemies[big].slowMult).toBeCloseTo(ALT_KIT.slowBig);
  });

  it('Muster cuts damage for heroes near the Bulwark in a party, and mends it alone', () => {
    const { w, inner } = world('bulwark', ['lumen']);
    const ally = w.heroes[1].player;
    ally.x = w.player.x + 100;
    ally.y = w.player.y;
    inner.castAlt({ x: 0, y: 0 });
    inner.use(1);
    const hp = w.player.hp;
    inner.hurtPlayer(20, -1);
    expect(hp - w.player.hp).toBeCloseTo(20 * (1 - ALT_KIT.cryCut));
    inner.use(0);
    const solo = world('bulwark');
    solo.w.player.hp = solo.w.player.maxHp * 0.5;
    solo.inner.castAlt({ x: 0, y: 0 });
    const h0 = solo.w.player.hp;
    solo.inner.updateAlt(1);
    expect(solo.w.player.hp - h0).toBeCloseTo((solo.w.player.maxHp * ALT_KIT.cryHeal) / ALT_KIT.cryTime);
  });

  it('Glow Pool heals an ally in it but never clears Slag Grip', () => {
    const { w, inner } = world('lumen', ['bulwark']);
    const ally = w.heroes[1].player;
    ally.x = w.player.x + 20;
    ally.y = w.player.y;
    ally.hp = ally.maxHp * 0.5;
    ally.slag = 2;
    inner.castAlt({ x: 0, y: 0 });
    const h0 = ally.hp;
    // Two pulses a second.
    for (let k = 0; k < 32; k++) inner.updateAlt(1 / 30);
    expect(ally.hp - h0).toBeGreaterThan(ALT_KIT.wellHeal * 0.95);
    expect(ally.hp - h0).toBeLessThan(ALT_KIT.wellHeal * 1.1);
    expect(ally.slag).toBe(2);
  });

  it('Cinder Sump slows foes standing in it', () => {
    const { w, inner } = world('slagbinder');
    const e = inner.spawn('slagling', w.player.x + 150, w.player.y);
    w.enemies[e].hp = 1e6;
    inner.rebuildHash();
    inner.castAlt({ x: 0, y: 0 });
    inner.updateAlt(1 / 30);
    expect(w.enemies[e].slowMult).toBeCloseTo(ALT_KIT.pitSlowNormal);
  });

  it('the bot presses the option in a real run', () => {
    for (const cls of CLASS_IDS) {
    for (const o of ALT_OPTIONS[cls]) {
      const w = new World({ seed: 3, cls, alts: [o.id], tier: 4, omens: [] });
      const slot = o.slot;
      let used = false;
      for (let n = 0; n < 30 * 120 && w.state !== 'ended' && !used; n++) {
        if (w.state === 'draft') { w.choose(0); continue; }
        const before = w.player.cds[slot];
        const c = botCast(w);
        w.step({ x: 0, y: 0, cast: c });
        if (c === slot && w.player.cds[slot] > before) used = true;
      }
      expect(used, o.id).toBe(true);
    }
    }
  });
});
