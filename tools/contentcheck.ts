// C7 content QA: can a run get stuck? Runs the newest content with good and weak bots
// and reports any run that hasn't ended by 3000 s of sim time (a soft-lock), plus the
// longest run and the most foes alive at once. Burnout should end every fight.
// Usage: HEROES=<heroes-r2 dir> npx vite-node tools/contentcheck.ts   (SEEDS=1,2,... to change the seeds)
import { HEAT_IDS, HEAT_POOLS } from '../sim/content/heat';
import { World, WorldOptions, LayoutId, TICK, ARENA_EVENTS, ARENA_EVENT_POOLS, ArenaEventId } from '../sim/world';
import { NAMED, AFFIXES } from '../sim/content/named';
import type { DungeonId } from '../sim/content/dungeon';
import { botChoose, botInput } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';
import { existsSync, readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';

// HEROES=dir with <cls>/<HERO_FILE> (the skills team's heroes-r2) gives every hero that hero's gear.
const dir = process.env.HEROES;
const file = process.env.HERO_FILE ?? 'hero-t8-0.json';
const gear = (cls: ClassId) => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  if (!f || !existsSync(f)) return {};
  const h: HeroProfile = JSON.parse(readFileSync(f, 'utf8'));
  return { gear: equippedItems(h), passives: h.passives };
};
const main = (cls: ClassId) => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  if (!f || !existsSync(f)) return { cls };
  const h: HeroProfile = JSON.parse(readFileSync(f, 'utf8'));
  return { cls, gear: equippedItems(h), passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId };
};

const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen'];
// ONLY=wrackline runs just the cases whose label starts with it.
const only = process.env.ONLY;
/**
 * `dropWhen`: once it returns a hero index (not -1), that hero stops playing (no input, first card in
 * drafts) for the rest of the run, like a guest who left: their hero stays in the world, idle.
 */
