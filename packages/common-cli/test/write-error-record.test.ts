import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Command } from '@oclif/core';
import type { CommandError } from '@oclif/core/interfaces';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ErrorCache } from '../src/error-cache.js';
import { REDACTED } from '../src/redact-argv.js';
import { writeErrorRecord } from '../src/write-error-record.js';

const SECRET = 'ghp_s3cr3tT0ken';

const command = (id: string) =>
  ({
    id,
    config: {
      versionDetails: {
        architecture: 'arm64',
        cliVersion: '1.0.0',
        nodeVersion: 'v22.0.0',
        pluginVersions: {},
      },
    },
  }) as unknown as Command;

describe('writeErrorRecord', () => {
  let dir: string;
  let originalArgv: string[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'write-error-record-test-'));
    originalArgv = process.argv;
  });

  afterEach(async () => {
    process.argv = originalArgv;
    await rm(dir, { recursive: true, force: true });
  });

  it('keeps flag values out of the record, in argv and in the free text', async () => {
    process.argv = [
      '/usr/bin/node',
      '/usr/local/bin/thymian',
      'lint',
      '-o',
      `some-plugin.auth.token=${SECRET}`,
      '--debug',
    ];
    const err = Object.assign(
      new Error(`Invalid option: "some-plugin.auth.token=${SECRET}"`),
      { cause: { input: `some-plugin.auth.token=${SECRET}` } },
    ) as CommandError;

    await writeErrorRecord(
      command('lint'),
      err,
      undefined,
      new ErrorCache(dir),
    );

    const raw = await readFile(join(dir, 'last_error.json'), 'utf-8');
    expect(raw).not.toContain(SECRET);

    const record = JSON.parse(raw);
    expect(record.argv).toEqual([
      '/usr/bin/node',
      '/usr/local/bin/thymian',
      'lint',
      '-o',
      `some-plugin.auth.token=${REDACTED}`,
      '--debug',
    ]);
    expect(record.message).toBe(
      `Invalid option: "some-plugin.auth.token=${REDACTED}"`,
    );
    expect(record.stack).toContain(`some-plugin.auth.token=${REDACTED}`);
    expect(record.cause).toEqual({
      input: `some-plugin.auth.token=${REDACTED}`,
    });
  });
});
