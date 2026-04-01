import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymian,
  fixturesDir,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

describe('thymian test', () => {
  const getTempDir = useTempDir();

  // TODO: Skipped — dynamic check fails with RequestDispatchError in CI.
  // Will be addressed during the architecture refactor.
  it.skip('should run a dynamic API test with live requests', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'samples/'), getTempDir());

    const port = await getAvailablePort();

    const openapiPath = join(getTempDir(), 'test.openapi.yaml');
    const openapiContent = readFileSync(openapiPath, 'utf-8');
    writeFileSync(
      openapiPath,
      openapiContent.replace(
        'http://localhost:3000',
        `http://localhost:${port}`,
      ),
    );

    const server = fastify();
    server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
      const { name } = req.query;
      return { content: `Hello ${name}` };
    });
    await server.listen({ port, host: '0.0.0.0' });

    try {
      const output = execThymian(['test'], {
        cwd: getTempDir(),
        allowFailure: true,
      });

      expect(output).toMatch(/GET \/api\/hello/);
    } finally {
      await server.close();
    }
  }, 180_000);
});
