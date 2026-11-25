import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { newHero, pointsAvailable, refundStatPoints, resetTree, spendPoint, loadoutFrom, usesTree } from '../sim/hero';
import { TREE, TREE_BUILDS, TREE_CLASSES, TREE_KEYSTONE_POINTS, TREE_NODES, buildPoints, canTakeNode, treeOf } from '../sim/content/trees';
import { BRANCH_NAMES } from '../sim/content/emberwright';

type Inner = { spawn(kind: string, x: number, y: number): number; bulwarkMitigate(raw: number, src: number): number };

describe('character trees (class progression brief)', () => {
  it('no class uses the tree yet: it stays behind its check', () => {
    expect(TREE_CLASSES).toEqual([]);
  });

  it('the Bulwark tree has 3 nodes and a keystone in each of its run-draft branches', () => {
    const nodes = treeOf('bulwark');
    expect(nodes).toHaveLength(12);
    for (const b of ['bastion', 'retribution', 'vanguard'] as const) {
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
});
