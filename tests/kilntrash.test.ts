import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { KILNTRASH, KILNTRASH_ONE, packFoes } from '../sim/halls';
import { DUNGEONS, ENCOUNTERS } from '../sim/content/dungeon';

// KILNTRASH (design 25 Nov, /mnt/project-files/horders/design/halls/kiln-trash-plan.md): the Kiln map's opener packs are
// trash: twice the foes (the Rift and the Ashwall stay at one), each at 30% health, and no bag. The level stays.
type Q = { hallsWake(k: number): void; hallsClear(k: number): void };
const kiln = (seed: number, kilnTrash: boolean) => new World({ seed, dungeon: 'kiln', tier: 2, halls: true, cls: 'duskblade', kilnTrash });

describe('KILNTRASH: Kiln opener packs as trash', () => {
  it('is off unless asked for, and never touches another dungeon', () => {
    for (let seed = 1; seed <= 10; seed++) expect(kiln(seed, false).halls!.packs.some((p) => p.trash)).toBe(false);
    const f = new World({ seed: 3, dungeon: 'foundry', tier: 4, halls: true, cls: 'duskblade', kilnTrash: true });
    expect(f.halls!.packs.some((p) => p.trash)).toBe(false);
  });

  it('only opener packs off a named gate are trash, with twice the foes except the single special one', () => {
    let trash = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const on = kiln(seed, true), off = kiln(seed, false);
      on.halls!.packs.forEach((p, k) => {
        const q = off.halls!.packs[k];
        expect(p.enc).toBe(q.enc);
        const want = p.gate !== 'named' && DUNGEONS.kiln.openers.includes(p.enc);
        expect(!!p.trash, `seed ${seed} pack ${k} ${p.enc}`).toBe(want);
        if (!want) { expect(p.foes.length).toBe(q.foes.length); return; }
        trash++;
        for (const sp of ENCOUNTERS[p.enc].spawns) {
          const n = p.foes.filter((f) => f.kind === sp.kind).length;
          expect(n, `${p.enc} ${sp.kind}`).toBe(KILNTRASH_ONE.includes(sp.kind) ? sp.n : sp.n * KILNTRASH.foes);
        }
      });
    }
    expect(trash).toBeGreaterThan(30);
    // The Rift stays one; its hounds double.
    expect(packFoes(1, 0, 'riftfall', 0, 0, true).map((f) => f.kind).sort()).toEqual(['cinderhound', 'cinderhound', 'cinderhound', 'cinderhound', 'rift']);
  });

  it('a trash pack wakes at KILNTRASH.hp (30%) health per foe, and its clear gives the level but no bag', () => {
    const on = kiln(4, true), off = kiln(4, false);
    const k = on.halls!.packs.findIndex((p) => p.trash);
    const hp = (w: World) => { (w as unknown as Q).hallsWake(k); return w.enemies.filter((e) => e.alive && e.pack === k).map((e) => [e.kind, e.maxHp] as const); };
    const a = hp(on), b = hp(off);
    expect(a.length).toBeGreaterThan(b.length);
    for (const [kind, m] of a) expect(m).toBeCloseTo(b.find((x) => x[0] === kind)![1] * KILNTRASH.hp, 3);
    for (const w of [on, off]) {
      for (const e of w.enemies) e.alive = false;
      const lvl = w.player.level, bags = w.drops.filter((d) => d.alive).length;
      (w as unknown as Q).hallsClear(k);
      expect(w.player.level).toBe(lvl + 1);
      expect(w.drops.filter((d) => d.alive).length - bags).toBe(w === on ? 0 : 1);
    }
  });

  it('every clear on the trash map gives one level, trash or not (design, 25 Nov: the XP step was dropped)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = kiln(seed, true);
      const m = w.halls!;
      for (const k of (['A', 'B', 'C', 'E'] as const).map((r) => m.packs.findIndex((p) => p.role === r))) {
        const before = w.player.level;
        (w as unknown as Q).hallsClear(k);
        expect(w.player.level - before, `seed ${seed} ${m.packs[k].role}`).toBe(1);
      }
      expect(w.player.level).toBe(5);
    }
  });
});
