import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { NoopLogger } from '@thymian/core';
import { describe, expect, it, vitest } from 'vitest';

import { CsvFormatter } from '../src/formatters/csv.js';

/**
 * Replace `createWriteStream` with a stream that opens cleanly and only fails
 * afterwards — the shape of a real `WriteStream` whose write error surfaces
 * asynchronously, well after `stream.write()` has returned. That is the one way
 * `open.failed` gets set while the formatter is still deciding what to report,
 * and it cannot be provoked from the filesystem portably.
 *
 * The factory is hoisted above the imports, so everything it needs is imported
 * inside it.
 */
vitest.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const { EventEmitter } = await import('node:events');

  class FailingWriteStream extends EventEmitter {
    write(_chunk: string, callback?: (error?: Error | null) => void): boolean {
      const error = new Error('disk went away');
      setImmediate(() => {
        this.emit('error', error);
      });
      callback?.(error);

      return false;
    }

    end(callback?: () => void): this {
      setImmediate(() => {
        callback?.();
      });

      return this;
    }
  }

  const createWriteStream = () => {
    const stream = new FailingWriteStream();
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

describe('CsvFormatter when the header write fails after the stream opened', () => {
  it('does not hand back content for a file that never landed', async () => {
    const cwd = join(process.cwd(), 'tmp', 'csv-header-write-failure');
    await rm(cwd, { recursive: true, force: true });

    const logger = new NoopLogger();
    const errorSpy = vitest.spyOn(logger, 'error');
    const debugSpy = vitest.spyOn(logger, 'debug');
    const formatter = new CsvFormatter(logger);
    formatter.init({ cwd });

    // A report with no runs renders zero rows, so the header is the only thing
    // written — and the zero-row short-circuit used to set `lastOutput`
    // regardless of whether that header ever reached disk, so `flush()` handed
    // the caller content for a file that does not exist.
    await formatter.report({
      reportId: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
      createdAt: '2026-08-25T10:30:00.123Z',
      runs: [],
    });

    await expect(formatter.flush()).resolves.toBeUndefined();

    // The failure is reported, and nothing claims the file was written.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write CSV report to'),
    );
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
