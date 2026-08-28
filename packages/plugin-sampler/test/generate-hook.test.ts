import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { prompts } from '@thymian/common-cli';
import { ThymianEmitter } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { generateHook } from '../src/cli/generate-hook.js';
import { createTempDir } from './utils.js';

/**
 * `sampler generate hook` writes the v1 per-transaction hook shape
 * (`<name>.beforeEach.ts` etc., next to the sample it targets) — but 575.9
 * replaced v1 hook discovery wholesale with a scan of
 * `.thymian/sampler/hooks/`, so nothing loads a file this command writes any
 * more. Removing the command is 575.10's scope; this story's honest minimum
 * is to stop claiming success and say where hooks are actually discovered
 * from instead. These fixtures answer every prompt the command can ask so the
 * write path is reached deterministically, without a real terminal.
 */
vi.mock('@thymian/common-cli', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@thymian/common-cli')>();

  return {
    ...actual,
    prompts: {
      ...actual.prompts,
      confirm: vi.fn(async () => false),
      select: vi.fn(async () => 'Before each request'),
      search: vi.fn(async () => {
        throw new Error('search must not be reached: forTransaction is set');
      }),
    },
  };
});

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

function fakeCommand(): {
  log: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('generateHook — the honest message (round 8c)', () => {
  it('warns that the written file is not loaded, instead of claiming success', async () => {
    const cwd = await createTempDir('.tmp-sampler-generate-hook-');
    roots.push(cwd);

    const samplesDir = join(cwd, '.thymian', 'samples', 'a-transaction');

    await mkdir(samplesDir, { recursive: true });

    const format = createThymianFormatWithTransactions(1);
    const [transaction] = format.getThymianHttpTransactions();

    if (!transaction) {
      throw new Error('fixture format must contain one transaction');
    }

    const emitter = new ThymianEmitter();

    // Stands in for the real sampler plugin's `sampler.path-from-transaction`
    // handler: `generateHook` only needs a path back, and the fixture format
    // has no v1 samples tree behind it for that handler to read.
    emitter.onAction('sampler.path-from-transaction', (_, ctx) => {
      ctx.reply(join(samplesDir, 'request.json'));
    });

    const command = fakeCommand();

    // `confirm` is mocked `false` (see the `vi.mock` above) for the general
    // case; the *next* call — "generate a hook file?" — needs `true` so the
    // write path is actually reached.
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true);

    await generateHook(
      // Only `loadFormat` could be reached, and `loadedThymianFormat` is
      // supplied below specifically so it is not.
      undefined as unknown as Parameters<typeof generateHook>[0],
      emitter,
      command as unknown as Parameters<typeof generateHook>[2],
      cwd,
      false,
      transaction.transactionId,
      format,
    );

    expect(command.warn).toHaveBeenCalledTimes(1);

    const [message] = command.warn.mock.calls[0] as [string];

    expect(message).toContain('will not be loaded');
    expect(message).toContain('.thymian/sampler/hooks');

    // The old lie is gone: nothing tells the user this succeeded at what
    // they actually asked for.
    expect(
      command.log.mock.calls.some(([line]: [string]) =>
        line.includes('successfully'),
      ),
    ).toBe(false);

    // The template write itself is unchanged — this story only fixes the
    // message, not whether the file lands, which 575.10 removes wholesale.
    const entries = await readdir(samplesDir);

    expect(entries.some((name) => name.endsWith('.beforeEach.ts'))).toBe(true);
  });
});
