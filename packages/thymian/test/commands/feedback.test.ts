import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import { captureOutput } from '@oclif/test';
import { prompts } from '@thymian/common-cli';
import open from 'open';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

vi.mock('open', () => ({ default: vi.fn(async () => undefined) }));

vi.mock('@thymian/common-cli', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@thymian/common-cli')>();

  return {
    ...actual,
    prompts: { confirm: vi.fn(), select: vi.fn() },
  };
});

import { Feedback } from '../../src/commands/feedback.js';
import { aCachedError } from '../support/cached-error.js';
import { loadOclifConfig } from '../support/oclif-config.js';

const oclifConfig = await loadOclifConfig();
const cacheDirKey = oclifConfig.scopedEnvVarKey('CACHE_DIR');

const REFUSAL =
  'thymian feedback needs an interactive terminal, so you can review what it would send. Run it again from a terminal.';

const STACK = 'Error: boom\n    at /home/testuser/project/src/lint.ts:10:5';

const record = aCachedError({
  message: 'boom',
  stack: STACK,
  commandName: 'lint',
  timestamp: 1_700_000_000_000,
  argv: ['lint'],
  version: {
    architecture: 'arm64',
    cliVersion: '1.2.3',
    nodeVersion: 'v22.0.0',
    osVersion: 'Darwin',
  },
  pluginVersions: [{ name: '@thymian/plugin-openapi', version: '1.2.3' }],
});

const confirm = vi.mocked(prompts.confirm);
const select = vi.mocked(prompts.select);
const openMock = vi.mocked(open);

function exitPromptError(): Error {
  const error = new Error('User force closed the prompt with SIGINT');
  error.name = 'ExitPromptError';
  return error;
}

/** Answer the prompts in order: the confirm, then each select. */
function answer(confirmed: boolean | Error, ...selections: string[]): void {
  if (confirmed instanceof Error) {
    confirm.mockRejectedValueOnce(confirmed);
  } else {
    confirm.mockResolvedValueOnce(confirmed);
  }
  for (const selection of selections) {
    select.mockResolvedValueOnce(selection as never);
  }
}

function exitCodeOf(error: Error | undefined): number | undefined {
  return (error as { oclif?: { exit?: number } } | undefined)?.oclif?.exit;
}

