/**
 * Co-op threat: which hero each enemy attacks. Pure data and functions so the
 * skills (Bulwark passive, Charge taunt, Sidestep threat dump) can call them.
 * Solo ignores threat: with one hero the target is always that hero.
 * Rules and sources: docs/design/group-play.md.
 */
export const THREAT = {
  perDamage: 1,
  /** Per point of effective healing, split across enemies in the fight. */
  perHeal: 0.5,
  /** Bulwark class passive. */
  tankMult: 4,
  /** A new hero takes the enemy only by beating the current target by this share. */
  switchMargin: 0.2,
  /** Taunt puts you this far above the top threat. */
  tauntLead: 0.1,
  /** Seconds a taunt forces the enemy onto you. */
  tauntTime: 3,
};

export interface ThreatTable {
  /** Threat per hero id. */
  amounts: Record<string, number>;
  /** Hero the enemy is attacking, or null before anyone has threat. */
  target: string | null;
  /** Hero forced by a taunt, and seconds left. */
  forced: string | null;
  forcedT: number;
}

export function newThreat(): ThreatTable {
  return { amounts: {}, target: null, forced: null, forcedT: 0 };
}

function add(t: ThreatTable, hero: string, v: number): void {
  t.amounts[hero] = (t.amounts[hero] ?? 0) + v;
}

/** Threat from damage dealt by `hero`. `mult` is the hero's threat multiplier (THREAT.tankMult for a Bulwark). */
export function damageThreat(t: ThreatTable, hero: string, damage: number, mult = 1): void {
  if (damage > 0) add(t, hero, damage * THREAT.perDamage * mult);
}

/** Threat from effective healing (no overheal), split across every enemy table in the fight. */
export function healThreat(tables: ThreatTable[], hero: string, effectiveHeal: number, mult = 1): void {
  if (effectiveHeal <= 0 || !tables.length) return;
  const each = (effectiveHeal * THREAT.perHeal * mult) / tables.length;
  for (const t of tables) add(t, hero, each);
}

/** Taunt: top threat plus a lead, and the enemy is forced onto `hero` for THREAT.tauntTime. */
export function taunt(t: ThreatTable, hero: string): void {
  const top = Math.max(0, ...Object.values(t.amounts));
  t.amounts[hero] = Math.max(t.amounts[hero] ?? 0, top * (1 + THREAT.tauntLead));
  t.forced = hero;
  t.forcedT = THREAT.tauntTime;
  t.target = hero;
}

/** Multiplies `hero`'s threat by `factor` (Sidestep uses 0.5). */
export function scaleThreat(t: ThreatTable, hero: string, factor: number): void {
  if (t.amounts[hero] !== undefined) t.amounts[hero] *= factor;
}

/** Removes a hero (death or leaving). */
export function dropHero(t: ThreatTable, hero: string): void {
  delete t.amounts[hero];
  if (t.forced === hero) { t.forced = null; t.forcedT = 0; }
  if (t.target === hero) t.target = null;
}

/** Advances the taunt timer and returns who the enemy attacks now. */
export function updateTarget(t: ThreatTable, dt: number): string | null {
  if (t.forced) {
    t.forcedT -= dt;
    if (t.forcedT > 0) return (t.target = t.forced);
    t.forced = null;
  }
  let best: string | null = null;
  let bestV = -Infinity;
  for (const [h, v] of Object.entries(t.amounts)) if (v > bestV) { best = h; bestV = v; }
  if (best === null) return (t.target = null);
  const cur = t.target !== null ? t.amounts[t.target] : undefined;
  if (cur === undefined || best === t.target || bestV > cur * (1 + THREAT.switchMargin)) t.target = best;
  return t.target;
}
