import { mkdirSync, writeFileSync } from 'node:fs';
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
