/**
 * A simple autopilot used by tests and balancing scripts: kites away from the
 * horde, steps out of boss telegraphs, and drafts talents by a fixed priority.
 */
import { ARENA, Input, World } from './world';
import { TALENTS, TalentId } from './content/emberwright';

const PRIORITY: TalentId[] = [
  'conflagration', 'phoenixLance', 'ringOfAsh', 'extraOrb', 'quickcast', 'ignition', 'searingBurn', 'heatSink',
  'pyroclasm', 'kindledGround', 'emberRain', 'cinderSkin', 'blazingSpeed', 'rollingInferno', 'searingFocus', 'mend',
  'flicker', 'magnetism',
  // Duskblade
  'crimsonTide', 'bladeStorm', 'riposte', 'exsanguinate', 'flurryStep', 'serratedEdge', 'quickBlades', 'thirst', 'hemorrhage', 'longReach', 'thickHide',
  'momentumFlow', 'precision', 'deepCuts', 'counterstep', 'secondWind', 'evasion', 'nimble',
  // Bulwark
  'warpath', 'thornwall', 'unbreakable', 'wideSweep', 'spikedShield', 'shieldEcho', 'ward', 'vengeance', 'holdTheLine',
  'batteringRam', 'lastStand', 'momentum',
  // Lumen
  'noon', 'choirOfDawn', 'martyrsHalo', 'searingRadiance', 'hastedHymn', 'prism', 'kindledLight', 'sunflare', 'aegisOfLight',
  'renewal', 'lingeringSanctuary', 'blessedGround',
  'smallHeal', 'stoke',
];

/** Duskblade action choices: kick casts, execute big foes, dash in, sidestep danger. */
function bladeCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && w.canCast(3) && w.interruptTarget() >= 0) return 3;
  // Step out of a telegraph we are standing in.
  if (attentive && w.canCast(1)) {
    for (const t of w.telegraphs) {
      if (!t.alive || t.kind === 'soak' || t.t > t.dur - 0.5) continue;
      if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 < (t.r + 10) ** 2 && t.shape === 'circle') return 1;
    }
  }
  const t = w.bladeTarget(w.swingReach + 60);
  if (t >= 0 && w.canCast(2)) {
    const e = w.enemies[t];
    if (e.def.rank !== 'normal' || e.hp < e.maxHp * 0.35) return 2;
  }
  const far = w.bladeTarget(340);
  if (far >= 0 && w.canCast(0)) {
    const e = w.enemies[far];
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius;
    if (d > 110 || (e.def.rank === 'normal' && d < 60)) return 0;
  }
  if (w.canCast(1) && p.hp < p.maxHp * 0.35) return 1;
  return undefined;
}

/** Bulwark action choices: toss at casts, Bastion when it hurts, slam crowds, charge big foes. */
function shieldCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && w.canCast(3) && w.interruptTarget() >= 0) return 3;
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
  if (w.canCast(2) && (p.hp < p.maxHp * 0.55 || (attentive && underTelegraph && p.hp < p.maxHp * 0.85))) return 2;
  if (w.canCast(0) && (near >= 3 || bigClose)) return 0;
  const c = w.chargeTarget();
  if (c >= 0 && w.canCast(1)) {
    const e = w.enemies[c];
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius;
    if (d > 140 && (e.def.rank !== 'normal' || near === 0)) return 1;
  }
  return undefined;
}

/** Lumen action choices: hush casts, Sanctuary for big fights, Radiant Burst to heal and clear space. */
function lightCast(w: World, skill: number): number | undefined {
  const p = w.player;
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && w.canCast(3) && w.interruptTarget() >= 0) return 3;
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
  if (w.canCast(2) && (bigNear || hurt > 0.4)) return 2;
  if (w.canCast(0) && (near >= 4 || hurt > 0.25 || (bigNear && near >= 1))) return 0;
  if (w.canCast(1) && hurt > 0.5 && touching >= 2) return 1;
  return undefined;
}

/** Picks an action-bar slot to press this tick, the way a decent player would. */
export function botCast(w: World, skill = 1): number | undefined {
  if (w.cls === 'duskblade') return bladeCast(w, skill);
  if (w.cls === 'bulwark') return shieldCast(w, skill);
  if (w.cls === 'lumen') return lightCast(w, skill);
  const p = w.player;
  // A lower-skill bot misses some interrupts.
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && w.canCast(3) && w.interruptTarget() >= 0) return 3;
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
  if (w.canCast(2) && (bigInReach || near >= 14)) return 2;
  if (w.canCast(0) && (near >= 5 || bigNear)) return 0;
  if (w.canCast(1) && p.hp < p.maxHp * 0.4 && touching >= 3) return 1;
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

export function botInput(w: World, skill = 1): Input {
  const p = w.player;
  if (w.phase === 'choose' && w.gates.length) {
    const g = w.gates[botGate(w)];
    return { x: g.x - p.x, y: g.y - p.y };
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
  let soaking = false;
  // A Bulwark with Resolve to spare stands in blooms and smothers them.
  const smother = w.cls === 'bulwark' && p.heat >= 10;
  for (const t of w.telegraphs) {
    if (!t.alive) continue;
    if (smother && t.kind === 'bloom') continue;
    if (t.kind === 'soak') {
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
      if (t.shape === 'cone') {
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

/** Takes a capstone when offered, otherwise commits to the branch it has the most ranks in. */
export function botChoose(w: World): number {
  let best = 0;
  let bestScore = Infinity;
  w.choices.forEach((c, i) => {
    const def = TALENTS[c.id];
    const committed = def.branch === 'general' ? 0 : w.branchRanks(def.branch);
    const s = (def.capstone ? -1000 : 0) - committed * 100 + PRIORITY.indexOf(c.id);
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
