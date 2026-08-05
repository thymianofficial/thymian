import { join } from 'node:path';

import { captureOutput } from '@oclif/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../../..');

vi.mock('@thymian/core', async () => {
  const actual =
    await vi.importActual<typeof import('@thymian/core')>('@thymian/core');

  return {
    ...actual,
    loadRules: vi.fn(),
  };
});

import {
  loadRules,
  type Rule,
  type RuleMeta,
  SEVERITY_SYMBOLS,
} from '@thymian/core';

import ExplainRule from '../../../src/commands/explain/rule.js';

const mockedLoadRules = vi.mocked(loadRules);

function makeRule(meta: Partial<RuleMeta> & { name: string }): Rule {
  return {
    meta: {
      type: ['static'],
      severity: 'warn',
      options: {} as RuleMeta['options'],
      ...meta,
    },
  } as unknown as Rule;
}

const fullyPopulated = makeRule({
  name: 'rfc9110/example-rule',
  severity: 'error',
  type: ['static'],
  summary: 'A short one-liner.',
  description: 'A longer description of what the rule checks.',
  explanation: 'This matters because interoperability depends on it.',
  recommendation: 'Do the recommended thing to fix it.',
  appliesTo: ['origin server', 'client'],
  url: 'https://www.rfc-editor.org/rfc/rfc9110.html#name-overview',
});

// ANSI escape (U+001B) — kept as a computed value so the source stays plain.
const ANSI_ESCAPE = String.fromCharCode(27);

// Error symbol sourced from core (single source of truth), not a literal.
const ERROR_SYMBOL = SEVERITY_SYMBOLS.error;

describe('explain rule command', () => {
  beforeEach(() => {
    mockedLoadRules.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders every field for a fully-populated rule', async () => {
    mockedLoadRules.mockResolvedValue([fullyPopulated]);

    const { stdout } = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/example-rule', '--no-autoload']);
    });

    expect(stdout).toContain('rfc9110/example-rule');
    expect(stdout).toContain('SUMMARY');
    expect(stdout).toContain('A short one-liner.');
    expect(stdout).toContain('DESCRIPTION');
    expect(stdout).toContain('A longer description of what the rule checks.');
    expect(stdout).toContain('EXPLANATION');
    expect(stdout).toContain(
      'This matters because interoperability depends on it.',
    );
    expect(stdout).toContain('RECOMMENDATION');
    expect(stdout).toContain('Do the recommended thing to fix it.');
    expect(stdout).toContain('SEVERITY');
    expect(stdout).toContain('error');
    expect(stdout).toContain('APPLIES TO');
    expect(stdout).toContain('origin server, client');
    expect(stdout).toContain('REFERENCE');
    expect(stdout).toContain(
      'https://www.rfc-editor.org/rfc/rfc9110.html#name-overview',
    );

    // Field order is a documented contract (UX Decision 11), not just presence.
    const sectionOrder = [
      'RULE',
      'SUMMARY',
      'DESCRIPTION',
      'EXPLANATION',
      'RECOMMENDATION',
      'SEVERITY',
      'APPLIES TO',
      'REFERENCE',
    ];
    const positions = sectionOrder.map((heading) => stdout.indexOf(heading));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('fails cleanly with a non-zero exit for an unknown rule', async () => {
    mockedLoadRules.mockResolvedValue([fullyPopulated]);

    const { error } = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/does-not-exist', '--no-autoload']);
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('Unknown rule "rfc9110/does-not-exist"');
    expect(error!.message).toContain('thymian rules list');
    // oclif errors carry a non-zero exit code.
    expect(
      (error as { oclif?: { exit?: number } }).oclif?.exit,
    ).toBeGreaterThan(0);
  });

  it('produces identical output on repeated invocations', async () => {
    mockedLoadRules.mockResolvedValue([fullyPopulated]);

    const first = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/example-rule', '--no-autoload']);
    });
    const second = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/example-rule', '--no-autoload']);
    });

    expect(first.stdout).toEqual(second.stdout);
  });

  it('keeps content identical across color modes, preserving the severity symbol', async () => {
    mockedLoadRules.mockResolvedValue([fullyPopulated]);

    const run = async (): Promise<void> => {
      await ExplainRule.run(['rfc9110/example-rule', '--no-autoload']);
    };

    // Default capture strips ANSI; the second keeps it (`stripAnsi: false`) so
    // the comparison is non-vacuous — the helper's default would otherwise hide
    // any escapes the command emitted.
    const { stdout: stripped } = await captureOutput(run);
    const { stdout: raw } = await captureOutput(run, { stripAnsi: false });

    // Color is purely presentational (via `ux.colorize`): stripping ANSI from
    // the raw render must reproduce the plain render exactly — AC5's "content
    // identical across modes, only presentation changes".
    const ansiPattern = new RegExp(`${ANSI_ESCAPE}\\[[0-9;]*m`, 'g');
    expect(raw.replace(ansiPattern, '')).toEqual(stripped);
    // The Unicode severity symbol is content, not color — it survives stripping.
    expect(stripped).toContain(ERROR_SYMBOL);
  });

  it('loads rules threshold-independently — filter admits warn/hint/off', async () => {
    mockedLoadRules.mockResolvedValue([fullyPopulated]);

    await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/example-rule', '--no-autoload']);
    });

    // The 2nd arg to loadRules is the rule filter. `explain` must NOT gate on
    // the active severity threshold, so the filter has to admit non-error rules
    // (incl. disabled `off` rules) — otherwise a real warn/hint rule the user
    // names would be reported as "Unknown rule".
    expect(mockedLoadRules).toHaveBeenCalledTimes(1);
    // `loadRules`' filter param is optional (defaults to `() => true`), so the
    // captured arg is `RuleFilter | undefined`; assert + narrow before calling.
    const filter = mockedLoadRules.mock.calls[0]?.[1];
    expect(filter).toBeDefined();
    if (!filter) {
      return;
    }
    expect(filter(makeRule({ name: 'w', severity: 'warn' }))).toBe(true);
    expect(filter(makeRule({ name: 'h', severity: 'hint' }))).toBe(true);
    expect(filter(makeRule({ name: 'o', severity: 'off' }))).toBe(true);
  });

  it('omits the "APPLIES TO" section for an empty appliesTo array', async () => {
    mockedLoadRules.mockResolvedValue([
      makeRule({
        name: 'rfc9110/empty-applies-to',
        severity: 'error',
        description: 'Only a description is present.',
        appliesTo: [],
      }),
    ]);

    const { stdout } = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/empty-applies-to', '--no-autoload']);
    });

    expect(stdout).not.toContain('APPLIES TO');
  });

  it('renders an `off`-severity rule without a symbol or error', async () => {
    mockedLoadRules.mockResolvedValue([
      makeRule({
        name: 'rfc9110/disabled-rule',
        severity: 'off',
        description: 'A disabled rule can still be explained.',
      }),
    ]);

    const { stdout, error } = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/disabled-rule', '--no-autoload']);
    });

    expect(error).toBeUndefined();
    expect(stdout).toContain('SEVERITY');
    expect(stdout).toContain('off');
    // `off` has no report symbol; it must not borrow another severity's glyph.
    expect(stdout).not.toContain(SEVERITY_SYMBOLS.error);
  });

  it('errors clearly when no rules are loaded', async () => {
    mockedLoadRules.mockResolvedValue([]);

    const { error } = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/anything', '--no-autoload']);
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('No rules are loaded');
    expect(
      (error as { oclif?: { exit?: number } }).oclif?.exit,
    ).toBeGreaterThan(0);
  });
});
