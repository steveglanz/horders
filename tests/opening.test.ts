import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { newHero, savedRuns, switchClass } from '../sim/hero';
import { LINE_MS, nextStep, opensOnWake, WAKE_LINES, WakeStep } from '../client/opening';

// CP3 opening, PR 1 (docs/design/opening.md): the first launch flow.
describe('first launch flow', () => {
  it('opens a save that has never delved on the title, not the hub', () => {
    expect(opensOnWake(newHero())).toBe(true);
  });

  it('a save that has delved on any class opens on the hub', () => {
    const h = newHero();
    h.runs = 1;
    expect(opensOnWake(h)).toBe(false);
    // Runs on a class in the roster count too: switching to an unplayed class is not a new save.
    switchClass(h, 'bulwark');
    expect(h.runs).toBe(0);
    expect(savedRuns(h)).toBe(1);
    expect(opensOnWake(h)).toBe(false);
  });

  it('stress runs skip it', () => {
    expect(opensOnWake(newHero(), true)).toBe(false);
  });

  it('goes title, line 1, line 2, then the delve', () => {
    const seen: WakeStep[] = ['title'];
    while (seen[seen.length - 1] !== 'go') seen.push(nextStep(seen[seen.length - 1]));
    expect(seen).toEqual(['title', 0, 1, 'go']);
    expect(LINE_MS).toBe(4000);
  });

  it("keeps the Hearthkeeper's voice: short lines, no exclamation marks (world.md)", () => {
    expect(WAKE_LINES).toEqual(['The Court took the fire. Go down and take some back.', "Take this coal. It's the last one in Wick."]);
    for (const l of WAKE_LINES) {
      expect(l.split(/\s+/).length).toBeLessThanOrEqual(15);
      expect(l).not.toContain('!');
    }
  });

  it('the hub lost its "New here?" box and the page has the wake screen', () => {
    expect(readFileSync('client/hub.ts', 'utf8')).not.toContain('New here?');
    const html = readFileSync('client/index.html', 'utf8');
    expect(html).toContain('id="wake"');
    expect(html).toContain('Tap to wake.');
  });
});
