/**
 * Vision v2, Checkpoint 1 (pillar 3, "short, fair, and it always pays"): the class-by-place bot matrix at average skill,
 * with the fight budgets and the 60% floor, and the merge gate built on it.
 *
 *   npx tsx tools/matrix.ts                      fast subset (MATRIX=fast): 5 classes x 6 launch places, a few seeds
 *   MATRIX=full npx tsx tools/matrix.ts          the full matrix (40 seeds per cell), run nightly in CI
 *   CHECK=1 npx tsx tools/matrix.ts              the merge gate: compares with tools/matrix-baseline.json, exit 1 on a fail
 *   UPDATE=1 npx tsx tools/matrix.ts             rewrites the baseline (commit it, and say why in the PR)
 *   PLACES=kiln,foundry CLASSES=lumen SEEDS=1-4  any slice; OUT=report.json writes the cell results as JSON
 *   SLOW=1.5                                     test only: every foe has 1.5x health, to prove the gate fails a slow PR
 *
 * Average skill is reactBot(0.3 s, skill 1, forget 0.2, stepErr 0.5) for every hero (design.md), Halls maps (what
 * players get), Omens as the client rolls them (one week per seed), gear from tools/heroes/matrix (the skills team's
 * heroes-r2 files, n=0: a fresh climber at that tier). The Kiln at tier 1 plays a hero with no gear.
 *
 * Budgets (docs/design/vision/vision.md, "Fight budgets as a merge gate"): trash 15-30 s, named 30-45 s, boss 60-90 s.
 * The gate reads the median of each cell. Rules, see docs/design/fight-budgets.md:
 *   1. a cell inside a budget's ceiling may not go over it;
 *   2. a cell already over (the baseline says so) may not get more than 10% slower;
 *   3. the floor: in every place, each class wins at least 60% as often as the best class. A class over the floor may
 *      not drop under it, and one already under may not fall further (ratio down by more than 0.1).
 * The sim is deterministic per seed, so a changed number on the same seeds is the PR's doing, not noise.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { World, WorldOptions } from '../sim/world';
import { botChoose, reactBot } from '../sim/bot';
import { equippedItems, HeroProfile } from '../sim/hero';
import { DUNGEONS, DungeonId } from '../sim/content/dungeon';
import { ENEMIES } from '../sim/content/enemies';
import type { ClassId } from '../sim/content/emberwright';
import { toolOmens } from './omenopt';

export const CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];
/** The six launch places (vision.md section 10, decision 4), each at its unlock tier, with the hero file for it. */
export const PLACES: { place: DungeonId; tier: number; hero?: string }[] = [
  { place: 'kiln', tier: 1 },
  { place: 'foundry', tier: 4, hero: 'hero-t4' },
  { place: 'hammerdeep', tier: 4, hero: 'hero-t4' },
  { place: 'glarewell', tier: 7, hero: 'hero-t6' },
  { place: 'coldmarrow', tier: 10, hero: 'hero-t10' },
  { place: 'wrackline', tier: 13, hero: 'hero-t13' },
];
export const BUDGET = { trash: [15, 30], named: [30, 45], boss: [60, 90] } as const;
export type Kind = keyof typeof BUDGET;
export const FLOOR = 0.6;
/** Rule 2 and 3 slack for cells that already miss. */
export const WORSE_TIME = 1.1;
export const WORSE_RATIO = 0.1;
/** A group place: the class plays with the rest of a standard party (a tank and a healer if it is neither). */
const GROUP_FILL: ClassId[] = ['bulwark', 'lumen', 'emberwright', 'duskblade'];

