import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

// Spying on tinyglobby's `glob` lets three things be tested that behavioral
// fixtures alone cannot exercise:
//  - AC1: the exact `ignore` option reaching tinyglobby (the behavioral
//    node_modules-exclusion test in load-rules-glob.test.ts is the real gate;
//    this is the belt to that suspenders).
//  - AC3: a broken symlink match. tinyglobby's default `onlyFiles: true`
//    filters a broken symlink out of its own results on this platform
//    (verified: it never reaches `loadRuleSet`'s match loop as a real glob()
//    return), so forcing the filename through here is what actually reaches
//    — and proves — the AC3 skip guard, rather than passing vacuously
//    because the case never arrives.
//  - AC4: a match that "vanished between glob and read" — a filename the
//    glob call reports, but that is not actually on disk by the time the
//    loader tries to load it.
const globImpl = vi.fn();

vi.mock('tinyglobby', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tinyglobby')>();

  return {
    ...actual,
    glob: (...args: Parameters<typeof actual.glob>) => globImpl(...args),
  };
});

const fixtureDir = join(import.meta.dirname, 'fixtures', 'rule-sets');

describe('rule-set glob loading (mocked tinyglobby)', () => {
  afterEach(() => {
    globImpl.mockReset();
  });

  it('passes the node_modules ignore option to tinyglobby (AC1)', async () => {
    const actual =
      await vi.importActual<typeof import('tinyglobby')>('tinyglobby');
    globImpl.mockImplementation((pattern: string, options: unknown) =>
      actual.glob(pattern, options),
    );

    const { loadRules } = await import('../../src/rules/rule-loader.js');

    await loadRules(join(fixtureDir, 'glob-basic', 'rule-set.mjs'));

    expect(globImpl).toHaveBeenCalledWith(
      './rules/*.rule.mjs',
      expect.objectContaining({ ignore: ['**/node_modules/**'] }),
    );
  });

  it('skips a broken symlink match with a framed reason, never a raw fs error, still loading the rest of the set (AC3)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glob-broken-symlink-'));

    try {
      writeFileSync(
        join(dir, 'valid.rule.mjs'),
        // A tmpdir fixture has no node_modules chain to resolve a bare
        // specifier like `@thymian/core`, so this is a hand-constructed
        // (informational, execution-function-free) rule object rather than
        // the httpRule builder used elsewhere.
        'export default { meta: { name: "glob-broken-symlink-valid", severity: "error", type: ["informational"], tags: [], options: {} } };\n',
      );
      symlinkSync(
        join(dir, 'does-not-exist.mjs'),
        join(dir, 'broken.rule.mjs'),
      );
      writeFileSync(
        join(dir, 'rule-set.mjs'),
        "export default { name: 'glob-broken-symlink', pattern: '*.rule.mjs' };\n",
      );

      // Force both matches through regardless of what tinyglobby's own
      // onlyFiles filtering would report for the broken symlink on this
      // platform (see the module comment above).
      globImpl.mockResolvedValue(['broken.rule.mjs', 'valid.rule.mjs']);

      const { loadRules } = await import('../../src/rules/rule-loader.js');
      const rules = await loadRules(join(dir, 'rule-set.mjs'));

      expect(rules).toHaveLength(1);
      expect(rules[0]?.meta.name).toBe('glob-broken-symlink-valid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails the whole set, framed and naming the file, when a matched file vanishes before it is loaded (AC4)', async () => {
    globImpl.mockResolvedValue(['ghost.rule.mjs']);

    const { loadRules } = await import('../../src/rules/rule-loader.js');

    await expect(
      loadRules(join(fixtureDir, 'glob-vanish', 'rule-set.mjs')),
    ).rejects.toMatchObject({
      name: 'RuleLoadError',
      message: expect.stringContaining('ghost.rule.mjs'),
    });
  });
});
