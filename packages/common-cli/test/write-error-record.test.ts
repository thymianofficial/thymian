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

  it('scrubs the head of the stack and leaves its frames readable', async () => {
    const cwd = '/home/me/proj';
    process.argv = [
      '/usr/bin/node',
      '/usr/local/bin/thymian',
      'lint',
      '--cwd',
      cwd,
    ];
    const frames = [
      `    at run (${cwd}/node_modules/@thymian/cli/dist/lint.js:1:1)`,
      `    at main (${cwd}/node_modules/@oclif/core/lib/main.js:2:2)`,
    ].join('\n');
    const err = Object.assign(new Error(`No config in "${cwd}"`), {
      stack: `Error: No config in "${cwd}"\n${frames}`,
    }) as CommandError;

    await writeErrorRecord(
      command('lint'),
      err,
      undefined,
      new ErrorCache(dir),
    );

    const record = JSON.parse(
      await readFile(join(dir, 'last_error.json'), 'utf-8'),
    );
    expect(record.message).toBe(`No config in "${REDACTED}"`);
    expect(record.stack).toBe(`Error: No config in "${REDACTED}"\n${frames}`);
  });

  it('scrubs a URL credential the message echoes percent-encoded', async () => {
    const encoded = 'p%40ss%2Fw0rd';
    process.argv = [
      '/usr/bin/node',
      '/usr/local/bin/thymian',
      'analyze',
      '--traffic',
      `har:https://user:${encoded}@example.com/t.har?key=a%20secret%20value`,
    ];
    const err = new Error(
      `Cannot fetch https://user:${encoded}@example.com/t.har (password "p@ss/w0rd", key a%20secret%20value)`,
    ) as CommandError;

    await writeErrorRecord(
      command('analyze'),
      err,
      undefined,
      new ErrorCache(dir),
    );

    const record = JSON.parse(
      await readFile(join(dir, 'last_error.json'), 'utf-8'),
    );
    expect(record.message).toBe(
      `Cannot fetch https://user:${REDACTED}@example.com/t.har (password "${REDACTED}", key ${REDACTED})`,
    );
  });

  it.each([
    [
      'a throwing getter',
      {
        get input(): string {
          throw new Error('getter failed');
        },
      },
    ],
    [
      'a toJSON that never settles',
      {
        toJSON() {
          return { ...this };
        },
      },
    ],
  ])(
    'writes the record without the cause when it has %s',
    async (_shape, cause) => {
      process.argv = [
        '/usr/bin/node',
        '/usr/local/bin/thymian',
        'lint',
        '--token',
        SECRET,
      ];
      const err = Object.assign(new Error(`Bad token "${SECRET}"`), {
        cause,
      }) as CommandError;

      await expect(
        writeErrorRecord(command('lint'), err, undefined, new ErrorCache(dir)),
      ).resolves.toBeUndefined();

      const record = JSON.parse(
        await readFile(join(dir, 'last_error.json'), 'utf-8'),
      );
      expect(record.message).toBe(`Bad token "${REDACTED}"`);
      expect(record).not.toHaveProperty('cause');
    },
  );
});