export interface Cell {
  place: DungeonId;
  tier: number;
  cls: ClassId;
  seeds: number;
  wins: number;
  /** Median seconds per fight kind (trash and named over every cleared pack, boss over wins), null if none. */
  median: Record<Kind, number | null>;
  /** Fights measured per kind. */
  n: Record<Kind, number>;
  /** Median delve length on wins, s. */
  delve: number | null;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

const heroFile = (cls: ClassId, file?: string): HeroProfile | null => {
  if (!file) return null;
  const f = new URL(`./heroes/matrix/${cls}/${file}.json`, import.meta.url);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};

/** One run: wins, and seconds per fight by kind. */
export function playRun(place: DungeonId, tier: number, cls: ClassId, seed: number, hero?: string): { win: boolean; time: number; fights: Record<Kind, number[]> } {
  const gearOf = (c: ClassId) => {
    const h = heroFile(c, hero);
    return h ? { gear: equippedItems(h), passives: h.passives } : {};
  };
  const main = heroFile(cls, hero);
  const group = DUNGEONS[place].style === 'group';
  const rest = group ? GROUP_FILL.filter((c) => c !== cls).slice(0, 3) : [];
  const opts: WorldOptions = {
    seed, dungeon: place, tier, cls, halls: true, omens: toolOmens(tier, seed, { OMENS: 'rotate' }),
    ...(main ? { gear: equippedItems(main), passives: main.passives, heroLevel: main.level, nextItemId: main.nextItemId } : {}),
    ...(group ? { party: rest.map((c, k) => ({ cls: c, name: `${c}${k + 1}`, ...gearOf(c) })) } : {}),
  };
  const w = new World(opts);
  const drive = w.heroes.map((_, i) => reactBot(0.3, 1, { forget: 0.2, stepErr: 0.5, salt: seed * 16 + i }));
  const fights: Record<Kind, number[]> = { trash: [], named: [], boss: [] };
  const woke: number[] = [];
  let bossAt = 0;
  while (w.state !== 'ended' && w.time < 1500) {
    if (w.state === 'draft') {
      const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
      w.use(h);
      const pick = botChoose(w);
      w.use(0);
      w.choose(pick, h);
      continue;
    }
    const inputs = w.heroes.map((_, i) => {
      w.use(i);
      const inp = drive[i](w);
      w.use(0);
      return inp;
    });
    w.step(inputs.length === 1 ? inputs[0] : inputs);
    for (const ev of w.events) if (ev.type === 'bossSpawn' && !bossAt) bossAt = w.time;
    w.halls?.packs.forEach((p, k) => {
      if (p.state === 'awake' && woke[k] === undefined) woke[k] = w.time;
      if (p.state === 'cleared' && woke[k] !== undefined && woke[k] >= 0) {
        // C (named), D (hard) and E (door guard) are the named-fight budget; A, B and side packs are trash.
        if (p.enc !== 'shrine') fights[p.gate === 'named' || p.role === 'C' || p.role === 'D' || p.role === 'E' ? 'named' : 'trash'].push(w.time - woke[k]);
        woke[k] = -1;
      }
    });
  }
  const win = w.summary().victory;
  if (win && bossAt) fights.boss.push(w.time - bossAt);
  return { win, time: w.time, fights };
}

export function playCell(place: DungeonId, tier: number, cls: ClassId, seeds: number[], hero?: string): Cell {
  const all: Record<Kind, number[]> = { trash: [], named: [], boss: [] };
  const delves: number[] = [];
  let wins = 0;
  for (const seed of seeds) {
    const r = playRun(place, tier, cls, seed, hero);
    if (r.win) { wins++; delves.push(r.time); }
    for (const k of Object.keys(all) as Kind[]) all[k].push(...r.fights[k]);
  }
  const kinds = Object.keys(all) as Kind[];
  return {
    place, tier, cls, seeds: seeds.length, wins,
    median: Object.fromEntries(kinds.map((k) => [k, median(all[k])])) as Cell['median'],
    n: Object.fromEntries(kinds.map((k) => [k, all[k].length])) as Cell['n'],
    delve: median(delves),
  };
}

/** Each class's wins as a share of the best class's wins in that place (1 if nobody wins). */
export function floorRatios(cells: Cell[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const place of new Set(cells.map((c) => c.place))) {
    const here = cells.filter((c) => c.place === place);
    const best = Math.max(...here.map((c) => c.wins / c.seeds));
    for (const c of here) out.set(`${c.place}/${c.cls}`, best > 0 ? c.wins / c.seeds / best : 1);
  }
  return out;
}

/** The gate: every rule a cell breaks against the baseline (empty = pass). */
export function gate(now: Cell[], base: Cell[]): string[] {
  const fails: string[] = [];
  const key = (c: Cell) => `${c.place}/${c.cls}`;
  const was = new Map(base.map((c) => [key(c), c]));
  const rNow = floorRatios(now), rWas = floorRatios(base);
  for (const c of now) {
    const b = was.get(key(c));
    if (!b) continue;
    for (const k of Object.keys(BUDGET) as Kind[]) {
      const t = c.median[k], tb = b.median[k], cap = BUDGET[k][1];
      if (t === null) continue;
      if (tb === null || tb <= cap) {
        if (t > cap) fails.push(`${key(c)} ${k}: median ${t} s is over the ${cap} s budget (was ${tb ?? '-'} s)`);
      } else if (t > tb * WORSE_TIME) fails.push(`${key(c)} ${k}: median ${t} s, already over budget at ${tb} s, is more than ${Math.round((WORSE_TIME - 1) * 100)}% slower`);
    }
    const r = rNow.get(key(c))!, rb = rWas.get(key(c)) ?? 1;
    if (rb >= FLOOR && r < FLOOR) fails.push(`${key(c)} floor: wins ${c.wins}/${c.seeds} are ${pct(r)} of the best class (floor ${pct(FLOOR)}, was ${pct(rb)})`);
    else if (rb < FLOOR && r < rb - WORSE_RATIO - 1e-9) fails.push(`${key(c)} floor: already under, fell from ${pct(rb)} to ${pct(r)} of the best class`);
  }
  return fails;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A markdown table: wins, floor ratio and median seconds per kind, with a mark on every miss. */
export function table(cells: Cell[]): string {
  const ratios = floorRatios(cells);
  const mark = (k: Kind, t: number | null) => (t === null ? '-' : t > BUDGET[k][1] ? `**${t}** ▲` : t < BUDGET[k][0] ? `${t} ▽` : `${t}`);
  const rows = ['| Place (tier) | Class | Wins | Floor | Trash | Named | Boss | Delve |', '|---|---|---|---|---|---|---|---|'];
  for (const c of cells) {
    const r = ratios.get(`${c.place}/${c.cls}`)!;
    rows.push(`| ${c.place} (t${c.tier}) | ${c.cls} | ${c.wins}/${c.seeds} | ${r < FLOOR ? `**${pct(r)}** ✗` : pct(r)} | ${mark('trash', c.median.trash)} | ${mark('named', c.median.named)} | ${mark('boss', c.median.boss)} | ${c.delve === null ? '-' : `${Math.floor(c.delve / 60)}:${String(Math.round(c.delve % 60)).padStart(2, '0')}`} |`);
  }
  return rows.join('\n');
}

const range = (s: string): number[] => s.split(',').flatMap((p) => {
  const [a, b] = p.split('-').map(Number);
  return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
});

/** Seeds per cell: the fast subset per PR, the full matrix nightly. */
export const SEEDS = { fast: '1-6', full: '1-40' };

function main(): void {
  const env = process.env;
  // REPORT=dir: merge the OUT files in dir (the nightly jobs, one per cell) into one table, floor and budget list.
  if (env.REPORT) {
    const cells = readdirSync(env.REPORT).filter((f) => f.endsWith('.json')).flatMap((f) => (JSON.parse(readFileSync(`${env.REPORT}/${f}`, 'utf8')) as { cells: Cell[] }).cells);
    const order = (c: Cell) => PLACES.findIndex((p) => p.place === c.place) * 10 + CLASSES.indexOf(c.cls);
    cells.sort((a, b) => order(a) - order(b));
    const ratios = floorRatios(cells);
    const misses = cells.flatMap((c) => [
      ...(Object.keys(BUDGET) as Kind[]).filter((k) => (c.median[k] ?? 0) > BUDGET[k][1]).map((k) => `${c.place}/${c.cls} ${k} ${c.median[k]} s (budget ${BUDGET[k][1]} s)`),
      ...(ratios.get(`${c.place}/${c.cls}`)! < FLOOR ? [`${c.place}/${c.cls} floor ${pct(ratios.get(`${c.place}/${c.cls}`)!)} of the best class`] : []),
    ]);
    const out = `## Fight-budget matrix (${cells[0]?.seeds ?? 0} seeds per cell, average skill)\n\nMedian seconds. Budgets: trash ${BUDGET.trash.join('-')}, named ${BUDGET.named.join('-')}, boss ${BUDGET.boss.join('-')}; ▲ over, ▽ under. Floor: wins as a share of the best class in that place, ${pct(FLOOR)} minimum.\n\n${table(cells)}\n\n### Out of budget or under the floor: ${misses.length}\n\n${misses.map((m) => `- ${m}`).join('\n')}\n`;
    console.log(out);
    if (env.SUMMARY) writeFileSync(env.SUMMARY, out, { flag: 'a' });
    return;
  }
  const mode = env.MATRIX === 'full' ? 'full' : 'fast';
  const seeds = range(env.SEEDS ?? SEEDS[mode]);
  const places = env.PLACES ? PLACES.filter((p) => env.PLACES!.split(',').includes(p.place)) : PLACES;
  const classes = env.CLASSES ? (env.CLASSES.split(',') as ClassId[]) : CLASSES;
  if (env.SLOW) for (const e of Object.values(ENEMIES)) e.hp *= Number(env.SLOW);
  const cells: Cell[] = [];
  const t0 = Date.now();
  for (const p of places) for (const cls of classes) {
    const c = playCell(p.place, p.tier, cls, seeds, p.hero);
    cells.push(c);
    console.error(`${p.place} t${p.tier} ${cls}: ${c.wins}/${c.seeds} trash ${c.median.trash} named ${c.median.named} boss ${c.median.boss} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const report = `## Fight-budget matrix (${mode}, seeds ${env.SEEDS ?? SEEDS[mode]}, average skill)\n\nMedian seconds. Budgets: trash ${BUDGET.trash.join('-')}, named ${BUDGET.named.join('-')}, boss ${BUDGET.boss.join('-')}; ▲ over, ▽ under. Floor: wins as a share of the best class in that place, ${pct(FLOOR)} minimum.\n\n${table(cells)}\n`;
  console.log(report);
  if (env.OUT) writeFileSync(env.OUT, JSON.stringify({ mode, seeds, cells }, null, 1) + '\n');
  if (env.SUMMARY) writeFileSync(env.SUMMARY, report, { flag: 'a' });
  const basePath = new URL('./matrix-baseline.json', import.meta.url);
  if (env.UPDATE === '1') {
    writeFileSync(basePath, JSON.stringify({ seeds: env.SEEDS ?? SEEDS.fast, cells }, null, 1) + '\n');
    console.log('baseline written: tools/matrix-baseline.json');
  }
  if (env.CHECK === '1') {
    const base = JSON.parse(readFileSync(basePath, 'utf8')) as { seeds: string; cells: Cell[] };
    if (base.seeds !== (env.SEEDS ?? SEEDS[mode])) throw new Error(`the baseline uses seeds ${base.seeds}; run the check with the same seeds`);
    const fails = gate(cells, base.cells);
    const out = fails.length ? `### Fight-budget gate: FAIL\n\n${fails.map((f) => `- ${f}`).join('\n')}\n\nIf the change is meant (a deliberate retune), re-run with UPDATE=1, commit tools/matrix-baseline.json and say why in the PR.\n` : '### Fight-budget gate: pass\n';
    console.log(out);
    if (env.SUMMARY) writeFileSync(env.SUMMARY, out, { flag: 'a' });
    if (fails.length) process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('matrix.ts')) main();
