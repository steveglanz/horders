/**
 * A simple autopilot used by tests and balancing scripts: kites away from the
 * horde, steps out of boss telegraphs, and drafts talents by a fixed priority.
 */
import { ARENA, BRIM, COLD, Input, IRONLOAD, REVIVE_RADIUS, WRACK, World } from './world';
import { TALENTS, TalentId } from './content/emberwright';
import { ALT_ABILITIES } from './content/classes';
import { SET_TUNING } from './content/sets';

export const BOT_PRIORITY: TalentId[] = [
  'conflagration', 'phoenixLance', 'ringOfAsh', 'cinderTide', 'searingBloom', 'ashenMantle', 'extraOrb', 'quickcast', 'ignition', 'searingBurn', 'heatSink',
  'pyroclasm', 'kindledGround', 'emberRain', 'cinderSkin', 'blazingSpeed', 'rollingInferno', 'searingFocus', 'mend',
  'flicker', 'magnetism', 'ventFed',
  'brightWick', 'deepSmoulder', 'emberCarpet', 'fastFuse', 'sootCloak', 'bankedFire', 'longKindle', 'closeWarmth',
  // Duskblade
  'crimsonTide', 'bladeStorm', 'riposte', 'openVeins', 'killingRhythm', 'shadowSlip', 'exsanguinate', 'flurryStep', 'serratedEdge', 'quickBlades', 'thirst', 'hemorrhage', 'longReach', 'thickHide',
  'momentumFlow', 'precision', 'deepCuts', 'counterstep', 'secondWind', 'evasion', 'nimble', 'readTheLane',
  'slowDrip', 'lightGrip', 'keenLunge', 'hungrySteel', 'lowStance', 'quietMend', 'turnedBack', 'sharedBreath',
  // Bulwark
  'warpath', 'thornwall', 'unbreakable', 'shieldWake', 'grudge', 'ironVigil', 'wideSweep', 'spikedShield', 'shieldEcho', 'ward', 'vengeance', 'holdTheLine',
  'batteringRam', 'lastStand', 'momentum', 'backToStone',
  'hardKnocks', 'grimTally', 'rivetedPlates', 'broadShoulders', 'fullWeight', 'slowPulse', 'leeSide', 'broadBack',
  // Lumen
  'noon', 'choirOfDawn', 'martyrsHalo', 'noonfire', 'chorus', 'haven', 'searingRadiance', 'hastedHymn', 'prism', 'kindledLight', 'sunflare', 'aegisOfLight',
  'renewal', 'lingeringSanctuary', 'blessedGround', 'reachingLight',
  'lampglowCare', 'daybreakPulse', 'steadyHalo', 'longNote', 'lanternHeart', 'hallowedEmbers', 'frontMend', 'wideDawn',
  // Slagbinder
  'twinPour', 'shatterpoint', 'clinkerHeart', 'cinderHail', 'everMolten', 'slagTide', 'heavyLob', 'thickPour', 'searingShell', 'shrapnel',
  'crustedHide', 'quickset', 'hotBlood', 'brittleMind', 'hardened', 'slagWade',
  'fastLadle', 'slagScales', 'denseGlob', 'deepCoat', 'wideSpatter', 'slowCool', 'longStand', 'wideShell',
  'smallHeal', 'stoke',
];

/** Duskblade action choices: kick casts, execute big foes, dash in, sidestep danger. */
function bladeCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && can(w, 3) && w.interruptTarget() >= 0) return 3;
  // Co-op: pulled the boss off a living Bulwark, so Sidestep to dump threat back to it.
  if (can(w, 1) && w.bossTarget === w.acting && w.heroes.some((h, k) => k !== w.acting && (h.cls === 'bulwark' || h.player.stance === 'anvil') && h.player.hp > 0)) return 1;
  // Read the Lane: step out of a lob or a charge lane (cones too) while it can still pay.
  if (attentive && can(w, 1) && w.rank('readTheLane') > 0 && w.inLaneTelegraph()) return 1;
  // Step out of a telegraph we are standing in.
  if (attentive && can(w, 1)) {
    for (const t of w.telegraphs) {
      if (!t.alive || t.kind === 'soak' || t.t > t.dur - 0.5) continue;
      if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 < (t.r + 10) ** 2 && t.shape === 'circle') return 1;
    }
  }
  const t = w.bladeTarget(w.swingReach + 60);
  if (t >= 0 && can(w, 2)) {
    const e = w.enemies[t];
    if (e.def.rank !== 'normal' || e.hp < e.maxHp * 0.35) return 2;
  }
  const far = w.bladeTarget(340);
  if (far >= 0 && can(w, 0)) {
    const e = w.enemies[far];
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius;
    if (d > 110 || (e.def.rank === 'normal' && d < 60)) return 0;
  }
  if (can(w, 1) && p.hp < p.maxHp * 0.35) return 1;
  return undefined;
}

/** Bulwark action choices: toss at casts, Anvil Skin when it hurts, slam crowds, charge big foes. */
function shieldCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && can(w, 3) && w.interruptTarget() >= 0) return 3;
  let near = 0;
  let bigClose = false;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 < 160 * 160) {
      if (e.def.rank === 'normal') near++;
      else bigClose = true;
    }
  }
  let underTelegraph = false;
  for (const t of w.telegraphs) {
    if (!t.alive || t.kind === 'soak') continue;
    if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 < (t.r + 10) ** 2) underTelegraph = true;
  }
  // Ondrel: Anvil Skin is for Anvilfall. Raise it on the wind-up when the hit is coming
  // to this hero, and don't spend it on anything else in that fight.
  // Tank-busters (Anvilfall, Bellow Slam, Ladle Pour): Anvil Skin is for them. Raise it on the
  // wind-up when the hit is coming to this hero, and don't spend it on anything else in that fight.
  const ondrel = w.busterFight;
  if (ondrel && can(w, 2) && w.busterTarget === w.acting) return 2;
  // Co-op taunt cue: the boss is on someone else, so take it back.
  if (w.tauntCue) {
    const b = w.enemies[w.bossIndex];
    const d = Math.hypot(b.x - p.x, b.y - p.y) - b.def.radius;
    if (can(w, 3) && d < 420) return 3;
    if (can(w, 1) && w.chargeTarget() === w.bossIndex) return 1;
  }
  if (!ondrel && can(w, 2) && (p.hp < p.maxHp * 0.55 || (attentive && underTelegraph && p.hp < p.maxHp * 0.85))) return 2;
  if (can(w, 0) && (near >= 3 || bigClose)) return 0;
  const c = w.chargeTarget();
  if (c >= 0 && can(w, 1)) {
    const e = w.enemies[c];
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius;
    if (d > 140 && (e.def.rank !== 'normal' || near === 0)) return 1;
  }
  return undefined;
}

/** How far to the side of its ward a co-op Lumen stands: inside Radiant Burst, outside a frontal cone. */
const LUMEN_STANDOFF = 110;
/** The Smeltery's Meltdown: below this share of health, the tank comes first for the Lumen. */
export const MELT_TANK_FIRST = 0.6;

/**
 * Co-op: the ally a Lumen should stay beside: the one with the lowest share of health,
 * when someone is below 85% (Slag Grip stacks count as missing health). -1 solo or when all are well.
 */
