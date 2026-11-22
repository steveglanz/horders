/**
 * V7 variety check (docs/design/variety.md): how many different runs a player sees.
 * A run's shape is its route, each fight's arena layout and the Kiln Mother's version,
 * all fixed by the seed, so this needs no bot runs.
 *   DUNGEON=kiln TIER=1 RUNS=20 WINDOWS=50 npx tsx tools/variety.ts
 * It reports, over WINDOWS blocks of RUNS consecutive seeds, how many shapes repeat inside a block.
 */
import { World } from '../sim/world';

const dungeon = (process.env.DUNGEON ?? 'kiln') as 'kiln';
const tier = Number(process.env.TIER ?? 1);
const runs = Number(process.env.RUNS ?? 20);
const windows = Number(process.env.WINDOWS ?? 50);
type Inner = { rollLayout(id: string): void; rollKilnVariant(): string; encounter: number };

function shape(seed: number): { route: string; layouts: string; variant: string } {
  const w = new World({ seed, dungeon, tier, omens: [], cls: 'emberwright' });
  const q = w as unknown as Inner;
  const layouts = w.route.map((id, k) => { q.encounter = k; q.rollLayout(id); return w.layout; });
  return { route: w.route.join(','), layouts: layouts.join(','), variant: dungeon === 'kiln' ? q.rollKilnVariant() : '-' };
}

let alike = 0, routeAlike = 0, fullBlocks = 0;
const allRoutes = new Set<string>(), allShapes = new Set<string>();
for (let b = 0; b < windows; b++) {
  const seen = new Set<string>(), routes = new Set<string>();
  for (let s = 1 + b * runs; s <= (b + 1) * runs; s++) {
    const x = shape(s);
    const key = `${x.route}|${x.layouts}|${x.variant}`;
    seen.add(key); routes.add(x.route); allRoutes.add(x.route); allShapes.add(key);
  }
  alike += runs - seen.size;
  routeAlike += runs - routes.size;
  if (seen.size === runs) fullBlocks++;
}
console.log(`${dungeon} tier ${tier}: ${windows} blocks of ${runs} runs`);
console.log(`  runs that repeat an earlier run's whole shape in their block: ${alike} of ${runs * windows}; blocks with no repeat: ${fullBlocks}/${windows}`);
console.log(`  runs that repeat an earlier route alone: ${routeAlike} of ${runs * windows}`);
console.log(`  distinct routes seen: ${allRoutes.size}; distinct shapes: ${allShapes.size}`);
