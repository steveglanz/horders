import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every delve restarts the same GameScene object (main.ts: game.scene.start('game', …)), so
// init() and create() run again while the class fields still hold the last run's objects,
// which Phaser destroyed with that run. A list of game objects that isn't emptied before
// create() refills it keeps those dead objects, and the next layout() or draw that touches them
// throws. Since #101 the stale gate labels did exactly that, and the second delve in a session
// never started (fixed in #108). This scans the scene source so the next new list can't
// repeat it. tools/twodelves.cjs (#109) plays back-to-back delves in a real browser.
const src = readFileSync(resolve(__dirname, '../client/GameScene.ts'), 'utf8');

/** The body of a two-space-indented method, from its signature to its closing brace. */
function body(sig: RegExp): string {
  const m = sig.exec(src);
  if (!m) throw new Error(`no method ${sig}`);
  const end = src.indexOf('\n  }\n', m.index);
  return src.slice(m.index, end);
}

describe('GameScene restarts cleanly', () => {
  const fields = [...src.matchAll(/^ {2}(?:private |protected )?(\w+)(?:!)?: [^=;\n]*\[\] = \[\];/gm)].map((m) => m[1]);
  const reset = body(/^ {2}init\(data[^)]*\)[^{]*\{/m) + body(/^ {2}create\(\)[^{]*\{/m);

  it('finds the scene list fields', () => {
    expect(fields).toContain('gateTexts');
    expect(fields.length).toBeGreaterThan(10);
  });

  it('empties every list field in init() or create()', () => {
    const missed = fields.filter((f) => !new RegExp(`this\\.${f} = \\[\\]`).test(reset));
    expect(missed).toEqual([]);
  });
});
