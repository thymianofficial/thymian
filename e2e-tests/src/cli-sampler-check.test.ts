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
 * #48 / #50: every Transaction ends in exactly one Outcome, the run always
 * finishes, a skip names the Seed behind it, and `--json` is the machine
 * contract for all of it.
 *
 * `--json` is the assertion surface wherever the claim is about outcomes: it
 * says what the command decided without going through the rendering. The one
 * human-mode assertion below is about the rendering itself.
 */
describe('the sampler check outcome model', () => {
  const getTempDir = useTempDir();

  type CheckReport = {
    summary: {
      passed: number;
      failed: number;
      skipped: number;
      errored: number;
      total: number;
    };
    transactions: {
      selector: string;
      outcome: 'passed' | 'failed' | 'skipped' | 'errored';
      expectedStatus: number;
      actualStatus?: number;
      reason?: string;
      causedBy?: string;
    }[];
  };

  /**
   * A server for the outcomes fixture. `createStatus` decides what
   * `POST /launches` answers with, which is what every scenario varies.
   */
  async function serve(createStatus: number, createBody: unknown) {
    const port = await getAvailablePort();
    const server = fastify();

    server.post('/launches', async (_req, reply) =>
      reply.status(createStatus).send(createBody),
    );
    server.get('/launches/:id', async (req) => ({
      id: (req.params as { id: string }).id,
      name: 'Artemis',
    }));
    server.get('/status', async () => ({ state: 'ok' }));

    await server.listen({ port, host: '0.0.0.0' });

    return { port, server };
  }

  async function check(cwd: string, port: number, json = true) {
    return await execThymianRawAsync(
      [
        'sampler',
        'check',
        '--target-url',
        `http://localhost:${port}`,
        ...(json ? ['--json'] : []),
      ],
      { cwd, allowFailure: true },
    );
  }

  /** The JSON document, and the proof that it was the only thing on stdout. */
  function reportOf(stdout: string): CheckReport {
    return JSON.parse(stdout) as CheckReport;
  }

  function transaction(report: CheckReport, selector: string) {
    const found = report.transactions.find(
      (entry) => entry.selector === selector,
    );

    if (!found) {
      throw new Error(`no transaction ${selector} in the report`);
    }

    return found;
  }

  /** Seeds `GET /launches/{id}` from `POST /launches`, handling nothing. */
  function writeUnbranchedSeed(tempDir: string): void {
    writeSamplerHook(
      tempDir,
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seedLaunch = beforeEach('${READ}', async (request, ctx, utils) => {
  const created = await utils.request('${CREATE}', { body: { name: 'Artemis' } });

  // Deliberately unbranched: a hook that ignores the other declared responses
  // still compiles and still runs.
  request.pathParameters['id'] = created.body.id;
});
`,
    );
  }

  it('skips a transaction whose seed was answered with another declared status', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());
    writeUnbranchedSeed(getTempDir());

    // 400 is declared for POST /launches, so the seed returns rather than
    // throwing — and its body has no id.
    const { port, server } = await serve(400, { message: 'no' });

    try {
      const result = await check(getTempDir(), port);
      const report = reportOf(result.stdout);

      expect(transaction(report, READ)).toMatchObject({
        outcome: 'skipped',
        causedBy: CREATE,
      });
      expect(transaction(report, READ).reason).toContain(
        'Missing value for path parameter "id"',
      );
      // The run reached the transactions after the broken one.
      expect(transaction(report, STATUS).outcome).toBe('passed');
      expect(report.summary.total).toBe(4);
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('skips a transaction whose seed was answered with an undeclared status', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());
    writeUnbranchedSeed(getTempDir());

    // 500 is declared nowhere, so the seed throws UndeclaredResponseError —
    // which nobody is forced to catch.
    const { port, server } = await serve(500, { message: 'constraint failed' });

    try {
      const result = await check(getTempDir(), port);
      const report = reportOf(result.stdout);
      const read = transaction(report, READ);

      expect(read).toMatchObject({ outcome: 'skipped', causedBy: CREATE });
      expect(read.reason).toContain(
        'was answered with 500, which the specification does not declare',
      );
      expect(transaction(report, STATUS).outcome).toBe('passed');
      expect(result.exitCode).not.toBe(0);

      // And the same run, rendered: one glyph per outcome, each reason once,
      // and no detail line repeating the transaction its header names.
      const human = await check(getTempDir(), port, false);

      expect(human.output).toContain(`↷ ${READ}`);
      expect(human.output).toContain(`✔ ${STATUS}`);
      expect(human.output.split(String(read.reason)).length - 1).toBe(1);
      expect(human.output).toContain('Checked 4 transactions:');
      expect(human.exitCode).not.toBe(0);
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

    const { port, server } = await serve(201, { id: 'l-1', name: 'Artemis' });

    try {
      const result = await check(getTempDir(), port);
      const report = reportOf(result.stdout);

      expect(transaction(report, READ)).toMatchObject({
        outcome: 'skipped',
        reason: 'Missing value for path parameter "id".',
      });
      expect(transaction(report, STATUS).outcome).toBe('passed');
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

    const { port, server } = await serve(201, { id: 'l-1', name: 'Artemis' });

    try {
      const result = await check(getTempDir(), port);
      const report = reportOf(result.stdout);

      expect(transaction(report, READ).outcome).toBe('errored');
      expect(transaction(report, READ).reason).toContain('"boom"');
      expect(report.summary.errored).toBe(1);
      expect(transaction(report, STATUS).outcome).toBe('passed');
      expect(transaction(report, CREATE).outcome).toBe('passed');
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('passes every transaction it can, with the seed branched on', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'sampler-outcomes'), getTempDir());

    writeSamplerHook(
      getTempDir(),
      'seed.ts',
      `import { beforeEach } from '@thymian/hooks';

export const seedLaunch = beforeEach('${READ}', async (request, ctx, utils) => {
  const created = await utils.request('${CREATE}', { body: { name: 'Artemis' } });

  if (created.statusCode !== 201) {
    utils.skip('the launch to read could not be created');
  }

  request.pathParameters['id'] = created.body.id;
});
`,
    );

    const { port, server } = await serve(201, { id: 'l-1', name: 'Artemis' });

    try {
      const result = await check(getTempDir(), port);
      const report = reportOf(result.stdout);

      expect(transaction(report, CREATE).outcome).toBe('passed');
      expect(transaction(report, READ).outcome).toBe('passed');
      expect(transaction(report, STATUS).outcome).toBe('passed');
      // `POST /launches -> 400` is answered 201, which is a status mismatch and
      // therefore a skip — so this run is deliberately not all-passed.
      expect(report.summary).toMatchObject({ passed: 3, skipped: 1, total: 4 });
      expect(result.exitCode).not.toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);
});
