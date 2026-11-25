/**
 * Character trees (class progression brief, 25 Nov; Steve: "make leveling up seem more rewarding"). Each class gets
 * one permanent tree with the same three branches as its run draft. Every character level past 1 is a point; a branch's
 * keystone opens once TREE_KEYSTONE_POINTS are in that branch. Points are stored in the hero's `passives` beside the
 * old stat points (Might, Fortitude, Insight, Alacrity), so they save, swap per hero and reach the sim the same way.
 *
 * Behind a flag: TREE_CLASSES lists the classes whose characters spend on the tree instead of the stat points. It is
 * empty until a class's tree passes its check (within 3 of 40 of today's stat points, first three tiers of every
 * dungeon). Names are single plain words, as Steve's naming rule allows.
 */
import type { Branch, ClassId } from './emberwright';

export type TreeNodeId =
  | 'bulk' | 'brace' | 'damper' | 'bedrock'
  | 'barbs' | 'payback' | 'kickback' | 'bristle'
  | 'stride' | 'cover' | 'ram' | 'onrush'
  | 'gash' | 'leech' | 'opener' | 'torrent'
  | 'pace' | 'whet' | 'rush' | 'cadence'
  | 'hardy' | 'poise' | 'footwork' | 'steadfast'
  | 'char' | 'tinder' | 'fan' | 'ablaze'
  | 'brisk' | 'spark' | 'primer' | 'glint'
  | 'warmth' | 'soot' | 'skip' | 'glow';

export interface TreeNode {
  id: TreeNodeId;
  cls: ClassId;
  branch: Branch;
  name: string;
  maxRank: number;
  /** The branch's last node: opens once TREE_KEYSTONE_POINTS are in its branch. */
  keystone?: boolean;
  /** Short label. */
  text: string;
  /** Long-press tip: what it does per rank and at max. */
  tip: string;
}

/** Points in a branch that open its keystone. */
export const TREE_KEYSTONE_POINTS = 6;

/** Classes whose characters use the tree instead of the stat points. Empty until a tree passes its check. */
export const TREE_CLASSES: ClassId[] = [];

/** The numbers each node uses, in one place for tuning (TUNE=TREE.bulkHp=12 in the tools). */
export const TREE = {
  /** Every point spent in the tree also gives this much max health, as a level-up does. */
  pointHp: 4,
  bulkHp: 10,
  braceCut: 0.02,
  damperCost: 3,
  bedrockCd: 6,
  barbsDamage: 4,
  paybackReflect: 0.05,
  kickbackDmg: 0.06,
  kickbackWindow: 3,
  bristleReflect: 0.1,
  bristleResolve: 50,
  strideSpeed: 0.03,
  coverCut: 0.02,
  coverRadius: 200,
  ramCd: 1,
  onrushCut: 0.2,
  onrushTime: 3,
  // Duskblade
  gashBleed: 0.06,
  leechHeal: 0.004,
  openerCd: 0.5,
  torrentDmg: 0.08,
  paceHaste: 0.03,
  whetCrit: 0.02,
  rushMomentum: 0.08,
  cadenceCd: 4,
  hardyHp: 15,
  poiseCut: 0.03,
  footworkCd: 1,
  steadfastDmg: 0.1,
  // Emberwright
  charWave: 0.08,
  tinderCost: 5,
  fanCd: 0.4,
  ablazeDmg: 0.08,
  briskHaste: 0.04,
  sparkCrit: 0.03,
  primerCd: 1.5,
  glintCrit: 0.2,
  warmthHp: 15,
  sootCut: 0.03,
  skipCd: 1,
  glowDmg: 0.1,
};