describe('feedback command', () => {
  let cacheDir: string;
  let recordFile: string;
  const tty = {
    stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
    stdout: Object.getOwnPropertyDescriptor(process.stdout, 'isTTY'),
  };

  function setTTY(stdin: boolean, stdout: boolean): void {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: stdin,
      configurable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: stdout,
      configurable: true,
    });
  }

  function writeRecord(): string {
    const content = JSON.stringify(record);
    writeFileSync(recordFile, content);
    return content;
  }

  function run() {
    return captureOutput(() => Feedback.run([], oclifConfig), {
      stripAnsi: true,
    });
  }

  beforeEach(() => {
    // Never the user's real cache: the command reads, keeps and deletes the
    // record in the config's cache directory. `Command.run` reloads the config
    // it is given, so the directory is set through the scoped env variable the
    // reload reads (oclif ignores XDG_CACHE_HOME on macOS).
    cacheDir = mkdtempSync(join(os.tmpdir(), 'thymian-feedback-'));
    recordFile = join(cacheDir, 'last_error.json');
    process.env[cacheDirKey] = cacheDir;
    vi.spyOn(os, 'homedir').mockReturnValue('/home/testuser');
    setTTY(true, true);
  });

  afterEach(() => {
    for (const [stream, descriptor] of [
      [process.stdin, tty.stdin],
      [process.stdout, tty.stdout],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(stream, 'isTTY', descriptor);
      } else {
        delete (stream as { isTTY?: boolean }).isTTY;
      }
    }
    delete process.env[cacheDirKey];
    rmSync(cacheDir, { recursive: true, force: true });
    process.exitCode = undefined;
    vi.restoreAllMocks();
    confirm.mockReset();
    select.mockReset();
    openMock.mockReset();
  });

  describe('without an interactive terminal', () => {
    it.each([
      ['stdin', false, true],
      ['stdout', true, false],
    ])(
      'refuses when %s is not a TTY, showing nothing from the record',
      async (_, stdin, stdout) => {
        const content = writeRecord();
        setTTY(stdin, stdout);

        const { error, stdout: out, stderr } = await run();

        expect(exitCodeOf(error)).toBe(2);
        expect(stderr.trim()).toBe(REFUSAL);
        expect(out).toBe('');
        expect(out + stderr).not.toContain('boom');
        expect(openMock).not.toHaveBeenCalled();
        expect(readFileSync(recordFile, 'utf-8')).toBe(content);
      },
    );

    it('refuses the same way when there is no record', async () => {
      setTTY(false, false);

      const { error, stdout, stderr } = await run();

      expect(exitCodeOf(error)).toBe(2);
      expect(stderr.trim()).toBe(REFUSAL);
      expect(stdout).toBe('');
      expect(openMock).not.toHaveBeenCalled();
      expect(existsSync(recordFile)).toBe(false);
    });
  });

  describe('reviewing the draft', () => {
    it('shows the exact issue draft, opens it on send, then deletes the record', async () => {
      writeRecord();
      answer(true, 'github', 'send');

      const { error, stdout } = await run();

      expect(error).toBeUndefined();
      expect(openMock).toHaveBeenCalledTimes(1);
      const opened = new URL(openMock.mock.calls[0]![0]);
      const title = opened.searchParams.get('title')!;
      const body = opened.searchParams.get('body')!;
      expect(stdout).toContain(`Title: ${title}`);
      expect(stdout).toContain(body);
      expect(body).toContain('at ~/project/src/lint.ts:10:5');
      expect(existsSync(recordFile)).toBe(false);
    });

    it('shows the exact email draft, opens it on send, then deletes the record', async () => {
      writeRecord();
      answer(true, 'email', 'send');

      const { error, stdout } = await run();

      expect(error).toBeUndefined();
      expect(openMock).toHaveBeenCalledTimes(1);
      const mailto = openMock.mock.calls[0]![0];
      expect(mailto).toMatch(/^mailto:/);
      const params = new URLSearchParams(mailto.slice(mailto.indexOf('?') + 1));
      expect(stdout).toContain(`Subject: ${params.get('subject')}`);
      expect(stdout).toContain(params.get('body')!);
      expect(params.get('body')).toContain('at ~/project/src/lint.ts:10:5');
      expect(existsSync(recordFile)).toBe(false);
    });

    it('shows the draft again without the stack, and sends that draft', async () => {
      writeRecord();
      answer(true, 'github', 'without-stack', 'send');

      const { error, stdout } = await run();

      expect(error).toBeUndefined();
      const body = new URL(openMock.mock.calls[0]![0]).searchParams.get(
        'body',
      )!;
      expect(body).toContain('_Stack trace left out._');
      expect(body).not.toContain('lint.ts:10:5');
      // The reduced draft is shown after the full one, before it is sent.
      expect(stdout.lastIndexOf(body)).toBeGreaterThan(
        stdout.indexOf('lint.ts:10:5'),
      );
    });

    it('offers to leave the stack out only when there is a stack', async () => {
      writeFileSync(
        recordFile,
        JSON.stringify({ ...record, stack: undefined }),
      );
      answer(true, 'github', 'send');

      await run();

      const review = select.mock.calls[1]![0] as {
        choices: { value: string }[];
      };
      expect(review.choices.map((choice) => choice.value)).toEqual([
        'send',
        'cancel',
      ]);
    });

    it('opens nothing and keeps the record on cancel', async () => {
      const content = writeRecord();
      answer(true, 'email', 'cancel');

      const { error } = await run();

      expect(error).toBeUndefined();
      expect(process.exitCode ?? 0).toBe(0);
      expect(openMock).not.toHaveBeenCalled();
      expect(readFileSync(recordFile, 'utf-8')).toBe(content);
    });

    it('keeps the record when the user picks not to send it at all', async () => {
      const content = writeRecord();
      answer(true, 'none');

      const { error } = await run();

      expect(error).toBeUndefined();
      expect(openMock).not.toHaveBeenCalled();
      expect(readFileSync(recordFile, 'utf-8')).toBe(content);
    });
  });

  describe('Ctrl+C', () => {
    it('at the confirm exits 130, opens nothing and keeps the record', async () => {
      const content = writeRecord();
      answer(exitPromptError());

      const { error } = await run();

      expect(exitCodeOf(error)).toBe(130);
      expect(openMock).not.toHaveBeenCalled();
      expect(readFileSync(recordFile, 'utf-8')).toBe(content);
    });

    it('at the channel choice exits 130, opens nothing and keeps the record', async () => {
      const content = writeRecord();
      answer(true);
      select.mockRejectedValueOnce(exitPromptError());

      const { error } = await run();

      expect(exitCodeOf(error)).toBe(130);
      expect(openMock).not.toHaveBeenCalled();
      expect(readFileSync(recordFile, 'utf-8')).toBe(content);
    });

    it('at the review exits 130, opens nothing and keeps the record', async () => {
      const content = writeRecord();
      answer(true, 'github');
      select.mockRejectedValueOnce(exitPromptError());

      const { error } = await run();

      expect(exitCodeOf(error)).toBe(130);
      expect(openMock).not.toHaveBeenCalled();
      expect(readFileSync(recordFile, 'utf-8')).toBe(content);
    });
  });

  it('never writes a record of its own when opening fails', async () => {
    const content = writeRecord();
    answer(true, 'github', 'send');
    openMock.mockRejectedValueOnce(new Error('no browser'));

    const { error } = await run();

    expect(error?.message).toBe('no browser');
    expect(readFileSync(recordFile, 'utf-8')).toBe(content);
  });
});
