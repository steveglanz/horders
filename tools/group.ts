// Group dungeon check: a party of bots, each hero driving its own input.
// PARTY=bulwark,lumen,duskblade,emberwright (first is the main hero), DUNGEON=hammerdeep, TIER=n, SEEDS=...
// HEROES=dir with <cls>/hero-t6-0.json (the skills team's heroes-r2) gives every hero that hero's gear and passives.
// OMENS=client|rotate|none|ids picks the Omens (tools/omenopt.ts); the default is none, though the client plays 1 to 3 from tier 3.
// SKILL=1 bot skill. TUNE=SLAG.searMult=0.4,ENEMIES.grandmotherSlag.hp=22000 overrides tuning numbers for the run.
import * as WORLD from '../sim/world';
import { World, WorldOptions } from '../sim/world';
import { ENEMIES } from '../sim/content/enemies';
import { BOT_PARTY, botChoose, botInput, reactBot } from '../sim/bot';
import { existsSync, readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import type { ClassId } from '../sim/content/emberwright';
import type { Item } from '../sim/content/items';
import { SET_SLOTS, SET_TUNING, SetId } from '../sim/content/sets';
import { TALENTS, TalentId } from '../sim/content/emberwright';
import { toolOmens } from './omenopt';

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
// REACT=0.3 FORGET=0.2 STEPERR=0.5 (as tools/balance.ts) gives each hero reactBot's reaction time and mistakes: average skill.
const react = Number(process.env.REACT ?? 0), forget = Number(process.env.FORGET ?? 0), stepErr = Number(process.env.STEPERR ?? 0);
// HALLS=1 plays the Halls map (HALLS_BETA=1 for one still in beta). RAIDTRASH=1 makes a raid map's openers trash (KILNTRASH=1 the Kiln's).
// ONDRELV2=1 plays the staged Ondrel (design, ondrel-v2.md). OSKELV2=1 the staged Oskel (oskel-v2.md); it prints crush-line hits.
// YSMERETV2=1 plays the two-stage Ysmeret (design, ysmeret-v2.md); TUNE=YSMERETV2.split=0 keeps only her Bellow change.
const hallsMap = process.env.HALLS === '1', hallsBeta = process.env.HALLS_BETA === '1';
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
// OSKELV2: crush-line hits, and the fights that reached the belt (stage 2) and full speed (stage 3).
const os = { hits: 0, belt: 0, full: 0, by: {} as Record<string, number>, ticks: 0, tankBoss: 0, tankHealer: 0, downOk: 0, downMiss: 0, bossTicks: 0, flips: 0 };
/** STIRHURT=1: Phase 15 Y10's judged cost of each trash clear (the worst hero against their class bar), as percentiles. */
const fightHurts: number[] = [];
/** STIRHURT=1: how often each class was the worst-off hero of a cleared fight. */
const worstBy: Record<string, number> = {};
// YTRACE=1: Ysmeret's fight, for design (25 Nov): who dies first, to what, at what share of her health, the vents, and
// whether the tank stands in a vent when Bellow Slam lands.
const ytrace = process.env.YTRACE === '1';
const yt = { fights: 0, wins: 0, firstRole: {} as Record<string, number>, firstCause: {} as Record<string, number>, cause: {} as Record<string, number>,
  firstAt: [] as number[], endAt: [] as number[], enraged: 0, split: 0, s2ticks: 0, s2same: 0, s2time: [] as number[], s2start: 0, s2pair: 0, s2hurt: {} as Record<string, number>, s2gain: {} as Record<string, number>, s2reach: 0, s2dist: 0, flares: 0, vents: 0, ventsMissed: 0, bellows: 0, bellowInVent: 0, deadAll: 0 };
let ysFirst = false, ysOn = false;
const role = (cls: string) => (cls === 'bulwark' ? 'tank' : cls === 'lumen' ? 'healer' : 'dps');
const bump2 = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
function ysTick(w: World, before: number[]): void {
  const b = w.enemies[w.bossIndex];
  if (!b || b.kind !== 'ysmeret') return;
  if (!ysOn) { ysOn = true; ysFirst = false; yt.fights++; }
  const f = b.alive ? b.hp / b.maxHp : 0;
  if (w.ysStage === 2) {
    if (!yt.s2start) { yt.s2start = w.time; yt.split++; }
    const fl = w.enemies.filter((e) => e.alive && e.kind === 'ysmeret');
    if (fl.length === 2) {
      const near = (k: number) => { const q = w.hero(k).player; return fl.reduce((bi, e, j) => (Math.hypot(e.x - q.x, e.y - q.y) < Math.hypot(fl[bi].x - q.x, fl[bi].y - q.y) ? j : bi), 0); };
      const up = w.heroes.map((_, k) => k).filter((k) => w.hero(k).player.hp > 0);
      yt.s2ticks++;
      if (up.length > 1 && up.every((k) => near(k) === near(up[0]))) yt.s2same++;
      // Can the healer reach the tank? (LUMEN_RANGE 500, before Long Note ranks.)
      const ti = w.heroes.findIndex((h) => h.cls === 'bulwark'), li = w.heroes.findIndex((h) => h.cls === 'lumen');
      if (ti >= 0 && li >= 0 && up.includes(ti) && up.includes(li)) {
        const a = w.hero(ti).player, c = w.hero(li).player, d = Math.hypot(a.x - c.x, a.y - c.y);
        yt.s2pair++; yt.s2dist += d; if (d <= 500) yt.s2reach++;
        for (const k of [ti, li]) {
          const dh = w.hero(k).player.hp - before[k], r = role(w.heroes[k].cls);
          if (dh > 0) yt.s2gain[r] = (yt.s2gain[r] ?? 0) + dh; else yt.s2hurt[r] = (yt.s2hurt[r] ?? 0) - dh;
        }
      }
    }
  }
  for (const ev of w.events) {
    if (ev.type === 'ysFlare') yt.flares++;
    if (ev.type === 'soak' && ev.owner === -2) { yt.vents++; if (!ev.ok) yt.ventsMissed++; }
    if (ev.type === 'castDone' && ev.name === 'Bellow Slam') {
      yt.bellows++;
      const t = w.heroes.findIndex((h) => h.cls === 'bulwark');
      if (t >= 0) {
        const q = w.hero(t).player;
        const inVent = w.telegraphs.some((g) => g.alive && g.kind === 'soak' && g.owner === -2 && Math.hypot(g.x - q.x, g.y - q.y) < g.r);
        if (inVent) yt.bellowInVent++;
      }
    }
  }
  w.heroes.forEach((h, i) => {
    const q = w.hero(i).player;
    if (before[i] > 0 && q.hp <= 0) {
      const casts = w.events.filter((e) => e.type === 'castDone').map((e) => (e as { name: string }).name);
      const vent = w.events.some((e) => e.type === 'soak' && e.owner === -2 && !e.ok);
      const why = vent ? 'empty vent' : casts.includes('Bellow Slam') ? 'Bellow Slam' : casts.includes('Scatter Embers') ? 'Scatter Embers' : (q.lastHurtBy ?? 'other');
      const tag = why + (w.bossEnraged ? ' (enraged)' : '') + (w.ysStage ? ` [S${w.ysStage}]` : '');
      bump2(yt.cause, role(h.cls) + ': ' + tag);
      if (!ysFirst) { ysFirst = true; bump2(yt.firstRole, role(h.cls)); bump2(yt.firstCause, role(h.cls) + ': ' + tag); yt.firstAt.push(Math.round(100 * f)); }
    }
  });
}
function ysEnd(w: World, won: boolean): void {
  if (!ysOn) return;
  ysOn = false;
  if (yt.s2start) { yt.s2time.push(Math.round(w.time - yt.s2start)); yt.s2start = 0; }
  if (won) yt.wins++;
  else { const b = w.enemies[w.bossIndex]; yt.endAt.push(b ? Math.round((100 * b.hp) / b.maxHp) : 0); if (w.heroes.every((_, i) => w.hero(i).player.hp <= 0)) yt.deadAll++; }
  if (w.bossEnraged) yt.enraged++;
}
function ysReport(): void {
  const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : '-');
  const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
  console.log(`ytrace fights=${yt.fights} wins=${yt.wins} enragedFights=${yt.enraged} vents=${yt.vents} ventsMissed=${yt.ventsMissed} bellows=${yt.bellows} tankInVentAtBellow=${yt.bellowInVent}`);
  console.log(`ytrace firstDeath role=${JSON.stringify(yt.firstRole)} herHpAtFirstDeath avg=${avg(yt.firstAt)}% median=${med(yt.firstAt)}%  herHpAtLoss avg=${avg(yt.endAt)}%`);
  console.log(`ytrace firstDeathCause=${JSON.stringify(yt.firstCause)}`);
  console.log(`ytrace allDeaths=${JSON.stringify(yt.cause)}`);
  if (yt.split) console.log(`ytrace stage2 reached=${yt.split} avgSecs=${avg(yt.s2time)} flares=${yt.flares} bothHeroesNearSameFlame=${(100 * yt.s2same / Math.max(1, yt.s2ticks)).toFixed(0)}% tankInHealReach=${(100 * yt.s2reach / Math.max(1, yt.s2pair)).toFixed(0)}% tankHealerDist=${(yt.s2dist / Math.max(1, yt.s2pair)).toFixed(0)}`);
  if (yt.split) console.log(`ytrace stage2 (tank and healer both up) net hp lost=${JSON.stringify(Object.fromEntries(Object.entries(yt.s2hurt).map(([k, v]) => [k, Math.round(v)])))} hp gained=${JSON.stringify(Object.fromEntries(Object.entries(yt.s2gain).map(([k, v]) => [k, Math.round(v)])))}`);
}
for (const seed of seeds) {
  const [main, ...rest] = classes;
  const mp = profile(main);
  const opts: WorldOptions = {
    seed, halls: hallsMap, hallsBeta, kilnTrash: process.env.KILNTRASH === '1', raidTrash: process.env.RAIDTRASH === '1', ondrelV2: process.env.ONDRELV2 === '1', ysmeretV2: process.env.YSMERETV2 === '1', oskelV2: process.env.OSKELV2 === '1', dungeon: (process.env.DUNGEON as 'hammerdeep') ?? 'hammerdeep', tier: Number(process.env.TIER ?? 4), omens: toolOmens(Number(process.env.TIER ?? 4), seed), cls: main, stance: process.env.STANCE as 'anvil' | undefined, alt: altFor(main),
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
  const drive = w.heroes.map((_, i) => (react || forget || stepErr ? reactBot(react, skill, { forget, stepErr, salt: seed * 16 + i }) : (x: World) => botInput(x, skill)));
  // A map run walks between its fights, so it gets longer before it counts as stuck.
  while (w.state !== 'ended' && w.time < (hallsMap ? 1500 : 900)) {
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
    const before = w.heroes.map((_, i) => w.hero(i).player.hp);
    const crushBefore = w.osCrushHits, dirBefore = w.osDir;
    w.step(inputs);
    if (w.osStage >= 2 && w.osDir !== dirBefore) os.flips++;
    if (w.osStage >= (process.env.OSDBG ? Number(process.env.OSDBG) : 2) && w.bossIndex >= 0 && w.enemies[w.bossIndex]?.kind === 'oskel') {
      if (w.osCrushHits > crushBefore) w.heroes.forEach((h, k) => { const q = w.hero(k).player; if (q.lastHurtBy === 'the crush line' && q.hp < before[k]) os.by[h.cls] = (os.by[h.cls] ?? 0) + 1; });
      const ti = w.heroes.findIndex((h) => h.cls === 'bulwark'), li = w.heroes.findIndex((h) => h.cls === 'lumen'), b = w.enemies[w.bossIndex];
      if (ti >= 0 && b?.alive && w.hero(ti).player.hp > 0) {
        const t = w.hero(ti).player; os.ticks++; os.tankBoss += Math.hypot(t.x - b.x, t.y - b.y);
        if (li >= 0 && w.hero(li).player.hp > 0) os.tankHealer += Math.hypot(t.x - w.hero(li).player.x, t.y - w.hero(li).player.y);
      }
      for (const ev of w.events) if (ev.type === 'soak' && ev.owner === -3) { if (ev.ok) os.downOk++; else os.downMiss++; }
    }
    if (w.bossSpawned && !bossAt) bossAt = w.time;
    if (ytrace && w.bossSpawned && w.bossIndex >= 0) ysTick(w, before);
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
      if (ev.type === 'tithe') bump(ev.ok ? 'titheShared' : 'titheMissed');
      if (ev.type === 'encounterClear') {
        fightHurts.push(w.fightHurt);
        const k = w.fightWorst;
        const who = k < 0 ? 'none' : `${w.heroes[k].cls}${w.heroData(k).player.stance === 'anvil' ? '(anvil)' : ''}`;
        worstBy[who] = (worstBy[who] ?? 0) + 1;
      }
      if (ev.type === 'phase' && w.ondrelStage > 0) bump('stage' + ev.phase);
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
  if (w.osStage >= 2) { os.belt++; os.hits += w.osCrushHits; if (w.osStage === 3) os.full++; }
  if (s.victory) wins++;
  if (ytrace) ysEnd(w, s.victory);
  const alive = w.heroes.map((_, i) => (w.hero(i).player.hp > 0 ? 'up' : 'down')).join('/');
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)} boss=${bossAt ? (s.time - bossAt).toFixed(0) + 's' : '-'} fights=${w.encounter} heroes=${alive} boss=${w.bossIndex >= 0 ? Math.round((100 * w.enemies[w.bossIndex].hp) / w.enemies[w.bossIndex].maxHp) + '%' : '-'} deaths=${deaths.join(',')} ${JSON.stringify(c)}`);
}
if (process.env.STIRHURT === '1' && fightHurts.length) {
  const q = [...fightHurts].sort((x, y) => x - y);
  const at = (f: number) => q[Math.min(q.length - 1, Math.floor(f * q.length))].toFixed(3);
  console.log(`stirhurt n=${q.length} p25=${at(0.25)} p50=${at(0.5)} p75=${at(0.75)} p90=${at(0.9)} worst=${JSON.stringify(worstBy)}`);
}
if (ytrace) ysReport();
console.log(`party ${classes.join('+')}: wins ${wins}/${seeds.length}`);
if (process.env.OSKELV2 === '1') console.log(`oskelv2 beltFights=${os.belt} fullSpeedFights=${os.full} crushHits=${os.hits} perBeltFight=${(os.hits / Math.max(1, os.belt)).toFixed(2)} flips=${os.flips} flipsPerBeltFight=${(os.flips / Math.max(1, os.belt)).toFixed(1)} by=${JSON.stringify(os.by)} beltDownstrokes ok=${os.downOk} missed=${os.downMiss} avgTankToOskel=${(os.tankBoss / Math.max(1, os.ticks)).toFixed(0)} avgTankToHealer=${(os.tankHealer / Math.max(1, os.ticks)).toFixed(0)}`);