export const TREE_NODES: Record<TreeNodeId, TreeNode> = {
  // Bulwark, Anvil Skin branch: holding the line.
  bulk: { id: 'bulk', cls: 'bulwark', branch: 'bastion', name: 'Bulk', maxRank: 3, text: '+15 max health per point.', tip: 'More health. +15 max health per point, +45 at 3 points.' },
  brace: { id: 'brace', cls: 'bulwark', branch: 'bastion', name: 'Brace', maxRank: 3, text: '3% less damage taken per point.', tip: 'Take less from every hit. 3% less damage per point, 9% at 3 points.' },
  damper: { id: 'damper', cls: 'bulwark', branch: 'bastion', name: 'Damper', maxRank: 2, text: 'Smother costs 3 less Resolve per point.', tip: 'Catching a Sluice Crawler\'s bloom on the shield costs 3 less Resolve per point (10 to 4 at 2 points).' },
  bedrock: { id: 'bedrock', cls: 'bulwark', branch: 'bastion', name: 'Bedrock', maxRank: 1, keystone: true, text: 'Anvil Skin recharges 6s faster.', tip: 'Keystone. Anvil Skin comes back every 14s instead of 20s.' },
  // Bulwark, the thorns branch (the run draft's Spite branch, id retribution).
  barbs: { id: 'barbs', cls: 'bulwark', branch: 'retribution', name: 'Barbs', maxRank: 3, text: 'Foes that hit you take 4 damage per point.', tip: 'Every foe that hits you takes 4 damage back per point, 12 at 3 points. Grows with your damage.' },
  payback: { id: 'payback', cls: 'bulwark', branch: 'retribution', name: 'Payback', maxRank: 2, text: 'Anvil Skin turns back 5% more per point.', tip: 'Anvil Skin turns back 5% more of each hit per point: 25% to 35% at 2 points.' },
  kickback: { id: 'kickback', cls: 'bulwark', branch: 'retribution', name: 'Kickback', maxRank: 3, text: 'Hit 6% harder per point on foes that just hit you.', tip: 'For 3s after a foe hits you, you deal 6% more damage to it per point, 18% at 3 points.' },
  bristle: { id: 'bristle', cls: 'bulwark', branch: 'retribution', name: 'Bristle', maxRank: 1, keystone: true, text: 'With half your Resolve or more, turn back 10% of every hit.', tip: 'Keystone. While you have 50 Resolve or more, every hit you take sends 10% of it back to the attacker.' },
  // Bulwark, Vanguard branch: getting there and covering others.
  stride: { id: 'stride', cls: 'bulwark', branch: 'vanguard', name: 'Stride', maxRank: 3, text: '+3% move speed per point.', tip: 'Move 3% faster per point, 9% at 3 points.' },
  cover: { id: 'cover', cls: 'bulwark', branch: 'vanguard', name: 'Cover', maxRank: 2, text: 'Allies near you take 2% less damage per point.', tip: 'In a party, heroes within 200 of you take 2% less damage per point. Alone, it does nothing.' },
  ram: { id: 'ram', cls: 'bulwark', branch: 'vanguard', name: 'Ram', maxRank: 3, text: 'Charge recharges 1s faster per point.', tip: 'Charge comes back 1s sooner per point, 3s at 3 points.' },
  onrush: { id: 'onrush', cls: 'bulwark', branch: 'vanguard', name: 'Onrush', maxRank: 1, keystone: true, text: 'After Charge, take 20% less damage for 3s.', tip: 'Keystone. Landing a Charge makes you take 20% less damage for 3s.' },
  // Duskblade, Bloodletting branch: bleeds and staying alive by them.
  gash: { id: 'gash', cls: 'duskblade', branch: 'bloodletting', name: 'Gash', maxRank: 3, text: 'Your bleeds deal 6% more per point.', tip: 'Every bleed you cause deals 6% more damage per point, 18% at 3 points.' },
  leech: { id: 'leech', cls: 'duskblade', branch: 'bloodletting', name: 'Leech', maxRank: 3, text: 'Heal for 0.4% of the damage you deal per point.', tip: 'Heal for 0.4% of all the damage you deal per point, 1.2% at 3 points.' },
  opener: { id: 'opener', cls: 'duskblade', branch: 'bloodletting', name: 'Opener', maxRank: 2, text: 'Rending Dash recharges 0.5s faster per point.', tip: 'Rending Dash comes back 0.5s sooner per point, 1s at 2 points.' },
  torrent: { id: 'torrent', cls: 'duskblade', branch: 'bloodletting', name: 'Torrent', maxRank: 1, keystone: true, text: 'Bleeding foes take 8% more damage from you.', tip: 'Keystone. You deal 8% more damage to any foe that is bleeding.' },
  // Duskblade, Tempo branch: faster, sharper swings.
  pace: { id: 'pace', cls: 'duskblade', branch: 'tempo', name: 'Pace', maxRank: 3, text: 'Swing 3% faster per point.', tip: 'Your swings come 3% faster per point, 9% at 3 points.' },
  whet: { id: 'whet', cls: 'duskblade', branch: 'tempo', name: 'Whet', maxRank: 3, text: '+2% chance to crit per point.', tip: '2% more chance per point to crit for double damage, 6% at 3 points.' },
  rush: { id: 'rush', cls: 'duskblade', branch: 'tempo', name: 'Rush', maxRank: 2, text: 'Hits build 8% more Momentum per point.', tip: 'Every hit builds 8% more Momentum per point, 16% at 2 points.' },
  cadence: { id: 'cadence', cls: 'duskblade', branch: 'tempo', name: 'Cadence', maxRank: 1, keystone: true, text: 'Execution recharges 4s faster.', tip: 'Keystone. Execution comes back 4s sooner.' },
  // Duskblade, Guard branch: lasting through the fight.
  hardy: { id: 'hardy', cls: 'duskblade', branch: 'guard', name: 'Hardy', maxRank: 3, text: '+15 max health per point.', tip: 'More health. +15 max health per point, +45 at 3 points.' },
  poise: { id: 'poise', cls: 'duskblade', branch: 'guard', name: 'Poise', maxRank: 3, text: '3% less damage taken per point.', tip: 'Take less from every hit. 3% less damage per point, 9% at 3 points.' },
  footwork: { id: 'footwork', cls: 'duskblade', branch: 'guard', name: 'Footwork', maxRank: 2, text: 'Sidestep recharges 1s faster per point.', tip: 'Sidestep comes back 1s sooner per point, 2s at 2 points. Each Sidestep also mends a little.' },
  steadfast: { id: 'steadfast', cls: 'duskblade', branch: 'guard', name: 'Steadfast', maxRank: 1, keystone: true, text: 'Above half health, deal 10% more damage.', tip: 'Keystone. While you are at half your health or more, you deal 10% more damage. The rest of Guard helps you stay there.' },
  // Emberwright, Wildfire branch: Flame Wave and burning foes.
  char: { id: 'char', cls: 'emberwright', branch: 'wildfire', name: 'Char', maxRank: 3, text: 'Flame Wave hits 8% harder per point.', tip: 'Flame Wave deals 8% more damage per point, 24% at 3 points.' },
  tinder: { id: 'tinder', cls: 'emberwright', branch: 'wildfire', name: 'Tinder', maxRank: 2, text: 'Flame Wave costs 5 less Heat per point.', tip: 'Flame Wave costs 5 less Heat per point, 30 to 20 at 2 points.' },
  fan: { id: 'fan', cls: 'emberwright', branch: 'wildfire', name: 'Fan', maxRank: 3, text: 'Flame Wave recharges 0.4s faster per point.', tip: 'Flame Wave comes back 0.4s sooner per point, 1.2s at 3 points.' },
  ablaze: { id: 'ablaze', cls: 'emberwright', branch: 'wildfire', name: 'Ablaze', maxRank: 1, keystone: true, text: 'Burning foes take 8% more damage from you.', tip: 'Keystone. You deal 8% more damage to any foe that is burning.' },
  // Emberwright, Kindling branch: faster orbs and crits.
  brisk: { id: 'brisk', cls: 'emberwright', branch: 'kindling', name: 'Brisk', maxRank: 3, text: 'Cinder Volley fires 4% faster per point.', tip: 'Cinder Volley fires 4% faster per point, 12% at 3 points.' },
  spark: { id: 'spark', cls: 'emberwright', branch: 'kindling', name: 'Spark', maxRank: 3, text: '+3% chance to crit per point.', tip: '3% more chance per point to crit for double damage, 9% at 3 points.' },
  primer: { id: 'primer', cls: 'emberwright', branch: 'kindling', name: 'Primer', maxRank: 2, text: 'Combustion recharges 1.5s faster per point.', tip: 'Combustion comes back 1.5s sooner per point, 3s at 2 points.' },
  glint: { id: 'glint', cls: 'emberwright', branch: 'kindling', name: 'Glint', maxRank: 1, keystone: true, text: 'Crits hit for 2.2 times instead of 2.', tip: 'Keystone. Your crits deal 2.2 times the hit instead of 2 times, 10% more on every crit.' },
  // Emberwright, Ashguard branch: lasting through the fight.
  warmth: { id: 'warmth', cls: 'emberwright', branch: 'ashguard', name: 'Warmth', maxRank: 3, text: '+15 max health per point.', tip: 'More health. +15 max health per point, +45 at 3 points.' },
  soot: { id: 'soot', cls: 'emberwright', branch: 'ashguard', name: 'Soot', maxRank: 3, text: '3% less damage taken per point.', tip: 'Take less from every hit. 3% less damage per point, 9% at 3 points.' },
  skip: { id: 'skip', cls: 'emberwright', branch: 'ashguard', name: 'Skip', maxRank: 2, text: 'Blink recharges 1s faster per point.', tip: 'Blink comes back 1s sooner per point, 2s at 2 points.' },
  glow: { id: 'glow', cls: 'emberwright', branch: 'ashguard', name: 'Glow', maxRank: 1, keystone: true, text: 'Above half health, deal 10% more damage.', tip: 'Keystone. While you are at half your health or more, you deal 10% more damage. The rest of Ashguard helps you stay there.' },
};