type Case = { label: string; opts: WorldOptions; skill: number; dropWhen?: (w: World) => number; setup?: () => void };
const downstrokeUp = (w: World) => w.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -3);
const crawUp = (w: World) => w.enemies.some((e) => e.alive && e.kind === 'craw');
/** The Hoard: the hero inside Old Vorhulm right now, or -1. */
const swallowedHero = (w: World) => w.heroes.findIndex((_, i) => (w.heroPlayer(i).swallowT ?? 0) > 0);
const cases: Case[] = [];
for (const seed of seeds) for (const skill of [1, 0.5]) {
  for (const cls of CLASSES) cases.push({ label: `coldmarrow ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'coldmarrow', tier: 10, omens: [] } });
  for (const cls of CLASSES) cases.push({ label: `wrackline ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'wrackline', tier: 10, omens: [] } });
  cases.push({ label: 'crucible party', skill, opts: { seed, ...main('bulwark'), dungeon: 'crucible', tier: 8, omens: [], worldBoss: 'Grandmother Slag',
    party: (['lumen', 'duskblade', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  cases.push({ label: 'crucible no healer', skill, opts: { seed, ...main('bulwark'), dungeon: 'crucible', tier: 8, omens: [],
    party: (['emberwright', 'duskblade', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  // The Pressworks (group, tier 10): Oskel's Downstroke needs an un-Pressed hero under it every time.
  const press = (label: string, lead: ClassId, rest: ClassId[], drop?: number) =>
    cases.push({ label, skill, dropWhen: drop === undefined ? undefined : (w) => (downstrokeUp(w) ? drop : -1), opts: { seed, ...main(lead), dungeon: 'pressworks', tier: 10, omens: [], party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  press('pressworks duo', 'bulwark', ['lumen']);
  press('pressworks trio', 'bulwark', ['lumen', 'emberwright']);
  press('pressworks four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  press('pressworks no tank', 'emberwright', ['lumen', 'duskblade']);
  press('pressworks drop mid-Downstroke', 'bulwark', ['lumen', 'emberwright'], 2);
  press('pressworks duo drop mid-Downstroke', 'bulwark', ['lumen'], 1);
  // The Hoard (raid 2, tier 9, four heroes): Swallow and the Craw, then Ember Feast.
  const hoard = (label: string, lead: ClassId, rest: ClassId[], dropWhen?: (w: World) => number) =>
    cases.push({ label, skill, dropWhen, opts: { seed, ...main(lead), dungeon: 'hoard', tier: 9, omens: [], worldBoss: 'Old Vorhulm', party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  hoard('hoard four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  hoard('hoard no healer', 'bulwark', ['emberwright', 'duskblade', 'emberwright']);
  hoard('hoard no tank', 'emberwright', ['lumen', 'duskblade', 'emberwright']);
  // A guest leaves while swallowed (they're inside), or while someone else is and the Craw stands.
  hoard('hoard drop while swallowed', 'bulwark', ['lumen', 'duskblade', 'emberwright'], swallowedHero);
  hoard('hoard drop while the Craw stands', 'bulwark', ['lumen', 'duskblade', 'emberwright'], (w) => {
    const k = swallowedHero(w);
    return k >= 0 && crawUp(w) ? [1, 2, 3].find((i) => i !== k)! : -1;
  });
  // The Smeltery (raid 3, tier 10, four heroes): get behind the Cinder Colossus; Wheel turns on whoever hurt him most.
  const smelt = (label: string, lead: ClassId, rest: ClassId[], dropWhen?: (w: World) => number) =>
    cases.push({ label, skill, dropWhen, opts: { seed, ...main(lead), dungeon: 'smeltery', tier: 10, omens: [], worldBoss: 'The Cinder Colossus', party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  smelt('smeltery four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  smelt('smeltery no healer', 'bulwark', ['emberwright', 'duskblade', 'emberwright']);
  smelt('smeltery no tank', 'emberwright', ['lumen', 'duskblade', 'emberwright']);
  // A guest leaves while Wheel is being cast: the non-tank who hurt him most (the one he is about to turn on).
  smelt('smeltery drop mid-Wheel', 'bulwark', ['lumen', 'duskblade', 'emberwright'], (w) => {
    if (!w.enemies.some((e) => e.alive && e.kind === 'colossus' && e.castId === 'wheel')) return -1;
    let pick = -1, most = -1;
    for (let k = 1; k < w.heroes.length; k++) if (!w.isTank(k) && (w.colDmg[k] ?? 0) > most) { most = w.colDmg[k] ?? 0; pick = k; }
    return pick;
  });
  // Phase 11 variety: the Kiln's layouts and Kiln Draw (rolled per seed) under each of Today's Heats, and the Drowned Foundry's new fights.
  for (const heat of HEAT_IDS) cases.push({ label: `kiln heat ${heat}`, skill, opts: { seed, ...main(CLASSES[seed % 4]), dungeon: 'kiln', tier: 1 + (seed % 2), omens: [], heat } });
  for (const cls of CLASSES) cases.push({ label: `glarewell ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'glarewell', tier: 7, omens: [] } });
  for (const cls of CLASSES) cases.push({ label: `foundry ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'foundry', tier: 4, omens: [] } });
  // The Hammerdeep (group, tier 4): the W2 fights and layouts, and Ondrel's Ironload (rolled per seed).
  cases.push({ label: 'hammerdeep trio', skill, opts: { seed, ...main('bulwark'), dungeon: 'hammerdeep', tier: 6, omens: [], party: (['lumen', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  cases.push({ label: 'hammerdeep duo', skill, opts: { seed, ...main('bulwark'), dungeon: 'hammerdeep', tier: 6, omens: [], party: (['lumen'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  // The Ashvents (group, tier 7): the W2 fights and Ysmeret's Wandering Vents (rolled per seed).
  cases.push({ label: 'ashvents trio', skill, opts: { seed, ...main('bulwark'), dungeon: 'ashvents', tier: 7, omens: [], party: (['lumen', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  // The Flue (raid 4, tier 11, four heroes): pass the Decree before it bursts.
  const flue = (label: string, lead: ClassId, rest: ClassId[], dropWhen?: (w: World) => number) =>
    cases.push({ label, skill, dropWhen, opts: { seed, ...main(lead), dungeon: 'flue', tier: 11, omens: [], worldBoss: 'The Furnace Regent', party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  flue('flue four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  flue('flue no healer', 'bulwark', ['emberwright', 'duskblade', 'emberwright']);
  flue('flue no tank', 'emberwright', ['lumen', 'duskblade', 'emberwright']);
  // A guest leaves while holding a Decree: nobody walks it on, so it must still burst or fade.
  flue('flue drop holding a Decree', 'bulwark', ['lumen', 'duskblade', 'emberwright'], (w) => w.regentDecree.find((d) => d.hero > 0)?.hero ?? -1);
}
// Phase 13 E1/E5: raid trash rolls stones and vents (never the boss fight). Layouts are hashed from the seed, so
// for each raid pick the first RAID_LAYOUT_SEEDS seeds whose route has a pillars (or vents) trash fight, and play
// them with four heroes: bots must path round the stones and through the flares with a full party.
const RAID_LAYOUT_SEEDS = Number(process.env.RAID_LAYOUT_SEEDS ?? 4);
const RAIDS: { dungeon: DungeonId; tier: number; worldBoss: string }[] = [
  { dungeon: 'crucible', tier: 8, worldBoss: 'Grandmother Slag' },
  { dungeon: 'hoard', tier: 9, worldBoss: 'Old Vorhulm' },
  { dungeon: 'smeltery', tier: 10, worldBoss: 'The Cinder Colossus' },
  { dungeon: 'flue', tier: 11, worldBoss: 'The Furnace Regent' },
];
const layoutSeeds = (r: (typeof RAIDS)[number], want: LayoutId) => {
  const out: number[] = [];
  for (let s = 1; out.length < RAID_LAYOUT_SEEDS && s < 500; s++) {
    const w = new World({ seed: s, cls: 'bulwark', dungeon: r.dungeon, tier: r.tier, omens: [], party: [{ cls: 'lumen' }, { cls: 'duskblade' }, { cls: 'emberwright' }] });
    if (w.route.some((id, k) => w.layoutAt(k, id) === want)) out.push(s);
  }
  return out;
};
const RAID_LAYOUT_CASES: [(typeof RAIDS)[number], LayoutId, number[]][] = RAIDS.flatMap((r) => (["pillars", "vents"] as LayoutId[]).map((want) => [r, want, layoutSeeds(r, want)] as [(typeof RAIDS)[number], LayoutId, number[]]));
if (!only || RAIDS.some((r) => only.startsWith(r.dungeon))) for (const [r, want, s] of RAID_LAYOUT_CASES) console.log(`${r.dungeon} ${want} seeds ${s.join(",")}`);
for (const [r, want, picked] of RAID_LAYOUT_CASES) for (const seed of picked) for (const skill of [1, 0.5]) {
  const raid = (label: string, lead: ClassId, rest: ClassId[], dropWhen?: (w: World) => number) =>
    cases.push({ label, skill, dropWhen, opts: { seed, ...main(lead), dungeon: r.dungeon, tier: r.tier, omens: [], worldBoss: r.worldBoss, party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  raid(`${r.dungeon} ${want} four`, 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  raid(`${r.dungeon} ${want} no tank`, 'emberwright', ['lumen', 'duskblade', 'emberwright']);
  // A guest leaves once the stones or vents are down: their idle hero stays on the floor for the rest of the run.
  raid(`${r.dungeon} ${want} drop in the layout fight`, 'bulwark', ['lumen', 'duskblade', 'emberwright'], (w) => (w.phase === 'fight' && w.layout === want ? 3 : -1));
}
// Phase 14 X8: every marked-foe trait and every arena event, forced (NAMED.forceAffix/forceNamed, ARENA_EVENTS.force),
// so each one is played every run. X8_SEEDS seeds (default 4) at skill 1 and 0.5.
const x8Seeds = (process.env.X8_SEEDS ?? '1,2,3,4').split(',').map(Number);
const resetForces = () => { NAMED.forceAffix = -1; NAMED.forceNamed = 0; ARENA_EVENTS.force = ''; };
const X8_SOLO: { dungeon: DungeonId; tier: number }[] = [
  { dungeon: 'kiln', tier: 2 }, { dungeon: 'foundry', tier: 4 }, { dungeon: 'glarewell', tier: 7 }, { dungeon: 'coldmarrow', tier: 10 }, { dungeon: 'wrackline', tier: 13 },
];
for (const seed of x8Seeds) for (const skill of [1, 0.5]) {
  for (const [ai, affix] of AFFIXES.entries()) {
    const setup = () => { resetForces(); NAMED.forceAffix = ai; NAMED.forceNamed = 1; };
    for (const d of X8_SOLO) cases.push({ label: `named ${affix} ${d.dungeon}`, skill, setup, opts: { seed, ...main(CLASSES[seed % 4]), dungeon: d.dungeon, tier: d.tier, omens: [] } });
    cases.push({ label: `named ${affix} hammerdeep trio`, skill, setup, opts: { seed, ...main('bulwark'), dungeon: 'hammerdeep', tier: 6, omens: [], party: (['lumen', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  }
  // Phase 14 X1: every solo dungeon under each of its Heats (the Kiln's are the kiln heat cases above).
  for (const d of X8_SOLO) if (d.dungeon !== 'kiln') for (const heat of HEAT_POOLS[d.dungeon] ?? [])
    cases.push({ label: `heat ${heat} ${d.dungeon}`, skill, opts: { seed, ...main(CLASSES[seed % 4]), dungeon: d.dungeon, tier: d.tier, omens: [], heat } });
  for (const d of X8_SOLO) for (const ev of ARENA_EVENT_POOLS[d.dungeon] ?? []) for (const cls of CLASSES)
    cases.push({ label: `arena ${ev} ${d.dungeon} ${cls}`, skill, setup: () => { resetForces(); ARENA_EVENTS.force = ev as ArenaEventId; }, opts: { seed, ...main(cls), dungeon: d.dungeon, tier: d.tier, omens: [] } });
}
let stuck = 0, longest = 0, mostAlive = 0;
const layoutFights: Record<string, number> = {};
const tally: Record<string, { runs: number; wins: number; longest: number }> = {};
const seenEvents: Record<string, number> = {};
let trapped = 0;
for (const c of cases.filter((k) => !only || k.label.startsWith(only))) {
  resetForces();
  c.setup?.();
  const w = new World(c.opts);
  const inStone = w.heroes.map(() => 0);
  let maxAlive = 0;
  let gone = -1;
  let lastEnc = -1;
  while (w.state !== 'ended' && w.time < 3000) {
    if (w.state === 'draft') {
      const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
      w.use(h);
      const pick = h === gone ? 0 : botChoose(w);
      w.use(0);
      w.choose(pick, h);
      continue;
    }
    if (w.phase === 'fight' && w.encounter !== lastEnc) { lastEnc = w.encounter; if (w.layout !== 'open') layoutFights[w.layout] = (layoutFights[w.layout] ?? 0) + 1; }
    if (c.dropWhen && gone < 0) gone = c.dropWhen(w);
    const inputs = w.heroes.map((_, i) => { if (i === gone) return { x: 0, y: 0 }; w.use(i); const inp = botInput(w, c.skill); w.use(0); return inp; });
    w.step(inputs.length === 1 ? inputs[0] : inputs);
    for (const e of w.events) {
      if (e.type === 'arenaEvent' && e.stage === 'land') seenEvents[`arena ${e.id}`] = (seenEvents[`arena ${e.id}`] ?? 0) + 1;
      if (e.type === 'namedSpawn') seenEvents[`named ${e.affix}`] = (seenEvents[`named ${e.affix}`] ?? 0) + 1;
    }
    // A hero standing inside a stone (a Cave-in landing on them) for 3 s or more is trapped.
    w.heroes.forEach((_, i) => {
      const p = w.heroPlayer(i);
      const inside = p.hp > 0 && w.stones.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r);
      inStone[i] = inside ? inStone[i] + TICK : 0;
      if (inStone[i] >= 3 && inStone[i] < 3 + TICK) { trapped++; console.log(`TRAPPED ${c.label} skill ${c.skill} seed ${c.opts.seed}: hero ${i} inside a stone for 3 s at encounter ${w.encounter}`); }
    });
    maxAlive = Math.max(maxAlive, w.aliveEnemies);
  }
  const key = `${c.label} skill ${c.skill}`;
  const t = (tally[key] ??= { runs: 0, wins: 0, longest: 0 });
  t.longest = Math.max(t.longest, w.time);
  t.runs++;
  if (w.state !== 'ended') { stuck++; console.log(`STUCK ${key} seed ${c.opts.seed} at encounter ${w.encounter}`); }
  // Nobody may be left inside Old Vorhulm once the run is over.
  const inside = w.heroes.findIndex((_, i) => (w.heroPlayer(i).swallowT ?? 0) > 0);
  if (inside >= 0) { stuck++; console.log(`STUCK INSIDE ${key} seed ${c.opts.seed}: hero ${inside} still swallowed at the end`); }
  if (c.dropWhen && gone < 0) console.log(`NO DROP ${key} seed ${c.opts.seed}: the drop moment never came`);
  else if (w.summary().victory) t.wins++;
  longest = Math.max(longest, w.time);
  mostAlive = Math.max(mostAlive, maxAlive);
}
for (const [k, t] of Object.entries(tally)) console.log(`${k}: ${t.wins}/${t.runs} wins, longest ${t.longest.toFixed(0)} s`);
resetForces();
console.log(`layout fights played ${JSON.stringify(layoutFights)}`);
console.log(`forced traits and events seen ${JSON.stringify(seenEvents)}; heroes trapped in a stone ${trapped}`);
console.log(`runs ${cases.filter((k) => !only || k.label.startsWith(only)).length}, stuck ${stuck}, longest ${longest.toFixed(0)} s, most foes alive ${mostAlive}`);
