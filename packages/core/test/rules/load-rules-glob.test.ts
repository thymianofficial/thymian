import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadRules } from '../../src/rules/rule-loader.js';

const fixtureDir = join(import.meta.dirname, 'fixtures', 'rule-sets');

describe('rule-set glob loading', () => {
  it('loads glob matches in deterministic sort order (AC5)', async () => {
    const rules = await loadRules(
      join(fixtureDir, 'glob-basic', 'rule-set.mjs'),
    );

    expect(rules.map((rule) => rule.meta.name)).toEqual([
      'glob-basic-a',
      'glob-basic-z',
    ]);
  });

  it('excludes node_modules from a wide glob (AC1)', async () => {
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
        "throw new Error('evil.rule.mjs under node_modules must never be loaded (AC1)');\n",
      );

      const rules = await loadRules(join(dir, 'rule-set.mjs'));

      expect(rules).toHaveLength(1);
      expect(rules[0]?.meta.name).toBe('glob-node-modules-kept');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('excludes the rule set file itself from its own matches (AC1)', async () => {
    const rules = await loadRules(
      join(fixtureDir, 'glob-self-match', 'self.rule.mjs'),
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]?.meta.name).toBe('glob-self-match-other');
  });

  it('fails framed when a glob match is itself a rule set: rule sets do not nest (AC2)', async () => {
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

  it('skips a non-loadable-kind match (.d.ts) with a framed reason, still loading the rest of the set (AC3)', async () => {
    const warnings: unknown[] = [];
    const onWarning = (warning: unknown) => warnings.push(warning);
    process.on('warning', onWarning);

    try {
      const rules = await loadRules(
        join(fixtureDir, 'glob-skip-kinds', 'rule-set.mjs'),
      );

      expect(rules).toHaveLength(1);
      expect(rules[0]?.meta.name).toBe('glob-skip-kinds-valid');

      // Give the emitted warning a tick to be delivered.
      await new Promise((resolve) => setImmediate(resolve));

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        name: 'RuleLoadError',
        message: expect.stringMatching(/declaration\.rule\.d\.ts/),
      });
    } finally {
      process.off('warning', onWarning);
    }
  });

  it('fails the whole set, framed and naming the file, on a real syntax error (AC4)', async () => {
    await expect(
      loadRules(join(fixtureDir, 'glob-syntax-error', 'rule-set.mjs')),
    ).rejects.toMatchObject({
      name: 'RuleLoadError',
      message: expect.stringContaining('broken.rule.mjs'),
    });
  });

  it('throws when the glob matched files but produced zero rules (AC5)', async () => {
    await expect(
      loadRules(join(fixtureDir, 'glob-zero-rules', 'rule-set.mjs')),
    ).rejects.toMatchObject({
      name: 'RuleLoadError',
      message: expect.stringMatching(
        /matched files but produced no loadable rules/,
      ),
    });
  });

  it('does not throw when the glob matches nothing at all (pre-existing behavior, unchanged by AC5)', async () => {
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
