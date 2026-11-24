/**
 * V7 variety check (docs/design/variety.md): how many different runs a player sees.
 * A run's shape is its route, each fight's arena layout and the boss's version (the Kiln
 * Mother's, Maelra's, the Lensmother's or Nhevra's), each fight's arena event and the named foe (where and its
 * trait, Phase 14 X8) and each fight's wave shape (Phase 15 Y1), all fixed by the seed, so this needs no bot runs.
 * (waveShapeAt is what the fight's 'waveShape' 'start' event reports: tools/contentcheck.ts checks that on every forced wave.)
 * Phase 16 U7: from tier 8 the boss also echoes one of her other versions, so the shape holds the version+echo pair too
 * (contentcheck's `echo` cases check that each forced pair is the one the boss plays).
 *   DUNGEON=kiln TIER=1 RUNS=20 WINDOWS=50 npx tsx tools/variety.ts
 * It reports, over WINDOWS blocks of RUNS consecutive seeds, how many shapes repeat inside a block.
 */
import { World, KILN_VARIANTS, MAELRA_ECHOES, LENS_VARIANTS, HESSA_VARIANTS, ONDREL_VARIANTS, YSMERET_VARIANTS, OSKEL_VARIANTS,
  SLAG_VARIANTS, VORHULM_VARIANTS, COLOSSUS_VARIANTS, REGENT_VARIANTS } from '../sim/world';

const dungeon = (process.env.DUNGEON ?? 'kiln') as 'kiln';
const tier = Number(process.env.TIER ?? 1);
const runs = Number(process.env.RUNS ?? 20);
const windows = Number(process.env.WINDOWS ?? 50);
type Inner = { rollLayout(id: string): void; rollKilnVariant(): string; rollMaelraVariant(): string; rollLensVariant(): string; rollNhevraVariant(): string; rollHessaVariant(): string; rollOndrelVariant(): string; rollYsmeretVariant(): string; rollOskelVariant(): string; rollSlagVariant(): string; rollVorhulmVariant(): string; rollColossusVariant(): string; rollRegentVariant(): string; rollCurrents(id: string): { pattern: number; turn: number }; encounter: number; bossVariant: string;
  rollEcho(all: readonly string[], rolled: string): string; rollNhevraEcho(): string };
/** The list each boss rolls her echo from (as in World's boss spawns); the Coldmarrow uses rollNhevraEcho. */
const ECHO_POOL: Partial<Record<string, readonly string[]>> = { kiln: KILN_VARIANTS, foundry: MAELRA_ECHOES, glarewell: LENS_VARIANTS, wrackline: HESSA_VARIANTS,
  hammerdeep: ONDREL_VARIANTS, ashvents: YSMERET_VARIANTS, pressworks: OSKEL_VARIANTS, crucible: SLAG_VARIANTS, hoard: VORHULM_VARIANTS, smeltery: COLOSSUS_VARIANTS, flue: REGENT_VARIANTS };

