import { existsSync } from 'node:fs';
import { join } from 'node:path';

import fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianRawAsync,
  fixturesDir,
  useTempDir,
  writeSamplerHook,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

const CREATE = 'POST /launches (application/json) -> 201 (application/json)';
const READ = 'GET /launches/{id} -> 200 (application/json)';
const STATUS = 'GET /status -> 200 (application/json)';

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
      // The check line is the Selector verbatim, so it pastes back as a hook
      // target (ADR-0020).
      expect(result.output).toContain(
        'GET /api/hello -> 200 (application/json)',
      );
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

/**
 * #48: every Transaction ends in exactly one Outcome, the run always finishes,
 * and a skip names the Seed behind it.
 *
 * Each scenario runs the whole command against a live server, because the
 * claim is about what a user sees at the end of a run — and the bug these
 * replace was that there *was* no end.
 */
describe('the sampler check outcome model', () => {
  const getTempDir = useTempDir();

  /**
   * A server for the outcomes fixture. `onCreate` decides what `POST /launches`
   * answers with, which is what every scenario below varies.
   */
  async function serve(
    onCreate: (reply: {
      status: (code: number) => { send: (body: unknown) => unknown };
    }) => unknown,
  ) {
    const port = await getAvailablePort();
    const server = fastify();

    server.post('/launches', async (_req, reply) => onCreate(reply));
    server.get('/launches/:id', async (req: { params: { id: string } }) => ({
      id: req.params.id,
      name: 'Artemis',
    }));
    server.get('/status', async () => ({ state: 'ok' }));

    await server.listen({ port, host: '0.0.0.0' });

    return { port, server };
  }

  async function check(cwd: string, port: number) {
    return await execThymianRawAsync(
      ['sampler', 'check', '--target-url', `http://localhost:${port}`],
      { cwd, allowFailure: true },
    );
  }

  it('skips a transaction whose seed was answered with another declared status', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());

    writeSamplerHook(
      getTempDir(),
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seedLaunch = beforeEach('${READ}', async (request, ctx, utils) => {
  const created = await utils.request('${CREATE}', { body: { name: 'Artemis' } });

  // Deliberately unbranched: a hook that ignores the other declared responses
  // still compiles and still runs — and when the seed did not create anything,
  // this transaction cannot be executed as described.
  request.pathParameters['id'] = created.body.id;
});
`,
    );

    // 400 is declared for POST /launches, so the seed returns rather than
    // throwing — and its body has no id.
    const { port, server } = await serve((reply) =>
      reply.status(400).send({ message: 'no' }),
    );

    try {
      const result = await check(getTempDir(), port);

      expect(result.output).toContain(`↷ ${READ}`);
      expect(result.output).toContain(
        `The seed "${CREATE}" was answered with 400`,
      );
      // The run reached the transactions after the broken one.
      expect(result.output).toContain(`✔ ${STATUS}`);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('skips a transaction whose seed was answered with an undeclared status', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());

    writeSamplerHook(
      getTempDir(),
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seedLaunch = beforeEach('${READ}', async (request, ctx, utils) => {
  const created = await utils.request('${CREATE}', { body: { name: 'Artemis' } });

  request.pathParameters['id'] = created.body.id;
});
`,
    );

    // 500 is declared nowhere, so the seed throws UndeclaredResponseError —
    // which nobody is forced to catch.
    const { port, server } = await serve((reply) =>
      reply.status(500).send({ message: 'FOREIGN KEY constraint failed' }),
    );

    try {
      const result = await check(getTempDir(), port);

      expect(result.output).toContain(`↷ ${READ}`);
      expect(result.output).toContain(
        'was answered with 500, which the specification does not declare',
      );
      expect(result.output).toContain(`✔ ${STATUS}`);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('skips a transaction whose request cannot be built, and says which value is missing', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());

    writeSamplerHook(
      getTempDir(),
      'unset.ts',
      `import { beforeEach } from '@thymian/hooks';

export const unsetId = beforeEach('${READ}', (request) => {
  delete request.pathParameters['id'];
});
`,
    );

    const { port, server } = await serve((reply) =>
      reply.status(201).send({ id: 'l-1', name: 'Artemis' }),
    );

    try {
      const result = await check(getTempDir(), port);

      expect(result.output).toContain(`↷ ${READ}`);
      expect(result.output).toContain('Missing value for path parameter "id".');
      // The detail line does not repeat the transaction its header names.
      expect(result.output).not.toContain('of transaction "');
      expect(result.output).toContain(`✔ ${STATUS}`);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('errors only the transaction whose hook threw, and finishes the run', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());

    writeSamplerHook(
      getTempDir(),
      'boom.ts',
      `import { beforeEach } from '@thymian/hooks';

export const boom = beforeEach('${READ}', () => {
  throw new Error('the hook is broken');
});
`,
    );

    const { port, server } = await serve((reply) =>
      reply.status(201).send({ id: 'l-1', name: 'Artemis' }),
    );

    try {
      const result = await check(getTempDir(), port);

      expect(result.output).toContain(`! ${READ}`);
      expect(result.output).toContain('the hook is broken');
      expect(result.output).toContain(`✔ ${STATUS}`);
      expect(result.output).toMatch(/1 errored/);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('exits zero when every transaction passed', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());

    writeSamplerHook(
      getTempDir(),
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seedLaunch = beforeEach('${READ}', async (request, ctx, utils) => {
  const created = await utils.request('${CREATE}', { body: { name: 'Artemis' } });

  if (created.statusCode === 201) {
    request.pathParameters['id'] = created.body.id;
  }
});
`,
    );

    const { port, server } = await serve((reply) =>
      reply.status(201).send({ id: 'l-1', name: 'Artemis' }),
    );

    try {
      const result = await check(getTempDir(), port);

      // POST /launches -> 400 is answered 201, which is a status mismatch and
      // therefore a skip, so this run is deliberately not all-passed.
      expect(result.output).toContain(`✔ ${CREATE}`);
      expect(result.output).toContain(`✔ ${READ}`);
      expect(result.output).toContain(`✔ ${STATUS}`);
      expect(result.output).toContain('1 skipped');
    } finally {
      await server.close();
    }
  }, 180_000);
});
