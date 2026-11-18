/**
 * A simple autopilot used by tests and balancing scripts: kites away from the
 * horde, steps out of boss telegraphs, and drafts talents by a fixed priority.
 */
import { Input, World } from './world';
import { TalentId } from './content/emberwright';

const PRIORITY: TalentId[] = [
  'conflagration', 'phoenixLance', 'ringOfAsh', 'extraOrb', 'quickcast', 'searingBurn', 'heatSink',
  'kindledGround', 'emberRain', 'cinderSkin', 'rollingInferno', 'searingFocus', 'mend', 'flicker', 'magnetism', 'smallHeal', 'stoke',
];

/** Picks an action-bar slot to press this tick, the way a decent player would. */
export function botCast(w: World, skill = 1): number | undefined {
  const p = w.player;
  // A lower-skill bot misses some interrupts.
  const attentive = (w.tick % 20) / 20 < skill;
  if (attentive && w.canCast(3) && w.interruptTarget() >= 0) return 3;
  let near = 0;
  let touching = 0;
  let bigNear = false;
  let bigInReach = false;
  for (const e of w.enemies) {
    if (!e.alive || !e.hooked) continue;
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

export function botInput(w: World, skill = 1): Input {
  const p = w.player;
  let fx = 0;
  let fy = 0;
  for (const e of w.enemies) {
    if (!e.alive || !e.hooked) continue;
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
  for (const t of w.telegraphs) {
    if (!t.alive) continue;
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
      fx += (dx / d) * 0.2 * skill;
      fy += (dy / d) * 0.2 * skill;
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
      if (d > 340) {
        fx += (dx / d) * 0.03 * skill;
        fy += (dy / d) * 0.03 * skill;
      }
    }
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
  // The Hoard: pull packs while healthy, then drag the train to a Pyre to bank it.
  const wantBank = w.plunder >= 220 + 3 * w.hoard * skill || (p.hp < p.maxHp * 0.45 && w.plunder >= 30);
  if (wantBank) {
    let bd = Infinity;
    let bx = 0;
    let by = 0;
    for (const py of w.pyres) {
      if (!py.alive) continue;
      const d = Math.hypot(py.x - p.x, py.y - p.y);
      if (d < bd) { bd = d; bx = py.x - p.x; by = py.y - p.y; }
    }
    if (bd < Infinity) {
      fx += (bx / (bd || 1)) * 0.05;
      fy += (by / (bd || 1)) * 0.05;
    }
  } else if (w.hoard < 30 + 40 * skill && p.hp > p.maxHp * 0.6) {
    let bd = 650;
    let bx = 0;
    let by = 0;
    for (const e of w.enemies) {
      if (!e.alive || e.hooked) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; bx = e.x - p.x; by = e.y - p.y; }
    }
    if (bd < 650) {
      fx += (bx / (bd || 1)) * 0.012;
      fy += (by / (bd || 1)) * 0.012;
    }
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

export function botChoose(w: World): number {
  let best = 0;
  let bestScore = Infinity;
  w.choices.forEach((c, i) => {
    const s = PRIORITY.indexOf(c.id);
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
