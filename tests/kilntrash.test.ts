import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { KILNTRASH, KILNTRASH_ONE, TRASH_BETA, TRASH_ON, packFoes } from '../sim/halls';
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

  it('KILNTRASH.named (0.8): the other packs\' foes get that share of health on a trash map, never off it', () => {
    expect(KILNTRASH.named).toBe(0.8);
    {
      for (let seed = 1; seed <= 6; seed++) {
        const on = kiln(seed, true), base = kiln(seed, false);
        const k = on.halls!.packs.findIndex((p) => !p.trash && p.foes.length > 0);
        const hp = (w: World) => { (w as unknown as Q).hallsWake(k); return w.enemies.filter((e) => e.alive && e.pack === k).map((e) => e.maxHp); };
        const a = hp(on), b = hp(base);
        expect(a.length).toBe(b.length);
        a.forEach((m, j) => expect(m, `seed ${seed}`).toBeCloseTo(b[j] * 0.8, 3));
      }
    }
  });
});

// Trash rollout (design 25 Nov, /mnt/project-files/horders/design/halls/trash-rollout-plan.md): the Foundry is next,
// behind ?trashbeta=1 (TRASH_BETA), with the Kiln's numbers. Its single special foes stay at one.
describe('Trash rollout: the Drowned Foundry behind ?trashbeta', () => {
  const foundry = (seed: number, more: { kilnTrash?: boolean; trashBeta?: boolean }) => new World({ seed, dungeon: 'foundry', tier: 4, halls: true, cls: 'duskblade', ...more });
  it('is on only with trashBeta, and the Kiln still needs only kilnTrash', () => {
    expect(TRASH_ON).toEqual(['kiln']);
    expect(TRASH_BETA).toEqual(['foundry']);
    for (let seed = 1; seed <= 10; seed++) {
      expect(foundry(seed, { kilnTrash: true }).halls!.packs.some((p) => p.trash)).toBe(false);
      expect(foundry(seed, { trashBeta: true }).halls!.packs.some((p) => p.trash), `seed ${seed}`).toBe(true);
      expect(new World({ seed, dungeon: 'kiln', tier: 2, halls: true, cls: 'duskblade', trashBeta: true }).halls!.packs.some((p) => p.trash)).toBe(false);
    }
  });

  it('only its opener packs off a named gate are trash, with twice the foes except the single special one', () => {
    let trash = 0;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const on = foundry(seed, { trashBeta: true }), off = foundry(seed, {});
      on.halls!.packs.forEach((p, k) => {
        const q = off.halls!.packs[k];
        expect(p.enc).toBe(q.enc);
        const want = p.gate !== 'named' && DUNGEONS.foundry.openers.includes(p.enc);
        expect(!!p.trash, `seed ${seed} pack ${k} ${p.enc}`).toBe(want);
        if (!want) { expect(p.foes.length).toBe(q.foes.length); return; }
        trash++;
        seen.add(p.enc);
        for (const sp of ENCOUNTERS[p.enc].spawns) {
          const n = p.foes.filter((f) => f.kind === sp.kind).length;
          expect(n, `${p.enc} ${sp.kind}`).toBe(KILNTRASH_ONE.includes(sp.kind) ? sp.n : sp.n * KILNTRASH.foes);
        }
      });
    }
    expect(trash).toBeGreaterThan(40);
    expect(seen.size).toBeGreaterThanOrEqual(5);
    // The list design checks: per opener, what a trash pack holds.
    const held = (enc: Parameters<typeof packFoes>[2]) => packFoes(1, 0, enc, 0, 0, true).map((f) => f.kind).sort();
    expect(held('twins')).toEqual(['emberTwin', 'emberTwin', 'emberTwin', 'emberTwin']);
    expect(held('glass')).toEqual(['cinderhound', 'cinderhound', 'cinderhound', 'cinderhound', 'glassWarden']);
    expect(held('crawlers')).toEqual(['cinderhound', 'cinderhound', 'cinderhound', 'cinderhound', 'sluiceCrawler']);
    expect(held('riftfall')).toEqual(['cinderhound', 'cinderhound', 'cinderhound', 'cinderhound', 'rift']);
    expect(held('glassSpitters')).toEqual(['emberSpitter', 'emberSpitter', 'emberSpitter', 'emberSpitter', 'glassWarden']);
    expect(held('crawlerCharge')).toEqual(['ashbuck', 'ashbuck', 'cinderhound', 'cinderhound', 'sluiceCrawler']);
    expect(held('ballast')).toEqual(['ballast', 'cinderhound', 'cinderhound', 'cinderhound', 'cinderhound']);
  });

  it('a trash pack wakes at 30% health per foe and drops no bag; the other packs get 80%', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const on = foundry(seed, { trashBeta: true }), off = foundry(seed, {});
      for (const k of [on.halls!.packs.findIndex((p) => p.trash), on.halls!.packs.findIndex((p) => !p.trash && p.foes.length > 0)]) {
        const share = on.halls!.packs[k].trash ? KILNTRASH.hp : KILNTRASH.named;
        const hp = (w: World) => { (w as unknown as Q).hallsWake(k); return w.enemies.filter((e) => e.alive && e.pack === k).map((e) => [e.kind, e.maxHp] as const); };
        const a = hp(on), b = hp(off);
        for (const [kind, m] of a) expect(m, `seed ${seed} ${kind}`).toBeCloseTo(b.find((x) => x[0] === kind)![1] * share, 3);
        for (const w of [on, off]) for (const e of w.enemies) e.alive = false;
      }
      const k = on.halls!.packs.findIndex((p) => p.trash);
      const bags = on.drops.filter((d) => d.alive).length, lvl = on.player.level;
      (on as unknown as Q).hallsClear(k);
      expect(on.drops.filter((d) => d.alive).length).toBe(bags);
      expect(on.player.level).toBe(lvl + 1);
    }
  });
});
