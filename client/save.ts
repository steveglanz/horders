/**
 * Local hero save. Browser storage can be missing or throw (private windows,
 * blocked site data), so every access is guarded and the game still runs with
 * an in-memory hero. Cloud saves replace this in a later build.
 */
import { HeroProfile, newHero, shareEmbers, toTree } from '../sim/hero';

const KEY = 'horders.hero.v1';

export function loadHero(): HeroProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const h = JSON.parse(raw) as HeroProfile;
      if (h && h.version === 1 && Array.isArray(h.inventory)) return toTree(shareEmbers({ ...newHero(), ...h }));
    }
  } catch {
    // Fall through to a fresh hero.
  }
  return newHero();
}

export function saveHero(h: HeroProfile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
    return true;
  } catch {
    return false;
  }
}

export function resetHero(): HeroProfile {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return newHero();
}