export function lumenWard(w: World): number {
  if (w.cls !== 'lumen' || w.heroes.length < 2) return -1;
  let best = -1;
  let bestShare = 0.85;
  // The Smeltery's Meltdown: the pulses hit everyone, and a Lumen chasing the lowest hero to the
  // back ring leaves the tank unhealed. Once the tank is under `MELT_TANK_FIRST`, go to the tank.
  if (w.dungeonId === 'smeltery' && w.bossPhase >= 3) {
    for (let k = 0; k < w.heroes.length; k++) {
      if (k === w.acting || !w.isTank(k)) continue;
      const a = w.hero(k).player;
      if (a.hp > 0 && a.hp / a.maxHp < MELT_TANK_FIRST) return k;
    }
  }
  for (let k = 0; k < w.heroes.length; k++) {
    if (k === w.acting) continue;
    const a = w.hero(k).player;
    if (a.hp <= 0) continue;
    const share = a.hp / a.maxHp - 0.05 * (a.slag ?? 0);
    if (share < bestShare) {
      bestShare = share;
      best = k;
    }
  }
  return best;
}

/** Lumen action choices: hush casts, Sanctuary for big fights, Radiant Burst to heal and clear space. */
function lightCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && can(w, 3) && w.interruptTarget() >= 0) return 3;
  let near = 0;
  let touching = 0;
  let bigNear = false;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (e.def.rank !== 'normal' && d2 < 300 * 300) bigNear = true;
    if (d2 < w.burstRadius * w.burstRadius) near++;
    if (d2 < 60 * 60) touching++;
  }
  const hurt = 1 - p.hp / p.maxHp;
  // Co-op Purify: Hush clears an ally's Slag Grip when nothing needs silencing.
  if (can(w, 3) && w.interruptTarget() < 0 && w.purifyTarget() >= 0) return 3;
  // Co-op: Radiant Burst and Sanctuary reach the ward when it's close enough.
  const ward = lumenWard(w);
  if (ward >= 0) {
    const a = w.hero(ward).player;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < w.burstRadius && can(w, 0)) return 0;
    if (d < w.burstRadius && a.hp < a.maxHp * 0.5 && can(w, 2)) return 2;
  }
  if (can(w, 2) && (bigNear || hurt > 0.4)) return 2;
  if (can(w, 0) && (near >= 4 || hurt > 0.25 || (bigNear && near >= 1))) return 0;
  if (can(w, 1) && hurt > 0.5 && touching >= 2) return 1;
  return undefined;
}

/**
 * The raid: an Anvil Slagbinder's Clinker taunts, so it waits while the boss is on another
 * fresh tank. The swap cue says when to take it.
 */
function anvilWaits(w: World): boolean {
  if (!w.dungeonDef.raid || w.player.stance !== 'anvil') return false;
  if (w.swapCue) return false;
  const k = w.bossTarget;
  return k >= 0 && k !== w.acting && w.isTank(k);
}

/** Slagbinder action choices: Clinker casts (then the boss), plate on cooldown, shell when it hurts, cover a hurt ally. */
function slagCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && can(w, 3) && w.interruptTarget() >= 0) return 3;
  let touching = 0;
  let bigNear = false;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 < 90 * 90) touching++;
    if (e.def.rank !== 'normal' && d2 < 320 * 320) bigNear = true;
  }
  const hurt = 1 - p.hp / p.maxHp;
  // Co-op: Clinker the boss for Brittle (an Anvil also takes it back) when nothing needs interrupting.
  // In the raid an Anvil holds it while the other tank is fresh, and Clinkers to swap once Ladle Pour Seared it.
  if (w.heroes.length > 1 && can(w, 3) && w.interruptTarget() < 0 && w.bossIndex >= 0 && w.enemies[w.bossIndex].alive && !anvilWaits(w)) return 3;
  // Co-op: an ally below half health with the boss or a telegraph on them gets covered.
  if (w.heroes.length > 1 && can(w, 1)) {
    for (let k = 0; k < w.heroes.length; k++) {
      if (k === w.acting) continue;
      const a = w.hero(k).player;
      if (a.hp > 0 && a.hp < a.maxHp * 0.5 && (w.bossTarget === k || w.telegraphs.some((t) => t.alive && (t.x - a.x) ** 2 + (t.y - a.y) ** 2 < (t.r + 20) ** 2))) return 1;
    }
  }
  // A big boss blow winding up on me (Anvilfall, Ladle Pour): harden first.
  const boss = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : null;
  const bigOnMe = w.anvilOnMe || (!!boss && boss.alive && boss.castId === 'ladlePour' && w.ladlePourTarget === w.acting);
  if (can(w, 2) && (bigOnMe || hurt > 0.45 || touching >= 3 || (bigNear && hurt > 0.25))) return 2;
  if (can(w, 0) && (p.plateUntil ?? -1) <= w.time && (hurt > 0.1 || bigNear || touching >= 1 || w.heroes.length > 1)) return 0;
  if (can(w, 1) && hurt > 0.5 && touching >= 2) return 1;
  return undefined;
}

/** Picks an action-bar slot to press this tick, the way a decent player would. */
export function botCast(w: World, skill = 1): number | undefined {
  if (!w.player.alt) return classCast(w, skill);
  // An ability option: interrupts first, then the option, then the class's other choices.
  const c = classCast(w, skill);
  if (c === 3) return c;
  return altCast(w) ?? c;
}

/** Whether the bot may press `slot` as the class's own ability (not swapped for an option). */
function can(w: World, slot: number): boolean {
  return w.canCast(slot) && !w.isAlt(slot);
}

/** When to press the hero's ability option (ALT_ABILITIES), or undefined. */
function altCast(w: World): number | undefined {
  const a = ALT_ABILITIES[w.cls];
  if (!w.canCast(a.slot)) return undefined;
  const p = w.player;
  const hurt = 1 - p.hp / p.maxHp;
  let touching = 0;
  let near = 0;
  let bigNear = false;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 < 90 * 90) touching++;
    if (d2 < 200 * 200 && e.def.rank === 'normal') near++;
    if (e.def.rank !== 'normal' && d2 < 260 * 260) bigNear = true;
  }
  const party = w.heroes.length > 1;
  const allyLow = (r: number, share: number) =>
    w.heroes.some((_, k) => {
      if (k === w.acting) return false;
      const q = w.hero(k).player;
      return q.hp > 0 && q.hp < q.maxHp * share && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r;
    });
  if (w.cls === 'emberwright') {
    // Ember Ward: before the press reaches you, or when a big foe is close.
    if ((p.plateUntil ?? -1) > w.time) return undefined;
    return touching >= 2 || bigNear || hurt > 0.3 ? a.slot : undefined;
  }
  if (w.cls === 'duskblade') {
    // Hamstring: open on whatever is in reach; it's cheap and keeps foes off you.
    const t = w.bladeTarget(w.swingReach + 40);
    return t >= 0 && (w.enemies[t].def.rank !== 'normal' || near >= 3 || touching >= 1) ? a.slot : undefined;
  }
  if (w.cls === 'bulwark') {
    // Muster: in a party, for a boss blow on the tank or a hurt ally nearby; solo, as a mend.
    if (party) return w.anvilOnMe || allyLow(200, 0.6) || (bigNear && hurt > 0.3) ? a.slot : undefined;
    return hurt > 0.4 ? a.slot : undefined;
  }
  if (w.cls === 'lumen') {
    // Glow Pool: drop it where you stand when you or an ally beside you is hurt.
    return hurt > 0.2 || (party && allyLow(90, 0.8)) ? a.slot : undefined;
  }
  if (w.cls === 'slagbinder') {
    // Cinder Sump: on a big foe or a crowd in range.
    const t = w.bladeTarget(360);
    return t >= 0 && (w.enemies[t].def.rank !== 'normal' || near >= 4) ? a.slot : undefined;
  }
  return undefined;
}

