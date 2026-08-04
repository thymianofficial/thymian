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
    expect(stdout).toContain(
      'This matters because interoperability depends on it.',
    );
    expect(stdout).toContain('RECOMMENDATION');
    expect(stdout).toContain('Do the recommended thing to fix it.');
    expect(stdout).toContain('SEVERITY');
    expect(stdout).toContain('error');
    expect(stdout).toContain('REFERENCE');
    expect(stdout).toContain(
      'https://www.rfc-editor.org/rfc/rfc9110.html#name-overview',
    );
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

  it('emits plain, symbol-preserving output in non-TTY mode', async () => {
    mockedLoadRules.mockResolvedValue([fullyPopulated]);

    const { stdout } = await captureOutput(async () => {
      await ExplainRule.run(['rfc9110/example-rule', '--no-autoload']);
    });

    // Captured (non-TTY) output carries no ANSI color escapes...
    expect(stdout).not.toContain(ANSI_ESCAPE);
    // ...but the Unicode severity symbol is preserved.
    expect(stdout).toContain(ERROR_SYMBOL);
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
    const filter = mockedLoadRules.mock.calls[0]![1];
    expect(filter(makeRule({ name: 'w', severity: 'warn' }))).toBe(true);
    expect(filter(makeRule({ name: 'h', severity: 'hint' }))).toBe(true);
    expect(filter(makeRule({ name: 'o', severity: 'off' }))).toBe(true);
  });

  it('omits the "Applies to" line for an empty appliesTo array', async () => {
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

    expect(stdout).not.toContain('Applies to:');
  });
});