export const TREE_IDS = Object.keys(TREE_NODES) as TreeNodeId[];

/** A class's tree nodes, branch by branch, keystones last. */
export function treeOf(cls: ClassId): TreeNode[] {
  return TREE_IDS.map((id) => TREE_NODES[id]).filter((n) => n.cls === cls);
}

export function isTreeNode(id: string): id is TreeNodeId {
  return id in TREE_NODES;
}

/** Points spent in one branch of a character's tree. */
export function branchPoints(points: Partial<Record<string, number>>, cls: ClassId, branch: Branch): number {
  let n = 0;
  for (const node of treeOf(cls)) if (node.branch === branch && !node.keystone) n += points[node.id] ?? 0;
  return n;
}

/** Can one more point go into `id`? (Not past its max, and a keystone only with its branch filled enough.) */
export function canTakeNode(points: Partial<Record<string, number>>, cls: ClassId, id: TreeNodeId): boolean {
  const node = TREE_NODES[id];
  if (node.cls !== cls) return false;
  if ((points[id] ?? 0) >= node.maxRank) return false;
  return !node.keystone || branchPoints(points, cls, node.branch) >= TREE_KEYSTONE_POINTS;
}

/**
 * Fixed builds, one per branch, for bots and the balance tools (every measurement names the build it used). Each lists
 * points in the order they are spent: the branch to its keystone first, then the next branch.
 */
