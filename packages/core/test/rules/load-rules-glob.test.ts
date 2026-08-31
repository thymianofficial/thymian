import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Logger } from '../../src/logger/logger.js';
import { NoopLogger } from '../../src/logger/noop.logger.js';
import { loadRules } from '../../src/rules/rule-loader.js';

// A Logger that records the messages passed to `warn` (everything else is a
// no-op via NoopLogger), so tests can assert on the non-fatal skip diagnostics
// loadRules emits (AC3).
function capturingLogger(): { logger: Logger; warnings: string[] } {
  const warnings: string[] = [];

  class CapturingLogger extends NoopLogger {
    override warn(formatter: unknown, ...args: unknown[]): void {
      warnings.push([formatter, ...args].map(String).join(' '));
    }
  }

  return { logger: new CapturingLogger('test'), warnings };
}

const fixtureDir = join(import.meta.dirname, 'fixtures', 'rule-sets');

describe('rule-set glob loading', () => {
  it('loads glob matches in deterministic sort order', async () => {
    const rules = await loadRules(
      join(fixtureDir, 'glob-basic', 'rule-set.mjs'),
    );

    expect(rules.map((rule) => rule.meta.name)).toEqual([
      'glob-basic-a',
      'glob-basic-z',
    ]);
  });

  it('excludes node_modules from a wide glob', async () => {
    // A real node_modules/ directory cannot live as a committed fixture (the
    // repo's own .gitignore excludes any directory literally named
    // node_modules, anywhere in the tree), so this is built at runtime in a
    // tmpdir instead.
    const dir = mkdtempSync(join(tmpdir(), 'glob-node-modules-'));

    try {
      mkdirSync(join(dir, 'rules', 'node_modules'), { recursive: true });
      writeFileSync(
        join(dir, 'rule-set.mjs'),
        "export default { name: 'glob-node-modules', pattern: './rules/**/*.rule.mjs' };\n",
      );
      writeFileSync(
        join(dir, 'rules', 'kept.rule.mjs'),
        'export default { meta: { name: "glob-node-modules-kept", severity: "error", type: ["informational"], tags: [], options: {} } };\n',
      );
      writeFileSync(
        join(dir, 'rules', 'node_modules', 'evil.rule.mjs'),
        // Throws if ever imported, so an accidental load fails loudly rather
        // than silently passing.
        "throw new Error('evil.rule.mjs under node_modules must never be loaded');\n",
      );

      const rules = await loadRules(join(dir, 'rule-set.mjs'));

      expect(rules).toHaveLength(1);
      expect(rules[0]?.meta.name).toBe('glob-node-modules-kept');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('excludes the rule set file itself from its own matches', async () => {
    const rules = await loadRules(
      join(fixtureDir, 'glob-self-match', 'self.rule.mjs'),
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.meta.name).toBe('glob-self-match-other');
  });

  it('fails framed when a glob match is itself a rule set: rule sets do not nest', async () => {
    await expect(
      loadRules(join(fixtureDir, 'glob-nested', 'outer.mjs')),
    ).rejects.toMatchObject({
      name: 'RuleLoadError',
      message: expect.stringContaining('inner-set.mjs'),
    });

    await expect(
      loadRules(join(fixtureDir, 'glob-nested', 'outer.mjs')),
    ).rejects.toMatchObject({
      message: expect.stringMatching(
        /is a rule set; rule sets cannot contain rule sets/,
      ),
    });
  });

  it('skips a non-loadable-kind match (.d.ts) with a framed reason, still loading the rest of the set', async () => {
    const { logger, warnings } = capturingLogger();

    const rules = await loadRules(
      join(fixtureDir, 'glob-skip-kinds', 'rule-set.mjs'),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      logger,
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.meta.name).toBe('glob-skip-kinds-valid');

    const skipWarnings = warnings.filter((warning) =>
      /declaration\.rule\.d\.ts/.test(warning),
    );

    expect(skipWarnings).toHaveLength(1);
  });

  it('skips a symlink whose spelling is loadable but whose realpath target is unloadable (.d.ts), still loading the rest', async () => {
    // `alias.rule.ts` has a loadable spelling but its realpath is `target.d.ts`
    // (an unloadable kind). Since the load goes through the canonical path, this
    // must be classified as a warned skip (AC3), not a load attempt that fails
    // the whole set.
    const { logger, warnings } = capturingLogger();
    const dir = mkdtempSync(join(tmpdir(), 'glob-symlink-dts-'));

    try {
      mkdirSync(join(dir, 'rules'), { recursive: true });
      // Unloadable target, reached only via the loadable-looking symlink
      // spelling; never matched directly (`*.rule.ts` does not match `.d.ts`).
      writeFileSync(
        join(dir, 'rules', 'target.d.ts'),
        'export default { meta: { name: "unreachable" } };\n',
      );
      symlinkSync(
        join(dir, 'rules', 'target.d.ts'),
        join(dir, 'rules', 'alias.rule.ts'),
      );
      writeFileSync(
        join(dir, 'rules', 'good.rule.ts'),
        'export default { meta: { name: "glob-symlink-dts-good", severity: "error", type: ["informational"], tags: [], options: {} } };\n',
      );
      writeFileSync(
        join(dir, 'rule-set.mjs'),
        "export default { name: 'glob-symlink-dts', pattern: './rules/*.rule.ts' };\n",
      );

      const rules = await loadRules(
        join(dir, 'rule-set.mjs'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        logger,
      );

      expect(rules).toHaveLength(1);
      expect(rules[0]?.meta.name).toBe('glob-symlink-dts-good');

      const skipWarnings = warnings.filter((warning) =>
        /target\.d\.ts/.test(warning),
      );

      expect(skipWarnings).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails the whole set, framed and naming the file, on a real syntax error', async () => {
    await expect(
      loadRules(join(fixtureDir, 'glob-syntax-error', 'rule-set.mjs')),
    ).rejects.toMatchObject({
      name: 'RuleLoadError',
      message: expect.stringContaining('broken.rule.mjs'),
    });
  });

  it('throws when the glob matched files but produced zero rules', async () => {
    await expect(
      loadRules(join(fixtureDir, 'glob-zero-rules', 'rule-set.mjs')),
    ).rejects.toMatchObject({
      name: 'RuleLoadError',
      message: expect.stringMatching(
        /matched files but produced no loadable rules/,
      ),
    });
  });

  it('executes a rule matched via two symlinked spellings only once (canonical load)', async () => {
    // A glob can match the same real file under two spellings (a symlink and
    // its target). The load must go through the canonical realpath so the
    // module executes exactly once. A `.ts` rule makes this observable: jiti
    // keys its module registry by the path handed to it, so loading the two
    // raw spellings re-runs the file's top-level side effects twice, whereas
    // loading the shared canonical path runs them once. (Native ESM would
    // canonicalize symlinks on its own, which is why this uses `.ts`.)
    const dir = mkdtempSync(join(tmpdir(), 'glob-symlink-'));
    const marker = `__thymian_symlink_load_count_${process.pid}`;

    try {
      mkdirSync(join(dir, 'rules'), { recursive: true });
      writeFileSync(
        join(dir, 'rules', 'real.rule.ts'),
        `globalThis[${JSON.stringify(marker)}] = (globalThis[${JSON.stringify(marker)}] ?? 0) + 1;\n` +
          'export default { meta: { name: "glob-symlink-real", severity: "error", type: ["informational"], tags: [], options: {} } };\n',
      );
      symlinkSync(
        join(dir, 'rules', 'real.rule.ts'),
        join(dir, 'rules', 'alias.rule.ts'),
      );
      writeFileSync(
        join(dir, 'rule-set.mjs'),
        "export default { name: 'glob-symlink', pattern: './rules/*.rule.ts' };\n",
      );

      const rules = await loadRules(join(dir, 'rule-set.mjs'));

      // Both spellings match and both resolve to the same rule, so it is
      // returned twice...
      expect(rules).toHaveLength(2);
      // ...but the module executed exactly once, because the load went through
      // the canonical realpath rather than the two symlink spellings.
      expect((globalThis as Record<string, unknown>)[marker]).toBe(1);
    } finally {
      delete (globalThis as Record<string, unknown>)[marker];
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty (does not throw) when matched rules are all excluded by the caller filter', async () => {
    // The glob matches loadable rules, but the caller's filter excludes every
    // one. This must behave like the inline `ruleSet.rules` branch — an empty
    // result, not the "matched files but produced no loadable rules" throw
    // (which is reserved for globs that matched only non-rule files).
    const rules = await loadRules(
      join(fixtureDir, 'glob-basic', 'rule-set.mjs'),
      () => false,
    );

    expect(rules).toEqual([]);
  });

  it('does not throw when the glob matches nothing at all', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'glob-no-match-'));

    try {
      writeFileSync(
        join(dir, 'rule-set.mjs'),
        "export default { name: 'glob-no-match', pattern: '*.does-not-exist' };\n",
      );

      const rules = await loadRules(join(dir, 'rule-set.mjs'));

      expect(rules).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