/** The class's own action choices. */
function classCast(w: World, skill: number): number | undefined {
  if (w.cls === 'slagbinder') return slagCast(w, skill);
  if (w.cls === 'duskblade') return bladeCast(w, skill);
  if (w.cls === 'bulwark') return shieldCast(w, skill);
  if (w.cls === 'lumen') return lightCast(w, skill);
  const p = w.player;
  // A lower-skill bot misses some interrupts.
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && can(w, 3) && w.interruptTarget() >= 0) return 3;
  let near = 0;
  let touching = 0;
  let bigNear = false;
  let bigInReach = false;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (e.def.rank !== 'normal' || e.def.stationary) {
      if (d2 < 230 * 230) bigNear = true;
      if (d2 < 440 * 440) bigInReach = true;
    } else {
      if (d2 < 200 * 200) near++;
      if (d2 < 60 * 60) touching++;
    }
  }
  if (can(w, 2) && (bigInReach || near >= 14)) return 2;
  if (can(w, 0) && (near >= 5 || bigNear)) return 0;
  if (can(w, 1) && p.hp < p.maxHp * 0.4 && touching >= 3) return 1;
  return undefined;
}

/**
 * Which gate the bot takes at a fork: the named path when healthy, a shrine
 * when hurt, otherwise the steady fight. BOT_PATH=steady|named forces a choice
 * for balance comparisons.
 */
export function botGate(w: World): number {
  const force = typeof process !== 'undefined' ? process.env?.BOT_PATH : undefined;
  const idx = (k: string) => w.gates.findIndex((g) => g.kind === k);
  if (force === 'steady') return Math.max(0, idx('steady'));
  if (force === 'named' && idx('named') >= 0) return idx('named');
  const hpPct = w.player.hp / w.player.maxHp;
  if (idx('shrine') >= 0 && hpPct < 0.6) return idx('shrine');
  if (idx('named') >= 0 && hpPct >= 0.6) return idx('named');
  return Math.max(0, idx('steady'));
}

/**
 * Party bot switches. `revive`: bots pick up downed allies, under the G6 boss rules in
 * REVIVE_RULES (one pick-up per boss fight, 9 s while the boss is up). REVIVE=0 in tools/group.ts turns it off.
 * `huddle` (off): ranged bots keep within Deepguard reach of an ally with no set worn. A worn Ventwalker
 * still wins. HUDDLE=1 in tools/group.ts turns it on. Off until game design retunes Hammerdeep for it.
 */
export const BOT_PARTY = { revive: true, huddle: false };

/**
 * Co-op: the downed ally this hero should go and pick up, or null. The rescuer is the living hero
 * closest to the first downed ally, leaving out the one the boss is on (unless nobody else is up).
 * Nobody rescues into a telegraph that is about to land on the body.
 */
function rescue(w: World): { dx: number; dy: number; d: number } | null {
  if (!BOT_PARTY.revive || w.heroes.length < 2 || w.revivesLeft <= 0) return null;
  const n = w.heroes.length;
  for (let k = 0; k < n; k++) {
    const down = w.hero(k).player;
    if (down.hp > 0) continue;
    if (w.telegraphs.some((t) => t.alive && t.kind !== 'soak' && t.t > t.dur - 0.8 && (t.x - down.x) ** 2 + (t.y - down.y) ** 2 < (t.r + 20) ** 2)) continue;
    const up: number[] = [];
    for (let j = 0; j < n; j++) if (w.hero(j).player.hp > 0) up.push(j);
    if (!up.length) return null;
    const pool = up.length > 1 ? up.filter((j) => j !== w.bossTarget) : up;
    let best = -1;
    let bestD = Infinity;
    for (const j of pool) {
      const q = w.hero(j).player;
      const d = Math.hypot(q.x - down.x, q.y - down.y);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best !== w.acting) continue;
    const p = w.player;
    const dx = down.x - p.x;
    const dy = down.y - p.y;
    return { dx, dy, d: Math.hypot(dx, dy) || 1 };
  }
  return null;
}

/** The nearest point the hero could stand in a standing pillar's shade, or null when every pillar is down. */
function nearestShade(w: World): { x: number; y: number } | null {
  const p = w.player;
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const c of w.pillars) {
    if (c.cracked) continue;
    const d = Math.hypot(c.x, c.y) || 1;
    const ux = c.x / d;
    const uy = c.y / d;
    for (const along of [c.r + 24, 70, 110, 160, 220]) {
      for (const k of [0, -0.6, 0.6]) {
        const across = k * (c.r + along * 0.12);
        const x = c.x + ux * along - uy * across;
        const y = c.y + uy * along + ux * across;
        if (Math.hypot(x, y) > (w.arenaR ?? ARENA) - 20 || !w.shadowed(x, y)) continue;
        const dd = Math.hypot(x - p.x, y - p.y);
        if (dd < bd) { bd = dd; best = { x, y }; }
      }
    }
  }
  return best;
}

/** Scatter Embers: how far apart two bots try to stand (twice the burst, plus a margin). */
const SCATTER_GAP = 2 * 80 + 20;

/** The nearest living ally of the acting hero, or null. */
/**
 * The direction to a living ally whose coal is clearly brighter than ours, while the Long Night
 * winds up (null if none, or already in its light). NOSHELTER=1 turns it off, to measure what it's worth.
 */
function longNightShelter(w: World): { dx: number; dy: number } | null {
  if (w.heroes.length < 2 || w.bossIndex < 0 || process.env.NOSHELTER === '1') return null;
  const b = w.enemies[w.bossIndex];
  if (!b.alive || b.castId !== 'longNight') return null;
  const p = w.player;
  const left = b.castDur - b.castT;
  let best: { dx: number; dy: number; coal: number } | null = null;
  for (let k = 0; k < w.heroes.length; k++) {
    if (k === w.acting) continue;
    const q = w.heroData(k).player;
    if (q.hp <= 0 || (q.coal ?? 0) < (p.coal ?? 0) + 0.15) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy);
    const r = (q.coalR ?? COLD.maxR) - 25;
    // Already inside its light, or too far to get there before the cast lands.
    if (d <= r || d - r > w.moveSpeed * left) continue;
    if (!best || (q.coal ?? 0) > best.coal) best = { dx: dx / (d || 1), dy: dy / (d || 1), coal: q.coal ?? 0 };
  }
  if (best) return best;
  // No brighter light to reach: huddle with the nearest ally instead (the Long Night hits a huddle softer).
  const near = nearestAlly(w);
  if (near && near.d > COLD.huddleR * 0.7 && near.d - COLD.huddleR * 0.7 <= w.moveSpeed * left) return { dx: near.dx / (near.d || 1), dy: near.dy / (near.d || 1) };
  return null;
}