export const TREE_BUILDS: Partial<Record<ClassId, Record<string, TreeNodeId[]>>> = {
  bulwark: {
    bastion: ['bulk', 'brace', 'bulk', 'brace', 'damper', 'bulk', 'bedrock', 'brace', 'damper', 'barbs', 'barbs', 'kickback', 'kickback', 'payback', 'barbs', 'bristle', 'kickback', 'payback', 'stride'],
    retribution: ['barbs', 'kickback', 'barbs', 'kickback', 'payback', 'barbs', 'bristle', 'kickback', 'payback', 'bulk', 'brace', 'bulk', 'brace', 'bulk', 'damper', 'bedrock', 'brace', 'damper', 'stride'],
    vanguard: ['ram', 'stride', 'cover', 'ram', 'stride', 'cover', 'onrush', 'ram', 'stride', 'bulk', 'brace', 'bulk', 'brace', 'bulk', 'damper', 'bedrock', 'brace', 'damper', 'barbs'],
  },
  duskblade: {
    bloodletting: ['gash', 'leech', 'gash', 'opener', 'leech', 'gash', 'torrent', 'leech', 'opener', 'pace', 'whet', 'pace', 'whet', 'pace', 'rush', 'cadence', 'whet', 'rush', 'hardy'],
    tempo: ['pace', 'whet', 'pace', 'rush', 'whet', 'pace', 'cadence', 'whet', 'rush', 'gash', 'leech', 'gash', 'opener', 'leech', 'gash', 'torrent', 'leech', 'opener', 'hardy'],
    guard: ['hardy', 'poise', 'hardy', 'footwork', 'poise', 'hardy', 'steadfast', 'poise', 'footwork', 'pace', 'whet', 'pace', 'whet', 'pace', 'rush', 'cadence', 'whet', 'rush', 'gash'],
  },
  emberwright: {
    wildfire: ['char', 'tinder', 'char', 'fan', 'tinder', 'char', 'ablaze', 'fan', 'fan', 'brisk', 'spark', 'brisk', 'spark', 'brisk', 'primer', 'glint', 'spark', 'primer', 'warmth'],
    kindling: ['brisk', 'spark', 'brisk', 'primer', 'spark', 'brisk', 'glint', 'spark', 'primer', 'char', 'tinder', 'char', 'fan', 'tinder', 'char', 'ablaze', 'fan', 'fan', 'warmth'],
    ashguard: ['warmth', 'soot', 'warmth', 'skip', 'soot', 'warmth', 'glow', 'soot', 'skip', 'brisk', 'spark', 'brisk', 'spark', 'brisk', 'primer', 'glint', 'spark', 'primer', 'char'],
  },
};

/** The first `n` points of a fixed build, as a points record (skipping any the rules refuse). */
export function buildPoints(cls: ClassId, branch: string, n: number): Partial<Record<TreeNodeId, number>> {
  const out: Partial<Record<TreeNodeId, number>> = {};
  let spent = 0;
  for (const id of TREE_BUILDS[cls]?.[branch] ?? []) {
    if (spent >= n) break;
    if (!canTakeNode(out, cls, id)) continue;
    out[id] = (out[id] ?? 0) + 1;
    spent++;
  }
  return out;
}
