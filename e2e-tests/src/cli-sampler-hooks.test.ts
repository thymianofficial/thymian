import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianRaw,
  execThymianRawAsync,
  fixturesDir,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

const SELECTOR = 'GET /api/hello -> 200 (application/json)';

/**
 * The path is spelled out rather than derived: `.thymian/sampler/hooks` is the
 * documented default a user types, and this suite exists to check the published
 * contract rather than to agree with the implementation about it.
 */
function writeHook(tempDir: string, name: string, source: string): void {
  const hooksDir = join(tempDir, '.thymian', 'sampler', 'hooks');

  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, name), source, 'utf-8');
}

describe('sampler hooks', () => {
  const getTempDir = useTempDir();

  it('fires a beforeEach on the wire with no init ever run', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    // Only a hook file — no `sampler init`, no generated types, no tsconfig.
    writeHook(
      getTempDir(),
      'trace.ts',
      `import { beforeEach } from '@thymian/hooks';

export const addTraceHeader = beforeEach('${SELECTOR}', (request) => {
  request.headers['x-trace'] = 'from-hook';
});
`,
    );

    const seen: (string | undefined)[] = [];
    const port = await getAvailablePort();
    const server = fastify();

    server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
      seen.push(req.headers['x-trace'] as string | undefined);

      return { content: `Hello ${req.query.name}` };
    });

    await server.listen({ port, host: '0.0.0.0' });

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', `http://localhost:${port}`],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(seen.length).toBeGreaterThan(0);
      // The header the hook set arrived at the server on every request.
      expect(seen.every((value) => value === 'from-hook')).toBe(true);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('runs the whole lifecycle in order on a live run', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const log = join(getTempDir(), 'lifecycle.log');

    writeHook(
      getTempDir(),
      'lifecycle.ts',
      `import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  defineSample,
} from '@thymian/hooks';
import { appendFileSync } from 'node:fs';

const log = ${JSON.stringify(log)};

export const setUp = beforeAll(() => {
  appendFileSync(log, 'beforeAll\n');

  return () => appendFileSync(log, 'cleanup\n');
});

export const shape = defineSample('${SELECTOR}', (draft) => {
  draft.query['name'] = 'from-define-sample';
});

export const trace = beforeEach('${SELECTOR}', (request) => {
  request.headers['x-trace'] = 'from-before-each';
});

export const observe = afterEach('${SELECTOR}', (response) => {
  appendFileSync(log, 'afterEach ' + response.statusCode + '\n');
});

export const tearDown = afterAll(() => {
  appendFileSync(log, 'afterAll\n');
});
`,
    );

    const seen: { name?: string; trace?: string }[] = [];
    const port = await getAvailablePort();
    const server = fastify();

    server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
      seen.push({
        name: req.query.name,
        trace: req.headers['x-trace'] as string | undefined,
      });

      return { content: `Hello ${req.query.name}` };
    });

    await server.listen({ port, host: '0.0.0.0' });

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', `http://localhost:${port}`],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);

      // `defineSample` shaped the query and `beforeEach` set the header, on
      // every request.
      expect(seen.length).toBeGreaterThan(0);
      for (const request of seen) {
        expect(request.name).toBe('from-define-sample');
        expect(request.trace).toBe('from-before-each');
      }

      const lines = readFileSync(log, 'utf-8').trim().split('\n');

      // `beforeAll` first, then one `afterEach` per response, then teardown in
      // reverse registration order: `afterAll` was registered after the
      // `beforeAll` whose cleanup it precedes.
      expect(lines[0]).toBe('beforeAll');
      expect(lines.slice(-2)).toEqual(['afterAll', 'cleanup']);
      expect(lines.slice(1, -2).every((line) => line === 'afterEach 200')).toBe(
        true,
      );
      expect(lines.length).toBe(seen.length + 3);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('fails the run fast on a dangling selector, naming the hook file', () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    writeHook(
      getTempDir(),
      'stale.ts',
      `import { beforeEach } from '@thymian/hooks';

export const stale = beforeEach('GET /api/hello -> 418 (application/json)', () => {});
`,
    );

    const result = execThymianRaw(['test'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('does not resolve against the loaded');
    expect(result.output).toContain('stale.ts');
    expect(result.output).toContain('Did you mean one of these selectors?');
    expect(result.output).toContain(SELECTOR);
  }, 180_000);
});