function nearestAlly(w: World): { dx: number; dy: number; d: number } | null {
  const p = w.player;
  let best: { dx: number; dy: number; d: number } | null = null;
  for (let k = 0; k < w.heroes.length; k++) {
    if (k === w.acting) continue;
    const q = w.heroData(k).player;
    if (q.hp <= 0) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { dx, dy, d };
  }
  return best;
}

/**
 * Co-op soaks: which gold circle the acting hero should stand in. Each circle in
 * turn gets the nearest living hero not yet given one; anyone left goes to their
 * nearest. Solo (or NOSPLIT=1, to measure what splitting is worth): null, the old rule.
 */
export function soakFor(w: World): World['telegraphs'][number] | null {
  if (w.heroes.length < 2 || process.env.NOSPLIT === '1') return null;
  const soaks = w.telegraphs.filter((t) => t.alive && t.kind === 'soak');
  if (soaks.length < 2) return null;
  const pos = w.heroes.map((_, k) => w.heroData(k).player);
  const given = new Map<number, number>();
  for (let s = 0; s < soaks.length; s++) {
    let bk = -1;
    let bd = Infinity;
    for (let k = 0; k < pos.length; k++) {
      if (pos[k].hp <= 0 || given.has(k)) continue;
      const d = Math.hypot(pos[k].x - soaks[s].x, pos[k].y - soaks[s].y);
      if (d < bd) { bd = d; bk = k; }
    }
    if (bk >= 0) given.set(bk, s);
  }
  const mine = given.get(w.acting);
  if (mine !== undefined) return soaks[mine];
  let best = soaks[0];
  let bd = Infinity;
  for (const t of soaks) {
    const d = Math.hypot(w.player.x - t.x, w.player.y - t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/**
 * The Pressworks: which hero takes this Downstroke. The nearest living hero who isn't
 * Pressed, leaving the tank on Oskel unless nobody else can go. -1 if nobody can.
 */
export function downstrokeTaker(w: World, t: World['telegraphs'][number]): number {
  let best = -1;
  let bd = Infinity;
  for (let pass = 0; pass < 2 && best < 0; pass++) {
    for (let k = 0; k < w.heroes.length; k++) {
      const q = w.heroData(k).player;
      if (q.hp <= 0 || (q.pressedT ?? 0) > 0) continue;
      if (pass === 0 && w.heroes.length > 1 && w.isTank(k)) continue;
      const d = Math.hypot(q.x - t.x, q.y - t.y);
      if (d < bd) { bd = d; best = k; }
    }
  }
  return best;
}

/**
 * The Brimming: the way onto the nearest cooling island with more than BRIM.warn s left, or toward its middle
 * when near its edge. Null when well on a safe island, or when there are no islands.
 */
export function islandStep(w: World): { dx: number; dy: number } | null {
  if (!w.islands.length || process.env.NOISLAND === '1') return null;
  const p = w.player;
  // Melee heroes weigh how close the island is to her too, so they can still reach her from it.
  const melee = w.cls === 'duskblade' || w.cls === 'bulwark';
  const boss = w.bossIndex >= 0 && w.enemies[w.bossIndex].alive ? w.enemies[w.bossIndex] : null;
  let ward = w.cls === 'lumen' ? lumenWard(w) : -1;
  if (w.cls === 'lumen' && ward < 0) for (let k = 0; k < w.heroes.length; k++) if (k !== w.acting && w.isTank(k) && w.heroData(k).player.hp > 0) { ward = k; break; }
  let best: { x: number; y: number } | null = null;
  let bs = Infinity;
  for (const s of w.islands) {
    if (s.t <= BRIM.warn) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    // A Lumen picks the island nearest the hero it keeps alive, so its heals still reach.
    const wd = ward >= 0 ? w.heroData(ward).player : null;
    const score = d + (melee && boss ? Math.hypot(s.x - boss.x, s.y - boss.y) : wd ? Math.hypot(s.x - wd.x, s.y - wd.y) : 0);
    if (score < bs) { bs = score; best = s; }
  }
  if (!best) return null;
  const bd = Math.hypot(best.x - p.x, best.y - p.y) || 1;
  if (bd < BRIM.radius * 0.6) return null;
  return { dx: (best.x - p.x) / bd, dy: (best.y - p.y) / bd };
}

/** The Wrackline: while the Ebb warns or pulls, the way to the nearest afloat raft (null when already well on one, or no Ebb). */
function ebbRaft(w: World): { dx: number; dy: number; d?: number } | null {
  if (!w.rafts.length || (w.ebbWarnT <= 0 && w.ebbT <= 0)) return null;
  const p = w.player;
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const r of w.rafts) {
    if (r.sunkT > 0) continue;
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) return null;
  // Still warning and the raft is close enough to make in time: fight on for now.
  if (w.ebbT <= 0 && bd / w.moveSpeed + 1.2 < w.ebbWarnT) return null;
  // A circle about to land on us comes first: step out of it, then make for the raft.
  for (const t of w.telegraphs) {
    if (!t.alive || t.kind !== 'hit' || t.shape !== 'circle' || t.dmg <= 0 || t.dur - t.t > 0.9) continue;
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const dd = Math.hypot(dx, dy) || 1;
    if (dd < t.r + 12) return { dx: dx / dd, dy: dy / dd };
  }
  const d = bd || 1;
  // On the raft: drift with it, easing toward its middle (a short vector walks slowly).
  const k = bd < WRACK.raftR * 0.45 ? Math.min(1, bd / (WRACK.raftR * 0.45)) * 0.35 : 1;
  return { dx: ((best.x - p.x) / d) * k, dy: ((best.y - p.y) / d) * k, d: bd };
}

/**
 * How far each class's movement ability (slot 1) carries it. The Bulwark has none: it anchors with Anvil Skin instead.
 * The Slagbinder keeps Interpose for its own uses: hopping to rafts with it cost 3.7 wins of 30 against Hessa.
 */
const HOP: Partial<Record<string, number>> = { emberwright: 170, lumen: 160, duskblade: 130 };

/**
 * The Wrackline: making for a raft in the Ebb, use the class's movement ability when the raft is
 * far enough that the hop helps, or (Bulwark) raise Anvil Skin once the pull starts, so it can't drag.
 */
function raftHop(w: World, d: number | undefined): number | undefined {
  if (d === undefined || w.onRaft(w.player.x, w.player.y)) return undefined;
  if (w.cls === 'bulwark') return w.ebbT > 0 && d > WRACK.raftR && can(w, 2) ? 2 : undefined;
  const hop = HOP[w.cls];
  if (!hop) return undefined;
  return d > hop * 0.6 && can(w, 1) ? 1 : undefined;
}

/** V8 Emberdrift: the way to the nearest fallen ember when this hero's coal is below `low` (a skilled bot tops up sooner), or null. */
export function driftGrab(w: World, skill: number): { dx: number; dy: number } | null {
  const p = w.player;
  if (!w.driftEmbers.length || p.coal === undefined || p.coal > 0.3 + 0.3 * skill) return null;
  let best: { dx: number; dy: number } | null = null;
  let bestD = Infinity;
  for (const m of w.driftEmbers) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < bestD) { bestD = d; best = { dx: (m.x - p.x) / (d || 1), dy: (m.y - p.y) / (d || 1) }; }
  }
  return best;
}

/**
 * The ember this hero should run for, or null: the nearest one no living ally is closer to,
 * within a reach that grows with skill. Tanks stay on the boss.
 */
