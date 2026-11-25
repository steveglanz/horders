import { describe, expect, it } from 'vitest';
import { SLAG_KIT, World } from '../sim/world';
import { newHero, pointsAvailable, refundStatPoints, resetTree, spendPoint, loadoutFrom, usesTree } from '../sim/hero';
import { TREE, TREE_BUILDS, TREE_CLASSES, TREE_KEYSTONE_POINTS, TREE_NODES, buildPoints, canTakeNode, treeOf } from '../sim/content/trees';
import { BRANCH_NAMES } from '../sim/content/emberwright';

type Inner = { spawn(kind: string, x: number, y: number): number; bulwarkMitigate(raw: number, src: number): number };

describe('character trees (class progression brief)', () => {
  it('no class uses the tree yet: it stays behind its check', () => {
    expect(TREE_CLASSES).toEqual([]);
  });

  it.each([
    ['bulwark', ['bastion', 'retribution', 'vanguard']],
    ['duskblade', ['bloodletting', 'tempo', 'guard']],
    ['emberwright', ['wildfire', 'kindling', 'ashguard']],
    ['lumen', ['dawn', 'grace', 'choir']],
    ['slagbinder', ['forge', 'clinker', 'crust']],
  ] as const)('the %s tree has 3 nodes and a keystone in each of its run-draft branches', (cls, branches) => {
    const nodes = treeOf(cls);
    expect(nodes).toHaveLength(12);
    expect(Object.keys(TREE_BUILDS[cls]!).sort()).toEqual([...branches].sort());
    for (const b of branches) {
      const inB = nodes.filter((n) => n.branch === b);
      expect(inB.filter((n) => n.keystone)).toHaveLength(1);
      expect(inB.filter((n) => !n.keystone)).toHaveLength(3);
      // The branch can always reach its keystone.
      expect(inB.filter((n) => !n.keystone).reduce((a, n) => a + n.maxRank, 0)).toBeGreaterThanOrEqual(TREE_KEYSTONE_POINTS);
      expect(BRANCH_NAMES[b]).toBeTruthy();
    }
  });

  it('a keystone opens only with enough points in its branch', () => {
    const pts: Record<string, number> = { bulk: 3, brace: 2 };
    expect(canTakeNode(pts, 'bulwark', 'bedrock')).toBe(false);
    pts.damper = 1;
    expect(canTakeNode(pts, 'bulwark', 'bedrock')).toBe(true);
    // Points in another branch don't count.
    expect(canTakeNode({ barbs: 3, kickback: 3 }, 'bulwark', 'bedrock')).toBe(false);
    // Another class can't take a Bulwark node.
    expect(canTakeNode({}, 'lumen', 'bulk')).toBe(false);
    expect(canTakeNode({ bulk: 3 }, 'bulwark', 'bulk')).toBe(false);
  });

  it('points come from levels, spend on the tree, and a respec gives them all back', () => {
    const h = newHero();
    h.cls = 'bulwark';
    h.level = 8;
    expect(pointsAvailable(h)).toBe(7);
    for (const id of ['bulk', 'bulk', 'brace', 'brace', 'damper', 'brace', 'bedrock'] as const) expect(spendPoint(h, id)).toBe(true);
    expect(pointsAvailable(h)).toBe(0);
    expect(spendPoint(h, 'bulk')).toBe(false);
    resetTree(h);
    expect(pointsAvailable(h)).toBe(7);
  });

  it('a class not on the tree keeps its stat points when refunding', () => {
    const h = newHero();
    h.cls = 'bulwark';
    h.level = 4;
    spendPoint(h, 'fortitude');
    expect(usesTree(h)).toBe(false);
    refundStatPoints(h);
    expect(h.passives.fortitude).toBe(1);
  });

  it('every fixed build spends exactly the points it is given', () => {
    for (const [cls, builds] of Object.entries(TREE_BUILDS)) {
      for (const b of Object.keys(builds!)) {
        for (const n of [2, 7, 12, 19]) {
          const p = buildPoints(cls as 'bulwark', b, n);
          expect(Object.values(p).reduce((a, c) => a + (c ?? 0), 0)).toBe(n);
        }
      }
    }
  });

  it('Bulk adds health and Stride adds speed through the loadout', () => {
    const l = loadoutFrom({ bulk: 3, stride: 2 }, []);
    expect(l.maxHpBonus).toBe(3 * TREE.bulkHp + 5 * TREE.pointHp);
    expect(l.speedMult).toBeCloseTo(1 + 2 * TREE.strideSpeed);
  });

  it('Barbs and Bristle send damage back to the attacker; Brace takes less', () => {
    const hit = (passives: Record<string, number>, heat = 0) => {
      const w = new World({ seed: 1, cls: 'bulwark', tier: 1, passives, route: ['pack'] as never });
      const inner = w as unknown as Inner & { player: { heat: number } };
      const i = inner.spawn('cinderhound', 60, 0);
      inner.player.heat = heat;
      const hp0 = w.enemies[i].hp;
      const through = inner.bulwarkMitigate(20, i);
      return { through, back: hp0 - w.enemies[i].hp };
    };
    const base = hit({});
    expect(hit({ barbs: 3 }).back).toBeGreaterThan(base.back);
    expect(hit({ brace: 3 }).through).toBeLessThan(base.through);
    // Bristle needs half the Resolve bar.
    expect(hit({ bristle: 1 }, 10).back).toBe(hit({}, 10).back);
    expect(hit({ bristle: 1 }, TREE.bristleResolve).back).toBeGreaterThan(hit({}, TREE.bristleResolve).back);
  });

  it('every node has a short text and a tip', () => {
    for (const n of Object.values(TREE_NODES)) {
      expect(n.text.length).toBeGreaterThan(5);
      expect(n.tip.length).toBeGreaterThan(n.text.length);
    }
  });

  it('Duskblade tree: Hardy adds health, Pace swings faster, Whet crits more, Cadence and Footwork cut cooldowns', () => {
    expect(loadoutFrom({ hardy: 2 }, []).maxHpBonus).toBe(2 * TREE.hardyHp + 2 * TREE.pointHp);
    const base = new World({ seed: 1, cls: 'duskblade' });
    const tree = new World({ seed: 1, cls: 'duskblade', passives: { pace: 3, whet: 3, footwork: 2, cadence: 1, gash: 3 } as never });
    expect(tree.swingCooldown).toBeCloseTo(base.swingCooldown / (1 + 3 * TREE.paceHaste), 6);
    expect(tree.critChance).toBeCloseTo(base.critChance + 3 * TREE.whetCrit, 6);
    expect(tree.bleedMult).toBeCloseTo(base.bleedMult * (1 + 3 * TREE.gashBleed), 6);
    const cd = (w: World, slot: number) => (w as unknown as { baseCooldown(s: number): number }).baseCooldown(slot);
    expect(cd(base, 1) - cd(tree, 1)).toBeCloseTo(2 * TREE.footworkCd, 6);
    expect(cd(base, 2) - cd(tree, 2)).toBeCloseTo(TREE.cadenceCd, 6);
  });

  it('Duskblade tree: Steadfast hits harder only above half health, Torrent only on bleeding foes, and Sidestep stays at 1s or more', () => {
    const hit = (passives: Record<string, number>, hpShare: number, bleeding: boolean) => {
      const w = new World({ seed: 1, cls: 'duskblade', passives: passives as never });
      const wi = w as unknown as { spawn(k: string, x: number, y: number): number; enemies: { hp: number; burnT: number }[]; damageEnemy(i: number, a: number, c: boolean): void };
      const i = wi.spawn('cinderBrute', 400, 0);
      const e = wi.enemies[i];
      e.burnT = bleeding ? 5 : 0;
      w.player.hp = w.player.maxHp * hpShare;
      const before = e.hp;
      wi.damageEnemy(i, 100, false);
      return before - e.hp;
    };
    expect(hit({}, 0.9, false)).toBeGreaterThan(0);
    expect(hit({ steadfast: 1 }, 0.9, false)).toBeCloseTo(hit({}, 0.9, false) * (1 + TREE.steadfastDmg), 6);
    expect(hit({ steadfast: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
    expect(hit({ torrent: 1 }, 0.9, true)).toBeCloseTo(hit({}, 0.9, true) * (1 + TREE.torrentDmg), 6);
    expect(hit({ torrent: 1 }, 0.9, false)).toBeCloseTo(hit({}, 0.9, false), 6);
    const w = new World({ seed: 1, cls: 'duskblade', passives: { footwork: 2 } as never });
    const wi = w as unknown as { baseCooldown(s: number): number; rank(id: string): number };
    wi.rank = (id: string) => (id === 'evasion' ? 3 : 0);
    expect(wi.baseCooldown(1)).toBe(1);
  });

  it('Emberwright tree: Warmth adds health, Brisk fires faster, Spark crits more, Fan, Skip and Primer cut cooldowns, Tinder cuts Heat', () => {
    expect(loadoutFrom({ warmth: 2 }, []).maxHpBonus).toBe(2 * TREE.warmthHp + 2 * TREE.pointHp);
    const base = new World({ seed: 1, cls: 'emberwright' });
    const tree = new World({ seed: 1, cls: 'emberwright', passives: { brisk: 3, spark: 3, fan: 3, skip: 2, primer: 2, tinder: 2 } as never });
    expect(tree.volleyCooldown).toBeCloseTo(base.volleyCooldown / (1 + 3 * TREE.briskHaste), 6);
    expect(tree.critChance).toBeCloseTo(base.critChance + 3 * TREE.sparkCrit, 6);
    const cd = (w: World, slot: number) => (w as unknown as { baseCooldown(s: number): number }).baseCooldown(slot);
    expect(cd(base, 0) - cd(tree, 0)).toBeCloseTo(3 * TREE.fanCd, 6);
    expect(cd(base, 1) - cd(tree, 1)).toBeCloseTo(2 * TREE.skipCd, 6);
    expect(cd(base, 2) - cd(tree, 2)).toBeCloseTo(2 * TREE.primerCd, 6);
    expect(base.abilityCost(0) - tree.abilityCost(0)).toBe(2 * TREE.tinderCost);
  });

  it('Emberwright tree: Glow hits harder only above half health, Ablaze only on burning foes, Glint makes crits bigger, Soot takes less', () => {
    const mk = (passives: Record<string, number>) => {
      const w = new World({ seed: 1, cls: 'emberwright', passives: passives as never });
      const wi = w as unknown as { spawn(k: string, x: number, y: number): number; enemies: { hp: number; burnT: number }[]; damageEnemy(i: number, a: number, c: boolean, b?: boolean, f?: boolean): void; hurtPlayer(a: number): void };
      return { w, wi };
    };
    const hit = (passives: Record<string, number>, hpShare: number, burning: boolean, crit = false) => {
      const { w, wi } = mk(passives);
      const i = wi.spawn('cinderBrute', 400, 0);
      const e = wi.enemies[i];
      e.burnT = burning ? 5 : 0;
      w.player.hp = w.player.maxHp * hpShare;
      const before = e.hp;
      wi.damageEnemy(i, 100, false, false, crit);
      return before - e.hp;
    };
    expect(hit({}, 0.9, false)).toBeGreaterThan(0);
    expect(hit({ glow: 1 }, 0.9, false)).toBeCloseTo(hit({}, 0.9, false) * (1 + TREE.glowDmg), 6);
    expect(hit({ glow: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
    expect(hit({ ablaze: 1 }, 0.9, true)).toBeCloseTo(hit({}, 0.9, true) * (1 + TREE.ablazeDmg), 6);
    expect(hit({ ablaze: 1 }, 0.9, false)).toBeCloseTo(hit({}, 0.9, false), 6);
    expect(hit({ glint: 1 }, 0.4, false, true)).toBeCloseTo(hit({}, 0.4, false, true) * (2 + TREE.glintCrit) / 2, 6);
    const taken = (passives: Record<string, number>) => {
      const { w, wi } = mk(passives);
      const hp0 = w.player.hp;
      wi.hurtPlayer(20);
      return hp0 - w.player.hp;
    };
    expect(taken({ soot: 3 })).toBeLessThan(taken({}));
  });

  it('Lumen tree: Sturdy adds health, Lilt speeds Sunmotes, Dazzle crits more, Drift and Chime cut cooldowns, Tend heals more', () => {
    expect(loadoutFrom({ sturdy: 2 }, []).maxHpBonus).toBe(2 * TREE.sturdyHp + 2 * TREE.pointHp);
    const base = new World({ seed: 1, cls: 'lumen' });
    const tree = new World({ seed: 1, cls: 'lumen', passives: { lilt: 3, dazzle: 3, drift: 2, chime: 2, tend: 3 } as never });
    expect(tree.moteCooldown).toBeCloseTo(base.moteCooldown / (1 + 3 * TREE.liltHaste), 6);
    expect(tree.critChance).toBeCloseTo(base.critChance + 3 * TREE.dazzleCrit, 6);
    const cd = (w: World, slot: number) => (w as unknown as { baseCooldown(s: number): number }).baseCooldown(slot);
    expect(cd(base, 1) - cd(tree, 1)).toBeCloseTo(2 * TREE.driftCd, 6);
    expect(cd(base, 2) - cd(tree, 2)).toBeCloseTo(2 * TREE.chimeCd, 6);
    const healed = (w: World) => { w.player.hp = 1; return w.healPlayer(10); };
    expect(healed(tree)).toBeCloseTo(healed(base) * (1 + 3 * TREE.tendHeal), 6);
  });

  it('Lumen tree: Serene only above half health, Refrain only in the Sanctuary, Noonday makes crits bigger', () => {
    const hit = (passives: Record<string, number>, hpShare: number, inSanct: boolean, crit = false) => {
      const w = new World({ seed: 1, cls: 'lumen', passives: passives as never });
      const wi = w as unknown as { spawn(k: string, x: number, y: number): number; enemies: { hp: number; x: number; y: number }[]; damageEnemy(i: number, a: number, c: boolean, b?: boolean, f?: boolean): void };
      const i = wi.spawn('cinderBrute', 400, 0);
      const e = wi.enemies[i];
      w.player.hp = w.player.maxHp * hpShare;
      if (inSanct) Object.assign(w.player, { sanctT: 3, sanctX: e.x, sanctY: e.y });
      const before = e.hp;
      wi.damageEnemy(i, 100, false, false, crit);
      return before - e.hp;
    };
    expect(hit({}, 0.9, false)).toBeGreaterThan(0);
    expect(hit({ serene: 1 }, 0.9, false)).toBeCloseTo(hit({}, 0.9, false) * (1 + TREE.sereneDmg), 6);
    expect(hit({ serene: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
    expect(hit({ refrain: 1 }, 0.4, true)).toBeCloseTo(hit({}, 0.4, true) * (1 + TREE.refrainDmg), 6);
    expect(hit({ refrain: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
    expect(hit({ noonday: 1 }, 0.4, false, true)).toBeCloseTo(hit({}, 0.4, false, true) * (2 + TREE.noondayCrit) / 2, 6);
  });

  it('Slagbinder tree: Heft adds health, Reload fires faster, Ladle and Spring cut cooldowns, Coat thickens plating, Flaw stretches Brittle, Shale takes less', () => {
    expect(loadoutFrom({ heft: 2 }, []).maxHpBonus).toBe(2 * TREE.heftHp + 2 * TREE.pointHp);
    const base = new World({ seed: 1, cls: 'slagbinder' });
    const tree = new World({ seed: 1, cls: 'slagbinder', passives: { ladle: 3, spring: 2, coat: 3, flaw: 2, shale: 3 } as never });
    type In = { baseCooldown(s: number): number; plateAmount: number; brittleTime: number; hurtPlayer(a: number): void };
    const cd = (w: World, slot: number) => (w as unknown as In).baseCooldown(slot);
    expect(cd(base, 0) - cd(tree, 0)).toBeCloseTo(3 * TREE.ladleCd, 6);
    expect(cd(base, 1) - cd(tree, 1)).toBeCloseTo(2 * TREE.springCd, 6);
    const plate = (w: World) => (w as unknown as In).plateAmount / w.player.maxHp;
    expect(plate(tree)).toBeCloseTo(plate(base) + SLAG_KIT.plateShare * 3 * TREE.coatPlate, 6);
    expect((tree as unknown as In).brittleTime - (base as unknown as In).brittleTime).toBeCloseTo(2 * TREE.flawTime, 6);
    const taken = (w: World) => { const hp0 = w.player.hp; (w as unknown as In).hurtPlayer(20); return hp0 - w.player.hp; };
    expect(taken(tree)).toBeLessThan(taken(base));
  });

  it('Slagbinder tree: Core only above half health, Breach only on Brittle foes, Glaze only while plated', () => {
    const hit = (passives: Record<string, number>, hpShare: number, brittle: boolean, plated = false) => {
      const w = new World({ seed: 1, cls: 'slagbinder', passives: passives as never });
      const wi = w as unknown as { spawn(k: string, x: number, y: number): number; enemies: { hp: number; brittleUntil?: number }[]; damageEnemy(i: number, a: number, c: boolean): void };
      const i = wi.spawn('cinderBrute', 400, 0);
      const e = wi.enemies[i];
      w.player.hp = w.player.maxHp * hpShare;
      if (brittle) e.brittleUntil = w.time + 5;
      if (plated) Object.assign(w.player, { plate: 20, plateUntil: w.time + 5 });
      const before = e.hp;
      wi.damageEnemy(i, 100, false);
      return before - e.hp;
    };
    expect(hit({}, 0.9, false)).toBeGreaterThan(0);
    expect(hit({ core: 1 }, 0.9, false)).toBeCloseTo(hit({}, 0.9, false) * (1 + TREE.coreDmg), 6);
    expect(hit({ core: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
    expect(hit({ breach: 1 }, 0.4, true)).toBeCloseTo(hit({}, 0.4, true) * (1 + TREE.breachDmg), 6);
    expect(hit({ breach: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
    expect(hit({ glaze: 1 }, 0.4, false, true)).toBeCloseTo(hit({}, 0.4, false, true) * (1 + TREE.glazeDmg), 6);
    expect(hit({ glaze: 1 }, 0.4, false)).toBeCloseTo(hit({}, 0.4, false), 6);
  });
});
