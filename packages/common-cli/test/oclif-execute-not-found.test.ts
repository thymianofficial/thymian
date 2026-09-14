import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../src/oclif.js';

/**
 * End-to-end regression for the argv-repoint fix living at the execute/handle
 * boundary (packages/common-cli/src/oclif.ts).
 *
 * The fixture CLI (test/fixtures/repro) has one command, `greet NAME` (NAME
 * required), and a command_not_found hook that re-runs `greet` — standing in
 * for @oclif/plugin-not-found's accepted "did you mean …?" suggestion. Running
 * a typo therefore re-runs `greet` with no args, which fails a showHelp parse
 * error while process.argv still holds the typo.
 *
 * Without the fix, oclif core's handle() calls showHelp(process.argv) for the
 * unknown command, throws, and dumps raw stack traces. This test pins the
 * fixed behavior AND the oclif internals it relies on (err.parse.input.context
 * .id and handle() reading process.argv), so an @oclif/core bump that breaks
 * either would fail here rather than silently regress.
 */
const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'repro',
);

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, '');

describe('oclif.execute (command_not_found suggestion path)', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    vi.restoreAllMocks();
    process.argv = originalArgv;
  });

  const runTyped = async (typed: string[]) => {
    const chunks: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      chunks.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      chunks.push(String(chunk));
      return true;
    });
    // oclif's handle() renders via console.error; vitest intercepts console
    // before it reaches the stream spies above, so capture it directly too.
    for (const method of ['error', 'warn', 'log'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        chunks.push(args.map((a) => String(a)).join(' ') + '\n');
      });
    }
    let exitCode: number | undefined;
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as typeof process.exit);

    process.argv = ['node', 'repro', ...typed];
    await execute({ loadOptions: { root: fixtureRoot } });

    return { exitCode, output: stripAnsi(chunks.join('')) };
  };

  it('renders clean help for the re-run command with no stack traces', async () => {
    const { output } = await runTyped(['gree']);

    // The suggested command's required-arg error is shown, with its usage…
    expect(output).toContain('Missing 1 required arg');
    expect(output).toContain('USAGE');

    // …and none of the pre-fix breakage leaks: no raw stack trace, and no
    // spurious "not found" for the original typo.
    expect(output).not.toMatch(/\bat validateArgs\b/);
    expect(output).not.toMatch(/at async Config\.runHook/);
    expect(output).not.toContain('gree not found');
  });

  it('leaves process.argv unchanged after handling the error', async () => {
    await runTyped(['gree']);
    expect(process.argv).to.deep.equal(['node', 'repro', 'gree']);
  });
});
