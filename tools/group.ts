// Group dungeon check: a party of bots, each hero driving its own input.
// PARTY=bulwark,lumen,duskblade,emberwright (first is the main hero), DUNGEON=hammerdeep, TIER=n, SEEDS=...
// HEROES=dir with <cls>/hero-t6-0.json (the skills team's heroes-r2) gives every hero that hero's gear and passives.
// SKILL=1 bot skill. TUNE=SLAG.searMult=0.4,ENEMIES.grandmotherSlag.hp=22000 overrides tuning numbers for the run.
import * as WORLD from '../sim/world';
import { World, WorldOptions } from '../sim/world';
import { ENEMIES } from '../sim/content/enemies';
import { BOT_PARTY, botChoose, botInput } from '../sim/bot';
import { existsSync, readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import type { ClassId } from '../sim/content/emberwright';
import type { Item } from '../sim/content/items';
import { SET_SLOTS, SET_TUNING, SetId } from '../sim/content/sets';
import { TALENTS, TalentId } from '../sim/content/emberwright';

const classes = (process.env.PARTY ?? 'bulwark,lumen,duskblade,emberwright').split(',') as ClassId[];
const dir = process.env.HEROES;
/** ALT=1 turns the ability option on for every hero; ALT=bulwark,lumen for those classes only. */
const altFor = (cls: ClassId): boolean => process.env.ALT === '1' || (process.env.ALT ?? '').split(',').includes(cls);
const file = process.env.HERO_FILE ?? 'hero-t6-0.json';
const warned = new Set<ClassId>();
const profile = (cls: ClassId): HeroProfile | null => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  if (f && !existsSync(f) && !warned.has(cls)) {
    // A missing file means that hero fights with no gear, no passives and the default level.
    warned.add(cls);
    console.warn(`WARNING: no hero file ${f}; the ${cls} runs with no gear`);
  }
  return f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const skill = Number(process.env.SKILL ?? 1);
const grants = (process.env.GRANT ?? '').split(',').filter(Boolean).map((kv) => kv.split(':')).map(([id, r]) => [id as TalentId, Number(r ?? 1)] as const);
if (grants.length) {
  const proto = World.prototype as unknown as { branchRanks(b: string): number; talents: Partial<Record<TalentId, number>>; cls: ClassId };
  const orig = proto.branchRanks;
  proto.branchRanks = function (this: typeof proto, b: string): number {
    let n = orig.call(this, b);
    for (const [id, r] of grants) if (TALENTS[id].branch === b && TALENTS[id].cls === this.cls) n -= Math.min(r, this.talents[id] ?? 0);
    return n;
  };
}
// SET=deepguard SETN=2|3 turns every hero's head, hands and trinket (in that order) into pieces of that set.
const setId = process.env.SET as SetId | undefined;
const setN = Number(process.env.SETN ?? 3);
const tagSet = (items: Item[]): Item[] => {
  if (!setId) return items;
  let n = 0;
  return items.map((it) => (SET_SLOTS.includes(it.slot) && n++ < setN ? { ...it, set: setId } : it));
};
// REVIVE=0: bots never pick up downed allies (BOT_PARTY.revive, on by default).
BOT_PARTY.revive = process.env.REVIVE !== '0';
// HUDDLE=1: ranged bots stay near an ally with no set (BOT_PARTY.huddle).
BOT_PARTY.huddle = process.env.HUDDLE === '1';
// TUNE=SLAG.searMult=0.8,ENEMIES.grandmotherSlag.hp=20000 overrides tuning for this run only (also SET_TUNING.csCraw=0.12).
for (const kv of (process.env.TUNE ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('=');
  const keys = path.split('.');
  let o: Record<string, unknown> = keys[0] === 'ENEMIES' ? (ENEMIES as unknown as Record<string, unknown>) : keys[0] === 'SET_TUNING' ? (SET_TUNING as unknown as Record<string, unknown>) : ((WORLD as unknown as Record<string, unknown>)[keys[0]] as Record<string, unknown>);
  for (const k of keys.slice(1, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = Number(v);
}
// Phase 14 X3: ARENA=caveIn|ventSurge forces that arena event in every trash fight that can have it; ARENA=off turns them off.
if (process.env.ARENA === 'off') WORLD.ARENA_EVENTS.off = true;
else if (process.env.ARENA) WORLD.ARENA_EVENTS.force = process.env.ARENA;
// Phase 15 Y1: WAVE=off keeps every wave an arc; WAVE=pincer|ring|reinforce forces one.
if (process.env.WAVE === 'off') WORLD.WAVES.off = true;
else if (process.env.WAVE) WORLD.WAVES.force = process.env.WAVE;
// Phase 15 Y10: STIR=off turns the dungeon's stirring off; STIR=elite|named|event|wave|any stirs every trash fight after the opener.
// Phase 16 U1: ECHO=off turns boss echoes off; ECHO=<version id> forces that echo where the boss has it.
if (process.env.ECHO === 'off') WORLD.ECHO.off = true;
else if (process.env.ECHO) WORLD.ECHO.force = process.env.ECHO;
if (process.env.STIR === 'off') WORLD.STIR.off = true;
else if (process.env.STIR) WORLD.STIR.force = process.env.STIR;
const seeds = (process.env.SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);

let wins = 0;
/** STIRHURT=1: Phase 15 Y10's judged cost of each trash clear (the worst hero against their class bar), as percentiles. */
const fightHurts: number[] = [];
/** STIRHURT=1: how often each class was the worst-off hero of a cleared fight. */
const worstBy: Record<string, number> = {};
for (const seed of seeds) {
  const [main, ...rest] = classes;
  const mp = profile(main);
  const opts: WorldOptions = {
    seed, dungeon: (process.env.DUNGEON as 'hammerdeep') ?? 'hammerdeep', tier: Number(process.env.TIER ?? 4), omens: [], cls: main, stance: process.env.STANCE as 'anvil' | undefined, alt: altFor(main),
    ...(mp ? { gear: tagSet(equippedItems(mp)), passives: mp.passives, heroLevel: mp.level, nextItemId: mp.nextItemId } : {}),
    party: rest.map((cls, k) => {
      const hp = profile(cls);
      return { cls, stance: process.env.STANCE as 'anvil' | undefined, alt: altFor(cls), name: `${cls}${k + 1}`, ...(hp ? { gear: tagSet(equippedItems(hp)), passives: hp.passives } : {}) };
    }),
  };
  const w = new World(opts);
  // BOSSV=home (any boss version id) forces this run's boss version, so versions compare on the same seeds.
  if (process.env.BOSSV) {
    const q = w as unknown as Record<string, unknown>;
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(w))) if (/^roll\w+Variant$/.test(k)) q[k] = () => process.env.BOSSV;
  }
  // GRANT=leeSide:2,frontMend:2 gives each hero of the card's class those ranks from the start
  // (to measure cards the bot rarely drafts). Granted ranks don't count toward the branch's capstone,
  // so the bot's own draft and capstone timing stay as they were.
  for (const [id, r] of grants) {
    w.heroes.forEach((_, k) => {
      w.use(k);
      if (TALENTS[id].cls === w.cls) (w as unknown as { talents: Partial<Record<TalentId, number>> }).talents[id] = r;
      w.use(0);
    });
  }
  const c: Record<string, number> = {};
  const bump = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  let bossAt = 0;
  const deaths: string[] = [];
  while (w.state !== 'ended' && w.time < 900) {
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
      const inp = botInput(w, skill);
      w.use(0);
      return inp;
    });
    const before = w.heroes.map((_, i) => w.hero(i).player.hp);
    w.step(inputs);
    if (w.bossSpawned && !bossAt) bossAt = w.time;
    w.heroes.forEach((_, i) => {
      if (before[i] > 0 && w.hero(i).player.hp <= 0) {
        const casts = w.events.filter((e) => e.type === 'castDone').map((e) => (e as { name: string }).name).join('+') || 'other';
        deaths.push(`${classes[i]}@${w.time.toFixed(0)}(${casts})`);
      }
    });
    for (const ev of w.events) {
      if (ev.type === 'castDone' && ev.name === 'Long Night') {
        // Coldmarrow: did standing in someone else's brighter light soften the Long Night?
        const warm = (w as unknown as { warmthAt(x: number, y: number): number });
        w.heroes.forEach((_, i) => {
          const q = w.hero(i).player;
          if (q.hp <= 0 && before[i] <= 0) return;
          bump('night');
          if (warm.warmthAt(q.x, q.y) > (q.coal ?? 0) + 0.05) bump('nightShared');
        });
      }
      if (ev.type === 'castDone') bump('cast:' + ev.name);
      if (ev.type === 'stir') bump('stir:' + ev.id);
      if (ev.type === 'echo') bump('echo:' + ev.id);
      if (ev.type === 'encounterClear') {
        fightHurts.push(w.fightHurt);
        const k = w.fightWorst;
        const who = k < 0 ? 'none' : `${w.heroes[k].cls}${w.heroData(k).player.stance === 'anvil' ? '(anvil)' : ''}`;
        worstBy[who] = (worstBy[who] ?? 0) + 1;
      }
      if (ev.type === 'cleanse') bump('cleanse');
      if (ev.type === 'slagGrip') bump('grip');
      if (ev.type === 'revive') bump('revive');
      // The Hoard: Swallow and Ember Feast.
      if (ev.type === 'swallowed' || ev.type === 'digested' || ev.type === 'spatOut' || ev.type === 'emberTaken' || ev.type === 'emberEaten') bump(ev.type);
      // The Flue: Decrees.
      if (ev.type === 'decree' || ev.type === 'decreeBurst' || ev.type === 'officePulse') bump(ev.type);
      if (ev.type === 'decreePassed') bump(ev.done ? 'decreeDone' : 'decreePassed');
    }
  }
  const s = w.summary();
  if (s.victory) wins++;
  const alive = w.heroes.map((_, i) => (w.hero(i).player.hp > 0 ? 'up' : 'down')).join('/');
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)} boss=${bossAt ? (s.time - bossAt).toFixed(0) + 's' : '-'} fights=${w.encounter} heroes=${alive} boss=${w.bossIndex >= 0 ? Math.round((100 * w.enemies[w.bossIndex].hp) / w.enemies[w.bossIndex].maxHp) + '%' : '-'} deaths=${deaths.join(',')} ${JSON.stringify(c)}`);
}
if (process.env.STIRHURT === '1' && fightHurts.length) {
  const q = [...fightHurts].sort((x, y) => x - y);
  const at = (f: number) => q[Math.min(q.length - 1, Math.floor(f * q.length))].toFixed(3);
  console.log(`stirhurt n=${q.length} p25=${at(0.25)} p50=${at(0.5)} p75=${at(0.75)} p90=${at(0.9)} worst=${JSON.stringify(worstBy)}`);
}
console.log(`party ${classes.join('+')}: wins ${wins}/${seeds.length}`);
