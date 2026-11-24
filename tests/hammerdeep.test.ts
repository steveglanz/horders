import { describe, expect, it } from 'vitest';
import { World, ONDREL, RAID_LOOT } from '../sim/world';
import { DUNGEONS, BOUNTY_DUNGEON_IDS, partyBlocker, partyLabel } from '../sim/content/dungeon';
import { bountyFor } from '../sim/content/bounty';
import { applyRun, newHero } from '../sim/hero';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  finishCast(i: number): void;
  healAllies(x: number, y: number, r: number, amount: number): number;
  healPlayer(amount: number): number;
  anvilTarget: number;
};

/** A Bulwark + Lumen + Duskblade party standing in the Hammerdeep, with Ondrel spawned next to them. */
function party(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 4, dungeon: 'hammerdeep', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'duskblade' }] });
  const inner = w as unknown as Inner;
  const b = inner.spawn('ondrel', w.player.x + 60, w.player.y);
  return { w, inner, b };
}

describe('group dungeons', () => {
  it('the Hammerdeep is a group dungeon: solo is refused with a reason, and the label says who it needs', () => {
    expect(DUNGEONS.hammerdeep.style).toBe('group');
    expect(partyBlocker('hammerdeep', 1)).toMatch(/party of 2/);
    expect(partyBlocker('hammerdeep', 2)).toBe('');
    expect(partyBlocker('kiln', 1)).toBe('');
    expect(partyLabel('kiln', ['emberwright']).label).toMatch(/Solo friendly/);
    const g = partyLabel('hammerdeep', ['duskblade', 'lumen']);
    expect(g.label).toMatch(/tank \+ healer/);
    expect(g.missing).toEqual(['tank']);
    expect(partyLabel('hammerdeep', ['bulwark', 'lumen']).missing).toEqual([]);
    // A Slagbinder's stance decides its slot: Anvil tanks, Bellows deals damage.
    expect(partyLabel('hammerdeep', [{ cls: 'slagbinder', stance: 'anvil' }, { cls: 'lumen' }]).missing).toEqual([]);
    expect(partyLabel('hammerdeep', [{ cls: 'slagbinder', stance: 'bellows' }, { cls: 'lumen' }]).missing).toEqual(['tank']);
  });

  it('the daily bounty still draws only from the solo dungeons, in the old order', () => {
    expect(BOUNTY_DUNGEON_IDS).toEqual(['kiln', 'foundry', 'glarewell']);
    for (let day = 0; day < 60; day++) expect(bountyFor(day, 20).dungeon).not.toBe('hammerdeep');
  });

  it('Anvilfall lands on the hero it picked at wind-up, through a dodge, and Sunders them', () => {
    const { w, inner, b } = party();
    inner.use(2); // the Duskblade
    w.player.shieldT = 1; // mid-Sidestep
    const hp = w.player.hp;
    inner.use(0);
    inner.anvilTarget = 2;
    inner.startCast(b, 'anvilfall', 'Anvilfall', ONDREL.anvilCast, false);
    inner.finishCast(b);
    expect(w.hero(2).player.hp).toBeLessThan(hp);
    expect(w.hero(2).player.sunderT ?? 0).toBeGreaterThan(0);
    expect(w.hero(0).player.sunderT ?? 0).toBe(0);
  });

  it('Choir of Iron hurts every hero by a share of their health', () => {
    const { w, inner, b } = party();
    const before = w.heroes.map((_, i) => w.hero(i).player.hp);
    inner.startCast(b, 'choir', 'Choir of Iron', ONDREL.choirCast, false);
    inner.finishCast(b);
    w.heroes.forEach((_, i) => expect(w.hero(i).player.hp).toBeLessThan(before[i]));
  });

  it("Slag Grip is cleared by another hero's heal, not by your own", () => {
    const { w, inner } = party();
    w.player.slag = 3; // the Bulwark
    w.player.hp = w.player.maxHp * 0.5;
    inner.healPlayer(10);
    expect(w.player.slag).toBe(3);
    inner.use(1); // the Lumen heals the party
    const x = w.player.x;
    const y = w.player.y;
    inner.healAllies(x, y, 9999, 10);
    inner.use(0);
    expect(w.player.slag).toBe(0);
  });
});

describe('quitting a delve straight away', () => {
  it('earns no chest, moves no pity and adds no Grit', () => {
    const h = newHero();
    for (let k = 0; k < 20; k++) {
      const w = new World({ seed: k + 1, omens: [] });
      w.step({ x: 0, y: 0 });
      const r = applyRun(h, k + 1, w.summary(), false, w.runDrops, w.runEquipped);
      expect(r.items).toHaveLength(0);
    }
    expect(h.pity).toBe(0);
    expect(h.grit).toBeUndefined();
    expect(h.inventory).toHaveLength(0);
  });
});

describe('group loot (G5)', () => {
  type Kill = { killEnemy(i: number): void; spawn(kind: string, x: number, y: number): number; use(i: number): void };
  it('every hero gets their own boss item, and group dungeons add a second', () => {
    for (const [dungeon, each] of [['kiln', 1], ['hammerdeep', 2]] as const) {
      const w = new World({ seed: 9, dungeon, omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'duskblade' }] });
      const inner = w as unknown as Kill;
      const b = inner.spawn(dungeon === 'kiln' ? 'kilnMother' : 'ondrel', 0, 0);
      inner.use(2); // the Duskblade lands the killing blow
      inner.killEnemy(b);
      inner.use(0);
      for (let k = 0; k < 3; k++) expect(w.heroData(k).runDrops.length).toBe(each);
      const all = [0, 1, 2].flatMap((k) => w.heroData(k).runDrops);
      expect(all.every((it) => ['rare', 'epic', 'mythic'].includes(it.rarity))).toBe(true);
    }
  });
  it('a raid boss gives every hero an Epic and RAID_LOOT.extra more Rare-or-better items (design, 24 Nov)', () => {
    const w = new World({ seed: 9, dungeon: 'flue', tier: 9, omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'duskblade' }, { cls: 'emberwright' }] });
    const inner = w as unknown as Kill;
    const b = inner.spawn('regent', 0, 0);
    inner.killEnemy(b);
    for (let k = 0; k < 4; k++) {
      const d = w.heroData(k).runDrops;
      expect(d.length).toBe(2 + RAID_LOOT.extra);
      expect(['epic', 'mythic']).toContain(d[0].rarity);
      expect(d.every((it) => ['rare', 'epic', 'mythic'].includes(it.rarity))).toBe(true);
    }
  });
});
