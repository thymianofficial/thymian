import { existsSync } from 'node:fs';
import { join } from 'node:path';

import fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianRawAsync,
  fixturesDir,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

describe('thymian sampler check', () => {
  const getTempDir = useTempDir();

  it('executes every transaction against a live API with nothing generated', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const port = await getAvailablePort();
    const server = fastify();

    server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
      return { content: `Hello ${req.query.name}` };
    });

    await server.listen({ port, host: '0.0.0.0' });

    try {
      const result = await execThymianRawAsync(
        ['sampler', 'check', '--target-url', `http://localhost:${port}`],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('GET /api/hello');
      expect(result.output).toMatch(/Checked \d+ transactions?\. All passed\./);
      // It answers "can this be executed", and it needs no `sampler init`
      // first — the requests come from the in-memory projection.
      expect(existsSync(join(getTempDir(), '.thymian'))).toBe(false);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('reports a failure and names the selector to anchor a hook to', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    const port = await getAvailablePort();
    const server = fastify();

    server.get('/api/hello', async (_req, reply) => {
      // The fixture declares 200, so a 500 is a transaction that cannot be
      // executed as described.
      return reply.status(500).send({ error: 'nope' });
    });

    await server.listen({ port, host: '0.0.0.0' });

    try {
      const result = await execThymianRawAsync(
        [
          'sampler',
          'check',
          '--incremental',
          '--target-url',
          `http://localhost:${port}`,
        ],
        { cwd: getTempDir(), allowFailure: true },
      );

      expect(result.output).toContain('anchoring a hook to its selector');
      expect(result.output).toContain(
        'GET /api/hello -> 200 (application/json)',
      );
    } finally {
      await server.close();
    }
  }, 180_000);
});
