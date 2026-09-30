import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { createLintExecution, createToolRun, NoopLogger } from '@thymian/core';
import { describe, expect, it, vitest } from 'vitest';

import { CsvFormatter } from '../src/formatters/csv.js';

/**
 * A stream that opens cleanly and fails every write through the **callback
 * only**, never emitting `'error'`.
 *
 * That is what a real `WriteStream` does on Linux when the kernel refuses the
 * write (the /dev/full vehicle in csv.test.ts, which only runs there). Relying
 * on the `'error'` event alone lost the failure completely: a report with rows
 * was dropped with nothing logged, and a run-less report — whose only write is
 * the header — was announced as written and handed back by `flush()`.
 *
 * csv-write-failure.test.ts covers the stream that emits `'error'`; this one
 * pins the callback-only path on every platform, not just the Linux CI leg.
 */
vitest.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const { EventEmitter } = await import('node:events');

  class CallbackOnlyFailingWriteStream extends EventEmitter {
    write(_chunk: string, callback?: (error?: Error | null) => void): boolean {
      // Deliberately no `emit('error')` — the callback is the only signal.
      setImmediate(() => {
        callback?.(
          Object.assign(new Error('ENOSPC: no space left on device'), {
            code: 'ENOSPC',
          }),
        );
      });

      return false;
    }

    end(callback?: () => void): this {
      // A real stream runs pending write callbacks before this one.
      setImmediate(() => {
        setImmediate(() => {
          callback?.();
        });
      });

      return this;
    }
  }

  const createWriteStream = () => {
    const stream = new CallbackOnlyFailingWriteStream();
    setImmediate(() => {
      stream.emit('ready');
    });

    return stream;
  };

  return {
    ...actual,
    createWriteStream:
      createWriteStream as unknown as typeof actual.createWriteStream,
  };
});

const reportBase = {
  reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
  createdAt: '2026-08-25T10:30:00.123Z',
};

describe('CsvFormatter when writes fail through the callback only', () => {
  async function freshCwd(name: string): Promise<string> {
    const cwd = join(process.cwd(), 'tmp', name);
    await rm(cwd, { recursive: true, force: true });

    return cwd;
  }

  it('reports a failed data write instead of dropping the report silently', async () => {
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const infoSpy = vitest.spyOn(logger, 'info');
    const formatter = new CsvFormatter(logger);
    formatter.init({ cwd: await freshCwd('csv-callback-only-rows') });

    await formatter.report({
      ...reportBase,
      runs: [
        createToolRun({
          tool: { name: 'tool' },
          runType: 'lint',
          rules: [{ id: 'rule/id', severity: 'error' }],
          executions: [
            createLintExecution({
              ruleId: 'rule/id',
              status: { kind: 'failed', reason: 'Problem' },
              location: { type: 'custom', value: 'somewhere' },
            }),
          ],
        }),
      ],
    });

    await expect(formatter.flush()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write CSV report to'),
    );
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('does not claim a run-less report whose header never landed', async () => {
    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const infoSpy = vitest.spyOn(logger, 'info');
    const formatter = new CsvFormatter(logger);
    formatter.init({ cwd: await freshCwd('csv-callback-only-header') });

    // Zero rows: the header is the only write, so nothing but its callback can
    // report the failure. This is the case that used to announce success.
    await formatter.report({ ...reportBase, runs: [] });

    await expect(formatter.flush()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write CSV report to'),
    );
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
