import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  copyFixturesToTempDir,
  execThymianRaw,
  execThymianRawAsync,
  fixturesDir,
  useTempDir,
} from './helpers.js';
import { getAvailablePort } from './port-utils.js';

/**
 * Helper: copy a fixture to temp dir and start a test server.
 * Returns the server and its port so tests can use `--target-url`.
 *
 * No `sampler init`: samples are generated in memory from the loaded specification,
 * so `thymian test` needs nothing on disk.
 */
async function setupTestEnvironment(
  fixtureName: string,
  tempDir: string,
  handler: (server: FastifyInstance) => void = addDefaultHelloHandler,
) {
  copyFixturesToTempDir(join(fixturesDir, fixtureName), tempDir);

  const port = await getAvailablePort();
  const server = fastify();
  handler(server);
  await server.listen({ port, host: '0.0.0.0' });

  return { server, port, targetUrl: `http://localhost:${port}` };
}

function addDefaultHelloHandler(server: FastifyInstance) {
  server.get<{ Querystring: { name: string } }>('/api/hello', async (req) => {
    const { name } = req.query;
    return { content: `Hello ${name}` };
  });
}

describe('thymian test', () => {
  const getTempDir = useTempDir();

  // ─── Happy Path ──────────────────────────────────────────────────────

  it('should run a dynamic API test with --target-url and exit 0 on clean run', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('@thymian/plugin-http-tester');
      expect(result.stdout).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );

      // Samples are virtual: the run needed no `sampler init` and the sampler
      // materialized nothing. `.thymian/` exists only because this fixture asks
      // plugin-reporter for a markdown report (`.thymian/reports/report.md`).
      expect(existsSync(join(getTempDir(), '.thymian', 'samples'))).toBe(false);
      expect(readdirSync(join(getTempDir(), '.thymian'))).toEqual(['reports']);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should leave no .thymian directory behind when nothing writes files', async () => {
    // Counted at the server, across every route, so the case can prove AC2's
    // "produces requests" half directly rather than inferring it from the report.
    let requestCount = 0;

    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
      (instance) => {
        instance.addHook('onRequest', async () => {
          requestCount += 1;
        });

        addDefaultHelloHandler(instance);
      },
    );

    try {
      // Drop plugin-reporter's markdown formatter — writing `.thymian/reports/report.md`
      // is the only reason this workspace would grow a `.thymian/` directory at all.
      // What is left is a workspace containing nothing but a spec and a config.
      const configPath = join(getTempDir(), 'thymian.config.yaml');
      const config = readFileSync(configPath, 'utf-8');

      expect(config).toContain("'@thymian/plugin-reporter'");

      // Remove exactly the reporter's block — its key line plus the indented
      // continuation lines under it. Slicing the file at the key's offset would
      // truncate to EOF, which is only correct while the reporter happens to be
      // the last key in the fixture: any key appended after it would be silently
      // dropped and this case would keep passing against a degraded run.
      const stripped = config.replace(
        /^ {2}'@thymian\/plugin-reporter':(?:\n(?: {3,}.*)?)*\n?/m,
        '',
      );

      expect(stripped).not.toContain('@thymian/plugin-reporter');
      expect(stripped).toContain("'@thymian/plugin-sampler'");
      expect(stripped).toContain("'@thymian/plugin-http-tester'");

      writeFileSync(configPath, stripped);

      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // Gate "successful" exactly as the happy path above does. `exitCode === 0`
      // plus a bare `Summary:` also holds for a run that produced no test cases at
      // all. Both strings below come from `common-cli`'s report renderer, not from
      // the reporter that was just stripped, so they cost nothing here.
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('@thymian/plugin-http-tester');
      expect(result.stdout).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );

      // A clean run reports no findings of any severity, so every counter in that
      // summary is 0 and the line cannot by itself separate "ran the tests" from
      // "had nothing to run". The request counter can, and it is the half of AC2
      // this case exists to demonstrate: requests were produced from the spec
      // alone, with no `sampler init` and nothing on disk.
      expect(requestCount).toBeGreaterThan(0);

      // No `sampler init`, no samples on disk, nothing written.
      expect(existsSync(join(getTempDir(), '.thymian'))).toBe(false);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should include test rule results in output', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.output).toContain('@thymian/plugin-http-tester');
      expect(result.output).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── --target-url Overrides Spec Servers ──────────────────────────

  it('should override spec server URL with --target-url', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      // The spec says localhost:3000, but --target-url should redirect requests
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // If target-url wasn't applied, requests would go to port 3000 and fail
      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should use --target-url with a spec that has no servers defined', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test-no-servers',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Exit Code Semantics ──────────────────────────────────────────

  it('should report skipped test cases when server returns unexpected status', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
      (s) => {
        // Return 501 Not Implemented — rules skip when the initial response
        // does not match the expected status from the OpenAPI spec.
        s.get('/api/hello', async (_req, reply) => {
          await reply.status(501).send({ error: 'Not Implemented' });
        });
      },
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir(), allowFailure: true },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('@thymian/plugin-http-tester');
      expect(result.stdout).toContain('Summary:');
    } finally {
      await server.close();
    }
  }, 180_000);

  it('should exit 2 when server is unreachable (tool error)', async () => {
    copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

    // Use a port that has nothing listening — no server in this test, so
    // spawnSync is fine (no event-loop contention).
    const port = await getAvailablePort();
    const result = execThymianRaw(
      ['test', '--target-url', `http://localhost:${port}`],
      { cwd: getTempDir(), allowFailure: true },
    );

    // ECONNREFUSED causes a tool-error → exit code 2
    expect(result.exitCode).toBe(2);
  }, 180_000);

  it('should exit 1 when violations are found', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        [
          'test',
          '--target-url',
          targetUrl,
          '--rule-severity',
          'warn',
          '--rule-set',
          '@thymian/rules-rfc-9110',
        ],
        { cwd: getTempDir(), allowFailure: true },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Summary:');
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── --spec Flag ──────────────────────────────────────────────────

  it('should accept specification via --spec flag', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        [
          'test',
          '--spec',
          'openapi:test.openapi.yaml',
          '--target-url',
          targetUrl,
        ],
        { cwd: getTempDir() },
      );

      expect(result.exitCode).toBe(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── --rule-set Flag ──────────────────────────────────────────────

  it('should accept rule sets via --rule-set flag', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        [
          'test',
          '--rule-set',
          '@thymian/rules-rfc-9110',
          '--target-url',
          targetUrl,
        ],
        { cwd: getTempDir() },
      );

      expect(result.output).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Output Format ────────────────────────────────────────────────

  it('should produce structured output with reporter', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      // Reporter output should be on stdout
      expect(result.stdout.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Stderr vs Stdout Separation ──────────────────────────────────

  it('should write report output to stdout, not stderr', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const result = await execThymianRawAsync(
        ['test', '--target-url', targetUrl],
        { cwd: getTempDir() },
      );

      expect(result.stdout).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Deterministic Output ─────────────────────────────────────────

  it('should produce deterministic output across consecutive runs', async () => {
    const { server, targetUrl } = await setupTestEnvironment(
      'dynamic-test',
      getTempDir(),
    );

    try {
      const run1 = await execThymianRawAsync(
        ['test', '--target-url', targetUrl, '--suppress-feedback'],
        { cwd: getTempDir() },
      );
      const run2 = await execThymianRawAsync(
        ['test', '--target-url', targetUrl, '--suppress-feedback'],
        { cwd: getTempDir() },
      );

      expect(run1.exitCode).toBe(run2.exitCode);

      const normalize = (value: string) =>
        value
          .replace(
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,
            '<timestamp>',
          )
          // Real execution durations legitimately vary between runs.
          .replace(/\(\d+(?:\.\d+)?ms\)/g, '(<duration>)');

      expect(normalize(run1.stdout)).toBe(normalize(run2.stdout));
    } finally {
      await server.close();
    }
  }, 180_000);

  // ─── Missing Specification ────────────────────────────────────────

  it('should exit 2 when no specification is configured', async () => {
    const result = execThymianRaw(['test'], {
      cwd: getTempDir(),
      allowFailure: true,
    });

    expect(result.exitCode).toBe(2);
    expect(result.output).toMatch(/No specification/i);
  }, 180_000);

  // ─── Config-based targetUrl ───────────────────────────────────────

  it('should read targetUrl from config file', async () => {
    const port = await getAvailablePort();
    const server = fastify();
    addDefaultHelloHandler(server);
    await server.listen({ port, host: '0.0.0.0' });

    try {
      copyFixturesToTempDir(join(fixturesDir, 'dynamic-test'), getTempDir());

      // Write config with targetUrl baked in
      const configPath = join(getTempDir(), 'thymian.config.yaml');
      const configContent = readFileSync(configPath, 'utf-8');
      writeFileSync(
        configPath,
        configContent + `targetUrl: 'http://localhost:${port}'\n`,
      );

      const result = await execThymianRawAsync(['test'], {
        cwd: getTempDir(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(
        /Summary: 0 errors, 0 warnings, 0 hints, \d+ infos?\./,
      );
    } finally {
      await server.close();
    }
  }, 180_000);
});