function emberGrab(w: World, skill: number): { dx: number; dy: number } | null {
  if (!w.coalEmbers.length || w.isTank(w.acting)) return null;
  const p = w.player;
  const reach = 160 + 240 * skill;
  let best: { dx: number; dy: number } | null = null;
  let bestD = reach;
  for (const m of w.coalEmbers) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d >= bestD) continue;
    let mine = true;
    for (let k = 0; k < w.heroes.length && mine; k++) {
      if (k === w.acting || w.isTank(k)) continue;
      const q = w.heroes[k].player;
      if (q.hp > 0 && Math.hypot(m.x - q.x, m.y - q.y) < d) mine = false;
    }
    if (mine) { bestD = d; best = { dx: (m.x - p.x) / (d || 1), dy: (m.y - p.y) / (d || 1) }; }
  }
  return best;
}

/**
 * The Flue (raid 4): where to step for a Decree, or null. A holder walks to the nearest ally who
 * can take it; the nearest such ally walks to meet it. NOPASS=1 turns this off for measuring.
 */
export function decreePass(w: World): { dx: number; dy: number } | null {
  // NOPASS=1 (measuring only): nobody passes a Decree, as if the party ignored it.
  if (process.env.NOPASS === '1') return null;
  if (w.dungeonId !== 'flue' || w.regentDecree.length === 0) return null;
  const me = w.acting;
  const p = w.player;
  const mine = w.regentDecree.find((d) => d.hero === me);
  // The holder walks to the nearest ally who can take it (a tank can take one by hand).
  if (mine) {
    let best = -1;
    let bd = Infinity;
    for (let k = 0; k < w.heroes.length; k++) {
      if (k === me || !w.canHoldDecree(k, true)) continue;
      const q = w.hero(k).player;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) return null;
    const q = w.hero(best).player;
    return bd > 20 ? { dx: (q.x - p.x) / bd, dy: (q.y - p.y) / bd } : { dx: 0, dy: 0 };
  }
  // A non-tank who can take one meets the nearest holder halfway (a tank holds the boss and waits).
  if (w.canHoldDecree(me)) {
    let bd = Infinity;
    let hx = 0;
    let hy = 0;
    for (const d of w.regentDecree) {
      const h = w.hero(d.hero).player;
      const dd = Math.hypot(h.x - p.x, h.y - p.y);
      if (dd < bd) { bd = dd; hx = h.x; hy = h.y; }
    }
    // Only the nearest able ally to that holder goes.
    for (let k = 0; k < w.heroes.length; k++) {
      if (k === me || !w.canHoldDecree(k)) continue;
      const q = w.hero(k).player;
      if (Math.hypot(hx - q.x, hy - q.y) < bd) return null;
    }
    if (bd > 20 && bd < 600) return { dx: (hx - p.x) / bd, dy: (hy - p.y) / bd };
  }
  return null;
}

/**
 * Where a non-tank should step to stand behind the Cinder Colossus (raid 3), or null when it
 * is already there or is the tank. Stays out of his front cone on the way round by circling at
 * a safe radius. Once Meltdown cracks his plate the blades and the Lumen fight as usual, but a
 * ranged damage hero keeps its ring: left alone it drifts out of reach and loses about a
 * quarter of its damage just when the race against the pulses is on.
 */