function shape(seed: number): { route: string; layouts: string; variant: string; echo: string; events: string; named: string; waves: string } {
  const w = new World({ seed, dungeon, tier, omens: [], cls: 'emberwright' });
  const q = w as unknown as Inner;
  const layouts = w.route.map((id, k) => { q.encounter = k; q.rollLayout(id); return dungeon === 'wrackline' ? `${w.layout}/${q.rollCurrents(id).pattern}` : w.layout; });
  // Phase 14 X8: each fight's arena event and the delve's named foe (where, and its trait) are part of the shape too.
  const events = w.route.map((id, k) => w.arenaEventAt(k, id) || '-').join(',');
  const np = w.namedPlan();
  const named = np ? `${np.at}:${np.affix}` : '-';
  // Phase 15 Y1/Y8: each fight's wave shape ('arc' is the old shape).
  const waves = w.route.map((id, k) => w.waveShapeAt(k, id)).join(',');
  const variant = dungeon === 'kiln' ? q.rollKilnVariant() : dungeon === 'foundry' ? q.rollMaelraVariant() : dungeon === 'glarewell' ? q.rollLensVariant() : dungeon === 'coldmarrow' ? q.rollNhevraVariant() : dungeon === 'wrackline' ? q.rollHessaVariant() : dungeon === 'hammerdeep' ? q.rollOndrelVariant() : dungeon === 'ashvents' ? q.rollYsmeretVariant() : dungeon === 'pressworks' ? q.rollOskelVariant() : dungeon === 'crucible' ? q.rollSlagVariant() : dungeon === 'hoard' ? q.rollVorhulmVariant() : dungeon === 'smeltery' ? q.rollColossusVariant() : dungeon === 'flue' ? q.rollRegentVariant() : '-';
  // Phase 16 U7: the echo the boss rolls for that version (seeded, '' below ECHO.minTier).
  q.bossVariant = variant;
  const echo = dungeon === 'coldmarrow' ? q.rollNhevraEcho() : ECHO_POOL[dungeon] ? q.rollEcho(ECHO_POOL[dungeon]!, variant) : '';
  return { events, named, waves, route: w.route.join(','), layouts: layouts.join(','), variant, echo };
}

let alike = 0, routeAlike = 0, fullBlocks = 0;
const allRoutes = new Set<string>(), allShapes = new Set<string>(), oldShapes = new Set<string>();
let withEvent = 0, withNamed = 0, withWave = 0;
const waveFights: Record<string, number> = {};
const preWave = new Set<string>();
const pairs: Record<string, number> = {};
const preEcho = new Set<string>();
for (let b = 0; b < windows; b++) {
  const seen = new Set<string>(), routes = new Set<string>();
  for (let s = 1 + b * runs; s <= (b + 1) * runs; s++) {
    const x = shape(s);
    const key = `${x.route}|${x.layouts}|${x.variant}|${x.echo}|${x.events}|${x.named}|${x.waves}`;
    preEcho.add(`${x.route}|${x.layouts}|${x.variant}|${x.events}|${x.named}|${x.waves}`);
    const pk = `${x.variant}+${x.echo || '-'}`;
    pairs[pk] = (pairs[pk] ?? 0) + 1;
    preWave.add(`${x.route}|${x.layouts}|${x.variant}|${x.events}|${x.named}`);
    const ws = x.waves.split(',');
    if (ws.some((v) => v !== 'arc')) withWave++;
    for (const v of ws) waveFights[v] = (waveFights[v] ?? 0) + 1;
    oldShapes.add(`${x.route}|${x.layouts}|${x.variant}`);
    if (x.events.replace(/[-,]/g, '')) withEvent++;
    if (x.named !== '-') withNamed++;
    seen.add(key); routes.add(x.route); allRoutes.add(x.route); allShapes.add(key);
  }
  alike += runs - seen.size;
  routeAlike += runs - routes.size;
  if (seen.size === runs) fullBlocks++;
}
console.log(`${dungeon} tier ${tier}: ${windows} blocks of ${runs} runs`);
console.log(`  runs that repeat an earlier run's whole shape in their block: ${alike} of ${runs * windows}; blocks with no repeat: ${fullBlocks}/${windows}`);
console.log(`  runs that repeat an earlier route alone: ${routeAlike} of ${runs * windows}`);
console.log(`  distinct routes seen: ${allRoutes.size}; distinct shapes: ${allShapes.size} (${oldShapes.size} without arena events and the named foe)`);
console.log(`  runs with an arena event: ${withEvent} of ${runs * windows}; with a named foe: ${withNamed}`);
console.log(`  distinct shapes without wave shapes: ${preWave.size}; runs with a wave that isn't an arc: ${withWave} of ${runs * windows}`);
console.log(`  fights by wave shape: ${JSON.stringify(waveFights)}`);
console.log(`  distinct shapes without the echo: ${preEcho.size}; boss version+echo pairs (${Object.keys(pairs).length}): ${JSON.stringify(pairs)}`);