export function colossusFlank(w: World): { dx: number; dy: number } | null {
  // NOFLANK=1 (measuring only): nobody goes round, as if the party ignored the plate.
  if (process.env.NOFLANK === '1') return null;
  if (w.dungeonId !== 'smeltery' || w.bossIndex < 0 || w.isTank(w.acting)) return null;
  if (w.bossPhase >= 3 && (w.cls === 'duskblade' || w.cls === 'bulwark' || w.cls === 'lumen')) return null;
  const e = w.enemies[w.bossIndex];
  if (!e?.alive || e.kind !== 'colossus') return null;
  const p = w.player;
  // In a Slag Sweep: let the usual step-out handle it.
  for (const t of w.telegraphs) {
    if (!t.alive || t.shape !== 'cone' || t.owner !== w.bossIndex) continue;
    const d0 = Math.hypot(p.x - t.x, p.y - t.y);
    const off0 = Math.abs(((Math.atan2(p.y - t.y, p.x - t.x) - t.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d0 < t.r + 30 && off0 < t.arc / 2 + 0.3) return null;
  }
  const melee = w.cls === 'duskblade' || w.cls === 'bulwark';
  const r = e.def.radius + (melee ? w.swingReach * 0.6 : 170);
  const back = w.colFacing + w.colPlate + Math.PI;
  const at = Math.atan2(p.y - e.y, p.x - e.x);
  const off = Math.abs(((at - back + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (off < Math.PI / 4 && Math.abs(d - r) < 60) return null;
  // Circle round: aim a quarter turn closer to his back each step, at a radius clear of the sweep.
  const ring = Math.max(r, d < r ? r : Math.min(d, r + 120));
  const sgn = ((at - back + Math.PI * 3) % (Math.PI * 2)) - Math.PI > 0 ? -1 : 1;
  const next = off < Math.PI / 4 ? back : at + sgn * Math.min(off, Math.PI / 4);
  const tx = e.x + Math.cos(next) * ring;
  const ty = e.y + Math.sin(next) * ring;
  const dd = Math.hypot(tx - p.x, ty - p.y) || 1;
  return { dx: (tx - p.x) / dd, dy: (ty - p.y) / dd };
}

export function botInput(w: World, skill = 1): Input {
  const p = w.player;
  if (w.phase === 'choose' && w.gates.length) {
    const g = w.gates[botGate(w)];
    return { x: g.x - p.x, y: g.y - p.y };
  }
  // Glarewell: a Glare beats everything else. Get into a pillar's shade and hold still there.
  if (w.pillars.length) {
    let left = Infinity;
    for (const e of w.enemies) if (e.alive && e.castId === 'glare') left = Math.min(left, e.castDur - e.castT);
    if (left < Infinity) {
      const cast = botCast(w, skill);
      if (w.shadowed(p.x, p.y)) return { x: 0, y: 0, cast };
      const s = nearestShade(w);
      if (s) {
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        // Too far to walk there in time: use the class's step (Blink, Glimmer Step, Sidestep) toward it.
        const late = d > w.moveSpeed * left * 0.9 && d > 120;
        const step = late && cast !== 3 && w.cls !== 'bulwark' && w.canCast(1) && !w.isAlt(1) ? 1 : cast;
        return { x: dx / d, y: dy / d, cast: step };
      }
    }
  }
  // The Wrackline: when the Ebb warns or pulls, get onto the nearest raft that's afloat and stay near its middle.
  const raft = ebbRaft(w);
  if (raft) return { x: raft.dx, y: raft.dy, cast: raftHop(w, raft.d) ?? botCast(w, skill) };
  // The Crucible's Brimming: stand on a cooling island that isn't about to sink (NOISLAND=1 turns this off for measuring).
  const isle = islandStep(w);
  if (isle) return { x: isle.dx, y: isle.dy, cast: botCast(w, skill) };
  // Coldmarrow co-op: under the Long Night, a hero with a dim coal runs into a brighter ally's light.
  const glow = longNightShelter(w);
  if (glow) return { x: glow.dx, y: glow.dy, cast: botCast(w, skill) };
  // Co-op: pick a downed ally back up (one rescuer per downed hero, not the one the boss is on).
  const save = rescue(w);
  if (save) {
    const cast = botCast(w, skill);
    return save.d > REVIVE_RADIUS * 0.5 ? { x: save.dx / save.d, y: save.dy / save.d, cast } : { x: 0, y: 0, cast };
  }
  // V8 Emberdrift: a hero whose coal is running low walks to the nearest fallen ember.
  const drift = driftGrab(w, skill);
  if (drift) return { x: drift.dx, y: drift.dy, cast: botCast(w, skill) };
  // The Hoard: in Ember Feast a non-tank grabs the nearest spilled ember before Old Vorhulm eats it.
  const ember = emberGrab(w, skill);
  if (ember) return { x: ember.dx, y: ember.dy, cast: botCast(w, skill) };
  // The Flue: pass a Decree on (the holder walks to an ally who can take it; that ally meets it).
  const decree = decreePass(w);
  if (decree) return { x: decree.dx, y: decree.dy, cast: botCast(w, skill) };
  // The Smeltery: a non-tank works the Colossus's open back while his plate holds.
  const flank = colossusFlank(w);
  if (flank) return { x: flank.dx, y: flank.dy, cast: botCast(w, skill) };
  // The Hoard: while an ally is swallowed, a hero out of reach of the Craw closes on it (the boss follows its tank there).
  if (w.craw >= 0 && !((p.swallowT ?? 0) > 0)) {
    const c = w.enemies[w.craw];
    const d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    if (d > 280) return { x: (c.x - p.x) / d, y: (c.y - p.y) / d, cast: botCast(w, skill) };
  }
  let fx = 0;
  let fy = 0;
  const melee = w.cls === 'duskblade' || w.cls === 'bulwark';
  const reach = w.cls === 'bulwark' ? w.sweepReach : w.swingReach;
  if (melee) {
    // Close in on the target and stay in blade reach.
    const t = w.bladeTarget(900);
    if (t >= 0) {
      const e = w.enemies[t];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = e.def.radius + reach * 0.6;
      if (d > want) {
        fx += (dx / d) * 0.05;
        fy += (dy / d) * 0.05;
      } else if (d < e.def.radius + 24) {
        // Too close: big foes hurt on contact, so step back to the edge of reach.
        fx -= (dx / d) * 0.05 * skill;
        fy -= (dy / d) * 0.05 * skill;
      } else if (w.cls === 'duskblade' && e.def.rank !== 'normal' && d < e.def.radius + reach * 0.45) {
        // The Duskblade has no armor: it fights big foes from the tip of its blades.
        fx -= (dx / d) * 0.1 * skill;
        fy -= (dy / d) * 0.1 * skill;
      }
    }
  }
  // V1: a Hollow Rift keeps spitting Ashlings, so every hero works its way to it (the tip: break the Rift first).
  // Melee heroes already reach it through bladeTarget; a ranged hero closes to orb range of it.
  if (!melee) {
    for (const e of w.enemies) {
      if (!e.alive || e.kind !== 'rift' || w.stress) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      if (d > 170) { fx += ((e.x - p.x) / d) * 0.12 * skill; fy += ((e.y - p.y) / d) * 0.12 * skill; }
      break;
    }
  }
  for (const e of w.enemies) {
    if (!e.alive || melee) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 260 * 260) continue;
    // Stay in orb range of bosses: only back off when they get close.
    if (e.def.rank !== 'normal' && d2 > 200 * 200) continue;
    const wgt = (e.def.rank === 'normal' ? 1 : 6) / Math.max(d2, 100);
    fx += dx * wgt;
    fy += dy * wgt;
  }
  // V2: stay out of a lava channel; cross it straight across, never along it.
  for (const c of w.lava) {
    const ux = c.x2 - c.x1;
    const uy = c.y2 - c.y1;
    const L2 = ux * ux + uy * uy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - c.x1) * ux + (p.y - c.y1) * uy) / L2));
    const ox = p.x - (c.x1 + ux * t);
    const oy = p.y - (c.y1 + uy * t);
    const d = Math.hypot(ox, oy) || 1;
    if (d >= c.w / 2 + 30) continue;
    // The rest of the bot's pull, across the channel (negative: toward it). A hero pressed
    // hard against the near bank crosses (a quick burn) rather than standing pinned there.
    const across = (fx * ox + fy * oy) / d;
    const pressed = across < -0.25 * Math.hypot(fx, fy) && Math.hypot(fx, fy) > 0.02;
    const side = pressed ? -1 : 1;
    fx += (ox / d) * 0.3 * side;
    fy += (oy / d) * 0.3 * side;
  }
  // Site cards have no movement rules: pulling a Bulwark to a stone (Back to Stone) cost 23 of 80
  // Coldmarrow runs that took it, and a Slagbinder staying in lava (Slag Wade) 10 of 45 Kiln runs.
  // The Coldmarrow: a ranged hero brings a Frost Warden inside its coal's light to crack it.
  if (!melee && p.coalR !== undefined) {
    let wi = -1;
    let wd = Infinity;
    for (let k = 0; k < w.enemies.length; k++) {
      const e = w.enemies[k];
      if (!e.alive || e.kind !== 'frostWarden') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < wd) { wd = d; wi = k; }
    }
    if (wi >= 0 && wd < 450) {
      const e = w.enemies[wi];
      const want = Math.max(e.def.radius + 45, p.coalR + e.def.radius - 25);
      const k = wd > want ? 0.12 : wd < e.def.radius + 40 ? -0.12 : 0;
      fx += ((e.x - p.x) / (wd || 1)) * k * skill;
      fy += ((e.y - p.y) / (wd || 1)) * k * skill;
    }
  }
  // Co-op Lumen: keep the hero who most needs healing inside Radiant Burst and Sanctuary
  // reach, standing off to the side of the boss's line so its cones miss.
  const ward = lumenWard(w);
  if (ward >= 0) {
    const a = w.hero(ward).player;
    let ox = 0;
    let oy = 0;
    if (w.bossIndex >= 0 && w.enemies[w.bossIndex].alive) {
      const b = w.enemies[w.bossIndex];
      const bd = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const side = Math.sign((p.x - a.x) * -(a.y - b.y) + (p.y - a.y) * (a.x - b.x)) || 1;
      ox = (-(a.y - b.y) / bd) * side * LUMEN_STANDOFF;
      oy = ((a.x - b.x) / bd) * side * LUMEN_STANDOFF;
    }
    const dx = a.x + ox - p.x;
    const dy = a.y + oy - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 30) {
      fx += (dx / d) * 0.08 * skill;
      fy += (dy / d) * 0.08 * skill;
    }
  }
  // The Ashvents (G3): spread out while Scatter Embers is winding up.
  const scatter = w.heroes.length > 1 && process.env.NOSPREAD !== '1' && w.bossIndex >= 0
    && w.enemies[w.bossIndex].alive && w.enemies[w.bossIndex].castId === 'scatter';
  if (scatter) {
    const near = nearestAlly(w);
    if (near && near.d < SCATTER_GAP) {
      fx += (-near.dx / (near.d || 1)) * 0.7 * skill;
      fy += (-near.dy / (near.d || 1)) * 0.7 * skill;
    }
  }
  // Phase 12 W2, Ondrel's Ironload: everyone gathers on the marked hero, who walks to the others.
  if (w.loadHero >= 0 && w.heroes.length > 1 && process.env.NOSTACK !== '1') {
    const m = w.heroData(w.loadHero).player;
    if (w.loadHero !== w.acting) {
      const dx = m.x - p.x, dy = m.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > IRONLOAD.radius * 0.5) { fx += (dx / d) * 0.7 * skill; fy += (dy / d) * 0.7 * skill; }
    } else {
      let cx = 0, cy = 0, n = 0;
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (k === w.acting || q.hp <= 0) continue;
        cx += q.x; cy += q.y; n++;
      }
      if (n) {
        const dx = cx / n - p.x, dy = cy / n - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 40) { fx += (dx / d) * 0.4 * skill; fy += (dy / d) * 0.4 * skill; }
      }
    }
  }
  // Verb sets in a party: a ranged hero plays its set's verb. Deepguard: stay within reach of an ally.
  // Ventwalker: keep clear of every ally (the Lumen keeps its healing post instead). Melee stay on the target.
  if (!melee && w.heroes.length > 1 && !scatter) {
    const near = nearestAlly(w);
    if (near && near.d > 0) {
      const r = SET_TUNING.dgRange;
      let k = 0;
      const vent = w.setCount('ventwalker') >= 2 && w.cls !== 'lumen';
      if ((w.setCount('deepguard') >= 2 || (BOT_PARTY.huddle && !vent)) && near.d > r * 0.75) k = 0.15;
      else if (vent && near.d < r * 1.2) k = -0.15;
      fx += (near.dx / near.d) * k * skill;
      fy += (near.dy / near.d) * k * skill;
    }
  }
  // Coldmarrow Thin Ice: keep off cracks (warned or open). Step out toward Nhevra's side if she's
  // up (she holds still in her strip while the river is cracked), else the near side.
  const nhevra = w.bossIndex >= 0 && w.enemies[w.bossIndex].alive && w.enemies[w.bossIndex].kind === 'nhevra' ? w.enemies[w.bossIndex] : null;
  for (const c of w.cracks) {
    if (!c.alive) continue;
    const nx = -Math.sin(c.angle);
    const ny = Math.cos(c.angle);
    const side = (p.x - c.x) * nx + (p.y - c.y) * ny;
    if (Math.abs(side) < COLD.crackHalfW + 40) {
      const bossSide = nhevra ? (nhevra.x - c.x) * nx + (nhevra.y - c.y) * ny : 0;
      // Only cross toward her while the crack is still a warning; once it's open water, take the near side.
      const sg = nhevra && c.t < COLD.crackWarn ? Math.sign(bossSide) || 1 : Math.sign(side) || 1;
      fx += nx * sg * 0.8 * skill;
      fy += ny * sg * 0.8 * skill;
    }
  }
  const vent = soakFor(w);
  let soaking = false;
  // A Bulwark with Resolve to spare stands in blooms and smothers them.
  const smother = w.cls === 'bulwark' && p.heat >= 10;
  for (const t of w.telegraphs) {
    if (!t.alive) continue;
    if (smother && t.kind === 'bloom') continue;
    // NOTURNS=1 (measuring only): every hero runs under every Downstroke, as if nobody took turns.
    if (t.kind === 'soak' && t.owner === -3 && process.env.NOTURNS !== '1' && downstrokeTaker(w, t) !== w.acting) {
      // The Pressworks: a Downstroke that isn't this hero's turn is a hazard, so step out of it.
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < t.r + 30) { fx += (dx / d) * 0.6 * skill; fy += (dy / d) * 0.6 * skill; }
      continue;
    }
    if (t.kind === 'soak') {
      // Co-op: only go to the circle this hero was given (so a pair of vents is split).
      if (vent && t !== vent) continue;
      // Run into the gold circle and hold still in it.
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > t.r * 0.5) {
        fx += (dx / d) * 0.6 * skill;
        fy += (dy / d) * 0.6 * skill;
      } else soaking = true;
      continue;
    }
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < t.r + 30) {
      const k = melee ? 0.6 : 0.2;
      if (t.shape === 'cone' && t.arc >= Math.PI * 0.9) {
        // Only from inside it (or right on its edge): outside, stay put.
        if ((dx * Math.cos(t.angle) + dy * Math.sin(t.angle)) / d < -0.1) continue;
        // A half-floor cut (Die Cut): walk straight back across its edge, everyone at full pace.
        fx -= Math.cos(t.angle) * 0.8 * skill;
        fy -= Math.sin(t.angle) * 0.8 * skill;
      } else if (t.shape === 'cone') {
        // A long cone can't be outrun: step sideways out of it instead.
        const side = Math.sign(Math.sin(Math.atan2(dy, dx) - t.angle)) || 1;
        fx += -Math.sin(t.angle) * side * k * skill;
        fy += Math.cos(t.angle) * side * k * skill;
      } else {
        let ux = dx / d;
        let uy = dy / d;
        // A ring dropped at your feet: don't run out of it straight into a big foe.
        if (melee && w.bossIndex >= 0 && w.enemies[w.bossIndex].alive) {
          const b = w.enemies[w.bossIndex];
          const bx = b.x - p.x;
          const by = b.y - p.y;
          const bd = Math.hypot(bx, by) || 1;
          if (bd < 220 && (ux * bx + uy * by) / bd > -0.3) {
            // Go out the side away from the boss instead.
            const side = Math.sign(ux * -by + uy * bx) || 1;
            ux = (-by / bd) * side - (bx / bd) * 0.5;
            uy = (bx / bd) * side - (by / bd) * 0.5;
            const ul = Math.hypot(ux, uy) || 1;
            ux /= ul;
            uy /= ul;
          }
        }
        fx += ux * k * skill;
        fy += uy * k * skill;
      }
    }
  }
  // Collect nearby XP when it is reasonably safe.
  let best = Infinity;
  let gx = 0;
  let gy = 0;
  for (const g of w.gems) {
    if (!g.alive || g.pulled) continue;
    const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d2 < best) { best = d2; gx = g.x - p.x; gy = g.y - p.y; }
  }
  if (best < 300 * 300) {
    const d = Math.sqrt(best) || 1;
    fx += (gx / d) * 0.012;
    fy += (gy / d) * 0.012;
  }
  // Stay within interrupt range of the boss.
  if (w.bossIndex >= 0) {
    const b = w.enemies[w.bossIndex];
    if (b.alive && b.def.rank === 'boss') {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > (melee ? 160 : 340)) {
        fx += (dx / d) * 0.03 * skill;
        fy += (dy / d) * 0.03 * skill;
      }
    }
  }
  // Maelra: once her Temper builds, lead her across a steam vent by standing
  // on the far side of it so her path crosses the steam.
  if (process.env.NOVENT !== '1' && w.vents.length && w.temper >= 2 && w.bossIndex >= 0 && w.enemies[w.bossIndex].alive) {
    const b = w.enemies[w.bossIndex];
    let best = w.vents[0];
    let bd = Infinity;
    for (const v of w.vents) {
      const d = Math.hypot(v.x - b.x, v.y - b.y) + Math.hypot(v.x - p.x, v.y - p.y);
      if (d < bd) { bd = d; best = v; }
    }
    const vx = best.x - b.x;
    const vy = best.y - b.y;
    const vd = Math.hypot(vx, vy) || 1;
    const tx = best.x + (vx / vd) * (best.r + 50) - p.x;
    const ty = best.y + (vy / vd) * (best.r + 50) - p.y;
    const td = Math.hypot(tx, ty) || 1;
    fx += (tx / td) * 0.06 * skill;
    fy += (ty / td) * 0.06 * skill;
  }
  // Glarewell: hide from a Glare, burst a Brand in the open, stay out of the lamps' beam.
  if (w.pillars.length) {
    const glaring = w.enemies.some((e) => e.alive && e.castId === 'glare');
    if (glaring && !w.shadowed(p.x, p.y)) {
      let bx = 0;
      let by = 0;
      let bd = Infinity;
      for (const c of w.pillars) {
        if (c.cracked) continue;
        const d = Math.hypot(c.x, c.y) || 1;
        const sx = (c.x / d) * (d + c.r + 45);
        const sy = (c.y / d) * (d + c.r + 45);
        const dd = Math.hypot(sx - p.x, sy - p.y);
        if (dd < bd) { bd = dd; bx = sx; by = sy; }
      }
      if (bd < Infinity) {
        const td = bd || 1;
        fx += ((bx - p.x) / td) * 0.9 * skill;
        fy += ((by - p.y) / td) * 0.9 * skill;
      }
    }
    if (w.markT > 0) {
      const k = (w.markT < 1.6 ? 0.5 : 0.2) * skill;
      const away = (x: number, y: number, r: number) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < r) { fx += (dx / d) * k * (1 - d / r); fy += (dy / d) * k * (1 - d / r); }
      };
      for (const c of w.pillars) if (!c.cracked) away(c.x, c.y, 110 + c.r + 50);
      for (const e of w.enemies) if (e.alive) away(e.x, e.y, 110 + e.def.radius + 40);
    }
    const lb = w.lampBeam;
    if (lb) {
      const vx = lb.x2 - lb.x1;
      const vy = lb.y2 - lb.y1;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - lb.x1) * vx + (p.y - lb.y1) * vy) / len2));
      const dx = p.x - (lb.x1 + vx * t);
      const dy = p.y - (lb.y1 + vy * t);
      const d = Math.hypot(dx, dy) || 1;
      if (d < 90) { fx += (dx / d) * 0.4 * skill; fy += (dy / d) * 0.4 * skill; }
    }
  }
  // Don't get pinned against the arena wall.
  const fromCenter = Math.hypot(p.x, p.y);
  const edge = w.arenaR ?? ARENA;
  if (!w.stress && fromCenter > edge - 140) {
    const k = ((fromCenter - (edge - 140)) / 140) * 0.04;
    fx -= (p.x / fromCenter) * k;
    fy -= (p.y / fromCenter) * k;
  }
  // Close in when every foe is out of comfortable range.
  let nd = Infinity;
  let nx = 0;
  let ny = 0;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd) { nd = d; nx = e.x - p.x; ny = e.y - p.y; }
  }
  if (nd > 380 && nd < Infinity) {
    fx += (nx / nd) * 0.01;
    fy += (ny / nd) * 0.01;
  }
  // Objectives: loot on the ground, ember veins and rifts, when it is calm enough.
  const threat = Math.hypot(fx, fy);
  let onVein = false;
  let ox = 0;
  let oy = 0;
  let od = Infinity;
  const consider = (x: number, y: number, max: number) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < max && d < od) { od = d; ox = x - p.x; oy = y - p.y; }
  };
  for (const d of w.drops) if (d.alive) consider(d.x, d.y, 520);
  for (const v of w.veins) {
    if (!v.alive) continue;
    if (Math.hypot(v.x - p.x, v.y - p.y) < 30) onVein = true;
    consider(v.x, v.y, 480);
  }
  for (const e of w.enemies) if (e.alive && e.kind === 'rift') consider(e.x, e.y, 520);
  if (od < Infinity && !onVein) {
    const k = threat < 0.01 ? 0.03 : 0.015;
    fx += (ox / (od || 1)) * k;
    fy += (oy / (od || 1)) * k;
  }
  const cast = botCast(w, skill);
  if ((soaking || onVein) && threat < 0.012) return { x: 0, y: 0, cast };

  // Drift in a slow circle so the bot doesn't pin itself in one spot.
  const a = w.time * 0.15;
  fx += Math.cos(a) * 0.002;
  fy += Math.sin(a) * 0.002;
  const len = Math.hypot(fx, fy) || 1;
  return { x: fx / len, y: fy / len, cast };
}

const NEW_CAPS: TalentId[] = [
  'cinderTide', 'searingBloom', 'ashenMantle', 'openVeins', 'killingRhythm', 'shadowSlip',
  'ironVigil', 'grudge', 'shieldWake', 'noonfire', 'haven', 'chorus',
];
const MEASURE_NEW = typeof process !== 'undefined' && !!process.env.NEW_CAPS;
/** BOT_BRANCH=bastion,grace (balance tools only): the bot drafts these branches first until their capstone, to measure branches it rarely commits to. */
const FORCE_BRANCH = typeof process !== 'undefined' ? (process.env.BOT_BRANCH ?? '').split(',').filter(Boolean) : [];
/** BOT_CAP=haven (balance tools only): the bot takes these capstones over their twin, to measure the one it would skip. */
const FORCE_CAP = typeof process !== 'undefined' ? (process.env.BOT_CAP ?? '').split(',').filter(Boolean) : [];
/** BOT_SITE=1 (balance tools only): the bot takes a site card whenever one is offered, unless a capstone is. */
const FORCE_SITE = typeof process !== 'undefined' && process.env.BOT_SITE === '1';
/** Takes a capstone when offered, otherwise commits to the branch it has the most ranks in. */
export function botChoose(w: World): number {
  let best = 0;
  let bestScore = Infinity;
  w.choices.forEach((c, i) => {
    const def = TALENTS[c.id];
    const committed = def.branch === 'general' ? 0 : w.branchRanks(def.branch);
    // Forced only until the branch's capstone is in; after that the bot drafts as usual.
    const forced = FORCE_BRANCH.includes(def.branch) && !(Object.keys(TALENTS) as TalentId[]).some((id) => TALENTS[id].branch === def.branch && TALENTS[id].capstone && w.rank(id) > 0) ? 2000 : 0;
    const s = (def.capstone ? -1000 : 0) - (MEASURE_NEW && NEW_CAPS.includes(c.id) ? 500 : 0) - committed * 100 - forced - (FORCE_CAP.includes(c.id) ? 3000 : 0) - (FORCE_SITE && def.where ? 900 : 0) + BOT_PRIORITY.indexOf(c.id);
    if (s < bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

/** Plays a whole run headlessly. */
export function runBot(seed: number, skill = 1, maxSeconds = 700): World {
  const w = new World({ seed });
  while (w.state !== 'ended' && w.time < maxSeconds) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w, skill));
  }
  return w;
}

/**
 * A slower player for balance checks: acts on what the full bot decided
 * `lagTicks` ticks ago (a reaction time), and with `skill` < 1 also misses
 * some interrupts. SKILL alone barely weakens the bot, because its move
 * direction is normalised, so reaction time is the better novice proxy.
 */
export function laggedBot(lagTicks: number, skill = 1): (w: World) => Input {
  const queue: Input[] = [];
  return (w: World) => {
    queue.push(botInput(w, skill));
    const out = queue.length > lagTicks ? queue.shift()! : { x: 0, y: 0 };
    return out;
  };
}
